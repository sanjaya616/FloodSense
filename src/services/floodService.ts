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
  generateReportId,
} from '../utils/floodLogic';
import {
  INITIAL_REPORTS,
  INITIAL_HOTSPOTS,
  INITIAL_BLOCKCHAIN_RECORDS,
  INITIAL_WEATHER_FORECAST,
} from '../data/demonstrationData';
import { db, auth, isFirebaseConfigured, googleProvider, uploadPhotographToStorage } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
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
          updatedAt: data.updatedAt ?? 'Live (Asia/Colombo)',
          source: data.source ?? 'Open-Meteo Forecast API',
          isLive: !!data.isLive,
          status: data.status ?? 'Normal Conditions Monitoring',
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

  // --- AI Image Verification (Calls server-side Gemini 3.8 Flash) ---
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
    if (this.mode === 'FIREBASE') {
      if (isFirebaseConfigured() && db) {
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        // Important: If Firestore is empty, return empty cloud dataset. Do NOT replace with demo data.
        return snapshot.docs.map((docSnap) => docSnap.data() as FloodReport);
      }
      return [];
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
      | 'isDuplicate'
      | 'duplicateOfReportId'
    > & {
      imageFile?: File;
      customImage?: string;
      imageMimeType?: string;
    }
  ): Promise<{
    report: FloodReport;
    hotspot: FloodHotspot;
    blockchainRecord?: BlockchainRecord;
    isDuplicate?: boolean;
    duplicateOfId?: string;
  }> {
    const timestamp = new Date().toISOString();
    // Collision-resistant identifier
    const newId = generateReportId();

    // Validate coordinates
    if (!validateCoordinates(reportInput.lat, reportInput.lng)) {
      throw new Error(`Invalid GPS coordinates: lat=${reportInput.lat}, lng=${reportInput.lng}`);
    }

    // Check for potential duplicate reports within 25m and 5 minutes
    const existingReports = this.mode === 'FIREBASE' ? await this.getReports() : this.inMemoryReports;
    let duplicateOfId: string | undefined;
    const isDuplicate = existingReports.some((existing) => {
      const match = areReportsDuplicate(existing, {
        lat: reportInput.lat,
        lng: reportInput.lng,
        timestamp,
      });
      if (match) duplicateOfId = existing.id;
      return match;
    });

    // Image Upload to Firebase Storage if file provided and in Firebase mode
    let storedImageUrl: string | undefined = reportInput.imageUrl;
    if (reportInput.imageFile && this.mode === 'FIREBASE') {
      storedImageUrl = await uploadPhotographToStorage(
        reportInput.imageFile,
        reportInput.reporterId || 'citizen_anon'
      );
    } else if (reportInput.customImage) {
      storedImageUrl = reportInput.customImage;
    }

    // AI Verification: send Base64 representation to server
    let aiResult: AiVerificationDetails;
    if (reportInput.customImage) {
      aiResult = await this.verifyImageWithAi({
        imageBase64: reportInput.customImage,
        mimeType: reportInput.imageMimeType || 'image/jpeg',
        description: reportInput.description,
        waterLevel: reportInput.waterLevel,
        floodType: reportInput.floodType,
      });
    } else {
      aiResult = simulateAiVerification({
        waterLevel: reportInput.waterLevel,
        floodType: reportInput.floodType,
        hasImage: !!storedImageUrl,
        description: reportInput.description,
      });
    }

    const calculatedRisk = getWaterLevelSeverity(reportInput.waterLevel);

    const initialStatusHistory: StatusHistoryEntry[] = [
      {
        status: 'Submitted',
        timestamp,
        authorName: reportInput.reporterName || 'Citizen Contributor',
        note: isDuplicate
          ? `Report submitted (Identified as near-duplicate of ${duplicateOfId}). Evidence preserved for audit.`
          : 'Report registered via FloodSense citizen reporting portal.',
      },
    ];

    if (aiResult.confidence > 0) {
      initialStatusHistory.push({
        status: 'Under Review',
        timestamp: new Date(Date.now() + 500).toISOString(),
        authorName: aiResult.method,
        note: `AI Assessment: "${aiResult.aiAssessment}" (${aiResult.confidence}% confidence). Field verification required by emergency officer.`,
      });
    }

    // Form preliminary report object
    const createdReport: FloodReport = {
      ...reportInput,
      id: newId,
      timestamp,
      riskLevel: calculatedRisk,
      verificationStatus: 'UNDER REVIEW', // AI NEVER auto-verifies; requires human officer confirmation
      incidentStatus: 'Submitted',
      statusHistory: initialStatusHistory,
      aiConfidence: aiResult.confidence,
      aiClassification: aiResult.aiAssessment,
      aiVerificationDetails: aiResult,
      imageUrl: storedImageUrl,
      isDuplicate,
      duplicateOfReportId: duplicateOfId,
    };

    // Calculate updated clusters based on actual coordinates and temporal window
    const allReportsForClustering = [createdReport, ...existingReports];
    const rainfallByArea: Record<string, number> = {};
    this.inMemoryHotspots.forEach((h) => {
      rainfallByArea[h.area] = h.forecastRainfallMm;
    });

    const updatedHotspots = clusterReports(
      allReportsForClustering,
      this.clusteringConfig,
      rainfallByArea,
      this.riskThresholds
    );

    // Find the hotspot containing the newly created report
    let matchedHotspot = updatedHotspots.find((h) => h.associatedReportIds.includes(newId));
    if (!matchedHotspot) {
      const riskEval = evaluateRiskLevel(1, 20.0, this.riskThresholds);
      matchedHotspot = {
        id: `HS-0${50 + updatedHotspots.length}`,
        location: `${reportInput.location}`,
        area: reportInput.area,
        lat: reportInput.lat,
        lng: reportInput.lng,
        reportCount: 1,
        firstReportedTime: timestamp,
        latestReportedTime: timestamp,
        riskLevel: riskEval.riskLevel,
        riskScore: riskEval.score,
        forecastRainfallMm: 20.0,
        verificationStatus: 'UNDER REVIEW',
        precaution: riskEval.precaution,
        associatedReportIds: [newId],
        clusterRadiusMeters: this.clusteringConfig.spatialRadiusMeters,
      };
      updatedHotspots.unshift(matchedHotspot);
    }

    createdReport.hotspotId = matchedHotspot.id;

    // Generate blockchain audit record if high risk
    let createdBlockchainRecord: BlockchainRecord | undefined;
    if (matchedHotspot.riskLevel === 'HIGH') {
      createdBlockchainRecord = generateSimulatedBlockchainRecord(
        matchedHotspot.id,
        matchedHotspot.location,
        'HIGH'
      );
    }

    // Persist in-memory state
    this.inMemoryReports = [createdReport, ...this.inMemoryReports];
    this.inMemoryHotspots = updatedHotspots;
    if (createdBlockchainRecord) {
      this.inMemoryBlockchain = [createdBlockchainRecord, ...this.inMemoryBlockchain];
    }

    // If Firebase active, persist to Cloud Firestore (Without large base64 strings!)
    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      try {
        // Sanitize payload: never write base64 strings to Firestore
        const firestoreReportPayload = {
          ...createdReport,
          createdAt: serverTimestamp(),
        };
        // Clean out raw local file bytes if present
        delete (firestoreReportPayload as any).imageFile;
        delete (firestoreReportPayload as any).customImage;

        await setDoc(doc(db, 'reports', newId), firestoreReportPayload);

        // Also write public sanitized report (Zero PII)
        const publicReportPayload = {
          id: createdReport.id,
          location: createdReport.location,
          area: createdReport.area,
          lat: createdReport.lat,
          lng: createdReport.lng,
          waterLevel: createdReport.waterLevel,
          roadAccessibility: createdReport.roadAccessibility,
          floodType: createdReport.floodType,
          riskLevel: createdReport.riskLevel,
          incidentStatus: createdReport.incidentStatus,
          verificationStatus: createdReport.verificationStatus,
          timestamp: createdReport.timestamp,
          imageUrl: createdReport.imageUrl || '',
          description: createdReport.description,
          hotspotId: matchedHotspot.id,
        };
        await setDoc(doc(db, 'public_reports', newId), publicReportPayload);

        await setDoc(doc(db, 'hotspots', matchedHotspot.id), matchedHotspot);

        if (createdBlockchainRecord) {
          await setDoc(
            doc(db, 'blockchain_records', createdBlockchainRecord.eventId),
            createdBlockchainRecord
          );
        }
      } catch (err: any) {
        console.error('Firestore write failed:', err);
        throw new Error(`Cloud database write failed: ${err.message || 'Permission denied'}`);
      }
    }

    return {
      report: createdReport,
      hotspot: matchedHotspot,
      blockchainRecord: createdBlockchainRecord,
      isDuplicate,
      duplicateOfId,
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
    if (existingIndex === -1 && this.mode === 'DEMO') return null;

    const existing = existingIndex !== -1 ? this.inMemoryReports[existingIndex] : null;
    const newEntry: StatusHistoryEntry = {
      status: newStatus,
      timestamp,
      authorName,
      note: officerNote,
    };

    const isNowVerified = newStatus === 'Verified' || newStatus === 'Alert Issued' || newStatus === 'Resolved';
    const updatedReport: FloodReport = {
      ...(existing || ({} as FloodReport)),
      id: reportId,
      incidentStatus: newStatus,
      verificationStatus: isNowVerified ? 'VERIFIED' : newStatus === 'Rejected' ? 'REJECTED' : 'UNDER REVIEW',
      statusHistory: [...(existing?.statusHistory || []), newEntry],
      officerNotes: officerNote ? [...(existing?.officerNotes || []), officerNote] : existing?.officerNotes,
      verificationTimestamp: isNowVerified ? (existing?.verificationTimestamp || timestamp) : existing?.verificationTimestamp,
      verifiedBy: isNowVerified ? (existing?.verifiedBy || authorName) : existing?.verifiedBy,
    };

    if (existingIndex !== -1) {
      this.inMemoryReports[existingIndex] = updatedReport;
    }

    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      try {
        await updateDoc(doc(db, 'reports', reportId), {
          incidentStatus: updatedReport.incidentStatus,
          verificationStatus: updatedReport.verificationStatus,
          statusHistory: updatedReport.statusHistory,
          officerNotes: updatedReport.officerNotes || [],
          verificationTimestamp: updatedReport.verificationTimestamp || null,
          verifiedBy: updatedReport.verifiedBy || null,
        });

        // Also update public sanitized collection
        await updateDoc(doc(db, 'public_reports', reportId), {
          incidentStatus: updatedReport.incidentStatus,
          verificationStatus: updatedReport.verificationStatus,
        });
      } catch (err: any) {
        console.error('Firestore status update failed:', err);
        throw new Error(`Failed to update incident in Cloud Firestore: ${err.message}`);
      }
    }

    return updatedReport;
  }

  // --- Hotspots ---
  public async getHotspots(): Promise<FloodHotspot[]> {
    if (this.mode === 'FIREBASE') {
      if (isFirebaseConfigured() && db) {
        const snapshot = await getDocs(collection(db, 'hotspots'));
        return snapshot.docs.map((d) => d.data() as FloodHotspot);
      }
      return [];
    }
    return [...this.inMemoryHotspots];
  }

  // --- Blockchain Records ---
  public async getBlockchainRecords(): Promise<BlockchainRecord[]> {
    if (this.mode === 'FIREBASE') {
      if (isFirebaseConfigured() && db) {
        const snapshot = await getDocs(collection(db, 'blockchain_records'));
        return snapshot.docs.map((d) => d.data() as BlockchainRecord);
      }
      return [];
    }
    return [...this.inMemoryBlockchain];
  }

  // --- Real-Time Firestore Synchronization ---
  public subscribeToReports(
    onUpdate: (reports: FloodReport[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe | null {
    if (this.mode !== 'FIREBASE' || !isFirebaseConfigured() || !db) return null;
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as FloodReport);
        onUpdate(docs);
      },
      (err) => {
        onError(err);
      }
    );
  }

  public subscribeToHotspots(
    onUpdate: (hotspots: FloodHotspot[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe | null {
    if (this.mode !== 'FIREBASE' || !isFirebaseConfigured() || !db) return null;
    return onSnapshot(
      collection(db, 'hotspots'),
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as FloodHotspot);
        onUpdate(docs);
      },
      (err) => {
        onError(err);
      }
    );
  }

  // --- Data Reset (Demonstration Mode Only) ---
  public resetDemonstrationData(options?: { resetSettings?: boolean }): void {
    this.inMemoryReports = [...INITIAL_REPORTS];
    this.inMemoryHotspots = [...INITIAL_HOTSPOTS];
    this.inMemoryBlockchain = [...INITIAL_BLOCKCHAIN_RECORDS];

    localStorage.removeItem('floodsense_reports_v2');
    localStorage.removeItem('floodsense_hotspots_v2');
    localStorage.removeItem('floodsense_blockchain_v2');

    if (options?.resetSettings) {
      this.clusteringConfig = { ...DEFAULT_CLUSTERING_CONFIG };
      this.riskThresholds = { ...DEFAULT_RISK_THRESHOLDS };
      localStorage.removeItem('floodsense_clustering_v2');
      localStorage.removeItem('floodsense_thresholds_v2');
    }
  }

  // --- Auth Integration ---
  public async loginWithGoogle(): Promise<{ uid: string; email: string; displayName: string } | null> {
    if (isFirebaseConfigured() && auth) {
      const result = await signInWithPopup(auth, googleProvider);
      return {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || 'Authorized User',
      };
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
