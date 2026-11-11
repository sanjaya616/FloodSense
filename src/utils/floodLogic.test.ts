/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineDistance,
  evaluateRiskLevel,
  getWaterLevelSeverity,
  simulateAiVerification,
  generateSimulatedBlockchainRecord,
  validateCoordinates,
  areReportsDuplicate,
  clusterReports,
  calculateDynamicAnalytics,
  DEFAULT_RISK_THRESHOLDS,
  DEFAULT_CLUSTERING_CONFIG,
  FloodReport,
  IncidentStatus,
} from './floodLogic.ts';

// 1. Haversine Distance Tests
test('calculateHaversineDistance calculates realistic geographic distance and handles identical coordinates', () => {
  // Colombo Town Hall (6.9147, 79.8653) to Maradana Railway Station (6.9271, 79.8653) ~ 1.38 km
  const dist = calculateHaversineDistance(6.9147, 79.8653, 6.9271, 79.8653);
  assert.ok(dist > 1200 && dist < 1500, `Expected ~1380m, got ${dist}`);

  // Same coordinates should return exactly 0
  const zeroDist = calculateHaversineDistance(6.9271, 79.8653, 6.9271, 79.8653);
  assert.equal(zeroDist, 0);
});

// 2. Coordinate Validation Tests
test('validateCoordinates correctly identifies valid vs invalid geographic bounds', () => {
  assert.equal(validateCoordinates(6.9271, 79.8653), true);
  assert.equal(validateCoordinates(0, 0), true);
  assert.equal(validateCoordinates(-90, -180), true);
  assert.equal(validateCoordinates(90, 180), true);

  // Invalid latitudes (> 90 or < -90)
  assert.equal(validateCoordinates(91.5, 79.8653), false);
  assert.equal(validateCoordinates(-95.0, 79.8653), false);

  // Invalid longitudes (> 180 or < -180)
  assert.equal(validateCoordinates(6.9271, 185.0), false);
  assert.equal(validateCoordinates(6.9271, -195.0), false);

  // Non-number values
  assert.equal(validateCoordinates(NaN, 79.8653), false);
  assert.equal(validateCoordinates(6.9271, NaN), false);
});

// 3. Haversine with Invalid Coordinates
test('calculateHaversineDistance returns Infinity when coordinates are invalid', () => {
  const invalidDist = calculateHaversineDistance(100.0, 79.8653, 6.9271, 79.8653);
  assert.equal(invalidDist, Infinity);
});

// 4. Duplicate Report Detection
test('areReportsDuplicate correctly identifies near-duplicate reports', () => {
  const baseReport = {
    lat: 6.9271,
    lng: 79.8653,
    timestamp: '2026-11-11T10:00:00.000Z',
  };

  // Same spot within 2 minutes (< 25m and < 5 mins) -> Duplicate
  const duplicateReport = {
    lat: 6.92711, // ~1 meter offset
    lng: 79.86531,
    timestamp: '2026-11-11T10:02:00.000Z',
  };
  assert.equal(areReportsDuplicate(baseReport, duplicateReport), true);

  // Same spot but 30 minutes later -> NOT duplicate (temporal difference)
  const laterReport = {
    lat: 6.9271,
    lng: 79.8653,
    timestamp: '2026-11-11T10:30:00.000Z',
  };
  assert.equal(areReportsDuplicate(baseReport, laterReport), false);

  // Far away (300 meters) at same time -> NOT duplicate (spatial difference)
  const distantReport = {
    lat: 6.9300,
    lng: 79.8653,
    timestamp: '2026-11-11T10:01:00.000Z',
  };
  assert.equal(areReportsDuplicate(baseReport, distantReport), false);
});

// 5. Risk Threshold Boundaries (Evaluating HIGH before MEDIUM)
test('evaluateRiskLevel boundary condition tests with strict HIGH before MEDIUM evaluation', () => {
  // HIGH Boundary: count >= 3 AND rain > 20
  // Exactly 3 reports and 20.1 mm rain -> HIGH
  const highBoundary = evaluateRiskLevel(3, 20.1);
  assert.equal(highBoundary.riskLevel, 'HIGH');
  assert.equal(highBoundary.breakdown.highRuleMet, true);

  // 3 reports and exactly 20.0 mm rain -> Not strictly > 20 mm, falls to MEDIUM (count >= 2)
  const edgeMedium = evaluateRiskLevel(3, 20.0);
  assert.equal(edgeMedium.riskLevel, 'MEDIUM');
  assert.equal(edgeMedium.breakdown.highRuleMet, false);
  assert.equal(edgeMedium.breakdown.mediumRuleMet, true);

  // MEDIUM Boundary: count >= 2 OR rain > 10
  // 2 reports and 5 mm rain -> MEDIUM
  const medReportCount = evaluateRiskLevel(2, 5.0);
  assert.equal(medReportCount.riskLevel, 'MEDIUM');

  // 1 report and 10.1 mm rain -> MEDIUM
  const medRainfall = evaluateRiskLevel(1, 10.1);
  assert.equal(medRainfall.riskLevel, 'MEDIUM');

  // LOW Boundary: count < 2 AND rain <= 10 mm
  // 1 report and exactly 10.0 mm rain -> LOW
  const lowBoundary = evaluateRiskLevel(1, 10.0);
  assert.equal(lowBoundary.riskLevel, 'LOW');
  assert.equal(lowBoundary.breakdown.highRuleMet, false);
  assert.equal(lowBoundary.breakdown.mediumRuleMet, false);

  // 0 reports and 0 rain -> LOW
  const zeroState = evaluateRiskLevel(0, 0);
  assert.equal(zeroState.riskLevel, 'LOW');
});

