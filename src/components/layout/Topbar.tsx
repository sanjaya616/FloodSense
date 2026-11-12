/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  Clock,
  Sparkles,
  ChevronRight,
  Shield,
  CheckCheck,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const {
    role,
    userProfile,
    switchPersona,
    notifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    searchQuery,
    setSearchQuery,
    dataSourceMode,
  } = useFlood();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Live time ticker
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close notifications dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
      case '/officer':
      case '/officer/overview':
        return { title: 'Flood Monitoring Overview', breadcrumb: 'Overview' };
      case '/officer/incidents':
        return { title: 'Citizen Incident Triage Queue', breadcrumb: 'Incident Queue' };
      case '/map':
      case '/officer/map':
        return { title: 'Live Flood GIS Map', breadcrumb: 'Live Map' };
      case '/report':
      case '/officer/report':
        return { title: 'Report Flood Incident', breadcrumb: 'Field Reporting' };
      case '/hotspots':
      case '/officer/hotspots':
        return { title: 'Flood Hotspot Clusters', breadcrumb: 'Hotspots' };
      case '/predictions':
      case '/officer/predictions':
        return { title: 'Predictive Flood Risk Analysis', breadcrumb: 'Risk Predictions' };
      case '/analytics':
      case '/officer/analytics':
        return { title: 'Flood Intelligence & Analytics', breadcrumb: 'Analytics' };
      case '/blockchain':
      case '/officer/blockchain':
        return { title: 'Blockchain Flood Event Registry', breadcrumb: 'Blockchain Registry' };
      case '/methodology':
      case '/officer/methodology':
        return { title: 'System Methodology & Data Transparency', breadcrumb: 'Methodology' };
      case '/settings':
      case '/officer/settings':
        return { title: 'System & Role Settings', breadcrumb: 'Settings' };
      default:
        return { title: 'Disaster Management Console', breadcrumb: 'Console' };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-2xs">
      {/* Left zone: Mobile toggle & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>FloodSense</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-semibold truncate">{pageInfo.breadcrumb}</span>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate hidden sm:block">
            {pageInfo.title}
          </h1>
        </div>
      </div>

      {/* Middle zone: Live search input */}
      <div className="hidden md:flex items-center flex-1 max-w-xs relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          placeholder="Search locations, hotspots, reports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-sans"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right zone: Demo tag, Clock, Notification Bell, User profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Data Source Indicator */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-semibold font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              dataSourceMode === 'FIREBASE' ? 'bg-amber-500 animate-pulse' : 'bg-cyan-500'
            }`}
          />
          <span>{dataSourceMode === 'FIREBASE' ? 'FIRESTORE LIVE' : 'DEMO MATRIX'}</span>
        </div>

        {/* Live Date Time */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white font-mono text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Emergency Alerts & Log
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsAsRead}
                    className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active emergency alerts
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => markNotificationAsRead(item.id)}
                      className={`p-3 text-xs transition-colors cursor-pointer ${
                        item.unread ? 'bg-cyan-50/40 hover:bg-cyan-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-bold text-slate-800">{item.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed mb-1">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.type}
                        </span>
                        {item.unread && (
                          <span className="text-[10px] font-semibold text-cyan-600">
                            Unread
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                <NavLink
                  to="/analytics"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                >
                  View Historical Disaster Incident Log →
                </NavLink>
              </div>
            </div>
          )}
        </div>

        {/* Switch to Citizen Portal Button */}
        <NavLink
          to="/citizen"
          onClick={() => switchPersona('citizen')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-bold border border-cyan-200 transition-colors"
        >
          <span>Citizen Portal</span>
          <ChevronRight className="w-3.5 h-3.5 text-cyan-600" />
        </NavLink>

        {/* User Avatar Mini Profile */}
        <NavLink
          to="/officer/settings"
          className="flex items-center gap-2 pl-2 border-l border-slate-200 group"
        >
          <img
            src={userProfile.avatarUrl}
            alt={userProfile.name}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 group-hover:ring-cyan-500 transition-all"
            referrerPolicy="no-referrer"
          />
          <div className="hidden sm:block text-left">
            <span className="text-xs font-bold text-slate-800 block leading-tight group-hover:text-cyan-700 transition-colors">
              {userProfile.name}
            </span>
            <span className="text-[10px] text-slate-400 block leading-tight font-medium">
              {role === 'officer' ? 'Officer' : 'Citizen'}
            </span>
          </div>
        </NavLink>
      </div>
    </header>
  );
};
