import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
export const ForgotPasswordPage: React.FC = () => {
 const { navigate } = useApp();
 const tokenHash = new URLSearchParams(window.location.search).get('token_hash');
 const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
 const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
 async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (tokenHash && password !== confirm) { setMessage('Passwords do not match.'); return; }
  setBusy(true);
  try {
   const response = await fetch(tokenHash ? '/api/auth/reset-password' : '/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tokenHash ? { tokenHash, password } : { email }) });
   const result = await response.json(); setMessage(result.message);
   if (result.success && tokenHash) { window.history.replaceState({}, '', '/forgot-password'); setPassword(''); setConfirm(''); navigate('/login'); }
  } catch { setMessage('Recovery is temporarily unavailable. Please try again.'); } finally { setBusy(false); }
 }
 return <main className="max-w-lg mx-auto px-5 py-16"><h1 className="text-3xl font-bold mb-4">{tokenHash ? 'Choose a new password' : 'Reset your password'}</h1><p className="mb-6">We use a secure email link to verify account ownership.</p><form onSubmit={submit} className="space-y-5">
 {tokenHash ? <><label className="block">New password<input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} className="block border rounded p-3 w-full" /></label><label className="block">Confirm password<input autoComplete="new-password" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="block border rounded p-3 w-full" /></label></> : <label className="block">Account email<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="block border rounded p-3 w-full" /></label>}
 <button disabled={busy} className="bg-slate-900 text-white rounded px-6 py-3">{busy ? 'Please wait…' : tokenHash ? 'Update password' : 'Send recovery email'}</button><p role="status">{message}</p></form><button className="mt-5 underline" onClick={() => navigate('/login')}>Back to sign in</button></main>;
};
