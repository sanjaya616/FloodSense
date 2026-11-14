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
import {
  areReportsDuplicate,
  clusterReports,
  validateCoordinates,
  FloodReport,
} from './src/utils/floodLogic.ts';
import {
  verifyBootstrapSecretMatch,
  detectProfileElevationAttempt,
  sanitizeEditableProfileUpdates,
} from './scripts/officerBootstrapCore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AppletFirebaseConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function loadAppletFirebaseConfig(): AppletFirebaseConfig {
  try {
    const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      return {
        projectId:
          typeof parsed.projectId === 'string' && parsed.projectId.trim() && parsed.projectId !== 'remixed-project-id'
            ? parsed.projectId.trim()
            : undefined,
        firestoreDatabaseId:
          typeof parsed.firestoreDatabaseId === 'string' && parsed.firestoreDatabaseId.trim()
            ? parsed.firestoreDatabaseId.trim()
            : undefined,
      };
    }
  } catch {}
  return {};
}

const appletFirebaseConfig = loadAppletFirebaseConfig();

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
  fetchedAt: string;
  cacheExpiresAt: string;
}

const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
 * Selects the next 3 consecutive hourly forecast values strictly after current Colombo time.
 * Never coerces missing/null slots to zero.
 */
export function extractNext3HourForecast(
  hourlyTime: string[],
  hourlyPrecipitation: Array<number | null | undefined>,
  currentTimeIsoLocal: string
): {
  values: number[];
  totalMm: number | null;
  forecastTimeRange: string | null;
  forecastAvailable: boolean;
  forecastCompleteness: 'COMPLETE' | 'INCOMPLETE' | 'UNAVAILABLE';
} {
  if (!Array.isArray(hourlyTime) || !Array.isArray(hourlyPrecipitation) || hourlyTime.length === 0) {
    return {
      values: [],
      totalMm: null,
      forecastTimeRange: null,
      forecastAvailable: false,
      forecastCompleteness: 'UNAVAILABLE',
    };
  }

  const parseColomboMs = (t: string) => {
    if (!t) return NaN;
    const normalized = t.includes('+') || t.endsWith('Z') ? t : `${t}:00+05:30`;
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
    return {
      values: [],
      totalMm: null,
      forecastTimeRange: null,
      forecastAvailable: false,
      forecastCompleteness: 'UNAVAILABLE',
    };
  }

  const rawSlice = hourlyPrecipitation.slice(startIdx, startIdx + 3);
  const validValues = rawSlice.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  if (rawSlice.length < 3 || validValues.length < 3) {
    return {
      values: validValues,
      totalMm: null,
      forecastTimeRange: null,
      forecastAvailable: false,
      forecastCompleteness: validValues.length === 0 ? 'UNAVAILABLE' : 'INCOMPLETE',
    };
  }

  const endIdx = startIdx + 3;
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

  const totalMm = Number(validValues.reduce((sum, val) => sum + val, 0).toFixed(1));
  return {
    values: validValues,
    totalMm,
    forecastTimeRange: `${startLabel} - ${endLabel} (Asia/Colombo)`,
    forecastAvailable: true,
    forecastCompleteness: 'COMPLETE',
  };
}

// Lazy Firebase Admin initialization (supports full credentials OR projectId-based ID token verification)
let adminApp: AdminApp | null = null;
let adminInitError: string | null = null;
let adminHasCredentials = false;
let adminAttempted = false;

