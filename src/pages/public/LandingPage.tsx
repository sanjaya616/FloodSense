/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Droplets,
  PlusCircle,
  MapPin,
  ShieldCheck,
  Cpu,
  Flame,
  ArrowRight,
  CheckCircle2,
  Users,
  AlertTriangle,
  PhoneCall,
  Activity,
  Layers,
  Camera,
  Navigation,
  Compass,
  Radio,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { FloodMap } from '../../components/map/FloodMap';
import { RiskBadge } from '../../components/common/RiskBadge';

export const LandingPage: React.FC = () => {
  const { hotspots, reports, weather, switchPersona, isAuthenticated, role } = useFlood();
  const navigate = useNavigate();

  // Pick top 4 hotspots for the preview cards
  const activeHotspots = hotspots.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 text-cyan-200 text-xs px-4 py-2 border-b border-cyan-800/40 text-center flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        <span className="font-semibold text-white">Academic Prototype:</span>
        <span>Demonstrating AI, Cloud GIS & Distributed Ledger for Colombo Flood Early Warning.</span>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">FloodSense</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold uppercase tracking-wider border border-cyan-500/30">
                  Colombo
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">
                Smarter Warnings • Safer Communities
              </span>
            </div>
          </NavLink>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <NavLink to="/" className="hover:text-cyan-400 transition-colors text-white">
              Home
            </NavLink>
            <a href="#how-it-works" className="hover:text-cyan-400 transition-colors">
              How It Works
            </a>
            <NavLink to="/map-public" className="hover:text-cyan-400 transition-colors">
              Live Flood Map
            </NavLink>
            <NavLink to="/safety" className="hover:text-cyan-400 transition-colors">
              Safety Information
            </NavLink>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <NavLink
                  to={role === 'officer' ? '/officer/overview' : '/citizen'}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5"
                >
                  <span>{role === 'officer' ? 'Open Officer EOC' : 'Open Citizen Portal'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </NavLink>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <NavLink
                  to="/login"
                  className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors"
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all"
                >
                  Create Account
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-cyan-600/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Real-Time Urban Flood Monitoring • Colombo Municipal Basin</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                Together, We Can Build a{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                  Flood-Safer Colombo.
                </span>
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Report urban flooding, share real-time information, and help emergency services stay
                ahead of monsoonal flash floods through AI-assisted ground intelligence and auditable records.
              </p>

              {/* Primary Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                <NavLink
                  to="/citizen/report"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 group"
                >
                  <Camera className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform" />
                  <span>Report a Flooded Road</span>
                  <ArrowRight className="w-4 h-4" />
                </NavLink>

                <NavLink
                  to="/map-public"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span>Explore Live Flood Map</span>
                </NavLink>
              </div>

              {/* Trust Indicators */}
              <div className="pt-6 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-left">
                <div>
                  <p className="text-xl sm:text-2xl font-black text-white font-mono">
                    {reports.length}
                  </p>
                  <p className="text-slate-400 text-xs">Citizen Reports Filed</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">
                    {hotspots.length}
                  </p>
                  <p className="text-slate-400 text-xs">Active Risk Clusters</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                    &lt; 3 mins
                  </p>
                  <p className="text-slate-400 text-xs">AI Early Triage</p>
                </div>
              </div>
            </div>

            {/* Right Map Preview & Tactical Status Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-800/90 rounded-2xl border border-slate-700 p-2 shadow-2xl overflow-hidden backdrop-blur-md">
                <div className="px-4 py-3 bg-slate-900/80 rounded-xl mb-2 flex items-center justify-between border border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Colombo Demonstration GIS Preview
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                    {weather.currentRainfallMm} mm/h ({weather.isLive ? 'Live Radar' : 'Simulated Weather'})
                  </span>
                </div>

                {/* Map Preview Component */}
                <div className="rounded-xl overflow-hidden border border-slate-700">
                  <FloodMap
                    hotspots={hotspots}
                    reports={reports}
                    heightClass="h-[320px]"
                    showLegendOverlay={false}
                    showSectorControls={false}
                  />
                </div>

                <div className="p-3 bg-slate-900/50 rounded-xl mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Viewing Colombo Western Sector</span>
                  <NavLink
                    to="/map-public"
                    className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 text-xs"
                  >
                    <span>Full Interactive Map</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: How FloodSense Works */}
      <section id="how-it-works" className="py-20 bg-slate-950 border-t border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider">
              End-to-End Early Warning Workflow
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              How FloodSense Connects Citizens & Authorities
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              From the moment water begins collecting on a Colombo roadway to emergency response
              dispatch, every step is coordinated and transparent.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-4 relative group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-black text-lg border border-cyan-500/20 group-hover:scale-105 transition-transform">
                01
              </div>
              <h3 className="text-lg font-bold text-white">Citizens Report</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Take a quick photo of the flooded road, confirm your location with GPS, and note water
                depth (ankle, knee, or waist deep).
              </p>
              <div className="pt-2 text-[11px] text-cyan-400 font-semibold flex items-center gap-1">
                <span>Fast 5-Step Wizard</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-4 relative group">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-black text-lg border border-blue-500/20 group-hover:scale-105 transition-transform">
                02
              </div>
              <h3 className="text-lg font-bold text-white">AI Vision Analysis</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Gemini multimodal AI analyzes the photograph, estimating water volume, submersion
                levels, and vehicular passability as supporting evidence.
              </p>
              <div className="pt-2 text-[11px] text-blue-400 font-semibold flex items-center gap-1">
                <span>Assistive Ground Truth</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-4 relative group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-lg border border-amber-500/20 group-hover:scale-105 transition-transform">
                03
              </div>
              <h3 className="text-lg font-bold text-white">DMC Officer Review</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Emergency officers review clustered incidents, verify conditions, dispatch municipal
                sucker trucks, and open drainage sluice gates.
              </p>
              <div className="pt-2 text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                <span>Human In The Loop</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-4 relative group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black text-lg border border-emerald-500/20 group-hover:scale-105 transition-transform">
                04
              </div>
              <h3 className="text-lg font-bold text-white">Community Alert</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Live map advisories update instantly. Motorists reroute away from dangerous underpasses,
                and high-risk events anchor to blockchain for auditability.
              </p>
              <div className="pt-2 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <span>Smarter Warnings</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Why Citizen Reporting Matters */}
      <section id="why-reporting" className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider">
                Community-Powered Resilience
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Why Citizen Reporting Matters in Urban Colombo
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                During the southwest monsoon, Colombo's drainage canals and road culverts can flood
                within minutes. Fixed hydrological sensors only cover major canals. Citizens are the
                vital first line of defense for street-level bottlenecks.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Faster Emergency Drainage Dispatch</h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Municipal crews can immediately locate blocked trash grates and dispatch mobile
                      high-capacity water pumps before water enters residential homes.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Preventing Stranded Vehicles</h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Live status flags alert three-wheelers, small cars, and school buses before they
                      stall in hidden dips at Maradana, Dematagoda, or Wellawatte.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Kelani River Basin Protection</h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Provides neighborhood-level ground truth to back up meteorological forecasts and
                      river bund monitoring stations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <NavLink
                  to="/citizen/report"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Submit a Citizen Flood Report</span>
                </NavLink>
              </div>
            </div>

            {/* Right Card: Citizen Quote / Feature Card */}
            <div className="lg:col-span-6 bg-slate-950/60 p-8 rounded-3xl border border-slate-800 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Crowdsourced Early Warning</h3>
                  <p className="text-xs text-slate-400">Built for citizens across the Colombo Western Province</p>
                </div>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-xs space-y-3">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-semibold text-slate-200">Incident REP-101 (Maradana)</span>
                  <span className="font-mono text-[10px] text-cyan-400">7 mins response</span>
                </div>
                <p className="text-slate-300 italic">
                  "Reported water rising past bus tire levels near Technical College junction. Within 15 minutes,
                  traffic was diverted away from the railway underpass, preventing dozens of stalled cars."
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span>Dinuka Senanayake • Resident</span>
                  <span className="text-emerald-400 font-semibold">Verified by DMC Officer</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <p className="text-xl font-bold text-cyan-400 font-mono">100%</p>
                  <p className="text-xs text-slate-400 mt-0.5">Privacy protection (Zero PII on public map)</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <p className="text-xl font-bold text-blue-400 font-mono">24/7</p>
                  <p className="text-xs text-slate-400 mt-0.5">Continuous incident clustering & alert feed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: AI-Powered Flood Assessment */}
      <section id="ai-assessment" className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Transparent AI Verification</span>
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              AI Assists, But Human Officers Decide
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Every citizen photo is examined by computer vision models to assess water depth,
              blockages, and vehicle risk. However, strict safety protocols ensure AI never
              auto-approves an incident without human officer sign-off.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Visual Depth Estimation</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Computer vision detects water reflections, submerged curbs, and vehicle tire submersion
                to calibrate flood depth indicators.
              </p>
            </div>

            <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Road Passability Classification</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Identifies whether a corridor is passable for all vehicles, passable only for 4x4 trucks,
                or completely blocked by floodwaters.
              </p>
            </div>

            <div className="bg-slate-900/70 p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Zero Fake Approval Protection</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                AI evaluation is labeled as assistive evidence. Official disaster verification remains
                firmly with credentialed DMC personnel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Live Hotspots Preview */}
      <section className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider">
                Geospatial Density Clustered
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                Active Colombo Flood Hotspots
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Clustered within 500m radius and 2-hour sliding temporal window.
              </p>
            </div>

            <NavLink
              to="/map-public"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <span>Explore All Hotspots on GIS Map</span>
              <ArrowRight className="w-4 h-4" />
            </NavLink>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeHotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                className="bg-slate-950 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-400">{hotspot.id}</span>
                  <RiskBadge level={hotspot.riskLevel} />
                </div>

                <div>
                  <h4 className="font-bold text-white text-sm truncate">{hotspot.location}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{hotspot.area} Municipal Ward</p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">{hotspot.reportCount} reports</span>
                  <span className="text-cyan-400">{hotspot.forecastRainfallMm} mm rain</span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {hotspot.precaution}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community Emergency Hotline Strip */}
      <section className="py-12 bg-gradient-to-r from-cyan-900/60 via-slate-900 to-blue-900/60 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <h3 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
                <PhoneCall className="w-5 h-5 text-cyan-400" />
                <span>Life-Threatening Emergency? Call Immediate Response</span>
              </h3>
              <p className="text-slate-300 text-xs">
                For immediate water rescue, medical emergencies, or live wire threats, do not wait for the app.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="tel:117"
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs shadow-md transition-colors"
              >
                DMC Disaster Hotline: 117
              </a>
              <a
                href="tel:1990"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs shadow-md transition-colors"
              >
                Suwa Seriya Ambulance: 1990
              </a>
              <a
                href="tel:119"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs shadow-md transition-colors"
              >
                Sri Lanka Police: 119
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-slate-950 font-bold">
                <Droplets className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base text-white">FloodSense</span>
              <span className="text-[11px] text-slate-500 font-mono ml-2">Colombo Metro</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
              <NavLink to="/map-public" className="hover:text-cyan-400 transition-colors">
                Public Map
              </NavLink>
              <NavLink to="/citizen/report" className="hover:text-cyan-400 transition-colors">
                Report a Flood
              </NavLink>
              <NavLink to="/safety" className="hover:text-cyan-400 transition-colors">
                Safety Guidelines
              </NavLink>
              <NavLink to="/methodology" className="hover:text-cyan-400 transition-colors">
                Methodology & Ledger
              </NavLink>
              <NavLink to="/officer/overview" className="text-cyan-400 font-semibold hover:underline">
                Officer EOC Portal
              </NavLink>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>© 2026 FloodSense — Urban Flood Intelligence & Early Warning System. Academic Evaluation Prototype.</span>
            <span>All demonstration incidents, AI scores, and blockchain transactions are synthetic simulations.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
