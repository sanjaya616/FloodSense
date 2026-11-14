/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeApp as initializeAdminApp, cert, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ServiceHealthState =
  | 'NOT_CONFIGURED'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'DEMONSTRATION_MODE'
  | 'NOT_VERIFIED';

interface CachedWeather {
  data: any;
  timestamp: number;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const GEMINI_VERIFY_MODEL = 'gemini-4-hydrogen';
const GEMINI_METHOD_LABEL = 'Gemini 4 Hydrogen (Multimodal)';

/**
 * Validates decoded binary magic bytes against supported image formats.
 */
export function detectImageMimeFromBuffer(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!buf || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  // WEBP: RIFF....WEBP
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/**
 * Selects the next 3 hourly forecast values strictly after current Colombo time.
 */
export function extractNext3HourForecast(
  hourlyTime: string[],
  hourlyPrecipitation: number[],
  currentTimeIsoLocal: string
): {
  values: number[];
  totalMm: number;
  forecastTimeRange: string | null;
  forecastAvailable: boolean;
} {
  if (!Array.isArray(hourlyTime) || !Array.isArray(hourlyPrecipitation) || hourlyTime.length === 0) {
    return { values: [], totalMm: 0, forecastTimeRange: null, forecastAvailable: false };
  }

  const parseColomboMs = (t: string) => {
    if (!t) return NaN;
    const normalized = t.includes('+') || t.endsWith('Z') ? t : `${t}:00+05:30`;
    // If string already has seconds like HH:MM:SS, avoid appending extra :00
    const safeStr = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t) ? `${t}:00+05:30` : normalized;
    return Date.parse(safeStr);
  };

  const nowColomboStr =
    currentTimeIsoLocal ||
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(new Date())
      .replace(' ', 'T');

  const currentMs = parseColomboMs(nowColomboStr);
  let startIdx = -1;

  if (!isNaN(currentMs)) {
    startIdx = hourlyTime.findIndex((t) => {
      const slotMs = parseColomboMs(t);
      return !isNaN(slotMs) && slotMs > currentMs;
    });
  } else {
    const exactIdx = hourlyTime.indexOf(nowColomboStr);
    if (exactIdx !== -1 && exactIdx + 1 < hourlyTime.length) {
      startIdx = exactIdx + 1;
    }
  }

  if (startIdx === -1) {
    return { values: [], totalMm: 0, forecastTimeRange: null, forecastAvailable: false };
  }

  const endIdx = Math.min(hourlyTime.length, startIdx + 3);
  const sliceValues = hourlyPrecipitation
    .slice(startIdx, endIdx)
    .map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0));

  const startLabel = hourlyTime[startIdx]?.slice(11, 16) || '';
  const endHourDate = new Date(parseColomboMs(hourlyTime[endIdx - 1]) + 60 * 60 * 1000);
  const endLabel = !isNaN(endHourDate.getTime())
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(endHourDate)
    : hourlyTime[endIdx - 1]?.slice(11, 16) || '';

  const totalMm = Number(sliceValues.reduce((sum, val) => sum + val, 0).toFixed(1));
  return {
    values: sliceValues,
    totalMm,
    forecastTimeRange: `${startLabel} - ${endLabel} (Asia/Colombo)`,
    forecastAvailable: sliceValues.length > 0,
  };
}

// Lazy Firebase Admin initialization (fails gracefully when service account is not provided)
let adminApp: AdminApp | null = null;
let adminInitError: string | null = null;
let adminAttempted = false;

function getFirebaseAdmin() {
  if (adminAttempted) return { adminApp, adminInitError };
  adminAttempted = true;
  try {
    if (getAdminApps().length > 0) {
      adminApp = getAdminApps()[0];
      return { adminApp, adminInitError };
    }
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson && rawJson.trim().startsWith('{')) {
      const parsed = JSON.parse(rawJson);
      adminApp = initializeAdminApp({ credential: cert(parsed) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      adminApp = initializeAdminApp();
    }
  } catch (err: any) {
    adminInitError = err?.message || 'Failed to initialize Firebase Admin SDK';
    adminApp = null;
  }
  return { adminApp, adminInitError };
}

// Simple sliding-window in-memory rate limiter
function createRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'local';
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      const retryAfterSec = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before submitting another verification request.',
        retryAfterSeconds: retryAfterSec,
      });
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

