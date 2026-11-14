/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  FloodReport,
  FloodHotspot,
  BlockchainRecord,
  IncidentStatus,
  ClusteringConfig,
  DEFAULT_CLUSTERING_CONFIG,
  RiskThresholdConfig,
  DEFAULT_RISK_THRESHOLDS,
  calculateDynamicAnalytics,
  clusterReports,
  sha256Hex,
} from '../utils/floodLogic';
import {
  INITIAL_REPORTS,
  INITIAL_HOTSPOTS,
  INITIAL_BLOCKCHAIN_RECORDS,
  INITIAL_WEATHER_FORECAST,
} from '../data/demonstrationData';
import { FLOOD_IMAGES } from '../assets/images';
import { floodService, DataSourceMode, WeatherData } from '../services/floodService';
import { isFirebaseConfigured, testFirestoreConnection, auth, db } from '../services/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export interface UserProfile {
  name: string;
  roleName: string;
  department: string;
  email: string;
  phone: string;
  avatarUrl: string;
  emergencySector: string;
  isFirebaseUser?: boolean;
  uid?: string;
}

export const DEMO_OFFICER_PROFILE: UserProfile = {
  name: 'Kasun Pereira',
  roleName: 'Emergency Management Officer (Prototype)',
  department: 'Colombo Municipal Flood Operations (Academic Prototype)',
  email: 'officer@dmc.gov.lk',
  phone: '+94 11 213 6136',
  avatarUrl: FLOOD_IMAGES.officerAvatar,
  emergencySector: 'Sector 04 — Colombo Municipal Basin',
};

export const DEMO_CITIZEN_PROFILE: UserProfile = {
  name: 'Nimalka Senanayake',
  roleName: 'Citizen Reporter & Resident',
  department: 'Colombo Metro Community Sentinel',
  email: 'nimalka.senanayake@gmail.com',
  phone: '+94 77 123 4567',
  avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256',
  emergencySector: 'Sector 02 — Kolonnawa & Colombo 03',
};

export const DEMO_CREDENTIALS = {
  citizen: {
    email: 'nimalka.senanayake@gmail.com',
    password: 'Citizen@2026',
  },
  officer: {
    email: 'officer@dmc.gov.lk',
    password: 'Officer@2026',
  },
};

export type NotificationType =
  | 'NEW_REPORT'
  | 'NEW_HOTSPOT'
  | 'HIGH_RISK_ALERT'
  | 'WEATHER_WARNING'
  | 'OFFICER_UPDATE'
  | 'INCIDENT_RESOLVED'
  | 'AI_STATUS'
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
  reportId?: string;
  recipientUid?: string;
  recipientEmail?: string;
}

export interface DbOperationStatus {
  loading: boolean;
  error: string | null;
  success: string | null;
}

interface DemoAccountRecord {
  email: string;
  passwordHash: string;
  role: 'citizen' | 'officer';
  profile: UserProfile;
}

function hashDemoPassword(password: string): string {
  return sha256Hex(`floodsense-demo-salt-v1|${password}`);
}

export interface FloodContextType {
  reports: FloodReport[];
  myReports: FloodReport[];
  hotspots: FloodHotspot[];
  blockchainRecords: BlockchainRecord[];
  weather: WeatherData;
  refreshWeather: () => Promise<void>;
  role: 'officer' | 'citizen';
  setRole: (role: 'officer' | 'citizen') => void;
  authenticatedRole: 'officer' | 'citizen' | null;
  isAuthLoading: boolean;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  retryPublicSync: (reportId: string) => Promise<{ ok: boolean; error?: string }>;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  switchPersona: (persona: 'officer' | 'citizen') => void;
  loginWithEmail: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; role: 'officer' | 'citizen'; message?: string }>;
  loginWithOfficerEmail: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; role: 'officer' | 'citizen'; message?: string }>;
  loginWithOfficerGoogle: () => Promise<{ success: boolean; role: 'officer' | 'citizen'; message?: string }>;
  registerWithEmail: (
    name: string,
    email: string,
    password: string,
    phone?: string
  ) => Promise<{ success: boolean; message?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
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
      onUploadProgress?: (percent: number) => void;
    }
  ) => Promise<{
    report: FloodReport;
    hotspot: FloodHotspot;
    blockchainRecord?: BlockchainRecord;
    isDuplicate?: boolean;
    duplicateOfId?: string;
  }>;
  retryAiVerification: (
    reportId: string,
    override?: { customImage?: string; mimeType?: string }
  ) => Promise<FloodReport | null>;
  updateIncidentStatus: (
    reportId: string,
    newStatus: IncidentStatus,
    officerNote?: string
  ) => Promise<FloodReport | null>;
  resetDemonstrationData: (options?: { resetSettings?: boolean }) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  clusteringConfig: ClusteringConfig;
  setClusteringConfig: React.Dispatch<React.SetStateAction<ClusteringConfig>>;
  riskThresholds: RiskThresholdConfig;
  setRiskThresholds: React.Dispatch<React.SetStateAction<RiskThresholdConfig>>;
  reclusterAllReports: () => void;
  getAnalytics: (timeRange: '24h' | '7d' | '30d' | 'all') => ReturnType<typeof calculateDynamicAnalytics>;
  dataSourceMode: DataSourceMode;
  setDataSourceMode: (mode: DataSourceMode) => void;
  isFirebaseAvailable: boolean;
  dbOperationStatus: DbOperationStatus;
  loginWithGoogle: () => Promise<{ success: boolean; role: 'officer' | 'citizen'; message?: string }>;
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
const STORAGE_KEY_DEMO_ACCOUNTS = 'floodsense_demo_accounts_v3';
const LEGACY_STORAGE_KEY_DEMO_ACCOUNTS = 'floodsense_demo_accounts_v2';
const SESSION_KEY_AUTH_EMAIL = 'floodsense_session_email_v2';

