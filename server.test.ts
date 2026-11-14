/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { createApiApp, detectImageMimeFromBuffer, extractNext3HourForecast, ServerTestOverrides } from './server.ts';

async function withTestServer(
  overrides: ServerTestOverrides,
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = createApiApp({ forceSkipAuthCheck: true, ...overrides });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// Valid minimal 40-byte JPEG header buffer (passes magic byte & >= 32 byte length check)
function makeFakeJpegBase64(extraBytes = 0): string {
  const buf = Buffer.alloc(48 + extraBytes, 0);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf.toString('base64');
}

test('detectImageMimeFromBuffer validates JPEG, PNG, and WEBP magic bytes accurately', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const webp = Buffer.from('RIFF1234WEBP', 'ascii');
  const txt = Buffer.from('PLAIN_TEXT_NOT_AN_IMAGE', 'ascii');

  assert.equal(detectImageMimeFromBuffer(jpeg), 'image/jpeg');
  assert.equal(detectImageMimeFromBuffer(png), 'image/png');
  assert.equal(detectImageMimeFromBuffer(webp), 'image/webp');
  assert.equal(detectImageMimeFromBuffer(txt), null);
});

test('extractNext3HourForecast sums future Asia/Colombo hourly slots cleanly', () => {
  const times = [
    '2026-11-13T10:00',
    '2026-11-13T11:00',
    '2026-11-13T12:00',
    '2026-11-13T13:00',
    '2026-11-13T14:00',
  ];
  const precip = [1.2, 3.0, 5.5, 10.2, 4.3];
  const res = extractNext3HourForecast(times, precip, '2026-11-13T10:45');
  assert.equal(res.forecastAvailable, true);
  assert.deepEqual(res.values, [3.0, 5.5, 10.2]);
  assert.equal(res.totalMm, 18.7);
});

test('POST /api/ai/verify returns NOT_RUN with null confidence when no image is sent', async () => {
  await withTestServer({ geminiApiKey: null }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waterLevel: 'Moderate', description: 'Water rising' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.aiStatus, 'NOT_RUN');
    assert.equal(body.confidence, null);
    assert.equal(body.officialStatus, 'Under Review');
  });
});

test('POST /api/ai/verify rejects corrupt magic bytes with 400 and oversized images with 413', async () => {
  await withTestServer({ geminiApiKey: null }, async (baseUrl) => {
    // Fake text payload disguised as JPEG
    const badRes = await fetch(`${baseUrl}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: Buffer.from('THIS_IS_NOT_A_REAL_JPEG_FILE_AT_ALL_12345').toString('base64'),
        mimeType: 'image/jpeg',
      }),
    });
    assert.equal(badRes.status, 400);

    // > 5 MB payload
    const largeRes = await fetch(`${baseUrl}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: makeFakeJpegBase64(5.2 * 1024 * 1024),
        mimeType: 'image/jpeg',
      }),
    });
    assert.equal(largeRes.status, 413);
  });
});

test('POST /api/ai/verify returns SIMULATED without API key and ignores client simulateFailure', async () => {
  await withTestServer({ geminiApiKey: null }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: makeFakeJpegBase64(),
        mimeType: 'image/jpeg',
        waterLevel: 'Severe',
        simulateFailure: true,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.aiStatus, 'SIMULATED');
    assert.equal(body.officialStatus, 'Under Review');
  });
});

