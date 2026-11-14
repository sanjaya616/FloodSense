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
  GENESIS_PREV_HASH,
} from '../utils/floodLogic';
import {
  INITIAL_REPORTS,
  INITIAL_HOTSPOTS,
  INITIAL_BLOCKCHAIN_RECORDS,
  INITIAL_WEATHER_FORECAST,
} from '../data/demonstrationData';
import {
  db,
  auth,
  isFirebaseConfigured,
  googleProvider,
  uploadPhotographToStorage,
  deleteStoragePath,
} from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
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
  provider?: string;
  forecastAvailable?: boolean;
  forecastTimeRange?: string;
  rainfallUnit?: string;
  isLive: boolean;
  isUsingDemonstrationFallback?: boolean;
  status: string;
}

export interface ServiceState {
  isLoading: boolean;
  error: string | null;
  lastSyncTime: string | null;
  dataSource: DataSourceMode;
}

async function fileToBase64DataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file for AI verification'));
    reader.readAsDataURL(file);
  });
}

class FloodService {
  private mode: DataSourceMode = 'DEMO';
  private inMemoryReports: FloodReport[] = [...INITIAL_REPORTS];
  private inMemoryHotspots: FloodHotspot[] = [...INITIAL_HOTSPOTS];
  private inMemoryBlockchain: BlockchainRecord[] = [...INITIAL_BLOCKCHAIN_RECORDS];
  private clusteringConfig: ClusteringConfig = { ...DEFAULT_CLUSTERING_CONFIG };
  private riskThresholds: RiskThresholdConfig = { ...DEFAULT_RISK_THRESHOLDS };

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedMode = localStorage.getItem('floodsense_data_mode') as DataSourceMode;
      if (savedMode && (savedMode === 'DEMO' || savedMode === 'FIREBASE')) {
        this.mode = savedMode;
      }
      this.hydrateDemoCacheFromStorage();
    }
  }

  private hydrateDemoCacheFromStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const savedReports = localStorage.getItem('floodsense_reports_v2');
      if (savedReports) {
        const parsed = JSON.parse(savedReports);
        if (Array.isArray(parsed) && parsed.length > 0) this.inMemoryReports = parsed;
      }
      const savedHotspots = localStorage.getItem('floodsense_hotspots_v2');
      if (savedHotspots) {
        const parsed = JSON.parse(savedHotspots);
        if (Array.isArray(parsed) && parsed.length > 0) this.inMemoryHotspots = parsed;
      }
      const savedBlockchain = localStorage.getItem('floodsense_blockchain_v2');
      if (savedBlockchain) {
        const parsed = JSON.parse(savedBlockchain);
        if (Array.isArray(parsed) && parsed.length > 0) this.inMemoryBlockchain = parsed;
      }
    } catch {
      // Fall back to initial demonstration arrays
    }
  }

  public syncDemoReports(reports: FloodReport[]): void {
    if (Array.isArray(reports)) {
      this.inMemoryReports = [...reports];
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

  private async getBearerHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {}
    }
    return headers;
  }

  // --- Live Weather API ---
  public async fetchLiveWeather(lat?: number, lng?: number): Promise<WeatherData> {
    try {
      const qs =
        typeof lat === 'number' && typeof lng === 'number'
          ? `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
          : '';
      const res = await fetch(`/api/weather/colombo${qs}`);
      if (res.ok) {
        const data = await res.json();
        return {
          currentTempC: data.currentTempC ?? 28,
          condition: data.condition ?? 'Overcast',
          currentRainfallMm: data.currentRainfallMm ?? 0,
          expected3hRainfallMm: data.expected3hRainfallMm ?? 0,
          humidityPercent: data.humidityPercent ?? 85,
          windSpeedKmh: data.windSpeedKmh ?? 15,
          windDirection: data.windDirection ?? 'SW',
          updatedAt: data.updatedAt ?? 'Live (Asia/Colombo)',
          source: data.source ?? 'Open-Meteo Forecast API',
          provider: data.provider ?? data.source ?? 'Open-Meteo Forecast API',
          forecastAvailable: data.forecastAvailable ?? true,
          forecastTimeRange: data.forecastTimeRange ?? 'Asia/Colombo +3h',
          rainfallUnit: data.rainfallUnit ?? 'mm',
          isLive: !!data.isLive,
          isUsingDemonstrationFallback: Boolean(data.isUsingDemonstrationFallback ?? !data.isLive),
          status: data.status ?? 'Normal Conditions Monitoring',
        };
      }
    } catch (err) {
      console.warn('Weather API fetch failed, using fallback telemetry:', err);
    }
    return {
      ...INITIAL_WEATHER_FORECAST,
      provider: INITIAL_WEATHER_FORECAST.source,
      forecastAvailable: false,
      forecastTimeRange: 'Demonstration Snapshot',
      rainfallUnit: 'mm',
      isLive: false,
      isUsingDemonstrationFallback: true,
    };
  }

  // --- AI Image Verification (Calls server-side Gemini 4 Hydrogen) ---
  public async verifyImageWithAi(params: {
    imageBase64?: string;
    mimeType?: string;
    description: string;
    waterLevel: string;
    floodType: string;
  }): Promise<AiVerificationDetails> {
    if (!params.imageBase64 || !params.imageBase64.trim()) {
      return simulateAiVerification({
        waterLevel: params.waterLevel,
        floodType: params.floodType,
        hasImage: false,
        description: params.description,
      });
    }

    try {
      const headers = await this.getBearerHeaders();
      const res = await fetch('/api/ai/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: params.imageBase64,
          mimeType: params.mimeType,
          description: params.description,
          waterLevel: params.waterLevel,
          floodType: params.floodType,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        return data as AiVerificationDetails;
      }

      if (data && data.aiAssessment) {
        return data as AiVerificationDetails;
      }

      throw new Error(data?.error || `AI service returned HTTP ${res.status}`);
    } catch (err: any) {
      console.warn('Server AI verification failed:', err?.message);
      return {
        method: 'Gemini 4 Hydrogen (Multimodal)',
        modelName: 'gemini-4-hydrogen',
        aiStatus: 'FAILED',
        hasVisibleFlooding: false,
        aiAssessment: 'AI Processing Failed',
        officialStatus: 'Under Review',
        confidence: null,
        explanation: `AI vision verification failed (${err?.message || 'Service unavailable'}). Your report has been saved safely and queued for officer review.`,
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
        if (!auth?.currentUser) {
          // Public visitors read sanitized public_reports (zero PII)
          const pubQ = query(collection(db, 'public_reports'), orderBy('timestamp', 'desc'));
          const pubSnap = await getDocs(pubQ);
          return pubSnap.docs.map((docSnap) => docSnap.data() as FloodReport);
        }
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
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
    }
  ): Promise<{
    report: FloodReport;
    hotspot: FloodHotspot;
    blockchainRecord?: BlockchainRecord;
    isDuplicate?: boolean;
    duplicateOfId?: string;
  }> {
    if (!validateCoordinates(reportInput.lat, reportInput.lng)) {
      throw new Error(`Invalid GPS coordinates: lat=${reportInput.lat}, lng=${reportInput.lng}`);
    }

    const existingReports = this.mode === 'FIREBASE' ? await this.getReports() : this.inMemoryReports;

    // Idempotency guard against duplicate button clicks
    if (reportInput.submissionRequestId) {
      const prior = existingReports.find((r) => r.submissionRequestId === reportInput.submissionRequestId);
      if (prior) {
        const priorHotspot =
          this.inMemoryHotspots.find((h) => h.id === prior.hotspotId) ||
          clusterReports([prior], this.clusteringConfig, undefined, this.riskThresholds)[0];
        return {
          report: prior,
          hotspot: priorHotspot,
          isDuplicate: prior.isDuplicate,
          duplicateOfId: prior.duplicateOfReportId,
        };
      }
    }

    const timestamp = new Date().toISOString();
    const newId = generateReportId();
    const effectiveUid =
      this.mode === 'FIREBASE' && auth?.currentUser?.uid
        ? auth.currentUser.uid
        : reportInput.reporterId || 'citizen_demo_user';

    // Duplicate check within 25m and 5 minutes
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

    // Resolve Base64 image for AI BEFORE or alongside upload (never send download URL as base64)
    let aiImagePayload = reportInput.customImage;
    if (!aiImagePayload && reportInput.imageFile) {
      aiImagePayload = await fileToBase64DataUrl(reportInput.imageFile);
    }

    // Upload photograph to Firebase Storage if file provided in FIREBASE mode
    let storedImageUrl: string | undefined = reportInput.imageUrl;
    let uploadedStoragePath: string | null = null;
    if (reportInput.imageFile && this.mode === 'FIREBASE') {
      const uploaded = await uploadPhotographToStorage(
        reportInput.imageFile,
        effectiveUid,
        reportInput.onUploadProgress
      );
      storedImageUrl = uploaded.downloadUrl;
      uploadedStoragePath = uploaded.storagePath;
    } else if (reportInput.customImage) {
      if (reportInput.onUploadProgress) reportInput.onUploadProgress(100);
      storedImageUrl = reportInput.customImage;
    } else if (reportInput.onUploadProgress) {
      reportInput.onUploadProgress(100);
    }

    // AI verification (NOT_RUN if no photograph provided)
    let aiResult: AiVerificationDetails;
    if (aiImagePayload || (storedImageUrl && storedImageUrl.startsWith('/images/'))) {
      aiResult = await this.verifyImageWithAi({
        imageBase64: aiImagePayload || storedImageUrl,
        mimeType: reportInput.imageMimeType || reportInput.imageFile?.type || 'image/jpeg',
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
        note: isDuplicate
          ? `Report submitted (Identified as near-duplicate of ${duplicateOfId}). Evidence preserved for audit.`
          : 'Report registered via FloodSense citizen reporting portal.',
      },
    ];

    if (aiResult.aiStatus === 'COMPLETED' || aiResult.aiStatus === 'SIMULATED') {
      initialStatusHistory.push({
        status: 'Under Review',
        timestamp: new Date(Date.now() + 500).toISOString(),
        authorName: aiResult.method,
        note: `AI Assessment: "${aiResult.aiAssessment}" (${aiResult.confidence ?? 'N/A'}% confidence). Field verification required by emergency officer.`,
      });
    }

    const {
      imageFile: _imgFile,
      customImage: _customImg,
      imageMimeType: _mime,
      onUploadProgress: _onProg,
      ...cleanReportFields
    } = reportInput;

    const createdReport: FloodReport = {
      ...cleanReportFields,
      id: newId,
      reporterId: effectiveUid,
      timestamp,
      riskLevel: calculatedRisk,
      verificationStatus: 'UNDER REVIEW',
      incidentStatus:
        aiResult.aiStatus === 'COMPLETED' || aiResult.aiStatus === 'SIMULATED'
          ? 'Under Review'
          : 'Submitted',
      statusHistory: initialStatusHistory,
      aiConfidence: aiResult.confidence,
      aiClassification: aiResult.aiAssessment,
      aiStatus: aiResult.aiStatus || 'NOT_RUN',
      aiVerificationDetails: aiResult,
      imageUrl: storedImageUrl,
      isDuplicate,
      duplicateOfReportId: duplicateOfId,
    };

    // Recluster with real area/forecast rainfall (without inventing 20mm fallback)
    const allReportsForClustering = [createdReport, ...existingReports];
    const rainfallByArea: Record<string, number> = {};
    this.inMemoryHotspots.forEach((h) => {
      if (h.rainfallSource !== 'MISSING' && Number.isFinite(h.forecastRainfallMm)) {
        rainfallByArea[h.area] = h.forecastRainfallMm;
      }
    });

    const updatedHotspots = clusterReports(
      allReportsForClustering,
      this.clusteringConfig,
      rainfallByArea,
      this.riskThresholds
    );

    const matchedHotspot =
      updatedHotspots.find((h) => h.associatedReportIds.includes(newId)) ||
      clusterReports([createdReport], this.clusteringConfig, rainfallByArea, this.riskThresholds)[0];

    createdReport.hotspotId = matchedHotspot.id;

    // Anchor to prototype SHA-256 hash chain if high risk
    let createdBlockchainRecord: BlockchainRecord | undefined;
    if (matchedHotspot.riskLevel === 'HIGH') {
      const latestRecord = this.inMemoryBlockchain[0];
      createdBlockchainRecord = generateSimulatedBlockchainRecord(
        matchedHotspot.id,
        matchedHotspot.location,
        'HIGH',
        {
          prevHash: latestRecord?.recordHash || GENESIS_PREV_HASH,
          blockNumber: (latestRecord?.blockNumber || 0) + 1,
        }
      );
    }

    // Persist in-memory state when in DEMO mode (or update cache)
    this.inMemoryReports = [createdReport, ...this.inMemoryReports];
    this.inMemoryHotspots = updatedHotspots;
    if (createdBlockchainRecord) {
      this.inMemoryBlockchain = [createdBlockchainRecord, ...this.inMemoryBlockchain];
    }

    // Cloud Firestore persistence in FIREBASE mode
    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      try {
        const firestoreReportPayload: Record<string, any> = {
          ...createdReport,
          createdAt: serverTimestamp(),
        };
        delete firestoreReportPayload.imageFile;
        delete firestoreReportPayload.customImage;

        await setDoc(doc(db, 'reports', newId), firestoreReportPayload);

        for (let idx = 0; idx < createdReport.statusHistory.length; idx++) {
          const entry = createdReport.statusHistory[idx];
          await setDoc(doc(db, 'status_history', `${newId}_h_${idx}`), {
            reportId: newId,
            citizenUid: effectiveUid,
            ...entry,
          });
        }

        await setDoc(doc(db, 'notifications', `notif_${newId}`), {
          reportId: newId,
          recipientUid: effectiveUid,
          title: `Report ${newId} Submitted`,
          description:
            aiResult.aiStatus === 'FAILED'
              ? `Report saved at ${createdReport.location}. AI verification failed; queued for officer review.`
              : aiResult.aiStatus === 'NOT_RUN'
              ? `Text report saved at ${createdReport.location}. Queued for manual officer inspection.`
              : `Report submitted at ${createdReport.location}. AI assessment: ${aiResult.aiAssessment}.`,
          status: createdReport.incidentStatus,
          severity: createdReport.riskLevel,
          type: 'NEW_REPORT',
          location: createdReport.location,
          createdAt: serverTimestamp(),
          unread: true,
        });

        // Trusted backend sync for public_reports, hotspots, and audit trail
        try {
          const headers = await this.getBearerHeaders();
          const syncRes = await fetch('/api/reports/public-sync', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              report: createdReport,
              hotspot: matchedHotspot,
              blockchainRecord: createdBlockchainRecord,
            }),
          });
          if (!syncRes.ok && syncRes.status !== 501) {
            console.warn('Backend public-sync returned non-OK status:', syncRes.status);
          }
        } catch (syncErr) {
          console.warn('Backend public-sync unavailable:', syncErr);
        }
      } catch (err: any) {
        // Clean up orphaned Storage upload on Firestore failure
        await deleteStoragePath(uploadedStoragePath);
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

  // --- Retry AI Verification ---
  public async retryAiVerification(
    reportId: string,
    override?: { customImage?: string; mimeType?: string }
  ): Promise<FloodReport | null> {
    if (this.mode === 'DEMO') {
      this.hydrateDemoCacheFromStorage();
    }
    let target = this.inMemoryReports.find((r) => r.id === reportId) || null;
    if (!target && this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      const snap = await getDoc(doc(db, 'reports', reportId));
      if (snap.exists()) {
        target = snap.data() as FloodReport;
      }
    }
    if (!target) return null;

    const imageInput = override?.customImage || target.imageUrl;
    const aiResult = await this.verifyImageWithAi({
      imageBase64: imageInput,
      mimeType: override?.mimeType || 'image/jpeg',
      description: target.description,
      waterLevel: target.waterLevel,
      floodType: target.floodType,
    });

    const timestamp = new Date().toISOString();
    const shouldMoveToUnderReview =
      (aiResult.aiStatus === 'COMPLETED' || aiResult.aiStatus === 'SIMULATED') &&
      target.incidentStatus === 'Submitted';

    const nextStatus: IncidentStatus = shouldMoveToUnderReview
      ? 'Under Review'
      : target.incidentStatus;

    const historyEntry: StatusHistoryEntry = {
      status: nextStatus,
      timestamp,
      authorName: aiResult.method,
      note:
        aiResult.aiStatus === 'COMPLETED' || aiResult.aiStatus === 'SIMULATED'
          ? `Retry AI Assessment completed: "${aiResult.aiAssessment}" (${aiResult.confidence ?? 'N/A'}% confidence). Human officer review required.`
          : `Retry AI Assessment did not run/failed: ${aiResult.explanation}`,
    };

    const updatedReport: FloodReport = {
      ...target,
      incidentStatus: nextStatus,
      aiConfidence: aiResult.confidence,
      aiClassification: aiResult.aiAssessment,
      aiStatus: aiResult.aiStatus || 'FAILED',
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
    if (this.mode === 'DEMO') {
      this.hydrateDemoCacheFromStorage();
    }
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
          citizenUid: updatedReport.reporterId || '',
          ...newEntry,
        });

        await setDoc(doc(db, 'notifications', `notif_${reportId}_${Date.now()}`), {
          reportId,
          recipientUid: updatedReport.reporterId || '',
          title: `Incident ${reportId} Updated: ${newStatus}`,
          description: officerNote || `Status updated to ${newStatus} by ${authorName}.`,
          status: newStatus,
          severity: newStatus === 'Alert Issued' ? 'HIGH' : 'MEDIUM',
          type: 'OFFICER_UPDATE',
          location: updatedReport.location || '',
          createdAt: serverTimestamp(),
          unread: true,
        });

        await updateDoc(doc(db, 'public_reports', reportId), {
          incidentStatus: updatedReport.incidentStatus,
          verificationStatus: updatedReport.verificationStatus,
        }).catch(() => {});
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

  public async persistHotspots(hotspots: FloodHotspot[]): Promise<void> {
    this.inMemoryHotspots = [...hotspots];
    if (this.mode === 'FIREBASE' && isFirebaseConfigured() && db) {
      for (const h of hotspots) {
        await setDoc(doc(db, 'hotspots', h.id), h, { merge: true }).catch(() => {});
      }
    }
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
    const targetCol = auth?.currentUser ? 'reports' : 'public_reports';
    const q = query(collection(db, targetCol), orderBy('timestamp', 'desc'));
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

  public subscribeToNotifications(
    uid: string,
    isOfficer: boolean,
    onUpdate: (items: any[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe | null {
    if (this.mode !== 'FIREBASE' || !isFirebaseConfigured() || !db || !uid) return null;
    const q = isOfficer
      ? query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))
      : query(
          collection(db, 'notifications'),
          where('recipientUid', '==', uid),
          orderBy('createdAt', 'desc')
        );
    return onSnapshot(
      q,
      (snapshot) => {
        onUpdate(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => onError(err)
    );
  }

  public async markNotificationReadInFirestore(notificationId: string): Promise<void> {
    if (this.mode !== 'FIREBASE' || !isFirebaseConfigured() || !db) return;
    await updateDoc(doc(db, 'notifications', notificationId), { unread: false }).catch(() => {});
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
    await setDoc(doc(db, 'users', uid), {
      uid,
      displayName: name,
      name,
      email,
      phone: phone || '',
      role: 'citizen',
      isOfficer: false,
      createdAt: serverTimestamp(),
    });
  }

  public async updateUserProfileInFirestore(
    uid: string,
    updates: { name?: string; phone?: string; department?: string; emergencySector?: string }
  ): Promise<void> {
    if (this.mode !== 'FIREBASE' || !isFirebaseConfigured() || !db || !uid) return;
    await updateDoc(doc(db, 'users', uid), {
      ...(updates.name ? { displayName: updates.name, name: updates.name } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
      ...(updates.department !== undefined ? { department: updates.department } : {}),
      ...(updates.emergencySector !== undefined ? { emergencySector: updates.emergencySector } : {}),
    });
  }

  public async getAuthoritativeFirebaseRole(user: any): Promise<'officer' | 'citizen'> {
    if (!user) return 'citizen';
    try {
      if (typeof user.getIdTokenResult === 'function') {
        const tokenResult = await user.getIdTokenResult();
        if (tokenResult?.claims?.role === 'officer' || tokenResult?.claims?.officer === true || tokenResult?.claims?.role === 'admin') {
          return 'officer';
        }
      }
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
