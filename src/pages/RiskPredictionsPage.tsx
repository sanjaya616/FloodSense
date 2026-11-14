/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { RiskGauge } from '../components/common/RiskGauge';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  Activity,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  FileCode2,
  ArrowRight,
  ShieldCheck,
  Compass,
  Sliders,
  Check,
  X,
  Info,
  RefreshCw,
} from 'lucide-react';
import { evaluateRiskLevel } from '../utils/floodLogic';

export const RiskPredictionsPage: React.FC = () => {
  const { hotspots, weather, refreshWeather, riskThresholds } = useFlood();

  // Interactive prototype rule tester sandbox
  const [testReports, setTestReports] = useState(3);
  const [testRainfall, setTestRainfall] = useState(25);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const testEvaluation = evaluateRiskLevel(testReports, testRainfall, riskThresholds);

  const handleRefreshWeather = async () => {
    setIsRefreshing(true);
    await refreshWeather();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Deterministic Flood Risk Rules & Early Warning Model
        </h2>
        <p className="text-sm text-slate-500">
          Transparent, rule-driven prototype hazard assessment correlating citizen incident density with radar precipitation forecasts.
        </p>
      </div>

      {/* Mandatory Academic Disclaimer */}
      <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200/90 flex items-start gap-3 text-xs text-amber-900">
        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider block mb-0.5 font-mono">
            Deterministic Prototype Risk Assessment — Not a Validated Hydrological Prediction Model
          </span>
          <p className="leading-relaxed text-amber-800">
            This module represents an academic engineering demonstration. Risk classifications (HIGH,
            MEDIUM, LOW) are computed using explicit deterministic threshold rules combining citizen
            report density and precipitation forecasts. This is not a validated hydrodynamic simulation
            nor an official meteorological prediction.
          </p>
        </div>
      </div>

      {/* Weather Telemetry Overview (Open-Meteo Integration) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CloudRain className="w-5 h-5 text-cyan-600" />
              <span>Colombo Basin Meteorological Telemetry</span>
            </h3>
            <p className="text-xs text-slate-500">
              Source: <strong className="text-slate-700">{weather.source}</strong> ({weather.isLive ? 'Live Open-Meteo' : 'Demonstration Telemetry'})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono bg-cyan-50 text-cyan-800 border border-cyan-200 px-2.5 py-1 rounded-lg">
              Updated {weather.updatedAt}
            </span>
            <button
              type="button"
              onClick={handleRefreshWeather}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Refresh meteorological telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Droplets className="w-4 h-4 text-cyan-600" />
              <span>Current Precipitation</span>
            </div>
            <span className="text-2xl font-extrabold text-slate-900 font-mono">
              {weather.currentRainfallMm}
              <span className="text-xs text-slate-500 font-sans font-normal ml-1">mm/hr</span>
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">{weather.status}</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Activity className="w-4 h-4 text-cyan-600" />
              <span>3-Hour Rainfall Forecast</span>
            </div>
            <span className="text-2xl font-extrabold text-cyan-700 font-mono">
              {weather.expected3hRainfallMm}
              <span className="text-xs text-slate-500 font-sans font-normal ml-1">mm</span>
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Expected cumulative waterload</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Thermometer className="w-4 h-4 text-amber-600" />
              <span>Temperature & Humidity</span>
            </div>
            <span className="text-2xl font-extrabold text-slate-900 font-mono">
              {weather.currentTempC}°C
              <span className="text-xs text-slate-500 font-sans font-normal ml-1">
                ({weather.humidityPercent}%)
              </span>
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">High condensation index</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Wind className="w-4 h-4 text-slate-600" />
              <span>Wind Velocity</span>
            </div>
            <span className="text-2xl font-extrabold text-slate-900 font-mono">
              {weather.windSpeedKmh}
              <span className="text-xs text-slate-500 font-sans font-normal ml-1">km/h {weather.windDirection}</span>
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Monsoonal vector</p>
          </div>
        </div>
      </div>

      {/* Prototype Rule Engine Explanation & Interactive Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Logic Rules Definition (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-cyan-600" />
                <span>Deterministic Rule Engine (Thresholds Configurable in Settings)</span>
              </h3>
              <p className="text-xs text-slate-500">
                HIGH is evaluated strictly before MEDIUM.
              </p>
            </div>
            <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
              Active Parameters
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* High Rule */}
            <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50">
              <div className="flex items-center justify-between font-bold text-red-900 mb-1">
                <span className="flex items-center gap-1.5">
                  <RiskBadge level="HIGH" size="sm" />
                  <span>CRITICAL HAZARD RULE</span>
                </span>
                <span className="font-mono text-xs">Score: 75 – 100</span>
              </div>
              <p className="text-slate-700 leading-relaxed font-mono bg-white p-2 rounded-lg border border-red-100 text-[11px]">
                IF (Citizen Reports ≥ {riskThresholds.highReportCount}) AND (3h Forecast Rainfall &gt; {riskThresholds.highRainfallMm} mm)
              </p>
              <p className="text-[11px] text-slate-600 mt-1.5">
                Triggers when high citizen report volume coincides with heavy precipitation forecast.
              </p>
            </div>

            {/* Medium Rule */}
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
              <div className="flex items-center justify-between font-bold text-amber-900 mb-1">
                <span className="flex items-center gap-1.5">
                  <RiskBadge level="MEDIUM" size="sm" />
                  <span>WATCH & CAUTION RULE</span>
                </span>
                <span className="font-mono text-xs">Score: 45 – 74</span>
              </div>
              <p className="text-slate-700 leading-relaxed font-mono bg-white p-2 rounded-lg border border-amber-100 text-[11px]">
                IF (Citizen Reports ≥ {riskThresholds.mediumReportCount}) OR (3h Forecast Rainfall &gt; {riskThresholds.mediumRainfallMm} mm)
              </p>
              <p className="text-[11px] text-slate-600 mt-1.5">
                Triggers when either report density is moderate or radar forecast exceeds {riskThresholds.mediumRainfallMm}mm.
              </p>
            </div>

            {/* Low Rule */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center justify-between font-bold text-emerald-900 mb-1">
                <span className="flex items-center gap-1.5">
                  <RiskBadge level="LOW" size="sm" />
                  <span>NOMINAL SURVEILLANCE</span>
                </span>
                <span className="font-mono text-xs">Score: 10 – 44</span>
              </div>
              <p className="text-slate-700 leading-relaxed font-mono bg-white p-2 rounded-lg border border-emerald-100 text-[11px]">
                OTHERWISE (Reports &lt; {riskThresholds.mediumReportCount} AND Rain ≤ {riskThresholds.mediumRainfallMm} mm)
              </p>
              <p className="text-[11px] text-slate-600 mt-1.5">
                Baseline runoff manageable within municipal canal capacity.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Simulator Card (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Interactive Rule Sandbox</h3>
              <p className="text-xs text-slate-500">
                Adjust input variables to inspect real-time deterministic classification output.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-800 mb-1">
                  <span>Simulated Citizen Reports:</span>
                  <span className="font-mono text-cyan-700 text-sm">{testReports} reports</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={testReports}
                  onChange={(e) => setTestReports(parseInt(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-800 mb-1">
                  <span>Forecast 3h Rainfall:</span>
                  <span className="font-mono text-cyan-700 text-sm">{testRainfall} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={testRainfall}
                  onChange={(e) => setTestRainfall(parseInt(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              {/* Real-time Calculation Result */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4">
                <RiskGauge
                  score={testEvaluation.score}
                  level={testEvaluation.riskLevel}
                  size={90}
                  strokeWidth={8}
                />
                <div className="flex-1">
                  <div className="mb-1">
                    <RiskBadge level={testEvaluation.riskLevel} size="md" />
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    {testEvaluation.reasoning}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 italic">
            "{testEvaluation.precaution}"
          </div>
        </div>
      </div>

      {/* Hotspots Predictive Risk Cards with Detailed Rule Breakdown */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span>Sector Hotspot Prediction Matrix with Rule Traceability</span>
          <span className="text-xs font-mono font-normal text-slate-400">
            ({hotspots.length} Monitored Zones)
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {hotspots.map((hs) => {
            const evaluation = evaluateRiskLevel(hs.reportCount, hs.forecastRainfallMm, riskThresholds);

            return (
              <div
                key={hs.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {hs.id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight mt-1">
                        {hs.location}
                      </h4>
                      <p className="text-xs text-slate-500">{hs.area} Sector</p>
                    </div>
                    <RiskGauge
                      score={evaluation.score}
                      level={evaluation.riskLevel}
                      size={65}
                      strokeWidth={6}
                      showCategory={false}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-2 p-2.5 bg-slate-50 rounded-xl text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans block">
                        Report Count
                      </span>
                      <span className="font-bold text-slate-800">
                        {hs.reportCount} unique
                        {hs.duplicateReportCount ? ` (+${hs.duplicateReportCount} dup)` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans block">
                        3h Rainfall
                      </span>
                      <span className="font-bold text-cyan-700">
                        {hs.rainfallSource === 'MISSING'
                          ? 'Unavailable (MISSING)'
                          : `${hs.forecastRainfallMm} mm`}
                      </span>
                    </div>
                  </div>

                  {/* Visual Rule Traceability Breakdown */}
                  <div className="p-2.5 bg-slate-50/90 rounded-xl border border-slate-200 text-[11px] space-y-1 font-mono">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block font-sans">
                      Rule Evaluation Trace
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">High Threshold Met:</span>
                      <span className={evaluation.breakdown.highRuleMet ? 'text-red-700 font-bold' : 'text-slate-400'}>
                        {evaluation.breakdown.highRuleMet ? 'YES (Triggered)' : 'NO'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Medium Threshold Met:</span>
                      <span className={evaluation.breakdown.mediumRuleMet ? 'text-amber-700 font-bold' : 'text-slate-400'}>
                        {evaluation.breakdown.mediumRuleMet ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 font-sans">
                      {evaluation.reasoning}
                    </p>
                  </div>

                  <div className="text-xs text-slate-700 bg-slate-50/60 p-2.5 rounded-xl border border-slate-200/70 mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                      Recommended Precaution
                    </span>
                    <p className="line-clamp-2 italic">{evaluation.precaution}</p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <RiskBadge level={evaluation.riskLevel} size="sm" />
                  <span className="text-[11px] font-mono text-slate-500">
                    Calculated Score: {evaluation.score}/100
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
