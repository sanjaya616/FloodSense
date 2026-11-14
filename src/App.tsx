/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  NavLink,
} from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut, Droplets } from 'lucide-react';
import { FloodProvider, useFlood } from './context/FloodContext';

// Layouts
import { DashboardLayout } from './components/layout/DashboardLayout';
import { CitizenLayout } from './components/layout/CitizenLayout';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { PublicMapPage } from './pages/public/PublicMapPage';
import { SafetyInfoPage } from './pages/public/SafetyInfoPage';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Citizen Portal Pages
import { CitizenDashboardPage } from './pages/citizen/CitizenDashboardPage';
import { CitizenReportWizardPage } from './pages/citizen/CitizenReportWizardPage';
import { CitizenReportsPage } from './pages/citizen/CitizenReportsPage';
import { CitizenNotificationsPage } from './pages/citizen/CitizenNotificationsPage';
import { CitizenProfilePage } from './pages/citizen/CitizenProfilePage';

// Officer EOC Dashboard Pages
import { OverviewPage } from './pages/OverviewPage';
import { OfficerIncidentsPage } from './pages/officer/OfficerIncidentsPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { ReportFloodPage } from './pages/ReportFloodPage';
import { FloodHotspotsPage } from './pages/FloodHotspotsPage';
import { RiskPredictionsPage } from './pages/RiskPredictionsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BlockchainRegistryPage } from './pages/BlockchainRegistryPage';
import { SettingsPage } from './pages/SettingsPage';
import { MethodologyPage } from './pages/MethodologyPage';

const AuthLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
    <div className="w-10 h-10 rounded-full border-4 border-cyan-600 border-t-transparent animate-spin mb-3" />
    <p className="text-xs font-semibold text-slate-600">Verifying session credentials...</p>
  </div>
);

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useFlood();
  const location = useLocation();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};

const RequireOfficer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAuthLoading, authenticatedRole, userProfile, logout } = useFlood();
  const location = useLocation();
  const navigate = useNavigate();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (authenticatedRole !== 'officer') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-lg p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
              Access Denied · 403
            </span>
            <h1 className="text-xl font-extrabold text-slate-900">
              Authorized Emergency Officers Only
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Signed in as <strong className="text-slate-900">{userProfile.email}</strong> (Citizen account).
              The Emergency Operations Center is restricted to verified Disaster Management Centre officers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <NavLink
              to="/citizen"
              className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Return to Citizen Portal</span>
            </NavLink>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Officer Sign In</span>
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Droplets className="w-3.5 h-3.5 text-cyan-600" />
            <span>FloodSense Urban Intelligence · RBAC Enforced</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <FloodProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Home Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Citizen Portal & Public Safety (CitizenLayout) */}
          <Route element={<CitizenLayout />}>
            <Route
              path="/citizen"
              element={
                <RequireAuth>
                  <CitizenDashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/citizen/report"
              element={
                <RequireAuth>
                  <CitizenReportWizardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/citizen/reports"
              element={
                <RequireAuth>
                  <CitizenReportsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/citizen/notifications"
              element={
                <RequireAuth>
                  <CitizenNotificationsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/citizen/profile"
              element={
                <RequireAuth>
                  <CitizenProfilePage />
                </RequireAuth>
              }
            />
            <Route path="/map-public" element={<PublicMapPage />} />
            <Route path="/safety" element={<SafetyInfoPage />} />
          </Route>

          {/* Officer Operations Center (DashboardLayout + RequireOfficer) */}
          <Route
            path="/officer"
            element={
              <RequireOfficer>
                <DashboardLayout />
              </RequireOfficer>
            }
          >
            <Route index element={<Navigate to="/officer/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="incidents" element={<OfficerIncidentsPage />} />
            <Route path="map" element={<LiveMapPage />} />
            <Route path="report" element={<ReportFloodPage />} />
            <Route path="hotspots" element={<FloodHotspotsPage />} />
            <Route path="predictions" element={<RiskPredictionsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="blockchain" element={<BlockchainRegistryPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="methodology" element={<MethodologyPage />} />
          </Route>

          {/* Backward Compatibility Redirects */}
          <Route path="/overview" element={<Navigate to="/officer/overview" replace />} />
          <Route path="/incidents" element={<Navigate to="/officer/incidents" replace />} />
          <Route path="/map" element={<Navigate to="/officer/map" replace />} />
          <Route path="/report" element={<Navigate to="/citizen/report" replace />} />
          <Route path="/hotspots" element={<Navigate to="/officer/hotspots" replace />} />
          <Route path="/predictions" element={<Navigate to="/officer/predictions" replace />} />
          <Route path="/analytics" element={<Navigate to="/officer/analytics" replace />} />
          <Route path="/blockchain" element={<Navigate to="/officer/blockchain" replace />} />
          <Route path="/settings" element={<Navigate to="/officer/settings" replace />} />
          <Route path="/methodology" element={<Navigate to="/officer/methodology" replace />} />

          {/* Fallback to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </FloodProvider>
  );
}
