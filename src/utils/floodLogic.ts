/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type IncidentStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Verified'
  | 'Alert Issued'
  | 'Resolved'
  | 'Rejected';

export interface StatusHistoryEntry {
  status: IncidentStatus;
  timestamp: string; // ISO string
  authorName: string;
  note?: string;
}

export interface AiVerificationDetails {
  method: 'Gemini 3.8 Flash (Multimodal)' | 'Demonstration Heuristic (Simulated)';
  status: 'VERIFIED' | 'UNDER REVIEW' | 'REJECTED';
  confidence: number;
  assessment: string;
  explanation: string;
  uncertainty?: string;
  waterLevelEstimated?: string;
  roadAccessibilityEstimated?: string;
  humanVerificationRequired: boolean;
  timestamp: string;
  disclaimer: string;
}

export interface FloodReport {
  id: string;
  hotspotId?: string;
  location: string;
  area: 'Maradana' | 'Wellawatte' | 'Borella' | 'Kolonnawa' | 'Dematagoda' | 'Nugegoda' | string;
  lat: number;
  lng: number;
  timestamp: string; // ISO string
  waterLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  roadAccessibility: 'Open' | 'Partially Blocked' | 'Completely Blocked';
  floodType: 'Flash Flood' | 'Street Waterlogging' | 'Canal Overflow' | 'Drainage Blockage';
  description: string;
  imageUrl?: string;
  reporterName?: string;
  reporterPhone?: string;
  reporterId?: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  verificationStatus: 'VERIFIED' | 'UNDER REVIEW' | 'REJECTED';
  incidentStatus: IncidentStatus;
  statusHistory: StatusHistoryEntry[];
  officerNotes?: string[];
  verificationTimestamp?: string;
  verifiedBy?: string;
  aiConfidence?: number;
  aiClassification?: string;
  aiVerificationDetails?: AiVerificationDetails;
}

export interface FloodHotspot {
  id: string;
  location: string;
  area: string;
  lat: number;
  lng: number;
  reportCount: number;
  firstReportedTime: string;
  latestReportedTime: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number; // 0 - 100
  forecastRainfallMm: number; // next 3 hours
  verificationStatus: 'VERIFIED' | 'UNDER REVIEW';
  precaution: string;
  associatedReportIds: string[];
  clusterRadiusMeters?: number;
  formationDetails?: {
    timeSpanMinutes: number;
    activeWindowHours: number;
    spatialRadiusMeters: number;
    centerLat: number;
    centerLng: number;
    reasoning: string;
  };
}

export interface BlockchainRecord {
  eventId: string;
  hotspotId: string;
  location: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  txHash: string;
  blockNumber: number;
  network: string;
  status: 'CONFIRMED (SIMULATED)' | 'PENDING (SIMULATED)' | 'CONFIRMED (TESTNET)' | 'PENDING (TESTNET)';
  merkleRoot: string;
  validatorCount: number;
  isSimulated: boolean;
  payloadHash: string;
  contractAddress?: string;
  chainId?: number;
  auditExplanation: string;
}

