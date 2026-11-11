/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FloodReport, FloodHotspot } from '../../utils/floodLogic';
import { RiskBadge } from '../common/RiskBadge';
import { MapLegend } from './MapLegend';
import {
  MapPin,
  Navigation,
  Droplets,
  Users,
  ShieldAlert,
  ArrowRight,
  Eye,
  Crosshair,
  Maximize2,
  Minimize2,
  Compass,
} from 'lucide-react';

interface FloodMapProps {
  hotspots: FloodHotspot[];
  reports: FloodReport[];
  selectedHotspotId?: string | null;
  onSelectHotspot?: (hotspot: FloodHotspot) => void;
  onSelectReport?: (report: FloodReport) => void;
  heightClass?: string;
  showLegendOverlay?: boolean;
  showSectorControls?: boolean;
}

// Controller component to smoothly fly/pan to selected coordinates
const MapRecenter: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom || map.getZoom(), { animate: true });
  }, [center, zoom, map]);
  return null;
};

// Create custom colored tactical markers with HTML div icons
const createCustomIcon = (
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  type: 'hotspot' | 'report',
  count?: number
) => {
  const colorMap = {
    HIGH: {
      bg: '#EF4444',
      ring: 'rgba(239, 68, 68, 0.45)',
      border: '#FFFFFF',
      badge: '#991B1B',
    },
    MEDIUM: {
      bg: '#F59E0B',
      ring: 'rgba(245, 158, 11, 0.45)',
      border: '#FFFFFF',
      badge: '#92400E',
    },
    LOW: {
      bg: '#22C55E',
      ring: 'rgba(34, 197, 94, 0.45)',
      border: '#FFFFFF',
      badge: '#166534',
    },
  }[riskLevel];

  const size = type === 'hotspot' ? 40 : 30;
  const label = type === 'hotspot' && count ? count : '';

  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      ${
        riskLevel === 'HIGH'
          ? `<span style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: ${colorMap.bg}; opacity: 0.6; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
          : ''
      }
      <div style="
        width: ${size}px; 
        height: ${size}px; 
        background: ${colorMap.bg}; 
        border: 2.5px solid ${colorMap.border}; 
        box-shadow: 0 4px 14px rgba(0,0,0,0.3); 
        border-radius: ${type === 'hotspot' ? '50%' : '50% 50% 50% 0'}; 
        transform: ${type === 'report' ? 'rotate(-45deg)' : 'none'};
        display: flex; 
        align-items: center; 
        justify-content: center;
        color: white;
        font-family: 'JetBrains Mono', monospace;
        font-weight: 800;
        font-size: ${type === 'hotspot' ? '13px' : '11px'};
      ">
        <span style="transform: ${type === 'report' ? 'rotate(45deg)' : 'none'};">
          ${label || (type === 'hotspot' ? '!' : '•')}
        </span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-flood-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, type === 'report' ? size : size / 2],
    popupAnchor: [0, -(size / 2) - 6],
  });
};

export const FloodMap: React.FC<FloodMapProps> = ({
  hotspots,
  reports,
  selectedHotspotId,
  onSelectHotspot,
  onSelectReport,
  heightClass = 'h-[520px]',
  showLegendOverlay = true,
  showSectorControls = true,
}) => {
  const [activeLayer, setActiveLayer] = useState<'all' | 'hotspots' | 'reports'>('all');
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.9271, 79.8653]); // Colombo center
  const [zoomLevel, setZoomLevel] = useState(13);
  const [showRadiusCircles, setShowRadiusCircles] = useState(true);

  // Sector coordinates for rapid tactical focus
  const sectors: Array<{ name: string; center: [number, number]; zoom: number }> = [
    { name: 'Colombo Metro', center: [6.9271, 79.8653], zoom: 13 },
    { name: 'Maradana', center: [6.9271, 79.8653], zoom: 15 },
    { name: 'Kolonnawa', center: [6.9360, 79.8850], zoom: 15 },
    { name: 'Wellawatte', center: [6.8745, 79.8600], zoom: 15 },
    { name: 'Dematagoda', center: [6.9380, 79.8780], zoom: 15 },
    { name: 'Borella', center: [6.9110, 79.8770], zoom: 15 },
    { name: 'Nugegoda', center: [6.8710, 79.8980], zoom: 15 },
  ];

  // Recenter when selected hotspot changes
  useEffect(() => {
    if (selectedHotspotId) {
      const match = hotspots.find((h) => h.id === selectedHotspotId);
      if (match) {
        setMapCenter([match.lat, match.lng]);
        setZoomLevel(15);
      }
    }
  }, [selectedHotspotId, hotspots]);

  return (
    <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-300 shadow-sm bg-slate-100 flex flex-col`}>
      {/* Sector Quick-Focus Ribbon */}
      {showSectorControls && (
        <div className="absolute top-3 left-3 z-500 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/90 shadow-md flex items-center gap-1 overflow-x-auto max-w-[calc(100%-160px)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1 shrink-0 font-mono">
            <Crosshair className="w-3 h-3 text-cyan-600" />
            Sectors:
          </span>
          {sectors.map((sec) => (
            <button
              key={sec.name}
              type="button"
              onClick={() => {
                setMapCenter(sec.center);
                setZoomLevel(sec.zoom);
              }}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-cyan-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            >
              {sec.name}
            </button>
          ))}
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        center={mapCenter}
        zoom={zoomLevel}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapRecenter center={mapCenter} zoom={zoomLevel} />
        
        {/* OpenStreetMap standard clean raster tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* 500m Hotspot Clustering Radius Circles */}
        {showRadiusCircles &&
          (activeLayer === 'all' || activeLayer === 'hotspots') &&
          hotspots.map((hs) => {
            const circleColor =
              hs.riskLevel === 'HIGH' ? '#EF4444' : hs.riskLevel === 'MEDIUM' ? '#F59E0B' : '#22C55E';
            return (
              <Circle
                key={`circle-${hs.id}`}
                center={[hs.lat, hs.lng]}
                radius={500}
                pathOptions={{
                  color: circleColor,
                  fillColor: circleColor,
                  fillOpacity: hs.riskLevel === 'HIGH' ? 0.15 : 0.08,
                  weight: 1.5,
                  dashArray: '4, 6',
                }}
              />
            );
          })}

        {/* Hotspot Markers */}
        {(activeLayer === 'all' || activeLayer === 'hotspots') &&
          hotspots.map((hs) => (
            <Marker
              key={`hs-${hs.id}`}
              position={[hs.lat, hs.lng]}
              icon={createCustomIcon(hs.riskLevel, 'hotspot', hs.reportCount)}
            >
              <Popup>
                <div className="p-3.5 max-w-[280px]">
                  <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100">
                    <span className="font-mono text-xs font-bold text-slate-800">{hs.id}</span>
                    <RiskBadge level={hs.riskLevel} size="sm" />
                  </div>
                  
                  <h4 className="text-sm font-bold text-slate-900 leading-snug mb-0.5">
                    {hs.location}
                  </h4>
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1 font-mono">
                    <MapPin className="w-3 h-3 text-cyan-600" />
                    {hs.area} Sector · 500m Cluster
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded-lg mb-2.5 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">Reports</span>
                      <span className="font-bold text-slate-800">{hs.reportCount} Verified</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">3h Forecast</span>
                      <span className="font-bold text-cyan-700">{hs.forecastRainfallMm} mm</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-2 italic mb-2.5">
                    "{hs.precaution}"
                  </p>

                  {onSelectHotspot && (
                    <button
                      type="button"
                      onClick={() => onSelectHotspot(hs)}
                      className="w-full py-1.5 px-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Hotspot Details</span>
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Individual Citizen Report Markers */}
        {(activeLayer === 'all' || activeLayer === 'reports') &&
          reports.map((rep) => (
            <Marker
              key={`rep-${rep.id}`}
              position={[rep.lat, rep.lng]}
              icon={createCustomIcon(rep.riskLevel, 'report')}
            >
              <Popup>
                <div className="p-3 max-w-[270px]">
                  <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-100">
                    <span className="font-mono text-xs font-bold text-slate-800">{rep.id}</span>
                    <RiskBadge level={rep.verificationStatus} size="sm" />
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-tight mb-1">
                    {rep.location}
                  </h4>
                  
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2 font-mono">
                    <span>{rep.floodType}</span>
                    <span>·</span>
                    <span className="font-bold text-slate-800">{rep.waterLevel}</span>
                  </div>

                  {rep.imageUrl && (
                    <div className="mb-2 rounded-md overflow-hidden h-24 border border-slate-200">
                      <img
                        src={rep.imageUrl}
                        alt="Flood evidence"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <p className="text-[11px] text-slate-600 mb-2 line-clamp-2">
                    {rep.description}
                  </p>

                  {onSelectReport && (
                    <button
                      type="button"
                      onClick={() => onSelectReport(rep)}
                      className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>View Full Report</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* Overlaid Map Legend & Layer Filter */}
      {showLegendOverlay && (
        <div className="absolute top-4 right-4 z-500 max-w-xs pointer-events-auto">
          <MapLegend
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
          />
        </div>
      )}

      {/* Bottom Bar: Radius toggle & Center Reset */}
      <div className="absolute bottom-4 left-4 z-500 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMapCenter([6.9271, 79.8653]);
            setZoomLevel(13);
          }}
          className="bg-white/95 backdrop-blur-sm border border-slate-200 text-slate-700 text-xs font-semibold py-1.5 px-3 rounded-lg shadow-md hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        >
          <Navigation className="w-3.5 h-3.5 text-cyan-600" />
          <span>Reset Colombo View</span>
        </button>

        <button
          type="button"
          onClick={() => setShowRadiusCircles(!showRadiusCircles)}
          className={`py-1.5 px-3 text-xs font-semibold rounded-lg shadow-md transition-colors flex items-center gap-1.5 border ${
            showRadiusCircles
              ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
              : 'bg-white/95 border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>500m Buffers: {showRadiusCircles ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
};
