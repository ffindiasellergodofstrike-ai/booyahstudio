import { authDestination, authReturnSearch } from '../services/AuthNavigation';
import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

export const LoginPage: React.FC = () => {
  const { signIn, isAuthenticated, currentUser, navigate, searchParams } = useApp();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState(searchParams.reset === 'success'
    ? 'Password updated. Sign in with your new password.'
    : searchParams.confirmation === 'sent' ? 'Check your email to confirm your account, then sign in.' : '');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  React.useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hash.get('error') || searchParams.error) {
      setErrorMessage('This email confirmation link is invalid or expired. Request a new confirmation email below.');
    } else if (hash.get('type') === 'signup') {
      setConfirmationMessage('Email confirmation link processed. Sign in with your email and password.');
    }
    // Signup confirmation is handled by Supabase; browser tokens do not create our sid session.
    if (window.location.hash) window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }, []);

  React.useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setTimeout(() => setResendCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function resendConfirmation() {
    setErrorMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
      setErrorMessage('Enter your account email above to request a confirmation link.'); return;
    }
    setResendBusy(true);
    try {
      const response = await fetch('/api/auth/resend-confirmation', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: identifier.trim().toLowerCase() }) });
      const result = await response.json();
      if (response.status === 429 || result.success) setResendCooldown(Number(result.retryAfter) || 60);
      if (result.success) setConfirmationMessage(result.message);
      else setErrorMessage(result.message || 'Could not request confirmation. Please retry later.');
    } catch { setErrorMessage('Confirmation is temporarily unavailable. Please retry later.'); }
    finally { setResendBusy(false); }
  }

  // If already authenticated, redirect
  React.useEffect(() => {
    if (isAuthenticated && currentUser) {
      navigate(authDestination(searchParams?.redirect));
    }
  }, [isAuthenticated, currentUser, navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your email.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signIn(identifier.trim(), password);
      if (res.success) {
        showToast('success', 'Welcome Back', `Successfully signed in as @${res.user?.username || res.user?.name}`);
        navigate(authDestination(searchParams?.redirect));
      } else {
        setErrorMessage(res.message || 'Invalid email or password.');
        showToast('error', 'Sign In Failed', res.message || 'Invalid email or password.');
      }
    } catch {
      setErrorMessage('Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-6 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-[calc(100dvh-12rem)] flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden transition-all">
          {/* Header Badge */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-6 sm:p-8 text-white relative">
            <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:flex sm:flex-col items-start">
              <div className="min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 mb-3 sm:mb-4 shadow-inner shrink-0">
                  <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">Customer Sign In</h1>
                <p className="text-blue-100 text-xs sm:text-sm mt-1 line-clamp-2">
                  Access your digital purchases, receipts, and downloads.
                </p>
              </div>
            </div>
            {/* Background decoration */}
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            {confirmationMessage && <p role="status" className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-800 text-sm">{confirmationMessage}</p>}
            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold truncate">Authentication Error</p>
                  <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="login-identifier" className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
                Email Address
              </label>
              <div className="relative min-w-0">
                <UserIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
                <input
                  id="login-identifier"
                  type="email"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400 min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="login-password" className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500 truncate">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password', undefined, authReturnSearch(searchParams?.redirect))}
                  className="text-[10px] sm:text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors shrink-0 min-h-[32px] flex items-center"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative min-w-0">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold rounded-xl text-sm sm:text-base transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-95 min-h-[44px]"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span className="truncate">Verifying...</span>
                </>
              ) : (
                <>
                  <span className="truncate">Sign In to Account</span>
                  <ArrowRight className="w-5 h-5 shrink-0" />
                </>
              )}
            </button>

            {/* Security Banner */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-4 text-xs text-slate-600">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <span className="min-w-0">
                Protected with <strong>cryptographic hashing</strong> and isolated database storage.
              </span>
            </div>

            <button type="button" disabled={resendBusy || resendCooldown > 0} onClick={resendConfirmation}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50 min-h-[32px]">
              {resendBusy ? 'Requesting confirmation…' : resendCooldown > 0 ? `Resend confirmation in ${resendCooldown}s` : 'Resend confirmation email'}
            </button>

            {/* Register Link */}
            <div className="pt-4 text-center text-sm text-slate-600 border-t border-slate-100">
              New to Booyahstudio?{' '}
              <button
                type="button"
                onClick={() => navigate('/register', undefined, searchParams?.redirect ? { redirect: searchParams.redirect } : undefined)}
                className="font-extrabold text-blue-600 hover:text-blue-700 transition-colors min-h-[44px] px-2"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
