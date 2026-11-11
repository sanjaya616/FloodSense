/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FloodReport,
  FloodHotspot,
  BlockchainRecord,
  simulateAiVerification,
  getWaterLevelSeverity,
  evaluateRiskLevel,
  generateSimulatedBlockchainRecord,
  clusterReports,
  ClusteringConfig,
  DEFAULT_CLUSTERING_CONFIG,
  RiskThresholdConfig,
  DEFAULT_RISK_THRESHOLDS,
  IncidentStatus,
  StatusHistoryEntry,
  AiVerificationDetails,
  areReportsDuplicate,
  validateCoordinates,
} from '../utils/floodLogic';
import {
  INITIAL_REPORTS,
  INITIAL_HOTSPOTS,
  INITIAL_BLOCKCHAIN_RECORDS,
  INITIAL_WEATHER_FORECAST,
} from '../data/demonstrationData';
import { db, auth, isFirebaseConfigured, googleProvider } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { signInWithPopup, signOut as fbSignOut } from 'firebase/auth';

export type DataSourceMode = 'DEMO' | 'FIREBASE';

export interface WeatherData {
  currentTempC: number;
  condition: string;
  currentRainfallMm: number;
  expected3hRainfallMm: number;
  humidityPercent: number;
  windSpeedKmh: number;
  windDirection: string;
  updatedAt: string;
  source: string;
  isLive: boolean;
  status: string;
}

export interface ServiceState {
  isLoading: boolean;
  error: string | null;
  lastSyncTime: string | null;
  dataSource: DataSourceMode;
}

class FloodService {
  private mode: DataSourceMode = 'DEMO';
  private inMemoryReports: FloodReport[] = [...INITIAL_REPORTS];
  private inMemoryHotspots: FloodHotspot[] = [...INITIAL_HOTSPOTS];
  private inMemoryBlockchain: BlockchainRecord[] = [...INITIAL_BLOCKCHAIN_RECORDS];
  private clusteringConfig: ClusteringConfig = { ...DEFAULT_CLUSTERING_CONFIG };
  private riskThresholds: RiskThresholdConfig = { ...DEFAULT_RISK_THRESHOLDS };

  constructor() {
    const savedMode = localStorage.getItem('floodsense_data_mode') as DataSourceMode;
    if (savedMode && (savedMode === 'DEMO' || savedMode === 'FIREBASE')) {
      this.mode = savedMode;
    }
  }

  public getMode(): DataSourceMode {
    return this.mode;
  }

  public setMode(mode: DataSourceMode): void {
    this.mode = mode;
    localStorage.setItem('floodsense_data_mode', mode);
  }

  public canUseFirebase(): boolean {
    return isFirebaseConfigured();
  }

  public setClusteringConfig(config: Partial<ClusteringConfig>): void {
    this.clusteringConfig = { ...this.clusteringConfig, ...config };
  }

  public getClusteringConfig(): ClusteringConfig {
    return { ...this.clusteringConfig };
  }

  public setRiskThresholds(thresholds: Partial<RiskThresholdConfig>): void {
    this.riskThresholds = { ...this.riskThresholds, ...thresholds };
  }

  public getRiskThresholds(): RiskThresholdConfig {
    return { ...this.riskThresholds };
  }

  // --- Live Weather API ---
  public async fetchLiveWeather(): Promise<WeatherData> {
    try {
      const res = await fetch('/api/weather/colombo');
      if (res.ok) {
        const data = await res.json();
        return {
          currentTempC: data.currentTempC ?? 28,
          condition: data.condition ?? 'Monsoonal Heavy Downpour',
          currentRainfallMm: data.currentRainfallMm ?? 34.5,
          expected3hRainfallMm: data.expected3hRainfallMm ?? 48.0,
          humidityPercent: data.humidityPercent ?? 92,
          windSpeedKmh: data.windSpeedKmh ?? 24,
          windDirection: data.windDirection ?? 'SW',
          updatedAt: data.updatedAt ?? 'Just now',
          source: data.source ?? 'Open-Meteo Doppler Feed',
          isLive: !!data.isLive,
          status: data.status ?? 'Department of Meteorology Advisory: High Runoff Alert',
        };
      }
    } catch (err) {
      console.warn('Weather API fetch failed, using fallback telemetry:', err);
    }
    return {
      ...INITIAL_WEATHER_FORECAST,
      isLive: false,
    };
  }

  // --- AI Image Verification (Calls /api/ai/verify with Gemini 3.8 Flash) ---
  public async verifyImageWithAi(params: {
    imageBase64?: string;
    mimeType?: string;
    description: string;
    waterLevel: string;
    floodType: string;
  }): Promise<AiVerificationDetails> {
    try {
      const res = await fetch('/api/ai/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        return data as AiVerificationDetails;
      }
    } catch (err) {
      console.warn('Server AI verification endpoint failed, using client fallback heuristic:', err);
    }

    return simulateAiVerification({
      waterLevel: params.waterLevel,
      floodType: params.floodType,
      hasImage: !!params.imageBase64,
      description: params.description,
    });
  }