const BUILTIN_DEMO_ACCOUNTS: DemoAccountRecord[] = [
  {
    email: DEMO_CREDENTIALS.citizen.email,
    passwordHash: hashDemoPassword(DEMO_CREDENTIALS.citizen.password),
    role: 'citizen',
    profile: DEMO_CITIZEN_PROFILE,
  },
  {
    email: DEMO_CREDENTIALS.officer.email,
    passwordHash: hashDemoPassword(DEMO_CREDENTIALS.officer.password),
    role: 'officer',
    profile: DEMO_OFFICER_PROFILE,
  },
  {
    email: 'k.pereira@dmc.gov.lk',
    passwordHash: hashDemoPassword(DEMO_CREDENTIALS.officer.password),
    role: 'officer',
    profile: { ...DEMO_OFFICER_PROFILE, email: 'k.pereira@dmc.gov.lk' },
  },
];

const INITIAL_DEMO_NOTIFICATIONS: NotificationItem[] = [
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
    title: 'Hash-Chain Block Anchored #EVT-892014',
    description: 'Dematagoda incident payload hashed and linked in prototype SHA-256 chain.',
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
    description: 'Report REP-109 submitted with geotagged photo.',
    location: 'Kolonnawa Canal',
    time: '34 mins ago',
    unread: false,
    type: 'NEW_REPORT',
    severity: 'MEDIUM',
    deliveryChannel: 'in-app',
  },
];