// 6. Custom Risk Threshold Overrides
test('evaluateRiskLevel supports configurable custom thresholds', () => {
  const customConfig = {
    highReportCount: 5,
    highRainfallMm: 30,
    mediumReportCount: 3,
    mediumRainfallMm: 15,
  };

  // With 4 reports and 25mm rain:
  // Under DEFAULT config: 4 >= 3 and 25 > 20 -> HIGH
  const underDefault = evaluateRiskLevel(4, 25);
  assert.equal(underDefault.riskLevel, 'HIGH');

  // Under CUSTOM config: 4 < 5, but 4 >= 3 -> MEDIUM
  const underCustom = evaluateRiskLevel(4, 25, customConfig);
  assert.equal(underCustom.riskLevel, 'MEDIUM');
});

// 7. Water Level Severity Categorization
test('getWaterLevelSeverity categorizes correctly', () => {
  assert.equal(getWaterLevelSeverity('Severe'), 'HIGH');
  assert.equal(getWaterLevelSeverity('High'), 'HIGH');
  assert.equal(getWaterLevelSeverity('Moderate'), 'MEDIUM');
  assert.equal(getWaterLevelSeverity('Low'), 'LOW');
});

// 8. Geospatial and Temporal Clustering Boundaries
test('clusterReports clusters within 500m radius and 2-hour window and excludes outside boundaries', () => {
  const now = Date.now();

  const report1: FloodReport = {
    id: 'R1',
    location: 'Maradana Junction Seed',
    area: 'Maradana',
    lat: 6.9271,
    lng: 79.8653,
    timestamp: new Date(now).toISOString(),
    waterLevel: 'High',
    roadAccessibility: 'Partially Blocked',
    floodType: 'Street Waterlogging',
    description: 'Test report 1',
    riskLevel: 'HIGH',
    verificationStatus: 'VERIFIED',
    incidentStatus: 'Verified',
    statusHistory: [],
  };

  // Report 2: ~200 meters away, 15 minutes later -> In same cluster
  const report2: FloodReport = {
    id: 'R2',
    location: 'Maradana Railway Yard',
    area: 'Maradana',
    lat: 6.9285, // ~155m away
    lng: 79.8653,
    timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
    waterLevel: 'Moderate',
    roadAccessibility: 'Partially Blocked',
    floodType: 'Street Waterlogging',
    description: 'Test report 2',
    riskLevel: 'MEDIUM',
    verificationStatus: 'UNDER REVIEW',
    incidentStatus: 'Under Review',
    statusHistory: [],
  };

  // Report 3: 200 meters away, but 3.5 hours earlier (> 2 hour temporal window) -> Must NOT be clustered with R1
  const report3: FloodReport = {
    id: 'R3',
    location: 'Maradana Historical Flood',
    area: 'Maradana',
    lat: 6.9275,
    lng: 79.8653,
    timestamp: new Date(now - 3.5 * 60 * 60 * 1000).toISOString(),
    waterLevel: 'High',
    roadAccessibility: 'Completely Blocked',
    floodType: 'Street Waterlogging',
    description: 'Expired temporal window',
    riskLevel: 'HIGH',
    verificationStatus: 'VERIFIED',
    incidentStatus: 'Resolved',
    statusHistory: [],
  };

  // Report 4: Far away (Wellawatte, ~6 km away) -> Separate cluster
  const report4: FloodReport = {
    id: 'R4',
    location: 'Wellawatte Canal Crossing',
    area: 'Wellawatte',
    lat: 6.8745,
    lng: 79.8600,
    timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
    waterLevel: 'Moderate',
    roadAccessibility: 'Partially Blocked',
    floodType: 'Canal Overflow',
    description: 'Coastal sector report',
    riskLevel: 'MEDIUM',
    verificationStatus: 'VERIFIED',
    incidentStatus: 'Verified',
    statusHistory: [],
  };

  const clusters = clusterReports([report1, report2, report3, report4]);

  // Should form distinct clusters: R1+R2 in one, R3 in its own (due to time window), R4 in its own (due to spatial distance)
  assert.ok(clusters.length >= 3, `Expected at least 3 clusters, got ${clusters.length}`);

  const maradanaCluster = clusters.find((c) => c.associatedReportIds.includes('R1'));
  assert.ok(maradanaCluster);
  assert.ok(maradanaCluster.associatedReportIds.includes('R2'));
  assert.ok(!maradanaCluster.associatedReportIds.includes('R3'), 'R3 should be excluded due to 2-hour temporal boundary');
  assert.ok(!maradanaCluster.associatedReportIds.includes('R4'), 'R4 should be excluded due to 500m spatial boundary');
});

