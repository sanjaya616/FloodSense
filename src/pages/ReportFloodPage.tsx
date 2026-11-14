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
  FileCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Cpu,
  ArrowRight,
  Info,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { validateCoordinates, AiStatus } from '../utils/floodLogic';
import {
  validateAndSanitizeImageFile,
  createSubmissionRequestId,
} from '../utils/imageUtils';
import { FLOOD_IMAGES } from '../assets/images';

export const ReportFloodPage: React.FC = () => {
  const { addReport, dbOperationStatus, userProfile } = useFlood();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state (no silent area/coordinate prefill)
  const [locationName, setLocationName] = useState('');
  const [area, setArea] = useState<string>('');
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [waterLevel, setWaterLevel] = useState<'Low' | 'Moderate' | 'High' | 'Severe'>('Moderate');
  const [roadAccessibility, setRoadAccessibility] = useState<'Open' | 'Partially Blocked' | 'Completely Blocked'>('Partially Blocked');
  const [floodType, setFloodType] = useState<'Street Waterlogging' | 'Flash Flood' | 'Canal Overflow' | 'Drainage Blockage'>('Street Waterlogging');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState(userProfile.name || '');
  const [reporterPhone, setReporterPhone] = useState(userProfile.phone || '');
  const [submissionRequestId, setSubmissionRequestId] = useState<string>(() => createSubmissionRequestId());

  // Image Upload state & validation (Starts EMPTY)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageMeta, setImageMeta] = useState<{ name: string; size: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

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
    aiStatus: AiStatus;
    aiConfidence: number | null;
    aiClassification: string;
    explanation: string;
    isDuplicate?: boolean;
    duplicateOfId?: string;
  } | null>(null);

  const parsedLat = Number.parseFloat(latInput);
  const parsedLng = Number.parseFloat(lngInput);
  const coordsAreValid = latInput.trim() !== '' && lngInput.trim() !== '' && validateCoordinates(parsedLat, parsedLng);

  // Area preset coordinates
  const areaCoordinates: Record<string, { lat: number; lng: number }> = {
    Maradana: { lat: 6.9271, lng: 79.8653 },
    Wellawatte: { lat: 6.8745, lng: 79.8600 },
    Borella: { lat: 6.9110, lng: 79.8770 },
    Kolonnawa: { lat: 6.9360, lng: 79.8850 },
    Dematagoda: { lat: 6.9380, lng: 79.8780 },
    Nugegoda: { lat: 6.8710, lng: 79.8980 },
  };

  const handleAreaChange = (newArea: string) => {
    setArea(newArea);
    setGpsSuccess(false);
    if (areaCoordinates[newArea]) {
      setLatInput(areaCoordinates[newArea].lat.toFixed(5));
      setLngInput(areaCoordinates[newArea].lng.toFixed(5));
    }
  };

  const processFile = async (file: File) => {
    setImageError(null);
    setIsProcessingImage(true);
    try {
      const sanitized = await validateAndSanitizeImageFile(file);
      setSelectedFile(sanitized.file);
      setImageMimeType(sanitized.mimeType);
      setImageMeta({
        name: file.name,
        size: `${sanitized.sizeLabel}${sanitized.exifStripped ? ' · EXIF stripped' : ''}`,
      });
      setImagePreview(sanitized.dataUrl);
      setImageBase64(sanitized.dataUrl);
    } catch (err: any) {
      setImageError(err?.message || 'Unable to process selected image file.');
    } finally {
      setIsProcessingImage(false);
    }
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
        setLatInput(pos.coords.latitude.toFixed(5));
        setLngInput(pos.coords.longitude.toFixed(5));
        setIsLocating(false);
        setGpsSuccess(true);
      },
      () => {
        setIsLocating(false);
        setGpsError(
          'Location access permission was not granted. Please select your sector or enter coordinates manually below.'
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Pre-load demonstration image preset
  const selectPresetImage = async (url: string, name: string) => {
    setImageError(null);
    setImagePreview(url);
    setImageMeta({ name, size: 'Demonstration Preset' });
    setSelectedFile(null);

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      setImageMimeType(blob.type || 'image/jpeg');
      const reader = new FileReader();
      reader.onload = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(blob);
    } catch {
      setImageBase64(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent, omitPhoto = false) => {
    e.preventDefault();
    setSubmissionError(null);

    if (!locationName.trim()) {
      setSubmissionError('Please enter a location name or road description.');
      return;
    }

    if (!area.trim()) {
      setSubmissionError('Please select a Colombo Municipal Sector.');
      return;
    }

    if (!coordsAreValid) {
      setSubmissionError('Please acquire GPS coordinates, pick a sector, or enter valid latitude/longitude coordinates.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await addReport({
        location: locationName.trim(),
        area,
        lat: parsedLat,
        lng: parsedLng,
        waterLevel,
        roadAccessibility,
        floodType,
        description: description.trim() || 'Citizen reported urban street flooding.',
        reporterName: reporterName.trim() || userProfile.name || 'Community Contributor',
        reporterPhone: reporterPhone.trim(),
        reporterId: userProfile.uid || userProfile.email || 'citizen_active_session',
        imageFile: !omitPhoto && selectedFile ? selectedFile : undefined,
        customImage: !omitPhoto && imageBase64 ? imageBase64 : undefined,
        imageUrl: !omitPhoto && imagePreview ? imagePreview : undefined,
        imageMimeType: !omitPhoto ? imageMimeType : undefined,
        submissionRequestId,
      });

      setIsSubmitting(false);
      setSubmittedResult({
        id: result.report.id,
        hotspotId: result.hotspot.id,
        method: result.report.aiVerificationDetails?.method || 'AI Early Verification',
        aiStatus: result.report.aiStatus || (omitPhoto || !imageBase64 ? 'NOT_RUN' : 'COMPLETED'),
        aiConfidence: result.report.aiConfidence ?? null,
        aiClassification:
          result.report.aiClassification ||
          result.report.aiVerificationDetails?.aiAssessment ||
          'No Photograph Attached',
        explanation:
          result.report.aiVerificationDetails?.explanation ||
          'Incident saved and queued for official officer verification.',
        isDuplicate: result.isDuplicate,
        duplicateOfId: result.duplicateOfId,
      });
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmissionError(err?.message || 'Failed to submit report. Please retry.');
    }
  };

  const handleReset = () => {
    setLocationName('');
    setArea('');
    setLatInput('');
    setLngInput('');
    setDescription('');
    setWaterLevel('Moderate');
    setRoadAccessibility('Partially Blocked');
    setFloodType('Street Waterlogging');
    setImagePreview(null);
    setImageBase64(null);
    setSelectedFile(null);
    setImageMeta(null);
    setImageError(null);
    setSubmissionError(null);
    setSubmittedResult(null);
    setGpsError(null);
    setGpsSuccess(false);
    setSubmissionRequestId(createSubmissionRequestId());
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
                  Status: <strong className="text-amber-700">Under Review</strong> (Awaiting official officer confirmation).
                </p>

                {submittedResult.isDuplicate && (
                  <p className="text-xs text-amber-800 bg-amber-100 p-2.5 rounded-lg mt-2 font-medium">
                    Notice: An existing report was detected within 25 meters and 5 minutes (Original: {submittedResult.duplicateOfId}).
                    Your submission has been cataloged as an audited duplicate without distorting unique citizen counts.
                  </p>
                )}

                {/* AI verification badge in success */}
                <div className="mt-3 p-3 bg-white/90 rounded-xl border border-emerald-200/90 text-xs text-slate-700">
                  <div className="flex items-center gap-2 font-bold text-slate-900 mb-0.5 flex-wrap">
                    <Cpu className="w-4 h-4 text-cyan-700" />
                    <span>{submittedResult.method}: {submittedResult.aiClassification}</span>
                    <span className="text-[10px] bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded font-mono">
                      {submittedResult.aiStatus === 'NOT_RUN'
                        ? 'AI NOT RUN'
                        : submittedResult.aiStatus === 'FAILED'
                        ? 'AI FAILED'
                        : submittedResult.aiStatus === 'SIMULATED'
                        ? `Simulated ${submittedResult.aiConfidence ?? 'N/A'}%`
                        : `${submittedResult.aiConfidence ?? 'N/A'}% confidence`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{submittedResult.explanation}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/officer/map')}
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
        <div className="p-3.5 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{submissionError}</span>
          </div>
          {imagePreview && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px]"
            >
              Submit Without Photo
            </button>
          )}
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
                      setImageBase64(null);
                      setSelectedFile(null);
                      setImageMeta(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {imageMeta && (
                  <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-medium truncate max-w-[200px]">{imageMeta.name}</span>
                    <span className="font-mono text-slate-400">{imageMeta.size}</span>
                  </div>
                )}

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
                  Validated formats: JPG, JPEG, PNG, WEBP (Maximum size: 5MB)
                </p>

                {/* Pre-loaded sample presets for quick academic evaluation */}
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block mb-1">
                    Or select demonstration photo preset:
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectPresetImage(FLOOD_IMAGES.streetWater, 'maradana_street_flood.jpg')}
                      className="text-[10px] px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 font-medium"
                    >
                      Street Flood
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPresetImage(FLOOD_IMAGES.junctionInundation, 'junction_inundation.jpg')}
                      className="text-[10px] px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 font-medium"
                    >
                      Junction Flood
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPresetImage(FLOOD_IMAGES.canalDrainage, 'canal_overflow.jpg')}
                      className="text-[10px] px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 font-medium"
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
                  Colombo Municipal Sector <span className="text-red-500">*</span>
                </label>
                <select
                  value={area}
                  required
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="">Select municipal sector...</option>
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
                    GPS Coordinates <span className="text-red-500">*</span>
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
                      placeholder="6.92710"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="79.86530"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
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
                <p className="text-xs text-slate-500 mb-3">
                  {area ? `${area}, Colombo Basin` : 'Select sector or acquire GPS'}
                </p>
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Lat:</span>
                    <span className="text-slate-800 font-bold">
                      {coordsAreValid ? `${parsedLat.toFixed(4)}° N` : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Lng:</span>
                    <span className="text-slate-800 font-bold">
                      {coordsAreValid ? `${parsedLng.toFixed(4)}° E` : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-500 leading-tight">
                Reports within 500m and 2 hours are clustered algorithmically into disaster management response hotspots.
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
                Contact Phone (Optional - Protected PII)
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

        {/* SECTION D — AI Early Verification Pipeline */}
        <div className="p-6 bg-slate-50/70">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">
                Section D
              </span>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-700" />
                <span>AI Verification Pipeline &amp; Multimodal Processing</span>
              </h3>
              <p className="text-xs text-slate-500">
                {imagePreview
                  ? 'On submission, your EXIF-stripped photograph will be inspected by server-side Gemini 4 Hydrogen (or academic heuristic if no API key is configured).'
                  : 'No photograph attached — AI vision analysis will be skipped (NOT RUN) and your report will enter human officer review directly.'}
              </p>
            </div>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
              {isProcessingImage ? 'Sanitizing...' : imagePreview ? 'Photo Ready' : 'No Photo'}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Initial Pipeline Status:</span>
              <span className="font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                Under Review (Human Officer Confirmation Required)
              </span>
            </div>
            <div className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded font-medium border border-amber-200">
              Notice: AI assessment is an assistive early warning signal only and runs only after submission when a photograph is attached. Official status requires emergency officer confirmation.
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
              disabled={isSubmitting || dbOperationStatus.loading}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-600/25 flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting || dbOperationStatus.loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing & Uploading Incident...</span>
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
