/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface RiskGaugeProps {
  score: number; // 0 - 100
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  size?: number;
  strokeWidth?: number;
  label?: string;
  showCategory?: boolean;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  level,
  size = 120,
  strokeWidth = 10,
  label,
  showCategory = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Limit to 270 degree arc for gauge look
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = () => {
    switch (level) {
      case 'HIGH':
        return {
          stroke: '#EF4444',
          bg: '#FEE2E2',
          text: 'text-red-700',
        };
      case 'MEDIUM':
        return {
          stroke: '#F59E0B',
          bg: '#FEF3C7',
          text: 'text-amber-700',
        };
      case 'LOW':
      default:
        return {
          stroke: '#22C55E',
          bg: '#DCFCE7',
          text: 'text-emerald-700',
        };
    }
  };

  const colors = getColor();

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Filled progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight leading-none">
            {score}
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
            / 100
          </span>
        </div>
      </div>

      {showCategory && (
        <div className="mt-2 text-center">
          <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
            {level} RISK
          </span>
          {label && <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>}
        </div>
      )}
    </div>
  );
};
