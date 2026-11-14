/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  MapPin,
  Search,
  Filter,
  PlusCircle,
  AlertTriangle,
  Info,
  Droplets,
  Layers,
  ChevronRight,
  Shield,
  PhoneCall,
  Clock,
  Car,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { FloodMap } from '../../components/map/FloodMap';
import { RiskBadge } from '../../components/common/RiskBadge';
import { IncidentDetailsModal } from '../../components/common/IncidentDetailsModal';
import { FloodReport, FloodHotspot } from '../../utils/floodLogic';

export const PublicMapPage: React.FC = () => {
  const { hotspots, reports, weather } = useFlood();
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeReportModal, setActiveReportModal] = useState<FloodReport | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<FloodHotspot | null>(null);

  // Extract distinct Colombo municipal areas
  const distinctAreas = useMemo(() => {
    const set = new Set<string>();
    hotspots.forEach((h) => set.add(h.area));
    reports.forEach((r) => set.add(r.area));
    return Array.from(set).sort();
  }, [hotspots, reports]);

  // Filter hotspots and reports
  const filteredHotspots = useMemo(() => {
    return hotspots.filter((h) => {
      const matchArea = selectedArea === 'ALL' || h.area === selectedArea;
      const matchRisk = selectedRisk === 'ALL' || h.riskLevel === selectedRisk;
      const matchSearch =
        searchTerm === '' ||
        h.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.area.toLowerCase().includes(searchTerm.toLowerCase());
      return matchArea && matchRisk && matchSearch;
    });
  }, [hotspots, selectedArea, selectedRisk, searchTerm]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchArea = selectedArea === 'ALL' || r.area === selectedArea;
      const matchRisk = selectedRisk === 'ALL' || r.riskLevel === selectedRisk;
      const matchSearch =
        searchTerm === '' ||
        r.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.area.toLowerCase().includes(searchTerm.toLowerCase());
      return matchArea && matchRisk && matchSearch;
    });
  }, [reports, selectedArea, selectedRisk, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 mb-1">
            <NavLink to="/" className="hover:underline">
              Home
            </NavLink>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>Public Flood Map</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Live Urban Flood Map • Colombo
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Public roadway waterlogging, active hotspot clusters, and traffic passability advisories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NavLink
            to="/citizen/report"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md shadow-cyan-600/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report Flooded Road</span>
          </NavLink>
        </div>
      </div>

      {/* Advisory Banner (Computed dynamically from active hotspots) */}
      {(() => {
        const highAreas = Array.from(
          new Set(hotspots.filter((h) => h.riskLevel === 'HIGH').map((h) => h.area))
        );
        const mediumAreas = Array.from(
          new Set(hotspots.filter((h) => h.riskLevel === 'MEDIUM').map((h) => h.area))
        );
        const advisoryText =
          highAreas.length > 0
            ? `HIGH risk flood clusters active in ${highAreas.join(', ')}. Avoid low-lying underpasses and inundated intersections.`
            : mediumAreas.length > 0
            ? `Moderate runoff watch in ${mediumAreas.join(', ')}. Exercise caution near canal corridors.`
            : 'No HIGH or MEDIUM risk flood hotspot clusters currently active across monitored Colombo wards.';

        return (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Colombo Flood Advisory: </span>
                <span>{advisoryText}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-lg shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {weather.isLive
                  ? `Open-Meteo Forecast API (${weather.updatedAt})`
                  : 'Simulated Monsoon Scenario (Demo Mode)'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Search by street name, landmark, or district (e.g., Maradana, Baseline Rd)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Area Selector */}
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="ALL">All Municipal Areas ({distinctAreas.length})</option>
            {distinctAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>

          {/* Risk Level Filter */}
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="ALL">All Risk Severities</option>
            <option value="HIGH">High Severity Only</option>
            <option value="MEDIUM">Medium Severity</option>
            <option value="LOW">Low / Receding</option>
          </select>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-2">
        <FloodMap
          hotspots={filteredHotspots}
          reports={filteredReports}
          selectedHotspotId={selectedHotspot?.id}
          onSelectHotspot={(h) => setSelectedHotspot(h)}
          onSelectReport={(r) => setActiveReportModal(r)}
          heightClass="h-[520px]"
          showLegendOverlay={true}
          showSectorControls={true}
        />
      </div>

      {/* Quick Cards Grid: Active Hotspot Summary */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Active Clustered Flood Hotspots ({filteredHotspots.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredHotspots.map((hotspot) => (
            <div
              key={hotspot.id}
              onClick={() => setSelectedHotspot(hotspot)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white ${
                selectedHotspot?.id === hotspot.id
                  ? 'border-cyan-500 ring-2 ring-cyan-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-slate-500">{hotspot.id}</span>
                <RiskBadge level={hotspot.riskLevel} />
              </div>

              <h4 className="font-bold text-slate-900 text-sm leading-snug">{hotspot.location}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{hotspot.area} Municipal Basin</p>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-600">
                <span>
                  {hotspot.reportCount} unique ({hotspot.verificationStatus === 'VERIFIED' ? 'Includes Verified' : 'Unverified'})
                </span>
                <span className="text-cyan-700 font-bold">
                  {hotspot.rainfallSource === 'MISSING' ? 'Rain: N/A' : `${hotspot.forecastRainfallMm} mm rain`}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 mt-2 bg-slate-50 p-2 rounded-xl line-clamp-2">
                {hotspot.precaution}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Incident Details Modal (Safe public inspection) */}
      {activeReportModal && (
        <IncidentDetailsModal
          report={activeReportModal}
          onClose={() => setActiveReportModal(null)}
        />
      )}
    </div>
  );
};