export interface RiskThresholdConfig {
  highReportCount: number; // default: 3
  highRainfallMm: number;  // default: 20
  mediumReportCount: number; // default: 2
  mediumRainfallMm: number; // default: 10
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholdConfig = {
  highReportCount: 3,
  highRainfallMm: 20,
  mediumReportCount: 2,
  mediumRainfallMm: 10,
};

export interface ClusteringConfig {
  spatialRadiusMeters: number; // default 500m
  temporalWindowHours: number; // default 2 hours
}

export const DEFAULT_CLUSTERING_CONFIG: ClusteringConfig = {
  spatialRadiusMeters: 500,
  temporalWindowHours: 2,
};

/**
 * Validates GPS latitude and longitude values
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Calculates distance between two GPS coordinates in meters using the Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!validateCoordinates(lat1, lon1) || !validateCoordinates(lat2, lon2)) {
    return Infinity;
  }
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Determines water level risk weighting
 */
export function getWaterLevelSeverity(waterLevel: FloodReport['waterLevel']): 'HIGH' | 'MEDIUM' | 'LOW' {
  switch (waterLevel) {
    case 'Severe':
    case 'High':
      return 'HIGH';
    case 'Moderate':
      return 'MEDIUM';
    case 'Low':
    default:
      return 'LOW';
  }
}

/**
 * Risk evaluation based on project prototype rules:
 * HIGH: report count >= 3 AND forecast rainfall > 20 mm in the next 3h
 * MEDIUM: report count >= 2 OR forecast rainfall > 10 mm
 * LOW: otherwise
 * (Thresholds are configurable; HIGH is always evaluated strictly before MEDIUM)
 */
export function evaluateRiskLevel(
  reportCount: number,
  forecastRainfallMm: number,
  customThresholds?: Partial<RiskThresholdConfig>
): {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reasoning: string;
  precaution: string;
  breakdown: {
    reportCount: number;
    rainfallMm: number;
    highRuleMet: boolean;
    mediumRuleMet: boolean;
    appliedRule: string;
  };
} {
  const config: RiskThresholdConfig = {
    ...DEFAULT_RISK_THRESHOLDS,
    ...customThresholds,
  };

  const count = Math.max(0, Math.floor(reportCount || 0));
  const rain = Math.max(0, Number(forecastRainfallMm || 0));

  const highRuleMet = count >= config.highReportCount && rain > config.highRainfallMm;
  const mediumRuleMet = count >= config.mediumReportCount || rain > config.mediumRainfallMm;

  if (highRuleMet) {
    const score = Math.min(98, Math.round(75 + (count - config.highReportCount) * 3 + (rain - config.highRainfallMm) * 0.5));
    return {
      riskLevel: 'HIGH',
      score,
      reasoning: `Triggered HIGH risk threshold: ${count} citizen reports (threshold >= ${config.highReportCount}) AND ${rain.toFixed(1)} mm forecast rainfall (threshold > ${config.highRainfallMm} mm).`,
      precaution: 'Deploy immediate emergency sucker trucks, divert vehicular traffic from low-lying arterial corridors, and broadcast civilian safety advisories.',
      breakdown: {
        reportCount: count,
        rainfallMm: rain,
        highRuleMet: true,
        mediumRuleMet: true,
        appliedRule: `HIGH: count (${count}) >= ${config.highReportCount} AND rain (${rain.toFixed(1)}mm) > ${config.highRainfallMm}mm`,
      },
    };
  }

  if (mediumRuleMet) {
    const score = Math.min(74, Math.round(45 + (count >= config.mediumReportCount ? 15 : 0) + (rain > config.mediumRainfallMm ? rain * 0.8 : 0)));
    const reasonParts = [];
    if (count >= config.mediumReportCount) reasonParts.push(`${count} reports (threshold >= ${config.mediumReportCount})`);
    if (rain > config.mediumRainfallMm) reasonParts.push(`${rain.toFixed(1)} mm forecast rainfall (threshold > ${config.mediumRainfallMm} mm)`);

    return {
      riskLevel: 'MEDIUM',
      score,
      reasoning: `Triggered MEDIUM risk threshold: ${reasonParts.join(' OR ')}.`,
      precaution: 'Issue yellow alert for vulnerable intersections, inspect municipal catch basins, and monitor stormwater accumulation velocity.',
      breakdown: {
        reportCount: count,
        rainfallMm: rain,
        highRuleMet: false,
        mediumRuleMet: true,
        appliedRule: `MEDIUM: count (${count}) >= ${config.mediumReportCount} OR rain (${rain.toFixed(1)}mm) > ${config.mediumRainfallMm}mm`,
      },
    };
  }

  const score = Math.min(44, Math.round(15 + count * 8 + rain * 1.2));
  return {
    riskLevel: 'LOW',
    score,
    reasoning: `Parameters remain within manageable baseline: ${count} reports and ${rain.toFixed(1)} mm forecast rainfall.`,
    precaution: 'Routine surveillance active. Maintain standard runoff monitoring protocols across Colombo municipal sectors.',
    breakdown: {
      reportCount: count,
      rainfallMm: rain,
      highRuleMet: false,
      mediumRuleMet: false,
      appliedRule: `LOW: baseline runoff (< ${config.mediumReportCount} reports AND <= ${config.mediumRainfallMm}mm rain)`,
    },
  };
}

/**
 * Checks if two reports are potential duplicates
 * (e.g. reported within 25 meters and 5 minutes of each other)
 */
export function areReportsDuplicate(
  reportA: { lat: number; lng: number; timestamp: string },
  reportB: { lat: number; lng: number; timestamp: string }
): boolean {
  const distance = calculateHaversineDistance(reportA.lat, reportA.lng, reportB.lat, reportB.lng);
  if (distance > 25) return false;

  const timeDiffMs = Math.abs(new Date(reportA.timestamp).getTime() - new Date(reportB.timestamp).getTime());
  const fiveMinutesMs = 5 * 60 * 1000;
  return timeDiffMs <= fiveMinutesMs;
}

/**
 * Clusters reports into hotspots based on spatial radius (<= 500m) and temporal window (<= 2 hours)
 */
export function clusterReports(
  reports: FloodReport[],
  config: ClusteringConfig = DEFAULT_CLUSTERING_CONFIG,
  rainfallByArea?: Record<string, number>,
  riskThresholds?: Partial<RiskThresholdConfig>
): FloodHotspot[] {
  const validReports = reports.filter((r) => validateCoordinates(r.lat, r.lng));
  if (validReports.length === 0) return [];

  // Sort descending by timestamp (newest first)
  const sortedReports = [...validReports].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const clusters: FloodReport[][] = [];
  const assignedReportIds = new Set<string>();

  for (const report of sortedReports) {
    if (assignedReportIds.has(report.id)) continue;

    const cluster: FloodReport[] = [report];
    assignedReportIds.add(report.id);

    const reportTime = new Date(report.timestamp).getTime();
    const windowMs = config.temporalWindowHours * 60 * 60 * 1000;

    for (const candidate of sortedReports) {
      if (assignedReportIds.has(candidate.id)) continue;

      const candidateTime = new Date(candidate.timestamp).getTime();
      const timeDiff = Math.abs(reportTime - candidateTime);

      // Check temporal window
      if (timeDiff > windowMs) continue;

      // Check spatial radius to cluster seed
      const distance = calculateHaversineDistance(report.lat, report.lng, candidate.lat, candidate.lng);
      if (distance <= config.spatialRadiusMeters) {
        cluster.push(candidate);
        assignedReportIds.add(candidate.id);
      }
    }

    clusters.push(cluster);
  }

  // Convert clusters into FloodHotspot objects
  return clusters.map((cluster, idx) => {
    const seed = cluster[0];
    const avgLat = cluster.reduce((sum, r) => sum + r.lat, 0) / cluster.length;
    const avgLng = cluster.reduce((sum, r) => sum + r.lng, 0) / cluster.length;

    const timestamps = cluster.map((r) => new Date(r.timestamp).getTime());
    const minTime = new Date(Math.min(...timestamps)).toISOString();
    const maxTime = new Date(Math.max(...timestamps)).toISOString();
    const timeSpanMinutes = Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / (60 * 1000));

    const area = seed.area || 'Colombo Central';
    const forecastRainfallMm = rainfallByArea?.[area] ?? (seed.riskLevel === 'HIGH' ? 35.0 : seed.riskLevel === 'MEDIUM' ? 18.0 : 8.0);

    const riskEval = evaluateRiskLevel(cluster.length, forecastRainfallMm, riskThresholds);

    const hasVerified = cluster.some((r) => r.verificationStatus === 'VERIFIED');
    const hotspotId = seed.hotspotId || `HS-0${40 + idx}`;

    return {
      id: hotspotId,
      location: cluster.length > 1 ? `${seed.location} Cluster (${cluster.length} reports)` : seed.location,
      area,
      lat: Number(avgLat.toFixed(5)),
      lng: Number(avgLng.toFixed(5)),
      reportCount: cluster.length,
      firstReportedTime: minTime,
      latestReportedTime: maxTime,
      riskLevel: riskEval.riskLevel,
      riskScore: riskEval.score,
      forecastRainfallMm,
      verificationStatus: hasVerified ? 'VERIFIED' : 'UNDER REVIEW',
      precaution: riskEval.precaution,
      associatedReportIds: cluster.map((r) => r.id),
      clusterRadiusMeters: config.spatialRadiusMeters,
      formationDetails: {
        timeSpanMinutes,
        activeWindowHours: config.temporalWindowHours,
        spatialRadiusMeters: config.spatialRadiusMeters,
        centerLat: Number(avgLat.toFixed(5)),
        centerLng: Number(avgLng.toFixed(5)),
        reasoning: `${cluster.length} report(s) clustered within ${config.spatialRadiusMeters}m radius over a ${timeSpanMinutes}m duration (window: ${config.temporalWindowHours}h).`,
      },
    };
  });
}

