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

test('extractNext3HourForecast returns null totalMm and INCOMPLETE/UNAVAILABLE when slots are missing or null', () => {
  const times = ['2026-11-13T10:00', '2026-11-13T11:00', '2026-11-13T12:00', '2026-11-13T13:00'];
  const partialNullPrecip = [1.0, 2.5, null, 4.0];
  const incompleteRes = extractNext3HourForecast(times, partialNullPrecip, '2026-11-13T10:30');
  assert.equal(incompleteRes.forecastAvailable, false);
  assert.equal(incompleteRes.totalMm, null);
  assert.equal(incompleteRes.forecastCompleteness, 'INCOMPLETE');

  const shortRes = extractNext3HourForecast(
    ['2026-11-13T10:00', '2026-11-13T11:00'],
    [1.0, 2.0],
    '2026-11-13T10:30'
  );
  assert.equal(shortRes.forecastAvailable, false);
  assert.equal(shortRes.totalMm, null);
  assert.equal(shortRes.forecastCompleteness, 'INCOMPLETE');

  const emptyRes = extractNext3HourForecast([], [], '2026-11-13T10:30');
  assert.equal(emptyRes.forecastAvailable, false);
  assert.equal(emptyRes.totalMm, null);
  assert.equal(emptyRes.forecastCompleteness, 'UNAVAILABLE');
});

test('GET /api/weather/colombo caches by coordinate sector and retries once on transient 503', async () => {
  let fetchCount = 0;
  const mockFetch = (async () => {
    fetchCount += 1;
    // First call returns 503 transient failure -> retry should succeed on second call
    if (fetchCount === 1) {
      return new Response('Busy', { status: 503 });
    }
    return new Response(
      JSON.stringify({
        current: {
          time: '2026-11-13T12:00',
          temperature_2m: 30,
          relative_humidity_2m: 82,
          precipitation: 2.0,
          wind_speed_10m: 12,
          wind_direction_10m: 180,
        },
        hourly: {
          time: ['2026-11-13T12:00', '2026-11-13T13:00', '2026-11-13T14:00', '2026-11-13T15:00'],
          precipitation: [2.0, 3.0, 4.0, 5.0],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  await withTestServer({ fetchImpl: mockFetch }, async (baseUrl) => {
    // 1st request: 503 + 1 retry -> 2 fetches
    const r1 = await fetch(`${baseUrl}/api/weather/colombo?lat=6.9210&lng=79.8610`);
    const b1 = await r1.json();
    assert.equal(b1.isLive, true);
    assert.equal(b1.cached, false);
    assert.equal(fetchCount, 2);

    // 2nd request in same 0.01-deg sector -> cache hit, fetchCount stays 2
    const r2 = await fetch(`${baseUrl}/api/weather/colombo?lat=6.9240&lng=79.8640`);
    const b2 = await r2.json();
    assert.equal(b2.cached, true);
    assert.equal(fetchCount, 2);

    // 3rd request in distant sector -> cache miss, fetchCount becomes 3
    const r3 = await fetch(`${baseUrl}/api/weather/colombo?lat=6.8500&lng=79.9200`);
    const b3 = await r3.json();
    assert.equal(b3.cached, false);
    assert.equal(fetchCount, 3);
  });
});

test('FLOODSENSE_MODE=LIVE fails closed without Admin SDK or Bearer token', async () => {
  // No Admin SDK -> 503 on AI verify and public-sync
  const appNoAdmin = createApiApp({
    floodsenseMode: 'LIVE',
    adminOverride: null,
    forceSkipAuthCheck: false,
  });
  const srv1 = http.createServer(appNoAdmin);
  await new Promise<void>((r) => srv1.listen(0, '127.0.0.1', () => r()));
  const url1 = `http://127.0.0.1:${(srv1.address() as AddressInfo).port}`;
  try {
    const aiRes = await fetch(`${url1}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waterLevel: 'Low' }),
    });
    assert.equal(aiRes.status, 503);

    const syncRes = await fetch(`${url1}/api/reports/public-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: 'REP-1' }),
    });
    assert.equal(syncRes.status, 503);
  } finally {
    await new Promise<void>((r) => srv1.close(() => r()));
  }

  // With Admin SDK present, missing Bearer token -> 401
  const mockDb = {
    collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }),
  };
  const appWithAdmin = createApiApp({
    floodsenseMode: 'LIVE',
    forceSkipAuthCheck: false,
    adminOverride: {
      verifyIdToken: async () => ({ uid: 'citizen-1' }),
      firestore: mockDb,
    },
  });
  const srv2 = http.createServer(appWithAdmin);
  await new Promise<void>((r) => srv2.listen(0, '127.0.0.1', () => r()));
  const url2 = `http://127.0.0.1:${(srv2.address() as AddressInfo).port}`;
  try {
    const unauthAi = await fetch(`${url2}/api/ai/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waterLevel: 'Low' }),
    });
    assert.equal(unauthAi.status, 401);

    const unauthSync = await fetch(`${url2}/api/reports/public-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: 'REP-1' }),
    });
    assert.equal(unauthSync.status, 401);
  } finally {
    await new Promise<void>((r) => srv2.close(() => r()));
  }
});

