import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

export const RegisterPage: React.FC = () => {
  const { register, isAuthenticated, currentUser, navigate, searchParams } = useApp();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (searchParams?.redirect === 'checkout') {
        navigate('/checkout');
      } else {
        navigate('/account');
      }
    }
  }, [isAuthenticated, currentUser, navigate, searchParams]);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strictly accept ONLY digits and cap length at 10
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobile(value);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Please enter your name (at least 2 characters).');
      return;
    }

    // Strict 10-digit Indian Mobile Number validation
    const indianMobileRegex = /^[6-9][0-9]{9}$/;
    if (!mobile || mobile.length !== 10 || !indianMobileRegex.test(mobile)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
      });

      if (res.success) {
        showToast('success', 'Registration Complete', `Welcome to the store!`);
        navigate('/account');
      } else {
        setErrorMessage(res.message || 'Registration failed. Please check your details.');
        showToast('error', 'Registration Failed', res.message || 'Registration failed.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-6 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-[calc(100dvh-12rem)] flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden transition-all">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-6 sm:p-8 text-white relative">
            <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:flex sm:flex-col items-start">
              <div className="min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 mb-3 sm:mb-4 shadow-inner shrink-0">
                  <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">Register Account</h1>
                <p className="text-blue-100 text-xs sm:text-sm mt-1 line-clamp-2">
                  Enter your details to register your customer account.
                </p>
              </div>
            </div>
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold truncate">Registration Error</p>
                  <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* 0. Full Name */}
            <div className="space-y-2">
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
                Full Name *
              </label>
              <div className="relative min-w-0">
                <UserIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
                <input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Your full name"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400 min-h-[44px]"
                />
              </div>
            </div>

            {/* 1. Mobile Number */}
            <div className="space-y-2">
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
                Mobile Number *
              </label>
              <div className="relative min-w-0">
                <Phone className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
                <input
                  id="reg-mobile"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={mobile}
                  onChange={handleMobileChange}
                  placeholder="10-digit mobile number"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400 min-h-[44px]"
                />
              </div>
              <p className="text-[10px] text-slate-500 truncate">10-digit Indian mobile (starts with 6-9)</p>
            </div>

            {/* 2. Email Address */}
            <div className="space-y-2">
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
                Email Address *
              </label>
              <div className="relative min-w-0">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400 min-h-[44px]"
                />
              </div>
            </div>

            {/* 3. Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500 truncate">
                  Password *
                </label>
                <span className="text-[10px] text-slate-400 shrink-0">Min 6 chars</span>
              </div>
              <div className="relative min-w-0">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  autoComplete="new-password"
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

            {/* 4. Confirm Password */}
            <div className="space-y-2">
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
                Confirm Password *
              </label>
              <div className="relative min-w-0">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
                <input
                  id="reg-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400 min-h-[44px]"
                />
              </div>
            </div>

            <button
              id="btn-register-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold rounded-xl text-sm sm:text-base transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-95 min-h-[44px]"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span className="truncate">Registering...</span>
                </>
              ) : (
                <>
                  <span className="truncate">Create My Account</span>
                  <ArrowRight className="w-5 h-5 shrink-0" />
                </>
              )}
            </button>

            {/* Login Link */}
            <div className="pt-4 text-center text-sm text-slate-600 border-t border-slate-100">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login', undefined, searchParams?.redirect ? { redirect: searchParams.redirect } : undefined)}
                className="font-extrabold text-blue-600 hover:text-blue-700 transition-colors min-h-[44px] px-2"
              >
                Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
