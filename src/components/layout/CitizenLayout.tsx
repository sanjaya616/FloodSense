/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Droplets,
  PlusCircle,
  Map,
  FileText,
  ShieldCheck,
  Bell,
  Menu,
  X,
  PhoneCall,
  User,
  LogOut,
  ChevronDown,
  ShieldAlert,
  ArrowRight,
  CloudRain,
  ExternalLink,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';

export const CitizenLayout: React.FC = () => {
  const {
    authenticatedRole,
    userProfile,
    logout,
    notifications,
    markAllNotificationsAsRead,
    weather,
    isAuthenticated,
  } = useFlood();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  const unreadNotifications = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(e.target as Node)) {
        setNotificationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGoToOfficerPortal = () => {
    setProfileDropdownOpen(false);
    if (isAuthenticated && authenticatedRole === 'officer') {
      navigate('/officer/overview');
    } else {
      navigate('/login');
    }
  };

  const handleLogout = async () => {
    await logout();
    setProfileDropdownOpen(false);
    navigate('/login');
  };

  const navLinks = [
    { label: 'Citizen Portal', path: '/citizen', icon: User },
    { label: 'Report a Flood', path: '/citizen/report', icon: PlusCircle, isCta: true },
    { label: 'My Reports', path: '/citizen/reports', icon: FileText },
    { label: 'Public Flood Map', path: '/map-public', icon: Map },
    { label: 'Safety Guidelines', path: '/safety', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Emergency Advisory Strip */}
      <div className="bg-gradient-to-r from-cyan-900 via-slate-900 to-blue-900 text-white text-xs px-4 py-2 border-b border-cyan-800/40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-semibold text-cyan-300">Colombo Urban Advisory:</span>
            <span className="text-slate-200 truncate">
              {weather.condition} • Forecast {weather.expected3hRainfallMm}mm next 3 hrs
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-300">
            <span className="hidden sm:inline font-mono">DMC Hotline: 117</span>
            <span className="hidden md:inline font-mono">Suwa Seriya: 1990</span>
            <NavLink
              to={authenticatedRole === 'officer' ? '/officer/overview' : '/login'}
              className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>{authenticatedRole === 'officer' ? 'Return to Officer EOC' : 'Officer Sign In'}</span>
              <ArrowRight className="w-3 h-3" />
            </NavLink>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/20 group-hover:scale-105 transition-transform">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                  FloodSense
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 font-bold uppercase tracking-wider">
                  Citizen
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium block -mt-0.5">
                Smarter Warnings • Safer Communities
              </span>
            </div>
          </NavLink>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;

              if (link.isCta) {
                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    className="mx-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-md shadow-cyan-600/25 transition-all hover:shadow-lg active:scale-95 whitespace-nowrap shrink-0"
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              }

              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={`inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-cyan-50 text-cyan-700 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-600' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Icons: Weather, Notifications, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Weather Widget pill */}
            <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs whitespace-nowrap shrink-0">
              <CloudRain className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
              <span className="font-mono font-bold">{weather.currentTempC}°C</span>
              <span className="text-slate-400">|</span>
              <span className="font-mono text-cyan-700">{weather.currentRainfallMm}mm rain</span>
            </div>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notificationMenuRef}>
              <button
                type="button"
                onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white font-mono">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {notificationDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Citizen Alerts & Updates
                    </span>
                    {unreadNotifications > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsAsRead}
                        className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.slice(0, 4).map((item) => (
                      <div key={item.id} className="p-3 hover:bg-slate-50 transition-colors text-xs">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-slate-800 truncate">{item.title}</span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {item.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">{item.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <NavLink
                      to="/citizen/notifications"
                      onClick={() => setNotificationDropdownOpen(false)}
                      className="text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                    >
                      View All Alerts & Status Notifications →
                    </NavLink>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            {isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-cyan-500/20"
                    referrerPolicy="no-referrer"
                  />
                  <div className="hidden xl:block text-left">
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      {userProfile.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight font-medium">
                      Citizen Reporter
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50">
                    <div className="p-3 bg-slate-50 rounded-xl mb-1 border border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{userProfile.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{userProfile.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">
                        {authenticatedRole === 'officer' ? 'Emergency Officer' : 'Verified Citizen Account'}
                      </span>
                    </div>

                    <div className="space-y-0.5 py-1">
                      <NavLink
                        to="/citizen/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-100"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>My Profile & Account</span>
                      </NavLink>
                      <NavLink
                        to="/citizen/reports"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-100"
                      >
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span>My Flood Reports</span>
                      </NavLink>
                      <NavLink
                        to="/citizen/notifications"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-100"
                      >
                        <Bell className="w-4 h-4 text-slate-400" />
                        <span>Notification Center</span>
                      </NavLink>
                      {authenticatedRole === 'officer' && (
                        <button
                          type="button"
                          onClick={handleGoToOfficerPortal}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-cyan-700 rounded-lg hover:bg-cyan-50"
                        >
                          <div className="flex items-center gap-2.5">
                            <ShieldAlert className="w-4 h-4 text-cyan-600" />
                            <span>Open Officer EOC</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-1 mt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <NavLink
                  to="/login"
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-cyan-700 transition-colors whitespace-nowrap"
                >
                  Log In
                </NavLink>
                <NavLink
                  to="/register"
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm transition-all whitespace-nowrap"
                >
                  Register
                </NavLink>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-2 animate-in slide-in-from-top-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                    link.isCta
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                      : isActive
                      ? 'bg-cyan-50 text-cyan-800'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleGoToOfficerPortal();
                }}
                className="flex items-center justify-between px-3 py-2 text-xs font-bold text-cyan-800 bg-cyan-50 rounded-xl"
              >
                <span>{authenticatedRole === 'officer' ? 'Open Officer EOC' : 'Officer Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Outlet Body */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center text-white font-bold">
                  <Droplets className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-base text-white">FloodSense</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Empowering Colombo citizens and emergency services with real-time flood monitoring,
                early warning AI intelligence, and crowd-sourced ground verification.
              </p>
              <div className="text-[11px] text-cyan-400 font-mono">
                Academic Emerging Technologies Research Prototype
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">
                Quick Navigation
              </h4>
              <ul className="space-y-2">
                <li>
                  <NavLink to="/citizen" className="hover:text-cyan-400 transition-colors">
                    Citizen Portal Home
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/citizen/report" className="hover:text-cyan-400 transition-colors">
                    Report a Flooded Road
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/citizen/reports" className="hover:text-cyan-400 transition-colors">
                    Track My Reports
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/map-public" className="hover:text-cyan-400 transition-colors">
                    Public Flood Map
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/safety" className="hover:text-cyan-400 transition-colors">
                    Community Flood Safety Guidelines
                  </NavLink>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">
                Emergency Hotlines (Sri Lanka)
              </h4>
              <ul className="space-y-2 font-mono text-slate-300">
                <li className="flex items-center justify-between">
                  <span>Disaster Management Centre:</span>
                  <a href="tel:117" className="text-cyan-400 font-bold hover:underline">
                    117
                  </a>
                </li>
                <li className="flex items-center justify-between">
                  <span>Suwa Seriya Ambulance:</span>
                  <a href="tel:1990" className="text-cyan-400 font-bold hover:underline">
                    1990
                  </a>
                </li>
                <li className="flex items-center justify-between">
                  <span>Sri Lanka Police:</span>
                  <a href="tel:119" className="text-cyan-400 font-bold hover:underline">
                    119
                  </a>
                </li>
                <li className="flex items-center justify-between">
                  <span>Colombo Municipal Council:</span>
                  <a href="tel:0112684293" className="text-cyan-400 font-bold hover:underline">
                    011 268 4293
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">
                Officer Operations
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Authorized DMC officers, municipal engineers, and emergency dispatchers access the tactical operations center.
              </p>
              <NavLink
                to={authenticatedRole === 'officer' ? '/officer/overview' : '/login'}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition-colors"
              >
                <span>{authenticatedRole === 'officer' ? 'Launch Officer EOC Dashboard' : 'Officer Portal Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <span>© 2026 FloodSense. Developed for academic evaluation. Demonstration dataset active.</span>
            <div className="flex items-center gap-4">
              <NavLink to="/map-public" className="hover:text-slate-300">
                Public GIS Map
              </NavLink>
              <NavLink to="/safety" className="hover:text-slate-300">
                Safety & Privacy Policy
              </NavLink>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
