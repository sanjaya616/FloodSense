/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFlood } from '../context/FloodContext';
import {
  User,
  Shield,
  Sliders,
  RotateCcw,
  CheckCircle2,
  Download,
  Database,
  Cloud,
  Lock,
  RefreshCw,
  LogOut,
  LogIn,
  Activity,
  Layers,
  Bell,
  AlertTriangle,
} from 'lucide-react';

type ServiceHealthState =
  | 'NOT_CONFIGURED'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'DEMONSTRATION_MODE'
  | 'NOT_VERIFIED';

interface SystemHealthData {
  timestamp: string;
  status: string;
  services: {
    geminiAi: {
      state: ServiceHealthState;
      status: string;
      configured: boolean;
      mode: string;
      model: string;
      lastSuccess?: string | null;
      lastError?: string | null;
      lastChecked?: string;
    };
    weatherApi: {
      state: ServiceHealthState;
      status: string;
      provider: string;
      mode: string;
      lastSuccessfulConnection?: string | null;
      lastError?: string | null;
    };
    firebase: {
      state: ServiceHealthState;
      status: string;
      mode: string;
      adminSdkReady?: boolean;
      rulesConfigured: boolean | null;
      rulesNote?: string;
    };
    blockchain: {
      state: ServiceHealthState;
      status: string;
      network: string;
      chainId: number;
      isSimulated: boolean;
    };
    mapTileService: {
      state: ServiceHealthState;
      status: string;
      provider: string;
      lastSuccessfulConnection?: string | null;
      lastChecked?: string;
    };
  };
}

