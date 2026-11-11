/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FileText,
  HelpCircle,
  Cpu,
  Layers,
  Activity,
  CloudRain,
  Link2,
  Lock,
  Database,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Compass,
} from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          System Methodology & Data Transparency
        </h2>
        <p className="text-sm text-slate-500">
          Academic documentation outlining data collection pipelines, algorithmic heuristics, real vs simulated integrations, and privacy safeguards.
        </p>
      </div>

      {/* Summary Matrix: Live vs Simulated Components */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-700" />
          <span>Integration & Component Transparency Matrix</span>
        </h3>
        <p className="text-xs text-slate-500">
          Explicit distinction between live connected external web services and demonstration models.
        </p>

        <div className="overflow-x-auto pt-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-2.5 px-3">Subsystem</th>
                <th className="py-2.5 px-3">Implementation Nature</th>
                <th className="py-2.5 px-3">Source / Protocol</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-800">Weather Telemetry</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">GENUINELY RETRIEVED</td>
                <td className="py-2.5 px-3 text-slate-600 font-sans">Open-Meteo API (Lat 6.9271, Lng 79.8653)</td>
                <td className="py-2.5 px-3 text-emerald-600">Live External Feed</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-800">Multimodal AI Inspection</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">REAL MODEL OR HEURISTIC</td>
                <td className="py-2.5 px-3 text-slate-600 font-sans">Google Gemini 3.8 Flash via @google/genai server-side proxy</td>
                <td className="py-2.5 px-3 text-cyan-700">Live AI / Fallback Heuristic</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-800">Map Geospatial Tiles</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">GENUINELY RETRIEVED</td>
                <td className="py-2.5 px-3 text-slate-600 font-sans">OpenStreetMap Standard Carto Tile Server</td>
                <td className="py-2.5 px-3 text-emerald-600">Live GIS Tiles</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-800">Geospatial Clustering</td>
                <td className="py-2.5 px-3 text-slate-700 font-bold">REAL ALGORITHM</td>
                <td className="py-2.5 px-3 text-slate-600 font-sans">Haversine spherical distance formula with 2h temporal threshold</td>
                <td className="py-2.5 px-3 text-cyan-700">Deterministic Engine</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-800">Risk Prediction Engine</td>
                <td className="py-2.5 px-3 text-slate-700 font-bold">PROTOTYPE RULE HEURISTIC</td>
                <td className="py-2.5 px-3 text-slate-600 font-sans">Deterministic threshold logic (Configurable: count & rain thresholds)</td>
                <td className="py-2.5 px-3 text-cyan-700">Academic Model</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-800">Blockchain Records</td>
                <td className="py-2.5 px-3 text-amber-700 font-bold">SYNTHETIC SIMULATION</td>
                <td className="py-2.5 px-3 text-slate-600 font-sans">Deterministic SHA-256 hashes demonstrating Sepolia smart contract architecture</td>
                <td className="py-2.5 px-3 text-amber-700">Simulated Ledger</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-800">Baseline Colombo Incidents</td>
                <td className="py-2.5 px-3 text-amber-700 font-bold">SYNTHETIC DEMONSTRATION</td>
                <td className="py-2.5 px-3 text-slate-600 font-sans">16 realistic scenario records representing typical monsoon bottlenecks</td>
                <td className="py-2.5 px-3 text-amber-700">Demonstration Matrix</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology Chapters */}
      <div className="space-y-4">
        {/* Chapter 1: Citizen Reporting */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-mono text-xs">
              01
            </span>
            <h4>Citizen Incident Reporting & Geospatial Capture</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Citizens submit field observations through the <code>/report</code> interface. The system captures
            the description, estimated water level (Low, Moderate, High, Severe), road accessibility (Open, Partially Blocked, Completely Blocked),
            and flood category (Street Waterlogging, Flash Flood, Canal Overflow, Drainage Blockage).
          </p>
          <p className="text-slate-600 leading-relaxed">
            Geographic coordinates are obtained via the W3C Geolocation API upon user interaction, with manual fallback
            allowing citizens to select their municipal sector and refine GPS coordinates. Duplicate submissions within 25 meters
            and 5 minutes are detected and merged into the existing cluster to avoid spam.
          </p>
        </div>

        {/* Chapter 2: Computer Vision & AI Verification */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-mono text-xs">
              02
            </span>
            <h4>Photograph Assessment (Gemini Multimodal AI vs Demonstration Heuristic)</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            When a photograph is attached, it is routed through the server-side API endpoint (<code>/api/ai/verify</code>).
            When configured with a Gemini API key, the system calls Google's <code>gemini-3.8-flash</code> multimodal model.
            The model inspects whether visible water accumulation, submerged sidewalk curbs, or stalled vehicular traffic are
            verifiably present in the image.
          </p>
          <p className="text-slate-600 leading-relaxed">
            In demonstration mode without API keys, a deterministic optical heuristic provides simulated reflection and surface
            confidence scores. An explicit disclaimer emphasizes that automated image classification is an early warning indicator
            and cannot replace official municipal field inspection.
          </p>
        </div>

        {/* Chapter 3: Haversine Clustering */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-mono text-xs">
              03
            </span>
            <h4>Geospatial Clustering (500m Spatial Radius & 2-Hour Temporal Window)</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Individual reports are grouped into Hotspots using the Great-Circle Haversine distance formula:
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
            <p>d = 2 * R * asin(sqrt(sin²(Δφ/2) + cos(φ₁) * cos(φ₂) * sin²(Δλ/2)))</p>
            <p className="text-slate-500">where R = 6,371,000 meters (mean Earth radius)</p>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Reports within 500 meters of a cluster center submitted within a 2-hour window are aggregated into a single Hotspot.
            Reports submitted outside this 2-hour window are separated into distinct temporal occurrences to ensure that receding
            floods from earlier in the day do not artificially inflate active hazard assessments. Both the spatial radius and
            temporal window are adjustable in the System Settings panel.
          </p>
        </div>

        {/* Chapter 4: Deterministic Risk Heuristic */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-mono text-xs">
              04
            </span>
            <h4>Deterministic Risk Classification Rules</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Hotspots are categorized into HIGH, MEDIUM, or LOW risk using explicit deterministic threshold rules:
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
            <p className="text-red-700 font-bold">1. HIGH: (Report Count ≥ 3) AND (3h Forecast Rainfall &gt; 20 mm)</p>
            <p className="text-amber-700 font-bold">2. MEDIUM: (Report Count ≥ 2) OR (3h Forecast Rainfall &gt; 10 mm)</p>
            <p className="text-emerald-700 font-bold">3. LOW: Otherwise (Baseline manageable runoff)</p>
          </div>
          <p className="text-slate-600 leading-relaxed">
            HIGH is evaluated strictly before MEDIUM. Each Hotspot details modal provides an evaluation trace showing which
            condition triggered the classification. Thresholds can be configured in Settings.
          </p>
        </div>

        {/* Chapter 5: Blockchain Ledger Architecture */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-mono text-xs">
              05
            </span>
            <h4>Blockchain Audit Ledger & Smart Contract Design</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            The Blockchain module demonstrates an architectural framework where municipal flood declarations and high-risk
            hotspots are anchored onto a cryptographic ledger (Ethereum Sepolia Testnet).
          </p>
          <p className="text-slate-600 leading-relaxed">
            Only cryptographic digests (SHA-256 hashes of report metadata + Merkle roots) are stored on-chain. Sensitive
            photographs and citizen personal details are never published to public blockchains. The ledger provides proof that
            an incident record existed at a specific block height without retroactive alteration; it is not physical proof of flooding.
          </p>
        </div>
      </div>
    </div>
  );
};