test('POST /api/ai/verify returns COMPLETED on valid Gemini JSON and 502 FAILED with null confidence on error', async () => {
  // Valid Gemini JSON response — also verifies model, LOW thinking level, and abortSignal
  let capturedArgs: any = null;
  await withTestServer(
    {
      geminiApiKey: 'test-key-123',
      aiClientFactory: () => ({
        models: {
          generateContent: async (args: any) => {
            capturedArgs = args;
            return {
              text: JSON.stringify({
                hasVisibleFlooding: true,
                confidenceScore: 87.5,
                assessment: 'Possible Flooding Detected',
                observedWaterLevel: 'High',
                observedAccessibility: 'Partially Blocked',
                detailedExplanation: 'Visible standing water across junction lanes.',
                uncertaintyNotes: 'Evening glare on wet pavement.',
              }),
            };
          },
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: makeFakeJpegBase64(),
          mimeType: 'image/jpeg',
          waterLevel: 'High',
        }),
      });
      assert.equal(res.status, 200);
      assert.equal(capturedArgs?.model, 'gemini-4-hydrogen');
      assert.equal(capturedArgs?.config?.thinkingConfig?.thinkingLevel, 'LOW');
      assert.ok(capturedArgs?.config?.abortSignal instanceof AbortSignal);
      const body = await res.json();
      assert.equal(body.aiStatus, 'COMPLETED');
      assert.equal(body.modelName, 'gemini-4-hydrogen');
      assert.equal(body.confidence, 87.5);
      assert.equal(body.officialStatus, 'Under Review');
    }
  );

  // Malformed JSON -> 502 FAILED, confidence null (never returns 75%)
  await withTestServer(
    {
      geminiApiKey: 'test-key-123',
      aiClientFactory: () => ({
        models: {
          generateContent: async () => ({ text: 'not valid json {' }),
        },
      }),
    },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/ai/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: makeFakeJpegBase64(),
          mimeType: 'image/jpeg',
        }),
      });
      assert.equal(res.status, 502);
      const body = await res.json();
      assert.equal(body.aiStatus, 'FAILED');
      assert.equal(body.confidence, null);
    }
  );
});

test('GET /api/weather/colombo forwards coordinates and surfaces live vs fallback status honestly', async () => {
  let requestedUrl = '';
  const mockFetch = (async (url: string | URL | Request) => {
    requestedUrl = String(url);
    return new Response(
      JSON.stringify({
        current: {
          time: '2026-11-13T12:00',
          temperature_2m: 29.2,
          relative_humidity_2m: 84,
          precipitation: 4.5,
          wind_speed_10m: 14,
          wind_direction_10m: 225,
        },
        hourly: {
          time: [
            '2026-11-13T12:00',
            '2026-11-13T13:00',
            '2026-11-13T14:00',
            '2026-11-13T15:00',
          ],
          precipitation: [4.5, 6.0, 9.0, 5.0],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  await withTestServer({ fetchImpl: mockFetch }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/weather/colombo?lat=6.8745&lng=79.8600`);
    assert.equal(res.status, 200);
    assert.ok(requestedUrl.includes('latitude=6.8745'));
    assert.ok(requestedUrl.includes('longitude=79.8600'));
    const body = await res.json();
    assert.equal(body.isLive, true);
    assert.equal(body.isUsingDemonstrationFallback, false);
    assert.equal(body.expected3hRainfallMm, 20.0);
    assert.equal(body.forecastAvailable, true);
  });

  // Upstream failure -> explicit demonstration fallback flag
  const failFetch = (async () => new Response('Upstream error', { status: 503 })) as typeof fetch;
  await withTestServer({ fetchImpl: failFetch }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/weather/colombo`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.isLive, false);
    assert.equal(body.isUsingDemonstrationFallback, true);
    assert.equal(body.forecastAvailable, false);
  });
});

test('GET /api/health exposes honest service states and rulesConfigured: null', async () => {
  const okTileFetch = (async () => new Response('', { status: 200 })) as typeof fetch;
  await withTestServer({ geminiApiKey: null, fetchImpl: okTileFetch }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.services.geminiAi.state, 'NOT_CONFIGURED');
    assert.equal(body.services.firebase.rulesConfigured, null);
    assert.equal(body.services.blockchain.state, 'DEMONSTRATION_MODE');
    assert.equal(body.services.mapTileService.state, 'CONNECTED');
  });
});
