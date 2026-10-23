import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { authReturnSearch } from '../services/AuthNavigation';
import { AuthService } from '../services/AuthService';
export const ForgotPasswordPage: React.FC = () => {
 const { navigate, searchParams } = useApp();
 const [tokenHash, setTokenHash] = useState(() => new URLSearchParams(window.location.search).get('token_hash'));
 const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
 const [message, setMessage] = useState(() => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return searchParams.error || hash.get('error') ? 'This recovery link is invalid or expired. Request a new email below.' : '';
 });
 const [busy, setBusy] = useState(false), [resetFailed, setResetFailed] = useState(false), [cooldown, setCooldown] = useState(0);
 useEffect(() => {
  const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta);
  return () => meta.remove();
 }, []);
 useEffect(() => {
  if (!cooldown) return;
  const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
  return () => window.clearTimeout(timer);
 }, [cooldown]);
 function requestNewLink() {
  setTokenHash(null); setPassword(''); setConfirm(''); setResetFailed(false); setMessage('Enter your email to request a new recovery link.');
  window.history.replaceState({}, '', '/forgot-password');
 }
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (tokenHash && password !== confirm) { setMessage('Passwords do not match.'); return; }
  setBusy(true); setMessage('');
  try {
   const response = await fetch(tokenHash ? '/api/auth/reset-password' : '/api/auth/forgot-password', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokenHash ? { tokenHash, password, confirmPassword: confirm } : { email: email.trim().toLowerCase() }),
   });
   const result = await response.json(); setMessage(result.message || 'Please retry or request a new recovery link.');
   if (response.status === 429 || (result.success && !tokenHash)) setCooldown(Number(result.retryAfter) || 60);
   if (tokenHash && !result.success && ['RECOVERY_INVALID', 'RECOVERY_RESTART'].includes(result.code)) setResetFailed(true);
   if (result.success && tokenHash) {
    window.history.replaceState({}, '', '/forgot-password'); setTokenHash(null); setPassword(''); setConfirm('');
    await AuthService.verifySession();
    navigate('/login', undefined, { ...authReturnSearch(searchParams?.redirect), reset: 'success' });
   }
  } catch { setMessage('Recovery is temporarily unavailable. Please try again.'); } finally { setBusy(false); }
 }
 return <main className="max-w-lg mx-auto px-5 py-16"><h1 className="text-3xl font-bold mb-4">{tokenHash ? 'Choose a new password' : 'Reset your password'}</h1><p className="mb-6">We use a secure email link to verify account ownership.</p><form onSubmit={submit} className="space-y-5">
 {tokenHash ? <><label className="block">New password<input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} className="block border rounded p-3 w-full" /></label><label className="block">Confirm password<input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} className="block border rounded p-3 w-full" /></label></> : <label className="block">Account email<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="block border rounded p-3 w-full" /></label>}
 <button disabled={busy || resetFailed || (!tokenHash && cooldown > 0)} className="bg-slate-900 text-white rounded px-6 py-3">{busy ? 'Please wait…' : tokenHash ? 'Update password' : cooldown > 0 ? `Request again in ${cooldown}s` : 'Send recovery email'}</button><p role="status">{message}</p></form>
 {tokenHash && <button type="button" disabled={busy} className="mt-5 underline block" onClick={requestNewLink}>Request a new recovery link</button>}
 <button className="mt-5 underline" onClick={() => { window.history.replaceState({}, '', '/forgot-password'); navigate('/login', undefined, authReturnSearch(searchParams?.redirect)); }}>Back to sign in</button></main>;
};
