/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { floodService } from './floodService';

test('firestore.indexes.json declares composite indexes for citizen-scoped queries', () => {
  const indexPath = path.resolve(process.cwd(), 'firestore.indexes.json');
  const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  assert.ok(Array.isArray(raw.indexes), 'Expected indexes array in firestore.indexes.json');

  const hasIndex = (group: string, f1: string, f2: string) =>
    raw.indexes.some(
      (idx: any) =>
        idx.collectionGroup === group &&
        Array.isArray(idx.fields) &&
        idx.fields.length >= 2 &&
        idx.fields[0].fieldPath === f1 &&
        idx.fields[0].order === 'ASCENDING' &&
        idx.fields[1].fieldPath === f2 &&
        idx.fields[1].order === 'DESCENDING'
    );

  assert.equal(hasIndex('reports', 'reporterId', 'timestamp'), true, 'Missing reports(reporterId, timestamp) index');
  assert.equal(
    hasIndex('notifications', 'recipientUid', 'createdAt'),
    true,
    'Missing notifications(recipientUid, createdAt) index'
  );
  assert.equal(
    hasIndex('status_history', 'citizenUid', 'timestamp'),
    true,
    'Missing status_history(citizenUid, timestamp) index'
  );
});

test('firestore.rules enforces privilege boundaries, PENDING sync on create, and zero PII on public_reports', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  // Authoritative officer check relies on custom claims or /officers/{uid}, NOT /users/{uid}
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/officers\/\$\(request\.auth\.uid\)\)/);
  assert.match(rules, /match \/officers\/\{officerId\}[\s\S]*allow write: if false;/);

  // /users/{userId} prevents citizen self-escalation on create and update
  assert.match(rules, /!?\('role' in incoming\(\)\) \|\| incoming\(\)\.role == 'citizen'/);
  assert.match(rules, /!?\('role' in incoming\(\)\) \|\| incoming\(\)\.role == existing\(\)\.role/);
  assert.match(rules, /!incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasAny\(/);
  assert.match(rules, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);

  // Citizen /reports create enforces publicSyncStatus == 'PENDING' if supplied
  assert.match(rules, /incoming\(\)\.publicSyncStatus == 'PENDING'/);

  // /public_reports excludes PII fields
  for (const piiField of ['reporterName', 'reporterPhone', 'reporterEmail', 'reporterId', 'officerNotes', 'imageUrl']) {
    assert.ok(rules.includes(`!('${piiField}' in incoming())`), `Expected ${piiField} blocked in public_reports`);
  }
});

test('floodService.fetchLiveWeather preserves expected3hRainfallMm: null when degraded or incomplete', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // Case 1: Backend returns degraded fallback response with null expected3hRainfallMm
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          isLive: false,
          isUsingDemonstrationFallback: true,
          forecastAvailable: false,
          forecastCompleteness: 'UNAVAILABLE',
          expected3hRainfallMm: null,
          currentTempC: 28,
          currentRainfallMm: 34.5,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const degraded = await floodService.fetchLiveWeather(6.9271, 79.8653);
    assert.equal(degraded.expected3hRainfallMm, null);
    assert.equal(degraded.forecastAvailable, false);
    assert.equal(degraded.isUsingDemonstrationFallback, true);

    // Case 2: Network failure -> catches cleanly and preserves expected3hRainfallMm: null
    globalThis.fetch = (async () => {
      throw new Error('Network unreachable');
    }) as typeof fetch;

    const offline = await floodService.fetchLiveWeather(6.9271, 79.8653);
    assert.equal(offline.expected3hRainfallMm, null);
    assert.equal(offline.isLive, false);
    assert.equal(offline.forecastCompleteness, 'UNAVAILABLE');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('floodService.submitReport & retryPublicSync handle DEMO mode and FIREBASE misconfiguration safely', async () => {
  const prevMode = floodService.getMode();
  try {
    floodService.setMode('DEMO');
    const syncRes = await floodService.retryPublicSync('REP-DEMO-ANY');
    assert.equal(syncRes.ok, true);

    floodService.setMode('FIREBASE');
    await assert.rejects(
      () => floodService.updateUserProfileInFirestore('uid-1', { name: 'Test' }),
      /not configured|permission-denied|Missing or insufficient permissions/i
    );

    await assert.rejects(
      () => floodService.updateUserProfileInFirestore('uid-1', { name: 'Test', role: 'officer' }),
      /Forbidden: "role" cannot be modified/i
    );

    const noTokenRes = await floodService.verifyOfficerWithBackend(null);
    assert.equal(noTokenRes.authorized, false);
  } finally {
    floodService.setMode(prevMode);
  }
});

