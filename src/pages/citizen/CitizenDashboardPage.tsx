/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  PlusCircle,
  FileText,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  CloudRain,
  MapPin,
  Camera,
  Activity,
  Bell,
  Flame,
  ImageOff,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { RiskBadge } from '../../components/common/RiskBadge';
import { FloodMap } from '../../components/map/FloodMap';

export const CitizenDashboardPage: React.FC = () => {
  const { userProfile, myReports, weather, hotspots, reports, notifications } = useFlood();

  const underReviewCount = myReports.filter(
    (r) =>
      r.incidentStatus === 'Submitted' ||
      r.incidentStatus === 'Under Review' ||
      r.incidentStatus === 'More Info Requested'
  ).length;

  const verifiedCount = myReports.filter(
    (r) => r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued'
  ).length;

  const resolvedCount = myReports.filter((r) => r.incidentStatus === 'Resolved').length;

  // Recent 3 citizen reports
  const recentReports = myReports.slice(0, 3);
  const topHotspots = hotspots.slice(0, 3);
  const topNotifications = notifications.slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 font-sans">
      {/* Welcome & Persona Banner */}
      <div className="bg-gradient-to-r from-cyan-900 via-slate-900 to-blue-950 rounded-3xl p-6 sm:p-8 text-white border border-cyan-800/40 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-cyan-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                Citizen Reporting Sentinel • Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {userProfile.name}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Your real-time flood reports provide critical ground-truth data for the Disaster
              Management Centre (DMC) and help protect motorists in Colombo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <NavLink
              to="/citizen/report"
              className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 group shrink-0"
            >
              <PlusCircle className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform" />
              <span>Report Flooded Road</span>
            </NavLink>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>My Total Reports</span>
            <FileText className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-2">
            {myReports.length}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Contributed to Colombo EOC</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
            <span>Under DMC Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-700 font-mono mt-2">
            {underReviewCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Queued for officer triage</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Verified Incidents</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono mt-2">
            {verifiedCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Confirmed by officer</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700 text-xs font-semibold">
            <span>Resolved Incidents</span>
            <ShieldAlert className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-700 font-mono mt-2">
            {resolvedCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Water drained & clear</span>
        </div>
      </div>

      {/* Main Action Banner: Step-by-Step Reporting Callout */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="space-y-3 text-center lg:text-left">
          <span className="text-[11px] font-bold text-cyan-700 uppercase tracking-wider bg-cyan-50 px-2.5 py-1 rounded-full">
            Quick 5-Step Citizen Reporting
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Witnessing water buildup or stalled vehicles?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
            Snap a photo, confirm GPS coordinates, and submit. Our multimodal AI performs early
            depth classification, and DMC officers dispatch pumps to open clogged culverts.
          </p>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-500 pt-1">
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-cyan-600" /> Photo & Depth
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-600" /> GPS Auto-Pin
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-600" /> AI Triage Support
            </span>
          </div>
        </div>

        <NavLink
          to="/citizen/report"
          className="px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-sm shadow-lg shadow-cyan-600/25 transition-all shrink-0 flex items-center gap-2 active:scale-95"
        >
          <span>Start Report Wizard</span>
          <ArrowRight className="w-4 h-4" />
        </NavLink>
      </div>

      {/* Grid: My Recent Reports & Live Weather Advisory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: My Recent Reports (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              My Recent Flood Submissions
            </h3>
            <NavLink
              to="/citizen/reports"
              className="text-xs font-bold text-cyan-700 hover:text-cyan-800 flex items-center gap-1"
            >
              <span>View All Reports ({myReports.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <div className="space-y-3">
            {recentReports.length === 0 ? (
              <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">You haven't submitted any reports yet.</p>
                <NavLink
                  to="/citizen/report"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white text-xs font-bold rounded-xl"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Submit Your First Report</span>
                </NavLink>
              </div>
            ) : (
              recentReports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {report.imageUrl ? (
                      <img
                        src={report.imageUrl}
                        alt={report.location}
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-100"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <ImageOff className="w-4 h-4" />
                        <span className="text-[8px] font-bold uppercase mt-0.5">No Photo</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {report.id}
                        </span>
                        <RiskBadge level={report.riskLevel} />
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            report.incidentStatus === 'Verified' || report.incidentStatus === 'Alert Issued'
                              ? 'bg-emerald-100 text-emerald-800'
                              : report.incidentStatus === 'Resolved'
                              ? 'bg-blue-100 text-blue-800'
                              : report.incidentStatus === 'Rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {report.incidentStatus}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {report.location}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Water Level: <span className="font-semibold text-slate-700">{report.waterLevel}</span> •{' '}
                        {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <NavLink
                    to="/citizen/reports"
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 shrink-0 self-end sm:self-center"
                  >
                    Track Timeline →
                  </NavLink>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Weather & Important Safety Notifications (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Colombo Basin Weather Telemetry
            </h3>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-5 h-5 text-cyan-600" />
                  <span className="font-bold text-xs text-slate-900">Colombo Western Basin</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                  {weather.isLive ? 'Open-Meteo Live' : 'Demo Weather'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[11px] text-slate-500">Current Rainfall</span>
                  <p className="text-xl font-black text-cyan-700 font-mono mt-0.5">
                    {weather.currentRainfallMm} mm/h
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[11px] text-slate-500">Next 3 Hours</span>
                  <p className="text-xl font-black text-blue-700 font-mono mt-0.5">
                    {weather.expected3hRainfallMm} mm
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Active Safety Directive</span>
                </span>
                <p className="leading-relaxed text-[11px]">
                  Heavy localized runoff expected in Kolonnawa and Maradana canal corridors. Avoid
                  parking in basement garages or low-lying underpasses.
                </p>
              </div>
            </div>
          </div>

          {/* Important Safety Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-cyan-600" />
                <span>Important Safety Notifications</span>
              </h3>
              <NavLink to="/citizen/notifications" className="text-xs font-bold text-cyan-700 hover:underline">
                View All →
              </NavLink>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100">
              {topNotifications.map((item) => (
                <div key={item.id} className="p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 truncate">{item.title}</span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Nearby Public Flood Hotspots & Community Map Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Nearby Public Hotspots */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-500" />
              <span>Nearby Public Flood Hotspots</span>
            </h3>
            <NavLink to="/map-public" className="text-xs font-bold text-cyan-700 hover:underline">
              Explore Map →
            </NavLink>
          </div>

          <div className="space-y-3">
            {topHotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-500">{hotspot.id}</span>
                  <RiskBadge level={hotspot.riskLevel} />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{hotspot.location}</h4>
                <p className="text-xs text-slate-500">
                  {hotspot.area} Ward • {hotspot.reportCount} clustered reports • {hotspot.forecastRainfallMm}mm rain
                </p>
                <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  {hotspot.precaution}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Community Flood Map Preview */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Community Flood Map Preview (Zero Private PII)
            </h3>
            <NavLink to="/map-public" className="text-xs font-bold text-cyan-700 hover:underline">
              Open Full Interactive Map →
            </NavLink>
          </div>

          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <FloodMap
              hotspots={hotspots}
              reports={reports}
              heightClass="h-[340px]"
              showLegendOverlay={true}
              showSectorControls={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
