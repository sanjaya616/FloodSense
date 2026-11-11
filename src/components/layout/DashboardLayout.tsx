/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useFlood } from '../../context/FloodContext';
import { IncidentDetailsModal } from '../common/IncidentDetailsModal';
import { AlertCircle, ShieldAlert, Radio, Droplets } from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { reports, selectedReportId, setSelectedReportId, updateIncidentStatus } = useFlood();

  const selectedReport = reports.find((r) => r.id === selectedReportId) || null;

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navigation Bar */}
        <Topbar onToggleSidebar={() => setSidebarOpen(true)} />

        {/* Global System Status Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-[#101C2C] to-slate-900 text-white px-4 sm:px-6 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold tracking-wide uppercase text-[11px] text-cyan-300">
              Flood Monitoring System Active
            </span>
            <span className="hidden md:inline text-slate-400">|</span>
            <span className="hidden md:inline text-slate-300">
              Colombo Basin Telemetry & Community Early Warning
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <Radio className="w-3 h-3 text-emerald-400" />
              Sensor Grid Nominal
            </span>
            <span>·</span>
            <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded font-sans font-semibold">
              Emerging Tech Prototype
            </span>
          </div>
        </div>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Incident Details Modal */}
      {selectedReport && (
        <IncidentDetailsModal
          report={selectedReport}
          onClose={() => setSelectedReportId(null)}
          onVerify={(id) => updateIncidentStatus(id, 'Verified', 'Verified via quick action')}
        />
      )}
    </div>
  );
};
