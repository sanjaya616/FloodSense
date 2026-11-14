/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FileText,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Eye,
  X,
  RefreshCw,
  Ban,
  MessageSquare,
  ImageOff,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { RiskBadge } from '../../components/common/RiskBadge';
import { FloodReport } from '../../utils/floodLogic';

export const CitizenReportsPage: React.FC = () => {
  const { myReports, retryAiVerification } = useFlood();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<FloodReport | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const filteredReports = myReports.filter((r) => {
    const matchSearch =
      searchQuery === '' ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.area.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') {
      return (
        r.incidentStatus === 'Submitted' ||
        r.incidentStatus === 'Under Review' ||
        r.incidentStatus === 'More Info Requested' ||
        r.incidentStatus === 'Verified' ||
        r.incidentStatus === 'Alert Issued'
      );
    }
    if (filterStatus === 'VERIFIED') {
      return r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued';
    }
    if (filterStatus === 'RESOLVED') {
      return r.incidentStatus === 'Resolved';
    }
    return true;
  });

  // 6-stage timeline progress:
  // 1: Submitted -> 2: AI Reviewed -> 3: Under Officer Review -> 4: Verified -> 5: Alert Issued -> 6: Resolved
  const getTimelineStep = (report: FloodReport) => {
    switch (report.incidentStatus) {
      case 'Submitted':
        return report.aiStatus === 'COMPLETED' ? 2 : 1;
      case 'Under Review':
      case 'More Info Requested':
        return 3;
      case 'Verified':
        return 4;
      case 'Alert Issued':
        return 5;
      case 'Resolved':
        return 6;
      case 'Rejected':
        return 0;
      default:
        return 1;
    }
  };

  const timelineStages = [
    { num: 1, label: 'Submitted' },
    { num: 2, label: 'AI Reviewed' },
    { num: 3, label: 'Officer Review' },
    { num: 4, label: 'Verified' },
    { num: 5, label: 'Alert Issued' },
    { num: 6, label: 'Resolved' },
  ];

  const handleRetryAi = async (reportId: string) => {
    setRetryingId(reportId);
    try {
      const updated = await retryAiVerification(reportId);
      if (updated && selectedReport?.id === reportId) {
        setSelectedReport(updated);
      }
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 mb-1">
            <NavLink to="/citizen" className="hover:underline">
              Citizen Portal
            </NavLink>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>My Reports</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Track My Flood Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time status tracking from submission to DMC field response and road clearance.
          </p>
        </div>

        <NavLink
          to="/citizen/report"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md shadow-cyan-600/20 transition-all self-start sm:self-center"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Report Another Road</span>
        </NavLink>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Search by Report ID, location, or area (e.g. REP-101, Maradana)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Reports' },
            { id: 'ACTIVE', label: 'Active Incidents' },
            { id: 'VERIFIED', label: 'DMC Verified' },
            { id: 'RESOLVED', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterStatus === tab.id
                  ? 'bg-cyan-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No flood reports found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven't submitted any reports matching this filter yet. When you report a road, you
              can track the progress here.
            </p>
            <NavLink
              to="/citizen/report"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl mt-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report Flooded Road Now</span>
            </NavLink>
          </div>
        ) : (
          filteredReports.map((report) => {
            const stepNum = getTimelineStep(report);
            const aiFailed = report.aiStatus === 'FAILED' || report.aiClassification === 'AI Processing Failed';

            return (
              <div
                key={report.id}
                className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 hover:border-slate-300 transition-all shadow-2xs space-y-5"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {report.imageUrl ? (
                      <img
                        src={report.imageUrl}
                        alt={report.location}
                        className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-slate-100 shadow-2xs"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <ImageOff className="w-4 h-4" />
                        <span className="text-[8px] font-bold uppercase mt-0.5">No Photo</span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-800">
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
                              : report.incidentStatus === 'More Info Requested'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {report.incidentStatus}
                        </span>
                        {report.isDuplicate && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            Duplicate of {report.duplicateOfReportId}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {report.location}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {report.area} Municipal Ward • Reported {new Date(report.timestamp).toLocaleDateString()},{' '}
                        {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedReport(report)}
                    className="self-start sm:self-center px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-cyan-800 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Full Log</span>
                  </button>
                </div>

                {/* Branch Explanations for Rejected / More Info Requested / Duplicate */}
                {report.incidentStatus === 'Rejected' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                    <Ban className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Report Rejected by Emergency Officer</span>
                      <span>
                        {report.officerNotes?.[report.officerNotes.length - 1] ||
                          'Officer determined this submission did not require emergency dispatch.'}
                      </span>
                    </div>
                  </div>
                )}

                {report.incidentStatus === 'More Info Requested' && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Officer Requested Additional Information</span>
                      <span>
                        {report.officerNotes?.[report.officerNotes.length - 1] ||
                          'Please verify street landmark or attach a clearer daytime photograph.'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 6-Stage Timeline Stepper */}
                {report.incidentStatus !== 'Rejected' && (
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      6-Stage Operational Lifecycle Progress:
                    </span>
                    <div className="flex items-center justify-between">
                      {timelineStages.map((stage, idx) => {
                        const isPassed = stepNum >= stage.num;
                        const isCurrent = stepNum === stage.num;
                        return (
                          <React.Fragment key={stage.num}>
                            <div className="flex flex-col items-center gap-1 flex-1">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                  isPassed
                                    ? 'bg-emerald-500 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : stage.num}
                              </div>
                              <span
                                className={`text-[9px] font-bold text-center leading-tight ${
                                  isCurrent
                                    ? 'text-cyan-700 font-extrabold'
                                    : isPassed
                                    ? 'text-slate-700'
                                    : 'text-slate-400'
                                }`}
                              >
                                {stage.label}
                              </span>
                            </div>
                            {idx < timelineStages.length - 1 && (
                              <div
                                className={`h-0.5 flex-1 mb-4 transition-colors ${
                                  stepNum > stage.num ? 'bg-emerald-500' : 'bg-slate-200'
                                }`}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI & Officer Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      aiFailed ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        AI Vision Analysis (
                        {aiFailed
                          ? 'Failed'
                          : report.aiStatus === 'NOT_RUN' ||
                            (!report.imageUrl && report.aiConfidence == null)
                          ? 'Not Run — No Photo'
                          : report.aiStatus === 'SIMULATED'
                          ? `${report.aiConfidence ?? 'N/A'}% Simulated`
                          : report.aiConfidence != null
                          ? `${report.aiConfidence}% confidence`
                          : 'Confidence N/A'}
                        )
                      </span>
                      <p className={`font-semibold text-xs mt-0.5 ${aiFailed ? 'text-red-800' : 'text-slate-800'}`}>
                        {report.aiClassification ||
                          (report.aiStatus === 'NOT_RUN' ? 'AI Not Run (No Image)' : 'Under Review')}
                      </p>
                    </div>
                    {aiFailed && (
                      <button
                        type="button"
                        disabled={retryingId === report.id}
                        onClick={() => handleRetryAi(report.id)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${retryingId === report.id ? 'animate-spin' : ''}`} />
                        <span>{retryingId === report.id ? 'Retrying...' : 'Retry AI'}</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Latest Operations Status
                    </span>
                    <p className="font-semibold text-slate-800 text-xs mt-0.5">
                      {report.officerNotes && report.officerNotes.length > 0
                        ? report.officerNotes[report.officerNotes.length - 1]
                        : report.incidentStatus === 'Verified'
                        ? 'Confirmed by emergency officer. Drainage response dispatched.'
                        : 'Awaiting on-site field officer verification.'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => setSelectedReport(null)}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-slate-500">{selectedReport.id}</span>
                <RiskBadge level={selectedReport.riskLevel} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{selectedReport.location}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{selectedReport.area} Municipal Ward</p>
            </div>

            {selectedReport.imageUrl && (
              <img
                src={selectedReport.imageUrl}
                alt={selectedReport.location}
                className="w-full max-h-72 rounded-2xl object-cover border border-slate-200"
              />
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-slate-400 block">Water Depth:</span>
                <span className="font-bold text-slate-800">{selectedReport.waterLevel}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Road Passability:</span>
                <span className="font-bold text-slate-800">{selectedReport.roadAccessibility}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Flood Type:</span>
                <span className="font-bold text-slate-800">{selectedReport.floodType}</span>
              </div>
            </div>

            {/* AI Breakdown */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-300">Multimodal AI Assessment</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {selectedReport.aiStatus === 'FAILED'
                    ? 'AI FAILED'
                    : selectedReport.aiStatus === 'NOT_RUN' ||
                      (!selectedReport.imageUrl && selectedReport.aiConfidence == null)
                    ? 'NOT RUN'
                    : selectedReport.aiStatus === 'SIMULATED'
                    ? `${selectedReport.aiConfidence ?? 'N/A'}% (Simulated)`
                    : selectedReport.aiConfidence != null
                    ? `${selectedReport.aiConfidence}%`
                    : 'N/A'}
                </span>
              </div>
              <p className="text-slate-300 font-medium">
                {selectedReport.aiClassification ||
                  (selectedReport.aiStatus === 'NOT_RUN' ? 'AI Not Run (No Image)' : 'Under Review')}
              </p>
              {selectedReport.aiVerificationDetails?.explanation && (
                <p className="text-[11px] text-slate-400 italic">
                  "{selectedReport.aiVerificationDetails.explanation}"
                </p>
              )}
              {selectedReport.aiStatus === 'FAILED' && (
                <button
                  type="button"
                  disabled={retryingId === selectedReport.id}
                  onClick={() => handleRetryAi(selectedReport.id)}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retryingId === selectedReport.id ? 'animate-spin' : ''}`} />
                  <span>Retry AI Verification</span>
                </button>
              )}
            </div>

            {/* Status History Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Full Incident Audit Trail
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedReport.statusHistory?.map((entry, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="font-bold text-slate-800">{entry.status}</span>
                      <span className="font-mono text-[10px]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">By {entry.authorName}</p>
                    {entry.note && (
                      <p className="text-slate-700 text-xs mt-1 bg-white p-2 rounded-lg border border-slate-100">
                        {entry.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
