/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { useNavigate } from 'react-router-dom';
import { HotspotCard } from '../components/common/HotspotCard';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  Flame,
  Search,
  Filter,
  Layers,
  MapPin,
  Clock,
  Info,
  ShieldAlert,
  ArrowRight,
  Droplets,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { FloodHotspot } from '../utils/floodLogic';

export const FloodHotspotsPage: React.FC = () => {
  const {
    hotspots,
    reports,
    setSelectedHotspotId,
    setSelectedReportId,
    clusteringConfig,
  } = useFlood();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [selectedHotspotForModal, setSelectedHotspotForModal] = useState<FloodHotspot | null>(null);

  const filteredHotspots = hotspots.filter((h) => {
    const matchesSearch =
      !search ||
      h.location.toLowerCase().includes(search.toLowerCase()) ||
      h.area.toLowerCase().includes(search.toLowerCase()) ||
      h.id.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity = filterSeverity === 'ALL' || h.riskLevel === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const handleOpenOnMap = (hs: FloodHotspot) => {
    setSelectedHotspotId(hs.id);
    navigate('/officer/map');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Flood Hotspot Clusters
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Algorithmic incident aggregation identifying high-risk stormwater pooling zones across Colombo.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search hotspots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center bg-white border border-slate-200 p-1 rounded-lg shadow-2xs">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  filterSeverity === sev
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clustering Concept Explainer Banner */}
      <div className="bg-gradient-to-r from-cyan-900 to-[#101C2C] text-white p-5 rounded-2xl shadow-sm border border-cyan-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 max-w-2xl">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/20 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <span>Geospatial Hotspot Clustering Model (Haversine Formula)</span>
              <span className="text-[10px] bg-cyan-400/20 text-cyan-200 px-2 py-0.5 rounded font-mono font-normal">
                Radius ≤ {clusteringConfig.spatialRadiusMeters}m · Window ≤ {clusteringConfig.temporalWindowHours}h
              </span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              When individual citizen reports and stormwater sensors report rising water within a {clusteringConfig.spatialRadiusMeters}-meter
              radius inside a {clusteringConfig.temporalWindowHours}-hour temporal window, FloodSense clusters them into an authoritative
              Hotspot. This avoids alert fatigue and equips municipal drainage crews with localized tasking.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/officer/predictions')}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5"
        >
          <span>View Predictive Rules</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Hotspots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredHotspots.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <p className="text-sm font-bold text-slate-700">No flood hotspots found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search criteria or risk filter.
            </p>
          </div>
        ) : (
          filteredHotspots.map((hotspot) => (
            <HotspotCard
              key={hotspot.id}
              hotspot={hotspot}
              onViewOnMap={handleOpenOnMap}
              onSelectDetails={(hs) => setSelectedHotspotForModal(hs)}
            />
          ))
        )}
      </div>

      {/* Hotspot Detailed Inspection Modal */}
      {selectedHotspotForModal && (
        <div className="fixed inset-0 z-1000 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-900">
                    {selectedHotspotForModal.id}
                  </span>
                  <RiskBadge level={selectedHotspotForModal.riskLevel} />
                  <RiskBadge level={selectedHotspotForModal.verificationStatus} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedHotspotForModal.location}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedHotspotForModal.area} Sector · GPS: {selectedHotspotForModal.lat.toFixed(4)},{' '}
                  {selectedHotspotForModal.lng.toFixed(4)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHotspotForModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Clustering Statistics & Formation Details */}
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans">
                  Total Observations
                </span>
                <span className="text-base font-bold text-slate-900">
                  {selectedHotspotForModal.reportCount} Unique
                  {selectedHotspotForModal.duplicateReportCount
                    ? ` (+${selectedHotspotForModal.duplicateReportCount} dup)`
                    : ''}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans">
                  Risk Computation
                </span>
                <span className="text-base font-bold text-red-600">
                  {selectedHotspotForModal.riskScore}/100
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-sans">
                  3h Rainfall Forecast
                </span>
                <span className="text-base font-bold text-cyan-700">
                  {selectedHotspotForModal.rainfallSource === 'MISSING'
                    ? 'Unavailable'
                    : `${selectedHotspotForModal.forecastRainfallMm} mm`}
                </span>
              </div>
            </div>

            {/* How this cluster was formed */}
            <div className="p-3 bg-cyan-50/60 rounded-xl border border-cyan-200/80 text-xs space-y-1.5 font-mono">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 block font-sans">
                Haversine Cluster Formation Trace
              </span>
              <div className="flex justify-between text-slate-700">
                <span>Spatial Radius:</span>
                <strong className="text-slate-900">≤ {selectedHotspotForModal.clusterRadiusMeters || 500} meters</strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>First Incident:</span>
                <span>{new Date(selectedHotspotForModal.firstReportedTime).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Latest Incident:</span>
                <span>{new Date(selectedHotspotForModal.latestReportedTime).toLocaleTimeString()}</span>
              </div>
              {selectedHotspotForModal.formationDetails && (
                <p className="text-[11px] text-slate-600 pt-1 border-t border-cyan-200/60 font-sans">
                  {selectedHotspotForModal.formationDetails.reasoning}
                </p>
              )}
            </div>

            {/* Operational Precaution */}
            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 text-xs">
              <span className="font-bold uppercase tracking-wider text-amber-900 block mb-1">
                Field Deployment Protocol
              </span>
              <p className="text-slate-800 leading-relaxed italic">
                "{selectedHotspotForModal.precaution}"
              </p>
            </div>

            {/* Associated Reports List */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Clustered Citizen Reports ({selectedHotspotForModal.associatedReportIds.length})
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {reports
                  .filter((r) =>
                    selectedHotspotForModal.associatedReportIds.includes(r.id) ||
                    r.hotspotId === selectedHotspotForModal.id
                  )
                  .map((rep) => (
                    <div
                      key={rep.id}
                      onClick={() => {
                        setSelectedHotspotForModal(null);
                        setSelectedReportId(rep.id);
                      }}
                      className="p-3 rounded-lg border border-slate-200 hover:border-cyan-400 bg-white cursor-pointer transition-colors text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono font-bold text-slate-800">{rep.id}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-semibold text-slate-700">{rep.waterLevel}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">{rep.floodType}</span>
                        </div>
                        <p className="text-slate-600 line-clamp-1">{rep.location}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-cyan-600 shrink-0" />
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedHotspotForModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleOpenOnMap(selectedHotspotForModal);
                  setSelectedHotspotForModal(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>Navigate to Map View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