export const SettingsPage: React.FC = () => {
  const {
    role,
    setRole,
    userProfile,
    setUserProfile,
    resetDemonstrationData,
    reports,
    hotspots,
    blockchainRecords,
    dataSourceMode,
    setDataSourceMode,
    dbOperationStatus,
    loginWithGoogle,
    logoutGoogle,
    checkFirebaseConnection,
    clusteringConfig,
    setClusteringConfig,
    riskThresholds,
    setRiskThresholds,
    reclusterAllReports,
  } = useFlood();

  const [savedMessage, setSavedMessage] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [reclusterNotice, setReclusterNotice] = useState(false);

  // System Health state from live server probe
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [isProbingHealth, setIsProbingHealth] = useState(false);

  // Local form state for user profile
  const [profileForm, setProfileForm] = useState({
    name: userProfile.name,
    roleName: userProfile.roleName,
    department: userProfile.department,
    emergencySector: userProfile.emergencySector,
    email: userProfile.email,
    phone: userProfile.phone,
  });

  // Preference toggles with localStorage persistence
  const [notifyHighRisk, setNotifyHighRisk] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('floodsense_notify_high_risk');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [notifyWeatherAdvisory, setNotifyWeatherAdvisory] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('floodsense_notify_weather');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [notifySms, setNotifySms] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('floodsense_notify_sms');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Fetch actual health from backend /api/health
  const probeSystemHealth = async () => {
    setIsProbingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch {
      // ignore
    } finally {
      setIsProbingHealth(false);
    }
  };

  useEffect(() => {
    probeSystemHealth();
  }, []);

  // Update profileForm if userProfile changes externally (e.g. Google Sign-In)
  useEffect(() => {
    setProfileForm({
      name: userProfile.name,
      roleName: userProfile.roleName,
      department: userProfile.department,
      emergencySector: userProfile.emergencySector,
      email: userProfile.email,
      phone: userProfile.phone,
    });
  }, [userProfile]);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedProfile = {
      ...userProfile,
      name: profileForm.name.trim(),
      roleName: profileForm.roleName.trim(),
      department: profileForm.department.trim(),
      emergencySector: profileForm.emergencySector.trim(),
      email: profileForm.email.trim(),
      phone: profileForm.phone.trim(),
    };

    // Persist to Context state and localStorage
    setUserProfile(updatedProfile);
    try {
      localStorage.setItem('floodsense_profile_v2', JSON.stringify(updatedProfile));
      localStorage.setItem('floodsense_notify_high_risk', JSON.stringify(notifyHighRisk));
      localStorage.setItem('floodsense_notify_weather', JSON.stringify(notifyWeatherAdvisory));
      localStorage.setItem('floodsense_notify_sms', JSON.stringify(notifySms));
    } catch (err) {
      console.warn('Failed to persist profile to localStorage:', err);
    }

    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3500);
  };

  const handleResetData = () => {
    resetDemonstrationData({ resetSettings: false });
    setResetConfirm(true);
    setTimeout(() => setResetConfirm(false), 3000);
  };

  const handleRecluster = () => {
    reclusterAllReports();
    setReclusterNotice(true);
    setTimeout(() => setReclusterNotice(false), 3000);
  };

  const handleExportData = () => {
    const data = {
      exportTimestamp: new Date().toISOString(),
      platform: 'FloodSense Emerging Tech Prototype',
      activeDataSource: dataSourceMode,
      clusteringSettings: clusteringConfig,
      riskThresholdSettings: riskThresholds,
      colomboHotspots: hotspots,
      citizenReports: reports,
      blockchainRecords,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `floodsense_colombo_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (label: string, state?: ServiceHealthState) => {
    if (state === 'CONNECTED') {
      return (
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
          {label}
        </span>
      );
    }
    if (state === 'DEMONSTRATION_MODE') {
      return (
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200">
          {label}
        </span>
      );
    }
    if (state === 'ERROR' || state === 'DISCONNECTED') {
      return (
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
          {label}
        </span>
      );
    }
    if (state === 'NOT_CONFIGURED' || state === 'NOT_VERIFIED') {
      return (
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
          {label}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
        {label}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          System Configuration & Role Settings
        </h2>
        <p className="text-sm text-slate-500">
          Manage officer credentials, live backend service health, Firebase persistence, and clustering heuristics.
        </p>
      </div>

      {savedMessage && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Profile credentials and notification preferences successfully saved.</span>
        </div>
      )}

      {resetConfirm && (
        <div className="p-3.5 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-600" />
          <span>Demonstration database reset to initial Colombo baseline. Production cloud records remain untouched.</span>
        </div>
      )}

      {reclusterNotice && (
        <div className="p-3.5 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-600" />
          <span>Geospatial clustering recalculated across all active reports.</span>
        </div>
      )}

      {/* Database Operation Notification Banner */}
      {dbOperationStatus.success && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{dbOperationStatus.success}</span>
        </div>
      )}

      {dbOperationStatus.error && (
        <div className="p-3.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          <span>{dbOperationStatus.error}</span>
        </div>
      )}

      {/* COMPACT SYSTEM HEALTH SECTION (Genuine checks from backend) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block font-mono">
              Live Infrastructure Telemetry
            </span>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-700" />
              <span>System Health & Service Integration Probes</span>
            </h3>
            <p className="text-xs text-slate-500">
              Live operational checks for cloud services, AI models, weather APIs, and cryptographic ledgers.
            </p>
          </div>

          <button
            type="button"
            onClick={probeSystemHealth}
            disabled={isProbingHealth}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProbingHealth ? 'animate-spin text-cyan-600' : ''}`} />
            <span>Probe Services</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* Gemini AI */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-slate-900">Gemini AI Model</span>
                {getStatusBadge(
                  systemHealth?.services?.geminiAi?.status || (isProbingHealth ? 'Checking...' : 'Unavailable'),
                  systemHealth?.services?.geminiAi?.state
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                Model: <strong className="font-mono">{systemHealth?.services?.geminiAi?.model || 'gemini-4-hydrogen'}</strong> (Server-Side Multimodal Verification)
              </p>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-mono">
              Mode: {systemHealth?.services?.geminiAi?.mode || 'Checking backend...'}
            </span>
          </div>

          {/* Weather API */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-slate-900">Weather API</span>
                {getStatusBadge(
                  systemHealth?.services?.weatherApi?.status || (isProbingHealth ? 'Checking...' : 'Unavailable'),
                  systemHealth?.services?.weatherApi?.state
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                Provider: <strong>Open-Meteo Forecast API</strong> (Asia/Colombo)
              </p>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-mono">
              Last probe: {systemHealth?.timestamp ? new Date(systemHealth.timestamp).toLocaleTimeString() : 'Checking...'}
            </span>
          </div>

          {/* Firebase */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-slate-900">Cloud Firestore</span>
                {getStatusBadge(
                  systemHealth?.services?.firebase?.status || (isProbingHealth ? 'Checking...' : 'Not Checked'),
                  systemHealth?.services?.firebase?.state
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                Mode: {dataSourceMode === 'FIREBASE' ? 'Active Cloud Mode' : 'Local Demonstration Mode'}
              </p>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">
              {systemHealth?.services?.firebase?.rulesNote || 'Checking security rules status...'}
            </span>
          </div>

          {/* Blockchain */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-slate-900">Audit Hash-Chain</span>
                {getStatusBadge(
                  systemHealth?.services?.blockchain?.status || 'Simulated Prototype',
                  systemHealth?.services?.blockchain?.state || 'DEMONSTRATION_MODE'
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                {systemHealth?.services?.blockchain?.network || 'Local SHA-256 Hash-Chain Prototype'}
              </p>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-mono">
              Status: Local SHA-256 Digest Chain (Simulated)
            </span>
          </div>

          {/* Map Tile Service */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-slate-900">GIS Tile Service</span>
                {getStatusBadge(
                  systemHealth?.services?.mapTileService?.status || (isProbingHealth ? 'Checking...' : 'Unavailable'),
                  systemHealth?.services?.mapTileService?.state
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                OpenStreetMap Carto Vector Tiles
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-medium mt-2 font-mono">
              {systemHealth?.services?.mapTileService?.lastChecked
                ? `Probed at ${new Date(systemHealth.services.mapTileService.lastChecked).toLocaleTimeString()}`
                : 'Awaiting live tile probe...'}
            </span>
          </div>

          {/* Data Freshness */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-slate-900">Health Telemetry</span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                  {systemHealth ? 'RESPONDED' : isProbingHealth ? 'CHECKING' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-mono">
                Probe: {systemHealth ? new Date(systemHealth.timestamp).toLocaleTimeString() : 'Pending'}
              </p>
            </div>
            <span className="text-[10px] text-cyan-700 font-medium mt-2">
              On-demand /api/health endpoint
            </span>
          </div>
        </div>
      </div>

      {/* FIREBASE PERSISTENCE SERVICE LAYER PANEL */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block font-mono">
              Persistence Architecture
            </span>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-cyan-700" />
              <span>Firebase Cloud Firestore & Authentication Service Layer</span>
            </h3>
            <p className="text-xs text-slate-500">
              Switch between local demonstration records and Google Cloud Firestore.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg ${
                dataSourceMode === 'FIREBASE'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-cyan-100 text-cyan-800 border border-cyan-300'
              }`}
            >
              Mode: {dataSourceMode === 'FIREBASE' ? 'Cloud Firestore' : 'Demonstration Data'}
            </span>
          </div>
        </div>

        {/* Data Source Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div
            onClick={() => setDataSourceMode('DEMO')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              dataSourceMode === 'DEMO'
                ? 'border-cyan-500 bg-cyan-50/50 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-700" />
                <span className="text-sm font-bold text-slate-900">Demonstration Mode (Active)</span>
              </div>
              <input
                type="radio"
                name="dataSource"
                checked={dataSourceMode === 'DEMO'}
                onChange={() => setDataSourceMode('DEMO')}
                className="text-cyan-600"
              />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Standalone scenario with Colombo demonstration incidents, synthetic AI confidence metrics, and local storage retention.
            </p>
          </div>

          <div
            onClick={() => setDataSourceMode('FIREBASE')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              dataSourceMode === 'FIREBASE'
                ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-amber-700" />
                <span className="text-sm font-bold text-slate-900">Cloud Firestore Integration</span>
              </div>
              <input
                type="radio"
                name="dataSource"
                checked={dataSourceMode === 'FIREBASE'}
                onChange={() => setDataSourceMode('FIREBASE')}
                className="text-amber-600"
              />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Connect to Google Cloud Firestore with real-time onSnapshot listeners, cloud document synchronization, and Firebase Storage.
            </p>
          </div>
        </div>

        {/* Action Controls: Probe Connection & Google Sign-In */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={dbOperationStatus.loading}
              onClick={() => checkFirebaseConnection()}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {dbOperationStatus.loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-600" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-cyan-600" />
              )}
              <span>Test Cloud Firestore Connection</span>
            </button>

            {userProfile.isFirebaseUser ? (
              <button
                type="button"
                onClick={logoutGoogle}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out Firebase</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google Sign-In (Firebase Auth)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>{systemHealth?.services?.firebase?.rulesNote || 'Security rules check pending'}</span>
          </div>
        </div>
      </div>

      {/* Role Switcher Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">
              Active Environment Persona
            </span>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-700" />
              <span>Demonstration Role Switcher</span>
            </h3>
            <p className="text-xs text-slate-500">
              {dataSourceMode === 'FIREBASE'
                ? 'Locked in Cloud Firestore Mode — Officer access is governed strictly by Firebase custom claims.'
                : 'Toggle between municipal disaster management command and citizen community reporting (Demo Mode only).'}
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800">
            Current: {role === 'officer' ? 'Emergency Officer' : 'Citizen Reporter'}
          </span>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
          <Shield className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
          <p>
            <strong>Security Notice:</strong> Client-side role switching is enabled strictly in Demonstration Mode.
            In Firebase Cloud mode, administrative officer rights are governed solely by verified custom token claims (<code>request.auth.token.role == &apos;officer&apos;</code>) and client privilege escalation is blocked.
          </p>
        </div>

        {dataSourceMode === 'FIREBASE' ? (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
            Role switching is disabled while connected to Cloud Firestore. Sign in with an authorized Officer Firebase account to access Emergency Officer features.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div
              onClick={() => setRole('officer')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                role === 'officer'
                  ? 'border-cyan-500 bg-cyan-50/50 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-900">Emergency Officer</span>
                <input
                  type="radio"
                  name="role"
                  checked={role === 'officer'}
                  onChange={() => setRole('officer')}
                  className="text-cyan-600"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Full administrative visibility: status transitions, officer dispatch notes, risk prediction rules, and verification.
              </p>
            </div>

            <div
              onClick={() => setRole('citizen')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                role === 'citizen'
                  ? 'border-cyan-500 bg-cyan-50/50 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-900">Citizen Reporter</span>
                <input
                  type="radio"
                  name="role"
                  checked={role === 'citizen'}
                  onChange={() => setRole('citizen')}
                  className="text-cyan-600"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Public user mode: report submissions, own incident status tracking, and public safety advisories.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CLUSTERING & RISK THRESHOLD HEURISTICS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block font-mono">
              Heuristic Configuration
            </span>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-700" />
              <span>Configurable Geospatial Clustering & Risk Thresholds</span>
            </h3>
            <p className="text-xs text-slate-500">
              Tune Haversine aggregation distance and rainfall evaluation thresholds in real time.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRecluster}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Recalculate Clusters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Clustering controls */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <span className="font-bold text-slate-900 block font-mono uppercase text-[11px]">
              Geospatial Haversine Parameters
            </span>

            <div>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>Spatial Radius (Meters):</span>
                <span className="font-mono text-cyan-700">{clusteringConfig.spatialRadiusMeters}m</span>
              </div>
              <input
                type="range"
                min="200"
                max="1500"
                step="50"
                value={clusteringConfig.spatialRadiusMeters}
                onChange={(e) =>
                  setClusteringConfig((prev) => ({
                    ...prev,
                    spatialRadiusMeters: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-cyan-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">Default: 500 meters</span>
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>Temporal Window (Hours):</span>
                <span className="font-mono text-cyan-700">{clusteringConfig.temporalWindowHours} hours</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="0.5"
                value={clusteringConfig.temporalWindowHours}
                onChange={(e) =>
                  setClusteringConfig((prev) => ({
                    ...prev,
                    temporalWindowHours: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-cyan-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">Default: 2.0 hours</span>
            </div>
          </div>

          {/* Risk threshold controls */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <span className="font-bold text-slate-900 block font-mono uppercase text-[11px]">
              Deterministic Risk Thresholds
            </span>

            <div>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>High-Risk Rainfall Threshold:</span>
                <span className="font-mono text-cyan-700">{riskThresholds.highRainfallMm} mm</span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                step="1"
                value={riskThresholds.highRainfallMm}
                onChange={(e) =>
                  setRiskThresholds((prev) => ({
                    ...prev,
                    highRainfallMm: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-cyan-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">Default: 20 mm</span>
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>High-Risk Report Count:</span>
                <span className="font-mono text-cyan-700">{riskThresholds.highReportCount} reports</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="1"
                value={riskThresholds.highReportCount}
                onChange={(e) =>
                  setRiskThresholds((prev) => ({
                    ...prev,
                    highReportCount: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-cyan-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">Default: 3 reports</span>
            </div>
          </div>
        </div>
      </div>

      {/* User Profile Form */}
      <form onSubmit={handleProfileSave} className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-700" />
            <span>Profile & Municipal Command Information</span>
          </h3>
          <p className="text-xs text-slate-500">
            Officer details attached to automated alerts and verification signatures.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Official Role Title</label>
            <input
              type="text"
              value={profileForm.roleName}
              onChange={(e) => setProfileForm({ ...profileForm, roleName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Command Agency</label>
            <input
              type="text"
              value={profileForm.department}
              onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Emergency Operations Sector</label>
            <input
              type="text"
              value={profileForm.emergencySector}
              onChange={(e) => setProfileForm({ ...profileForm, emergencySector: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Gov Contact Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Operations Hot Line</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white font-mono"
            />
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="pt-3 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
            <Bell className="w-3.5 h-3.5 text-cyan-600" />
            <span>Notification & Alert Broadcast Preferences</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyHighRisk}
                onChange={(e) => setNotifyHighRisk(e.target.checked)}
                className="text-cyan-600 rounded"
              />
              <span className="text-slate-700">High Risk Alerts</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyWeatherAdvisory}
                onChange={(e) => setNotifyWeatherAdvisory(e.target.checked)}
                className="text-cyan-600 rounded"
              />
              <span className="text-slate-700">Weather Advisories</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={notifySms}
                onChange={(e) => setNotifySms(e.target.checked)}
                className="text-cyan-600 rounded"
              />
              <span className="text-slate-700">Simulated SMS Dispatches</span>
            </label>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
          >
            Update & Persist Profile Credentials
          </button>
        </div>
      </form>

      {/* Demonstration Database Operations */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-700" />
            <span>Demonstration Data Management</span>
          </h3>
          <p className="text-xs text-slate-500">
            Reset local simulated reports, export current telemetry matrix to JSON, or restore default state.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportData}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={handleResetData}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
