/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useFlood } from '../context/FloodContext';
import {
  BlockchainRecord,
  GENESIS_PREV_HASH,
  verifyBlockchainRecordIntegrity,
} from '../utils/floodLogic';
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
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // Order ascending by blockNumber to find expected prevHash predecessor
  const chronologicalRecords = useMemo(
    () => [...blockchainRecords].sort((a, b) => a.blockNumber - b.blockNumber),
    [blockchainRecords]
  );

  const getExpectedPrevHash = (rec: BlockchainRecord): string => {
    const idx = chronologicalRecords.findIndex((r) => r.eventId === rec.eventId);
    if (idx <= 0) return GENESIS_PREV_HASH;
    return chronologicalRecords[idx - 1].recordHash || chronologicalRecords[idx - 1].txHash;
  };

  // Filtered records
  const filteredRecords = blockchainRecords.filter((rec) => {
    const q = search.toLowerCase();
    return (
      !search ||
      rec.eventId.toLowerCase().includes(q) ||
      rec.hotspotId.toLowerCase().includes(q) ||
      rec.location.toLowerCase().includes(q) ||
      rec.txHash.toLowerCase().includes(q) ||
      (rec.recordHash && rec.recordHash.toLowerCase().includes(q)) ||
      rec.payloadHash.toLowerCase().includes(q)
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
    const expectedPrev = getExpectedPrevHash(rec);
    const check = verifyBlockchainRecordIntegrity(rec, expectedPrev);
    if (check.valid) {
      setVerificationResult({
        valid: true,
        message: `Cryptographic Check PASSED for Block #${rec.blockNumber} (${rec.eventId}): recomputed SHA-256 recordHash & prevHash chain link match (${check.recomputedRecordHash.slice(0, 14)}...).`,
      });
    } else {
      setVerificationResult({
        valid: false,
        message: `Tamper Alert on Block #${rec.blockNumber} (${rec.eventId}): ${check.reason}`,
      });
    }
  };

  const handleVerifyFullChain = () => {
    if (chronologicalRecords.length === 0) {
      setVerificationResult({ valid: false, message: 'No audit records in ledger to verify.' });
      return;
    }
    let prev = GENESIS_PREV_HASH;
    for (const rec of chronologicalRecords) {
      const check = verifyBlockchainRecordIntegrity(rec, prev);
      if (!check.valid) {
        setVerificationResult({
          valid: false,
          message: `Chain Verification FAILED at Block #${rec.blockNumber} (${rec.eventId}): ${check.reason}`,
        });
        return;
      }
      prev = rec.recordHash || rec.txHash;
    }
    setVerificationResult({
      valid: true,
      message: `Full Audit Chain Verified: All ${chronologicalRecords.length} blocks passed canonical SHA-256 payload digest & previous-hash linkage checks.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
              DEMONSTRATION LEDGER
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Prototype Audit Hash-Chain &amp; Flood Event Registry
          </h2>
          <p className="text-sm text-slate-500">
            Tamper-evident, SHA-256 linked audit trail of verified municipal flood events (Local Academic Prototype).
          </p>
        </div>

        <button
          type="button"
          onClick={handleVerifyFullChain}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Verify Full Hash Chain</span>
        </button>
      </div>

      {/* Mandatory Simulated Architecture Callout & Disclaimer */}
      <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 shadow-md flex items-start gap-3.5 text-xs">
        <Lock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-white uppercase tracking-wider font-mono">
              Tamper-Evident SHA-256 Hash-Chain (Simulated Academic Ledger)
            </span>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
              Local Prototype Chain (No Mainnet/Testnet RPC)
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Each record computes a canonical SHA-256 <code>payloadHash</code> and chains <code>recordHash = SHA256(prevHash + eventId + timestamp + payloadHash)</code>.
            This proves whether an incident snapshot has been modified after recording; <strong>it does not provide independent physical proof
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
              Sealed Hash-Chain Blocks
            </span>
            <span className="text-3xl font-extrabold text-emerald-600 font-mono tabular-nums">
              {verifiedRecords}
            </span>
            <p className="text-xs text-emerald-700 font-medium mt-1">SHA-256 linked prototype</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Pending Inclusion
            </span>
            <span className="text-3xl font-extrabold text-amber-600 font-mono tabular-nums">
              {pendingRecords}
            </span>
            <p className="text-xs text-amber-700 font-medium mt-1">Awaiting next snapshot</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {verificationResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            verificationResult.valid
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {verificationResult.valid ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{verificationResult.message}</span>
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
                  <th className="py-3 px-4">Record ID</th>
                  <th className="py-3 px-4">Hotspot ID</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Current Record Hash</th>
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
                <span>Hash-Chain Inspector</span>
              </h3>
              <p className="text-xs text-slate-500">Cryptographic SHA-256 audit parameters</p>
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
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                    Prototype Audit Record ID
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    DEMONSTRATION LEDGER
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-sm">{selectedTx.location}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-slate-500 font-bold">{selectedTx.hotspotId}</span>
                  <RiskBadge level={selectedTx.severity} size="sm" />
                </div>
              </div>

              {/* Block & Network details */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 font-mono space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 text-[11px]">Ledger Mode:</span>
                  <span className="font-bold text-slate-800 text-right">{selectedTx.network}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Block Height:</span>
                  <span className="font-bold text-cyan-700">#{selectedTx.blockNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Timestamp:</span>
                  <span className="text-slate-600 text-[10px]">
                    {new Date(selectedTx.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Current Record Hash with Copy Action */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                    Current Record Hash (recordHash)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedTx.recordHash || selectedTx.txHash)}
                    className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 flex items-center gap-1 font-sans"
                  >
                    {copiedHash === (selectedTx.recordHash || selectedTx.txHash) ? (
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
                  {selectedTx.recordHash || selectedTx.txHash}
                </p>
              </div>

              {/* Prev Hash Link */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 font-mono">
                  Previous Block Hash (prevHash)
                </span>
                <p className="font-mono text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg break-all border border-slate-200">
                  {selectedTx.prevHash || getExpectedPrevHash(selectedTx)}
                </p>
              </div>

              {/* Canonical Payload Digest */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 font-mono">
                  Canonical Payload SHA-256 (payloadHash)
                </span>
                <p className="font-mono text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg break-all border border-slate-200">
                  {selectedTx.payloadHash}
                </p>
              </div>

              {/* Canonical JSON Payload */}
              {selectedTx.canonicalPayload && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 font-mono">
                    Canonical JSON Payload (Zero PII)
                  </span>
                  <pre className="font-mono text-[10px] text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(selectedTx.canonicalPayload, null, 2)}
                  </pre>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleVerifyHashProof(selectedTx)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs font-sans cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4 text-cyan-400" />
                <span>Recompute &amp; Verify Block Hash Proof</span>
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
