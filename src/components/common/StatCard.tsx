/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  colorScheme?: 'primary' | 'danger' | 'warning' | 'success';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorScheme = 'primary',
}) => {
  const schemeStyles = {
    primary: {
      iconBg: 'bg-cyan-50 text-cyan-600 border border-cyan-100',
      borderHover: 'hover:border-cyan-300',
      glow: 'from-cyan-500/5',
    },
    danger: {
      iconBg: 'bg-red-50 text-red-600 border border-red-100',
      borderHover: 'hover:border-red-300',
      glow: 'from-red-500/5',
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      borderHover: 'hover:border-amber-300',
      glow: 'from-amber-500/5',
    },
    success: {
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      borderHover: 'hover:border-emerald-300',
      glow: 'from-emerald-500/5',
    },
  }[colorScheme];

  return (
    <div
      className={`relative overflow-hidden bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs transition-all duration-200 ${schemeStyles.borderHover}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
              {value}
            </span>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${schemeStyles.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500">{subtitle}</span>
        {trend && (
          <div
            className={`flex items-center gap-1 font-medium font-mono ${
              trend.isNeutral
                ? 'text-slate-600'
                : trend.isPositive
                ? 'text-emerald-700'
                : 'text-rose-700'
            }`}
          >
            {trend.isNeutral ? (
              <Minus className="w-3.5 h-3.5" />
            ) : trend.isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </div>
  );
};
