/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  FloodReport,
  FloodHotspot,
  BlockchainRecord,
  getWaterLevelSeverity,
  simulateAiVerification,
  evaluateRiskLevel,
  generateSimulatedBlockchainRecord,
  IncidentStatus,
  ClusteringConfig,
  DEFAULT_CLUSTERING_CONFIG,
  RiskThresholdConfig,
  DEFAULT_RISK_THRESHOLDS,
  calculateDynamicAnalytics,
  clusterReports,
} from '../utils/floodLogic';
import {
  INITIAL_REPORTS,
  INITIAL_HOTSPOTS,
  INITIAL_BLOCKCHAIN_RECORDS,
  INITIAL_WEATHER_FORECAST,
} from '../data/demonstrationData';
import { FLOOD_IMAGES } from '../assets/images';
import { floodService, DataSourceMode, WeatherData } from '../services/floodService';
import { isFirebaseConfigured, testFirestoreConnection, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface UserProfile {
  name: string;
  roleName: string;
  department: string;
  email: string;
  phone: string;
  avatarUrl: string;
  emergencySector: string;
  isFirebaseUser?: boolean;
}

export type NotificationType =
  | 'NEW_REPORT'
  | 'NEW_HOTSPOT'
  | 'HIGH_RISK_ALERT'
  | 'WEATHER_WARNING'
  | 'OFFICER_UPDATE'
  | 'INCIDENT_RESOLVED'
  | 'BLOCKCHAIN';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  location?: string;
  time: string;
  unread: boolean;
  type: NotificationType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  deliveryChannel: 'in-app' | 'simulated-sms' | 'push';
}

