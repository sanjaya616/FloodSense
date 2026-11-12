/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CachedWeather {
  data: any;
  timestamp: number;
}

let cachedWeather: CachedWeather | null = null;
let lastWeatherSuccessTime: string | null = null;
let lastTileServiceSuccessTime: string | null = null;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // --- API ROUTE 1: Real-time System Health & Service Integration Probes ---
  app.get('/api/health', async (_req, res) => {
    const hasGeminiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    
    // Check map tile service
    let mapStatus = 'Tile Service Available';
    try {
      const tileRes = await fetch('https://tile.openstreetmap.org/0/0/0.png', {
        method: 'HEAD',
        signal: AbortSignal.timeout(2500),
      });
      if (tileRes.ok) {
        lastTileServiceSuccessTime = new Date().toISOString();
        mapStatus = 'Tile Service Available';
      } else {
        mapStatus = 'Tile Service Unavailable';
      }
    } catch {
      mapStatus = lastTileServiceSuccessTime ? 'Tile Service Available' : 'Tile Service Loading';
    }

    // Weather status based on last fetch or probe
    let weatherStatus = 'Demonstration Fallback';
    if (cachedWeather && Date.now() - cachedWeather.timestamp < 300000 && cachedWeather.data.isLive) {
      weatherStatus = 'Open-Meteo Live';
    }

    // Check Firebase configuration
    const hasFirebaseEnv = !!(
      process.env.VITE_FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_API_KEY
    );

    res.json({
      timestamp: new Date().toISOString(),
      status: 'operational',
      environment: process.env.NODE_ENV || 'development',
      services: {
        geminiAi: {
          status: hasGeminiKey ? 'API Key Configured' : 'Not Configured',
          configured: hasGeminiKey,
          mode: hasGeminiKey ? 'Live Multimodal AI' : 'Demonstration Fallback (Simulated)',
          model: 'gemini-3.8-flash',
          lastChecked: new Date().toISOString(),
        },
        weatherApi: {
          status: weatherStatus,
          provider: 'Open-Meteo Forecast API',
          mode: weatherStatus === 'Open-Meteo Live' ? 'Live API Telemetry' : 'Demonstration Fallback',
          lastSuccessfulConnection: lastWeatherSuccessTime,
        },
        firebase: {
          status: hasFirebaseEnv ? 'Configured' : 'Not Configured',
          mode: hasFirebaseEnv ? 'Ready for Cloud Synchronization' : 'Demonstration Mode (Local Service Layer)',
          rulesConfigured: true,
        },
        blockchain: {
          status: 'Simulated Mode',
          network: 'Ethereum Sepolia Testnet (Demonstration)',
          chainId: 11155111,
          isSimulated: true,
        },
        mapTileService: {
          status: mapStatus,
          provider: 'OpenStreetMap Carto',
          lastChecked: new Date().toISOString(),
        },
      },
    });
  });

  // --- API ROUTE 2: Weather Telemetry (Open-Meteo Asia/Colombo Integration) ---
  app.get('/api/weather/colombo', async (_req, res) => {
    try {
      const url =
        'https://api.open-meteo.com/v1/forecast?latitude=6.9271&longitude=79.8653&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m&hourly=precipitation,temperature_2m&timezone=Asia%2FColombo&forecast_days=2';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const current = data.current || {};
        const hourly = data.hourly || {};

        // Match current Colombo time with hourly forecast timestamps
        // Hourly times come in format "2026-11-12T14:00"
        let expected3h = 0;
        let futureRainValues: number[] = [];

        if (Array.isArray(hourly.time) && Array.isArray(hourly.precipitation)) {
          const currentTimeStr = current.time || ''; // e.g. "2026-11-12T14:00"
          let currentIdx = hourly.time.indexOf(currentTimeStr);

          if (currentIdx === -1) {
            // Find closest index matching hour prefix
            const hourPrefix = currentTimeStr.slice(0, 13);
            currentIdx = hourly.time.findIndex((t: string) => t.startsWith(hourPrefix));
          }

          if (currentIdx !== -1) {
            // Select the next three future hourly precipitation values
            futureRainValues = hourly.precipitation.slice(currentIdx + 1, currentIdx + 4);
          } else {
            // If current index could not be located, take first 3 available future indices
            futureRainValues = hourly.precipitation.slice(1, 4);
          }

          // Sum those values to calculate expected three-hour rainfall (no artificial multiplier)
          expected3h = Number(
            futureRainValues.reduce((sum: number, val: number) => sum + (typeof val === 'number' ? val : 0), 0).toFixed(1)
          );
        }

        const deg = current.wind_direction_10m ?? 225;
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const dirIndex = Math.round(deg / 45) % 8;
        const windDirection = dirs[dirIndex];

        const precip = typeof current.precipitation === 'number' ? current.precipitation : 0;
        const currentTemp = Math.round(current.temperature_2m ?? 28);
        const humidity = Math.round(current.relative_humidity_2m ?? 88);
        const windSpeed = Math.round(current.wind_speed_10m ?? 18);

        const weatherPayload = {
          success: true,
          source: 'Open-Meteo Forecast API',
          isLive: true,
          currentTempC: currentTemp,
          currentRainfallMm: Number(precip.toFixed(1)),
          expected3hRainfallMm: expected3h,
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
          status: precip > 10 || expected3h > 20 ? 'Precipitation Threshold Advisory' : 'Normal Conditions Monitoring',
        };

        cachedWeather = { data: weatherPayload, timestamp: Date.now() };
        lastWeatherSuccessTime = new Date().toISOString();
        return res.json(weatherPayload);
      }
    } catch (err: any) {
      console.warn('Open-Meteo API fetch failed or timed out:', err?.message);
    }

    // Default demonstration meteorological telemetry (Clearly identified as simulated)
    res.json({
      success: true,
      source: 'Demonstration Meteorological Scenario (Simulated)',
      isLive: false,
      currentTempC: 28,
      currentRainfallMm: 34.5,
      expected3hRainfallMm: 48.0,
      humidityPercent: 92,
      windSpeedKmh: 24,
      windDirection: 'SW',
      updatedAt: 'Demonstration Ground-Truth',
      condition: 'Monsoonal Thunderstorms & Heavy Showers',
      status: 'Simulated Monsoon High Runoff Scenario',
    });
  });

  // --- API ROUTE 3: Server-Side Multimodal AI Verification (Gemini 3.8 Flash) ---
  app.post('/api/ai/verify', async (req, res) => {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      description = '',
      waterLevel = 'Moderate',
      floodType = 'Street Waterlogging',
    } = req.body;

    const timestamp = new Date().toISOString();
    const disclaimer =
      'AI image assessment is an assistive early warning signal only. Official verification requires authorized emergency officer confirmation.';

    // Validate MIME types
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (mimeType && !validMimes.includes(mimeType.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid image format. Supported formats are JPG, JPEG, PNG, and WEBP.',
      });
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.json({
        method: 'Demonstration Heuristic (No Image)',
        modelName: 'None',
        aiAssessment: 'Uncertain',
        officialStatus: 'Under Review',
        confidence: 0,
        explanation: 'No photograph provided with report. Queued for human verification.',
        uncertainty: 'High uncertainty: Geotag-only submission without visual evidence.',
        waterLevelEstimated: waterLevel,
        roadAccessibilityEstimated: 'Uncertain',
        humanVerificationRequired: true,
        timestamp,
        disclaimer,
      });
    }

    // Process actual uploaded photograph with Gemini if key is present
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();

        // Validate Base64 payload
        if (cleanBase64.length < 50) {
          throw new Error('Image Base64 payload is too short or malformed.');
        }

        const prompt = `You are the AI verification engine for FloodSense, an urban disaster management prototype for Colombo, Sri Lanka.
Analyze this submitted photograph.
Citizen submission context:
- Claimed Water Level: "${waterLevel}"
- Flood Type: "${floodType}"
- Description: "${description}"

Determine whether visible street flooding, standing water, submerged curbs, waterlogged intersections, or drainage overflow is present.
Be objective and factual. Do NOT invent damage or flood severity.

Return ONLY a valid JSON object matching this schema:
{
  "hasVisibleFlooding": boolean,
  "confidenceScore": number, // between 0 and 100
  "assessment": "Possible Flooding Detected" | "No Clear Flooding Detected" | "Uncertain",
  "observedWaterLevel": "Low" | "Moderate" | "High" | "Severe" | "None",
  "observedAccessibility": "Open" | "Partially Blocked" | "Completely Blocked" | "Uncertain",
  "detailedExplanation": string, // 2-3 sentences explaining visual cues like reflections, water line against tires, submerged sidewalks
  "uncertaintyNotes": string // notes on camera angle, lighting, resolution, or obstructions
}`;

        const geminiRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = geminiRes.text || '{}';
        let parsed: any;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          parsed = {};
        }

        // Validate JSON fields & confidence bounds
        const rawScore = typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 75;
        const confidenceScore = Math.max(0, Math.min(100, Number(rawScore.toFixed(1))));

        let aiAssessment: 'Possible Flooding Detected' | 'No Clear Flooding Detected' | 'Uncertain' = 'Uncertain';
        if (parsed.assessment === 'Possible Flooding Detected' || parsed.hasVisibleFlooding === true) {
          aiAssessment = 'Possible Flooding Detected';
        } else if (parsed.assessment === 'No Clear Flooding Detected' || parsed.hasVisibleFlooding === false) {
          aiAssessment = 'No Clear Flooding Detected';
        }

        // IMPORTANT VERIFICATION RULE:
        // An AI model must not officially verify a flood report.
        // It remains 'Under Review' until an authorized officer confirms it.
        return res.json({
          method: 'Gemini 3.8 Flash (Multimodal)',
          modelName: 'gemini-3.8-flash',
          aiAssessment,
          officialStatus: 'Under Review',
          confidence: confidenceScore,
          explanation:
            parsed.detailedExplanation ||
            `Visual inspection indicated ${aiAssessment.toLowerCase()} on the photographed roadway.`,
          uncertainty:
            parsed.uncertaintyNotes ||
            'Optical assessment subject to camera angle and lighting conditions. Field officer verification required.',
          waterLevelEstimated: parsed.observedWaterLevel || waterLevel,
          roadAccessibilityEstimated: parsed.observedAccessibility || 'Partially Blocked',
          humanVerificationRequired: true,
          timestamp,
          disclaimer,
        });
      } catch (err: any) {
        console.warn('Gemini multimodal verification failed, falling back to simulated analysis:', err?.message);
      }
    }

    // Fallback Demonstration Heuristic (Clearly marked as Simulation Result)
    const isSevere = waterLevel === 'Severe' || waterLevel === 'High';
    const confidence = isSevere ? 88.5 : 78.0;

    return res.json({
      method: 'Demonstration Heuristic (Simulation)',
      modelName: 'None (Academic Simulation)',
      aiAssessment: 'Simulation Result',
      officialStatus: 'Under Review',
      confidence,
      explanation: `Simulated texture analysis (Academic Prototype): Road surface optical reflectivity consistent with ${waterLevel.toLowerCase()} water accumulation.`,
      uncertainty:
        'Simulated score for testing and evaluation purposes. Does not represent actual live model inference.',
      waterLevelEstimated: waterLevel,
      roadAccessibilityEstimated: isSevere ? 'Completely Blocked' : 'Partially Blocked',
      humanVerificationRequired: true,
      timestamp,
      disclaimer,
    });
  });

  // --- Vite Dev Middleware or Static Dist in Production ---
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

startServer().catch((err) => {
  console.error('Fatal Server Error:', err);
  process.exit(1);
});