export interface ServerTestOverrides {
  geminiApiKey?: string | null;
  fetchImpl?: typeof fetch;
  aiClientFactory?: (apiKey: string) => { models: { generateContent: (args: any) => Promise<{ text?: string }> } };
  forceSkipAuthCheck?: boolean;
}

export function createApiApp(overrides: ServerTestOverrides = {}) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const fetchFn = overrides.fetchImpl || fetch;
  let cachedWeather: CachedWeather | null = null;
  let lastWeatherSuccessTime: string | null = null;
  let lastWeatherError: string | null = null;
  let lastTileServiceSuccessTime: string | null = null;
  let lastAiSuccessTime: string | null = null;
  let lastAiError: string | null = null;

  const getGeminiKey = () => {
    if (overrides.geminiApiKey !== undefined) return overrides.geminiApiKey;
    const k = process.env.GEMINI_API_KEY;
    return k && k !== 'MY_GEMINI_API_KEY' ? k : null;
  };

  const hasClientFirebaseEnv = () =>
    Boolean(
      process.env.VITE_FIREBASE_API_KEY &&
        process.env.VITE_FIREBASE_PROJECT_ID &&
        process.env.VITE_FIREBASE_API_KEY !== 'MY_FIREBASE_API_KEY'
    );

  async function verifyOptionalLiveAuth(req: Request): Promise<{ ok: boolean; uid?: string; email?: string; role?: string; error?: string }> {
    if (overrides.forceSkipAuthCheck) return { ok: true };
    const { adminApp: admin } = getFirebaseAdmin();
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    // Require verified Firebase ID token when both Firebase client mode and Admin SDK are active
    if (hasClientFirebaseEnv() && admin) {
      if (!token) {
        return { ok: false, error: 'Missing Authorization Bearer token for live Firebase mode.' };
      }
      try {
        const decoded = await getAdminAuth(admin).verifyIdToken(token);
        const db = getAdminFirestore(admin);
        const userSnap = await db.collection('users').doc(decoded.uid).get();
        const role = userSnap.exists ? (userSnap.data()?.role as string) : 'citizen';
        return { ok: true, uid: decoded.uid, email: decoded.email, role };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Invalid Firebase ID token.' };
      }
    }

    // If token was provided and Admin SDK exists, verify it opportunistically
    if (token && admin) {
      try {
        const decoded = await getAdminAuth(admin).verifyIdToken(token);
        return { ok: true, uid: decoded.uid, email: decoded.email };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Invalid Bearer token.' };
      }
    }

    return { ok: true };
  }

  const aiRateLimiter = createRateLimiter(20, 5 * 60 * 1000);
  const syncRateLimiter = createRateLimiter(30, 5 * 60 * 1000);

  // --- API ROUTE 1: Real-time System Health & Honest Service Probes ---
  app.get('/api/health', async (_req, res) => {
    const geminiKey = getGeminiKey();
    const clientFirebaseConfigured = hasClientFirebaseEnv();
    const { adminApp: admin, adminInitError: adminErr } = getFirebaseAdmin();

    // Probe OSM tile availability
    let mapState: ServiceHealthState = 'DISCONNECTED';
    let mapLabel = 'Tile Service Unreachable';
    try {
      const tileRes = await fetchFn('https://tile.openstreetmap.org/0/0/0.png', {
        method: 'HEAD',
        signal: AbortSignal.timeout(2500),
      });
      if (tileRes.ok) {
        lastTileServiceSuccessTime = new Date().toISOString();
        mapState = 'CONNECTED';
        mapLabel = 'Tile Service Available';
      } else {
        mapState = 'ERROR';
        mapLabel = `HTTP ${tileRes.status}`;
      }
    } catch {
      mapState = lastTileServiceSuccessTime ? 'DISCONNECTED' : 'ERROR';
      mapLabel = 'Tile Probe Timed Out';
    }

    // Weather state based on recent live fetch or demonstration fallback
    let weatherState: ServiceHealthState = 'NOT_VERIFIED';
    let weatherLabel = 'Not Yet Queried';
    if (cachedWeather && Date.now() - cachedWeather.timestamp < 300000 && cachedWeather.data?.isLive) {
      weatherState = 'CONNECTED';
      weatherLabel = 'Open-Meteo Live';
    } else if (lastWeatherError) {
      weatherState = 'DEMONSTRATION_MODE';
      weatherLabel = 'Demonstration Fallback (Open-Meteo Unreachable)';
    }

    // Firebase state: genuine Admin SDK Firestore probe if configured, otherwise honest status
    let firebaseState: ServiceHealthState = 'NOT_CONFIGURED';
    let firebaseLabel = 'Not Configured (Demonstration Mode)';
    let firebaseRulesStatus = 'Unknown (Firebase not provisioned)';

    if (admin) {
      try {
        await getAdminFirestore(admin).collection('public_reports').limit(1).get();
        firebaseState = 'CONNECTED';
        firebaseLabel = 'Firebase Admin Connected';
        firebaseRulesStatus = 'Manage & verify via Firebase Console / deploy_firebase';
      } catch (err: any) {
        firebaseState = 'ERROR';
        firebaseLabel = `Firestore Probe Error: ${err?.message || 'Unknown'}`;
        firebaseRulesStatus = 'Verification failed';
      }
    } else if (adminErr) {
      firebaseState = 'ERROR';
      firebaseLabel = adminErr;
      firebaseRulesStatus = 'Admin SDK initialization error';
    } else if (clientFirebaseConfigured) {
      firebaseState = 'NOT_VERIFIED';
      firebaseLabel = 'Client SDK Configured (Server Admin Unconfigured)';
      firebaseRulesStatus = 'Rules file present in repo; server verification requires Admin credentials';
    } else {
      firebaseState = 'DEMONSTRATION_MODE';
      firebaseLabel = 'Demonstration Mode (Local Service Layer)';
      firebaseRulesStatus = 'Local files present (firestore.rules / storage.rules) — not active without Firebase project';
    }

    // Gemini AI state (without burning paid API quota on health checks)
    let geminiState: ServiceHealthState = 'NOT_CONFIGURED';
    let geminiLabel = 'Not Configured (Demonstration Heuristic Active)';
    if (geminiKey) {
      if (lastAiError) {
        geminiState = 'ERROR';
        geminiLabel = `Last Inference Error: ${lastAiError}`;
      } else if (lastAiSuccessTime) {
        geminiState = 'CONNECTED';
        geminiLabel = 'Connected (Verified on Recent Request)';
      } else {
        geminiState = 'NOT_VERIFIED';
        geminiLabel = 'API Key Present (Not Yet Invoked)';
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      status: 'operational',
      environment: process.env.NODE_ENV || 'development',
      services: {
        geminiAi: {
          state: geminiState,
          status: geminiLabel,
          configured: Boolean(geminiKey),
          mode: geminiKey ? 'Live Multimodal AI (Server-Side)' : 'Demonstration Heuristic (Simulated)',
          model: GEMINI_VERIFY_MODEL,
          lastSuccess: lastAiSuccessTime,
          lastError: lastAiError,
          lastChecked: new Date().toISOString(),
        },
        weatherApi: {
          state: weatherState,
          status: weatherLabel,
          provider: 'Open-Meteo Forecast API',
          mode: weatherState === 'CONNECTED' ? 'Live API Telemetry' : 'Demonstration Fallback / Standby',
          lastSuccessfulConnection: lastWeatherSuccessTime,
          lastError: lastWeatherError,
        },
        firebase: {
          state: firebaseState,
          status: firebaseLabel,
          mode: clientFirebaseConfigured ? 'Firebase Cloud Mode Configured' : 'Demonstration Mode (Local Service Layer)',
          adminSdkReady: Boolean(admin),
          rulesConfigured: null,
          rulesNote: firebaseRulesStatus,
        },
        blockchain: {
          state: 'DEMONSTRATION_MODE' as ServiceHealthState,
          status: 'Prototype SHA-256 Hash-Chain (Simulated)',
          network: 'Local SHA-256 Audit Spec / Sepolia Testnet Prototype',
          chainId: 11155111,
          isSimulated: true,
        },
        mapTileService: {
          state: mapState,
          status: mapLabel,
          provider: 'OpenStreetMap Carto',
          lastSuccessfulConnection: lastTileServiceSuccessTime,
          lastChecked: new Date().toISOString(),
        },
      },
    });
  });

  // --- API ROUTE 2: Weather Telemetry (Open-Meteo Asia/Colombo Integration) ---
  app.get('/api/weather/colombo', async (req, res) => {
    const rawLat = req.query.lat ? Number(req.query.lat) : 6.9271;
    const rawLng = req.query.lng ? Number(req.query.lng) : 79.8653;
    const lat = Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : 6.9271;
    const lng = Number.isFinite(rawLng) && rawLng >= -180 && rawLng <= 180 ? rawLng : 79.8653;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
        lat.toFixed(4)
      )}&longitude=${encodeURIComponent(
        lng.toFixed(4)
      )}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m&hourly=precipitation,temperature_2m&timezone=Asia%2FColombo&forecast_days=2`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const response = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const current = data.current || {};
        const hourly = data.hourly || {};

        const forecast = extractNext3HourForecast(
          Array.isArray(hourly.time) ? hourly.time : [],
          Array.isArray(hourly.precipitation) ? hourly.precipitation : [],
          current.time || ''
        );

        const deg = typeof current.wind_direction_10m === 'number' ? current.wind_direction_10m : 225;
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const windDirection = dirs[Math.round(deg / 45) % 8];

        const precip = typeof current.precipitation === 'number' ? current.precipitation : 0;
        const currentTemp = Math.round(current.temperature_2m ?? 28);
        const humidity = Math.round(current.relative_humidity_2m ?? 88);
        const windSpeed = Math.round(current.wind_speed_10m ?? 18);

        const weatherPayload = {
          success: true,
          provider: 'Open-Meteo Forecast API',
          source: 'Open-Meteo Forecast API',
          isLive: true,
          isUsingDemonstrationFallback: false,
          coordinates: { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) },
          currentTempC: currentTemp,
          currentRainfallMm: Number(precip.toFixed(1)),
          expected3hRainfallMm: forecast.totalMm,
          forecastAvailable: forecast.forecastAvailable,
          forecastTimeRange: forecast.forecastTimeRange || 'Hourly forecast unavailable',
          rainfallUnit: 'mm',
          humidityPercent: humidity,
          windSpeedKmh: windSpeed,
          windDirection,
          updatedAt: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' }),
          condition:
            precip > 15
              ? 'Heavy Monsoon Downpour'
              : precip > 5
              ? 'Moderate Rain Showers'
              : precip > 0.1
              ? 'Light Rain Showers'
              : 'Overcast & High Humidity',
          status:
            precip > 10 || forecast.totalMm > 20
              ? 'Precipitation Threshold Advisory'
              : 'Normal Conditions Monitoring',
        };

        cachedWeather = { data: weatherPayload, timestamp: Date.now() };
        lastWeatherSuccessTime = new Date().toISOString();
        lastWeatherError = null;
        return res.json(weatherPayload);
      }

      lastWeatherError = `Open-Meteo returned HTTP ${response.status}`;
    } catch (err: any) {
      lastWeatherError = err?.message || 'Open-Meteo request failed';
      console.warn('Open-Meteo API fetch failed or timed out:', lastWeatherError);
    }

    // Demonstration fallback telemetry (explicitly marked as simulated fallback)
    return res.json({
      success: true,
      provider: 'Demonstration Meteorological Scenario (Simulated)',
      source: 'Demonstration Meteorological Scenario (Simulated)',
      isLive: false,
      isUsingDemonstrationFallback: true,
      coordinates: { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) },
      currentTempC: 28,
      currentRainfallMm: 34.5,
      expected3hRainfallMm: 48.0,
      forecastAvailable: false,
      forecastTimeRange: 'Demonstration Snapshot (Live Feed Unavailable)',
      rainfallUnit: 'mm',
      humidityPercent: 92,
      windSpeedKmh: 24,
      windDirection: 'SW',
      updatedAt: 'Demonstration Fallback',
      condition: 'Monsoonal Thunderstorms & Heavy Showers',
      status: 'Simulated Monsoon High Runoff Scenario',
    });
  });

  // --- API ROUTE 3: Server-Side Multimodal AI Verification (Gemini 4 Hydrogen) ---
  app.post('/api/ai/verify', aiRateLimiter, async (req, res) => {
    const authCheck = await verifyOptionalLiveAuth(req);
    if (!authCheck.ok) {
      return res.status(401).json({ error: authCheck.error || 'Unauthorized' });
    }

    const {
      imageBase64,
      mimeType = 'image/jpeg',
      description = '',
      waterLevel = 'Moderate',
      floodType = 'Street Waterlogging',
    } = req.body || {};

    const timestamp = new Date().toISOString();
    const disclaimer =
      'AI image assessment is an assistive early warning signal only. Official verification requires authorized emergency officer confirmation.';

    // Explicit NO-IMAGE state: NEVER claim COMPLETED or 0% fake assessment
    if (!imageBase64 || typeof imageBase64 !== 'string' || !imageBase64.trim()) {
      return res.json({
        method: 'No Visual Analysis Run (Text-Only Report)',
        modelName: 'None',
        aiStatus: 'NOT_RUN',
        hasVisibleFlooding: false,
        aiAssessment: 'AI Not Run (No Image)',
        officialStatus: 'Under Review',
        confidence: null,
        explanation: 'No photograph was attached to this report. AI visual verification was not run; report queued for manual field inspection.',
        uncertainty: 'Visual confirmation unavailable: text-only submission.',
        waterLevelEstimated: waterLevel,
        roadAccessibilityEstimated: 'Uncertain',
        humanVerificationRequired: true,
        timestamp,
        disclaimer,
      });
    }

    // Validate MIME types against allowlist
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const normalizedMime = typeof mimeType === 'string' ? mimeType.toLowerCase() : 'image/jpeg';
    if (!validMimes.includes(normalizedMime)) {
      return res.status(400).json({
        error: 'Invalid image format. Supported formats are JPG, JPEG, PNG, and WEBP.',
      });
    }

    // Resolve local /images/... paths strictly inside /public/images/
    let resolvedBase64 = imageBase64.trim();
    if (resolvedBase64.startsWith('/images/')) {
      const publicImagesDir = path.resolve(__dirname, 'public', 'images');
      const candidatePath = path.resolve(__dirname, 'public', resolvedBase64.replace(/^\/+/, ''));
      if (!candidatePath.startsWith(publicImagesDir + path.sep) || !fs.existsSync(candidatePath)) {
        return res.status(400).json({ error: 'Invalid local demonstration image path.' });
      }
      resolvedBase64 = fs.readFileSync(candidatePath).toString('base64');
    }

    const cleanBase64 = resolvedBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    if (imageBuffer.length < 32) {
      return res.status(400).json({
        error: 'Image payload is empty or corrupt.',
      });
    }

    if (imageBuffer.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({
        error: `Image size (${(imageBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum 5 MB server limit.`,
      });
    }

    const detectedMime = detectImageMimeFromBuffer(imageBuffer);
    if (!detectedMime) {
      return res.status(400).json({
        error: 'Uploaded binary does not match JPEG, PNG, or WEBP magic-byte signatures.',
      });
    }

    const geminiKey = getGeminiKey();
    if (geminiKey) {
      try {
        const ai = overrides.aiClientFactory
          ? overrides.aiClientFactory(geminiKey)
          : new GoogleGenAI({
              apiKey: geminiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                },
              },
            });

        const prompt = `You are the AI verification engine for FloodSense, an urban disaster management prototype for Colombo, Sri Lanka.
Analyze this submitted photograph carefully.
Citizen submission context:
- Claimed Water Level: "${waterLevel}"
- Flood Type: "${floodType}"
- Description: "${String(description).slice(0, 600)}"

Examine whether:
- Visible flooding or standing water exists
- Road surfaces or curbs/pedestrian paths are submerged
- Vehicles are affected or drainage overflow is visible
- Photograph is unclear, dark, unrelated, or unusable

Be objective and factual. Do NOT invent damage or flood severity.
Provide confidenceScore strictly as a percentage from 0 to 100 (e.g., 88 for 88%, never a 0.0-1.0 decimal).`;

        const timeoutMs = 30000;
        const controller = new AbortController();
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

        const runGeminiVerification = () =>
          ai.models.generateContent({
            model: GEMINI_VERIFY_MODEL,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: detectedMime,
                    data: cleanBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
            config: {
              abortSignal: controller.signal,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
              },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  hasVisibleFlooding: { type: Type.BOOLEAN },
                  confidenceScore: {
                    type: Type.NUMBER,
                    description: 'Percentage confidence from 0 to 100 (e.g. 88.5 for 88.5%, NOT a 0 to 1 decimal).',
                  },
                  assessment: {
                    type: Type.STRING,
                    enum: [
                      'Possible Flooding Detected',
                      'No Clear Flooding Detected',
                      'Uncertain Image',
                      'Invalid or Unusable Photograph',
                    ],
                  },
                  observedWaterLevel: {
                    type: Type.STRING,
                    enum: ['Low', 'Moderate', 'High', 'Severe', 'None'],
                  },
                  observedAccessibility: {
                    type: Type.STRING,
                    enum: ['Open', 'Partially Blocked', 'Completely Blocked', 'Uncertain'],
                  },
                  detailedExplanation: { type: Type.STRING },
                  uncertaintyNotes: { type: Type.STRING },
                },
                required: [
                  'hasVisibleFlooding',
                  'confidenceScore',
                  'assessment',
                  'observedWaterLevel',
                  'observedAccessibility',
                  'detailedExplanation',
                  'uncertaintyNotes',
                ],
              },
            },
          });

        let geminiRes: { text?: string };
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              const timeoutError = new Error('Gemini multimodal verification timed out after 30s');
              controller.abort(timeoutError);
              reject(timeoutError);
            }, timeoutMs);
          });

          const invokeWithTransientRetry = async () => {
            try {
              return await runGeminiVerification();
            } catch (firstErr: any) {
              const status = firstErr?.status ?? firstErr?.code;
              const msg = String(firstErr?.message || '');
              const isTransient =
                !controller.signal.aborted &&
                (status === 429 || status === 503 || status === 500 || /ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg));
              if (!isTransient) {
                throw firstErr;
              }
              await new Promise((r) => setTimeout(r, 500));
              return await runGeminiVerification();
            }
          };

          geminiRes = await Promise.race([invokeWithTransientRetry(), timeoutPromise]);
        } finally {
          if (timeoutHandle !== undefined) {
            clearTimeout(timeoutHandle);
          }
        }

        const responseText = geminiRes.text || '';
        let parsed: any;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          throw new Error('Gemini returned malformed non-JSON output');
        }

        if (
          typeof parsed.confidenceScore !== 'number' ||
          !Number.isFinite(parsed.confidenceScore) ||
          parsed.confidenceScore < 0 ||
          parsed.confidenceScore > 100
        ) {
          throw new Error('Gemini output omitted a valid numeric confidenceScore (0-100)');
        }

        const confidenceScore = Number(parsed.confidenceScore.toFixed(1));
        const validAssessments = new Set([
          'Possible Flooding Detected',
          'No Clear Flooding Detected',
          'Uncertain Image',
          'Invalid or Unusable Photograph',
        ]);
        const aiAssessment = validAssessments.has(parsed.assessment)
          ? parsed.assessment
          : parsed.hasVisibleFlooding === true
          ? 'Possible Flooding Detected'
          : 'Uncertain Image';

        lastAiSuccessTime = new Date().toISOString();
        lastAiError = null;

        // IMPORTANT: AI never auto-verifies an incident
        return res.json({
          method: GEMINI_METHOD_LABEL,
          modelName: GEMINI_VERIFY_MODEL,
          aiStatus: 'COMPLETED',
          hasVisibleFlooding: Boolean(parsed.hasVisibleFlooding),
          aiAssessment,
          officialStatus: 'Under Review',
          confidence: confidenceScore,
          explanation:
            typeof parsed.detailedExplanation === 'string' && parsed.detailedExplanation.trim()
              ? parsed.detailedExplanation
              : `Visual inspection indicated ${aiAssessment.toLowerCase()}.`,
          uncertainty:
            typeof parsed.uncertaintyNotes === 'string' && parsed.uncertaintyNotes.trim()
              ? parsed.uncertaintyNotes
              : 'Optical assessment subject to camera angle and lighting conditions. Field officer verification required.',
          waterLevelEstimated: parsed.observedWaterLevel || waterLevel,
          roadAccessibilityEstimated: parsed.observedAccessibility || 'Uncertain',
          humanVerificationRequired: true,
          timestamp,
          disclaimer,
        });
      } catch (err: any) {
        lastAiError = err?.message || 'Gemini inference error';
        console.error('Gemini multimodal verification error:', lastAiError);
        return res.status(502).json({
          method: GEMINI_METHOD_LABEL,
          modelName: GEMINI_VERIFY_MODEL,
          aiStatus: 'FAILED',
          hasVisibleFlooding: false,
          aiAssessment: 'AI Processing Failed',
          officialStatus: 'Under Review',
          confidence: null,
          explanation: `Gemini AI processing failed (${lastAiError}). Your flood report can still be saved safely and queued for officer review.`,
          uncertainty: 'Live AI model failed to return a valid structured assessment.',
          waterLevelEstimated: waterLevel,
          roadAccessibilityEstimated: 'Uncertain',
          humanVerificationRequired: true,
          timestamp,
          disclaimer,
        });
      }
    }

    // Demonstration heuristic fallback ONLY when GEMINI_API_KEY is not configured
    const isSevere = waterLevel === 'Severe' || waterLevel === 'High';
    const confidence = isSevere ? 88.5 : 78.0;

    return res.json({
      method: 'Demonstration Heuristic (Simulation)',
      modelName: 'None (Academic Simulation)',
      aiStatus: 'SIMULATED',
      hasVisibleFlooding: true,
      aiAssessment: 'Possible Flooding Detected',
      officialStatus: 'Under Review',
      confidence,
      explanation: `Simulated heuristic result (Academic Prototype — GEMINI_API_KEY not configured): Roadway photograph accepted (${detectedMime}, ${(imageBuffer.length / 1024).toFixed(0)} KB).`,
      uncertainty: 'Simulated score for academic evaluation. Does not represent live Gemini Vision inference.',
      waterLevelEstimated: waterLevel,
      roadAccessibilityEstimated: isSevere ? 'Completely Blocked' : 'Partially Blocked',
      humanVerificationRequired: true,
      timestamp,
      disclaimer,
    });
  });

  // --- API ROUTE 4: Trusted Server-Side Public Map & Audit Sync (Firebase Admin) ---
  app.post('/api/reports/public-sync', syncRateLimiter, async (req, res) => {
    const { adminApp: admin } = getFirebaseAdmin();
    if (!admin) {
      return res.status(501).json({
        ok: false,
        reason: 'ADMIN_SDK_NOT_CONFIGURED',
        message: 'Server-side Firebase Admin SDK is not provisioned in this environment.',
      });
    }

    const authCheck = await verifyOptionalLiveAuth(req);
    if (!authCheck.ok || !authCheck.uid) {
      return res.status(401).json({ error: authCheck.error || 'Authenticated Firebase user required.' });
    }

    const { report, hotspot, blockchainRecord } = req.body || {};
    if (!report?.id || typeof report.lat !== 'number' || typeof report.lng !== 'number') {
      return res.status(400).json({ error: 'Valid report id and coordinates required.' });
    }

    try {
      const db = getAdminFirestore(admin);
      const batch = db.batch();

      // Sanitized public report (strictly PII-free)
      const publicRef = db.collection('public_reports').doc(report.id);
      batch.set(
        publicRef,
        {
          id: report.id,
          hotspotId: report.hotspotId || null,
          location: String(report.location || '').slice(0, 160),
          area: String(report.area || '').slice(0, 80),
          lat: report.lat,
          lng: report.lng,
          timestamp: report.timestamp || new Date().toISOString(),
          waterLevel: report.waterLevel || 'Moderate',
          roadAccessibility: report.roadAccessibility || 'Partially Blocked',
          floodType: report.floodType || 'Street Waterlogging',
          riskLevel: report.riskLevel || 'LOW',
          verificationStatus: report.verificationStatus || 'UNDER REVIEW',
          incidentStatus: report.incidentStatus || 'Submitted',
          isDuplicate: Boolean(report.isDuplicate),
        },
        { merge: true }
      );

      if (hotspot?.id) {
        batch.set(db.collection('hotspots').doc(hotspot.id), hotspot, { merge: true });
      }

      if (blockchainRecord?.eventId && (authCheck.role === 'officer' || authCheck.role === 'admin')) {
        batch.set(db.collection('blockchain_records').doc(blockchainRecord.eventId), blockchainRecord, {
          merge: true,
        });
      }

      await batch.commit();
      return res.json({ ok: true, syncedReportId: report.id });
    } catch (err: any) {
      console.error('Public sync error:', err?.message);
      return res.status(500).json({ ok: false, error: err?.message || 'Firestore Admin sync failed.' });
    }
  });

  return app;
}

async function startServer() {
  const app = createApiApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FloodSense EOC Server running on http://0.0.0.0:${PORT}`);
  });
}

const isMainEntry = path.resolve(process.argv[1] || '') === __filename;
if (isMainEntry) {
  startServer().catch((err) => {
    console.error('Fatal Server Error:', err);
    process.exit(1);
  });
}
