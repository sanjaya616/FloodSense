/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FloodHotspot } from '../../utils/floodLogic';
import { RiskBadge } from './RiskBadge';
import { RiskGauge } from './RiskGauge';
import { MapPin, Users, Clock, CloudRain, ShieldAlert, ArrowUpRight } from 'lucide-react';

interface HotspotCardProps {
  hotspot: FloodHotspot;
  onViewOnMap?: (hotspot: FloodHotspot) => void;
  onSelectDetails?: (hotspot: FloodHotspot) => void;
}

export const HotspotCard: React.FC<HotspotCardProps> = ({
  hotspot,
  onViewOnMap,
  onSelectDetails,
}) => {
  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all p-5 flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {hotspot.id}
              </span>
              <RiskBadge level={hotspot.riskLevel} size="sm" />
              <RiskBadge level={hotspot.verificationStatus} size="sm" />
            </div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              {hotspot.location}
            </h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-600" />
              {hotspot.area} Municipal Sector
            </p>
          </div>

          <div className="shrink-0">
            <RiskGauge
              score={hotspot.riskScore}
              level={hotspot.riskLevel}
              size={70}
              strokeWidth={6}
              showCategory={false}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 my-3 p-3 bg-slate-50 rounded-lg text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block font-sans">Unique Reports</span>
            <span className="font-bold text-slate-800 flex items-center gap-1">
              <Users className="w-3 h-3 text-cyan-600" />
              <span>{hotspot.reportCount}</span>
              {hotspot.duplicateReportCount ? (
                <span className="text-[10px] text-slate-500 font-normal">
                  (+{hotspot.duplicateReportCount} dup)
                </span>
              ) : null}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block font-sans">3h Rain Forecast</span>
            <span className="font-bold text-cyan-700 flex items-center gap-1">
              <CloudRain className="w-3 h-3 text-cyan-600" />
              {hotspot.rainfallSource === 'MISSING'
                ? 'Unavailable'
                : `${hotspot.forecastRainfallMm} mm`}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block font-sans">Coordinates</span>
            <span className="font-medium text-slate-600 truncate block text-[11px]">
              {hotspot.lat.toFixed(3)}, {hotspot.lng.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Actionable Precaution */}
        <div className="text-xs text-slate-700 bg-amber-50/60 border border-amber-200/60 p-2.5 rounded-lg mb-3">
          <span className="font-bold text-amber-900 block text-[10px] uppercase tracking-wider mb-0.5">
            Operational Recommendation
          </span>
          <p className="line-clamp-2 italic">{hotspot.precaution}</p>
        </div>
      </div>

      {/* Footer Details */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="text-slate-500 text-[11px] font-mono">
          <span>Active: {formatTime(hotspot.firstReportedTime)}</span>
          <span className="mx-1">→</span>
          <span>{formatTime(hotspot.latestReportedTime)}</span>
        </div>

        <div className="flex items-center gap-2">
          {onViewOnMap && (
            <button
              type="button"
              onClick={() => onViewOnMap(hotspot)}
              className="px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50 rounded-md transition-colors flex items-center gap-1"
            >
              <span>Map Pin</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onSelectDetails && (
            <button
              type="button"
              onClick={() => onSelectDetails(hotspot)}
              className="px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
            >
              Inspect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
