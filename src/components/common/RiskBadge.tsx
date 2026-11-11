/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, ShieldCheck, Clock, XCircle } from 'lucide-react';

interface RiskBadgeProps {
  level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERIFIED' | 'UNDER REVIEW' | 'REJECTED' | 'CONFIRMED (SIMULATED)' | 'PENDING (SIMULATED)';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const getStyle = () => {
    switch (level) {
      case 'HIGH':
        return {
          bg: 'bg-red-50 text-red-700 border border-red-200',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />,
          label: 'HIGH RISK',
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-50 text-amber-800 border border-amber-200',
          icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
          label: 'MEDIUM RISK',
        };
      case 'LOW':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
          label: 'LOW RISK',
        };
      case 'VERIFIED':
        return {
          bg: 'bg-cyan-50 text-cyan-800 border border-cyan-200',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />,
          label: 'VERIFIED',
        };
      case 'UNDER REVIEW':
        return {
          bg: 'bg-slate-100 text-slate-700 border border-slate-200',
          icon: <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />,
          label: 'UNDER REVIEW',
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-50 text-rose-700 border border-rose-200',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />,
          label: 'REJECTED',
        };
      case 'CONFIRMED (SIMULATED)':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
          label: 'CONFIRMED (ON-CHAIN)',
        };
      case 'PENDING (SIMULATED)':
        return {
          bg: 'bg-amber-50 text-amber-800 border border-amber-200',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
          label: 'PENDING CONSENSUS',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border border-slate-200',
          icon: null,
          label: level,
        };
    }
  };

  const { bg, icon, label } = getStyle();

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md uppercase tracking-wider ${bg} ${sizeClasses} ${className}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};
