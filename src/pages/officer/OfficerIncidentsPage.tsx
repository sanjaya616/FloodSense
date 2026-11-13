/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  X,
  Radio,
  CloudRain,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  MapPin,
  Flame,
  Navigation,
  Phone,
  User,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { RiskBadge } from '../../components/common/RiskBadge';
import { FloodMap } from '../../components/map/FloodMap';
import {
  FloodReport,
  IncidentStatus,
  calculateHaversineDistance,
} from '../../utils/floodLogic';

export const OfficerIncidentsPage: React.FC = () => {
  const {
    reports,
    updateIncidentStatus,
    retryAiVerification,
    hotspots,
    weather,
  } = useFlood();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<FloodReport | null>(null);

  // Review modal form state
  const [officerNote, setOfficerNote] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [infoRequestPrompt, setInfoRequestPrompt] = useState<string>('');
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);
  const [showInfoRequestBox, setShowInfoRequestBox] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isRetryingAi, setIsRetryingAi] = useState<boolean>(false);

  // Metric counts
  const pendingReviewCount = useMemo(
    () =>
      reports.filter(
        (r) =>
          r.incidentStatus === 'Submitted' ||
          r.incidentStatus === 'Under Review' ||
          r.incidentStatus === 'More Info Requested'
      ).length,
    [reports]
  );
  const verifiedCount = useMemo(
    () =>
      reports.filter(
        (r) => r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued'
      ).length,
    [reports]
  );
  const highRiskCount = useMemo(
    () =>
      reports.filter((r) => r.riskLevel === 'HIGH' && r.incidentStatus !== 'Resolved')
        .length,
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

  // Helper to resolve matched hotspot cluster for any report
  const findHotspotForReport = (report: FloodReport) =>
    hotspots.find(
      (h) => h.id === report.hotspotId || h.associatedReportIds.includes(report.id)
    ) || null;

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
        (statusFilter === 'PENDING' &&
          (r.incidentStatus === 'Submitted' || r.incidentStatus === 'Under Review')) ||
        (statusFilter === 'MORE_INFO' && r.incidentStatus === 'More Info Requested') ||
        (statusFilter === 'VERIFIED' &&
          (r.incidentStatus === 'Verified' || r.incidentStatus === 'Alert Issued')) ||
        (statusFilter === 'RESOLVED' && r.incidentStatus === 'Resolved') ||
        (statusFilter === 'REJECTED' && r.incidentStatus === 'Rejected') ||
        r.incidentStatus === statusFilter;

      const matchArea = areaFilter === 'ALL' || r.area === areaFilter;

      return matchSearch && matchStatus && matchArea;
    });
  }, [reports, searchQuery, statusFilter, areaFilter]);

  // Modal contextual intelligence (matched hotspot + nearby reports within 1km)
  const matchedHotspot = useMemo(
    () => (selectedIncident ? findHotspotForReport(selectedIncident) : null),
    [selectedIncident, hotspots]
  );

  const nearbyReports = useMemo(() => {
    if (!selectedIncident) return [];
    return reports
      .filter((r) => r.id !== selectedIncident.id)
      .map((r) => ({
        report: r,
        distanceMeters: Math.round(
          calculateHaversineDistance(selectedIncident.lat, selectedIncident.lng, r.lat, r.lng)
        ),
      }))
      .filter((item) => item.distanceMeters <= 1000)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [selectedIncident, reports]);

  const openIncidentModal = (report: FloodReport) => {
    setSelectedIncident(report);
    setActionSuccess(null);
    setActionError(null);
    setOfficerNote('');
    setRejectionReason('');
    setInfoRequestPrompt('');
    setShowRejectBox(false);
    setShowInfoRequestBox(false);
  };

  const handleStatusChange = async (newStatus: IncidentStatus, customNote?: string) => {
    if (!selectedIncident) return;
    setIsProcessing(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const noteToSave = customNote || officerNote.trim() || undefined;
      const updated = await updateIncidentStatus(selectedIncident.id, newStatus, noteToSave);
      if (updated) {
        setSelectedIncident(updated);
        setActionSuccess(`Incident ${updated.id} updated to status "${newStatus}".`);
        setOfficerNote('');
        setRejectionReason('');
        setInfoRequestPrompt('');
        setShowRejectBox(false);
        setShowInfoRequestBox(false);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Unable to update incident status.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryAi = async () => {
    if (!selectedIncident) return;
    setIsRetryingAi(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await retryAiVerification(selectedIncident.id);
      if (updated) {
        setSelectedIncident(updated);
        if (updated.aiStatus === 'COMPLETED') {
          setActionSuccess(
            `AI reassessment completed: ${updated.aiClassification} (${updated.aiConfidence}% confidence).`
          );
        } else {
          setActionError(
            updated.aiVerificationDetails?.explanation ||
              'AI vision retry failed. Please continue with officer manual review.'
          );
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'AI vision retry failed.');
    } finally {
      setIsRetryingAi(false);
    }
  };

  const getStatusBadgeClasses = (status: IncidentStatus) => {
    switch (status) {
      case 'Verified':
      case 'Alert Issued':
        return 'bg-emerald-100 text-emerald-800';
      case 'Resolved':
        return 'bg-blue-100 text-blue-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'More Info Requested':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-amber-100 text-amber-800';
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
            Evaluate incoming crowd-sourced reports, inspect GPS context & AI vision evidence, and verify emergency dispatch.
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
            placeholder="Search report ID, road, municipal area, or citizen name..."
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
            <option value="MORE_INFO">More Info Requested</option>
            <option value="VERIFIED">Verified &amp; Alerts Issued</option>
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

      {/* Incident Review Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-2.5 px-2.5">Report</th>
                <th className="py-2.5 px-2.5">Citizen</th>
                <th className="py-2.5 px-2.5">Location &amp; Hotspot</th>
                <th className="py-2.5 px-2">Photo</th>
                <th className="py-2.5 px-2.5">AI Assessment</th>
                <th className="py-2.5 px-2">Risk</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No flood reports found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const hs = findHotspotForReport(report);
                  const isAiFailed = report.aiStatus === 'FAILED';

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => openIncidentModal(report)}
                    >
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 block leading-tight">
                          {report.id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(report.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 block leading-tight max-w-[105px] truncate">
                          {report.reporterName || 'Citizen Reporter'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {report.reporterPhone || 'No phone'}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 max-w-[150px]">
                        <span className="font-bold text-slate-800 block truncate leading-tight">
                          {report.location}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-slate-500 truncate">{report.area}</span>
                          {hs && (
                            <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 shrink-0">
                              {hs.id}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-2">
                        <img
                          src={report.imageUrl || '/images/flood_street_water_1794422510568.jpg'}
                          alt={report.location}
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      </td>

                      <td className="py-2.5 px-2.5 max-w-[135px]">
                        <span
                          className={`text-[11px] font-semibold block truncate ${
                            isAiFailed ? 'text-red-700' : 'text-slate-700'
                          }`}
                        >
                          {report.aiClassification || 'Under Evaluation'}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isAiFailed ? (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                              AI FAILED
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-cyan-800">
                              {report.aiConfidence ?? 0}%
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 truncate">· {report.waterLevel}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <RiskBadge level={report.riskLevel} size="sm" />
                      </td>

                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block whitespace-nowrap ${getStatusBadgeClasses(
                            report.incidentStatus
                          )}`}
                        >
                          {report.incidentStatus}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openIncidentModal(report);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 text-[11px] font-bold transition-colors whitespace-nowrap"
                        >
                          Review
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

      {/* Comprehensive Officer Incident Inspection Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95"
            role="dialog"
            aria-modal="true"
            aria-label={`Inspect incident ${selectedIncident.id}`}
          >
            <button
              type="button"
              onClick={() => setSelectedIncident(null)}
              aria-label="Close incident review modal"
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 pr-10">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {selectedIncident.id}
                  </span>
                  <RiskBadge level={selectedIncident.riskLevel} />
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getStatusBadgeClasses(
                      selectedIncident.incidentStatus
                    )}`}
                  >
                    Status: {selectedIncident.incidentStatus}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{selectedIncident.location}</h2>
                <p className="text-xs text-slate-500">
                  {selectedIncident.area} Municipal Ward • GPS:{' '}
                  <span className="font-mono">
                    {selectedIncident.lat.toFixed(5)}, {selectedIncident.lng.toFixed(5)}
                  </span>
                </p>
              </div>

              <div className="text-left sm:text-right text-xs font-mono text-slate-500 shrink-0">
                <span>Submitted: {new Date(selectedIncident.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Two-Column Evidence & Context Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Photo, Mini GPS Map, Citizen Description & Reporter Info */}
              <div className="lg:col-span-6 space-y-4">
                <div>
                  <img
                    src={
                      selectedIncident.imageUrl || '/images/flood_street_water_1794422510568.jpg'
                    }
                    alt={selectedIncident.location}
                    className="w-full h-52 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                    Submitted Citizen Photographic Evidence
                  </span>
                </div>

                {/* Mini Leaflet Map Focused on Incident Pin */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                      <span>GPS Location Pin &amp; Nearby Context</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {nearbyReports.length} report(s) within 1 km
                    </span>
                  </div>
                  <FloodMap
                    hotspots={matchedHotspot ? [matchedHotspot] : []}
                    reports={[selectedIncident, ...nearbyReports.map((n) => n.report)]}
                    selectedHotspotId={matchedHotspot?.id || null}
                    focusCoordinates={[selectedIncident.lat, selectedIncident.lng]}
                    focusZoom={15}
                    heightClass="h-48"
                    showLegendOverlay={false}
                    showSectorControls={false}
                  />
                </div>

                {/* Field Attributes & Narrative */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Water Depth
                    </span>
                    <span className="font-bold text-slate-800">{selectedIncident.waterLevel}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Road Status
                    </span>
                    <span className="font-bold text-slate-800">
                      {selectedIncident.roadAccessibility}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Flood Type
                    </span>
                    <span className="font-bold text-slate-800 truncate block">
                      {selectedIncident.floodType}
                    </span>
                  </div>
                </div>

                {/* Citizen Reporter Card */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Citizen Reporter &amp; Field Observations
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      {selectedIncident.reporterName || 'Citizen Contributor'}
                    </span>
                    <span className="text-slate-600 font-mono text-[11px] flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {selectedIncident.reporterPhone || 'Not provided'}
                    </span>
                  </div>
                  {selectedIncident.description && (
                    <p className="text-slate-700 text-xs leading-relaxed pt-1">
                      &ldquo;{selectedIncident.description}&rdquo;
                    </p>
                  )}
                  {selectedIncident.additionalObservations && (
                    <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                      <strong>Additional observations:</strong>{' '}
                      {selectedIncident.additionalObservations}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: AI Vision, Weather Summary, Hotspot Cluster & Nearby Reports */}
              <div className="lg:col-span-6 space-y-4">
                {/* AI Assessment Card */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Vision Assessment</span>
                    </span>
                    {selectedIncident.aiStatus === 'FAILED' ? (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                        AI Processing Failed
                      </span>
                    ) : (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        {selectedIncident.aiConfidence ?? 0}% Confidence
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-white">
                    {selectedIncident.aiClassification || 'Pending AI Review'}
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {selectedIncident.aiVerificationDetails?.explanation ||
                      'Automated optical review is an assistive signal; human officer verification is mandatory.'}
                  </p>
                  {selectedIncident.aiVerificationDetails?.uncertainty && (
                    <p className="text-[10px] text-amber-300 bg-slate-800/80 p-2 rounded-lg">
                      Uncertainty: {selectedIncident.aiVerificationDetails.uncertainty}
                    </p>
                  )}
                  {selectedIncident.aiStatus === 'FAILED' && (
                    <button
                      type="button"
                      disabled={isRetryingAi}
                      onClick={handleRetryAi}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isRetryingAi ? 'animate-spin' : ''}`}
                      />
                      <span>{isRetryingAi ? 'Retrying AI...' : 'Retry AI Analysis'}</span>
                    </button>
                  )}
                </div>

                {/* Weather Summary Card */}
                <div className="p-4 bg-cyan-50/70 border border-cyan-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-950 flex items-center gap-1.5">
                      <CloudRain className="w-4 h-4 text-cyan-700" />
                      <span>Colombo Weather Context</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-cyan-200 text-cyan-800">
                      {weather.isLive ? 'Open-Meteo Live' : 'Demo Weather'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-cyan-800 uppercase block">Condition</span>
                      <span className="font-bold text-slate-900">{weather.condition}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-cyan-800 uppercase block">Current Rain</span>
                      <span className="font-bold font-mono text-slate-900">
                        {weather.currentRainfallMm} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-cyan-800 uppercase block">3h Forecast</span>
                      <span className="font-bold font-mono text-slate-900">
                        {weather.expected3hRainfallMm} mm
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hotspot Cluster Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <span>Geospatial Hotspot Cluster</span>
                    </span>
                    {matchedHotspot && (
                      <RiskBadge level={matchedHotspot.riskLevel} size="sm" />
                    )}
                  </div>
                  {matchedHotspot ? (
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800">
                        {matchedHotspot.id} — {matchedHotspot.location}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {matchedHotspot.reportCount} unique report(s) within{' '}
                        {matchedHotspot.clusterRadiusMeters || 500}m • Risk Score:{' '}
                        <span className="font-mono font-bold">{matchedHotspot.riskScore}/100</span>
                      </p>
                      <p className="text-[11px] text-slate-500 italic">
                        {matchedHotspot.precaution}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Not yet grouped into an active geospatial hotspot cluster.
                    </p>
                  )}
                </div>

                {/* Nearby Reports within 1 km */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-slate-500" />
                      <span>Nearby Reports (&le; 1 km)</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {nearbyReports.length} found
                    </span>
                  </div>
                  {nearbyReports.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      No other flood reports recorded within 1 km of this GPS pin.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {nearbyReports.map(({ report, distanceMeters }) => (
                        <button
                          key={report.id}
                          type="button"
                          onClick={() => openIncidentModal(report)}
                          className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-cyan-50 border border-slate-100 flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate">
                              {report.id} · {report.location}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {report.waterLevel} depth · {report.incidentStatus}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] font-bold text-cyan-800 shrink-0">
                            {distanceMeters} m
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Operational Actions Grid */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Officer Operational Actions
              </h3>

              {/* Note input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Operational Note / Citizen Message / Dispatch Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sucker truck unit #4 mobilized. Flap gates opened."
                  value={officerNote}
                  onChange={(e) => setOfficerNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              {/* 5 Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('Verified')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Approve &amp; Verify</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    setShowInfoRequestBox(!showInfoRequestBox);
                    setShowRejectBox(false);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>Request Info</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('Alert Issued')}
                  className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Radio className="w-4 h-4 shrink-0" />
                  <span>Issue Alert</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('Resolved')}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Mark Resolved</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    setShowRejectBox(!showRejectBox);
                    setShowInfoRequestBox(false);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-red-50 text-red-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 col-span-2 sm:col-span-1"
                >
                  <X className="w-4 h-4 shrink-0" />
                  <span>Reject Report</span>
                </button>
              </div>

              {/* Request More Info Box if toggled */}
              {showInfoRequestBox && (
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-3 animate-in fade-in">
                  <span className="text-xs font-bold text-purple-950 block">
                    Request Clarification from Citizen Reporter
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Please confirm nearby junction landmark or upload a clearer daylight photo."
                    value={infoRequestPrompt}
                    onChange={(e) => setInfoRequestPrompt(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-purple-200 rounded-xl text-slate-900 placeholder-slate-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInfoRequestBox(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusChange(
                          'More Info Requested',
                          infoRequestPrompt.trim() ||
                            officerNote.trim() ||
                            'Officer requested clearer street landmarks or updated water level details.'
                        )
                      }
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl"
                    >
                      Send Info Request
                    </button>
                  </div>
                </div>
              )}

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
                      onClick={() =>
                        handleStatusChange(
                          'Rejected',
                          rejectionReason.trim() ||
                            officerNote.trim() ||
                            'Report rejected by emergency officer.'
                        )
                      }
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
                Audit Trail &amp; Status Log
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-slate-100 text-xs">
                {selectedIncident.statusHistory?.map((entry, idx) => (
                  <div key={idx} className="pt-1.5 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-800">{entry.status}</span>
                      <span className="text-slate-500 ml-1.5">by {entry.authorName}</span>
                      {entry.note && (
                        <p className="text-slate-600 text-[11px] mt-0.5">{entry.note}</p>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {new Date(entry.timestamp).toLocaleString()}
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
