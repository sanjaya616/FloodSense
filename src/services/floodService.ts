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
  expected3hRainfallMm: number | null;
  humidityPercent: number;
  windSpeedKmh: number;
  windDirection: string;
  updatedAt: string;
  source: string;
  provider?: string;
  forecastAvailable?: boolean;
  forecastCompleteness?: 'COMPLETE' | 'INCOMPLETE' | 'UNAVAILABLE';
  forecastTimeRange?: string;
  rainfallUnit?: string;
  isLive: boolean;
  isUsingDemonstrationFallback?: boolean;
  cached?: boolean;
  fetchedAt?: string | null;
  cacheExpiresAt?: string | null;
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
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('floodsense_data_mode', mode);
    }
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
          expected3hRainfallMm:
            typeof data.expected3hRainfallMm === 'number' && Number.isFinite(data.expected3hRainfallMm)
              ? data.expected3hRainfallMm
              : null,
          humidityPercent: data.humidityPercent ?? 85,
          windSpeedKmh: data.windSpeedKmh ?? 15,
          windDirection: data.windDirection ?? 'SW',
          updatedAt: data.updatedAt ?? 'Live (Asia/Colombo)',
          source: data.source ?? 'Open-Meteo Forecast API',
          provider: data.provider ?? data.source ?? 'Open-Meteo Forecast API',
          forecastAvailable: Boolean(data.forecastAvailable),
          forecastCompleteness: data.forecastCompleteness ?? (data.forecastAvailable ? 'COMPLETE' : 'UNAVAILABLE'),
          forecastTimeRange: data.forecastTimeRange ?? 'Asia/Colombo +3h',
          rainfallUnit: data.rainfallUnit ?? 'mm',
          isLive: !!data.isLive,
          isUsingDemonstrationFallback: Boolean(data.isUsingDemonstrationFallback ?? !data.isLive),
          cached: Boolean(data.cached),
          fetchedAt: data.fetchedAt ?? null,
          cacheExpiresAt: data.cacheExpiresAt ?? null,
          status: data.status ?? 'Normal Conditions Monitoring',
        };
      }
    } catch (err) {
      console.warn('Weather API fetch failed, using fallback telemetry:', err);
    }
    return {
      ...INITIAL_WEATHER_FORECAST,
      expected3hRainfallMm: null,
      provider: INITIAL_WEATHER_FORECAST.source,
      forecastAvailable: false,
      forecastCompleteness: 'UNAVAILABLE',
      forecastTimeRange: 'Demonstration Snapshot (Live Feed Unavailable)',
      rainfallUnit: 'mm',
      isLive: false,
      isUsingDemonstrationFallback: true,
      cached: false,
      fetchedAt: null,
      cacheExpiresAt: null,
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
  public async getReports(options?: { role?: 'officer' | 'citizen'; uid?: string }): Promise<FloodReport[]> {
    if (this.mode === 'FIREBASE') {
      if (!isFirebaseConfigured() || !db) {
        throw new Error('Firebase Firestore is not configured in this environment.');
      }
      const activeUid = options?.uid || auth?.currentUser?.uid;
      if (!activeUid) {
        // Signed-out/public visitors read sanitized public_reports (zero PII)
        const pubQ = query(collection(db, 'public_reports'), orderBy('timestamp', 'desc'));
        const pubSnap = await getDocs(pubQ);
        return pubSnap.docs.map((docSnap) => docSnap.data() as FloodReport);
      }

      const resolvedRole =
        options?.role || (await this.getAuthoritativeFirebaseRole(auth?.currentUser));

      if (resolvedRole === 'officer') {
        const officerQ = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(officerQ);
        return snapshot.docs.map((docSnap) => docSnap.data() as FloodReport);
      }

      // Citizens query strictly their own reports in /reports + public_reports separately
      const citizenOwnQ = query(
        collection(db, 'reports'),
        where('reporterId', '==', activeUid),
        orderBy('timestamp', 'desc')
      );
      const [ownSnap, pubSnap] = await Promise.all([
        getDocs(citizenOwnQ),
        getDocs(query(collection(db, 'public_reports'), orderBy('timestamp', 'desc'))),
      ]);
      const merged = new Map<string, FloodReport>();
      pubSnap.docs.forEach((docSnap) => {
        const d = docSnap.data() as FloodReport;
        if (d.id) merged.set(d.id, d);
      });
      ownSnap.docs.forEach((docSnap) => {
        const d = docSnap.data() as FloodReport;
        if (d.id) merged.set(d.id, d);
      });
      return Array.from(merged.values()).sort(
        (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
      );
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

    // Duplicate check within 25m and 5 minutes (local/own reports + citywide Admin check in Firebase mode)
    let duplicateOfId: string | undefined;
    let isDuplicate = existingReports.some((existing) => {
      const match = areReportsDuplicate(existing, {
        lat: reportInput.lat,
        lng: reportInput.lng,
        timestamp,
      });
      if (match) duplicateOfId = existing.id;
      return match;
    });

    if (!isDuplicate && this.mode === 'FIREBASE') {
      try {
        const headers = await this.getBearerHeaders();
        const dupRes = await fetch('/api/reports/check-duplicate', {
          method: 'POST',
          headers,
          body: JSON.stringify({ lat: reportInput.lat, lng: reportInput.lng, timestamp }),
        });
        if (dupRes.ok) {
          const dupJson = await dupRes.json();
          if (dupJson.isDuplicate && dupJson.duplicateOfId) {
            isDuplicate = true;
            duplicateOfId = dupJson.duplicateOfId;
          }
        }
      } catch {
        // Server public-sync will also authoritatively check duplicates across all users
      }
    }

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
      ...(uploadedStoragePath ? { storagePath: uploadedStoragePath } : {}),
      publicSyncStatus: this.mode === 'FIREBASE' ? 'PENDING' : 'SYNCED',
      isDuplicate,
      duplicateOfReportId: duplicateOfId,
    };

    // Recluster using live forecast when available or honest area rainfall without stale/synthetic values
    const allReportsForClustering = [createdReport, ...existingReports];
    const rainfallByArea: Record<string, number> = {};
    this.inMemoryHotspots.forEach((h) => {
      if (h.rainfallSource !== 'MISSING' && Number.isFinite(h.forecastRainfallMm)) {
        rainfallByArea[h.area] = h.forecastRainfallMm;
      }
    });
    if (this.mode === 'FIREBASE') {
      try {
        const liveWeather = await this.fetchLiveWeather(reportInput.lat, reportInput.lng);
        if (
          liveWeather.isLive &&
          liveWeather.forecastAvailable &&
          typeof liveWeather.expected3hRainfallMm === 'number' &&
          Number.isFinite(liveWeather.expected3hRainfallMm)
        ) {
          rainfallByArea['__default'] = liveWeather.expected3hRainfallMm;
        }
      } catch {
        // Proceed honestly with MISSING rainfall source if weather fetch fails
      }
    }

    const updatedHotspots = clusterReports(
      allReportsForClustering,
      this.clusteringConfig,
      rainfallByArea,
      this.riskThresholds
    );

    let matchedHotspot =
      updatedHotspots.find((h) => h.associatedReportIds.includes(newId)) ||
      clusterReports([createdReport], this.clusteringConfig, rainfallByArea, this.riskThresholds)[0];

    createdReport.hotspotId = matchedHotspot.id;

    // Anchor to prototype SHA-256 hash chain if high risk (DEMO mode or local chain)
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

        // Trusted server-side public_reports + hotspot sync (ignores client risk/hotspot overrides)
        try {
          const headers = await this.getBearerHeaders();
          const syncRes = await fetch('/api/reports/public-sync', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              reportId: newId,
              submissionRequestId: reportInput.submissionRequestId,
            }),
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            createdReport.publicSyncStatus = 'SYNCED';
            if (syncData?.hotspot?.id) {
              matchedHotspot = syncData.hotspot as FloodHotspot;
              createdReport.hotspotId = matchedHotspot.id;
            }
            if (typeof syncData?.isDuplicate === 'boolean') {
              createdReport.isDuplicate = syncData.isDuplicate;
              createdReport.duplicateOfReportId = syncData.duplicateOfReportId || undefined;
            }
          } else {
            const errJson = await syncRes.json().catch(() => null);
            createdReport.publicSyncStatus = 'FAILED';
            createdReport.publicSyncError =
              errJson?.message || errJson?.error || `Server sync returned HTTP ${syncRes.status}`;
          }
        } catch (syncErr: any) {
          createdReport.publicSyncStatus = 'FAILED';
          createdReport.publicSyncError = syncErr?.message || 'Public map sync request failed.';
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
      isDuplicate: createdReport.isDuplicate,
      duplicateOfId: createdReport.duplicateOfReportId,
    };
  }

  // --- Retry Public Map Sync (Firebase Admin) ---
  public async retryPublicSync(reportId: string): Promise<{
    ok: boolean;
    report?: FloodReport;
    hotspot?: FloodHotspot;
    error?: string;
  }> {
    if (this.mode !== 'FIREBASE') {
      return { ok: true };
    }
    try {
      const headers = await this.getBearerHeaders();
      const syncRes = await fetch('/api/reports/public-sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reportId }),
      });
      const data = await syncRes.json().catch(() => null);
      if (!syncRes.ok) {
        const errorMsg = data?.message || data?.error || `Public sync failed (HTTP ${syncRes.status})`;
        return { ok: false, error: errorMsg };
      }
      const existing = this.inMemoryReports.find((r) => r.id === reportId);
      const updatedReport: FloodReport | undefined = existing
        ? {
            ...existing,
            publicSyncStatus: 'SYNCED',
            publicSyncError: undefined,
            hotspotId: data?.hotspot?.id || existing.hotspotId,
            isDuplicate: typeof data?.isDuplicate === 'boolean' ? data.isDuplicate : existing.isDuplicate,
            duplicateOfReportId: data?.duplicateOfReportId ?? existing.duplicateOfReportId,
          }
        : undefined;
      if (updatedReport) {
        this.inMemoryReports = this.inMemoryReports.map((r) => (r.id === reportId ? updatedReport : r));
      }
      return {
        ok: true,
        report: updatedReport,
        hotspot: data?.hotspot as FloodHotspot | undefined,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to contact server public sync endpoint.' };
    }
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
    onError: (error: Error) => void,
    options?: { role?: 'officer' | 'citizen'; uid?: string }
  ): Unsubscribe | null {
    if (this.mode !== 'FIREBASE' || !isFirebaseConfigured() || !db) return null;
    const activeUid = options?.uid || auth?.currentUser?.uid;
    if (!activeUid) {
      const pubQ = query(collection(db, 'public_reports'), orderBy('timestamp', 'desc'));
      return onSnapshot(
        pubQ,
        (snapshot) => {
          onUpdate(snapshot.docs.map((d) => d.data() as FloodReport));
        },
        (err) => onError(err)
      );
    }

    const q =
      options?.role === 'officer'
        ? query(collection(db, 'reports'), orderBy('timestamp', 'desc'))
        : query(
            collection(db, 'reports'),
            where('reporterId', '==', activeUid),
            orderBy('timestamp', 'desc')
          );

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

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('floodsense_reports_v2');
      window.localStorage.removeItem('floodsense_hotspots_v2');
      window.localStorage.removeItem('floodsense_blockchain_v2');
    }

    if (options?.resetSettings) {
      this.clusteringConfig = { ...DEFAULT_CLUSTERING_CONFIG };
      this.riskThresholds = { ...DEFAULT_RISK_THRESHOLDS };
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('floodsense_clustering_v2');
        window.localStorage.removeItem('floodsense_thresholds_v2');
      }
    }
  }

  // --- Auth & Authoritative Role Integration ---
  public formatFirebaseAuthError(err: any): string {
    const code = String(err?.code || '');
    switch (code) {
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). Enable Email/Password there or use Google Sign-In.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please verify your credentials and try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many failed authentication attempts. Please wait a few minutes and try again.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Google sign-in popup was closed before completing authentication.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
      case 'auth/network-request-failed':
        return 'Network error contacting Firebase Authentication. Check your connection and retry.';
      default:
        return err?.message || 'Authentication failed. Please try again.';
    }
  }

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
    updates: {
      name?: string;
      phone?: string;
      department?: string;
      emergencySector?: string;
      avatarUrl?: string;
    } & Record<string, any>
  ): Promise<void> {
    if (this.mode !== 'FIREBASE' && !isFirebaseConfigured()) return;
    if (!isFirebaseConfigured() || !db || !uid) {
      throw new Error('Firebase Firestore user profile storage is not configured.');
    }

    const forbiddenKeys = [
      'role',
      'isOfficer',
      'officer',
      'admin',
      'isAdmin',
      'claims',
      'customClaims',
      'permissions',
      'uid',
      'email',
    ];
    for (const key of forbiddenKeys) {
      if (key in updates && updates[key] !== undefined) {
        throw new Error(`Forbidden: "${key}" cannot be modified via profile updates.`);
      }
    }

    const sanitizedPayload: Record<string, any> = {};
    if (typeof updates.name === 'string' && updates.name.trim()) {
      const trimmed = updates.name.trim().slice(0, 120);
      sanitizedPayload.displayName = trimmed;
      sanitizedPayload.name = trimmed;
    }
    if (updates.phone !== undefined) {
      sanitizedPayload.phone = String(updates.phone).trim().slice(0, 40);
    }
    if (updates.department !== undefined) {
      sanitizedPayload.department = String(updates.department).trim().slice(0, 120);
    }
    if (updates.emergencySector !== undefined) {
      sanitizedPayload.emergencySector = String(updates.emergencySector).trim().slice(0, 120);
    }
    if (typeof updates.avatarUrl === 'string' && updates.avatarUrl.trim()) {
      sanitizedPayload.avatarUrl = updates.avatarUrl.trim().slice(0, 500);
    }

    if (Object.keys(sanitizedPayload).length === 0) return;

    await updateDoc(doc(db, 'users', uid), sanitizedPayload);
  }

  public async getAuthoritativeFirebaseRole(user: any, forceRefresh = true): Promise<'officer' | 'citizen'> {
    if (!user) return 'citizen';
    try {
      if (typeof user.getIdTokenResult === 'function') {
        const tokenResult = await user.getIdTokenResult(forceRefresh);
        if (tokenResult?.claims?.role === 'officer' || tokenResult?.claims?.officer === true) {
          return 'officer';
        }
      }
      if (db && user.uid) {
        const officerSnap = await getDoc(doc(db, 'officers', user.uid));
        if (officerSnap.exists() && officerSnap.data()?.active !== false) {
          return 'officer';
        }
      }
    } catch (err) {
      console.warn('Authoritative role check fallback to citizen:', err);
    }
    return 'citizen';
  }

  /**
   * Verifies a signed-in Firebase user against the backend Express / Firebase Admin endpoint.
   * Never trusts client-side role state; sends a freshly minted Firebase ID token.
   */
  public async verifyOfficerWithBackend(user: any): Promise<{
    authorized: boolean;
    role: 'officer' | 'citizen';
    verificationSource?: string;
    error?: string;
    status: number;
  }> {
    if (!user || typeof user.getIdToken !== 'function') {
      return {
        authorized: false,
        role: 'citizen',
        status: 401,
        error: 'Authentication session missing. Please sign in with Firebase Authentication.',
      };
    }

    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch('/api/auth/verify-officer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.authorized === true && data?.role === 'officer') {
        return {
          authorized: true,
          role: 'officer',
          verificationSource: data.verificationSource,
          status: res.status,
        };
      }
      return {
        authorized: false,
        role: 'citizen',
        status: res.status,
        error:
          data?.error ||
          'Access denied: this account is not pre-authorized as an Emergency Officer.',
      };
    } catch (err: any) {
      return {
        authorized: false,
        role: 'citizen',
        status: 500,
        error: err?.message || 'Unable to verify Emergency Officer credentials with backend.',
      };
    }
  }

  public async fetchVerifiedSessionRole(user: any): Promise<'officer' | 'citizen'> {
    if (!user || typeof user.getIdToken !== 'function') return 'citizen';
    try {
      const idToken = await user.getIdToken(false);
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.authenticated && data?.role === 'officer') {
          return 'officer';
        }
        return 'citizen';
      }
    } catch {
      // Network fallback to client token claims check
    }
    return this.getAuthoritativeFirebaseRole(user, false);
  }

  public async sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (isFirebaseConfigured() && auth) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return {
          success: true,
          message: `Password reset instructions sent to ${cleanEmail}. Check your inbox.`,
        };
      } catch (err: any) {
        return {
          success: false,
          message: this.formatFirebaseAuthError(err),
        };
      }
    }
    return {
      success: true,
      message: `Demonstration mode: password reset link prepared for ${cleanEmail}. Use the listed demo credentials or register a new account.`,
    };
  }

  public async loginWithGoogle(): Promise<{
    uid: string;
    email: string;
    displayName: string;
    role: 'officer' | 'citizen';
    fbUser: any;
  } | null> {
    if (isFirebaseConfigured() && auth) {
      const result = await signInWithPopup(auth, googleProvider);
      const role = await this.fetchVerifiedSessionRole(result.user);
      return {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || 'Authorized User',
        role,
        fbUser: result.user,
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
