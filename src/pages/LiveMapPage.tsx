/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { FloodMap } from '../components/map/FloodMap';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  Search,
  Filter,
  MapPin,
  Flame,
  AlertTriangle,
  ShieldCheck,
  Droplets,
  Clock,
  Layers,
  ChevronRight,
  Maximize2,
  Navigation,
  PanelRightClose,
  PanelRightOpen,
  CloudRain,
  Compass,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { FloodReport, FloodHotspot } from '../utils/floodLogic';

export const LiveMapPage: React.FC = () => {
  const { reports, hotspots, setSelectedReportId, weather } = useFlood();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<
    'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERIFIED' | 'UNVERIFIED'
  >('ALL');
  const [activeTab, setActiveTab] = useState<'hotspots' | 'reports'>('hotspots');
  const [selectedHotspot, setSelectedHotspot] = useState<FloodHotspot | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Compute summary stats
  const totalActiveIncidents = reports.length;
  const confirmedHotspots = hotspots.filter((h) => h.verificationStatus === 'VERIFIED').length;
  const highRiskLocations = hotspots.filter((h) => h.riskLevel === 'HIGH').length;

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      !search ||
      r.location.toLowerCase().includes(search.toLowerCase()) ||
      r.area.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'HIGH') return r.riskLevel === 'HIGH';
    if (filterType === 'MEDIUM') return r.riskLevel === 'MEDIUM';
    if (filterType === 'LOW') return r.riskLevel === 'LOW';
    if (filterType === 'VERIFIED') return r.verificationStatus === 'VERIFIED';
    if (filterType === 'UNVERIFIED') return r.verificationStatus !== 'VERIFIED';
    return true;
  });

  // Filtered hotspots
  const filteredHotspots = hotspots.filter((h) => {
    const matchesSearch =
      !search ||
      h.location.toLowerCase().includes(search.toLowerCase()) ||
      h.area.toLowerCase().includes(search.toLowerCase()) ||
      h.id.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'HIGH') return h.riskLevel === 'HIGH';
    if (filterType === 'MEDIUM') return h.riskLevel === 'MEDIUM';
    if (filterType === 'LOW') return h.riskLevel === 'LOW';
    if (filterType === 'VERIFIED') return h.verificationStatus === 'VERIFIED';
    if (filterType === 'UNVERIFIED') return h.verificationStatus !== 'VERIFIED';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Operations Tactical Ribbon */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Live Colombo Flood GIS Operations Map</span>
            </h2>
            <span className="text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded">
              SECTOR 04 WATCH
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Geospatial surveillance layer synchronizing community telemetry with algorithmic clustering (500m buffers).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <Droplets className="w-4 h-4 text-cyan-600" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-semibold leading-tight font-sans">
                Active Reports
              </span>
              <span className="text-sm font-bold text-slate-900 font-mono leading-tight">
                {totalActiveIncidents}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <Flame className="w-4 h-4 text-amber-600" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-semibold leading-tight font-sans">
                Confirmed Hotspots
              </span>
              <span className="text-sm font-bold text-slate-900 font-mono leading-tight">
                {confirmedHotspots}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <div>
              <span className="text-[10px] text-red-700 uppercase block font-semibold leading-tight font-sans">
                High Risk Zones
              </span>
              <span className="text-sm font-bold text-red-800 font-mono leading-tight">
                {highRiskLocations}
              </span>
            </div>
          </div>

          {/* Toggle Panel Button */}
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            title={isPanelCollapsed ? 'Expand Side Inspector' : 'Collapse Side Inspector'}
          >
            {isPanelCollapsed ? (
              <PanelRightOpen className="w-4 h-4 text-cyan-700" />
            ) : (
              <PanelRightClose className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {/* Main Map + Collapsible Details Panel Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[660px]">
        {/* Map Area */}
        <div
          className={`${
            isPanelCollapsed ? 'lg:col-span-12' : 'lg:col-span-8 xl:col-span-9'
          } bg-white p-2 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col transition-all duration-300`}
        >
          <div className="flex-1 rounded-xl overflow-hidden min-h-[630px]">
            <FloodMap
              hotspots={filteredHotspots}
              reports={filteredReports}
              heightClass="h-full min-h-[630px]"
              selectedHotspotId={selectedHotspot?.id}
              onSelectHotspot={(h) => setSelectedHotspot(h)}
              onSelectReport={(r) => setSelectedReportId(r.id)}
            />
          </div>
        </div>

        {/* Right Filter & Details Panel */}
        {!isPanelCollapsed && (
          <div className="lg:col-span-4 xl:col-span-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between h-[660px]">
            <div>
              {/* Search & Tabs */}
              <div className="space-y-2.5 mb-3 pb-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    placeholder="Filter by sector, ID, road..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap gap-1">
                  {(['ALL', 'HIGH', 'MEDIUM', 'LOW', 'VERIFIED', 'UNVERIFIED'] as const).map(
                    (type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFilterType(type)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                          filterType === type
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {type}
                      </button>
                    )
                  )}
                </div>

                {/* View Switcher: Hotspots vs Reports */}
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveTab('hotspots')}
                    className={`py-1 text-xs font-bold rounded-md transition-colors ${
                      activeTab === 'hotspots'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Hotspots ({filteredHotspots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className={`py-1 text-xs font-bold rounded-md transition-colors ${
                      activeTab === 'reports'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Reports ({filteredReports.length})
                  </button>
                </div>
              </div>

              {/* List View */}
              <div className="overflow-y-auto max-h-[380px] space-y-2 pr-1">
                {activeTab === 'hotspots' ? (
                  filteredHotspots.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No matching hotspots</p>
                  ) : (
                    filteredHotspots.map((hs) => (
                      <div
                        key={hs.id}
                        onClick={() => setSelectedHotspot(hs)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          selectedHotspot?.id === hs.id
                            ? 'bg-cyan-50/60 border-cyan-400 ring-2 ring-cyan-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono font-bold text-slate-900">{hs.id}</span>
                          <RiskBadge level={hs.riskLevel} size="sm" />
                        </div>
                        <h4 className="font-bold text-slate-900 truncate mb-1">{hs.location}</h4>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>{hs.reportCount} Verified Reports</span>
                          <span className="font-bold text-cyan-700">
                            {hs.forecastRainfallMm} mm rain
                          </span>
                        </div>
                      </div>
                    ))
                  )
                ) : filteredReports.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No matching reports</p>
                ) : (
                  filteredReports.map((rep) => (
                    <div
                      key={rep.id}
                      onClick={() => setSelectedReportId(rep.id)}
                      className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-xs cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono font-bold text-slate-800">{rep.id}</span>
                        <RiskBadge level={rep.riskLevel} size="sm" />
                      </div>
                      <h4 className="font-bold text-slate-900 truncate mb-1">{rep.location}</h4>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>{rep.waterLevel}</span>
                        <span>{rep.floodType}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Hotspot Inspector Card */}
            {selectedHotspot && (
              <div className="pt-3 border-t border-slate-100 bg-slate-50 p-3 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Selected Hotspot</span>
                  <span className="text-xs font-mono font-bold text-slate-800">{selectedHotspot.id}</span>
                </div>
                <p className="text-xs font-bold text-slate-900 leading-snug truncate mb-1">
                  {selectedHotspot.location}
                </p>
                <p className="text-[11px] text-slate-600 line-clamp-2 italic mb-2">
                  "{selectedHotspot.precaution}"
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedHotspot(null)}
                  className="w-full py-1 text-center text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
