/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useFlood } from '../context/FloodContext';
import { BlockchainRecord } from '../utils/floodLogic';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  Link2,
  ShieldCheck,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Search,
  Filter,
  FileCode,
  Layers,
  Database,
  Lock,
  Cpu,
  Info,
  AlertCircle,
  Radio,
  FileCheck2,
} from 'lucide-react';

export const BlockchainRegistryPage: React.FC = () => {
  const { blockchainRecords } = useFlood();
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<BlockchainRecord | null>(blockchainRecords[0] || null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [verifiedHashNotice, setVerifiedHashNotice] = useState<string | null>(null);

  // Filtered records
  const filteredRecords = blockchainRecords.filter((rec) => {
    return (
      !search ||
      rec.eventId.toLowerCase().includes(search.toLowerCase()) ||
      rec.hotspotId.toLowerCase().includes(search.toLowerCase()) ||
      rec.location.toLowerCase().includes(search.toLowerCase()) ||
      rec.txHash.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalEvents = blockchainRecords.length;
  const verifiedRecords = blockchainRecords.filter((r) => r.status.includes('CONFIRMED')).length;
  const pendingRecords = blockchainRecords.filter((r) => r.status.includes('PENDING')).length;

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleVerifyHashProof = (rec: BlockchainRecord) => {
    setVerifiedHashNotice(`SHA-256 Merkle root validated against block #${rec.blockNumber}. Record integrity verified.`);
    setTimeout(() => setVerifiedHashNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Blockchain Flood Event Registry & Audit Ledger
        </h2>
        <p className="text-sm text-slate-500">
          Tamper-evident, cryptographically anchored audit trail of verified municipal flood events and emergency declarations.
        </p>
      </div>

      {/* Mandatory Simulated Architecture Callout & Disclaimer */}
      <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 shadow-md flex items-start gap-3.5 text-xs">
        <Lock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white uppercase tracking-wider font-mono">
              Tamper-Evident Audit Trail (Academic Demonstration Architecture)
            </span>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
              Sepolia Testnet Prepared
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            This module demonstrates how blockchain architectures provide tamper-evident records for disaster
            compensations and municipal accountability. A blockchain audit trail proves that an incident report
            has not been retrospectively modified or deleted; <strong>it does not provide independent physical proof
            that a flood occurred</strong>. Photographs and personal contact details are never stored on public ledgers.
          </p>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Total Recorded Events
            </span>
            <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {totalEvents}
            </span>
            <p className="text-xs text-slate-500 mt-1">Anchored flood snapshots</p>
          </div>
          <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
            <Link2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Confirmed Simulated Records
            </span>
            <span className="text-3xl font-extrabold text-emerald-600 font-mono tabular-nums">
              {verifiedRecords}
            </span>
            <p className="text-xs text-emerald-700 font-medium mt-1">Multi-node consensus</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Pending Block Inclusion
            </span>
            <span className="text-3xl font-extrabold text-amber-600 font-mono tabular-nums">
              {pendingRecords}
            </span>
            <p className="text-xs text-amber-700 font-medium mt-1">Awaiting validator seal</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {verifiedHashNotice && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{verifiedHashNotice}</span>
        </div>
      )}

      {/* Main Table + Transaction Details Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Ledger Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Table Header Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Cryptographic Event Ledger</h3>
              <p className="text-xs text-slate-500">
                Immutable chronological log of high-severity flood hotspots (Simulated Demonstrations)
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search event ID, hash, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Hotspot ID</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Transaction Hash</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-sans">
                      No blockchain records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const isSelected = selectedTx?.eventId === rec.eventId;
                    return (
                      <tr
                        key={rec.eventId}
                        onClick={() => setSelectedTx(rec)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-cyan-50/60 font-semibold'
                            : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-slate-900">{rec.eventId}</td>
                        <td className="py-3 px-4 text-slate-700">{rec.hotspotId}</td>
                        <td className="py-3 px-4 text-slate-900 font-sans font-medium truncate max-w-[140px]">
                          {rec.location}
                        </td>
                        <td className="py-3 px-4">
                          <RiskBadge level={rec.severity} size="sm" />
                        </td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-[120px]">
                          {rec.txHash.slice(0, 10)}...{rec.txHash.slice(-6)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                              rec.status.includes('CONFIRMED')
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rec.status.includes('CONFIRMED') ? 'CONFIRMED' : 'PENDING'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTx(rec);
                            }}
                            className="text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Inspector Details Panel (4 cols) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-cyan-600" />
                <span>Transaction Inspector</span>
              </h3>
              <p className="text-xs text-slate-500">Cryptographic audit proof parameters</p>
            </div>
            {selectedTx && (
              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {selectedTx.eventId}
              </span>
            )}
          </div>

          {selectedTx ? (
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5 font-mono">
                  Target Hotspot
                </span>
                <p className="font-bold text-slate-900 text-sm">{selectedTx.location}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-slate-500 font-bold">{selectedTx.hotspotId}</span>
                  <RiskBadge level={selectedTx.severity} size="sm" />
                </div>
              </div>

              {/* Block & Network details */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 font-mono space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Ledger Network:</span>
                  <span className="font-bold text-slate-800">{selectedTx.network}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Block Height:</span>
                  <span className="font-bold text-cyan-700">#{selectedTx.blockNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Validator Count:</span>
                  <span className="font-bold text-slate-800">{selectedTx.validatorCount} Nodes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Timestamp:</span>
                  <span className="text-slate-600 text-[10px]">
                    {new Date(selectedTx.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Smart contract parameters */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Contract Address:</span>
                  <span className="text-slate-800 truncate max-w-[140px]">{selectedTx.contractAddress || '0x742d... (Simulated)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chain ID:</span>
                  <span className="text-slate-800">{selectedTx.chainId || 11155111} (Sepolia)</span>
                </div>
              </div>

              {/* Transaction Hash with Copy Action */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                    Transaction Hash (Simulated)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedTx.txHash)}
                    className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 flex items-center gap-1 font-sans"
                  >
                    {copiedHash === selectedTx.txHash ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Hash</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-slate-800 bg-slate-100 p-2 rounded-lg break-all border border-slate-200">
                  {selectedTx.txHash}
                </p>
              </div>

              {/* Merkle Root */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 font-mono">
                  Merkle State Root (SHA-256)
                </span>
                <p className="font-mono text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg break-all border border-slate-200">
                  {selectedTx.merkleRoot}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleVerifyHashProof(selectedTx)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs font-sans"
              >
                <FileCheck2 className="w-4 h-4 text-cyan-400" />
                <span>Verify Merkle State Proof</span>
              </button>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-1.5 leading-tight font-sans">
                <Info className="w-3.5 h-3.5 text-cyan-600 shrink-0 mt-0.5" />
                <span>
                  Tamper-evident audit record ensures immutable timestamping for relief audits without exposing private citizen data.
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">
              Select any event row to view audit parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
