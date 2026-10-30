import { appOrigin } from './config';
import crypto from 'node:crypto';
import { z } from 'zod';
import { Store } from './store';
import { supabaseAuth } from './supabase';
import { RecoveryError, verifyRecoveryBearer, claimRecoverySession, updatePasswordWithBearer } from './supabaseRecovery';
import type { Express, RequestHandler } from 'express';

const hash = (v: string) => crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
const normalizedEmail = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const emailFailure = (error: any) => error?.status === 429 ? 429 : 503;
const cookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

export class AuthServiceServer {
  static async createOpaqueSession(userId: string, email: string, username: string, ip?: string, userAgent?: string, authenticatedAt = Date.now()) {
    const token = crypto.randomBytes(32).toString('hex');
    await Store.set(`sessions/${hash(token)}`, { userId, email, username, createdAt: authenticatedAt, expiresAt: Date.now() + 7 * 86400000, ip, userAgent });
    return token;
  }
  static async verifyOpaqueSession(token: string) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await Store.get<any>(`sessions/${hash(token)}`);
    if (!session || Date.now() >= session.expiresAt) return null;
    const profile = await Store.getUserProfile(session.userId);
    if (!profile || (profile.status === 'suspended' || profile.blocked === true) || session.createdAt <= (profile.sessionValidAfter || 0)) return null;
    return session;
  }
  static async destroyOpaqueSession(token: string) { if (typeof token === 'string') await Store.delete(`sessions/${hash(token)}`); }
  static async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
  }
  static async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, key] = storedHash.split(':');
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derivedKey, 'hex'));
  }
}

