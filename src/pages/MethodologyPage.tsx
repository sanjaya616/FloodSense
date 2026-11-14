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
                <td className="py-2.5 px-3 text-slate-600 font-sans">Google Gemini 4 Hydrogen via @google/genai server-side proxy</td>
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
            <h4>Citizen Incident Reporting, Image Sanitization &amp; Geospatial Capture</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Citizens submit field observations through the 5-step reporting wizard (<code>/citizen/report</code>) or the operations console form.
            Uploaded photos undergo client and server binary magic-byte inspection (JPEG/PNG/WEBP, ≤ 5 MB) plus client-side HTML5 canvas
            re-encoding to strip embedded EXIF/GPS metadata prior to upload.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Geographic coordinates require explicit user selection via W3C Geolocation, municipal sector lookup, or manual lat/lng entry
            with explicit map-pin confirmation. Near-duplicate submissions within 25 meters and 5 minutes are flagged as duplicates
            and preserved for audit without inflating unique incident counts.
          </p>
        </div>

        {/* Chapter 2: Computer Vision & AI Verification */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-mono text-xs">
              02
            </span>
            <h4>Photograph Assessment (Gemini 4 Hydrogen &amp; Explicit AI States)</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            When a photograph is attached, it is routed through the server-side API endpoint (<code>/api/ai/verify</code>) enforcing a strict
            schema response from Google&apos;s <code>gemini-4-hydrogen</code> multimodal model with a 30-second timeout.
          </p>
          <p className="text-slate-600 leading-relaxed">
            AI verification uses four explicit states: <code>NOT_RUN</code> (no photograph submitted; confidence is <code>null</code>),{' '}
            <code>COMPLETED</code> (live Gemini vision assessment), <code>FAILED</code> (upstream API/schema error returning HTTP 502 without
            inventing a confidence score, while still saving the citizen report safely for retry), and <code>SIMULATED</code> (academic
            heuristic used only when <code>GEMINI_API_KEY</code> is absent). AI never overrides human emergency officer verification.
          </p>
        </div>

        {/* Chapter 3: Haversine BFS Connected-Component Clustering */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-mono text-xs">
              03
            </span>
            <h4>Geospatial Connected-Component Clustering (500m &amp; 2-Hour Window)</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Valid reports are grouped using single-linkage BFS connected-component clustering over the Great-Circle Haversine distance formula:
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
            <p>d = 2 * R * asin(sqrt(sin²(Δφ/2) + cos(φ₁) * cos(φ₂) * sin²(Δλ/2)))</p>
            <p className="text-slate-500">where R = 6,371,000 meters (mean Earth radius)</p>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Two valid reports link when both spatial distance ≤ 500 meters and temporal separation ≤ 2 hours. Cluster identifiers (<code>HS-...</code>)
            are derived deterministically via SHA-256 hashing of sorted member IDs so cluster IDs remain stable regardless of input ordering.
            Each hotspot tracks unique reports, audited duplicates, and independent confirmations separately.
          </p>
        </div>

        {/* Chapter 4: Deterministic Risk Heuristic */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-mono text-xs">
              04
            </span>
            <h4>Deterministic Risk Classification &amp; Missing Rainfall Honesty</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Hotspots are categorized into HIGH, MEDIUM, or LOW risk using explicit deterministic threshold rules aligned to future Open-Meteo <code>Asia/Colombo</code> hourly slots:
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
            <p className="text-red-700 font-bold">1. HIGH: (Unique Reports ≥ 3) AND (3h Forecast Rainfall &gt; 20 mm)</p>
            <p className="text-amber-700 font-bold">2. MEDIUM: (Unique Reports ≥ 2) OR (3h Forecast Rainfall &gt; 10 mm)</p>
            <p className="text-emerald-700 font-bold">3. LOW: Otherwise (Baseline manageable runoff)</p>
          </div>
          <p className="text-slate-600 leading-relaxed">
            HIGH is evaluated strictly before MEDIUM. When weather forecast data is unavailable, rainfall is explicitly flagged as{' '}
            <code>MISSING</code> (0 mm fallback) rather than invented from existing severity labels.
          </p>
        </div>

        {/* Chapter 5: Prototype SHA-256 Hash-Chain Audit Trail */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-mono text-xs">
              05
            </span>
            <h4>Tamper-Evident SHA-256 Hash-Chain Audit Prototype</h4>
          </div>
          <p className="text-slate-600 leading-relaxed">
            The Blockchain Registry demonstrates an immutable audit architecture using pure-TypeScript FIPS 180-4 SHA-256 cryptographic digests
            chained via <code>recordHash = SHA256(prevHash + eventId + timestamp + payloadHash)</code> across canonicalized event snapshots.
          </p>
          <p className="text-slate-600 leading-relaxed">
            This is a local simulated prototype chain (not connected to a live public mainnet/testnet RPC). Photographs and citizen PII are never
            written into hashed ledger payloads. Any post-hoc modification breaks cryptographic chain verification inside the inspector.
          </p>
        </div>
      </div>
    </div>
  );
};
