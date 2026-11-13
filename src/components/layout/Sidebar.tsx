/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  PlusCircle,
  Flame,
  Activity,
  BarChart3,
  Link2,
  Settings,
  Shield,
  User,
  LogOut,
  X,
  Droplets,
  BookOpen,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { authenticatedRole, userProfile, logout } = useFlood();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate('/login');
  };

  const navItems = [
    { name: 'Overview', path: '/officer/overview', legacyPath: '/', icon: LayoutDashboard },
    { name: 'Incident Review Queue', path: '/officer/incidents', icon: ClipboardCheck, badge: 'Triage' },
    { name: 'Live Flood Map', path: '/officer/map', legacyPath: '/map', icon: Map },
    { name: 'Report Flood', path: '/officer/report', legacyPath: '/report', icon: PlusCircle, badge: 'Field' },
    { name: 'Flood Hotspots', path: '/officer/hotspots', legacyPath: '/hotspots', icon: Flame },
    { name: 'Risk Predictions', path: '/officer/predictions', legacyPath: '/predictions', icon: Activity },
    { name: 'Analytics', path: '/officer/analytics', legacyPath: '/analytics', icon: BarChart3 },
    { name: 'Blockchain Records', path: '/officer/blockchain', legacyPath: '/blockchain', icon: Link2, badge: 'Ledger' },
    { name: 'Methodology & Data', path: '/officer/methodology', legacyPath: '/methodology', icon: BookOpen },
    { name: 'Settings', path: '/officer/settings', legacyPath: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#101C2C] text-slate-300 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } border-r border-slate-800 shadow-xl`}
      >
        {/* Brand Header */}
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80">
            <NavLink
              to="/"
              onClick={onClose}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                <Droplets className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-extrabold text-white tracking-tight flex items-center gap-1">
                  FloodSense
                </span>
                <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider block leading-none">
                  Early Warning System
                </span>
              </div>
            </NavLink>

            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Operations Center
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.legacyPath && location.pathname === item.legacyPath);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-medium ${
                        isActive
                          ? 'bg-cyan-600 text-cyan-100'
                          : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Switcher */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 space-y-3">
          <NavLink
            to="/officer/settings"
            onClick={onClose}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/70 transition-colors group"
          >
            <div className="relative">
              <img
                src={userProfile.avatarUrl}
                alt={userProfile.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-cyan-500/30"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#101C2C]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                {userProfile.name}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {authenticatedRole === 'officer' ? 'Emergency Officer' : 'Citizen Reporter'}
              </p>
            </div>
          </NavLink>

          <div className="space-y-1.5">
            <NavLink
              to="/citizen"
              onClick={onClose}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800 hover:bg-cyan-950/60 border border-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-semibold transition-all group"
            >
              <span>View Citizen Portal</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </NavLink>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/70 hover:bg-red-950/60 border border-slate-800 hover:border-red-900/60 text-slate-400 hover:text-red-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <span>Sign Out</span>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-mono">v1.2.0-academic</span>
            <span className="text-cyan-400 font-semibold">Colombo Metro</span>
          </div>
        </div>
      </aside>
    </>
  );
};
