/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Info,
  ShieldCheck,
  Droplets,
  ChevronRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useFlood } from '../../context/FloodContext';

export const CitizenNotificationsPage: React.FC = () => {
  const { notifications, markAllNotificationsAsRead, markNotificationAsRead } = useFlood();
  const [filterType, setFilterType] = useState<'ALL' | 'UNREAD' | 'HIGH'>('ALL');

  const filtered = notifications.filter((item) => {
    if (filterType === 'UNREAD') return item.unread;
    if (filterType === 'HIGH') return item.severity === 'HIGH';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 mb-1">
            <NavLink to="/citizen" className="hover:underline">
              Citizen Portal
            </NavLink>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>Notifications</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Citizen Alert & Update Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time status updates on your submitted reports and official Colombo flood advisories.
          </p>
        </div>

        <button
          type="button"
          onClick={markAllNotificationsAsRead}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-cyan-800 text-xs font-bold shadow-2xs self-start sm:self-center cursor-pointer transition-colors"
        >
          <CheckCheck className="w-4 h-4 text-cyan-600" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'ALL', label: `All Alerts (${notifications.length})` },
          { id: 'UNREAD', label: `Unread (${notifications.filter((n) => n.unread).length})` },
          { id: 'HIGH', label: 'Severe Warnings' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === tab.id
                ? 'bg-cyan-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification Stream */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
            <Bell className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No notifications in this filter</p>
            <p className="text-xs text-slate-400">All alerts have been reviewed or marked as read.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => markNotificationAsRead(item.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                item.unread
                  ? 'bg-cyan-50/50 border-cyan-200 hover:bg-cyan-50/80 shadow-2xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      item.severity === 'HIGH'
                        ? 'bg-red-500 animate-pulse'
                        : item.severity === 'MEDIUM'
                        ? 'bg-amber-500'
                        : 'bg-cyan-500'
                    }`}
                  />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {item.title}
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">{item.time}</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed pl-4">{item.description}</p>

              <div className="flex items-center justify-between pl-4 pt-2 mt-2 border-t border-slate-100/80 text-[10px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {item.type}
                  </span>
                  {item.location && <span>Location: {item.location}</span>}
                </div>
                {item.unread && <span className="font-bold text-cyan-600">New Alert</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