export function registerAuthRoutes(app: Express, limiter: RequestHandler) {
  app.post('/api/auth/register', limiter, async (req, res) => {
    const parsed = z.object({ email: normalizedEmail, password: z.string().min(8).max(128), confirmPassword: z.string(), name: z.string().trim().min(2).max(100), mobile: z.string().trim().min(5).max(30) }).safeParse(req.body);
    if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) return res.status(400).json({ success: false, message: 'Provide valid details and matching passwords of at least 8 characters.' });
    const { email, password, name, mobile } = parsed.data;
    const { error } = await supabaseAuth().auth.signUp({ email: email.toLowerCase(), password, options: { data: { name, mobile }, emailRedirectTo: `${appOrigin()}/login` } });
    if (error) {
      console.error('Supabase Auth signUp error:', error);
      if (error.status === 429) res.set('Retry-After', '60');
      return res.status(error.status === 429 ? 429 : 400).json({ success: false, message: error.message || 'Could not register.' });
    }
    res.status(201).json({ success: true, message: 'Check your email to confirm your account, then sign in.' });
  });

  app.post('/api/auth/login', limiter, async (req, res) => {
    const input = z.object({ identifier: normalizedEmail, password: z.string().min(1).max(128) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, message: 'Enter your email and password.' });
    const authenticatedAt = Date.now();
    const { data, error } = await supabaseAuth().auth.signInWithPassword({ email: input.data.identifier, password: input.data.password });
    if (error || !data.user?.email_confirmed_at) return res.status(401).json({ success: false, message: 'Invalid credentials or email not confirmed.' });
    const user = data.user;
    let profile = await Store.getUserProfile(user.id);
    if (!profile?.id) {
      profile = { ...profile, id: user.id, email: user.email, name: user.user_metadata.name || 'Customer', mobile: user.user_metadata.mobile || '', username: user.email, role: 'customer', joinedDate: user.created_at, country: 'India' };
      await Store.setUserProfile(user.id, profile);
    }
    if ((profile.status === 'suspended' || profile.blocked === true)) return res.status(403).json({ success: false, message: 'Please contact support about account access.' });
    const token = await AuthServiceServer.createOpaqueSession(user.id, user.email!, profile.username, req.ip, req.get('user-agent'), authenticatedAt);
    res.cookie('sid', token, { ...cookie, maxAge: 7 * 86400000 });
    res.json({ success: true, user: profile });
  });

  // ============================================
  // SECURE EMAIL OTP LOGIN (RESEND) - SERVER SIDE ONLY
  // ============================================
  app.post('/api/auth/send-otp', limiter, async (req, res) => {
    const input = z.object({ email: normalizedEmail }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });

    const email = input.data.email;
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = hash(otp);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    try {
      await Store.set(`otps/${hash(email)}`, { otpHash, expiresAt, attempts: 0 });

      if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
        console.warn('Resend API key or From email missing. Simulated OTP:', otp);
        return res.json({ success: true, message: 'OTP sent to your email address.' });
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: email,
          subject: 'Booyahstudio Secure Login OTP',
          text: `Your login verification code is: ${otp}. This code expires in 5 minutes.`,
          html: `<div style="font-family:sans-serif;padding:24px;max-width:480px;margin:0 auto;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;"><h2 style="color:#0f172a;margin-top:0;">Secure Login OTP</h2><p style="color:#475569;">Your one-time verification code is:</p><div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#2563eb;margin:24px 0;padding:16px;background:#ffffff;text-align:center;border-radius:8px;border:1px solid #cbd5e1;">${otp}</div><p style="color:#64748b;font-size:14px;">This code expires in 5 minutes.</p></div>`,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!resendRes.ok) {
        return res.status(503).json({ success: false, message: 'Failed to dispatch verification email.' });
      }

      res.json({ success: true, message: 'OTP sent to your email address. Check your inbox.' });
    } catch {
      res.status(503).json({ success: false, message: 'Could not send OTP right now.' });
    }
  });

  app.post('/api/auth/verify-otp', limiter, async (req, res) => {
    const input = z.object({ email: normalizedEmail, otp: z.string().trim().length(6) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, message: 'Provide a valid email and 6-digit OTP.' });

    const { email, otp } = input.data;
    try {
      const record = await Store.get<any>(`otps/${hash(email)}`);
      if (!record || Date.now() > record.expiresAt) {
        return res.status(400).json({ success: false, message: 'OTP has expired or is invalid.' });
      }

      if (record.attempts >= 5) {
        await Store.delete(`otps/${hash(email)}`);
        return res.status(429).json({ success: false, message: 'Too many incorrect attempts.' });
      }

      const inputHash = hash(otp);
      const storedBuf = Buffer.from(record.otpHash, 'hex');
      const inputBuf = Buffer.from(inputHash, 'hex');

      if (storedBuf.length !== inputBuf.length || !crypto.timingSafeEqual(storedBuf, inputBuf)) {
        await Store.update(`otps/${hash(email)}`, { attempts: (record.attempts || 0) + 1 });
        return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
      }

      await Store.delete(`otps/${hash(email)}`);

      let userId = '';
      let profile: any;
      const allUsers = await Store.getAllUsers?.() || [];
      const found = allUsers.find((u: any) => u.email?.toLowerCase() === email);
      if (found) {
        userId = found.userId || found.id;
        profile = found;
      } else {
        userId = `user_${crypto.randomBytes(8).toString('hex')}`;
        const now = new Date().toISOString();
        profile = { id: userId, name: email.split('@')[0], email, mobile: '', username: email, createdAt: now, joinedDate: now.split('T')[0], role: 'customer', status: 'active', country: 'India' };
        await Store.setUserProfile(userId, profile);
      }

      if (profile.status === 'suspended' || profile.blocked === true) {
        return res.status(403).json({ success: false, message: 'Account is suspended.' });
      }

      const token = await AuthServiceServer.createOpaqueSession(userId, email, profile.username || email, req.ip, req.get('user-agent'));
      res.cookie('sid', token, { ...cookie, maxAge: 7 * 86400000 });
      res.json({ success: true, message: 'Successfully logged in with OTP.', user: profile });
    } catch {
      res.status(503).json({ success: false, message: 'OTP verification failed.' });
    }
  });

  app.post('/api/auth/logout', async (req: any, res) => {
    try {
      const sid = req.cookies?.sid;
      if (sid) await AuthServiceServer.destroyOpaqueSession(sid);
      res.clearCookie('sid', { path: '/' });
      res.json({ success: true, message: 'Logged out successfully.' });
    } catch {
      res.status(503).json({ success: false, message: 'Sign out could not be completed.' });
    }
  });
}
