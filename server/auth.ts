import bcrypt from 'bcryptjs';
import { FirebaseRtdb } from './firebaseRtdb';
import crypto from 'crypto';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  username: string;
}

export class AuthServiceServer {
  /**
   * Hash password securely with bcrypt (10 rounds)
   */
  public static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  /**
   * Verify password against hash
   */
  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  /**
   * Hash security code securely with bcrypt (10 rounds)
   */
  public static async hashSecurityCode(securityCode: string): Promise<string> {
    return await bcrypt.hash(securityCode.trim(), 10);
  }

  /**
   * Verify security code against hash
   */
  public static async verifySecurityCode(securityCode: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(securityCode.trim(), hash);
    } catch {
      return false;
    }
  }

  /**
   * Create opaque server session
   */
  public static async createOpaqueSession(userId: string, email: string, username: string, ip?: string, userAgent?: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = Date.now();
    const sessionRecord = {
      userId,
      email,
      username,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
      ip: ip || '0.0.0.0',
      userAgent: userAgent || 'unknown',
    };
    await FirebaseRtdb.set(`sessions/${tokenHash}`, sessionRecord);
    return rawToken;
  }

  /**
   * Verify opaque server session
   */
  public static async verifyOpaqueSession(rawToken: string): Promise<AuthTokenPayload | null> {
    if (!rawToken) return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const session = await FirebaseRtdb.get<any>(`sessions/${tokenHash}`);
    if (!session || !session.expiresAt || Date.now() > session.expiresAt) {
      if (session) {
        await FirebaseRtdb.delete(`sessions/${tokenHash}`);
      }
      return null;
    }
    const profile = await FirebaseRtdb.getUserProfile(session.userId);
    if (!profile || (profile.sessionValidAfter &&
        new Date(session.createdAt).getTime() < Number(profile.sessionValidAfter))) return null;
    return {
      userId: session.userId,
      email: session.email,
      username: session.username,
    };
  }

  /**
   * Destroy opaque server session
   */
  public static async destroyOpaqueSession(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await FirebaseRtdb.delete(`sessions/${tokenHash}`);
  }

  /**
   * Register User Flow
   */
  public static async register(data: {
    mobile: string;
    email: string;
    password: string;
    confirmPassword: string;
    name?: string;
  }): Promise<{ success: boolean; message: string; user?: any }> {
    const { mobile, email, password, confirmPassword, name } = data;

    const cleanMobile = (mobile || '').toString().trim().replace(/\D/g, '');
    const mobileRegex = /^[6-9][0-9]{9}$/;

    if (!cleanMobile || cleanMobile.length !== 10 || !mobileRegex.test(cleanMobile)) {
      return {
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      };
    }

    if (!email || !email.includes('@') || !email.includes('.')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!password || password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }
    if (password !== confirmPassword) {
      return { success: false, message: 'Passwords do not match.' };
    }

    const existingMobileUser = await FirebaseRtdb.findUserIdByMobile(cleanMobile);
    if (existingMobileUser) {
      return {
        success: false,
        message: 'This mobile number is already registered. Please log in instead.',
      };
    }

    const existingEmailUser = await FirebaseRtdb.findUserIdByIdentifier(cleanEmail);
    if (existingEmailUser) {
      return {
        success: false,
        message: 'This email address is already registered. Please log in instead.',
      };
    }

    const displayName = name && name.trim().length >= 2 ? name.trim() : cleanEmail.split('@')[0];

    // Normalize name for user ID (keep Hindi or English alphanumeric characters, lowercased, remove spaces/punctuation)
    const cleanNameForId = displayName
      .replace(/[\s\W_]+/g, '')
      .toLowerCase();

    // First 4 digits of the mobile number
    const frontFour = cleanMobile.slice(0, 4);

    const baseUserId = `${cleanNameForId}${frontFour}`;
    let userId = baseUserId;

    // Check if user ID already exists to prevent collisions
    const isCollision = await FirebaseRtdb.get(`users/${userId}`);
    if (isCollision) {
      const shortSuffix = crypto.randomBytes(2).toString('hex').toLowerCase();
      userId = `${baseUserId}_${shortSuffix}`;
    }

    const cleanUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || `user${cleanMobile.slice(-4)}`;

    const passwordHash = await this.hashPassword(password);

    const now = new Date();
    const profile = {
      id: userId,
      name: displayName,
      email: cleanEmail,
      mobile: cleanMobile,
      username: cleanUsername,
      role: 'customer',
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`,
      joinedDate: now.toISOString().split('T')[0],
      createdAt: now.toISOString(),
      country: 'India',
    };

    const credentials = {
      passwordHash,
    };

    await FirebaseRtdb.createUserRecord(userId, profile, credentials);

    return {
      success: true,
      message: 'Account created successfully.',
      user: profile,
    };
  }

  /**
   * Login Flow
   */
  public static async login(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; message: string; user?: any }> {
    const genericError = 'Invalid login credentials.';

    if (!identifier || !password) {
      return { success: false, message: genericError };
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const userId = await FirebaseRtdb.findUserIdByIdentifier(cleanIdentifier);
    if (!userId) {
      return { success: false, message: genericError };
    }

    const credentials = await FirebaseRtdb.getUserCredentials(userId);
    if (!credentials || !credentials.passwordHash) {
      return { success: false, message: genericError };
    }

    const isValid = await this.verifyPassword(password, credentials.passwordHash);
    if (!isValid) {
      return { success: false, message: genericError };
    }

    const profile = await FirebaseRtdb.getUserProfile(userId);
    if (!profile) {
      return { success: false, message: genericError };
    }

    return {
      success: true,
      message: 'Login successful.',
      user: profile,
    };
  }

  public static async resetPasswordWithEmailAndMobile(data: {
    email: string;
    mobile: string;
    newPassword: string;
    confirmNewPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const genericError = 'The email and mobile number could not be verified.';
    const { email, mobile, newPassword, confirmNewPassword } = data;

    if (!email || !mobile || !newPassword) {
      return { success: false, message: genericError };
    }

    const cleanMobile = String(mobile).trim().replace(/\D/g, '');
    const cleanEmail = String(email).trim().toLowerCase();

    if (!/^[6-9][0-9]{9}$/.test(cleanMobile) || !cleanEmail.includes('@')) {
      return { success: false, message: genericError };
    }

    if (newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    if (newPassword !== confirmNewPassword) {
      return { success: false, message: 'New passwords do not match.' };
    }

    const userId = await FirebaseRtdb.findUserIdByIdentifier(cleanEmail);
    if (!userId) {
      return { success: false, message: genericError };
    }

    const profile = await FirebaseRtdb.getUserProfile(userId);
    if (!profile || !profile.mobile || String(profile.email || '').trim().toLowerCase() !== cleanEmail) {
      return { success: false, message: genericError };
    }

    if (profile.mobile.replace(/\D/g, '') !== cleanMobile) {
      return { success: false, message: genericError };
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await FirebaseRtdb.updatePasswordHash(userId, newPasswordHash);
    await FirebaseRtdb.updateUserProfile(userId, { sessionValidAfter: Date.now() });

    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    };
  }
}
