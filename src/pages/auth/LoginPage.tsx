/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Droplets,
  Mail,
  Lock,
  ArrowRight,
  ShieldAlert,
  User,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useFlood, DEMO_OFFICER_PROFILE, DEMO_CITIZEN_PROFILE } from '../../context/FloodContext';

export const LoginPage: React.FC = () => {
  const { loginWithEmail, loginWithGoogle, switchPersona, dbOperationStatus } = useFlood();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Please enter both your email and password.');
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);

    try {
      const result = await loginWithEmail(email, password);
      if (result.success) {
        if (result.role === 'officer') {
          navigate('/officer/overview');
        } else {
          navigate('/citizen');
        }
      } else {
        setLocalError(result.message || 'Login failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoCitizen = () => {
    switchPersona('citizen');
    navigate('/citizen');
  };

  const handleQuickDemoOfficer = () => {
    switchPersona('officer');
    navigate('/officer/overview');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 font-sans relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-cyan-600/10 blur-3xl pointer-events-none rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <NavLink to="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/25 group-hover:scale-105 transition-transform">
            <Droplets className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <span className="font-extrabold text-2xl text-white tracking-tight block">
              FloodSense
            </span>
            <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider block -mt-1">
              Urban Flood Intelligence
            </span>
          </div>
        </NavLink>

        <h2 className="mt-6 text-xl sm:text-2xl font-black text-white tracking-tight">
          Sign In to FloodSense
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Access the Citizen Reporting Portal or Officer Operations Center
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-950/80 backdrop-blur-md py-8 px-6 sm:px-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          {/* Quick Demo Switcher Section */}
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Instant Demo Access</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">1-Click Login</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleQuickDemoCitizen}
                className="p-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                    Citizen Reporter
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">Nimalka Senanayake</p>
              </button>

              <button
                type="button"
                onClick={handleQuickDemoOfficer}
                className="p-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                    Emergency Officer
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">Kasun Pereira (DMC)</p>
              </button>
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-[11px] text-slate-400 uppercase tracking-wider font-mono">
              or enter credentials
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {localError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{localError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="e.g. nimalka@gmail.com or officer@dmc.gov.lk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-300">Password</label>
                <span className="text-[11px] text-slate-400">Demo: Any password accepted</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In to Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Google Firebase Sign In */}
          <button
            type="button"
            onClick={async () => {
              await loginWithGoogle();
              navigate('/citizen');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google Account</span>
          </button>

          <div className="text-center text-xs text-slate-400">
            <span>Don't have an account yet? </span>
            <NavLink to="/register" className="text-cyan-400 font-bold hover:underline">
              Create Citizen Account
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
};
