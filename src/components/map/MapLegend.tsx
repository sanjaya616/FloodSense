/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Layers, ShieldAlert, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface MapLegendProps {
  className?: string;
  showLayerToggle?: boolean;
  activeLayer?: 'all' | 'hotspots' | 'reports';
  onLayerChange?: (layer: 'all' | 'hotspots' | 'reports') => void;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  className = '',
  showLayerToggle = true,
  activeLayer = 'all',
  onLayerChange,
}) => {
  return (
    <div
      className={`bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-slate-200/90 shadow-md text-xs text-slate-700 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-600" />
          Map Legend & Layers
        </span>
        <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
          Colombo Metro
        </span>
      </div>

      {showLayerToggle && onLayerChange && (
        <div className="mb-3 grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => onLayerChange('all')}
            className={`py-1 text-[11px] font-medium rounded-md transition-colors ${
              activeLayer === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Pins
          </button>
          <button
            type="button"
            onClick={() => onLayerChange('hotspots')}
            className={`py-1 text-[11px] font-medium rounded-md transition-colors ${
              activeLayer === 'hotspots'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hotspots
          </button>
          <button
            type="button"
            onClick={() => onLayerChange('reports')}
            className={`py-1 text-[11px] font-medium rounded-md transition-colors ${
              activeLayer === 'reports'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reports
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-red-200 shadow-xs shrink-0" />
          <div className="flex items-center justify-between w-full">
            <span className="font-semibold text-red-950">High Risk Zone</span>
            <span className="text-[10px] text-slate-600 font-mono">≥3 reports / severe</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-amber-500 ring-2 ring-amber-200 shadow-xs shrink-0" />
          <div className="flex items-center justify-between w-full">
            <span className="font-semibold text-amber-950">Medium Risk Zone</span>
            <span className="text-[10px] text-slate-600 font-mono">≥2 reports / moderate</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shadow-xs shrink-0" />
          <div className="flex items-center justify-between w-full">
            <span className="font-semibold text-emerald-950">Low Risk Area</span>
            <span className="text-[10px] text-slate-600 font-mono">1 report / clear drain</span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-[10px] text-slate-600 leading-tight">
        <Info className="w-3 h-3 text-cyan-600 shrink-0 mt-0.5" />
        <span>Demonstration GIS coordinates centered on Colombo, Sri Lanka. Click markers for incident details.</span>
      </div>
    </div>
  );
};
