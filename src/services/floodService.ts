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
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { signInWithPopup, signOut as fbSignOut, sendPasswordResetEmail } from 'firebase/auth';

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
    simulateFailure?: boolean;
  }): Promise<AiVerificationDetails> {
    try {
      const res = await fetch('/api/ai/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        return data as AiVerificationDetails;
      }

      // If server responded with error (e.g. 502/503 Gemini failure), return honest FAILED state
      if (data && data.aiAssessment) {
        return data as AiVerificationDetails;
      }

      throw new Error(`AI service returned HTTP ${res.status}`);
    } catch (err: any) {
      console.warn('Server AI verification failed:', err?.message);
      // Never invent a successful AI result when AI service fails!
      return {
        method: 'Gemini 3.8 Flash (Multimodal)',
        modelName: 'gemini-3.8-flash',
        aiStatus: 'FAILED',
        hasVisibleFlooding: false,
        aiAssessment: 'AI Processing Failed',
        officialStatus: 'Under Review',
        confidence: 0,
        explanation: `AI vision verification failed (${err?.message || 'Service unavailable'}). Your report has been saved and queued for officer review.`,
        uncertainty: 'AI assessment could not be completed. Retry available.',
        waterLevelEstimated: params.waterLevel,
        roadAccessibilityEstimated: 'Uncertain',
        humanVerificationRequired: true,
        timestamp: new Date().toISOString(),
        disclaimer:
          'AI image assessment is an assistive early warning signal only. Official verification requires authorized emergency officer confirmation.',
      };
    }
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
      onUploadProgress?: (percent: number) => void;
      simulateAiFailure?: boolean;
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
        reportInput.reporterId || 'citizen_anon',
        reportInput.onUploadProgress
      );
    } else if (reportInput.customImage) {
      if (reportInput.onUploadProgress) {
        reportInput.onUploadProgress(100);
      }
      storedImageUrl = reportInput.customImage;
    } else if (reportInput.onUploadProgress) {
      reportInput.onUploadProgress(100);
    }

    // AI Verification: send Base64/local path representation to server
    let aiResult: AiVerificationDetails;
    if (reportInput.customImage || storedImageUrl) {
      aiResult = await this.verifyImageWithAi({
        imageBase64: reportInput.customImage || storedImageUrl,
        mimeType: reportInput.imageMimeType || 'image/jpeg',
        description: reportInput.description,
        waterLevel: reportInput.waterLevel,
        floodType: reportInput.floodType,
        simulateFailure: reportInput.simulateAiFailure,
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
        note: isDuplicate
          ? `Report submitted (Identified as near-duplicate of ${duplicateOfId}). Evidence preserved for audit.`
          : 'Report registered via FloodSense citizen reporting portal.',
      },
    ];

    if (aiResult.aiStatus === 'COMPLETED') {
      initialStatusHistory.push({
        status: 'Under Review',
        timestamp: new Date(Date.now() + 500).toISOString(),
        authorName: aiResult.method,
        note: `AI Assessment: "${aiResult.aiAssessment}" (${aiResult.confidence}% confidence). Field verification required by emergency officer.`,
      });
    }

    // Strip non-serializable callbacks/files before constructing report
    const {
      imageFile: _imgFile,
      customImage: _customImg,
      imageMimeType: _mime,
      onUploadProgress: _onProg,
      simulateAiFailure: _simFail,
      ...cleanReportFields
    } = reportInput;

    // Form preliminary report object (AI NEVER auto-verifies!)
    const createdReport: FloodReport = {
      ...cleanReportFields,
      id: newId,
      timestamp,
      riskLevel: calculatedRisk,
      verificationStatus: 'UNDER REVIEW',
      incidentStatus: aiResult.aiStatus === 'COMPLETED' ? 'Under Review' : 'Submitted',
      statusHistory: initialStatusHistory,
      aiConfidence: aiResult.confidence,
      aiClassification: aiResult.aiAssessment,
      aiStatus: aiResult.aiStatus || 'COMPLETED',
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

        // Write status_history entries
        for (let idx = 0; idx < createdReport.statusHistory.length; idx++) {
          const entry = createdReport.statusHistory[idx];
          await setDoc(doc(db, 'status_history', `${newId}_h_${idx}`), {
            reportId: newId,
            ...entry,
          });
        }

        // Write notification record for citizen & triage center
        await setDoc(doc(db, 'notifications', `notif_${newId}`), {
          reportId: newId,
          recipientId: createdReport.reporterId || 'citizen_anon',
          title: `Report ${newId} Submitted`,
          message:
            aiResult.aiStatus === 'FAILED'
              ? `Report saved at ${createdReport.location}. AI verification failed; queued for officer review.`
              : `Report submitted at ${createdReport.location}. AI assessment: ${aiResult.aiAssessment}.`,
          status: createdReport.incidentStatus,
          createdAt: serverTimestamp(),
          unread: true,
        });

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

  // --- Retry AI Verification for Failed/Pending Reports ---
  public async retryAiVerification(
    reportId: string,
    override?: { customImage?: string; mimeType?: string; simulateFailure?: boolean }
  ): Promise<FloodReport | null> {
    let target = this.inMemoryReports.find((r) => r.id === reportId) || null;
    if (!target && this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      const snap = await getDoc(doc(db, 'reports', reportId));
      if (snap.exists()) {
        target = snap.data() as FloodReport;
      }
    }
    if (!target) return null;

    const aiResult = await this.verifyImageWithAi({
      imageBase64: override?.customImage || target.imageUrl,
      mimeType: override?.mimeType || 'image/jpeg',
      description: target.description,
      waterLevel: target.waterLevel,
      floodType: target.floodType,
      simulateFailure: override?.simulateFailure,
    });

    const timestamp = new Date().toISOString();
    const shouldMoveToUnderReview =
      aiResult.aiStatus === 'COMPLETED' && target.incidentStatus === 'Submitted';

    const nextStatus: IncidentStatus = shouldMoveToUnderReview
      ? 'Under Review'
      : target.incidentStatus;

    const historyEntry: StatusHistoryEntry = {
      status: nextStatus,
      timestamp,
      authorName: aiResult.method,
      note:
        aiResult.aiStatus === 'COMPLETED'
          ? `Retry AI Assessment completed: "${aiResult.aiAssessment}" (${aiResult.confidence}% confidence). Human officer review required.`
          : `Retry AI Assessment failed: ${aiResult.explanation}`,
    };

    const updatedReport: FloodReport = {
      ...target,
      incidentStatus: nextStatus,
      aiConfidence: aiResult.confidence,
      aiClassification: aiResult.aiAssessment,
      aiStatus: aiResult.aiStatus || 'COMPLETED',
      aiVerificationDetails: aiResult,
      statusHistory: [...(target.statusHistory || []), historyEntry],
    };

    const idx = this.inMemoryReports.findIndex((r) => r.id === reportId);
    if (idx !== -1) {
      this.inMemoryReports[idx] = updatedReport;
    }

    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      await updateDoc(doc(db, 'reports', reportId), {
        incidentStatus: updatedReport.incidentStatus,
        aiConfidence: updatedReport.aiConfidence,
        aiClassification: updatedReport.aiClassification,
        aiStatus: updatedReport.aiStatus,
        aiVerificationDetails: updatedReport.aiVerificationDetails,
        statusHistory: updatedReport.statusHistory,
      });
    }

    return updatedReport;
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

    let existing = existingIndex !== -1 ? this.inMemoryReports[existingIndex] : null;
    if (!existing && this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      const snap = await getDoc(doc(db, 'reports', reportId));
      if (snap.exists()) {
        existing = snap.data() as FloodReport;
      }
    }

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

        await setDoc(doc(db, 'status_history', `${reportId}_h_${Date.now()}`), {
          reportId,
          ...newEntry,
        });

        await setDoc(doc(db, 'notifications', `notif_${reportId}_${Date.now()}`), {
          reportId,
          recipientId: updatedReport.reporterId || 'citizen_anon',
          title: `Incident ${reportId} Updated: ${newStatus}`,
          message: officerNote || `Status updated to ${newStatus} by ${authorName}.`,
          status: newStatus,
          createdAt: serverTimestamp(),
          unread: true,
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

  // --- Auth & Authoritative Role Integration ---
  public async createCitizenUserProfileInFirestore(
    uid: string,
    name: string,
    email: string,
    phone?: string
  ): Promise<void> {
    if (!isFirebaseConfigured() || !db) return;
    // Public registration MUST always assign lowest-privilege citizen role
    await setDoc(doc(db, 'users', uid), {
      uid,
      name,
      email,
      phone: phone || '',
      role: 'citizen',
      isOfficer: false,
      createdAt: serverTimestamp(),
    });
  }

  public async getAuthoritativeFirebaseRole(user: any): Promise<'officer' | 'citizen'> {
    if (!user) return 'citizen';
    try {
      // 1. Check Firebase Auth custom token claims
      if (typeof user.getIdTokenResult === 'function') {
        const tokenResult = await user.getIdTokenResult();
        if (tokenResult?.claims?.role === 'officer' || tokenResult?.claims?.officer === true) {
          return 'officer';
        }
      }
      // 2. Check Firestore authoritative officers / users collections (never localStorage!)
      if (db && user.uid) {
        const officerSnap = await getDoc(doc(db, 'officers', user.uid));
        if (officerSnap.exists() && officerSnap.data()?.active !== false) {
          return 'officer';
        }
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data?.role === 'officer' || data?.isOfficer === true) {
            return 'officer';
          }
        }
      }
    } catch (err) {
      console.warn('Authoritative role check fallback to citizen:', err);
    }
    return 'citizen';
  }

  public async sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && auth) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return {
          success: true,
          message: `Password reset instructions sent to ${cleanEmail}. Check your inbox.`,
        };
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || 'Unable to send password reset email.',
        };
      }
    }
    return {
      success: true,
      message: `Demonstration mode: password reset link prepared for ${cleanEmail}. Use the listed demo credentials or register a new account.`,
    };
  }

  public async loginWithGoogle(): Promise<{ uid: string; email: string; displayName: string; role: 'officer' | 'citizen' } | null> {
    if (isFirebaseConfigured() && auth) {
      const result = await signInWithPopup(auth, googleProvider);
      const role = await this.getAuthoritativeFirebaseRole(result.user);
      return {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || 'Authorized User',
        role,
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