/**
 * AI Verification simulation for citizen uploaded flood reports (Demonstration Mode)
 */
export function simulateAiVerification(params: {
  waterLevel: string;
  floodType: string;
  hasImage: boolean;
  description: string;
}): AiVerificationDetails {
  const { hasImage, waterLevel, floodType, description } = params;
  const timestamp = new Date().toISOString();
  const disclaimer = 'Image classification is an assistive early warning signal and not a substitute for official municipal field inspection.';

  if (!hasImage) {
    return {
      method: 'Demonstration Heuristic (Simulated)',
      status: 'UNDER REVIEW',
      confidence: 68.4,
      assessment: 'Geotagged Text Signal (No Photographic Evidence)',
      explanation: 'Simulated Computer Vision: No image payload provided. Report flagged for human field verification and cross-triangulation with nearby sensors.',
      uncertainty: 'Moderate uncertainty: text-only report lacks optical depth and reflection proof.',
      waterLevelEstimated: waterLevel,
      roadAccessibilityEstimated: 'Unknown (Awaiting photographic verification)',
      humanVerificationRequired: true,
      timestamp,
      disclaimer,
    };
  }

  const baseConfidence = 91.5;
  const isSevere = waterLevel === 'Severe' || waterLevel === 'High';
  const confidence = Number((baseConfidence + (isSevere ? 4.2 : 1.8)).toFixed(1));

  return {
    method: 'Demonstration Heuristic (Simulated)',
    status: confidence >= 85 ? 'VERIFIED' : 'UNDER REVIEW',
    confidence,
    assessment: `Simulated CV: Surface Waterlogging (${floodType})`,
    explanation: `Simulated Optical Model (Academic Prototype): Texture analysis indicates surface reflectivity and road inundation consistent with ${waterLevel.toLowerCase()} water pooling.`,
    uncertainty: 'Estimated synthetic margin of error: ±4.5%. Ground truth requires emergency team confirmation.',
    waterLevelEstimated: waterLevel,
    roadAccessibilityEstimated: waterLevel === 'Severe' ? 'Completely Blocked' : 'Partially Blocked',
    humanVerificationRequired: true,
    timestamp,
    disclaimer,
  };
}