export const FloodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataSourceMode, setDataSourceModeState] = useState<DataSourceMode>(() => floodService.getMode());
  const [isFirebaseAvailable] = useState<boolean>(isFirebaseConfigured());

  const [demoAccounts, setDemoAccounts] = useState<DemoAccountRecord[]>(() => {
    try {
      // Remove legacy plaintext password store if present
      localStorage.removeItem(LEGACY_STORAGE_KEY_DEMO_ACCOUNTS);
      const saved = localStorage.getItem(STORAGE_KEY_DEMO_ACCOUNTS);
      if (saved) {
        const parsed = JSON.parse(saved) as DemoAccountRecord[];
        const map = new Map<string, DemoAccountRecord>();
        BUILTIN_DEMO_ACCOUNTS.forEach((acc) => map.set(acc.email.toLowerCase(), acc));
        parsed.forEach((acc) => {
          if (acc?.email && acc?.passwordHash && !map.has(acc.email.toLowerCase())) {
            map.set(acc.email.toLowerCase(), { ...acc, role: 'citizen' });
          }
        });
        return Array.from(map.values());
      }
    } catch {}
    return BUILTIN_DEMO_ACCOUNTS;
  });

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

  const verifyingOfficerRef = useRef<boolean>(false);

  const initialSessionAccount = (() => {
    if (isFirebaseConfigured() || dataSourceMode === 'FIREBASE') return null;
    try {
      const sessionEmail =
        sessionStorage.getItem(SESSION_KEY_AUTH_EMAIL) ||
        localStorage.getItem(SESSION_KEY_AUTH_EMAIL);
      if (sessionEmail) {
        const match = demoAccounts.find(
          (a) => a.email.toLowerCase() === sessionEmail.toLowerCase()
        );
        if (match) return match;
      }
    } catch {}
    return null;
  })();

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(
    () => isFirebaseConfigured() && Boolean(auth)
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(initialSessionAccount));
  const [authenticatedRole, setAuthenticatedRole] = useState<'officer' | 'citizen' | null>(
    () => (initialSessionAccount ? initialSessionAccount.role : null)
  );
  const [role, setRoleState] = useState<'officer' | 'citizen'>(
    () => (initialSessionAccount ? initialSessionAccount.role : 'citizen')
  );

  const [userProfile, setUserProfile] = useState<UserProfile>(
    () => (initialSessionAccount ? initialSessionAccount.profile : DEMO_CITIZEN_PROFILE)
  );

  const [weather, setWeather] = useState<WeatherData>({
    ...INITIAL_WEATHER_FORECAST,
    provider: INITIAL_WEATHER_FORECAST.source,
    isLive: false,
    isUsingDemonstrationFallback: true,
  });

  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_DEMO_NOTIFICATIONS);

  // Monitor Firebase Authentication state
  useEffect(() => {
    if (auth && isFirebaseConfigured()) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (verifyingOfficerRef.current) {
          return;
        }
        if (user) {
          const authRole = await floodService.fetchVerifiedSessionRole(user);
          let storedUserData: any = null;
          if (db) {
            try {
              const snap = await getDoc(doc(db, 'users', user.uid));
              if (snap.exists()) storedUserData = snap.data();
            } catch {}
          }
          setAuthenticatedRole(authRole);
          setRoleState(authRole);
          setIsAuthenticated(true);
          setUserProfile((prev) => ({
            ...prev,
            uid: user.uid,
            name:
              storedUserData?.displayName ||
              storedUserData?.name ||
              user.displayName ||
              (authRole === 'officer' ? 'Municipal Officer' : 'Citizen Reporter'),
            email: user.email || prev.email,
            phone: storedUserData?.phone || user.phoneNumber || '',
            department:
              storedUserData?.department ||
              (authRole === 'officer' ? 'Municipal Flood Operations' : 'Colombo Community Sentinel'),
            emergencySector:
              storedUserData?.emergencySector ||
              (authRole === 'officer' ? 'Sector 04 — Colombo Municipal Basin' : 'Western Province Sentinel'),
            avatarUrl: user.photoURL || prev.avatarUrl,
            roleName:
              authRole === 'officer'
                ? 'Emergency Management Officer'
                : 'Citizen Reporter & Resident',
            isFirebaseUser: true,
          }));
        } else {
          setIsAuthenticated(false);
          setAuthenticatedRole(null);
          setRoleState('citizen');
        }
        setIsAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      setIsAuthLoading(false);
    }
  }, [dataSourceMode]);

  // Persist hashed demo accounts registry (zero plaintext passwords stored)
  useEffect(() => {
    try {
      const sanitized = demoAccounts.map((acc) => ({
        email: acc.email,
        passwordHash: acc.passwordHash,
        role: acc.role,
        profile: acc.profile,
      }));
      localStorage.setItem(STORAGE_KEY_DEMO_ACCOUNTS, JSON.stringify(sanitized));
    } catch {}
  }, [demoAccounts]);

  // Subscribe to Firestore Notifications when in FIREBASE mode
  useEffect(() => {
    if (dataSourceMode === 'FIREBASE' && isFirebaseConfigured() && isAuthenticated && userProfile.uid) {
      const unsub = floodService.subscribeToNotifications(
        userProfile.uid,
        authenticatedRole === 'officer',
        (items) => {
          setNotifications(
            items.map((item: any) => ({
              id: item.id,
              title: item.title || 'FloodSense Notification',
              description: item.description || item.message || '',
              location: item.location || '',
              time: item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'Cloud Synced',
              unread: Boolean(item.unread),
              type: item.type || 'OFFICER_UPDATE',
              severity: item.severity || 'INFO',
              deliveryChannel: 'in-app',
              reportId: item.reportId,
            }))
          );
        },
        (err) => console.warn('Notifications listener error:', err.message)
      );
      return () => {
        if (unsub) unsub();
      };
    } else if (dataSourceMode === 'DEMO') {
      setNotifications((prev) => (prev.length === 0 ? INITIAL_DEMO_NOTIFICATIONS : prev));
    }
  }, [dataSourceMode, isAuthenticated, userProfile.uid, authenticatedRole]);

  // Synchronize reports/hotspots/blockchain with Cloud Firestore when in FIREBASE mode
  useEffect(() => {
    if (dataSourceMode === 'FIREBASE') {
      if (isAuthLoading) return;
      const effectiveRole = isFirebaseConfigured() ? authenticatedRole || 'citizen' : authenticatedRole || role;
      const effectiveUid = userProfile.uid;

      setDbOperationStatus({ loading: true, error: null, success: null });

      Promise.all([
        floodService.getReports({ role: effectiveRole, uid: effectiveUid }),
        floodService.getHotspots(),
        floodService.getBlockchainRecords(),
      ])
        .then(([cloudReports, cloudHotspots, cloudBlockchain]) => {
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

      const unsubReports = floodService.subscribeToReports(
        (updatedReports) => setReports(updatedReports),
        (err) => console.warn('Real-time reports listener error:', err.message),
        { role: effectiveRole, uid: effectiveUid }
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
  }, [dataSourceMode, isAuthenticated, isAuthLoading, authenticatedRole, role, userProfile.uid]);

  const refreshWeather = useCallback(async () => {
    const live = await floodService.fetchLiveWeather();
    setWeather(live);
  }, []);

  useEffect(() => {
    refreshWeather();
    const interval = setInterval(refreshWeather, 300000);
    return () => clearInterval(interval);
  }, [refreshWeather]);

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

  // UI preview role switcher (strictly disabled for escalation when Firebase Auth is active)
  const setRole = (newRole: 'officer' | 'citizen') => {
    if ((isFirebaseConfigured() || dataSourceMode === 'FIREBASE') && newRole === 'officer' && authenticatedRole !== 'officer') {
      return;
    }
    setRoleState(newRole);
    try {
      localStorage.setItem(STORAGE_KEY_ROLE, newRole);
    } catch {}
  };

  const updateUserProfile = async (
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    const rawKeys = Object.keys(updates || {});
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
      'isFirebaseUser',
    ];
    if (rawKeys.some((k) => forbiddenKeys.includes(k) && (updates as Record<string, any>)[k] !== undefined)) {
      return {
        success: false,
        error: 'Forbidden: Role or identity privilege fields cannot be modified through profile updates.',
      };
    }

    const safeUpdates: Partial<UserProfile> = {
      ...(typeof updates.name === 'string' && updates.name.trim() ? { name: updates.name.trim().slice(0, 120) } : {}),
      ...(updates.phone !== undefined ? { phone: String(updates.phone).trim().slice(0, 40) } : {}),
      ...(updates.department !== undefined ? { department: String(updates.department).trim().slice(0, 120) } : {}),
      ...(updates.emergencySector !== undefined
        ? { emergencySector: String(updates.emergencySector).trim().slice(0, 120) }
        : {}),
      ...(typeof updates.avatarUrl === 'string' && updates.avatarUrl.trim()
        ? { avatarUrl: updates.avatarUrl.trim().slice(0, 500) }
        : {}),
    };

    const nextProfile = { ...userProfile, ...safeUpdates };
    if (dataSourceMode === 'FIREBASE' || isFirebaseConfigured()) {
      if (!nextProfile.uid) {
        return { success: false, error: 'Missing authenticated Firebase user ID.' };
      }
      try {
        await floodService.updateUserProfileInFirestore(nextProfile.uid, safeUpdates);
      } catch (err: any) {
        const msg = err?.message || 'Failed to update profile in Cloud Firestore.';
        setDbOperationStatus({ loading: false, error: msg, success: null });
        return { success: false, error: msg };
      }
    }

    setUserProfile(nextProfile);
    setDemoAccounts((accounts) =>
      accounts.map((acc) =>
        acc.email.toLowerCase() === userProfile.email.toLowerCase()
          ? { ...acc, profile: { ...acc.profile, ...safeUpdates } }
          : acc
      )
    );
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(nextProfile));
    } catch {}
    return { success: true };
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
      if (h.rainfallSource !== 'MISSING' && Number.isFinite(h.forecastRainfallMm)) {
        rainfallByArea[h.area] = h.forecastRainfallMm;
      }
    });
    if (
      weather.isLive &&
      weather.expected3hRainfallMm !== null &&
      Number.isFinite(weather.expected3hRainfallMm)
    ) {
      rainfallByArea['__default'] = weather.expected3hRainfallMm;
    }

    const newHotspots = clusterReports(reports, clusteringConfig, rainfallByArea, riskThresholds);
    setHotspots(newHotspots);
    floodService.persistHotspots(newHotspots).catch(() => {});
  }, [reports, clusteringConfig, riskThresholds, hotspots, weather]);

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

  const myReports = reports.filter((r) => {
    if (!isAuthenticated) return false;
    if (userProfile.uid && r.reporterId === userProfile.uid) return true;
    const activeEmail = userProfile.email?.toLowerCase();
    if (activeEmail && r.reporterId?.toLowerCase() === activeEmail) return true;
    if (activeEmail === DEMO_CITIZEN_PROFILE.email.toLowerCase() && r.reporterId === 'citizen_demo_user') {
      return true;
    }
    return false;
  });

  // Strictly blocked from granting Officer privileges when Firebase Auth or Live mode is active
  const switchPersona = (persona: 'officer' | 'citizen') => {
    if ((isFirebaseConfigured() || dataSourceMode === 'FIREBASE') && persona === 'officer') {
      setDbOperationStatus({
        loading: false,
        error:
          'Client role switching cannot grant Emergency Officer access. Sign in via Emergency Officer Login with a pre-authorized account.',
        success: null,
      });
      return;
    }
    const targetAccount =
      persona === 'officer' ? BUILTIN_DEMO_ACCOUNTS[1] : BUILTIN_DEMO_ACCOUNTS[0];
    setAuthenticatedRole(targetAccount.role);
    setRoleState(targetAccount.role);
    setUserProfile(targetAccount.profile);
    setIsAuthenticated(true);
    try {
      sessionStorage.setItem(SESSION_KEY_AUTH_EMAIL, targetAccount.email);
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(targetAccount.profile));
    } catch {}
  };

  const buildProfileFromFirebaseUser = async (
    fbUser: any,
    authoritativeRole: 'officer' | 'citizen'
  ): Promise<UserProfile> => {
    let storedUserData: any = null;
    if (db && fbUser?.uid) {
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists()) storedUserData = snap.data();
      } catch {}
    }
    return {
      uid: fbUser.uid,
      name:
        storedUserData?.displayName ||
        storedUserData?.name ||
        fbUser.displayName ||
        (authoritativeRole === 'officer' ? 'Municipal Officer' : 'Citizen Reporter'),
      roleName:
        authoritativeRole === 'officer'
          ? 'Emergency Management Officer'
          : 'Citizen Reporter & Resident',
      department:
        storedUserData?.department ||
        (authoritativeRole === 'officer' ? 'Municipal Flood Operations' : 'Colombo Metro Community'),
      email: fbUser.email || '',
      phone: storedUserData?.phone || fbUser.phoneNumber || '',
      avatarUrl:
        fbUser.photoURL ||
        (authoritativeRole === 'officer'
          ? FLOOD_IMAGES.officerAvatar
          : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256'),
      emergencySector:
        storedUserData?.emergencySector ||
        (authoritativeRole === 'officer'
          ? 'Sector 04 — Colombo Municipal Basin'
          : 'Western Province Sentinel'),
      isFirebaseUser: true,
    };
  };

  const loginWithEmail = async (email: string, password: string, rememberMe = false) => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      const msg = 'Please enter a valid email address.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    if (!password) {
      const msg = 'Please enter your password.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    try {
      if (isFirebaseConfigured() && auth) {
        await setPersistence(
          auth,
          rememberMe ? browserLocalPersistence : browserSessionPersistence
        );
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const fbUser = userCredential.user;
        const authoritativeRole = await floodService.fetchVerifiedSessionRole(fbUser);
        const profile = await buildProfileFromFirebaseUser(fbUser, authoritativeRole);

        setUserProfile(profile);
        setAuthenticatedRole(authoritativeRole);
        setRoleState(authoritativeRole);
        setIsAuthenticated(true);
        setDbOperationStatus({
          loading: false,
          error: null,
          success: `Logged in successfully as ${authoritativeRole === 'officer' ? 'Emergency Officer' : 'Citizen Reporter'}.`,
        });
        return { success: true, role: authoritativeRole };
      }

      // Non-Firebase fallback (only when Firebase is not configured)
      const matchedAccount = demoAccounts.find(
        (acc) => acc.email.toLowerCase() === normalizedEmail
      );

      if (!matchedAccount) {
        const msg = 'No account found with this email address. Please check your email or register a new citizen account.';
        setDbOperationStatus({ loading: false, error: msg, success: null });
        return { success: false, role: 'citizen' as const, message: msg };
      }

      if (matchedAccount.passwordHash !== hashDemoPassword(password)) {
        const msg = 'Incorrect password. Please verify your password and try again.';
        setDbOperationStatus({ loading: false, error: msg, success: null });
        return { success: false, role: matchedAccount.role, message: msg };
      }

      setUserProfile(matchedAccount.profile);
      setAuthenticatedRole(matchedAccount.role);
      setRoleState(matchedAccount.role);
      setIsAuthenticated(true);

      try {
        sessionStorage.setItem(SESSION_KEY_AUTH_EMAIL, matchedAccount.email);
        if (rememberMe) {
          localStorage.setItem(SESSION_KEY_AUTH_EMAIL, matchedAccount.email);
        } else {
          localStorage.removeItem(SESSION_KEY_AUTH_EMAIL);
        }
      } catch {}

      setDbOperationStatus({
        loading: false,
        error: null,
        success: `Logged in successfully as ${matchedAccount.role === 'officer' ? 'Emergency Officer' : 'Citizen Reporter'}.`,
      });
      return { success: true, role: matchedAccount.role };
    } catch (err: any) {
      const msg = floodService.formatFirebaseAuthError(err);
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }
  };

  const loginWithOfficerEmail = async (email: string, password: string, rememberMe = false) => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      const msg = 'Please enter a valid officer email address.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    if (!password) {
      const msg = 'Please enter your password.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    if (isFirebaseConfigured() && auth) {
      verifyingOfficerRef.current = true;
      try {
        await setPersistence(
          auth,
          rememberMe ? browserLocalPersistence : browserSessionPersistence
        );
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const fbUser = userCredential.user;
        const verifyRes = await floodService.verifyOfficerWithBackend(fbUser);

        if (!verifyRes.authorized || verifyRes.role !== 'officer') {
          await floodService.logout();
          setIsAuthenticated(false);
          setAuthenticatedRole(null);
          setRoleState('citizen');
          const deniedMsg =
            verifyRes.error ||
            'Access denied: this account is not pre-authorized as an Emergency Officer.';
          setDbOperationStatus({ loading: false, error: deniedMsg, success: null });
          return { success: false, role: 'citizen' as const, message: deniedMsg };
        }

        const profile = await buildProfileFromFirebaseUser(fbUser, 'officer');
        setUserProfile(profile);
        setAuthenticatedRole('officer');
        setRoleState('officer');
        setIsAuthenticated(true);
        setDbOperationStatus({
          loading: false,
          error: null,
          success: 'Emergency Officer credentials verified. Opening Operations Center.',
        });
        return { success: true, role: 'officer' as const };
      } catch (err: any) {
        const msg = floodService.formatFirebaseAuthError(err);
        setDbOperationStatus({ loading: false, error: msg, success: null });
        return { success: false, role: 'citizen' as const, message: msg };
      } finally {
        verifyingOfficerRef.current = false;
      }
    }

    // Non-Firebase fallback (only when Firebase is not configured)
    const matchedOfficer = demoAccounts.find(
      (acc) => acc.email.toLowerCase() === normalizedEmail && acc.role === 'officer'
    );
    if (!matchedOfficer) {
      const msg = 'Access denied: this account is not pre-authorized as an Emergency Officer.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }
    if (matchedOfficer.passwordHash !== hashDemoPassword(password)) {
      const msg = 'Invalid officer password. Please verify your credentials.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }
    setUserProfile(matchedOfficer.profile);
    setAuthenticatedRole('officer');
    setRoleState('officer');
    setIsAuthenticated(true);
    try {
      sessionStorage.setItem(SESSION_KEY_AUTH_EMAIL, matchedOfficer.email);
      if (rememberMe) {
        localStorage.setItem(SESSION_KEY_AUTH_EMAIL, matchedOfficer.email);
      }
    } catch {}
    setDbOperationStatus({
      loading: false,
      error: null,
      success: 'Emergency Officer signed in.',
    });
    return { success: true, role: 'officer' as const };
  };

  const loginWithOfficerGoogle = async () => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    if (!(isFirebaseConfigured() && auth)) {
      const msg = 'Firebase Authentication must be configured to sign in as an Emergency Officer with Google.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    }

    verifyingOfficerRef.current = true;
    try {
      const googleRes = await floodService.loginWithGoogle();
      if (!googleRes || !googleRes.fbUser) {
        const msg = 'Google authentication did not return a valid Firebase user.';
        setDbOperationStatus({ loading: false, error: msg, success: null });
        return { success: false, role: 'citizen' as const, message: msg };
      }

      const verifyRes = await floodService.verifyOfficerWithBackend(googleRes.fbUser);
      if (!verifyRes.authorized || verifyRes.role !== 'officer') {
        await floodService.logout();
        setIsAuthenticated(false);
        setAuthenticatedRole(null);
        setRoleState('citizen');
        const deniedMsg =
          verifyRes.error ||
          'Access denied: this Google account is not pre-authorized as an Emergency Officer.';
        setDbOperationStatus({ loading: false, error: deniedMsg, success: null });
        return { success: false, role: 'citizen' as const, message: deniedMsg };
      }

      const profile = await buildProfileFromFirebaseUser(googleRes.fbUser, 'officer');
      setUserProfile(profile);
      setAuthenticatedRole('officer');
      setRoleState('officer');
      setIsAuthenticated(true);
      setDbOperationStatus({
        loading: false,
        error: null,
        success: `Verified Emergency Officer ${profile.name} via Google & backend Admin SDK.`,
      });
      return { success: true, role: 'officer' as const };
    } catch (err: any) {
      const msg = floodService.formatFirebaseAuthError(err);
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, role: 'citizen' as const, message: msg };
    } finally {
      verifyingOfficerRef.current = false;
    }
  };

  const registerWithEmail = async (name: string, email: string, password: string, phone?: string) => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const normalizedEmail = cleanEmail.toLowerCase();

    if (!cleanName) {
      const msg = 'Please enter your full name.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, message: msg };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const msg = 'Please enter a valid email address.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, message: msg };
    }
    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, message: msg };
    }

    try {
      let fbUid: string | undefined;
      if (isFirebaseConfigured() && auth) {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (cred.user) {
          fbUid = cred.user.uid;
          await updateProfile(cred.user, { displayName: cleanName });
          try {
            await floodService.createCitizenUserProfileInFirestore(cred.user.uid, cleanName, cleanEmail, phone);
          } catch (firestoreErr) {
            console.warn('Citizen Firestore profile write deferred:', firestoreErr);
          }
        }
      } else {
        const exists = demoAccounts.some((acc) => acc.email.toLowerCase() === normalizedEmail);
        if (exists) {
          const msg = 'An account with this email already exists. Please sign in or use a different email.';
          setDbOperationStatus({ loading: false, error: msg, success: null });
          return { success: false, message: msg };
        }
      }

      const newCitizen: UserProfile = {
        uid: fbUid,
        name: cleanName,
        roleName: 'Citizen Reporter & Resident',
        department: 'Colombo Community Sentinel',
        email: cleanEmail,
        phone: phone?.trim() || '',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
        emergencySector: 'Western Province — Citizen Sentinel',
        isFirebaseUser: isFirebaseConfigured(),
      };

      if (!isFirebaseConfigured()) {
        setDemoAccounts((prev) => [
          ...prev,
          { email: cleanEmail, passwordHash: hashDemoPassword(password), role: 'citizen', profile: newCitizen },
        ]);
      }

      setUserProfile(newCitizen);
      setAuthenticatedRole('citizen');
      setRoleState('citizen');
      setIsAuthenticated(true);

      if (!isFirebaseConfigured()) {
        try {
          sessionStorage.setItem(SESSION_KEY_AUTH_EMAIL, cleanEmail);
          localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(newCitizen));
        } catch {}
      }

      addNotification({
        title: `Welcome to FloodSense, ${cleanName}`,
        description: 'Your citizen reporter account is active. You can now submit road flood alerts and track municipal officer responses.',
        type: 'OFFICER_UPDATE',
        severity: 'INFO',
        deliveryChannel: 'in-app',
        recipientUid: fbUid,
        recipientEmail: cleanEmail,
      });

      setDbOperationStatus({
        loading: false,
        error: null,
        success: `Account registered successfully for ${cleanName}. Welcome to FloodSense!`,
      });
      return { success: true };
    } catch (err: any) {
      const msg = floodService.formatFirebaseAuthError(err);
      setDbOperationStatus({ loading: false, error: msg, success: null });
      return { success: false, message: msg };
    }
  };

  const requestPasswordReset = async (email: string) => {
    return floodService.sendPasswordReset(email);
  };

  const logout = async () => {
    if (isFirebaseConfigured() && auth) {
      await floodService.logout();
    }
    setIsAuthenticated(false);
    setAuthenticatedRole(null);
    setRoleState('citizen');
    try {
      sessionStorage.removeItem(SESSION_KEY_AUTH_EMAIL);
      localStorage.removeItem(SESSION_KEY_AUTH_EMAIL);
      localStorage.removeItem('floodsense_auth_v2');
      localStorage.removeItem(STORAGE_KEY_ROLE);
    } catch {}
    setDbOperationStatus({
      loading: false,
      error: null,
      success: 'Signed out successfully.',
    });
  };

  const loginWithGoogle = async () => {
    setDbOperationStatus({ loading: true, error: null, success: null });
    try {
      if (isFirebaseConfigured() && auth) {
        const user = await floodService.loginWithGoogle();
        if (user) {
          const profile = await buildProfileFromFirebaseUser(user.fbUser, user.role);
          setUserProfile(profile);
          setAuthenticatedRole(user.role);
          setRoleState(user.role);
          setIsAuthenticated(true);
          setDbOperationStatus({
            loading: false,
            error: null,
            success: `Signed in as ${profile.name} via Google Firebase Auth.`,
          });
          return { success: true, role: user.role };
        }
      }

      if (dataSourceMode === 'FIREBASE' || isFirebaseConfigured()) {
        const msg = 'Firebase Auth is not ready in this environment.';
        setDbOperationStatus({ loading: false, error: msg, success: null });
        return { success: false, role: 'citizen' as const, message: msg };
      }

      const googleDemoUser = BUILTIN_DEMO_ACCOUNTS[0];
      setUserProfile(googleDemoUser.profile);
      setAuthenticatedRole('citizen');
      setRoleState('citizen');
      setIsAuthenticated(true);
      try {
        sessionStorage.setItem(SESSION_KEY_AUTH_EMAIL, googleDemoUser.email);
      } catch {}
      setDbOperationStatus({
        loading: false,
        error: null,
        success: 'Signed in as Citizen Reporter (Demo Google Account fallback; Firebase keys not configured).',
      });
      return { success: true, role: 'citizen' as const };
    } catch (err: any) {
      const msg = floodService.formatFirebaseAuthError(err);
      setDbOperationStatus({
        loading: false,
        error: msg,
        success: null,
      });
      return { success: false, role: 'citizen' as const, message: msg };
    }
  };

  const logoutGoogle = async () => {
    await logout();
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => {
      prev.forEach((n) => {
        if (n.unread && dataSourceMode === 'FIREBASE') {
          floodService.markNotificationReadInFirestore(n.id).catch(() => {});
        }
      });
      return prev.map((n) => ({ ...n, unread: false }));
    });
  };

  const markNotificationAsRead = (id: string) => {
    if (dataSourceMode === 'FIREBASE') {
      floodService.markNotificationReadInFirestore(id).catch(() => {});
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const addNotification = (n: Omit<NotificationItem, 'id' | 'time' | 'unread'>) => {
    const newItem: NotificationItem = {
      ...n,
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      onUploadProgress?: (percent: number) => void;
    }
  ) => {
    setDbOperationStatus({ loading: true, error: null, success: null });

    const resolvedUid =
      dataSourceMode === 'FIREBASE' && auth?.currentUser?.uid
        ? auth.currentUser.uid
        : userProfile.uid || userProfile.email || 'citizen_demo_user';

    const enrichedInput = {
      ...newReportData,
      reporterName: newReportData.reporterName || userProfile.name,
      reporterPhone: newReportData.reporterPhone !== undefined ? newReportData.reporterPhone : userProfile.phone,
      reporterId: newReportData.reporterId || resolvedUid,
    };

    try {
      const result = await floodService.submitReport(enrichedInput);

      setReports((prev) => {
        if (prev.some((r) => r.id === result.report.id)) return prev;
        return [result.report, ...prev];
      });

      setHotspots((prev) => {
        const existing = prev.find((h) => h.id === result.hotspot.id);
        if (existing) {
          return prev.map((h) => (h.id === result.hotspot.id ? result.hotspot : h));
        }
        return [result.hotspot, ...prev];
      });

      if (result.blockchainRecord) {
        setBlockchainRecords((prev) => {
          if (prev.some((b) => b.eventId === result.blockchainRecord!.eventId)) return prev;
          return [result.blockchainRecord!, ...prev];
        });
        addNotification({
          title: `Hash-Chain Audit Anchor #${result.blockchainRecord.eventId}`,
          description: `High-risk incident sealed into prototype SHA-256 chain (block #${result.blockchainRecord.blockNumber}).`,
          location: result.hotspot.location,
          type: 'BLOCKCHAIN',
          severity: 'HIGH',
          deliveryChannel: 'in-app',
          reportId: result.report.id,
        });
      }

      addNotification({
        title: result.isDuplicate
          ? `Duplicate Report Recorded: ${result.report.id} (${result.report.area})`
          : `Report Submitted: ${result.report.id} (${result.report.area})`,
        description: result.isDuplicate
          ? `Flagged as near-duplicate of ${result.duplicateOfId}. Evidence preserved for officer review.`
          : `${result.report.waterLevel} flood reported at ${result.report.location}. Queued for municipal officer inspection.`,
        location: result.report.location,
        type: 'NEW_REPORT',
        severity: result.report.riskLevel,
        deliveryChannel: 'in-app',
        reportId: result.report.id,
        recipientUid: resolvedUid,
        recipientEmail: userProfile.email,
      });

      const aiSt = result.report.aiStatus;
      addNotification({
        title:
          aiSt === 'FAILED'
            ? `AI Analysis Failed for ${result.report.id}`
            : aiSt === 'NOT_RUN'
            ? `Text Report Queued: ${result.report.id}`
            : `AI Assessment Ready: ${result.report.id}`,
        description:
          aiSt === 'FAILED'
            ? 'Automatic AI check could not complete, but your report is safely queued for manual officer review.'
            : aiSt === 'NOT_RUN'
            ? 'No photograph attached; queued for officer field inspection.'
            : `${result.report.aiClassification} (${result.report.aiConfidence ?? 'N/A'}% confidence). Pending officer confirmation.`,
        location: result.report.location,
        type: 'AI_STATUS',
        severity: aiSt === 'FAILED' ? 'MEDIUM' : 'INFO',
        deliveryChannel: 'in-app',
        reportId: result.report.id,
      });

      setDbOperationStatus({
        loading: false,
        error: null,
        success:
          dataSourceMode === 'FIREBASE'
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

  const retryAiVerification = async (
    reportId: string,
    override?: { customImage?: string; mimeType?: string }
  ): Promise<FloodReport | null> => {
    const updated = await floodService.retryAiVerification(reportId, override);
    if (updated) {
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      addNotification({
        title:
          updated.aiStatus === 'FAILED'
            ? `AI Retry Failed: ${reportId}`
            : updated.aiStatus === 'NOT_RUN'
            ? `AI Not Run (No Photo): ${reportId}`
            : `AI Retry Completed: ${reportId}`,
        description:
          updated.aiStatus === 'FAILED'
            ? 'AI vision retry did not succeed. Report remains safely queued for officer inspection.'
            : updated.aiStatus === 'NOT_RUN'
            ? 'No image attached to evaluate.'
            : `AI updated assessment to "${updated.aiClassification}" (${updated.aiConfidence ?? 'N/A'}% confidence).`,
        location: updated.location,
        type: 'AI_STATUS',
        severity: updated.aiStatus === 'FAILED' ? 'MEDIUM' : 'INFO',
        deliveryChannel: 'in-app',
        reportId,
      });
    }
    return updated;
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
          title: `Incident ${reportId} Updated: "${newStatus}"`,
          description: officerNote
            ? `Officer note: ${officerNote}`
            : `Status updated to ${newStatus} by ${userProfile.name}.`,
          location: updated.location,
          type:
            newStatus === 'Resolved'
              ? 'INCIDENT_RESOLVED'
              : newStatus === 'Alert Issued'
              ? 'HIGH_RISK_ALERT'
              : 'OFFICER_UPDATE',
          severity: newStatus === 'Alert Issued' ? 'HIGH' : 'MEDIUM',
          deliveryChannel: 'in-app',
          reportId,
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

  const retryPublicSync = async (
    reportId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await floodService.retryPublicSync(reportId);
    if (res.ok) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                publicSyncStatus: 'SYNCED',
                publicSyncError: undefined,
                hotspotId: res.hotspot?.id || r.hotspotId,
              }
            : r
        )
      );
      if (res.hotspot) {
        setHotspots((prev) => {
          const exists = prev.some((h) => h.id === res.hotspot!.id);
          return exists
            ? prev.map((h) => (h.id === res.hotspot!.id ? res.hotspot! : h))
            : [res.hotspot!, ...prev];
        });
      }
      return { ok: true };
    }
    return { ok: false, error: res.error || 'Public sync retry failed.' };
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

  const scopedNotifications =
    dataSourceMode === 'DEMO'
      ? notifications.filter((n) => {
          if (!n.recipientEmail && !n.recipientUid) return true;
          if (userProfile.uid && n.recipientUid === userProfile.uid) return true;
          return n.recipientEmail?.toLowerCase() === userProfile.email?.toLowerCase();
        })
      : notifications;

  return (
    <FloodContext.Provider
      value={{
        reports,
        myReports,
        hotspots,
        blockchainRecords,
        weather,
        refreshWeather,
        role,
        setRole,
        authenticatedRole,
        isAuthLoading,
        userProfile,
        setUserProfile,
        updateUserProfile,
        retryPublicSync,
        isAuthenticated,
        setIsAuthenticated,
        switchPersona,
        loginWithEmail,
        loginWithOfficerEmail,
        loginWithOfficerGoogle,
        registerWithEmail,
        requestPasswordReset,
        logout,
        selectedHotspotId,
        setSelectedHotspotId,
        selectedReportId,
        setSelectedReportId,
        notifications: scopedNotifications,
        markAllNotificationsAsRead,
        markNotificationAsRead,
        addNotification,
        addReport,
        retryAiVerification,
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
