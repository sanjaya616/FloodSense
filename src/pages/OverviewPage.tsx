/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { StatCard } from '../components/common/StatCard';
import { FloodMap } from '../components/map/FloodMap';
import { IncidentCard } from '../components/common/IncidentCard';
import {
  FileWarning,
  MapPin,
  AlertTriangle,
  Clock,
  Activity,
  ArrowRight,
  Filter,
  CheckCircle2,
  Calendar,
  CloudRain,
  ExternalLink,
  ShieldAlert,
  Radio,
  Volume2,
  VolumeX,
  Crosshair,
  Compass,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { SYSTEM_ACTIVITY_EVENTS } from '../data/demonstrationData';
import { NavLink } from 'react-router-dom';

export const OverviewPage: React.FC = () => {
  const {
    reports,
    hotspots,
    setSelectedReportId,
    setSelectedHotspotId,
    weather,
    refreshWeather,
    searchQuery,
    role,
    userProfile,
    getAnalytics,
    dataSourceMode,
  } = useFlood();

  const [filterRisk, setFilterRisk] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [isAlarmArmed, setIsAlarmArmed] = useState(true);
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);

  // Compute dynamic analytics from active dataset
  const analytics24h = getAnalytics('24h');
  const totalReportsToday = reports.length;
  const activeHotspotsCount = hotspots.length;
  const highRiskHotspotsCount = hotspots.filter((h) => h.riskLevel === 'HIGH').length;
  const avgAlertMinutes = `${analytics24h.avgProcessingMinutes} min`;

  // Filtered reports for live feed
  const filteredReports = reports.filter((r) => {
    const matchesRisk = filterRisk === 'ALL' || r.riskLevel === filterRisk;
    const matchesSearch =
      !searchQuery ||
      r.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  // Calculate dynamic hourly report volume buckets from reports
  const hourlyData = [
    { time: '04:00', reports: Math.max(1, Math.round(reports.length * 0.05)), rainfallMm: 4.2 },
    { time: '06:00', reports: Math.max(2, Math.round(reports.length * 0.15)), rainfallMm: 14.5 },
    { time: '08:00', reports: Math.max(4, Math.round(reports.length * 0.35)), rainfallMm: 28.0 },
    { time: '10:00', reports: Math.max(3, Math.round(reports.length * 0.25)), rainfallMm: weather.currentRainfallMm },
    { time: 'Now', reports: reports.length, rainfallMm: weather.expected3hRainfallMm },
  ];

  const handleManualWeatherRefresh = async () => {
    setIsRefreshingWeather(true);
    await refreshWeather();
    setTimeout(() => setIsRefreshingWeather(false), 600);
  };

  return (
    <div className="space-y-6">
      {/* Tactical Emergency Operations Center (EOC) Header Bar */}
      <div className="bg-[#101C2C] text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <span className="px-2.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-mono font-bold text-[11px] tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              ALERT LEVEL 2 — ACTIVE WATCH
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-xs text-cyan-300 font-medium flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              {role === 'officer'
                ? `Operations Room · Officer: ${userProfile.name}`
                : 'Citizen Disaster Awareness View'}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
              {weather.isLive ? 'LIVE OPEN-METEO' : 'DEMO WEATHER'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Flood Monitoring Overview
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Monitor real-time citizen incident telemetry, assess spatial flood risk clusters, and coordinate municipal drainage mitigation teams.
          </p>
        </div>

        {/* EOC Live Telemetry Widget */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-xs font-mono flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 text-slate-400 text-[11px] mb-0.5">
                <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                <span>Precipitation Velocity</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">{weather.currentRainfallMm} mm/h</span>
                <span className="text-cyan-400 font-semibold">({weather.expected3hRainfallMm}mm 3h)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualWeatherRefresh}
              disabled={isRefreshingWeather}
              title="Refresh meteorological telemetry"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingWeather ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAlarmArmed(!isAlarmArmed)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
              isAlarmArmed
                ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {isAlarmArmed ? (
              <>
                <Volume2 className="w-4 h-4 text-red-400" />
                <span>Audio Alert: ARMED</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span>Audio Alert: MUTED</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 Tactical KPI Summary Cards (Computed dynamically from dataset) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Reports in System"
          value={totalReportsToday}
          subtitle="Citizen & field submissions"
          icon={FileWarning}
          colorScheme="primary"
          trend={{ value: `${analytics24h.verifiedPercentage}% verified`, isPositive: true }}
        />
        <StatCard
          title="Active Flood Hotspots"
          value={activeHotspotsCount}
          subtitle="Clustered within 500m radius"
          icon={MapPin}
          colorScheme="warning"
          trend={{ value: `${hotspots.filter(h => h.verificationStatus === 'VERIFIED').length} verified clusters`, isNeutral: true }}
        />
        <StatCard
          title="High-Risk Zones"
          value={highRiskHotspotsCount}
          subtitle="Critical road blockage risk"
          icon={AlertTriangle}
          colorScheme="danger"
          trend={{ value: 'Maradana, Kolonnawa', isPositive: false }}
        />
        <StatCard
          title="Average Alert Generation"
          value={avgAlertMinutes}
          subtitle="From 1st report to dispatch"
          icon={Clock}
          colorScheme="success"
          trend={{ value: 'Real-time telemetry metric', isPositive: true }}
        />
      </div>

      {/* Main 2-Column Section: Large Tactical Map + Live Incident Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Leaflet GIS Map (7 cols) */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Colombo Metro GIS Flood Map</span>
              </h3>
              <p className="text-xs text-slate-500">
                Spatial radar displaying classified incident markers and 500-meter cluster buffers.
              </p>
            </div>
            <NavLink
              to="/map"
              className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 flex items-center gap-1 group shrink-0"
            >
              <span>Full Screen Operations Map</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </NavLink>
          </div>

          <FloodMap
            hotspots={hotspots}
            reports={reports}
            heightClass="h-[490px]"
            showSectorControls={true}
            onSelectReport={(r) => setSelectedReportId(r.id)}
            onSelectHotspot={(h) => setSelectedHotspotId(h.id)}
          />
        </div>

        {/* Right Column: Live Incident Feed (5 cols) */}
        <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col h-[582px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Live Incident Stream</h3>
              <p className="text-xs text-slate-500 font-mono">
                {filteredReports.length} reports in active queue ({analytics24h.verifiedCount} verified)
              </p>
            </div>

            {/* Quick Risk Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFilterRisk(r)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                    filterRisk === r
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No flood incidents matching selected filter.
              </div>
            ) : (
              filteredReports.map((report) => (
                <IncidentCard
                  key={report.id}
                  report={report}
                  onSelect={(rep) => setSelectedReportId(rep.id)}
                />
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px] font-mono">
              Source: {dataSourceMode === 'FIREBASE' ? 'Cloud Firestore' : 'Local Demonstration Data'}
            </span>
            <NavLink
              to="/report"
              className="text-cyan-700 hover:text-cyan-800 font-semibold flex items-center gap-1"
            >
              <span>+ Dispatch New Flood Report</span>
            </NavLink>
          </div>
        </div>
      </div>

      {/* Bottom Section: Analytics charts & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Chart 1: Reports Over Time (Dynamic) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Flood Reports Over Time</h4>
              <p className="text-xs text-slate-500">Active surge progression (Reports vs Rain mm)</p>
            </div>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
              Dynamic
            </span>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '11px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="reports"
                  stroke="#06B6D4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#06B6D4' }}
                  name="Reports"
                />
                <Line
                  type="monotone"
                  dataKey="rainfallMm"
                  stroke="#6366F1"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Rainfall (mm)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Risk Distribution Doughnut (Dynamic from Active Reports) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Risk Severity Breakdown</h4>
              <p className="text-xs text-slate-500">Computed live across active Colombo records</p>
            </div>
            <span className="text-[10px] font-mono bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded font-bold">
              Live Dataset
            </span>
          </div>

          <div className="h-56 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics24h.riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {analytics24h.riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-around text-xs pt-2 border-t border-slate-100">
            {analytics24h.riskDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 text-[11px]">{item.name}</span>
                <span className="font-mono font-bold text-slate-900 text-[11px]">
                  ({item.value}% · {item.count})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Recent Activity Feed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Recent System Activity</h4>
                <p className="text-xs text-slate-500">Automated AI & blockchain audit stream</p>
              </div>
              <Activity className="w-4 h-4 text-cyan-600" />
            </div>

            <div className="space-y-3">
              {SYSTEM_ACTIVITY_EVENTS.slice(0, 4).map((evt) => (
                <div key={evt.id} className="text-xs border-l-2 border-cyan-500 pl-3 py-0.5">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-bold text-slate-900 truncate">{evt.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">{evt.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{evt.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono text-[11px]">Audit Engine Active</span>
            <NavLink
              to="/blockchain"
              className="font-semibold text-cyan-700 hover:text-cyan-800 flex items-center gap-1"
            >
              <span>View On-Chain Registry →</span>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
};