test('POST /api/reports/public-sync enforces ownership/officer role, strips PII, generalizes coordinates, and syncs', async () => {
  const storedTimestamp = new Date().toISOString();
  const storedReports: Record<string, any> = {
    'REP-SERVER-1': {
      id: 'REP-SERVER-1',
      reporterId: 'citizen-owner',
      reporterName: 'Nimal Perera',
      reporterEmail: 'nimal@example.com',
      reporterPhone: '+94771234567',
      officerNotes: ['Internal tactical note'],
      imageUrl: 'https://firebasestorage.example.com/private.jpg',
      location: 'Wellawatte Canal Bank',
      area: 'Wellawatte',
      lat: 6.874589,
      lng: 79.860432,
      timestamp: storedTimestamp,
      waterLevel: 'High',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Canal Overflow',
      description: 'Canal overflowing onto side lane',
      riskLevel: 'HIGH',
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: 'Under Review',
      publicSyncStatus: 'PENDING',
    },
    'REP-PRIOR-1': {
      id: 'REP-PRIOR-1',
      reporterId: 'another-citizen',
      location: 'Wellawatte Canal Bank',
      area: 'Wellawatte',
      lat: 6.874595,
      lng: 79.860438,
      timestamp: storedTimestamp,
      waterLevel: 'High',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Canal Overflow',
      riskLevel: 'HIGH',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Verified',
    },
  };

  const batchWrites: Array<{ col: string; id: string; data: any }> = [];
  let committed = false;

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        _col: colName,
        _id: docId,
        get: async () => {
          if (colName === 'reports' && storedReports[docId]) {
            return { exists: true, id: docId, data: () => storedReports[docId] };
          }
          if (colName === 'officers' && docId === 'officer-1') {
            return { exists: true, id: docId, data: () => ({ active: true }) };
          }
          return { exists: false, id: docId, data: () => undefined };
        },
      }),
      where: () => ({
        get: async () => ({
          docs: Object.values(storedReports).map((r) => ({ id: r.id, data: () => r })),
        }),
      }),
    }),
    batch: () => ({
      set: (ref: any, data: any) => {
        batchWrites.push({ col: ref._col || 'reports', id: ref._id || data.id || 'target', data });
      },
      commit: async () => {
        committed = true;
      },
    }),
  };

  const app = createApiApp({
    floodsenseMode: 'LIVE',
    forceSkipAuthCheck: false,
    adminOverride: {
      verifyIdToken: async (token: string) => {
        if (token === 'token-intruder') return { uid: 'intruder-user' };
        if (token === 'token-owner') return { uid: 'citizen-owner' };
        if (token === 'token-officer') return { uid: 'officer-1' };
        throw new Error('Bad token');
      },
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // 1. Intruder (non-owner, not in officers collection) -> 403 Forbidden
    const forbidRes = await fetch(`${baseUrl}/api/reports/public-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-intruder',
      },
      body: JSON.stringify({ reportId: 'REP-SERVER-1' }),
    });
    assert.equal(forbidRes.status, 403);

    // 2. Owner succeeds; client overrides ignored; PII stripped; lat/lng rounded to 3 decimals
    const ownerRes = await fetch(`${baseUrl}/api/reports/public-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-owner',
      },
      body: JSON.stringify({
        reportId: 'REP-SERVER-1',
        riskLevel: 'LOW',
        verificationStatus: 'VERIFIED',
      }),
    });
    assert.equal(ownerRes.status, 200);
    const body = await ownerRes.json();
    assert.equal(body.ok, true);
    assert.equal(committed, true);
    // Server duplicate check detects REP-PRIOR-1 within 25m / 5m
    assert.equal(body.isDuplicate, true);
    assert.equal(body.duplicateOfReportId, 'REP-PRIOR-1');
    // Public payload checks
    assert.equal(body.publicReport.coordinatePrecision, 'APPROX_100M_GRID');
    assert.equal(body.publicReport.isPublicRedacted, true);
    assert.equal(body.publicReport.lat, 6.875);
    assert.equal(body.publicReport.lng, 79.86);
    assert.equal(body.publicReport.riskLevel, 'HIGH'); // Kept Firestore truth, ignored client 'LOW'
    assert.equal(body.publicReport.verificationStatus, 'UNDER REVIEW'); // Ignored client 'VERIFIED'
    assert.equal(body.publicReport.reporterName, undefined);
    assert.equal(body.publicReport.reporterEmail, undefined);
    assert.equal(body.publicReport.reporterPhone, undefined);
    assert.equal(body.publicReport.reporterId, undefined);
    assert.equal(body.publicReport.officerNotes, undefined);
    assert.equal(body.publicReport.imageUrl, undefined);

    const pubWrite = batchWrites.find((w) => w.col === 'public_reports');
    const reportStatusWrite = batchWrites.find((w) => w.data.publicSyncStatus === 'SYNCED');
    assert.ok(pubWrite, 'Expected public_reports batch write');
    assert.ok(reportStatusWrite, 'Expected reports.publicSyncStatus = SYNCED batch write');

    // 3. Officer (via authoritative /officers/{uid} lookup) can also sync another citizen's report
    const officerRes = await fetch(`${baseUrl}/api/reports/public-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-officer',
      },
      body: JSON.stringify({ reportId: 'REP-SERVER-1' }),
    });
    assert.equal(officerRes.status, 200);
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

test('POST /api/auth/verify-officer verifies Firebase tokens server-side and rejects citizens, admins, inactive officers, and spoofed bodies', async () => {
  // 1. Admin SDK verifier unavailable -> 503 fail closed
  await withTestServer(
    { forceSkipAuthCheck: false, adminOverride: null },
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/verify-officer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer any-token' },
        body: JSON.stringify({ role: 'officer' }),
      });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.authorized, false);
    }
  );

  // 2. With verifier + mock Firestore /officers collection
  const officersDb: Record<string, any> = {
    'officer-doc-active': { active: true, role: 'officer' },
    'officer-doc-disabled': { active: false, role: 'officer' },
  };

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          if (colName === 'officers' && officersDb[docId]) {
            return { exists: true, id: docId, data: () => officersDb[docId] };
          }
          return { exists: false, id: docId, data: () => undefined };
        },
      }),
    }),
  };

  const app = createApiApp({
    forceSkipAuthCheck: false,
    adminOverride: {
      verifyIdToken: async (token: string) => {
        if (token === 'token-citizen') return { uid: 'citizen-1', email: 'c@colombo.lk', role: 'citizen' };
        if (token === 'token-admin-claim') return { uid: 'admin-fake', email: 'a@colombo.lk', role: 'admin' };
        if (token === 'token-officer-claim') return { uid: 'officer-claim-1', email: 'off1@dmc.gov.lk', role: 'officer' };
        if (token === 'token-officer-bool') return { uid: 'officer-bool-1', email: 'off2@dmc.gov.lk', officer: true };
        if (token === 'token-officer-doc') return { uid: 'officer-doc-active', email: 'off3@dmc.gov.lk' };
        if (token === 'token-officer-disabled') return { uid: 'officer-doc-disabled', email: 'off4@dmc.gov.lk' };
        throw new Error('Token expired or invalid');
      },
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // Missing Bearer token -> 401
    const noTokenRes = await fetch(`${baseUrl}/api/auth/verify-officer`, { method: 'POST' });
    assert.equal(noTokenRes.status, 401);

    // Invalid token -> 401
    const badTokenRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer corrupted-jwt' },
    });
    assert.equal(badTokenRes.status, 401);

    // Citizen even with spoofed body { role: 'officer' } -> 403
    const citizenRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-citizen' },
      body: JSON.stringify({ role: 'officer', isOfficer: true }),
    });
    assert.equal(citizenRes.status, 403);
    const citizenBody = await citizenRes.json();
    assert.equal(citizenBody.authorized, false);
    assert.equal(citizenBody.role, 'citizen');

    // No System Administrator role bypass -> 403
    const adminClaimRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-admin-claim' },
    });
    assert.equal(adminClaimRes.status, 403);

    // Inactive officer in /officers/{uid} -> 403
    const disabledRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-officer-disabled' },
    });
    assert.equal(disabledRes.status, 403);

    // Valid custom claim { role: 'officer' } -> 200
    const claimRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-officer-claim' },
    });
    assert.equal(claimRes.status, 200);
    const claimBody = await claimRes.json();
    assert.equal(claimBody.authorized, true);
    assert.equal(claimBody.role, 'officer');
    assert.equal(claimBody.verificationSource, 'custom_claims');

    // Valid custom claim { officer: true } -> 200
    const boolClaimRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-officer-bool' },
    });
    assert.equal(boolClaimRes.status, 200);
    const boolClaimBody = await boolClaimRes.json();
    assert.equal(boolClaimBody.authorized, true);
    assert.equal(boolClaimBody.verificationSource, 'custom_claims');

    // Valid active /officers/{uid} document -> 200
    const docRes = await fetch(`${baseUrl}/api/auth/verify-officer`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-officer-doc' },
    });
    assert.equal(docRes.status, 200);
    const docBody = await docRes.json();
    assert.equal(docBody.authorized, true);
    assert.equal(docBody.role, 'officer');
    assert.equal(docBody.verificationSource, 'officers_collection');

    // GET /api/auth/session distinguishes citizen vs officer
    const sessCitizen = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer token-citizen' },
    });
    assert.equal(sessCitizen.status, 200);
    assert.equal((await sessCitizen.json()).role, 'citizen');

    const sessOfficer = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: 'Bearer token-officer-doc' },
    });
    assert.equal(sessOfficer.status, 200);
    const sessOfficerBody = await sessOfficer.json();
    assert.equal(sessOfficerBody.role, 'officer');
    assert.equal(sessOfficerBody.verificationSource, 'officers_collection');
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

test('POST /api/auth/bootstrap-first-officer authorizes only the first officer with a strong secret and locks afterwards', async () => {
  const officersStore: Record<string, any> = {};
  const usersStore: Record<string, any> = {};
  const customClaimsLog: Array<{ uid: string; claims: Record<string, any> }> = [];

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const store = colName === 'officers' ? officersStore : usersStore;
          return store[docId]
            ? { exists: true, id: docId, data: () => store[docId] }
            : { exists: false, id: docId, data: () => undefined };
        },
        set: async (data: any) => {
          const store = colName === 'officers' ? officersStore : usersStore;
          store[docId] = { ...(store[docId] || {}), ...data };
        },
      }),
      limit: (n: number) => ({
        get: async () => {
          const entries = Object.entries(colName === 'officers' ? officersStore : usersStore).slice(0, n);
          return {
            empty: entries.length === 0,
            docs: entries.map(([id, data]) => ({ id, data: () => data })),
          };
        },
      }),
    }),
  };

  // Unconfigured secret -> 403 disabled
  const disabledApp = createApiApp({
    forceSkipAuthCheck: false,
    officerBootstrapSecret: '',
    adminOverride: {
      verifyIdToken: async () => ({ uid: 'u1', email: 'first@dmc.gov.lk' }),
      firestore: mockFirestore,
      setCustomUserClaims: async () => {},
    },
  });
  const s1 = http.createServer(disabledApp);
  await new Promise<void>((r) => s1.listen(0, '127.0.0.1', () => r()));
  const u1 = `http://127.0.0.1:${(s1.address() as AddressInfo).port}`;
  try {
    const res = await fetch(`${u1}/api/auth/bootstrap-first-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t1' },
      body: JSON.stringify({ bootstrapSecret: 'any-secret-here-1234' }),
    });
    assert.equal(res.status, 403);
  } finally {
    await new Promise<void>((r) => s1.close(() => r()));
  }

  // Configured secret -> authorizes first officer, blocks wrong secret, blocks second attempt with 409
  const secret = 'ColomboEOCBootstrap#2026';
  const enabledApp = createApiApp({
    forceSkipAuthCheck: false,
    officerBootstrapSecret: secret,
    adminOverride: {
      verifyIdToken: async (token: string) => ({
        uid: token === 'token-first' ? 'first-uid' : 'second-uid',
        email: token === 'token-first' ? 'chief@dmc.gov.lk' : 'other@gmail.com',
        name: 'Colombo EOC Chief',
      }),
      firestore: mockFirestore,
      setCustomUserClaims: async (uid: string, claims: Record<string, any>) => {
        customClaimsLog.push({ uid, claims });
      },
    },
  });
  const s2 = http.createServer(enabledApp);
  await new Promise<void>((r) => s2.listen(0, '127.0.0.1', () => r()));
  const u2 = `http://127.0.0.1:${(s2.address() as AddressInfo).port}`;
  try {
    // Wrong secret -> 403
    const badSecretRes = await fetch(`${u2}/api/auth/bootstrap-first-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-first' },
      body: JSON.stringify({ bootstrapSecret: 'wrong-secret-value-1' }),
    });
    assert.equal(badSecretRes.status, 403);

    // Valid first officer bootstrap -> 200
    const okRes = await fetch(`${u2}/api/auth/bootstrap-first-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-first' },
      body: JSON.stringify({ bootstrapSecret: secret }),
    });
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.equal(okBody.ok, true);
    assert.equal(okBody.role, 'officer');
    assert.deepEqual(customClaimsLog[0], { uid: 'first-uid', claims: { role: 'officer', officer: true } });
    assert.equal(officersStore['first-uid']?.active, true);
    assert.equal(officersStore['first-uid']?.role, 'officer');

    // Second user attempt -> 409 Conflict (permanently locked once first officer exists)
    const secondRes = await fetch(`${u2}/api/auth/bootstrap-first-officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-second' },
      body: JSON.stringify({ bootstrapSecret: secret }),
    });
    assert.equal(secondRes.status, 409);
  } finally {
    await new Promise<void>((r) => s2.close(() => r()));
  }
});

test('GET /api/officer/authorize and PATCH /api/users/profile enforce officer custom claims and block role elevation', async () => {
  const officersStore: Record<string, any> = {
    'revoked-officer-uid': { active: false, role: 'citizen' },
  };
  const usersStore: Record<string, any> = {
    'citizen-1': { uid: 'citizen-1', email: 'c@colombo.lk', role: 'citizen' },
  };

  const mockFirestore = {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const store = colName === 'officers' ? officersStore : usersStore;
          return store[docId]
            ? { exists: true, id: docId, data: () => store[docId] }
            : { exists: false, id: docId, data: () => undefined };
        },
        set: async (data: any) => {
          const store = colName === 'officers' ? officersStore : usersStore;
          store[docId] = { ...(store[docId] || {}), ...data };
        },
      }),
    }),
  };

  const app = createApiApp({
    forceSkipAuthCheck: false,
    adminOverride: {
      verifyIdToken: async (token: string) => {
        if (token === 'token-citizen') return { uid: 'citizen-1', email: 'c@colombo.lk', role: 'citizen' };
        if (token === 'token-revoked-claim') return { uid: 'revoked-officer-uid', email: 'ex@dmc.gov.lk', role: 'officer' };
        if (token === 'token-officer-claim') return { uid: 'officer-1', email: 'off@dmc.gov.lk', role: 'officer' };
        throw new Error('Invalid token');
      },
      firestore: mockFirestore,
    },
  });

  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const baseUrl = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;

  try {
    // Unauthenticated /api/officer/authorize -> 401
    const unauth = await fetch(`${baseUrl}/api/officer/authorize`);
    assert.equal(unauth.status, 401);

    // Citizen on /api/officer/authorize -> 403
    const citizenRes = await fetch(`${baseUrl}/api/officer/authorize`, {
      headers: { Authorization: 'Bearer token-citizen' },
    });
    assert.equal(citizenRes.status, 403);

    // Revoked officer with unexpired JWT claim -> 403
    const revokedRes = await fetch(`${baseUrl}/api/officer/authorize`, {
      headers: { Authorization: 'Bearer token-revoked-claim' },
    });
    assert.equal(revokedRes.status, 403);

    // Active officer with custom claim -> 200
    const officerRes = await fetch(`${baseUrl}/api/officer/authorize`, {
      headers: { Authorization: 'Bearer token-officer-claim' },
    });
    assert.equal(officerRes.status, 200);
    const officerBody = await officerRes.json();
    assert.equal(officerBody.authorized, true);
    assert.equal(officerBody.role, 'officer');
    assert.equal(officerBody.verificationSource, 'custom_claims');

    // Profile update attempting role elevation -> 403 and Firestore untouched
    const elevationRes = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-citizen',
      },
      body: JSON.stringify({ name: 'Escalator', role: 'officer', isOfficer: true }),
    });
    assert.equal(elevationRes.status, 403);
    assert.equal(usersStore['citizen-1'].role, 'citizen');

    // Legitimate editable profile fields succeed
    const cleanProfileRes = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-citizen',
      },
      body: JSON.stringify({ name: 'Amali Silva', phone: '+94 77 999 0000', emergencySector: 'Sector 03' }),
    });
    assert.equal(cleanProfileRes.status, 200);
    assert.equal(usersStore['citizen-1'].name, 'Amali Silva');
    assert.equal(usersStore['citizen-1'].role, 'citizen');
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
});



