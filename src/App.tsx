/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FloodProvider } from './context/FloodContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OverviewPage } from './pages/OverviewPage';
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
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/map" element={<LiveMapPage />} />
            <Route path="/report" element={<ReportFloodPage />} />
            <Route path="/hotspots" element={<FloodHotspotsPage />} />
            <Route path="/predictions" element={<RiskPredictionsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/blockchain" element={<BlockchainRegistryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FloodProvider>
  );
}
