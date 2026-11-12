/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import {
  Camera,
  MapPin,
  Compass,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  Trash2,
  Sparkles,
  Cpu,
  ShieldCheck,
  Activity,
  Layers,
  ChevronRight,
  Car,
  Clock,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';
import { FLOOD_IMAGES } from '../../assets/images';
import { validateCoordinates } from '../../utils/floodLogic';

export const CitizenReportWizardPage: React.FC = () => {
  const { addReport, userProfile } = useFlood();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard current step: 1 (Photo) -> 2 (Location) -> 3 (Severity) -> 4 (Review) -> 5 (Result)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Photo
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageError, setImageError] = useState<string | null>(null);

  // Step 2: Location
  const [locationName, setLocationName] = useState('');
  const [area, setArea] = useState<string>('Maradana');
  const [lat, setLat] = useState<number>(6.9271);
  const [lng, setLng] = useState<number>(79.8653);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Step 3: Flood details
  const [waterLevel, setWaterLevel] = useState<'Low' | 'Moderate' | 'High' | 'Severe'>('Moderate');
  const [roadAccessibility, setRoadAccessibility] = useState<'Open' | 'Partially Blocked' | 'Completely Blocked'>('Partially Blocked');
  const [floodType, setFloodType] = useState<'Street Waterlogging' | 'Flash Flood' | 'Canal Overflow' | 'Drainage Blockage'>('Street Waterlogging');

  // Step 4: Contact & Notes
  const [reporterPhone, setReporterPhone] = useState(userProfile.phone || '+94 77 123 4567');
  const [description, setDescription] = useState('');

  // Step 5: Submission & AI Result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    reportId: string;
    hotspotId: string;
    aiConfidence: number;
    aiClassification: string;
    aiExplanation: string;
    status: string;
    isDuplicate?: boolean;
    duplicateOfId?: string;
  } | null>(null);

  const areaCoordinates: Record<string, { lat: number; lng: number }> = {
    Maradana: { lat: 6.9271, lng: 79.8653 },
    Wellawatte: { lat: 6.8745, lng: 79.8600 },
    Borella: { lat: 6.9110, lng: 79.8770 },
    Kolonnawa: { lat: 6.9360, lng: 79.8850 },
    Dematagoda: { lat: 6.9380, lng: 79.8780 },
    Nugegoda: { lat: 6.8710, lng: 79.8980 },
    Pettah: { lat: 6.9366, lng: 79.8530 },
    Kotahena: { lat: 6.9515, lng: 79.8622 },
  };

  const handleAreaChange = (newArea: string) => {
    setArea(newArea);
    if (areaCoordinates[newArea]) {
      setLat(areaCoordinates[newArea].lat);
      setLng(areaCoordinates[newArea].lng);
    }
  };

  const handleFileSelect = (file: File) => {
    setImageError(null);
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setImageError('Invalid image format. Please upload JPG, PNG, or WEBP photos.');
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setImageError('File size exceeds the 5MB upload limit.');
      return;
    }

    setSelectedFile(file);
    setImageMimeType(file.type.toLowerCase());

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleUseDemoSample = (url: string) => {
    setImagePreview(url);
    setImageBase64(url);
    setImageError(null);
    setSelectedFile(null);
  };

  const handleGetGps = () => {
    setIsLocating(true);
    setLocationError(null);
    setGpsSuccess(false);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = Number(pos.coords.latitude.toFixed(6));
        const userLng = Number(pos.coords.longitude.toFixed(6));
        setLat(userLat);
        setLng(userLng);
        setGpsSuccess(true);
        setIsLocating(false);
      },
      () => {
        setLocationError('Could not acquire GPS position. Preset Colombo area coordinates applied.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setCurrentStep(5);

    try {
      const finalLocation = locationName.trim() || `${area} Main Road`;
      const result = await addReport({
        location: finalLocation,
        area: area as any,
        lat,
        lng,
        waterLevel,
        roadAccessibility,
        floodType,
        description: description || 'Reported via citizen 5-step reporting wizard.',
        reporterName: userProfile.name,
        reporterPhone: reporterPhone,
        reporterId: userProfile.email || 'citizen_demo_user',
        imageUrl: imagePreview || undefined,
        imageFile: selectedFile || undefined,
        customImage: imageBase64 || undefined,
        imageMimeType,
      });

      setSubmissionResult({
        reportId: result.report.id,
        hotspotId: result.hotspot.id,
        aiConfidence: result.report.aiConfidence,
        aiClassification: result.report.aiClassification,
        aiExplanation:
          result.report.aiVerificationDetails?.explanation ||
          'Multimodal vision analysis completed. Incident queued for emergency officer field verification.',
        status: result.report.incidentStatus,
        isDuplicate: result.isDuplicate,
        duplicateOfId: result.duplicateOfId,
      });
    } catch (err: any) {
      console.error('Submission failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Photo' },
    { num: 2, label: 'Location' },
    { num: 3, label: 'Severity' },
    { num: 4, label: 'Review' },
    { num: 5, label: 'AI Result' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 font-sans">
      {/* Wizard Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 mb-1">
          <NavLink to="/citizen" className="hover:underline">
            Citizen Portal
          </NavLink>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span>Report a Flooded Road</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Flood Incident Reporting Wizard
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Submit photo evidence and GPS coordinates to assist DMC drainage and rescue teams.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between">
          {stepsList.map((step, idx) => {
            const isCompleted = currentStep > step.num;
            const isCurrent = currentStep === step.num;
            return (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-cyan-600 text-white ring-4 ring-cyan-100 shadow-md'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : step.num}
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      isCurrent ? 'text-cyan-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < stepsList.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mb-5 transition-colors ${
                      currentStep > step.num ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step 1: Photo Upload */}
      {currentStep === 1 && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-cyan-600" />
              <span>Step 1: Upload Flood Photograph</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Photographs help AI evaluate water volume and confirm road obstruction for emergency officers.
            </p>
          </div>

          {imageError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{imageError}</span>
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              imagePreview
                ? 'border-cyan-500 bg-cyan-50/20'
                : 'border-slate-300 hover:border-cyan-500 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {imagePreview ? (
              <div className="space-y-4">
                <img
                  src={imagePreview}
                  alt="Flood Preview"
                  className="max-h-64 mx-auto rounded-xl shadow-md object-cover border border-slate-200"
                />
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Photo ready for AI analysis
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview(null);
                      setImageBase64(null);
                      setSelectedFile(null);
                    }}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Click to browse or drag and drop your photo
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    JPG, PNG, or WEBP up to 5MB (Take photo from safe pavement or vehicle)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Demo Sample Picker for testing */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                <span>Or select a demonstration photo:</span>
              </span>
              <span className="text-[10px] text-slate-400">High-resolution Colombo flood scenarios</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleUseDemoSample(FLOOD_IMAGES.streetWater)}
                className="group p-2 rounded-xl border border-slate-200 hover:border-cyan-500 bg-white text-left transition-all"
              >
                <img
                  src={FLOOD_IMAGES.streetWater}
                  alt="Street water"
                  className="w-full h-16 rounded-lg object-cover mb-1.5"
                />
                <span className="text-[10px] font-bold text-slate-800 block leading-tight group-hover:text-cyan-700">
                  Street Inundation
                </span>
                <span className="text-[9px] text-slate-400">Maradana Road</span>
              </button>

              <button
                type="button"
                onClick={() => handleUseDemoSample(FLOOD_IMAGES.junctionInundation)}
                className="group p-2 rounded-xl border border-slate-200 hover:border-cyan-500 bg-white text-left transition-all"
              >
                <img
                  src={FLOOD_IMAGES.junctionInundation}
                  alt="Junction water"
                  className="w-full h-16 rounded-lg object-cover mb-1.5"
                />
                <span className="text-[10px] font-bold text-slate-800 block leading-tight group-hover:text-cyan-700">
                  Junction Runoff
                </span>
                <span className="text-[9px] text-slate-400">Baseline Road</span>
              </button>

              <button
                type="button"
                onClick={() => handleUseDemoSample(FLOOD_IMAGES.canalDrainage)}
                className="group p-2 rounded-xl border border-slate-200 hover:border-cyan-500 bg-white text-left transition-all"
              >
                <img
                  src={FLOOD_IMAGES.canalDrainage}
                  alt="Canal Drainage"
                  className="w-full h-16 rounded-lg object-cover mb-1.5"
                />
                <span className="text-[10px] font-bold text-slate-800 block leading-tight group-hover:text-cyan-700">
                  Canal Sluice Overflow
                </span>
                <span className="text-[9px] text-slate-400">Kolonnawa Basin</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md shadow-cyan-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Continue to Step 2: Location</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Location */}
      {currentStep === 2 && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-600" />
              <span>Step 2: Road & Location Information</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Accurate coordinates ensure your report clusters into nearby flood hotspots.
            </p>
          </div>

          {locationError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{locationError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Colombo Municipal Area / Ward
              </label>
              <select
                value={area}
                onChange={(e) => handleAreaChange(e.target.value)}
                className="w-full py-2.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              >
                {Object.keys(areaCoordinates).map((a) => (
                  <option key={a} value={a}>
                    {a} Sector
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Street Name or Nearest Landmark
              </label>
              <input
                type="text"
                placeholder="e.g. Maradana Road near Technical College Railway Underpass"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full py-2.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>

            {/* GPS Auto-Locate Button */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  GPS Geolocation: {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
                <span className="text-[11px] text-slate-500">
                  {gpsSuccess ? '✓ GPS position acquired via browser' : 'Default coordinates for selected area'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleGetGps}
                disabled={isLocating}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
              >
                <Compass className={`w-4 h-4 text-cyan-600 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Acquiring GPS...' : 'Use My Current Location'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md shadow-cyan-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Continue to Step 3: Severity</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Severity Details */}
      {currentStep === 3 && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-cyan-600" />
              <span>Step 3: Flood Depth & Road Condition</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select what you observe on the ground to calibrate risk predictions.
            </p>
          </div>

          <div className="space-y-5">
            {/* Water Depth Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Estimated Water Level
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'Low', label: 'Ankle Deep (< 15cm)', desc: 'Curb puddle, passable' },
                  { id: 'Moderate', label: 'Knee Deep (15-30cm)', desc: 'Tire half submerged' },
                  { id: 'High', label: 'Waist Deep (30-60cm)', desc: 'Engines stalled' },
                  { id: 'Severe', label: 'Submerged (> 60cm)', desc: 'Vehicles floating' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWaterLevel(item.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      waterLevel === item.id
                        ? 'border-cyan-600 bg-cyan-50/70 ring-2 ring-cyan-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Road Accessibility */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Road Passability for Traffic
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'Open', label: 'Passable for All' },
                  { id: 'Partially Blocked', label: '4x4 / Trucks Only' },
                  { id: 'Completely Blocked', label: 'Completely Blocked' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRoadAccessibility(item.id as any)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      roadAccessibility === item.id
                        ? 'border-cyan-600 bg-cyan-50/70 ring-2 ring-cyan-500/20 font-bold text-cyan-900 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="text-xs block">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Flood Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Flood Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  'Street Waterlogging',
                  'Flash Flood',
                  'Canal Overflow',
                  'Drainage Blockage',
                ].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFloodType(t as any)}
                    className={`p-2.5 rounded-xl border text-center text-xs transition-all ${
                      floodType === t
                        ? 'border-cyan-600 bg-cyan-50 font-bold text-cyan-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md shadow-cyan-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Continue to Step 4: Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Final Notes */}
      {currentStep === 4 && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-600" />
              <span>Step 4: Review & Additional Information</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Check your report details before initiating AI multimodal verification and submission.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block">Location:</span>
                <span className="font-bold text-slate-800 text-sm">
                  {locationName || `${area} Main Road`} ({area})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Coordinates:</span>
                <span className="font-mono text-slate-700">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Water Level:</span>
                <span className="font-bold text-slate-800">{waterLevel}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Passability:</span>
                <span className="font-bold text-slate-800">{roadAccessibility}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block">Reporter:</span>
                <span className="font-bold text-slate-800">{userProfile.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Contact Phone:</span>
                <span className="font-mono text-slate-700">{reporterPhone}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Photograph Attached:</span>
                <span className="font-bold text-emerald-700">
                  {imagePreview ? '✓ Photo Attached' : 'No Photo (Heuristic fallback)'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Eyewitness Observations (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Water rushing into store basements, three-wheelers unable to pass..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-600/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Submit & Run AI Verification</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Submission & AI Result */}
      {currentStep === 5 && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          {isSubmitting ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center mx-auto animate-pulse">
                <Cpu className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Running Multimodal Flood Assessment...
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Analyzing photo water reflectivity, estimating curb submersion, and clustering into
                active Colombo hotspots.
              </p>
            </div>
          ) : submissionResult ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Report {submissionResult.reportId} Successfully Registered!
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Your report has been forwarded to the DMC Western Province Operations Center.
                    {submissionResult.isDuplicate &&
                      ` Note: Flagged as duplicate of ${submissionResult.duplicateOfId}; evidence preserved.`}
                  </p>
                </div>
              </div>

              {/* AI Verification Breakdown Card */}
              <div className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Multimodal AI Assessment (Gemini 3.8 Flash)
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {submissionResult.aiConfidence}% Confidence
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">AI Classification:</span>
                  <p className="text-sm font-bold text-cyan-200 mt-0.5">
                    {submissionResult.aiClassification}
                  </p>
                </div>

                <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed">
                  {submissionResult.aiExplanation}
                </p>

                <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-800/60 text-[11px] text-amber-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Status is currently <strong>Under Review</strong>. Official emergency verification
                    requires human DMC officer sign-off.
                  </span>
                </div>
              </div>

              {/* Next Steps Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <NavLink
                  to="/map-public"
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl text-center"
                >
                  View on Live Public Map
                </NavLink>

                <NavLink
                  to="/citizen/reports"
                  className="w-full sm:w-auto px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl text-center shadow-md shadow-cyan-600/20 flex items-center justify-center gap-2"
                >
                  <span>Track Status in My Reports</span>
                  <ArrowRight className="w-4 h-4" />
                </NavLink>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
