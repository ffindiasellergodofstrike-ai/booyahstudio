import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { authDestination, authReturnSearch } from '../services/AuthNavigation';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { AuthShell } from '../components/auth/AuthShell';
import { AsyncButton } from '../components/ui/AsyncButton';
import { Notice } from '../components/ui/Notice';
import { Spinner } from '../components/ui/Spinner';

export const LoginPage: React.FC = () => {
  const { signIn, isAuthenticated, currentUser, navigate, searchParams } = useApp();
  const { showToast } = useToast();
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState(searchParams.reset === 'success'
    ? 'Password updated. Sign in with your new password.'
    : searchParams.confirmation === 'sent' ? 'Check your email to confirm your account, then sign in.' : '');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hash.get('error') || searchParams.error) setErrorMessage('This confirmation link has expired or is no longer valid. Request a new email below.');
    if (window.location.hash) window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setTimeout(() => setResendCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (isAuthenticated && currentUser) navigate(authDestination(searchParams?.redirect));
  }, [isAuthenticated, currentUser, navigate, searchParams]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault(); setErrorMessage(null);
    if (!identifier.trim()) { setErrorMessage('Please enter your email address.'); return; }
    if (!password) { setErrorMessage('Please enter your password.'); return; }
    setIsLoading(true);
    try {
      const res = await signIn(identifier.trim(), password);
      if (res.success) {
        showToast('success', 'Welcome back', 'You’re signed in and ready to go.');
        navigate(authDestination(searchParams?.redirect));
      } else {
        setErrorMessage(res.message || 'Invalid email or password.');
        showToast('error', 'Could not sign in', res.message || 'Please check your credentials.');
      }
    } catch { setErrorMessage('We could not sign you in just now. Please try again.'); }
    finally { setIsLoading(false); }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault(); setErrorMessage(null);
    const cleanEmail = identifier.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Enter a valid email address.'); return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const result = await response.json();
      if (result.success) {
        setOtpSent(true);
        setResendCooldown(60);
        setConfirmationMessage('Verification OTP sent securely to your email. Check your inbox.');
        showToast('success', 'OTP Sent', 'Check your email for the verification code.');
      } else {
        setErrorMessage(result.message || 'Could not send OTP. Please try again.');
      }
    } catch {
      setErrorMessage('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault(); setErrorMessage(null);
    if (!otp.trim() || otp.trim().length !== 6) {
      setErrorMessage('Please enter the valid 6-digit OTP received in your email.'); return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier.trim().toLowerCase(), otp: otp.trim() }),
      });
      const result = await response.json();
      if (result.success) {
        showToast('success', 'Successfully Authenticated', 'Welcome to Booyahstudio!');
        window.location.href = authDestination(searchParams?.redirect);
      } else {
        setErrorMessage(result.message || 'Invalid OTP code.');
      }
    } catch {
      setErrorMessage('Verification failed. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }

  return <AuthShell eyebrow="WELCOME BACK" title="Good to see you again." description="Sign in to access your digital purchases, downloads, and account settings." onBack={() => navigate('/products')}
    footer={<>New around here? <button type="button" onClick={() => navigate('/register', undefined, authReturnSearch(searchParams?.redirect))}>Create an account <ArrowRight size={13} aria-hidden="true" /></button></>}>
    
    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
      <button type="button" onClick={() => { setLoginMode('password'); setErrorMessage(null); }} style={{ flex: 1, padding: '8px 12px', fontSize: '13px', fontWeight: 600, borderRadius: '6px', border: 'none', background: loginMode === 'password' ? '#ffffff' : 'transparent', color: loginMode === 'password' ? '#0f172a' : '#64748b', boxShadow: loginMode === 'password' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}>Password Login</button>
      <button type="button" onClick={() => { setLoginMode('otp'); setErrorMessage(null); }} style={{ flex: 1, padding: '8px 12px', fontSize: '13px', fontWeight: 600, borderRadius: '6px', border: 'none', background: loginMode === 'otp' ? '#ffffff' : 'transparent', color: loginMode === 'otp' ? '#0f172a' : '#64748b', boxShadow: loginMode === 'otp' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}>Email OTP Login</button>
    </div>

    {loginMode === 'password' ? (
      <form onSubmit={handlePasswordSubmit} className="auth-form" aria-busy={isLoading}>
        {confirmationMessage && <Notice tone="success" className="auth-note"><p>{confirmationMessage}</p></Notice>}
        {errorMessage && <Notice tone="error" className="auth-note auth-note-error"><p>{errorMessage}</p></Notice>}
        <fieldset disabled={isLoading}>
          <div><label htmlFor="login-identifier">Email address</label><div className="auth-input-wrap"><Mail size={17} aria-hidden="true" /><input id="login-identifier" type="email" value={identifier} onChange={e => { setIdentifier(e.target.value); setErrorMessage(null); }} placeholder="you@example.com" autoComplete="email" maxLength={254} required className="auth-input" /></div></div>
          <div><div className="auth-label-row"><label htmlFor="login-password">Password</label><button type="button" className="auth-inline-link" onClick={() => navigate('/forgot-password', undefined, authReturnSearch(searchParams?.redirect))}>Forgot password?</button></div><div className="auth-input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setErrorMessage(null); }} placeholder="Your password" autoComplete="current-password" maxLength={128} required className="auth-input auth-password" /><button type="button" className="auth-visibility" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
        </fieldset>
        <AsyncButton id="btn-login-submit" type="submit" busy={isLoading} busyLabel="Signing you in…" className="auth-submit">Sign in <ArrowRight size={17} aria-hidden="true" /></AsyncButton>
      </form>
    ) : (
      <div>
        {confirmationMessage && <Notice tone="success" className="auth-note"><p>{confirmationMessage}</p></Notice>}
        {errorMessage && <Notice tone="error" className="auth-note auth-note-error"><p>{errorMessage}</p></Notice>}
        
        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="auth-form" aria-busy={isLoading}>
            <fieldset disabled={isLoading}>
              <div><label htmlFor="otp-email">Email address</label><div className="auth-input-wrap"><Mail size={17} aria-hidden="true" /><input id="otp-email" type="email" value={identifier} onChange={e => { setIdentifier(e.target.value); setErrorMessage(null); }} placeholder="you@example.com" autoComplete="email" maxLength={254} required className="auth-input" /></div></div>
            </fieldset>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>We will send a secure 6-digit verification code to your email inbox via Resend.</p>
            <AsyncButton type="submit" busy={isLoading} busyLabel="Sending OTP…" className="auth-submit">Send Verification OTP <ArrowRight size={17} aria-hidden="true" /></AsyncButton>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="auth-form" aria-busy={isLoading}>
            <fieldset disabled={isLoading}>
              <div>
                <label htmlFor="otp-code">Enter 6-digit Code</label>
                <div className="auth-input-wrap">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <input id="otp-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setErrorMessage(null); }} placeholder="123456" required className="auth-input" style={{ letterSpacing: '6px', fontWeight: 700 }} />
                </div>
              </div>
            </fieldset>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>Code sent to <strong>{identifier}</strong>. Valid for 5 minutes.</p>
            <AsyncButton type="submit" busy={isLoading} busyLabel="Verifying Code…" className="auth-submit">Verify & Sign In <ArrowRight size={17} aria-hidden="true" /></AsyncButton>
            <button type="button" disabled={resendCooldown > 0 || isLoading} onClick={handleSendOtp} className="auth-secondary-action" style={{ marginTop: '12px' }}>{resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend Verification Code'}</button>
          </form>
        )}
      </div>
    )}
  </AuthShell>;
};
