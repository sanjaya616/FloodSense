/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Droplets,
  Mail,
  Lock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  User,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { useFlood, DEMO_CREDENTIALS } from '../../context/FloodContext';

type LoginPortalMode = 'citizen' | 'officer';

export const LoginPage: React.FC = () => {
  const {
    loginWithEmail,
    loginWithOfficerEmail,
    loginWithGoogle,
    loginWithOfficerGoogle,
    requestPasswordReset,
    switchPersona,
    dataSourceMode,
    isFirebaseAvailable,
  } = useFlood();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const routeState = (location.state as {
    from?: string;
    portal?: LoginPortalMode;
    accessDeniedMessage?: string;
  } | null) || null;

  const initialPortal: LoginPortalMode =
    searchParams.get('portal') === 'officer' || routeState?.portal === 'officer'
      ? 'officer'
      : 'citizen';

  const [loginPortal, setLoginPortal] = useState<LoginPortalMode>(initialPortal);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(
    routeState?.accessDeniedMessage || null
  );

  // Forgot password inline panel
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetFeedback, setResetFeedback] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('portal') === 'officer' || routeState?.portal === 'officer') {
      setLoginPortal('officer');
    }
    if (routeState?.accessDeniedMessage) {
      setLocalError(routeState.accessDeniedMessage);
    }
  }, [searchParams, routeState?.portal, routeState?.accessDeniedMessage]);

  const handleSelectPortal = (nextPortal: LoginPortalMode) => {
    setLoginPortal(nextPortal);
    setLocalError(null);
    const nextParams = new URLSearchParams(searchParams);
    if (nextPortal === 'officer') {
      nextParams.set('portal', 'officer');
    } else {
      nextParams.delete('portal');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Please enter both your email and password.');
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);

    try {
      const result =
        loginPortal === 'officer'
          ? await loginWithOfficerEmail(email, password, rememberMe)
          : await loginWithEmail(email, password, rememberMe);

      if (result.success) {
        if (loginPortal === 'officer' || result.role === 'officer') {
          navigate('/officer/overview', { replace: true });
        } else {
          navigate('/citizen', { replace: true });
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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await requestPasswordReset(resetEmail || email);
    setResetFeedback(res);
  };

  const handleQuickDemoCitizen = () => {
    if (isFirebaseAvailable || dataSourceMode === 'FIREBASE') return;
    switchPersona('citizen');
    navigate('/citizen');
  };

  const handleQuickDemoOfficer = () => {
    if (isFirebaseAvailable || dataSourceMode === 'FIREBASE') return;
    switchPersona('officer');
    navigate('/officer/overview');
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      const res =
        loginPortal === 'officer'
          ? await loginWithOfficerGoogle()
          : await loginWithGoogle();

      if (res.success) {
        navigate(
          loginPortal === 'officer' || res.role === 'officer' ? '/officer/overview' : '/citizen',
          { replace: true }
        );
      } else if (res.message) {
        setLocalError(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOfficerPortal = loginPortal === 'officer';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 font-sans relative overflow-hidden">
      {/* Background ambient glow */}
      <div
        className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] blur-3xl pointer-events-none rounded-full transition-colors duration-300 ${
          isOfficerPortal ? 'bg-amber-500/12' : 'bg-cyan-600/10'
        }`}
      />

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
          {isOfficerPortal ? 'Emergency Officer Sign In' : 'Sign In to FloodSense'}
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {isOfficerPortal
            ? 'Restricted access for pre-authorized Municipal Emergency Operations Officers'
            : 'Access the Citizen Reporting Portal or switch to Emergency Officer Login'}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div
          className={`bg-slate-950/85 backdrop-blur-md py-7 px-6 sm:px-8 rounded-3xl border shadow-2xl space-y-5 transition-colors ${
            isOfficerPortal ? 'border-amber-500/40' : 'border-slate-800'
          }`}
        >
          {/* Portal Selector Tabs: Citizen Login vs Emergency Officer Login */}
          <div
            role="tablist"
            aria-label="Select FloodSense login portal"
            className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-2xl border border-slate-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isOfficerPortal}
              data-testid="tab-citizen-login"
              onClick={() => handleSelectPortal('citizen')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                !isOfficerPortal
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Citizen Login</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={isOfficerPortal}
              data-testid="tab-officer-login"
              onClick={() => handleSelectPortal('officer')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isOfficerPortal
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800/80'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Emergency Officer Login</span>
            </button>
          </div>

          {/* Officer Authorization Notice or Firebase Active Notice */}
          {isOfficerPortal ? (
            <div className="p-3.5 bg-amber-950/40 border border-amber-700/60 rounded-2xl text-[11px] text-amber-100 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-300">Pre-Authorized Emergency Officers Only</p>
                <p className="text-amber-100/85 leading-relaxed">
                  Officer identity is authenticated by Firebase Authentication and verified on the backend via trusted role claims. Public officer self-registration is disabled.
                </p>
              </div>
            </div>
          ) : !isFirebaseAvailable && dataSourceMode === 'DEMO' ? (
            <>
              <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Instant Demo Access</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">1-Click Evaluation</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleQuickDemoCitizen}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                        Citizen Reporter
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1 font-mono">
                      {DEMO_CREDENTIALS.citizen.email}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickDemoOfficer}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                        Emergency Officer
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1 font-mono">
                      {DEMO_CREDENTIALS.officer.email}
                    </p>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 font-mono space-y-0.5">
                  <div>Citizen: {DEMO_CREDENTIALS.citizen.email} / {DEMO_CREDENTIALS.citizen.password}</div>
                  <div>Officer: {DEMO_CREDENTIALS.officer.email} / {DEMO_CREDENTIALS.officer.password}</div>
                </div>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-[11px] text-slate-400 uppercase tracking-wider font-mono">
                  or enter credentials
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>
            </>
          ) : (
            <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-[11px] text-cyan-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Firebase Authentication active. Select Emergency Officer Login above for EOC access.</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {localError && (
              <div
                role="alert"
                data-testid="login-error-alert"
                className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{localError}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-slate-300 mb-1">
                {isOfficerPortal ? 'Authorized Officer Email' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder={
                    isOfficerPortal
                      ? 'e.g. officer@municipality.gov.lk'
                      : 'e.g. nimalka.senanayake@gmail.com'
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 ${
                    isOfficerPortal
                      ? 'focus:ring-amber-500/20 focus:border-amber-500'
                      : 'focus:ring-cyan-500/20 focus:border-cyan-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-xs font-bold text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(!showForgotPassword);
                    setResetFeedback(null);
                    setResetEmail(email);
                  }}
                  className="text-[11px] text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-9 pr-10 py-2.5 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 ${
                    isOfficerPortal
                      ? 'focus:ring-amber-500/20 focus:border-amber-500'
                      : 'focus:ring-cyan-500/20 focus:border-cyan-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              />
              <span>Remember me on this device</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="login-submit-button"
              className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                isOfficerPortal
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/25'
              }`}
            >
              {isSubmitting ? (
                <span>
                  {isOfficerPortal ? 'Verifying Officer Authorization...' : 'Verifying credentials...'}
                </span>
              ) : (
                <>
                  <span>
                    {isOfficerPortal ? 'Sign In to Emergency Officer Portal' : 'Sign In to Citizen Account'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Forgot Password Inline Panel */}
          {showForgotPassword && (
            <form
              onSubmit={handleForgotPasswordSubmit}
              className="p-4 bg-slate-900 border border-slate-700 rounded-2xl space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                <KeyRound className="w-4 h-4" />
                <span>Password Recovery</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Enter your account email to receive password reset instructions.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Send Link
                </button>
              </div>
              {resetFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-[11px] flex items-start gap-2 ${
                    resetFeedback.success
                      ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200'
                      : 'bg-red-950/60 border border-red-800 text-red-200'
                  }`}
                >
                  {resetFeedback.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <span>{resetFeedback.message}</span>
                </div>
              )}
            </form>
          )}

          {/* Google Firebase Sign In */}
          <button
            type="button"
            disabled={isSubmitting}
            data-testid="google-signin-button"
            onClick={handleGoogleSignIn}
            className={`w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50 ${
              isOfficerPortal ? 'border-amber-500/40 hover:border-amber-400/60' : 'border-slate-700'
            }`}
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
            <span>
              {isOfficerPortal
                ? 'Sign in as Emergency Officer with Google'
                : 'Continue with Google Account'}
            </span>
          </button>

          {isOfficerPortal ? (
            <div className="text-center text-xs text-slate-400">
              <span>Citizen contributor? </span>
              <button
                type="button"
                onClick={() => handleSelectPortal('citizen')}
                className="text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                Switch to Citizen Login
              </button>
              <span> or </span>
              <NavLink to="/register" className="text-cyan-400 font-bold hover:underline">
                Register Citizen Account
              </NavLink>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400">
              <span>Don't have an account yet? </span>
              <NavLink to="/register" className="text-cyan-400 font-bold hover:underline">
                Create Citizen Account
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