// 9. AI Verification Fallback and Disclaimer
test('simulateAiVerification returns expected structure and non-empty disclaimer', () => {
  const withImage = simulateAiVerification({
    waterLevel: 'High',
    floodType: 'Flash Flood',
    hasImage: true,
    description: 'Road inundated',
  });
  assert.equal(withImage.status, 'VERIFIED');
  assert.ok(withImage.confidence >= 85);
  assert.ok(withImage.disclaimer.includes('not a substitute for official municipal field inspection'));
  assert.equal(withImage.humanVerificationRequired, true);

  const withoutImage = simulateAiVerification({
    waterLevel: 'Moderate',
    floodType: 'Street Waterlogging',
    hasImage: false,
    description: 'Text signal only',
  });
  assert.equal(withoutImage.status, 'UNDER REVIEW');
  assert.ok(withoutImage.uncertainty?.includes('lacks optical depth'));
});

// 10. Simulated Blockchain Record Format & Labels
test('generateSimulatedBlockchainRecord generates valid hex format and explicit simulation markers', () => {
  const rec = generateSimulatedBlockchainRecord('HS-042', 'Maradana', 'HIGH');
  assert.equal(rec.hotspotId, 'HS-042');
  assert.equal(rec.location, 'Maradana');
  assert.equal(rec.severity, 'HIGH');
  assert.equal(rec.isSimulated, true);
  assert.ok(rec.network.includes('Simulated'));
  assert.ok(rec.txHash.startsWith('0x'));
  assert.equal(rec.txHash.length, 66);
  assert.ok(rec.merkleRoot.startsWith('0x'));
  assert.equal(rec.merkleRoot.length, 66);
  assert.ok(rec.payloadHash.startsWith('0x'));
  assert.ok(rec.auditExplanation.includes('Demonstration Smart Contract'));
});

// 11. Dynamic Analytics Calculation Function
test('calculateDynamicAnalytics returns correct proportions and non-hardcoded counts', () => {
  const sampleReports: FloodReport[] = [
    {
      id: 'REP-1',
      location: 'Maradana Road',
      area: 'Maradana',
      lat: 6.9271,
      lng: 79.8653,
      timestamp: new Date().toISOString(),
      waterLevel: 'Severe',
      roadAccessibility: 'Completely Blocked',
      floodType: 'Street Waterlogging',
      description: 'Flood 1',
      riskLevel: 'HIGH',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Alert Issued',
      statusHistory: [],
      verificationTimestamp: new Date().toISOString(),
    },
    {
      id: 'REP-2',
      location: 'Kolonnawa Canal',
      area: 'Kolonnawa',
      lat: 6.9360,
      lng: 79.8850,
      timestamp: new Date().toISOString(),
      waterLevel: 'High',
      roadAccessibility: 'Partially Blocked',
      floodType: 'Canal Overflow',
      description: 'Flood 2',
      riskLevel: 'HIGH',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Verified',
      statusHistory: [],
    },
    {
      id: 'REP-3',
      location: 'Wellawatte',
      area: 'Wellawatte',
      lat: 6.8745,
      lng: 79.8600,
      timestamp: new Date().toISOString(),
      waterLevel: 'Moderate',
      roadAccessibility: 'Open',
      floodType: 'Street Waterlogging',
      description: 'Flood 3',
      riskLevel: 'MEDIUM',
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: 'Under Review',
      statusHistory: [],
    },
    {
      id: 'REP-4',
      location: 'Borella',
      area: 'Borella',
      lat: 6.9110,
      lng: 79.8770,
      timestamp: new Date().toISOString(),
      waterLevel: 'Low',
      roadAccessibility: 'Open',
      floodType: 'Street Waterlogging',
      description: 'Flood 4',
      riskLevel: 'LOW',
      verificationStatus: 'VERIFIED',
      incidentStatus: 'Resolved',
      statusHistory: [],
    },
  ];

  const analytics = calculateDynamicAnalytics(sampleReports, [], '24h');
  assert.equal(analytics.totalReports, 4);
  assert.equal(analytics.highRisk, 2);
  assert.equal(analytics.mediumRisk, 1);
  assert.equal(analytics.lowRisk, 1);

  // Status counts
  assert.equal(analytics.statusCounts['Alert Issued'], 1);
  assert.equal(analytics.statusCounts['Verified'], 1);
  assert.equal(analytics.statusCounts['Under Review'], 1);
  assert.equal(analytics.statusCounts['Resolved'], 1);

  // Reports by zone
  assert.equal(analytics.reportsByZone.length, 4);
  assert.equal(analytics.verifiedCount, 3); // Alert Issued, Verified, Resolved
  assert.equal(analytics.verifiedPercentage, 75);
});