export interface DbOperationStatus {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export interface FloodContextType {
  reports: FloodReport[];
  hotspots: FloodHotspot[];
  blockchainRecords: BlockchainRecord[];
  weather: WeatherData;
  refreshWeather: () => Promise<void>;
  role: 'officer' | 'citizen';
  setRole: (role: 'officer' | 'citizen') => void;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  selectedHotspotId: string | null;
  setSelectedHotspotId: (id: string | null) => void;
  selectedReportId: string | null;
  setSelectedReportId: (id: string | null) => void;
  notifications: NotificationItem[];
  markAllNotificationsAsRead: () => void;
  markNotificationAsRead: (id: string) => void;
  addNotification: (n: Omit<NotificationItem, 'id' | 'time' | 'unread'>) => void;
  addReport: (
    newReportData: Omit<
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
  ) => Promise<{
    report: FloodReport;
    hotspot: FloodHotspot;
    blockchainRecord?: BlockchainRecord;
    isDuplicate?: boolean;
    duplicateOfId?: string;
  }>;
  updateIncidentStatus: (
    reportId: string,
    newStatus: IncidentStatus,
    officerNote?: string
  ) => Promise<FloodReport | null>;
  resetDemonstrationData: (options?: { resetSettings?: boolean }) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  // Configurable rules
  clusteringConfig: ClusteringConfig;
  setClusteringConfig: React.Dispatch<React.SetStateAction<ClusteringConfig>>;
  riskThresholds: RiskThresholdConfig;
  setRiskThresholds: React.Dispatch<React.SetStateAction<RiskThresholdConfig>>;
  reclusterAllReports: () => void;
  // Analytics helper
  getAnalytics: (timeRange: '24h' | '7d' | '30d' | 'all') => ReturnType<typeof calculateDynamicAnalytics>;
  // Firebase & Service Layer
  dataSourceMode: DataSourceMode;
  setDataSourceMode: (mode: DataSourceMode) => void;
  isFirebaseAvailable: boolean;
  dbOperationStatus: DbOperationStatus;
  loginWithGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  checkFirebaseConnection: () => Promise<boolean>;
}

const FloodContext = createContext<FloodContextType | undefined>(undefined);

const STORAGE_KEY_REPORTS = 'floodsense_reports_v2';
const STORAGE_KEY_HOTSPOTS = 'floodsense_hotspots_v2';
const STORAGE_KEY_BLOCKCHAIN = 'floodsense_blockchain_v2';
const STORAGE_KEY_ROLE = 'floodsense_role_v2';
const STORAGE_KEY_PROFILE = 'floodsense_profile_v2';
const STORAGE_KEY_CLUSTERING = 'floodsense_clustering_v2';
const STORAGE_KEY_THRESHOLDS = 'floodsense_thresholds_v2';

export const FloodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataSourceMode, setDataSourceModeState] = useState<DataSourceMode>(() => floodService.getMode());
  const [isFirebaseAvailable] = useState<boolean>(isFirebaseConfigured());

  const [clusteringConfig, setClusteringConfig] = useState<ClusteringConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLUSTERING);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CLUSTERING_CONFIG;
  });

  const [riskThresholds, setRiskThresholds] = useState<RiskThresholdConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THRESHOLDS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_RISK_THRESHOLDS;
  });

  const [dbOperationStatus, setDbOperationStatus] = useState<DbOperationStatus>({
    loading: false,
    error: null,
    success: null,
  });

  const [reports, setReports] = useState<FloodReport[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REPORTS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_REPORTS;
  });

  const [hotspots, setHotspots] = useState<FloodHotspot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HOTSPOTS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_HOTSPOTS;
  });

  const [blockchainRecords, setBlockchainRecords] = useState<BlockchainRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BLOCKCHAIN);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_BLOCKCHAIN_RECORDS;
  });

  const [role, setRoleState] = useState<'officer' | 'citizen'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROLE);
      if (saved === 'officer' || saved === 'citizen') return saved;
    } catch {}
    return 'officer';
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: 'Kasun Pereira',
      roleName: 'Emergency Management Officer',
      department: 'Disaster Management Centre (DMC) - Western Province',
      email: 'k.pereira@dmc.gov.lk',
      phone: '+94 11 213 6136',
      avatarUrl: FLOOD_IMAGES.officerAvatar,
      emergencySector: 'Sector 04 — Colombo Municipal Basin',
    };
  });

  const [weather, setWeather] = useState<WeatherData>({
    ...INITIAL_WEATHER_FORECAST,
    isLive: false,
  });

  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'N-1',
      title: 'High Risk Alert: Maradana (HS-042)',
      description: '5 cumulative reports exceed warning threshold. Emergency sucker trucks deployed.',
      location: 'Maradana Junction',
      time: '5 mins ago',
      unread: true,
      type: 'HIGH_RISK_ALERT',
      severity: 'HIGH',
      deliveryChannel: 'in-app',
    },
    {
      id: 'N-2',
      title: 'Sepolia Block Anchored #EVT-892014',
      description: 'Dematagoda incident state sealed on simulated Sepolia testnet at block 19482145.',
      location: 'Dematagoda Baseline Road',
      time: '18 mins ago',
      unread: true,
      type: 'BLOCKCHAIN',
      severity: 'INFO',
      deliveryChannel: 'in-app',
    },
    {
      id: 'N-3',
      title: 'New Citizen Report from Kolonnawa',
      description: 'Report REP-109 submitted with geotagged photo. AI multimodal verification completed.',
      location: 'Kolonnawa Canal',
      time: '34 mins ago',
      unread: false,
      type: 'NEW_REPORT',
      severity: 'MEDIUM',
      deliveryChannel: 'in-app',
    },
    {
      id: 'N-4',
      title: 'Simulated SMS Field Dispatch: Kolonnawa Crew',
      description: 'Simulated SMS sent to DMC pumping brigade #2 for sluice gate inspection.',
      location: 'Kolonnawa Low-Lying Canal Basin',
      time: '45 mins ago',
      unread: false,
      type: 'OFFICER_UPDATE',
      severity: 'HIGH',
      deliveryChannel: 'simulated-sms',
    },
    {
      id: 'N-5',
      title: 'Open-Meteo Rainfall Telemetry (Colombo Basin)',
      description: 'Forecast model indicates convective rainfall activity across Western Basin.',
      location: 'Colombo Metro',
      time: '1 hour ago',
      unread: false,
      type: 'WEATHER_WARNING',
      severity: 'MEDIUM',
      deliveryChannel: 'push',
    },
  ]);

  // Monitor Firebase Authentication state
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserProfile((prev) => ({
            ...prev,
            name: user.displayName || prev.name,
            email: user.email || prev.email,
            avatarUrl: user.photoURL || prev.avatarUrl,
            isFirebaseUser: true,
          }));
        } else {
          setUserProfile((prev) => ({
            ...prev,
            isFirebaseUser: false,
          }));
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Synchronize with Firebase Firestore when in FIREBASE mode
  useEffect(() => {
    if (dataSourceMode === 'FIREBASE') {
      setDbOperationStatus({ loading: true, error: null, success: null });

      // Fetch initial cloud records
      Promise.all([
        floodService.getReports(),
        floodService.getHotspots(),
        floodService.getBlockchainRecords(),
      ])
        .then(([cloudReports, cloudHotspots, cloudBlockchain]) => {
          // If empty, display empty cloud dataset (do not overwrite with demo records)
          setReports(cloudReports);
          setHotspots(cloudHotspots);
          setBlockchainRecords(cloudBlockchain);
          setDbOperationStatus({
            loading: false,
            error: null,
            success: `Connected to Cloud Firestore. Loaded ${cloudReports.length} cloud reports.`,
          });
        })
        .catch((err) => {
          setDbOperationStatus({
            loading: false,
            error: `Failed to load Cloud Firestore data: ${err.message}`,
            success: null,
          });
        });

      // Subscribe to real-time changes
      const unsubReports = floodService.subscribeToReports(
        (updatedReports) => setReports(updatedReports),
        (err) => console.warn('Real-time reports listener error:', err.message)
      );

      const unsubHotspots = floodService.subscribeToHotspots(
        (updatedHotspots) => setHotspots(updatedHotspots),
        (err) => console.warn('Real-time hotspots listener error:', err.message)
      );

      return () => {
        if (unsubReports) unsubReports();
        if (unsubHotspots) unsubHotspots();
      };
    } else {
      // In DEMO mode, load cached demonstration records
      try {
        const savedReports = localStorage.getItem(STORAGE_KEY_REPORTS);
        setReports(savedReports ? JSON.parse(savedReports) : INITIAL_REPORTS);
        const savedHotspots = localStorage.getItem(STORAGE_KEY_HOTSPOTS);
        setHotspots(savedHotspots ? JSON.parse(savedHotspots) : INITIAL_HOTSPOTS);
        const savedBlockchain = localStorage.getItem(STORAGE_KEY_BLOCKCHAIN);
        setBlockchainRecords(savedBlockchain ? JSON.parse(savedBlockchain) : INITIAL_BLOCKCHAIN_RECORDS);
      } catch {
        setReports(INITIAL_REPORTS);
        setHotspots(INITIAL_HOTSPOTS);
        setBlockchainRecords(INITIAL_BLOCKCHAIN_RECORDS);
      }
    }
  }, [dataSourceMode]);

  // Load live weather on mount & poll every 60s
  const refreshWeather = useCallback(async () => {
    const live = await floodService.fetchLiveWeather();
    setWeather(live);
  }, []);

  useEffect(() => {
    refreshWeather();
    const interval = setInterval(refreshWeather, 60000);
    return () => clearInterval(interval);
  }, [refreshWeather]);

  // Persist demo state to localStorage when in DEMO mode
  useEffect(() => {
    if (dataSourceMode === 'DEMO') {
      try {
        localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reports));
      } catch {}
    }
  }, [reports, dataSourceMode]);

  useEffect(() => {
    if (dataSourceMode === 'DEMO') {
      try {
        localStorage.setItem(STORAGE_KEY_HOTSPOTS, JSON.stringify(hotspots));
      } catch {}
    }
  }, [hotspots, dataSourceMode]);

  useEffect(() => {
    if (dataSourceMode === 'DEMO') {
      try {
        localStorage.setItem(STORAGE_KEY_BLOCKCHAIN, JSON.stringify(blockchainRecords));
      } catch {}
    }
  }, [blockchainRecords, dataSourceMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(userProfile));
    } catch {}
  }, [userProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLUSTERING, JSON.stringify(clusteringConfig));
    } catch {}
    floodService.setClusteringConfig(clusteringConfig);
  }, [clusteringConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THRESHOLDS, JSON.stringify(riskThresholds));
    } catch {}
    floodService.setRiskThresholds(riskThresholds);
  }, [riskThresholds]);

  const setRole = (newRole: 'officer' | 'citizen') => {
    setRoleState(newRole);
    try {
      localStorage.setItem(STORAGE_KEY_ROLE, newRole);
    } catch {}
  };

  const setDataSourceMode = (mode: DataSourceMode) => {
    setDataSourceModeState(mode);
    floodService.setMode(mode);
    setDbOperationStatus({
      loading: false,
      error: null,
      success: `Switched data provider to ${mode === 'FIREBASE' ? 'Cloud Firestore' : 'Demonstration Local Data'}.`,
    });
    setTimeout(() => {
      setDbOperationStatus((prev) => ({ ...prev, success: null }));
    }, 4000);
  };

  const reclusterAllReports = useCallback(() => {
    const rainfallByArea: Record<string, number> = {};
    hotspots.forEach((h) => {
      rainfallByArea[h.area] = h.forecastRainfallMm;
    });

    const newHotspots = clusterReports(reports, clusteringConfig, rainfallByArea, riskThresholds);
    setHotspots(newHotspots);
  }, [reports, clusteringConfig, riskThresholds, hotspots]);

  const getAnalytics = useCallback(
    (timeRange: '24h' | '7d' | '30d' | 'all') => {
      return calculateDynamicAnalytics(reports, hotspots, timeRange);
    },
    [reports, hotspots]
  );

  const checkFirebaseConnection = async (): Promise<boolean> => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    try {
      const ok = await testFirestoreConnection();
      if (ok) {
        setDbOperationStatus({
          loading: false,
          error: null,
          success: 'Connected to Cloud Firestore successfully.',
        });
      } else {
        setDbOperationStatus({
          loading: false,
          error: 'Could not establish connection to Firestore server. Verify project configuration and rules.',
          success: null,
        });
      }
      return ok;
    } catch (err: any) {
      setDbOperationStatus({
        loading: false,
        error: err?.message || 'Firestore connection probe failed.',
        success: null,
      });
      return false;
    }
  };

  const loginWithGoogle = async () => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    try {
      const user = await floodService.loginWithGoogle();
      if (user) {
        setUserProfile((prev) => ({
          ...prev,
          name: user.displayName,
          email: user.email,
          isFirebaseUser: true,
        }));
        setDbOperationStatus({
          loading: false,
          error: null,
          success: `Signed in as ${user.displayName} via Google Firebase Auth.`,
        });
      }
    } catch (err: any) {
      setDbOperationStatus({
        loading: false,
        error: err?.message || 'Google authentication error.',
        success: null,
      });
    }
  };

  const logoutGoogle = async () => {
    await floodService.logout();
    setUserProfile((prev) => ({
      ...prev,
      isFirebaseUser: false,
    }));
    setDbOperationStatus({
      loading: false,
      error: null,
      success: 'Signed out of Firebase account.',
    });
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const addNotification = (n: Omit<NotificationItem, 'id' | 'time' | 'unread'>) => {
    const newItem: NotificationItem = {
      ...n,
      id: `NOTIF-${Date.now()}`,
      time: 'Just now',
      unread: true,
    };
    setNotifications((prev) => [newItem, ...prev]);
  };

  const addReport = async (
    newReportData: Omit<
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
  ) => {
    setDbOperationStatus({ loading: true, error: null, success: null });

    try {
      const result = await floodService.submitReport(newReportData);

      setReports((prev) => [result.report, ...prev]);

      // Update hotspots in state
      setHotspots((prev) => {
        const existing = prev.find((h) => h.id === result.hotspot.id);
        if (existing) {
          return prev.map((h) => (h.id === result.hotspot.id ? result.hotspot : h));
        }
        return [result.hotspot, ...prev];
      });

      if (result.blockchainRecord) {
        setBlockchainRecords((prev) => [result.blockchainRecord!, ...prev]);
        addNotification({
          title: `Smart Contract Anchor #EVT-${result.blockchainRecord.eventId}`,
          description: `High-risk incident sealed into simulated Sepolia testnet at block ${result.blockchainRecord.blockNumber}.`,
          location: result.hotspot.location,
          type: 'BLOCKCHAIN',
          severity: 'HIGH',
          deliveryChannel: 'in-app',
        });
      }

      addNotification({
        title: result.isDuplicate
          ? `Duplicate Report Recorded: ${result.report.id} (${result.report.area})`
          : `New Report: ${result.report.id} (${result.report.area})`,
        description: result.isDuplicate
          ? `Report flagged as duplicate of ${result.duplicateOfId}. Evidence preserved for officer review.`
          : `${result.report.waterLevel} flood reported at ${result.report.location}. Method: ${result.report.aiVerificationDetails?.method || 'AI Early Verification'}.`,
        location: result.report.location,
        type: 'NEW_REPORT',
        severity: result.report.riskLevel,
        deliveryChannel: 'in-app',
      });

      setDbOperationStatus({
        loading: false,
        error: null,
        success: dataSourceMode === 'FIREBASE'
          ? `Report ${result.report.id} synchronized to Cloud Firestore.`
          : `Report ${result.report.id} registered in demonstration dataset.`,
      });

      return result;
    } catch (err: any) {
      setDbOperationStatus({
        loading: false,
        error: err?.message || 'Failed to submit report.',
        success: null,
      });
      throw err;
    }
  };

  const updateIncidentStatus = async (
    reportId: string,
    newStatus: IncidentStatus,
    officerNote?: string
  ): Promise<FloodReport | null> => {
    try {
      const updated = await floodService.updateIncidentStatus(
        reportId,
        newStatus,
        userProfile.name,
        officerNote
      );

      if (updated) {
        setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));

        addNotification({
          title: `Incident ${reportId} Updated to "${newStatus}"`,
          description: officerNote ? `Officer note: ${officerNote}` : `Status modified by ${userProfile.name}.`,
          location: updated.location,
          type: newStatus === 'Resolved' ? 'INCIDENT_RESOLVED' : 'OFFICER_UPDATE',
          severity: newStatus === 'Alert Issued' ? 'HIGH' : 'MEDIUM',
          deliveryChannel: 'in-app',
        });
      }

      return updated;
    } catch (err: any) {
      setDbOperationStatus({
        loading: false,
        error: err?.message || 'Failed to update status in cloud database.',
        success: null,
      });
      throw err;
    }
  };

  const resetDemonstrationData = (options?: { resetSettings?: boolean }) => {
    floodService.resetDemonstrationData(options);
    setReports(INITIAL_REPORTS);
    setHotspots(INITIAL_HOTSPOTS);
    setBlockchainRecords(INITIAL_BLOCKCHAIN_RECORDS);
    if (options?.resetSettings) {
      setClusteringConfig(DEFAULT_CLUSTERING_CONFIG);
      setRiskThresholds(DEFAULT_RISK_THRESHOLDS);
    }
  };

  return (
    <FloodContext.Provider
      value={{
        reports,
        hotspots,
        blockchainRecords,
        weather,
        refreshWeather,
        role,
        setRole,
        userProfile,
        setUserProfile,
        selectedHotspotId,
        setSelectedHotspotId,
        selectedReportId,
        setSelectedReportId,
        notifications,
        markAllNotificationsAsRead,
        markNotificationAsRead,
        addNotification,
        addReport,
        updateIncidentStatus,
        resetDemonstrationData,
        searchQuery,
        setSearchQuery,
        clusteringConfig,
        setClusteringConfig,
        riskThresholds,
        setRiskThresholds,
        reclusterAllReports,
        getAnalytics,
        dataSourceMode,
        setDataSourceMode,
        isFirebaseAvailable,
        dbOperationStatus,
        loginWithGoogle,
        logoutGoogle,
        checkFirebaseConnection,
      }}
    >
      {children}
    </FloodContext.Provider>
  );
};

export const useFlood = () => {
  const context = useContext(FloodContext);
  if (!context) {
    throw new Error('useFlood must be used within a FloodProvider');
  }
  return context;
};
