/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Camera,
  MapPin,
  Sparkles,
  Check,
  X,
  Radio,
  FileText,
  User,
  Phone,
  CloudRain,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { RiskBadge } from '../../components/common/RiskBadge';
import { FloodReport, IncidentStatus } from '../../utils/floodLogic';

export const OfficerIncidentsPage: React.FC = () => {
  const { reports, updateIncidentStatus, userProfile, hotspots, weather } = useFlood();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<FloodReport | null>(null);

  // Review modal form state
  const [officerNote, setOfficerNote] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Metric counts
  const pendingReviewCount = useMemo(
    () => reports.filter((r) => r.incidentStatus === 'Submitted' || r.incidentStatus === 'Under Review').length,
    [reports]
  );
  const verifiedCount = useMemo(
    () => reports.filter((r) => r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued').length,
    [reports]
  );
  const highRiskCount = useMemo(
    () => reports.filter((r) => r.riskLevel === 'HIGH' && r.incidentStatus !== 'Resolved').length,
    [reports]
  );
  const resolvedCount = useMemo(
    () => reports.filter((r) => r.incidentStatus === 'Resolved').length,
    [reports]
  );

  // Distinct areas
  const distinctAreas = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => set.add(r.area));
    return Array.from(set).sort();
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchSearch =
        searchQuery === '' ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.reporterName && r.reporterName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && (r.incidentStatus === 'Submitted' || r.incidentStatus === 'Under Review')) ||
        (statusFilter === 'VERIFIED' && (r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued')) ||
        (statusFilter === 'RESOLVED' && r.incidentStatus === 'Resolved') ||
        (statusFilter === 'REJECTED' && r.incidentStatus === 'Rejected') ||
        r.incidentStatus === statusFilter;

      const matchArea = areaFilter === 'ALL' || r.area === areaFilter;

      return matchSearch && matchStatus && matchArea;
    });
  }, [reports, searchQuery, statusFilter, areaFilter]);

  const handleStatusChange = async (newStatus: IncidentStatus, customNote?: string) => {
    if (!selectedIncident) return;
    setIsProcessing(true);
    setActionSuccess(null);

    try {
      const noteToSave = customNote || officerNote.trim() || undefined;
      const updated = await updateIncidentStatus(selectedIncident.id, newStatus, noteToSave);
      if (updated) {
        setSelectedIncident(updated);
        setActionSuccess(`Incident ${updated.id} updated to status "${newStatus}".`);
        setOfficerNote('');
        setShowRejectBox(false);
      }
    } catch (err: any) {
      console.error('Failed to update incident:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <span>Operations Center</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-semibold">Incident Review Queue</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Citizen Flood Incident Triage Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluate incoming crowd-sourced reports, examine multimodal AI evidence, and verify emergency dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold font-mono">
            {pendingReviewCount} Pending Verification
          </span>
        </div>
      </div>

      {/* KPI Triage Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pending Officer Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 font-mono mt-1">
            {pendingReviewCount}
          </p>
          <span className="text-[11px] text-slate-400">Needs human verification</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Verified Incidents</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 font-mono mt-1">{verifiedCount}</p>
          <span className="text-[11px] text-slate-400">Pumping teams mobilized</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>High Risk Priority</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-600 font-mono mt-1">{highRiskCount}</p>
          <span className="text-[11px] text-slate-400">Water depth &gt; 30cm</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Resolved Incidents</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 font-mono mt-1">{resolvedCount}</p>
          <span className="text-[11px] text-slate-400">Water receded safely</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Search incident ID, road, area, or reporter name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="ALL">All Operational Statuses</option>
            <option value="PENDING">Pending Review (Submitted / Under Review)</option>
            <option value="VERIFIED">Verified & Alerts Issued</option>
            <option value="RESOLVED">Resolved Incidents</option>
            <option value="REJECTED">Rejected Submissions</option>
          </select>

          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="ALL">All Municipal Areas ({distinctAreas.length})</option>
            {distinctAreas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Incident Review Queue Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Incident</th>
                <th className="py-3 px-4">Location & Municipal Ward</th>
                <th className="py-3 px-4">Water Depth</th>
                <th className="py-3 px-4">AI Vision Assessment</th>
                <th className="py-3 px-4">Passability</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Officer Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No flood reports found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => {
                      setSelectedIncident(report);
                      setActionSuccess(null);
                      setOfficerNote('');
                      setShowRejectBox(false);
                    }}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={report.imageUrl || '/images/flood_street_water_1794422510568.jpg'}
                          alt={report.location}
                          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-200"
                        />
                        <div>
                          <span className="font-mono font-bold text-slate-900 block leading-tight">
                            {report.id}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <span className="font-bold text-slate-800 block truncate leading-tight">
                        {report.location}
                      </span>
                      <span className="text-[11px] text-slate-500">{report.area} Municipal Ward</span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {report.waterLevel}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-cyan-800 font-mono text-[11px]">
                            {report.aiConfidence}%
                          </span>
                          <span className="text-[10px] font-semibold text-slate-600 truncate">
                            {report.aiClassification}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {report.roadAccessibility}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
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
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIncident(report);
                          setActionSuccess(null);
                          setOfficerNote('');
                          setShowRejectBox(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 text-xs font-bold transition-colors"
                      >
                        Review Incident
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Officer Incident Review Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => setSelectedIncident(null)}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {selectedIncident.id}
                  </span>
                  <RiskBadge level={selectedIncident.riskLevel} />
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      selectedIncident.incidentStatus === 'Verified' || selectedIncident.incidentStatus === 'Alert Issued'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedIncident.incidentStatus === 'Resolved'
                        ? 'bg-blue-100 text-blue-800'
                        : selectedIncident.incidentStatus === 'Rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Current Status: {selectedIncident.incidentStatus}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{selectedIncident.location}</h2>
                <p className="text-xs text-slate-500">
                  {selectedIncident.area} Municipal Ward • GPS: {selectedIncident.lat.toFixed(5)}, {selectedIncident.lng.toFixed(5)}
                </p>
              </div>

              <div className="text-right text-xs font-mono text-slate-500">
                <span>Reported: {new Date(selectedIncident.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Photo & Vision Details */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-6">
                <img
                  src={selectedIncident.imageUrl || '/images/flood_street_water_1794422510568.jpg'}
                  alt={selectedIncident.location}
                  className="w-full h-56 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                />
                <span className="text-[10px] text-slate-400 font-mono mt-1.5 block">
                  Geotagged Citizen Photo Evidence
                </span>
              </div>

              <div className="md:col-span-6 space-y-3">
                <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Gemini Vision Assessment</span>
                    </span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                      {selectedIncident.aiConfidence}% Confidence
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white">
                    {selectedIncident.aiClassification}
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed italic">
                    "{selectedIncident.aiVerificationDetails?.explanation || 'Simulated multimodal optical evaluation.'}"
                  </p>
                </div>

                {/* Citizen reporter info */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Citizen Reporter
                  </span>
                  <p className="font-bold text-slate-800">
                    {selectedIncident.reporterName || 'Citizen Contributor'}
                  </p>
                  <p className="text-slate-500 font-mono text-[11px]">
                    Phone: {selectedIncident.reporterPhone || 'Not provided'}
                  </p>
                  {selectedIncident.description && (
                    <p className="text-slate-600 mt-1 italic text-[11px]">
                      "{selectedIncident.description}"
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Operational Actions Grid */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Officer Operational Actions
              </h3>

              {/* Note input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Operational Note / Dispatch Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sucker truck unit #4 mobilized. Flap gates opened."
                  value={officerNote}
                  onChange={(e) => setOfficerNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('Verified')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Incident</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('Alert Issued')}
                  className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Radio className="w-4 h-4" />
                  <span>Issue Alert</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('Resolved')}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Mark Resolved</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowRejectBox(!showRejectBox)}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-red-50 text-red-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Reject Report</span>
                </button>
              </div>

              {/* Rejection Box if toggled */}
              {showRejectBox && (
                <div className="p-4 bg-red-50 rounded-2xl border border-red-200 space-y-3 animate-in fade-in">
                  <span className="text-xs font-bold text-red-900 block">
                    Specify Rejection Reason (Audit Evidence Preserved)
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Duplicate submission, invalid coordinates, or normal runoff."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-red-200 rounded-xl text-slate-900 placeholder-slate-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectBox(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('Rejected', rejectionReason || 'Report rejected by officer.')}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audit History Log */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Audit Trail & Status Log
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-slate-100 text-xs">
                {selectedIncident.statusHistory?.map((entry, idx) => (
                  <div key={idx} className="pt-1.5 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-800">{entry.status}</span>
                      <span className="text-slate-500 ml-1.5">by {entry.authorName}</span>
                      {entry.note && <p className="text-slate-600 text-[11px] mt-0.5">{entry.note}</p>}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
