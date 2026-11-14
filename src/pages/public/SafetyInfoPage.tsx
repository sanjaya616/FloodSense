/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldAlert,
  PhoneCall,
  Car,
  Home,
  AlertTriangle,
  HeartPulse,
  Droplets,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  FileText,
} from 'lucide-react';

export const SafetyInfoPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 mb-1">
          <NavLink to="/" className="hover:underline">
            Home
          </NavLink>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>Community Safety Information</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Colombo Monsoon Flood Safety Guide
        </h1>
        <p className="text-slate-600 text-sm mt-1.5 max-w-3xl leading-relaxed">
          Educational flood-safety precautions, vehicle protocols, and Sri Lanka emergency hotlines
          (referencing public DMC 117 and Met Dept advisories; always follow official DMC directives during active emergencies).
        </p>
      </div>

      {/* Emergency Hotlines Directory Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-cyan-600" />
          <span>Emergency Hotlines • Sri Lanka (24/7 Toll-Free)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                Disaster Ops Centre
              </span>
              <h3 className="text-sm font-bold text-red-950 mt-0.5">Disaster Management (DMC)</h3>
              <p className="text-[11px] text-red-800 mt-1">
                Flood rescues, river bund breach warnings & relief coordination.
              </p>
            </div>
            <a
              href="tel:117"
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-sm rounded-xl text-center shadow-xs transition-colors block"
            >
              Call 117
            </a>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Emergency Medical
              </span>
              <h3 className="text-sm font-bold text-emerald-950 mt-0.5">Suwa Seriya Ambulance</h3>
              <p className="text-[11px] text-emerald-800 mt-1">
                Paramedic dispatch, drowning resuscitation & urgent trauma transit.
              </p>
            </div>
            <a
              href="tel:1990"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-sm rounded-xl text-center shadow-xs transition-colors block"
            >
              Call 1990
            </a>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                Law & Rescue
              </span>
              <h3 className="text-sm font-bold text-blue-950 mt-0.5">Sri Lanka Police Service</h3>
              <p className="text-[11px] text-blue-800 mt-1">
                Traffic cordons, missing persons & security during evacuations.
              </p>
            </div>
            <a
              href="tel:119"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-sm rounded-xl text-center shadow-xs transition-colors block"
            >
              Call 119
            </a>
          </div>

          <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                Municipal Services
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">Colombo Municipal (CMC)</h3>
              <p className="text-[11px] text-slate-600 mt-1">
                Drainage maintenance, tree clearing & mobile gully sucker trucks.
              </p>
            </div>
            <a
              href="tel:0112684293"
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-mono font-bold text-xs rounded-xl text-center shadow-xs transition-colors block"
            >
              011 268 4293
            </a>
          </div>
        </div>
      </div>

      {/* Vehicle Safety Section: Turn Around Don't Drown */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Vehicle Safety: Turn Around, Don't Drown
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Driving into submerged roadways carries severe risk of engine stall, hidden culvert hazards,
              and rapid loss of traction even in shallow moving water.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="font-mono font-bold text-xs text-amber-700 block">6 INCHES (15 CM)</span>
            <h3 className="text-sm font-bold text-slate-900">Loss of Control & Stalling</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Six inches of standing water will reach the bottom of most passenger cars, soaking
              exhaust systems and causing engine stall.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="font-mono font-bold text-xs text-orange-700 block">12 INCHES (30 CM)</span>
            <h3 className="text-sm font-bold text-slate-900">Vehicles Float Away</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              One foot of rushing water exerts immense hydraulic force, easily sweeping away small
              cars, three-wheelers, and motorcycles into roadside canals.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="font-mono font-bold text-xs text-red-700 block">24 INCHES (60 CM)</span>
            <h3 className="text-sm font-bold text-slate-900">SUVs & Trucks Swept Off</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Two feet of surging runoff can float heavy 4WD pickups, delivery lorries, and buses,
              pushing them into deep culverts.
            </p>
          </div>
        </div>

        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
          <span className="font-bold">⚠️ Colombo Underpass Warning:</span>
          <p>
            Underpasses at Maradana Railway Station, Dematagoda Baseline Road, and Panchikawatte often
            accumulate 3 to 5 feet of stormwater within 20 minutes of intense cloudbursts. Do not
            assume water depth from surface reflections.
          </p>
        </div>
      </div>

      {/* Do's and Don'ts Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DO's */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-base">
            <CheckCircle2 className="w-5 h-5" />
            <span>Essential Flood Precautions (DO)</span>
          </div>

          <ul className="space-y-3 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>
                <strong>Elevate valuable electronics:</strong> Unplug household appliances and move
                documents to upper shelves if residing in low-lying Kolonnawa or Sedawatte.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>
                <strong>Store clean drinking water:</strong> Fill sealed containers; municipal mains
                can become contaminated by canal overflow during inundation.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>
                <strong>Check on vulnerable neighbors:</strong> Assist elderly residents, infants,
                and persons with mobility challenges early in an evacuation advisory.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>
                <strong>File a photo report:</strong> Submit road conditions on FloodSense to assist
                the DMC dispatching pumping brigades.
              </span>
            </li>
          </ul>
        </div>

        {/* DON'Ts */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-red-700 font-bold text-base">
            <XCircle className="w-5 h-5" />
            <span>Dangerous Actions to Avoid (DON'T)</span>
          </div>

          <ul className="space-y-3 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <span>
                <strong>Never walk in floodwaters:</strong> Open manhole covers can be displaced by
                sewer pressure, creating deadly concealed suction vortexes.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <span>
                <strong>Avoid electrical posts & fallen cables:</strong> Submerged electrical lines
                can electrify standing water over a 15-meter radius.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <span>
                <strong>Do not let children play in canal runoff:</strong> Contaminated urban water
                harbors Leptospirosis (rat fever), dengue vectors, and enteric pathogens.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <span>
                <strong>Do not drive around police barriers:</strong> Emergency road closures are
                instituted for structural safety or submerged bridge decks.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Call to action */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-700 text-white p-8 rounded-3xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-xl font-bold">Have Eyes on a Flooded Street?</h3>
          <p className="text-cyan-100 text-xs">
            Help your community and municipal responders by submitting a quick photograph report.
          </p>
        </div>

        <NavLink
          to="/citizen/report"
          className="px-6 py-3 rounded-xl bg-white text-slate-950 font-extrabold text-xs shadow-md hover:bg-slate-100 transition-all shrink-0 flex items-center gap-2"
        >
          <span>Submit a Report Now</span>
          <ArrowRight className="w-4 h-4" />
        </NavLink>
      </div>
    </div>
  );
};
