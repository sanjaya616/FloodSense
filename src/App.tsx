/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FloodProvider } from './context/FloodContext';

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
            <Route path="/citizen" element={<CitizenDashboardPage />} />
            <Route path="/citizen/report" element={<CitizenReportWizardPage />} />
            <Route path="/citizen/reports" element={<CitizenReportsPage />} />
            <Route path="/citizen/notifications" element={<CitizenNotificationsPage />} />
            <Route path="/map-public" element={<PublicMapPage />} />
            <Route path="/safety" element={<SafetyInfoPage />} />
          </Route>

          {/* Officer Operations Center (DashboardLayout) */}
          <Route path="/officer" element={<DashboardLayout />}>
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