  // --- Reports ---
  public async getReports(): Promise<FloodReport[]> {
    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      try {
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return snapshot.docs.map((docSnap) => docSnap.data() as FloodReport);
        }
      } catch (err: any) {
        console.warn('Firebase read error, falling back to cached demonstration records:', err);
      }
    }
    return [...this.inMemoryReports];
  }

  public async submitReport(
    reportInput: Omit<
      FloodReport,
      | 'id'
      | 'timestamp'
      | 'riskLevel'
      | 'verificationStatus'
      | 'incidentStatus'
      | 'statusHistory'
      | 'aiConfidence'
      | 'aiClassification'
      | 'aiVerificationDetails'
    > & {
      customImage?: string;
    }
  ): Promise<{ report: FloodReport; hotspot: FloodHotspot; blockchainRecord?: BlockchainRecord; isDuplicate?: boolean }> {
    const timestamp = new Date().toISOString();
    const newId = `REP-${Date.now().toString().slice(-4)}`;

    // Validate coordinates
    if (!validateCoordinates(reportInput.lat, reportInput.lng)) {
      throw new Error(`Invalid GPS coordinates: lat=${reportInput.lat}, lng=${reportInput.lng}`);
    }

    // Check for duplicates in recent reports
    const isDuplicate = this.inMemoryReports.some((existing) =>
      areReportsDuplicate(existing, {
        lat: reportInput.lat,
        lng: reportInput.lng,
        timestamp,
      })
    );

    // AI Verification
    let aiResult: AiVerificationDetails;
    if (reportInput.customImage || reportInput.imageUrl) {
      aiResult = await this.verifyImageWithAi({
        imageBase64: reportInput.customImage || reportInput.imageUrl,
        description: reportInput.description,
        waterLevel: reportInput.waterLevel,
        floodType: reportInput.floodType,
      });
    } else {
      aiResult = simulateAiVerification({
        waterLevel: reportInput.waterLevel,
        floodType: reportInput.floodType,
        hasImage: false,
        description: reportInput.description,
      });
    }

    const calculatedRisk = getWaterLevelSeverity(reportInput.waterLevel);

    const initialStatusHistory: StatusHistoryEntry[] = [
      {
        status: 'Submitted',
        timestamp,
        authorName: reportInput.reporterName || 'Citizen Contributor',
        note: 'Report submitted via FloodSense mobile/web reporting interface.',
      },
    ];

    if (aiResult.status === 'VERIFIED') {
      initialStatusHistory.push({
        status: 'Under Review',
        timestamp: new Date(Date.now() + 1000).toISOString(),
        authorName: aiResult.method,
        note: `Automated assessment: ${aiResult.assessment} (${aiResult.confidence}% confidence). Field verification recommended.`,
      });
    }

    // Hotspot assignment via Haversine clustering
    let matchedHotspot: FloodHotspot;
    const existing = this.inMemoryHotspots.find(
      (h) => h.area.toLowerCase() === reportInput.area.toLowerCase()
    );

    let createdBlockchainRecord: BlockchainRecord | undefined;

    if (existing) {
      const updatedCount = existing.reportCount + 1;
      const riskEval = evaluateRiskLevel(updatedCount, existing.forecastRainfallMm, this.riskThresholds);

      matchedHotspot = {
        ...existing,
        reportCount: updatedCount,
        latestReportedTime: timestamp,
        riskLevel: riskEval.riskLevel,
        riskScore: riskEval.score,
        precaution: riskEval.precaution,
        associatedReportIds: [newId, ...existing.associatedReportIds],
      };

      this.inMemoryHotspots = this.inMemoryHotspots.map((h) =>
        h.id === matchedHotspot.id ? matchedHotspot : h
      );

      if (riskEval.riskLevel === 'HIGH') {
        createdBlockchainRecord = generateSimulatedBlockchainRecord(
          matchedHotspot.id,
          matchedHotspot.location,
          'HIGH'
        );
        this.inMemoryBlockchain = [createdBlockchainRecord, ...this.inMemoryBlockchain];
      }
    } else {
      const newHotspotId = `HS-0${50 + this.inMemoryHotspots.length}`;
      const riskEval = evaluateRiskLevel(1, 20.0, this.riskThresholds);

      matchedHotspot = {
        id: newHotspotId,
        location: `${reportInput.location}, ${reportInput.area}`,
        area: reportInput.area,
        lat: reportInput.lat,
        lng: reportInput.lng,
        reportCount: 1,
        firstReportedTime: timestamp,
        latestReportedTime: timestamp,
        riskLevel: riskEval.riskLevel,
        riskScore: riskEval.score,
        forecastRainfallMm: 20.0,
        verificationStatus: aiResult.status === 'REJECTED' ? 'UNDER REVIEW' : aiResult.status,
        precaution: riskEval.precaution,
        associatedReportIds: [newId],
        clusterRadiusMeters: this.clusteringConfig.spatialRadiusMeters,
        formationDetails: {
          timeSpanMinutes: 0,
          activeWindowHours: this.clusteringConfig.temporalWindowHours,
          spatialRadiusMeters: this.clusteringConfig.spatialRadiusMeters,
          centerLat: reportInput.lat,
          centerLng: reportInput.lng,
          reasoning: 'Newly established cluster seed from verified citizen geotag.',
        },
      };

      this.inMemoryHotspots = [matchedHotspot, ...this.inMemoryHotspots];
    }

    const createdReport: FloodReport = {
      ...reportInput,
      id: newId,
      hotspotId: matchedHotspot.id,
      timestamp,
      riskLevel: calculatedRisk,
      verificationStatus: aiResult.status,
      incidentStatus: aiResult.status === 'VERIFIED' ? 'Under Review' : 'Submitted',
      statusHistory: initialStatusHistory,
      aiConfidence: aiResult.confidence,
      aiClassification: aiResult.assessment,
      aiVerificationDetails: aiResult,
      imageUrl: reportInput.customImage || reportInput.imageUrl,
    };

    this.inMemoryReports = [createdReport, ...this.inMemoryReports];

    // If Firebase active, persist to Firestore
    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, 'reports', newId), {
          ...createdReport,
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'hotspots', matchedHotspot.id), matchedHotspot);
        if (createdBlockchainRecord) {
          await setDoc(
            doc(db, 'blockchain_records', createdBlockchainRecord.eventId),
            createdBlockchainRecord
          );
        }
      } catch (err: any) {
        console.error('Firestore write error: ', err);
      }
    }

    return {
      report: createdReport,
      hotspot: matchedHotspot,
      blockchainRecord: createdBlockchainRecord,
      isDuplicate,
    };
  }

  // --- Incident Lifecycle Status Updates ---
  public async updateIncidentStatus(
    reportId: string,
    newStatus: IncidentStatus,
    authorName: string,
    officerNote?: string
  ): Promise<FloodReport | null> {
    const timestamp = new Date().toISOString();
    const existingIndex = this.inMemoryReports.findIndex((r) => r.id === reportId);
    if (existingIndex === -1) return null;

    const existing = this.inMemoryReports[existingIndex];
    const newEntry: StatusHistoryEntry = {
      status: newStatus,
      timestamp,
      authorName,
      note: officerNote,
    };

    const isNowVerified = newStatus === 'Verified' || newStatus === 'Alert Issued' || newStatus === 'Resolved';
    const updatedReport: FloodReport = {
      ...existing,
      incidentStatus: newStatus,
      verificationStatus: isNowVerified ? 'VERIFIED' : newStatus === 'Rejected' ? 'REJECTED' : 'UNDER REVIEW',
      statusHistory: [...(existing.statusHistory || []), newEntry],
      officerNotes: officerNote ? [...(existing.officerNotes || []), officerNote] : existing.officerNotes,
      verificationTimestamp: isNowVerified ? (existing.verificationTimestamp || timestamp) : existing.verificationTimestamp,
      verifiedBy: isNowVerified ? (existing.verifiedBy || authorName) : existing.verifiedBy,
    };

    this.inMemoryReports[existingIndex] = updatedReport;

    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'reports', reportId), {
          incidentStatus: updatedReport.incidentStatus,
          verificationStatus: updatedReport.verificationStatus,
          statusHistory: updatedReport.statusHistory,
          officerNotes: updatedReport.officerNotes,
          verificationTimestamp: updatedReport.verificationTimestamp,
          verifiedBy: updatedReport.verifiedBy,
        });
      } catch (err: any) {
        console.error('Firestore update error:', err);
      }
    }

    return updatedReport;
  }

  // --- Hotspots ---
  public async getHotspots(): Promise<FloodHotspot[]> {
    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      try {
        const snapshot = await getDocs(collection(db, 'hotspots'));
        if (!snapshot.empty) {
          return snapshot.docs.map((d) => d.data() as FloodHotspot);
        }
      } catch (err: any) {
        console.warn('Hotspot Firestore read error:', err);
      }
    }
    return [...this.inMemoryHotspots];
  }

  // --- Blockchain Records ---
  public async getBlockchainRecords(): Promise<BlockchainRecord[]> {
    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      try {
        const snapshot = await getDocs(collection(db, 'blockchain_records'));
        if (!snapshot.empty) {
          return snapshot.docs.map((d) => d.data() as BlockchainRecord);
        }
      } catch (err: any) {
        console.warn('Blockchain record Firestore read error:', err);
      }
    }
    return [...this.inMemoryBlockchain];
  }

  // --- Auth Integration ---
  public async loginWithGoogle(): Promise<{ uid: string; email: string; displayName: string } | null> {
    if (isFirebaseConfigured() && auth) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        return {
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || 'Emergency Officer',
        };
      } catch (err: any) {
        console.error('Google Sign-in failed:', err);
        throw err;
      }
    }
    return null;
  }

  public async logout(): Promise<void> {
    if (isFirebaseConfigured() && auth) {
      await fbSignOut(auth);
    }
  }
}

export const floodService = new FloodService();
