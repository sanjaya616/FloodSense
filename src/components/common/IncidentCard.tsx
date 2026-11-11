/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FloodReport } from '../../utils/floodLogic';
import { RiskBadge } from './RiskBadge';
import { Clock, MapPin, Droplets, ChevronRight, CheckCircle2, ShieldCheck, Radio } from 'lucide-react';

interface IncidentCardProps {
  report: FloodReport;
  onSelect: (report: FloodReport) => void;
  isSelected?: boolean;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  report,
  onSelect,
  isSelected = false,
}) => {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const statusLabel = report.incidentStatus || report.verificationStatus;

  return (
    <div
      onClick={() => onSelect(report)}
      className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer bg-white ${
        isSelected
          ? 'border-cyan-500 ring-2 ring-cyan-100 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
            {report.id}
          </span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            {formatTime(report.timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <RiskBadge level={report.riskLevel} size="sm" />
          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              statusLabel === 'Alert Issued'
                ? 'bg-red-100 text-red-800'
                : statusLabel === 'Resolved'
                ? 'bg-emerald-100 text-emerald-800'
                : statusLabel === 'Verified'
                ? 'bg-cyan-100 text-cyan-800'
                : statusLabel === 'Rejected'
                ? 'bg-slate-200 text-slate-700'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-slate-900 leading-snug mb-1.5 line-clamp-1">
        {report.location}
      </h4>

      <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
        {report.description}
      </p>

      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-100 text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Droplets className="w-3.5 h-3.5 text-cyan-600" />
            <span className="font-medium text-slate-700">{report.waterLevel}</span>
          </span>
          <span>·</span>
          <span className="text-[11px] truncate max-w-[130px]">{report.floodType}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(report);
          }}
          className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 flex items-center gap-0.5 group"
        >
          <span>View Details</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