function getFirebaseAdmin() {
  if (adminAttempted) return { adminApp, adminInitError, adminHasCredentials };
  adminAttempted = true;
  const cleanEnvProjectId = (process.env.VITE_FIREBASE_PROJECT_ID || '')
    .trim()
    .replace(/,$/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  const projectId = appletFirebaseConfig.projectId || cleanEnvProjectId || undefined;
  try {
    if (getAdminApps().length > 0) {
      adminApp = getAdminApps()[0];
      adminHasCredentials = Boolean(
        (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim().startsWith('{')) ||
          (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) ||
          process.env.K_SERVICE
      );
      return { adminApp, adminInitError, adminHasCredentials };
    }
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson && rawJson.trim().startsWith('{')) {
      const parsed = JSON.parse(rawJson);
      adminApp = initializeAdminApp({
        credential: cert(parsed),
        ...(projectId ? { projectId } : {}),
      });
      adminHasCredentials = true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      adminApp = initializeAdminApp({
        ...(projectId ? { projectId } : {}),
      });
      adminHasCredentials = true;
    } else if (projectId) {
      // Allows cryptographic Firebase ID token verification (RS256 public keys) without private service account JSON
      adminApp = initializeAdminApp({ projectId });
      adminHasCredentials = Boolean(process.env.K_SERVICE);
    }
  } catch (err: any) {
    adminInitError = err?.message || 'Failed to initialize Firebase Admin SDK';
    adminApp = null;
    adminHasCredentials = false;
  }
  return { adminApp, adminInitError, adminHasCredentials };
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

export interface AdminOverride {
  verifyIdToken: (token: string) => Promise<{
    uid: string;
    email?: string;
    name?: string;
    role?: string;
    officer?: boolean;
  }>;
  firestore: any;
  setCustomUserClaims?: (uid: string, claims: Record<string, any>) => Promise<void>;
  hasAnyExistingOfficerClaim?: () => Promise<boolean>;
}

export interface ServerTestOverrides {
  geminiApiKey?: string | null;
  fetchImpl?: typeof fetch;
  aiClientFactory?: (apiKey: string) => { models: { generateContent: (args: any) => Promise<{ text?: string }> } };
  forceSkipAuthCheck?: boolean;
  floodsenseMode?: 'DEMO' | 'LIVE';
  adminOverride?: AdminOverride | null;
  officerBootstrapSecret?: string | null;
}

export function buildSanitizedPublicReport(report: FloodReport): Record<string, any> {
  const approxLat = Number(Number(report.lat).toFixed(3));
  const approxLng = Number(Number(report.lng).toFixed(3));
  return {
    id: report.id,
    hotspotId: report.hotspotId || null,
    location: String(report.location || '').slice(0, 160),
    area: String(report.area || '').slice(0, 80),
    lat: approxLat,
    lng: approxLng,
    coordinatePrecision: 'APPROX_100M_GRID',
    isPublicRedacted: true,
    timestamp: report.timestamp || new Date().toISOString(),
    waterLevel: report.waterLevel || 'Moderate',
    roadAccessibility: report.roadAccessibility || 'Partially Blocked',
    floodType: report.floodType || 'Street Waterlogging',
    riskLevel: report.riskLevel || 'LOW',
    verificationStatus: report.verificationStatus || 'UNDER REVIEW',
    incidentStatus: report.incidentStatus || 'Submitted',
    isDuplicate: Boolean(report.isDuplicate),
  };
}

export function createApiApp(overrides: ServerTestOverrides = {}) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const fetchFn = overrides.fetchImpl || fetch;
  const weatherCache = new Map<string, CachedWeather>();
  let lastWeatherSuccessTime: string | null = null;
  let lastWeatherError: string | null = null;
  let lastTileServiceSuccessTime: string | null = null;
  let lastAiSuccessTime: string | null = null;
  let lastAiError: string | null = null;

  const getFloodSenseMode = (): 'DEMO' | 'LIVE' => {
    if (overrides.floodsenseMode) return overrides.floodsenseMode;
    return process.env.FLOODSENSE_MODE?.toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
  };

  const getGeminiKey = () => {
    if (overrides.geminiApiKey !== undefined) return overrides.geminiApiKey;
    const k = process.env.GEMINI_API_KEY;
    return k && k !== 'MY_GEMINI_API_KEY' ? k : null;
  };

  const hasClientFirebaseEnv = () =>
    Boolean(
      (process.env.VITE_FIREBASE_API_KEY &&
        process.env.VITE_FIREBASE_PROJECT_ID &&
        process.env.VITE_FIREBASE_API_KEY !== 'MY_FIREBASE_API_KEY') ||
        appletFirebaseConfig.projectId
    );

  const resolveAdminServices = (): {
    verifyIdToken: ((token: string) => Promise<any>) | null;
    firestore: any;
    setCustomUserClaims: ((uid: string, claims: Record<string, any>) => Promise<void>) | null;
    hasAnyExistingOfficerClaim: (() => Promise<boolean>) | null;
    hasFullAdmin: boolean;
    adminInitErr: string | null;
  } => {
    if (overrides.adminOverride !== undefined) {
      if (overrides.adminOverride === null) {
        return {
          verifyIdToken: null,
          firestore: null,
          setCustomUserClaims: null,
          hasAnyExistingOfficerClaim: null,
          hasFullAdmin: false,
          adminInitErr: 'Admin SDK unconfigured',
        };
      }
      return {
        verifyIdToken: overrides.adminOverride.verifyIdToken,
        firestore: overrides.adminOverride.firestore,
        setCustomUserClaims: overrides.adminOverride.setCustomUserClaims || null,
        hasAnyExistingOfficerClaim: overrides.adminOverride.hasAnyExistingOfficerClaim || null,
        hasFullAdmin: Boolean(overrides.adminOverride.firestore),
        adminInitErr: null,
      };
    }
    const { adminApp: admin, adminInitError, adminHasCredentials: hasCreds } = getFirebaseAdmin();
    if (!admin) {
      return {
        verifyIdToken: null,
        firestore: null,
        setCustomUserClaims: null,
        hasAnyExistingOfficerClaim: null,
        hasFullAdmin: false,
        adminInitErr: adminInitError,
      };
    }
    const dbId = process.env.FIREBASE_DATABASE_ID || appletFirebaseConfig.firestoreDatabaseId;
    const firestoreInstance = hasCreds
      ? dbId && dbId !== '(default)'
        ? getAdminFirestore(admin, dbId)
        : getAdminFirestore(admin)
      : null;

    return {
      verifyIdToken: (token: string) => getAdminAuth(admin).verifyIdToken(token),
      firestore: firestoreInstance,
      setCustomUserClaims: hasCreds
        ? (uid: string, claims: Record<string, any>) => getAdminAuth(admin).setCustomUserClaims(uid, claims)
        : null,
      hasAnyExistingOfficerClaim: hasCreds
        ? async () => {
            const adminAuth = getAdminAuth(admin);
            let pageToken: string | undefined;
            do {
              const page = await adminAuth.listUsers(1000, pageToken);
              for (const u of page.users) {
                if (u.customClaims?.role === 'officer' || u.customClaims?.officer === true) {
                  return true;
                }
              }
              pageToken = page.pageToken;
            } while (pageToken);
            return false;
          }
        : null,
      hasFullAdmin: hasCreds,
      adminInitErr: null,
    };
  };

  async function resolveAuthoritativeRole(
    decoded: { uid: string; role?: string; officer?: boolean },
    firestore: any
  ): Promise<{
    role: 'officer' | 'citizen';
    verificationSource: 'custom_claims' | 'officers_collection' | 'revoked' | 'none';
  }> {
    let officerSnap: any = null;
    if (firestore && decoded.uid) {
      try {
        officerSnap = await firestore.collection('officers').doc(decoded.uid).get();
        // Explicit revocation in /officers/{uid} overrides unexpired custom claims
        if (officerSnap.exists && officerSnap.data()?.active === false) {
          return { role: 'citizen', verificationSource: 'revoked' };
        }
      } catch {
        // Ignore Firestore read failures on public/claim-only path
      }
    }

    if (decoded.role === 'officer' || decoded.officer === true) {
      return { role: 'officer', verificationSource: 'custom_claims' };
    }

    if (officerSnap?.exists && officerSnap.data()?.active !== false) {
      return { role: 'officer', verificationSource: 'officers_collection' };
    }

    return { role: 'citizen', verificationSource: 'none' };
  }

  async function verifyRequestAuth(
    req: Request,
    options?: { requireOfficer?: boolean }
  ): Promise<{
    ok: boolean;
    status?: number;
    uid?: string;
    email?: string;
    role?: 'officer' | 'citizen';
    error?: string;
  }> {
    if (overrides.forceSkipAuthCheck) {
      return { ok: true, uid: 'test-user', role: 'citizen' };
    }

    const mode = getFloodSenseMode();
    const { verifyIdToken, firestore } = resolveAdminServices();
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (mode === 'LIVE') {
      if (!verifyIdToken || !firestore) {
        return {
          ok: false,
          status: 503,
          error: 'FIREBASE_ADMIN_UNAVAILABLE: Server requires Firebase Admin credentials when FLOODSENSE_MODE=LIVE.',
        };
      }
      if (!token) {
        return {
          ok: false,
          status: 401,
          error: 'Missing Authorization Bearer token for LIVE mode.',
        };
      }
      try {
        const decoded = await verifyIdToken(token);
        const { role } = await resolveAuthoritativeRole(decoded, firestore);
        if (options?.requireOfficer && role !== 'officer') {
          return { ok: false, status: 403, error: 'Officer authorization required.' };
        }
        return { ok: true, uid: decoded.uid, email: decoded.email, role };
      } catch (err: any) {
        return { ok: false, status: 401, error: err?.message || 'Invalid Firebase ID token.' };
      }
    }

    // DEMO mode: Verify token opportunistically if provided and Admin SDK is ready
    if (token && verifyIdToken) {
      try {
        const decoded = await verifyIdToken(token);
        const { role } = await resolveAuthoritativeRole(decoded, firestore);
        if (options?.requireOfficer && role !== 'officer') {
          return { ok: false, status: 403, error: 'Officer authorization required.' };
        }
        return { ok: true, uid: decoded.uid, email: decoded.email, role };
      } catch (err: any) {
        return { ok: false, status: 401, error: err?.message || 'Invalid Bearer token.' };
      }
    }

    return { ok: true, role: 'citizen' };
  }

  const aiRateLimiter = createRateLimiter(20, 5 * 60 * 1000);
  const syncRateLimiter = createRateLimiter(30, 5 * 60 * 1000);
  const authRateLimiter = createRateLimiter(30, 5 * 60 * 1000);

  // --- API ROUTE 0A: Backend Emergency Officer Authorization Verification ---
  // Always enforces Firebase ID token cryptographic verification and checks trusted custom claims / /officers/{uid}.
  // Never trusts role strings supplied in request bodies or headers.
  app.post('/api/auth/verify-officer', authRateLimiter, async (req, res) => {
    const { verifyIdToken, firestore } = resolveAdminServices();
    if (!verifyIdToken) {
      return res.status(503).json({
        authorized: false,
        error: 'FIREBASE_ADMIN_UNAVAILABLE: Server cannot verify Firebase ID tokens in this environment.',
      });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({
        authorized: false,
        error: 'Authentication token required. Please sign in with Firebase Authentication.',
      });
    }

    try {
      const decoded = await verifyIdToken(token);
      const { role, verificationSource } = await resolveAuthoritativeRole(decoded, firestore);

      if (role !== 'officer') {
        return res.status(403).json({
          authorized: false,
          role: 'citizen',
          uid: decoded.uid,
          email: decoded.email || null,
          error:
            'Access denied: this account is not pre-authorized as an Emergency Officer. Only pre-authorized municipal officers may access the Officer Operations Center.',
        });
      }

      return res.json({
        authorized: true,
        role: 'officer',
        uid: decoded.uid,
        email: decoded.email || null,
        verificationSource,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(401).json({
        authorized: false,
        error: err?.message || 'Invalid or expired Firebase authentication token.',
      });
    }
  });

  // --- API ROUTE 0B: Verified Session Role Inspection ---
  app.get('/api/auth/session', authRateLimiter, async (req, res) => {
    const { verifyIdToken, firestore } = resolveAdminServices();
    if (!verifyIdToken) {
      return res.status(503).json({
        authenticated: false,
        error: 'FIREBASE_ADMIN_UNAVAILABLE',
      });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({
        authenticated: false,
        error: 'Missing Bearer token.',
      });
    }

    try {
      const decoded = await verifyIdToken(token);
      const { role, verificationSource } = await resolveAuthoritativeRole(decoded, firestore);
      return res.json({
        authenticated: true,
        uid: decoded.uid,
        email: decoded.email || null,
        role,
        verificationSource,
      });
    } catch (err: any) {
      return res.status(401).json({
        authenticated: false,
        error: err?.message || 'Invalid Bearer token.',
      });
    }
  });

  // --- API ROUTE 0C: One-Time First Emergency Officer Bootstrap (Self-Disabling, OFFICER_BOOTSTRAP_SECRET Gated) ---
  // Assigns the 'officer' custom claim ONLY to the very first emergency responder account when OFFICER_BOOTSTRAP_SECRET matches.
  // Never exposes public officer registration and never creates a System Administrator role.
  app.post('/api/auth/bootstrap-first-officer', authRateLimiter, async (req, res) => {
    const configuredSecret =
      overrides.officerBootstrapSecret !== undefined
        ? overrides.officerBootstrapSecret
        : process.env.OFFICER_BOOTSTRAP_SECRET;

    const { verifyIdToken, firestore, setCustomUserClaims, hasAnyExistingOfficerClaim } = resolveAdminServices();
    if (!verifyIdToken || !firestore || !setCustomUserClaims) {
      return res.status(503).json({
        ok: false,
        error:
          'FIREBASE_ADMIN_UNAVAILABLE: Firebase Admin SDK credentials are required to assign officer custom claims.',
      });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Missing Firebase Authentication Bearer token.' });
    }

    const providedSecret = typeof req.body?.bootstrapSecret === 'string' ? req.body.bootstrapSecret : '';
    const secretCheck = verifyBootstrapSecretMatch(configuredSecret, providedSecret);
    if (!secretCheck.valid) {
      return res.status(403).json({
        ok: false,
        error:
          secretCheck.reason ||
          'First-officer bootstrap denied. Configure OFFICER_BOOTSTRAP_SECRET (>= 16 chars) or run "npm run officer:bootstrap".',
      });
    }

    try {
      const decoded = await verifyIdToken(token);
      const existingOfficersSnap = await firestore.collection('officers').limit(1).get();
      const existingClaim = hasAnyExistingOfficerClaim ? await hasAnyExistingOfficerClaim() : false;
      if (!existingOfficersSnap.empty || existingClaim) {
        return res.status(409).json({
          ok: false,
          error:
            'An Emergency Officer already exists. First-officer bootstrap is permanently locked; authorize additional officers via "npm run officer:authorize".',
        });
      }

      const existingClaims = decoded?.firebase ? {} : {};
      await setCustomUserClaims(decoded.uid, { ...existingClaims, role: 'officer', officer: true });

      const nowIso = new Date().toISOString();
      const displayName = decoded.name || 'Emergency Management Officer';
      await firestore.collection('officers').doc(decoded.uid).set(
        {
          uid: decoded.uid,
          email: decoded.email || '',
          displayName,
          role: 'officer',
          active: true,
          department: 'Colombo Municipal Flood Operations',
          emergencySector: 'Sector 04 — Colombo Municipal Basin',
          authorizedAt: nowIso,
          authorizedMethod: 'first_officer_bootstrap',
        },
        { merge: true }
      );

      await firestore.collection('users').doc(decoded.uid).set(
        {
          uid: decoded.uid,
          email: decoded.email || '',
          displayName,
          name: displayName,
          role: 'officer',
          isOfficer: true,
        },
        { merge: true }
      );

      return res.json({
        ok: true,
        uid: decoded.uid,
        email: decoded.email || null,
        role: 'officer',
        claimsAssigned: { role: 'officer', officer: true },
        message: 'First Emergency Officer account authorized successfully.',
      });
    } catch (err: any) {
      return res.status(401).json({
        ok: false,
        error: err?.message || 'Unable to verify Firebase token for first-officer bootstrap.',
      });
    }
  });

  // --- API ROUTE 0D: Officer Backend Route Guard & Profile Anti-Elevation Handler ---
  async function requireOfficerMiddleware(req: Request, res: Response, next: NextFunction) {
    const { verifyIdToken, firestore } = resolveAdminServices();
    if (!verifyIdToken) {
      return res.status(503).json({
        authorized: false,
        error: 'FIREBASE_ADMIN_UNAVAILABLE: Server cannot verify Firebase ID tokens in this environment.',
      });
    }
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({
        authorized: false,
        error: 'Missing Authorization Bearer token.',
      });
    }
    try {
      const decoded = await verifyIdToken(token);
      const { role, verificationSource } = await resolveAuthoritativeRole(decoded, firestore);
      if (role !== 'officer') {
        return res.status(403).json({
          authorized: false,
          role: 'citizen',
          error: 'Forbidden: explicit officer custom claim or pre-authorized officer record required for /officer routes.',
        });
      }
      (req as any).officerAuth = {
        uid: decoded.uid,
        email: decoded.email || null,
        role,
        verificationSource,
      };
      next();
    } catch (err: any) {
      return res.status(401).json({
        authorized: false,
        error: err?.message || 'Invalid Firebase Authentication token.',
      });
    }
  }

  app.use('/api/officer', authRateLimiter, requireOfficerMiddleware);

  app.get('/api/officer/authorize', (req, res) => {
    const info = (req as any).officerAuth;
    return res.json({
      authorized: true,
      ...info,
    });
  });

  // Authenticated profile update endpoint — strictly blocks any RBAC / role elevation keys
  const handleProfileUpdate = async (req: Request, res: Response) => {
    const { verifyIdToken, firestore } = resolveAdminServices();
    if (!verifyIdToken || !firestore) {
      return res.status(503).json({
        ok: false,
        error: 'FIREBASE_ADMIN_UNAVAILABLE: Backend profile service requires Firebase Admin SDK.',
      });
    }
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Missing Authorization Bearer token.' });
    }

    const elevationAttemptKeys = detectProfileElevationAttempt(req.body);
    if (elevationAttemptKeys.length > 0) {
      return res.status(403).json({
        ok: false,
        error: `Forbidden: role or identity privilege fields (${elevationAttemptKeys.join(', ')}) cannot be modified through profile updates.`,
      });
    }

    try {
      const decoded = await verifyIdToken(token);
      const safeUpdates = sanitizeEditableProfileUpdates(req.body || {});
      if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({ ok: false, error: 'No valid editable profile fields provided.' });
      }
      await firestore
        .collection('users')
        .doc(decoded.uid)
        .set({ ...safeUpdates, updatedAt: new Date().toISOString() }, { merge: true });
      return res.json({ ok: true, uid: decoded.uid, updatedFields: Object.keys(safeUpdates) });
    } catch (err: any) {
      return res.status(401).json({ ok: false, error: err?.message || 'Invalid authentication token.' });
    }
  };

  app.patch('/api/users/profile', authRateLimiter, handleProfileUpdate);
  app.put('/api/users/profile', authRateLimiter, handleProfileUpdate);

  // --- API ROUTE 1: Real-time System Health & Honest Service Probes ---
  app.get('/api/health', async (_req, res) => {
    const mode = getFloodSenseMode();
    const geminiKey = getGeminiKey();
    const clientFirebaseConfigured = hasClientFirebaseEnv();
    const { verifyIdToken, firestore, adminInitErr } = resolveAdminServices();
    const adminReady = Boolean(verifyIdToken && firestore);

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

    // Weather state based on recent live cached fetch or demonstration fallback
    const nowMs = Date.now();
    const freshLiveWeather = Array.from(weatherCache.values()).find(
      (entry) => nowMs - entry.timestamp < WEATHER_CACHE_TTL_MS && entry.data?.isLive
    );
    let weatherState: ServiceHealthState = 'NOT_VERIFIED';
    let weatherLabel = 'Not Yet Queried';
    if (freshLiveWeather) {
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

    if (adminReady && firestore) {
      try {
        await firestore.collection('public_reports').limit(1).get();
        firebaseState = 'CONNECTED';
        firebaseLabel = 'Firebase Admin Connected';
        firebaseRulesStatus = 'Manage & verify via Firebase Console / deploy_firebase';
      } catch (err: any) {
        firebaseState = 'ERROR';
        firebaseLabel = `Firestore Probe Error: ${err?.message || 'Unknown'}`;
        firebaseRulesStatus = 'Verification failed';
      }
    } else if (adminInitErr) {
      firebaseState = 'ERROR';
      firebaseLabel = adminInitErr;
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
      floodsenseMode: mode,
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
          cacheTtlSeconds: WEATHER_CACHE_TTL_MS / 1000,
          cachedLocations: weatherCache.size,
          lastSuccessfulConnection: lastWeatherSuccessTime,
          lastError: lastWeatherError,
        },
        firebase: {
          state: firebaseState,
          status: firebaseLabel,
          mode: clientFirebaseConfigured ? 'Firebase Cloud Mode Configured' : 'Demonstration Mode (Local Service Layer)',
          adminSdkReady: adminReady,
          rulesConfigured: null,
          rulesNote: firebaseRulesStatus,
        },
        blockchain: {
          state: 'DEMONSTRATION_MODE' as ServiceHealthState,
          status: 'Local Prototype SHA-256 Hash-Chain (Simulated Ledger)',
          network: 'Local Prototype SHA-256 Hash-Chain (No Mainnet/Testnet RPC)',
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

  // --- API ROUTE 2: Weather Telemetry (Open-Meteo Asia/Colombo Integration with 5-Min Cache) ---
  app.get('/api/weather/colombo', async (req, res) => {
    const rawLat = req.query.lat ? Number(req.query.lat) : 6.9271;
    const rawLng = req.query.lng ? Number(req.query.lng) : 79.8653;
    const lat = Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : 6.9271;
    const lng = Number.isFinite(rawLng) && rawLng >= -180 && rawLng <= 180 ? rawLng : 79.8653;
    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;

    const cachedEntry = weatherCache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < WEATHER_CACHE_TTL_MS) {
      return res.json({
        ...cachedEntry.data,
        cached: true,
        fetchedAt: cachedEntry.fetchedAt,
        cacheExpiresAt: cachedEntry.cacheExpiresAt,
      });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      lat.toFixed(4)
    )}&longitude=${encodeURIComponent(
      lng.toFixed(4)
    )}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m&hourly=precipitation,temperature_2m&timezone=Asia%2FColombo&forecast_days=2`;

    const fetchOpenMeteo = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        return await fetchFn(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      let response = await fetchOpenMeteo();
      if (!response.ok && (response.status === 429 || response.status >= 500)) {
        await new Promise((r) => setTimeout(r, 250));
        response = await fetchOpenMeteo();
      }

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

        const nowMs = Date.now();
        const fetchedAt = new Date(nowMs).toISOString();
        const cacheExpiresAt = new Date(nowMs + WEATHER_CACHE_TTL_MS).toISOString();

        const weatherPayload = {
          success: true,
          provider: 'Open-Meteo Forecast API',
          source: 'Open-Meteo Forecast API',
          isLive: true,
          isUsingDemonstrationFallback: false,
          cached: false,
          fetchedAt,
          cacheExpiresAt,
          coordinates: { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) },
          currentTempC: currentTemp,
          currentRainfallMm: Number(precip.toFixed(1)),
          expected3hRainfallMm: forecast.totalMm,
          forecastAvailable: forecast.forecastAvailable,
          forecastCompleteness: forecast.forecastCompleteness,
          forecastTimeRange:
            forecast.forecastTimeRange ||
            (forecast.forecastCompleteness === 'INCOMPLETE'
              ? 'Incomplete 3-hour forecast slots'
              : 'Hourly forecast unavailable'),
          rainfallUnit: 'mm',
          humidityPercent: humidity,
          windSpeedKmh: windSpeed,
          windDirection,
          updatedAt: new Date(nowMs).toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' }),
          condition:
            precip > 15
              ? 'Heavy Monsoon Downpour'
              : precip > 5
              ? 'Moderate Rain Showers'
              : precip > 0.1
              ? 'Light Rain Showers'
              : 'Overcast & High Humidity',
          status:
            precip > 10 || (forecast.totalMm !== null && forecast.totalMm > 20)
              ? 'Precipitation Threshold Advisory'
              : forecast.forecastAvailable
              ? 'Normal Conditions Monitoring'
              : 'Current Weather Live (3h Forecast Unavailable)',
        };

        weatherCache.set(cacheKey, {
          data: weatherPayload,
          timestamp: nowMs,
          fetchedAt,
          cacheExpiresAt,
        });
        lastWeatherSuccessTime = fetchedAt;
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
      cached: false,
      fetchedAt: null,
      cacheExpiresAt: null,
      coordinates: { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) },
      currentTempC: 28,
      currentRainfallMm: 34.5,
      expected3hRainfallMm: null,
      forecastAvailable: false,
      forecastCompleteness: 'UNAVAILABLE',
      forecastTimeRange: 'Demonstration Snapshot (Live Feed Unavailable)',
      rainfallUnit: 'mm',
      humidityPercent: 92,
      windSpeedKmh: 24,
      windDirection: 'SW',
      updatedAt: 'Demonstration Fallback',
      condition: 'Monsoonal Thunderstorms & Heavy Showers',
      status: 'Simulated Monsoon Scenario (3h Live Forecast Unavailable)',
    });
  });

  // --- API ROUTE 3: Server-Side Multimodal AI Verification (Gemini 4 Hydrogen) ---
  app.post('/api/ai/verify', aiRateLimiter, async (req, res) => {
    const authCheck = await verifyRequestAuth(req);
    if (!authCheck.ok) {
      return res.status(authCheck.status || 401).json({ error: authCheck.error || 'Unauthorized' });
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

  // --- API ROUTE 4: Citywide Near-Duplicate Check (Firebase Admin) ---
  app.post('/api/reports/check-duplicate', syncRateLimiter, async (req, res) => {
    const authCheck = await verifyRequestAuth(req);
    if (!authCheck.ok) {
      return res.status(authCheck.status || 401).json({ error: authCheck.error || 'Unauthorized' });
    }

    const { firestore } = resolveAdminServices();
    if (!firestore) {
      return res.json({
        ok: true,
        checkedCitywide: false,
        isDuplicate: false,
        duplicateOfId: null,
      });
    }

    const { lat, lng, timestamp } = req.body || {};
    if (typeof lat !== 'number' || typeof lng !== 'number' || !validateCoordinates(lat, lng)) {
      return res.status(400).json({ error: 'Valid coordinates required.' });
    }

    const ts = typeof timestamp === 'string' && !isNaN(Date.parse(timestamp)) ? timestamp : new Date().toISOString();
    try {
      const cutoffIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const recentSnap = await firestore
        .collection('reports')
        .where('timestamp', '>=', cutoffIso)
        .get();

      let matchedId: string | null = null;
      for (const docSnap of recentSnap.docs) {
        const data = docSnap.data();
        if (areReportsDuplicate({ lat: data.lat, lng: data.lng, timestamp: data.timestamp }, { lat, lng, timestamp: ts })) {
          matchedId = data.id || docSnap.id;
          break;
        }
      }

      return res.json({
        ok: true,
        checkedCitywide: true,
        isDuplicate: Boolean(matchedId),
        duplicateOfId: matchedId,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Citywide duplicate check failed.' });
    }
  });

  // --- API ROUTE 5: Trusted Server-Side Public Map & Hotspot Sync (Firebase Admin) ---
  app.post('/api/reports/public-sync', syncRateLimiter, async (req, res) => {
    const mode = getFloodSenseMode();
    const { firestore } = resolveAdminServices();
    if (!firestore) {
      return res.status(mode === 'LIVE' ? 503 : 501).json({
        ok: false,
        reason: 'ADMIN_SDK_NOT_CONFIGURED',
        message: 'Server-side Firebase Admin SDK is not provisioned in this environment.',
      });
    }

    const authCheck = await verifyRequestAuth(req);
    if (!authCheck.ok) {
      return res.status(authCheck.status || 401).json({ error: authCheck.error || 'Authenticated Firebase user required.' });
    }

    const bodyReportId = req.body?.reportId || req.body?.report?.id;
    const submissionRequestId = req.body?.submissionRequestId;
    if (!bodyReportId || typeof bodyReportId !== 'string') {
      return res.status(400).json({ error: 'Valid reportId is required.' });
    }

    try {
      const reportRef = firestore.collection('reports').doc(bodyReportId);
      const reportSnap = await reportRef.get();
      if (!reportSnap.exists) {
        return res.status(404).json({ error: `Report ${bodyReportId} not found in Firestore.` });
      }

      const reportData = reportSnap.data() as FloodReport;
      if (authCheck.uid && reportData.reporterId !== authCheck.uid && authCheck.role !== 'officer') {
        return res.status(403).json({ error: 'Forbidden: you do not own this flood report.' });
      }

      if (!validateCoordinates(reportData.lat, reportData.lng)) {
        return res.status(400).json({ error: 'Stored report has invalid GPS coordinates.' });
      }

      // Idempotent fast-path if already synced under the same submissionRequestId
      if (
        reportData.publicSyncStatus === 'SYNCED' &&
        submissionRequestId &&
        reportData.submissionRequestId === submissionRequestId &&
        reportData.hotspotId
      ) {
        const hsSnap = await firestore.collection('hotspots').doc(reportData.hotspotId).get();
        return res.json({
          ok: true,
          idempotentHit: true,
          syncedReportId: reportData.id,
          hotspot: hsSnap.exists ? hsSnap.data() : null,
          isDuplicate: Boolean(reportData.isDuplicate),
          duplicateOfReportId: reportData.duplicateOfReportId || null,
          publicReport: buildSanitizedPublicReport(reportData),
        });
      }

      // Query recent reports (last 24h) via Admin SDK for cross-citizen duplicate detection & server clustering
      const cutoff24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentSnap = await firestore
        .collection('reports')
        .where('timestamp', '>=', cutoff24hIso)
        .get();

      const otherReports: FloodReport[] = [];
      recentSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data() as FloodReport;
        if (d.id && d.id !== reportData.id) {
          otherReports.push(d);
        }
      });

      // Server-authoritative cross-citizen duplicate detection
      let isDuplicate = Boolean(reportData.isDuplicate);
      let duplicateOfReportId = reportData.duplicateOfReportId;
      for (const prior of otherReports) {
        if (areReportsDuplicate(prior, reportData)) {
          isDuplicate = true;
          duplicateOfReportId = prior.id;
          break;
        }
      }

      const updatedTargetReport: FloodReport = {
        ...reportData,
        isDuplicate,
        ...(duplicateOfReportId ? { duplicateOfReportId } : {}),
      };

      // Lookup cached 3h forecast rainfall for area clustering
      const rainfallByArea: Record<string, number> = {};
      const areaCacheKey = `${Number(reportData.lat).toFixed(2)},${Number(reportData.lng).toFixed(2)}`;
      const areaWeather = weatherCache.get(areaCacheKey) || Array.from(weatherCache.values())[0];
      if (
        areaWeather &&
        areaWeather.data?.isLive &&
        areaWeather.data?.forecastAvailable &&
        typeof areaWeather.data?.expected3hRainfallMm === 'number' &&
        Number.isFinite(areaWeather.data.expected3hRainfallMm)
      ) {
        rainfallByArea['__default'] = areaWeather.data.expected3hRainfallMm;
      }

      const computedHotspots = clusterReports([updatedTargetReport, ...otherReports], undefined, rainfallByArea);
      const matchedHotspot =
        computedHotspots.find((h) => h.associatedReportIds.includes(updatedTargetReport.id)) ||
        clusterReports([updatedTargetReport], undefined, rainfallByArea)[0];

      updatedTargetReport.hotspotId = matchedHotspot.id;

      // Sanitized public report (Zero PII + generalized coordinates to ~100m grid)
      const sanitizedPublic = buildSanitizedPublicReport(updatedTargetReport);
      const syncedAt = new Date().toISOString();

      const batch = firestore.batch();
      batch.set(firestore.collection('public_reports').doc(updatedTargetReport.id), sanitizedPublic, { merge: true });
      for (const hs of computedHotspots) {
        batch.set(firestore.collection('hotspots').doc(hs.id), hs, { merge: true });
      }
      batch.set(
        reportRef,
        {
          hotspotId: matchedHotspot.id,
          isDuplicate,
          duplicateOfReportId: duplicateOfReportId || null,
          publicSyncStatus: 'SYNCED',
          publicSyncedAt: syncedAt,
        },
        { merge: true }
      );

      await batch.commit();

      return res.json({
        ok: true,
        syncedReportId: updatedTargetReport.id,
        hotspot: matchedHotspot,
        isDuplicate,
        duplicateOfReportId: duplicateOfReportId || null,
        publicReport: sanitizedPublic,
      });
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
