/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useFlood } from '../context/FloodContext';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  MapPin,
  Compass,
  Droplets,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Info,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { simulateAiVerification, validateCoordinates } from '../utils/floodLogic';

export const ReportFloodPage: React.FC = () => {
  const { addReport } = useFlood();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [locationName, setLocationName] = useState('');
  const [area, setArea] = useState<'Maradana' | 'Wellawatte' | 'Borella' | 'Kolonnawa' | 'Dematagoda' | 'Nugegoda'>('Maradana');
  const [lat, setLat] = useState<number>(6.9271);
  const [lng, setLng] = useState<number>(79.8653);
  const [waterLevel, setWaterLevel] = useState<'Low' | 'Moderate' | 'High' | 'Severe'>('Moderate');
  const [roadAccessibility, setRoadAccessibility] = useState<'Open' | 'Partially Blocked' | 'Completely Blocked'>('Partially Blocked');
  const [floodType, setFloodType] = useState<'Street Waterlogging' | 'Flash Flood' | 'Canal Overflow' | 'Drainage Blockage'>('Street Waterlogging');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');

  // Image Upload state & validation
  const [imagePreview, setImagePreview] = useState<string | null>('/src/assets/images/flood_street_water_1794422510568.jpg');
  const [imageMeta, setImageMeta] = useState<{ name: string; size: string }>({
    name: 'colombo_monsoon_field_sample.jpg',
    size: '1.42 MB',
  });
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // GPS state
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsSuccess, setGpsSuccess] = useState<boolean>(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    id: string;
    hotspotId: string;
    method: string;
    aiConfidence: number;
    aiClassification: string;
    explanation: string;
    isDuplicate?: boolean;
  } | null>(null);

  // Area preset coordinates
  const areaCoordinates: Record<string, { lat: number; lng: number }> = {
    Maradana: { lat: 6.9271, lng: 79.8653 },
    Wellawatte: { lat: 6.8745, lng: 79.8600 },
    Borella: { lat: 6.9110, lng: 79.8770 },
    Kolonnawa: { lat: 6.9360, lng: 79.8850 },
    Dematagoda: { lat: 6.9380, lng: 79.8780 },
    Nugegoda: { lat: 6.8710, lng: 79.8980 },
  };

  const handleAreaChange = (newArea: typeof area) => {
    setArea(newArea);
    if (areaCoordinates[newArea]) {
      setLat(areaCoordinates[newArea].lat);
      setLng(areaCoordinates[newArea].lng);
    }
  };

  const processFile = (file: File) => {
    setImageError(null);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setImageError('Invalid file format. Please upload JPG, PNG, or WEBP images only.');
      return;
    }

    // Validate size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setImageError('File size exceeds 10MB limit. Please choose a smaller photograph.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setImageMeta({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setGpsError(null);
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLng(Number(pos.coords.longitude.toFixed(5)));
        setIsLocating(false);
        setGpsSuccess(true);
      },
      (err) => {
        setIsLocating(false);
        setGpsError(
          'Location access permission denied or timed out. Please select your sector manually below.'
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Preview AI heuristic
  const aiPreview = simulateAiVerification({
    waterLevel,
    floodType,
    hasImage: !!imagePreview,
    description: description || 'Water accumulation observation',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    if (!locationName.trim()) {
      setSubmissionError('Please enter a location name or road description.');
      return;
    }

    if (!validateCoordinates(lat, lng)) {
      setSubmissionError('Invalid latitude or longitude coordinates provided.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await addReport({
        location: locationName.trim(),
        area,
        lat,
        lng,
        waterLevel,
        roadAccessibility,
        floodType,
        description: description.trim() || 'Citizen reported urban street flooding.',
        reporterName: reporterName.trim() || 'Community Contributor',
        reporterPhone: reporterPhone.trim(),
        reporterId: 'citizen_active_session',
        customImage: imagePreview || undefined,
      });

      setIsSubmitting(false);
      setSubmittedResult({
        id: result.report.id,
        hotspotId: result.hotspot.id,
        method: result.report.aiVerificationDetails?.method || 'AI Early Verification',
        aiConfidence: result.report.aiConfidence || 94.2,
        aiClassification: result.report.aiClassification || 'Street Waterlogging',
        explanation:
          result.report.aiVerificationDetails?.explanation ||
          'Automated inspection detected high-probability inundation. Cluster updated.',
        isDuplicate: result.isDuplicate,
      });
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmissionError(err?.message || 'Failed to submit report. Please retry.');
    }
  };

  const handleReset = () => {
    setLocationName('');
    setDescription('');
    setWaterLevel('Moderate');
    setRoadAccessibility('Partially Blocked');
    setFloodType('Street Waterlogging');
    setImagePreview(null);
    setImageError(null);
    setSubmissionError(null);
    setSubmittedResult(null);
    setGpsError(null);
    setGpsSuccess(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Report a Flood Incident
        </h2>
        <p className="text-sm text-slate-500">
          Citizen early warning portal: upload photographs, report waterlogged intersections, and alert municipal drainage squads.
        </p>
      </div>

      {/* Mandatory Privacy & Data Security Notice */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xs flex items-start gap-3.5 text-xs">
        <Lock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white uppercase tracking-wider block mb-0.5 font-mono">
            Citizen Privacy & Geospatial Integrity Notice
          </span>
          <p className="text-slate-300 leading-relaxed">
            Photographs and approximate location coordinates are used exclusively for spatial flood risk
            assessment and municipal dispatch. Personal contact information is protected and accessible
            only to authorized Disaster Management Center (DMC) officers.
          </p>
        </div>
      </div>

      {/* Success Notification Banner after submission */}
      {submittedResult && (
        <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Incident Registered & Assigned to Emergency Feed
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Report ID: <span className="font-mono text-cyan-800">{submittedResult.id}</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Assigned to Hotspot:{' '}
                  <strong className="text-slate-800 font-mono">{submittedResult.hotspotId}</strong>.
                  Visible across the live GIS map, EOC overview, and officer dispatch board.
                </p>

                {submittedResult.isDuplicate && (
                  <p className="text-xs text-amber-800 bg-amber-100 p-2 rounded-lg mt-2 font-medium">
                    Notice: An existing report was detected within 25 meters and 5 minutes. Aggregated into existing spatial cluster.
                  </p>
                )}

                {/* AI verification badge in success */}
                <div className="mt-3 p-3 bg-white/90 rounded-xl border border-emerald-200/90 text-xs text-slate-700">
                  <div className="flex items-center gap-2 font-bold text-slate-900 mb-0.5">
                    <Cpu className="w-4 h-4 text-cyan-700" />
                    <span>{submittedResult.method}: {submittedResult.aiClassification}</span>
                    <span className="text-[10px] bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded font-mono">
                      {submittedResult.aiConfidence}% confidence
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{submittedResult.explanation}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/map')}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>View on Live Map</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Submit Another Report
              </button>
            </div>
          </div>
        </div>
      )}

      {submissionError && (
        <div className="p-3.5 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{submissionError}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100">
        {/* SECTION A — Upload Photograph */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">
                Section A
              </span>
              <h3 className="text-base font-bold text-slate-900">Upload Photographic Evidence</h3>
              <p className="text-xs text-slate-500">
                Attach a street photograph showing water depth, stranded vehicles, or blocked drains.
              </p>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDragging
                ? 'border-cyan-500 bg-cyan-50/50'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            {imagePreview ? (
              <div className="max-w-md mx-auto space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm max-h-56 bg-slate-900">
                  <img
                    src={imagePreview}
                    alt="Uploaded flood evidence"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="font-medium truncate max-w-[200px]">{imageMeta.name}</span>
                  <span className="font-mono text-slate-400">{imageMeta.size}</span>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                >
                  Change Photograph
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-cyan-700 hover:text-cyan-800 underline"
                  >
                    Click to browse
                  </button>
                  <span className="text-xs text-slate-500"> or drag and drop image here</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Validated formats: JPG, JPEG, PNG, WEBP (Maximum size: 10MB)
                </p>

                {/* Pre-loaded sample presets for quick demo */}
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block mb-1">
                    Or select demonstration photo:
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('/src/assets/images/flood_street_water_1794422510568.jpg');
                        setImageMeta({ name: 'maradana_street_flood.jpg', size: '1.42 MB' });
                      }}
                      className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100"
                    >
                      Street Flood
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('/src/assets/images/flood_junction_inundation_1794422511158.jpg');
                        setImageMeta({ name: 'junction_inundation.jpg', size: '1.18 MB' });
                      }}
                      className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100"
                    >
                      Junction Flood
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('/src/assets/images/flood_canal_drainage_1794422511595.jpg');
                        setImageMeta({ name: 'canal_overflow.jpg', size: '1.85 MB' });
                      }}
                      className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100"
                    >
                      Canal Breach
                    </button>
                  </div>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {imageError && (
            <p className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{imageError}</span>
            </p>
          )}
        </div>

        {/* SECTION B — Location Information */}
        <div className="p-6">
          <div className="mb-4">
            <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">
              Section B
            </span>
            <h3 className="text-base font-bold text-slate-900">Geographic Location</h3>
            <p className="text-xs text-slate-500">
              Pinpoint the flooded corridor or road intersection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Location / Street Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Near Technical College Junction, Sri Sangaraja Mawatha"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Colombo Municipal Sector
                </label>
                <select
                  value={area}
                  onChange={(e) => handleAreaChange(e.target.value as typeof area)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="Maradana">Maradana Sector</option>
                  <option value="Wellawatte">Wellawatte Sector</option>
                  <option value="Borella">Borella Sector</option>
                  <option value="Kolonnawa">Kolonnawa Sector</option>
                  <option value="Dematagoda">Dematagoda Sector</option>
                  <option value="Nugegoda">Nugegoda Sector</option>
                </select>
              </div>

              {/* Coordinates & GPS button */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-cyan-600" />
                    GPS Coordinates
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestLocation}
                    disabled={isLocating}
                    className="px-2.5 py-1 text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>{isLocating ? 'Acquiring GPS...' : 'Use My Current Location'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={lat}
                      onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={lng}
                      onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-800"
                    />
                  </div>
                </div>

                {gpsSuccess && (
                  <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    Browser coordinates acquired accurately.
                  </p>
                )}

                {gpsError && (
                  <p className="text-[11px] text-amber-700 flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" />
                    {gpsError}
                  </p>
                )}
              </div>
            </div>

            {/* Mini preview card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Location Preview
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {locationName || 'Unspecified location'}
                </p>
                <p className="text-xs text-slate-500 mb-3">{area}, Colombo Basin</p>
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Lat:</span>
                    <span className="text-slate-800 font-bold">{lat.toFixed(4)}° N</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Lng:</span>
                    <span className="text-slate-800 font-bold">{lng.toFixed(4)}° E</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-500 leading-tight">
                Reports within 500m are aggregated into automated disaster management response
                hotspots.
              </div>
            </div>
          </div>
        </div>

        {/* SECTION C — Incident Details */}
        <div className="p-6">
          <div className="mb-4">
            <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">
              Section C
            </span>
            <h3 className="text-base font-bold text-slate-900">Incident Severity & Attributes</h3>
            <p className="text-xs text-slate-500">
              Select estimated flood depths and traffic disruption parameters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Water Level */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Water Level</label>
              <div className="space-y-1.5">
                {(['Low', 'Moderate', 'High', 'Severe'] as const).map((lvl) => (
                  <label
                    key={lvl}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      waterLevel === lvl
                        ? 'bg-cyan-50 border-cyan-400 text-cyan-900 font-bold'
                        : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{lvl}</span>
                    <input
                      type="radio"
                      name="waterLevel"
                      value={lvl}
                      checked={waterLevel === lvl}
                      onChange={() => setWaterLevel(lvl)}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Road Accessibility */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Road Accessibility
              </label>
              <div className="space-y-1.5">
                {(['Open', 'Partially Blocked', 'Completely Blocked'] as const).map((acc) => (
                  <label
                    key={acc}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      roadAccessibility === acc
                        ? 'bg-cyan-50 border-cyan-400 text-cyan-900 font-bold'
                        : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{acc}</span>
                    <input
                      type="radio"
                      name="roadAccessibility"
                      value={acc}
                      checked={roadAccessibility === acc}
                      onChange={() => setRoadAccessibility(acc)}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Flood Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Flood Type</label>
              <div className="space-y-1.5">
                {(
                  [
                    'Street Waterlogging',
                    'Flash Flood',
                    'Canal Overflow',
                    'Drainage Blockage',
                  ] as const
                ).map((ft) => (
                  <label
                    key={ft}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      floodType === ft
                        ? 'bg-cyan-50 border-cyan-400 text-cyan-900 font-bold'
                        : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{ft}</span>
                    <input
                      type="radio"
                      name="floodType"
                      value={ft}
                      checked={floodType === ft}
                      onChange={() => setFloodType(ft)}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Field Description & Key Landmarks
            </label>
            <textarea
              rows={3}
              placeholder="Describe submerged sidewalks, stranded vehicles, direction of stormwater flow, or vulnerable residents nearby..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                placeholder="Citizen Contributor"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Contact Phone (Optional - For Officer Follow-up)
              </label>
              <input
                type="tel"
                placeholder="+94 77 XXX XXXX"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION D — AI Early Verification Preview */}
        <div className="p-6 bg-slate-50/70">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">
                Section D
              </span>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-700" />
                <span>AI Verification Pipeline & Multimodal Processing</span>
              </h3>
              <p className="text-xs text-slate-500">
                Uploaded images will be verified by Gemini 3.8 Flash or prototype heuristic.
              </p>
            </div>
            <span className="text-[10px] font-mono bg-cyan-100 text-cyan-800 font-bold px-2 py-0.5 rounded">
              Confidence Preview: {aiPreview.confidence}%
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Classification Hypothesis:</span>
              <span className="font-bold text-cyan-800">{aiPreview.assessment}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Initial Pipeline Status:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded ${
                  aiPreview.status === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {aiPreview.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              {aiPreview.explanation}
            </p>
            <div className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded font-medium border border-amber-200">
              Disclaimer: {aiPreview.disclaimer}
            </div>
          </div>
        </div>

        {/* SECTION E — Submission Action */}
        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Form</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-600/25 flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing & Verifying Incident...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>Submit Flood Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