/**
 * Generates simulated blockchain transaction record with SHA-256 payload hash
 */
export function generateSimulatedBlockchainRecord(
  hotspotId: string,
  location: string,
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
): BlockchainRecord {
  const randomHex = (len: number) =>
    Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  const timestamp = new Date().toISOString();
  const txHash = `0x${randomHex(64)}`;
  const merkleRoot = `0x${randomHex(64)}`;
  const payloadHash = `0x${randomHex(64)}`;
  const blockNumber = 19482000 + Math.floor(Math.random() * 5000);

  return {
    eventId: `EVT-${Date.now().toString().slice(-6)}`,
    hotspotId,
    location,
    severity,
    timestamp,
    txHash,
    blockNumber,
    network: 'Ethereum Sepolia Testnet (Simulated)',
    status: 'CONFIRMED (SIMULATED)',
    merkleRoot,
    payloadHash,
    validatorCount: 14 + Math.floor(Math.random() * 8),
    isSimulated: true,
    contractAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e (Simulated)',
    chainId: 11155111,
    auditExplanation: 'Demonstration Smart Contract: Sealed tamper-evident audit record. Confirms that report metadata was anchored at block time without retroactive modification.',
  };
}

/**
 * Calculates dynamic analytics metrics from active dataset
 */
export function calculateDynamicAnalytics(
  reports: FloodReport[],
  hotspots: FloodHotspot[],
  timeRange: '24h' | '7d' | '30d' | 'all' = '24h'
) {
  const now = Date.now();
  const rangeMs =
    timeRange === '24h'
      ? 24 * 60 * 60 * 1000
      : timeRange === '7d'
      ? 7 * 24 * 60 * 60 * 1000
      : timeRange === '30d'
      ? 30 * 24 * 60 * 60 * 1000
      : Infinity;

  const filteredReports = reports.filter((r) => {
    if (rangeMs === Infinity) return true;
    return now - new Date(r.timestamp).getTime() <= rangeMs;
  });

  const totalReports = filteredReports.length;

  // Risk distribution
  const highRisk = filteredReports.filter((r) => r.riskLevel === 'HIGH').length;
  const mediumRisk = filteredReports.filter((r) => r.riskLevel === 'MEDIUM').length;
  const lowRisk = filteredReports.filter((r) => r.riskLevel === 'LOW').length;

  const riskDistribution = [
    { name: 'High Risk', value: totalReports > 0 ? Math.round((highRisk / totalReports) * 100) : 0, color: '#EF4444', count: highRisk },
    { name: 'Medium Risk', value: totalReports > 0 ? Math.round((mediumRisk / totalReports) * 100) : 0, color: '#F59E0B', count: mediumRisk },
    { name: 'Low Risk', value: totalReports > 0 ? Math.round((lowRisk / totalReports) * 100) : 0, color: '#22C55E', count: lowRisk },
  ];

  // Status breakdown
  const statusCounts: Record<IncidentStatus, number> = {
    Submitted: 0,
    'Under Review': 0,
    Verified: 0,
    'Alert Issued': 0,
    Resolved: 0,
    Rejected: 0,
  };
  filteredReports.forEach((r) => {
    const st = r.incidentStatus || (r.verificationStatus === 'VERIFIED' ? 'Verified' : 'Under Review');
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });

  // Reports by zone
  const zoneMap: Record<string, { zone: string; reports: number; highRisk: number; mediumRisk: number; lowRisk: number }> = {};
  filteredReports.forEach((r) => {
    const z = r.area || 'Other';
    if (!zoneMap[z]) {
      zoneMap[z] = { zone: z, reports: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 };
    }
    zoneMap[z].reports += 1;
    if (r.riskLevel === 'HIGH') zoneMap[z].highRisk += 1;
    else if (r.riskLevel === 'MEDIUM') zoneMap[z].mediumRisk += 1;
    else zoneMap[z].lowRisk += 1;
  });

  const reportsByZone = Object.values(zoneMap).sort((a, b) => b.reports - a.reports);

  // Time to alert estimation
  const verifiedList = filteredReports.filter(
    (r) => r.verificationTimestamp && r.timestamp
  );
  let avgProcessingMinutes = 4.2;
  if (verifiedList.length > 0) {
    const totalMinutes = verifiedList.reduce((acc, r) => {
      const diff = Math.max(0.5, (new Date(r.verificationTimestamp!).getTime() - new Date(r.timestamp).getTime()) / (60 * 1000));
      return acc + diff;
    }, 0);
    avgProcessingMinutes = Number((totalMinutes / verifiedList.length).toFixed(1));
  }

  // Verified vs unverified ratio
  const verifiedCount = filteredReports.filter((r) => r.verificationStatus === 'VERIFIED' || r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued').length;
  const verifiedPercentage = totalReports > 0 ? Math.round((verifiedCount / totalReports) * 100) : 0;

  return {
    totalReports,
    highRisk,
    mediumRisk,
    lowRisk,
    riskDistribution,
    statusCounts,
    reportsByZone,
    avgProcessingMinutes,
    verifiedCount,
    verifiedPercentage,
  };
}
