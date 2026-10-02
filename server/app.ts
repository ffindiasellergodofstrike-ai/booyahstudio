import { registerPayURoutes, getPayUConfig } from './payu';
import { seoMiddleware } from './seoMiddleware';
import fs from 'node:fs';
import { hasLivePayment } from '../src/services/PaymentEnvironment';
import { BUSINESS } from '../src/config/business';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { isIP } from 'node:net';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import { z } from 'zod';
import { AuthServiceServer } from './auth';
import { FirebaseRtdb } from './firebaseRtdb';
import { AuditLogger, generateRequestId } from './audit';
import { SecureFileManager } from './secureFiles';
import { PRODUCTS, COUPONS } from '../src/data/products';
import { adminRouter } from './adminRoutes';
import { runServerSeed } from './seed';
import { mergeProductCatalog } from './productCatalog';
import { easebuzzRetrieveHash, findPaidPurchase, isPaidOrderForProduct, matchesEasebuzzPaymentIdentity, matchesVerifiedEasebuzzPayment } from './paymentAccess';
import {
  buildEmailDownloadUrl,
  buildInvoiceDownloadUrl,
  buildInvoicePdf,
  createEmailDownloadToken,
  getPurchaseEmailLinkTtlMs,
  hashEmailDownloadToken,
  sendPurchaseConfirmationEmail,
  sendTestPaymentEmail,
  type PurchaseEmailLink,
} from './purchaseEmail';
import {
  buildEasebuzzInitiatePayload,
  formatEasebuzzAmount,
  getEasebuzzBaseUrl,
  getEasebuzzDashboardUrl,
  sanitizeFieldText,
  sanitizePhoneNumber,
  verifyEasebuzzCallbackHash,
} from './easebuzz';
import {
  getClientPaddleConfig,
  getPaddlePriceIdForProduct,
  getPaddleWebhookSecret,
  getPaddleClientToken,
  getPaddleEnvironment,
  getPaddleApiKey,
  verifyPaddleWebhookSignature,
  fetchPaddleTransaction,
} from './paddle';

// Run initial seed on startup
runServerSeed().catch(err => console.warn('Startup seed error:', err));

const EASEBUZZ_KEY = (process.env.EASEBUZZ_KEY || '').trim();
const EASEBUZZ_SALT = (process.env.EASEBUZZ_SALT || '').trim();
const rawEasebuzzEnv = (process.env.EASEBUZZ_ENV || 'test').trim().toLowerCase();
const EASEBUZZ_ENV: 'prod' | 'test' = rawEasebuzzEnv.startsWith('prod') || rawEasebuzzEnv === 'live' ? 'prod' : 'test';
const CRON_SECRET = process.env.CRON_SECRET || '';

const EASEBUZZ_BASE_URL = getEasebuzzBaseUrl(EASEBUZZ_ENV);
const EASEBUZZ_DASHBOARD_URL = getEasebuzzDashboardUrl(EASEBUZZ_ENV);

const getConfiguredAppUrl = (): string => {
  if (process.env.APP_URL) {
    try {
      const configured = new URL(process.env.APP_URL);
      if (configured.protocol === 'https:' ||
          (process.env.NODE_ENV !== 'production' && configured.protocol === 'http:')) {
        return configured.origin;
      }
    } catch {
      // An invalid configured URL must never become a gateway callback.
    }
  }
  return 'https://www.booyahstudio.shop';
};

const getHostUrl = (req: Request): string => {
  if (process.env.APP_URL || process.env.NODE_ENV === 'production') return getConfiguredAppUrl();
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : (forwardedHost || req.headers.host);
  const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
  if (host) {
    const cleanHost = String(host).split(',')[0].trim();
    return `${proto}://${cleanHost}`.replace(/\/+$/, '');
  }
  return getConfiguredAppUrl();
};

const getPaymentRequestIp = (req: Request): string => {
  // Vercel sets this header from the client connection and prevents spoofing.
  const forwarded = process.env.VERCEL
    ? req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for']
    : undefined;
  const candidate = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip || '')
    .split(',')[0].trim();
  return isIP(candidate) ? candidate : '';
};

const getProductCatalog = async (): Promise<any[]> => {
  const databaseProducts = await FirebaseRtdb.getAllProducts();
  return mergeProductCatalog(PRODUCTS, databaseProducts);
};

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  username?: string;
}

export const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Block direct access to internal data, private archives, server source code, and configuration files
const BLOCKED_PATH_PATTERNS = [
  /^\/(\.data|\.env|demofiles|templates|server|scripts|build)(\/|$)/i,
  /^\/api\/index(\.ts|\.js)?$/i,
  /\.zip$/i,
  /\.ya?ml$/i,
  /\.lock$/i,
  /\.py$/i,
  /\.sh$/i,
  /\.mjs$/i,
  /^\/(package|tsconfig|components|metadata|database\.rules|vercel)\.json$/i,
  /^\/server\.ts$/i,
];

app.use((req: Request, res: Response, next: NextFunction) => {
  let safePath = req.path;
  try {
    safePath = path.posix.normalize(decodeURIComponent(req.path));
  } catch {
    return res.status(400).send('Bad Request');
  }

  if (safePath.includes('..')) {
    return res.status(404).send('Not Found');
  }

  if (BLOCKED_PATH_PATTERNS.some(pattern => pattern.test(safePath))) {
    return res.status(404).send('Not Found');
  }

  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.replace(/\/+$/, '') === getConfiguredAppUrl()) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production') {
      try {
        const url = new URL(origin);
        if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) {
          return callback(null, true);
        }
      } catch {
        // Reject malformed origins.
      }
    }
    return callback(null, false);
  },
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({
  limit: '2mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

app.get('/robots.txt', (_req: Request, res: Response) => {
  res.type('text/plain').send(`User-agent: *
Disallow: /admin
Disallow: /account
Disallow: /checkout
Disallow: /cart
Disallow: /api/
Disallow: /.data/

Sitemap: https://www.booyahstudio.shop/sitemap.xml
`);
});

app.get('/sitemap.xml', (_req: Request, res: Response) => {
  const sitemapPath = path.join(process.cwd(), 'dist', 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    return res.type('application/xml').sendFile(sitemapPath);
  }
  const policySlugs = ['terms', 'privacy', 'refund', 'cancellation', 'delivery', 'chargebacks', 'grievance', 'license'];
  const paths = [
    '/',
    '/products',
    '/about',
    '/contact',
    '/faq',
    '/search',
    ...policySlugs.map((p) => `/policies/${p}`),
    ...PRODUCTS.map((p) => `/product/${p.slug}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>https://www.booyahstudio.shop${p}</loc></url>`).join('')}</urlset>`;
  res.type('application/xml').send(xml);
});

app.use(seoMiddleware);

// RTDB-backed Auth Rate Limiter
const authRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = (req.ip || req.headers['x-forwarded-for'] as string || 'unknown').replace(/[\.\/]/g, '_');
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 20;

    const key = `rateLimits/${ip}`;
    const record = await FirebaseRtdb.get<{ count: number; resetTime: number }>(key);

    if (!record || now > record.resetTime) {
      await FirebaseRtdb.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
      });
    }

    record.count += 1;
    await FirebaseRtdb.set(key, record);
    next();
  } catch {
    // Do not permit unlimited login guesses when the shared limiter is down.
    res.status(503).json({ success: false, message: 'Authentication is temporarily unavailable.' });
  }
};

// Authentication Middleware via Opaque Session Cookie "sid"
const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const sid = req.cookies?.sid;
  if (!sid) {
    return res.status(401).json({ success: false, message: 'Authentication session required.' });
  }

  const payload = await AuthServiceServer.verifyOpaqueSession(sid);
  if (!payload || !payload.userId) {
    res.clearCookie('sid', { path: '/' });
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }

  req.userId = payload.userId;
  req.userEmail = payload.email;
  req.username = payload.username;
  next();
};

const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, async () => {
    try {
      const profile = await FirebaseRtdb.getUserProfile(req.userId!);
      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Administrative privileges required for this action.' });
      }
      next();
    } catch {
      return res.status(403).json({ success: false, message: 'Administrative privileges required for this action.' });
    }
  });
};

// ============================================
// SYSTEM & HEALTH ENDPOINTS
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/firebase-status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const status = await FirebaseRtdb.testConnection();
  res.json({
    status: 'ok',
    firebase: {
      connected: status.connected,
      mode: status.mode,
      databaseUrl: status.url,
      error: status.error,
    },
  });
});

// Public Product API: static products and Admin/Firebase products are merged.
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, products: await getProductCatalog() });
  } catch {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ success: false, message: 'Product catalog is temporarily unavailable.' });
    }
    res.json({ success: true, products: mergeProductCatalog(PRODUCTS, []) });
  }
});

app.get('/api/products/:slugOrId', async (req: Request, res: Response) => {
  try {
    const identifier = req.params.slugOrId.toLowerCase();
    const list = await getProductCatalog();
    const found = list.find((p: any) => p.id.toLowerCase() === identifier || p.slug.toLowerCase() === identifier);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.json({ success: true, product: found });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch product.' });
  }
});

app.post('/api/newsletter/subscribe', authRateLimiter, async (req: Request, res: Response) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }
  try {
    const key = crypto.createHash('sha256').update(email).digest('hex');
    const path = `newsletterSubscribers/${key}`;
    const existing = await FirebaseRtdb.get<any>(path);
    const now = new Date().toISOString();
    await FirebaseRtdb.set(path, {
      email, subscribedAt: existing?.subscribedAt || now, lastConsentAt: now, status: 'subscribed',
    });
    res.json({ success: true, message: 'Your subscription was saved.' });
  } catch {
    res.status(503).json({ success: false, message: 'Could not save your subscription. Please retry.' });
  }
});

// Mount Admin Router with requireAdmin
app.post('/api/contact', authRateLimiter, async (req, res) => {
  const input = z.object({ name: z.string().trim().min(1).max(100), email: z.string().email().max(254), message: z.string().trim().min(10).max(4000) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: 'Enter a valid name, email, and message (10–4,000 characters).' });
  try {
    const reference = `BS-${crypto.randomBytes(8).toString('hex')}`;
    await FirebaseRtdb.set(`supportRequests/${reference}`, { ...input.data, reference, createdAt: new Date().toISOString(), status: 'open' });
    res.status(201).json({ success: true, reference });
  } catch { res.status(503).json({ message: 'Support requests are temporarily unavailable.' }); }
});

app.use('/api/admin', requireAdmin, adminRouter);

// ============================================
// AUTH ENDPOINTS (OPAQUE SESSIONS + COOKIES)
// ============================================
app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  try {
    const { mobile, email, password, confirmPassword, name } = req.body;
    const result = await AuthServiceServer.register({ mobile, email, password, confirmPassword, name });

    if (!result.success) {
      return res.status(400).json(result);
    }

    const rawToken = await AuthServiceServer.createOpaqueSession(
      result.user.id,
      result.user.email,
      result.user.username,
      req.ip,
      req.headers['user-agent']
    );

    res.cookie('sid', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || req.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ success: true, message: result.message, user: result.user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const result = await AuthServiceServer.login(identifier, password);

    if (!result.success) {
      return res.status(401).json(result);
    }

    const rawToken = await AuthServiceServer.createOpaqueSession(
      result.user.id,
      result.user.email,
      result.user.username,
      req.ip,
      req.headers['user-agent']
    );

    res.cookie('sid', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || req.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, message: 'Login successful.', user: result.user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Invalid login credentials.' });
  }
});

app.post('/api/auth/forgot-password', authRateLimiter, async (req, res) => {
  try {
    const { email, mobile, newPassword, confirmNewPassword } = req.body;
    const result = await AuthServiceServer.resetPasswordWithEmailAndMobile({ email, mobile, newPassword, confirmNewPassword });
    res.status(result.success ? 200 : 400).json(result);
  } catch {
    res.status(503).json({ success: false, message: 'Password reset is temporarily unavailable.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await FirebaseRtdb.getUserProfile(req.userId!);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }
    res.json({ success: true, user: profile });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

app.post('/api/auth/logout', async (req: AuthenticatedRequest, res) => {
  try {
    const sid = req.cookies?.sid;
    if (sid) {
      await AuthServiceServer.destroyOpaqueSession(sid);
    }
    res.clearCookie('sid', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch {
    res.clearCookie('sid', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully.' });
  }
});

// ============================================
// USER SYNC, CART, WISHLIST & ORDERS
// ============================================
app.get('/api/user/sync-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const [profile, cart, wishlist, orders, downloads, settings] = await Promise.all([
      FirebaseRtdb.getUserProfile(userId),
      FirebaseRtdb.getUserCart(userId),
      FirebaseRtdb.getUserWishlist(userId),
      FirebaseRtdb.getUserOrders(userId),
      FirebaseRtdb.getUserDownloads(userId),
      FirebaseRtdb.getUserSettings(userId),
    ]);
    res.json({ success: true, data: { profile, cart, wishlist, orders, downloads, settings } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to sync user data.' });
  }
});

app.put('/api/user/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    company: z.string().trim().max(150).optional(),
    country: z.string().trim().min(2).max(100).optional(),
  }).strict().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
    return res.status(400).json({ success: false, message: 'Only name, company and country can be updated.' });
  }
  try {
    const profile = await FirebaseRtdb.getUserProfile(req.userId!);
    if (!profile) return res.status(404).json({ success: false, message: 'Account not found.' });
    const updatedAt = new Date().toISOString();
    await FirebaseRtdb.updateUserProfile(req.userId!, { ...parsed.data, updatedAt });
    res.json({ success: true, user: { ...profile, ...parsed.data, updatedAt } });
  } catch {
    res.status(503).json({ success: false, message: 'Could not save profile changes.' });
  }
});

app.get('/api/user/cart', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const items = await FirebaseRtdb.getUserCart(req.userId!);
    res.json({ success: true, items });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch cart.' });
  }
});

app.post('/api/user/cart', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { items } = req.body;
    await FirebaseRtdb.setUserCart(req.userId!, items || []);
    res.json({ success: true, items });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to save cart.' });
  }
});

app.get('/api/user/wishlist', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const items = await FirebaseRtdb.getUserWishlist(req.userId!);
    res.json({ success: true, items });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist.' });
  }
});

app.post('/api/user/wishlist', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { items } = req.body;
    await FirebaseRtdb.setUserWishlist(req.userId!, items || []);
    res.json({ success: true, items });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to save wishlist.' });
  }
});

app.get('/api/user/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const orders = await FirebaseRtdb.getUserOrders(req.userId!);
    res.json({ success: true, orders });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
});

app.get('/api/user/downloads', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const downloads = await FirebaseRtdb.getUserDownloads(req.userId!);
    const checked = await Promise.all(downloads.map(async (download: any) => {
      if (!download?.orderId || !download?.productId) return null;
      const order = await FirebaseRtdb.getGlobalOrder(download.orderId);
      return isPaidOrderForProduct(order, req.userId!, download.productId) ? download : null;
    }));
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json({ success: true, downloads: checked.filter(Boolean) });
  } catch {
    res.status(503).json({ success: false, message: 'Could not fetch downloads.' });
  }
});

app.get('/api/orders/:orderId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const order = await FirebaseRtdb.getUserOrderById(req.userId!, req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json({ success: true, order });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch order.' });
  }
});

app.get('/api/orders/:orderId/invoice', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const order = await FirebaseRtdb.getUserOrderById(req.userId!, req.params.orderId);
    if (!order) return res.status(404).send('Order not found.');
    const provider = String(order.paymentProvider || '').toLowerCase();
    if (!hasLivePayment(order) || String(order.paymentStatus).toUpperCase() !== 'PAID' ||
        (provider !== 'easebuzz' && provider !== 'paddle' && provider !== 'payu') || !order.transactionId) {
      return res.status(403).send('A verified paid order is required for an invoice.');
    }
    const invoice = await buildInvoicePdf(order);
    const invoiceNumber = String(order.invoiceNumber || `INV-${order.id}`)
      .replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.status(200).send(invoice);
  } catch {
    return res.status(503).send('Invoice is temporarily unavailable.');
  }
});

// Secure Order Creation with strict validation
const handleOrderCreation = async (req: AuthenticatedRequest, res: Response) => {
  const requestId = generateRequestId();
  try {
    const userId = req.userId!;
    const { items, customer, discountCode, paymentMethod } = req.body;
    const buyerProfile = await FirebaseRtdb.getUserProfile(userId);
    const buyerEmail = String(buyerProfile?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
      return res.status(400).json({ success: false, message: 'Add a valid email to your account before checkout.', requestId });
    }
    if (customer?.email && String(customer.email).trim().toLowerCase() !== buyerEmail) {
      return res.status(400).json({ success: false, message: 'Checkout email must match your account email.', requestId });
    }
    const methodStr = String(paymentMethod || '').toLowerCase();
    if ((methodStr.includes('easebuzz') || methodStr.includes('payu')) && customer?.country && String(customer.country).trim().toLowerCase() !== 'india') {
      return res.status(400).json({ success: false, message: 'Only India is supported for Easebuzz checkout.', requestId });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required.', requestId });
    }

    let calculatedSubtotal = 0;
    const validatedItems: any[] = [];
    let primaryProductId = '';
    let primaryProductName = '';

    const productList = await getProductCatalog();

    for (const ci of items) {
      const rawId = ci.productId || ci.product?.id || ci.id;
      const matchedProduct = productList.find((p: any) => p.id === rawId || p.slug === rawId);
      if (!matchedProduct) {
        return res.status(400).json({ success: false, message: `Unknown product ID: ${rawId}`, requestId });
      }

      const quantity = ci.quantity === undefined ? 1 : Number(ci.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        return res.status(400).json({ success: false, message: 'Invalid quantity (must be between 1 and 10).', requestId });
      }

      if (!primaryProductId) {
        primaryProductId = matchedProduct.id;
        primaryProductName = matchedProduct.title;
      }

      const serverPrice = matchedProduct.price;
      calculatedSubtotal += serverPrice * quantity;

      validatedItems.push({
        productId: matchedProduct.id,
        productTitle: matchedProduct.title,
        productSlug: matchedProduct.slug,
        productImage: matchedProduct.image,
        category: matchedProduct.categoryLabel || matchedProduct.category,
        productType: matchedProduct.productType || 'DOWNLOAD',
        price: serverPrice,
        quantity,
        downloadUrl: `/api/downloads/${matchedProduct.id}`,
        fileSize: matchedProduct.fileSize || '12.4 MB',
        version: matchedProduct.version || 'v1.2.0',
        fileFormat: matchedProduct.fileFormat || 'ZIP',
        downloadStatus: 'UNAVAILABLE',
        downloadLimit: 10,
        downloadCount: 0,
        product: matchedProduct,
      });
    }

    let calculatedDiscount = 0;
    if (discountCode) {
      const coupon = COUPONS.find((c) => c.code.toUpperCase() === String(discountCode).toUpperCase());
      if (coupon) {
        const nowMs = Date.now();
        const isActive = coupon.active !== false;
        const isNotExpired = !coupon.expiresAt || new Date(coupon.expiresAt).getTime() > nowMs;
        const meetsMinSpend = !coupon.minSpend || calculatedSubtotal >= coupon.minSpend;

        if (isActive && isNotExpired && meetsMinSpend) {
          calculatedDiscount = Math.round((calculatedSubtotal * coupon.discountPercent) / 100);
        }
      }
    }

    const calculatedTotal = Math.max(0, calculatedSubtotal - calculatedDiscount);
    if (!Number.isFinite(calculatedTotal) || calculatedTotal <= 0) {
      return res.status(400).json({ success: false, message: 'Order total must be a positive amount.', requestId });
    }
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(9).toString('hex').toUpperCase();
    const orderId = `BS-${todayStr}-${randomHex}`;
    const now = new Date().toISOString();

    const newOrder = {
      id: orderId,
      orderId,
      orderNumber: orderId,
      userId,
      date: now.split('T')[0],
      createdAt: now,
      updatedAt: now,
      customerEmail: buyerEmail,
      customerName: customer?.fullName || 'Customer',
      productId: primaryProductId,
      productNameSnapshot: primaryProductName,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      deliveryStatus: 'PENDING',
      downloadStatus: 'UNAVAILABLE',
      amount: calculatedTotal,
      currency: 'INR',
      customer: {
        fullName: customer?.fullName || 'Customer',
        email: buyerEmail,
        phone: customer?.phone || '',
        company: customer?.company || '',
        country: 'India',
      },
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discount: calculatedDiscount,
      discountCode: discountCode || '',
      tax: 0,
      total: calculatedTotal,
      paymentMethod: paymentMethod || 'Card / UPI Gateway',
      checkoutStartedAt: now,
      requestId,
    };

    await FirebaseRtdb.saveGlobalOrder(newOrder);

    await AuditLogger.log({
      requestId,
      userId,
      orderId,
      productId: primaryProductId,
      eventType: 'ORDER_CREATED',
      eventStatus: 'SUCCESS',
      source: 'API',
      metadata: { amount: calculatedTotal, currency: 'INR', itemsCount: validatedItems.length },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, order: newOrder, requestId });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to create order.', requestId });
  }
};

app.post('/api/orders/create', requireAuth, handleOrderCreation);
app.post('/api/user/orders', requireAuth, handleOrderCreation);

// ============================================
// EASEBUZZ PAYMENT GATEWAY (REAL)
// ============================================
app.post('/api/payments/easebuzz/initiate', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { orderId, agreeTerms } = req.body;
    const userId = req.userId!;

    if (!EASEBUZZ_KEY || !EASEBUZZ_SALT) {
      return res.status(503).json({ success: false, message: 'Easebuzz payment gateway is not configured yet.' });
    }

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' });
    }

    if (agreeTerms !== true) {
      return res.status(400).json({ success: false, message: 'You must accept the terms before starting payment.' });
    }

    const order = await FirebaseRtdb.getUserOrderById(userId, orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (String(order.customer?.country || '').trim().toLowerCase() !== 'india') {
      return res.status(400).json({ success: false, message: 'Only India is supported for this checkout.' });
    }

    if (String(order.paymentStatus).toUpperCase() === 'PAID' ||
        ['REFUNDED', 'REVOKED', 'CANCELLED'].includes(String(order.status).toUpperCase()) ||
        order.deliveryStatus === 'REVOKED') {
      return res.status(400).json({ success: false, message: 'This order cannot be paid again.' });
    }

    if (order.paymentInitiatedAt || order.easebuzzAccessKey || order.easebuzzTxnId || order.transactionId) {
      return res.status(409).json({
        success: false,
        message: 'Payment was already started for this order. Verify its status before starting a new checkout.',
      });
    }

    const rawPhone = order.customer?.phone || order.customerPhone || '';
    const phone = sanitizePhoneNumber(rawPhone);
    if (!phone || phone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number is required for payment.' });
    }

    const amountObj = formatEasebuzzAmount(order.total ?? order.amount ?? 0);
    if (!amountObj.valid) {
      return res.status(400).json({ success: false, message: 'Invalid order amount. Amount must be a positive number.' });
    }
    const amount = amountObj.formatted;

    const txnid = `${order.orderNumber || 'ORD'}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 35);
    
    const rawFirstname = order.customer?.fullName || order.customerName || 'Customer';
    const firstname = sanitizeFieldText(String(rawFirstname).trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, ''), 50, 'Customer');
    
    const email = String(order.customer?.email || order.customerEmail || req.userEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid customer email is required for payment.' });
    }
    const productinfo = 'BOOYAH STUDIO Products';
    const initiatedAt = new Date().toISOString();
    const buyerIp = getPaymentRequestIp(req);

    const baseAppUrl = getHostUrl(req);
    const surl = `${baseAppUrl}/api/payments/easebuzz/callback`;
    const furl = `${baseAppUrl}/api/payments/easebuzz/callback`;

    const { payload } = buildEasebuzzInitiatePayload({
      key: EASEBUZZ_KEY,
      salt: EASEBUZZ_SALT,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
      udf1: '',
      udf2: '',
      udf3: '',
      udf4: '',
      udf5: '',
      udf6: '',
      udf7: '',
    });

    const ebzResponse = await fetch(`${EASEBUZZ_BASE_URL}/payment/initiateLink`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: payload.toString()
    });

    const responseText = await ebzResponse.text();
    let ebzData: any = null;
    try {
      ebzData = JSON.parse(responseText);
    } catch {
      return res.status(502).json({ success: false, message: 'Invalid response from Easebuzz payment gateway.' });
    }

    if (ebzData && ebzData.status === 1 && ebzData.data) {
      order.customer = { ...order.customer, country: 'India' };
      order.paymentInitiatedAt = initiatedAt;
      order.paymentInitiationIp = buyerIp || null;
      order.termsAccepted = true;
      order.termsAcceptedAt = initiatedAt;
      order.termsAcceptedPolicies = ['terms', 'refund', 'privacy', 'cancellation', 'delivery'];
      order.termsDocumentUrl = `${baseAppUrl}/terms`;
      order.paymentProvider = 'Easebuzz';
      order.paymentEnvironment = EASEBUZZ_ENV === 'prod' ? 'live' : 'test';
      order.easebuzzMerchantKey = EASEBUZZ_KEY;
      order.easebuzzProductInfo = productinfo;
      order.transactionId = txnid;
      order.easebuzzTxnId = txnid;
      order.easebuzzAccessKey = ebzData.data;
      order.status = 'PENDING_PAYMENT';
      order.paymentStatus = 'PENDING';
      await FirebaseRtdb.saveGlobalOrder(order);
      return res.json({
        success: true,
        accessKey: ebzData.data,
        merchantKey: EASEBUZZ_KEY,
        environment: EASEBUZZ_ENV,
        orderId: order.id,
        txnid,
      });
    } else {
      let rawMsg = typeof ebzData?.data === 'string'
        ? ebzData.data
        : (ebzData?.error_desc || ebzData?.message || 'Failed to initiate Easebuzz payment.');
      if (EASEBUZZ_KEY) rawMsg = rawMsg.replaceAll(EASEBUZZ_KEY, '[KEY]');
      if (EASEBUZZ_SALT) rawMsg = rawMsg.replaceAll(EASEBUZZ_SALT, '[SALT]');
      console.error('[Easebuzz Gateway Error]:', typeof ebzData === 'object' ? { status: ebzData?.status, error: rawMsg } : ebzData);
      return res.status(400).json({ success: false, message: rawMsg });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Easebuzz payment initiation failed.' });
  }
});

const fulfillPaidOrder = async (order: any): Promise<void> => {
  if (String(order.paymentStatus).toUpperCase() !== 'PAID' || !order.userId ||
      !Array.isArray(order.items) || !order.items.length ||
      ['REFUNDED', 'REVOKED', 'CANCELLED'].includes(String(order.status).toUpperCase()) ||
      order.deliveryStatus === 'REVOKED') return;

  if (!hasLivePayment(order)) {
    order.deliveryStatus = 'TEST_ONLY';
    order.downloadStatus = 'UNAVAILABLE';
    order.fulfillmentStatus = 'TEST_ONLY';
    order.items = order.items.map((item: any) => ({ ...item, downloadStatus: 'UNAVAILABLE' }));
    delete order.invoiceNumber;
    await FirebaseRtdb.saveGlobalOrder(order);
    return;
  }
  const purchases = await FirebaseRtdb.getUserPurchases(order.userId);
  const downloads = await FirebaseRtdb.getUserDownloads(order.userId);
  const now = new Date().toISOString();
  for (const item of order.items) {
    const purchaseId = `pur_${order.id}_${item.productId}`;
    const downloadId = `dl_${order.id}_${item.productId}`;
    if (!purchases.some((purchase: any) => purchase.purchaseId === purchaseId && purchase.accessStatus === 'active')) {
      await FirebaseRtdb.savePurchase(order.userId, purchaseId, {
        purchaseId, userId: order.userId, orderId: order.id,
        productId: item.productId, productTitle: item.productTitle,
        purchasedAt: order.paymentVerifiedAt || now, deliveredAt: now,
        invoiceNumber: order.invoiceNumber,
        accessStatus: 'active', downloadLimit: 10, downloadCount: 0,
      });
    }
    if (!downloads.some((download: any) => download.downloadId === downloadId)) {
      await FirebaseRtdb.saveUserDownload(order.userId, downloadId, {
        id: downloadId, downloadId, orderId: order.id,
        productId: item.productId, productTitle: item.productTitle,
        status: 'AVAILABLE', createdAt: now, deliveredAt: now,
        downloadUrl: item.downloadUrl, fileSize: item.fileSize, fileFormat: item.fileFormat,
      });
    }
  }

  order.fulfillmentStatus = 'READY';
  order.fulfilledAt = order.fulfilledAt || now;
  order.deliveredAt = order.deliveredAt || now;
  order.deliveryStatus = 'DELIVERED';
  order.downloadStatus = 'AVAILABLE';
  order.items = order.items.map((item: any) => ({ ...item, downloadStatus: 'AVAILABLE' }));
  await FirebaseRtdb.saveGlobalOrder(order);
};

const createPurchaseEmailLinks = async (order: any): Promise<PurchaseEmailLink[]> => {
  if (!hasLivePayment(order)) throw new Error('Live payment required.');
  const createdAt = Date.now();
  const expiresAt = createdAt + getPurchaseEmailLinkTtlMs();
  const links: PurchaseEmailLink[] = [];
  const linkedProductIds = new Set<string>();

  for (const item of order.items || []) {
    if (!item.productId || linkedProductIds.has(item.productId)) continue;
    linkedProductIds.add(item.productId);

    const rawToken = createEmailDownloadToken();
    const tokenHash = hashEmailDownloadToken(rawToken);
    const purchaseId = `pur_${order.id}_${item.productId}`;

    await FirebaseRtdb.set(`emailDownloadTokens/${tokenHash}`, {
      tokenHash,
      userId: order.userId,
      orderId: order.id,
      purchaseId,
      productId: item.productId,
      productTitle: item.productTitle || item.productId || 'Digital Product',
      createdAt,
      expiresAt,
      used: false,
    });

    links.push({
      productId: item.productId,
      productTitle: item.productTitle || item.productId || 'Digital Product',
      downloadUrl: buildEmailDownloadUrl(rawToken),
      expiresAt,
    });
  }

  return links;
};

const createPurchaseInvoiceLink = async (order: any): Promise<string> => {
  if (!hasLivePayment(order)) throw new Error('Live payment required.');
  const rawToken = createEmailDownloadToken();
  const tokenHash = hashEmailDownloadToken(rawToken);
  const createdAt = Date.now();

  await FirebaseRtdb.set(`invoiceDownloadTokens/${tokenHash}`, {
    tokenHash,
    userId: order.userId,
    orderId: order.id,
    createdAt,
    expiresAt: createdAt + getPurchaseEmailLinkTtlMs(),
    downloadCount: 0,
    downloadLimit: 10,
  });

  return buildInvoiceDownloadUrl(rawToken);
};

const sendPurchaseEmailSafely = async (order: any): Promise<void> => {
  if (order.emailDelivery?.status === 'sent') return;
  if (hasLivePayment(order) && (order.deliveryStatus !== 'DELIVERED' || !order.fulfilledAt)) return;
  if (order.paymentStatus !== 'PAID') return;

  const attemptedAt = new Date().toISOString();
  const previousAttempts = Number(order.emailDelivery?.attempts || 0);

  try {
    if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
      order.emailDelivery = {
        status: 'not_configured',
        attempts: previousAttempts,
        lastAttemptAt: attemptedAt,
        message: 'Resend is not configured.',
      };
      await FirebaseRtdb.saveGlobalOrder(order);
      return;
    }

    if (!String(order.customer?.email || order.customerEmail || '').trim()) {
      order.emailDelivery = {
        status: 'failed',
        attempts: previousAttempts,
        lastAttemptAt: attemptedAt,
        message: 'The order does not contain a customer email address.',
      };
      await FirebaseRtdb.saveGlobalOrder(order);
      return;
    }

    const result = hasLivePayment(order)
      ? await sendPurchaseConfirmationEmail(order, await createPurchaseEmailLinks(order), { invoiceUrl: await createPurchaseInvoiceLink(order) })
      : await sendTestPaymentEmail(order);
    order.emailDelivery = {
      status: result.status,
      attempts: previousAttempts + 1,
      lastAttemptAt: attemptedAt,
      ...(result.status === 'sent' ? { sentAt: attemptedAt, emailId: result.emailId } : {}),
      ...(result.reason ? { message: result.reason.slice(0, 240) } : {}),
    };
    await FirebaseRtdb.saveGlobalOrder(order);
  } catch (error: any) {
    // Payment and entitlement delivery must remain successful even if the
    // transactional email provider is temporarily unavailable.
    order.emailDelivery = {
      status: 'failed',
      attempts: previousAttempts + 1,
      lastAttemptAt: attemptedAt,
      message: String(error?.message || 'Purchase email delivery failed.').slice(0, 240),
    };
    try {
      await FirebaseRtdb.saveGlobalOrder(order);
    } catch {
      // The payment callback must not be converted into a failure here.
    }
  }
};

type PaymentSyncResult = { success: boolean; status?: string; message?: string; orderId?: string; retryable?: boolean };

// A signed callback, signed webhook, and gateway lookup all complete the
// same order through this path. The latest Firebase copy decides whether
// fulfillment is new or a retry of an already paid order.
async function completeVerifiedEasebuzzOrder(
  orderId: string,
  easebuzzId: string,
  source: string,
): Promise<PaymentSyncResult> {
  const order = await FirebaseRtdb.getGlobalOrder(orderId);
  if (!order) return { success: false, message: 'Order not found.' };
  if (['REFUNDED', 'REVOKED', 'CANCELLED'].includes(String(order.status).toUpperCase()) ||
      order.deliveryStatus === 'REVOKED') {
    return { success: false, status: 'REVOKED', orderId, message: 'Order access has been revoked.' };
  }

  if (String(order.paymentStatus).toUpperCase() === 'PAID') {
    if (order.paymentProvider !== 'Easebuzz' || !order.transactionId) {
      return { success: false, status: 'PENDING', orderId, message: 'Payment must be verified with Easebuzz.' };
    }
    const needsInvoiceMetadata = !order.invoiceNumber || !order.paymentVerifiedAt;
    order.invoiceNumber ||= `INV-${order.id}`;
    order.paymentVerifiedAt ||= order.updatedAt || new Date().toISOString();
    if (needsInvoiceMetadata) await FirebaseRtdb.saveGlobalOrder(order);
  } else {
    const now = new Date().toISOString();
    order.status = 'PAID';
    order.paymentStatus = 'PAID';
    order.orderStatus = 'PAID';
    order.deliveryStatus = 'PENDING';
    order.downloadStatus = 'UNAVAILABLE';
    order.paymentVerifiedAt = now;
    order.invoiceNumber ||= `INV-${order.id}`;
    order.transactionId = easebuzzId;
    order.paymentId = easebuzzId;
    order.paymentProvider = 'Easebuzz';
    order.updatedAt = now;
    await FirebaseRtdb.saveGlobalOrder(order);
    try {
      await AuditLogger.log({
        requestId: generateRequestId(), userId: order.userId, orderId: order.id,
        eventType: 'PAYMENT_VERIFICATION_SUCCESS', eventStatus: 'SUCCESS', source,
        metadata: { easebuzzId, amount: Number(order.total).toFixed(2) },
      });
    } catch (error) {
      console.error('Payment audit log needs repair:', order.id, error);
    }
  }

  try {
    await fulfillPaidOrder(order);
    await sendPurchaseEmailSafely(order);
  } catch (error) {
    console.error('Paid order fulfillment needs retry:', order.id, error);
  }
  return { success: true, status: 'PAID', orderId: order.id,
    message: order.deliveryStatus === 'DELIVERED' ? 'Payment confirmed.' : 'Payment confirmed. Delivery is still being prepared.' };
}

// Automatic fallback when no signed callback or webhook reaches the server.
async function verifyAndSyncEasebuzzOrder(
  orderIdOrTxnId: string,
  source = 'EASEBUZZ_RECONCILE',
): Promise<PaymentSyncResult> {
  if (!EASEBUZZ_KEY || !EASEBUZZ_SALT) {
    return { success: false, message: 'Easebuzz payment gateway is not configured yet.' };
  }

  const globalOrder = await FirebaseRtdb.getGlobalOrder(orderIdOrTxnId);
  if (!globalOrder) {
    return { success: false, message: 'Order not found' };
  }

  if (['REFUNDED', 'REVOKED', 'CANCELLED'].includes(String(globalOrder.status).toUpperCase()) ||
      globalOrder.deliveryStatus === 'REVOKED') {
    return { success: false, status: 'REVOKED', orderId: globalOrder.id, message: 'Order access has been revoked.' };
  }

  if (String(globalOrder.paymentStatus).toUpperCase() === 'PAID') {
    return completeVerifiedEasebuzzOrder(globalOrder.id, globalOrder.transactionId, source);
  }

  if (globalOrder.paymentProvider !== 'Easebuzz' || globalOrder.paymentEnvironment !== (EASEBUZZ_ENV === 'prod' ? 'live' : 'test')) return { success: false, status: 'PENDING', message: 'The original payment environment is not configured.' };

  // Initiation stores the gateway txnid on the pending order. It can differ
  // from the customer-facing order number.
  const txnid = globalOrder.easebuzzTxnId || globalOrder.transactionId || globalOrder.orderNumber || globalOrder.id;
  const transHash = easebuzzRetrieveHash(EASEBUZZ_KEY, txnid, EASEBUZZ_SALT);

  const transFormData = new URLSearchParams();
  transFormData.append('key', EASEBUZZ_KEY);
  transFormData.append('txnid', txnid);
  transFormData.append('hash', transHash);

  let verifyRes: globalThis.Response;
  try {
    verifyRes = await fetch(`${EASEBUZZ_DASHBOARD_URL}/transaction/v2/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: transFormData.toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { success: false, status: 'PENDING', orderId: globalOrder.id, retryable: true, message: 'Payment gateway verification is unavailable. Please retry.' };
  }

  if (!verifyRes.ok) {
    return { success: false, status: 'PENDING', orderId: globalOrder.id, retryable: true, message: 'Payment gateway verification is unavailable. Please retry.' };
  }
  let verifyData: any;
  try {
    verifyData = await verifyRes.json();
  } catch {
    return { success: false, status: 'PENDING', orderId: globalOrder.id, retryable: true, message: 'Payment gateway response could not be verified. Please retry.' };
  }
  const payment = verifyData?.data;
  if (Number(verifyData?.status) !== 1 || !matchesEasebuzzPaymentIdentity(payment, globalOrder, EASEBUZZ_KEY)) {
    return { success: false, status: 'PENDING', orderId: globalOrder.id, message: 'Payment has not been verified for this order.' };
  }
  const gatewayStatus = String(payment.status || '').toLowerCase();
  if (['failure', 'failed', 'usercancelled', 'cancelled'].includes(gatewayStatus)) {
    // A callback can race with a successful webhook. Never report failure
    // after a different handler has already stored a verified paid order.
    const latestOrder = await FirebaseRtdb.getGlobalOrder(globalOrder.id);
    if (latestOrder?.paymentStatus === 'PAID' && latestOrder.paymentProvider === 'Easebuzz' && latestOrder.transactionId) {
      return verifyAndSyncEasebuzzOrder(globalOrder.id, source);
    }
    return { success: false, status: 'FAILED', orderId: globalOrder.id, message: 'Easebuzz reported that this payment failed.' };
  }
  if (!matchesVerifiedEasebuzzPayment(payment, globalOrder, EASEBUZZ_KEY)) {
    return { success: false, status: 'PENDING', orderId: globalOrder.id, message: 'Payment is still pending at Easebuzz.' };
  }
  return completeVerifiedEasebuzzOrder(globalOrder.id, payment.easepayid || payment.easebuzz_id || payment.transaction_id || txnid, source);
}

const notificationMatchesOrder = (params: any, order: any): boolean =>
  Boolean(order && order.paymentEnvironment === (EASEBUZZ_ENV === 'prod' ? 'live' : 'test') && params.key === EASEBUZZ_KEY && params.txnid === order.easebuzzTxnId &&
    Number.isFinite(Number(params.amount)) && Number.isFinite(Number(order.total)) &&
    Math.round(Number(params.amount) * 100) === Math.round(Number(order.total) * 100) &&
    String(params.email || '').trim().toLowerCase() ===
      String(order.customer?.email || order.customerEmail || '').trim().toLowerCase() &&
    (!order.easebuzzProductInfo || params.productinfo === order.easebuzzProductInfo));

const isFailedEasebuzzStatus = (status: unknown): boolean =>
  ['failure', 'failed', 'usercancelled', 'cancelled'].includes(String(status || '').toLowerCase());

async function processSignedEasebuzzNotification(
  params: any,
  order: any,
  source: 'EASEBUZZ_CALLBACK' | 'EASEBUZZ_WEBHOOK' | 'EASEBUZZ_POPUP',
): Promise<PaymentSyncResult> {
  if (String(params.status).toLowerCase() === 'success') {
    return completeVerifiedEasebuzzOrder(
      // The reverse hash authenticates txnid, but not easepayid. Do not store
      // an unsigned gateway receipt field as the payment identity.
      order.id, params.txnid, source,
    );
  }
  if (isFailedEasebuzzStatus(params.status)) {
    const latest = await FirebaseRtdb.getGlobalOrder(order.id);
    if (latest?.paymentStatus === 'PAID' && latest.paymentProvider === 'Easebuzz' && latest.transactionId) {
      return completeVerifiedEasebuzzOrder(order.id, latest.transactionId, source);
    }
    return { success: false, status: 'FAILED', orderId: order.id, message: 'Easebuzz reported that this payment failed.' };
  }
  return verifyAndSyncEasebuzzOrder(order.id, source);
}

const recordPaymentNotification = async (req: Request, order: any, source: 'EASEBUZZ_CALLBACK' | 'EASEBUZZ_WEBHOOK' | 'EASEBUZZ_POPUP') => {
  try {
    await AuditLogger.log({
      requestId: generateRequestId(), userId: order.userId, orderId: order.id,
      eventType: source === 'EASEBUZZ_WEBHOOK' ? 'WEBHOOK_RECEIVED' : 'EASEBUZZ_CALLBACK_RECEIVED',
      eventStatus: 'PENDING', source,
      metadata: { txnid: req.body.txnid, gatewayStatus: String(req.body.status || '').slice(0, 40) },
      ip: getPaymentRequestIp(req), userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error('Payment notification audit could not be saved:', order.id, error);
  }
};

// The popup can return signed fields without a browser POST to surl/furl.
// Accept those fields from the owning buyer and keep automatic lookup as backup.
app.post('/api/payments/easebuzz/popup-response', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!EASEBUZZ_KEY || !EASEBUZZ_SALT) {
      return res.status(503).json({ success: false, status: 'PENDING' });
    }
    const params = req.body;
    if (!params || typeof params.txnid !== 'string' || typeof params.status !== 'string' ||
        !verifyEasebuzzCallbackHash(params, EASEBUZZ_SALT)) {
      return res.status(400).json({ success: false, status: 'PENDING' });
    }
    const order = await FirebaseRtdb.getGlobalOrder(params.txnid);
    if (!order || order.userId !== req.userId || !notificationMatchesOrder(params, order)) {
      return res.status(400).json({ success: false, status: 'PENDING' });
    }
    await recordPaymentNotification(req, order, 'EASEBUZZ_POPUP');
    const result = await processSignedEasebuzzNotification(params, order, 'EASEBUZZ_POPUP');
    return res.status(result.retryable ? 503 : 200).json({ success: result.success, status: result.status || 'PENDING' });
  } catch (error) {
    console.error('Easebuzz popup response processing failed:', error);
    return res.status(503).json({ success: false, status: 'PENDING' });
  }
});

app.post('/api/payments/easebuzz/callback', async (req: Request, res: Response) => {
  let verifiedOrderId: string | undefined;
  try {
    if (!EASEBUZZ_KEY || !EASEBUZZ_SALT) {
      return res.status(503).send('Easebuzz payment gateway is not configured yet.');
    }

    const params = req.body;
    if (!params || typeof params.txnid !== 'string' || typeof params.status !== 'string' ||
        !verifyEasebuzzCallbackHash(params, EASEBUZZ_SALT)) {
      return res.status(400).send('Invalid signature');
    }

    const txnid = params.txnid;
    const globalOrder = await FirebaseRtdb.getGlobalOrder(txnid);
    if (!notificationMatchesOrder(params, globalOrder)) {
      return res.status(400).send('Payment notification does not match an order');
    }
    verifiedOrderId = globalOrder.id;

    const baseAppUrl = getHostUrl(req);
    await recordPaymentNotification(req, globalOrder, 'EASEBUZZ_CALLBACK');
    const syncResult = await processSignedEasebuzzNotification(params, globalOrder, 'EASEBUZZ_CALLBACK');
    if (syncResult.success) {
      return res.redirect(`${baseAppUrl}/checkout?status=success&orderId=${globalOrder.id}`);
    }
    if (syncResult.status === 'FAILED') {
      return res.redirect(`${baseAppUrl}/checkout?status=failed&orderId=${globalOrder.id}`);
    }
    return res.redirect(`${baseAppUrl}/checkout?status=pending&orderId=${globalOrder.id}`);
  } catch (err: any) {
    console.error('Easebuzz callback processing failed:', err);
    if (verifiedOrderId) {
      return res.redirect(`${getHostUrl(req)}/checkout?status=pending&orderId=${encodeURIComponent(verifiedOrderId)}`);
    }
    return res.status(503).send('Payment callback could not be processed.');
  }
});

// Optional gateway notification. The browser callback and authenticated
// reconciliation paths remain independent safety nets.
app.post('/api/payments/easebuzz/webhook', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (!EASEBUZZ_KEY || !EASEBUZZ_SALT) {
      return res.status(503).json({ success: false, message: 'Payment gateway is not configured.' });
    }

    const params = req.body;
    if (!params || typeof params !== 'object' ||
        typeof params.txnid !== 'string' || typeof params.key !== 'string' ||
        params.key !== EASEBUZZ_KEY || !verifyEasebuzzCallbackHash(params, EASEBUZZ_SALT)) {
      return res.status(400).json({ success: false, message: 'Invalid payment notification.' });
    }

    const order = await FirebaseRtdb.getGlobalOrder(params.txnid);
    if (!notificationMatchesOrder(params, order)) {
      return res.status(400).json({ success: false, message: 'Payment notification does not match an order.' });
    }

    await recordPaymentNotification(req, order, 'EASEBUZZ_WEBHOOK');
    const result = await processSignedEasebuzzNotification(params, order, 'EASEBUZZ_WEBHOOK');
    if (result.retryable) {
      return res.status(503).json({ success: false, status: 'PENDING' });
    }
    return res.json({ success: true, status: result.status || 'PENDING' });
  } catch (error) {
    console.error('Easebuzz webhook processing failed:', error);
    return res.status(503).json({ success: false, message: 'Payment notification could not be processed.' });
  }
});

// Reconcile Safety Net endpoint (Admin, owning user, or CRON_SECRET header)
app.post('/api/payments/easebuzz/reconcile/:orderId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const cronHeader = req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    const isCron = cronHeader && CRON_SECRET && cronHeader === CRON_SECRET;

    if (!isCron) {
      const sid = req.cookies?.sid;
      if (!sid) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      const payload = await AuthServiceServer.verifyOpaqueSession(sid);
      if (!payload || !payload.userId) {
        return res.status(401).json({ success: false, message: 'Invalid session.' });
      }
      const order = await FirebaseRtdb.getGlobalOrder(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
      const profile = await FirebaseRtdb.getUserProfile(payload.userId);
      const isAdmin = profile && profile.role === 'admin';
      if (!isAdmin && order.userId !== payload.userId) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const result = await verifyAndSyncEasebuzzOrder(orderId);
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json(result);
  } catch {
    res.status(500).json({ success: false, message: 'Reconciliation failed.' });
  }
});

// Vercel Cron invokes GET with Authorization: Bearer <CRON_SECRET>.
const reconcileCron = async (req: Request, res: Response) => {
  try {
    const cronHeader = req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!CRON_SECRET || cronHeader !== CRON_SECRET) {
      return res.status(403).json({ success: false, message: 'Unauthorized cron request.' });
    }

    const allOrders = await FirebaseRtdb.getAllGlobalOrders();
    const tenMinsAgo = Date.now() - 10 * 60 * 1000;
    const reconciliationOrders = allOrders.filter((order) => {
      const paymentStatus = String(order.paymentStatus).toUpperCase();
      const isStuckPayment = Boolean(order.easebuzzTxnId || order.payuTxnId) && (
        order.status === 'PENDING_PAYMENT' || paymentStatus === 'PENDING'
      ) && new Date(order.updatedAt || order.createdAt || order.date || 0).getTime() < tenMinsAgo;
      const lastEmailAttempt = new Date(order.emailDelivery?.lastAttemptAt || 0).getTime();
      const needsEmailRetry = (
        paymentStatus === 'PAID' &&
        (order.emailDelivery?.status !== 'sent' || (hasLivePayment(order) && (!order.fulfilledAt || !order.deliveredAt))) &&
        lastEmailAttempt < tenMinsAgo
      );
      return isStuckPayment || needsEmailRetry;
    }).slice(0, 20);

    const results = [];
    for (const ord of reconciliationOrders) {
      const resSync = ord.paymentProvider === 'PayU' ? await syncPayUOrder(ord.id) : ord.paymentProvider === 'Paddle' && ord.paymentStatus === 'PAID' ? await completeVerifiedPaddleOrder(ord.id, ord.transactionId, ord.paddleCustomerId, 'EMAIL_RETRY') : await verifyAndSyncEasebuzzOrder(ord.id);
      results.push({ orderId: ord.id, ...resSync });
    }

    res.json({ success: true, reconciledCount: results.length, results });
  } catch {
    res.status(500).json({ success: false, message: 'Cron reconciliation failed.' });
  }
};
// ============================================
// PADDLE PAYMENT GATEWAY (OVERLAY CHECKOUT & WEBHOOKS)
// ============================================

async function completeVerifiedPaddleOrder(
  orderId: string,
  paddleTransactionId: string,
  paddleCustomerId?: string,
  source: string = 'PADDLE_WEBHOOK',
  paddleData?: any
): Promise<PaymentSyncResult> {
  const order = await FirebaseRtdb.getGlobalOrder(orderId);
  if (!order) return { success: false, message: 'Order not found.' };
  if (['REFUNDED', 'REVOKED', 'CANCELLED'].includes(String(order.status).toUpperCase()) ||
      order.deliveryStatus === 'REVOKED') {
    return { success: false, status: 'REVOKED', orderId, message: 'Order access has been revoked.' };
  }

  if (order.paymentProvider !== 'Paddle') return { success: false, status: 'PENDING', message: 'Order belongs to a different payment provider.' };
  if (order.paymentStatus !== 'PAID') {
    const environment = getPaddleEnvironment() === 'production' ? 'live' : 'test';
    const total = paddleData?.details?.totals?.total;
    const currency = paddleData?.currency_code || paddleData?.details?.totals?.currency_code;
    if (order.paymentEnvironment !== environment || !paddleData || paddleData.id !== paddleTransactionId ||
        !['paid','completed'].includes(paddleData.status) || paddleData.custom_data?.orderId !== order.id ||
        paddleData.custom_data?.userId !== order.userId || currency !== 'INR' ||
        !/^\d+$/.test(String(total)) || Number(total) !== Math.round(Number(order.total) * 100)) {
      return { success: false, status: 'PENDING', message: 'Paddle payment identity, environment or amount did not match this order.' };
    }
  }

  const now = new Date().toISOString();
  if (String(order.paymentStatus).toUpperCase() === 'PAID') {
    const provider = String(order.paymentProvider || '').toLowerCase();
    if (provider !== 'paddle' && provider !== 'easebuzz') {
      return { success: false, status: 'PENDING', orderId, message: 'Payment must be verified.' };
    }
    const needsInvoiceMetadata = !order.invoiceNumber || !order.paymentVerifiedAt;
    order.invoiceNumber ||= `INV-${order.id}`;
    order.paymentVerifiedAt ||= order.updatedAt || now;
    if (needsInvoiceMetadata) await FirebaseRtdb.saveGlobalOrder(order);
  } else {
    order.status = 'PAID';
    order.paymentStatus = 'PAID';
    order.orderStatus = 'PAID';
    order.deliveryStatus = 'PENDING';
    order.downloadStatus = 'UNAVAILABLE';
    order.paymentVerifiedAt = now;
    order.paidAt = now;
    order.invoiceNumber ||= `INV-${order.id}`;
    order.transactionId = paddleTransactionId;
    order.paddleTransactionId = paddleTransactionId;
    if (paddleCustomerId) {
      order.paddleCustomerId = paddleCustomerId;
    }
    order.paymentId = paddleTransactionId;
    order.paymentProvider = 'Paddle';
    order.updatedAt = now;
    if (paddleData?.details?.totals?.currency_code) {
      order.paddleCurrency = paddleData.details.totals.currency_code;
    }
    await FirebaseRtdb.saveGlobalOrder(order);

    try {
      await AuditLogger.log({
        requestId: generateRequestId(),
        userId: order.userId,
        orderId: order.id,
        productId: order.productId,
        eventType: 'ORDER_PAYMENT_VERIFIED',
        eventStatus: 'SUCCESS',
        source,
        metadata: {
          paddleTransactionId,
          paddleCustomerId,
          amount: Number(order.total).toFixed(2),
        },
      });
    } catch (error) {
      console.error('Paddle payment audit log error:', order.id, error);
    }
  }

  try {
    await fulfillPaidOrder(order);
    await AuditLogger.log({
      requestId: generateRequestId(),
      userId: order.userId,
      orderId: order.id,
      productId: order.productId,
      eventType: 'PRODUCT_ACCESS_GRANTED',
      eventStatus: 'SUCCESS',
      source,
      metadata: { orderId: order.id },
    });
    await sendPurchaseEmailSafely(order);
  } catch (error) {
    console.error('Paid order fulfillment needs retry:', order.id, error);
  }

  return {
    success: true,
    status: 'PAID',
    orderId: order.id,
    message: order.deliveryStatus === 'DELIVERED'
      ? 'Payment confirmed.'
      : 'Payment confirmed. Delivery is still being prepared.',
  };
}

// Client-safe configuration endpoint (environment, clientToken, price mapping)
app.get('/api/config/payments', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  let payu; try { payu = getPayUConfig(); } catch { payu = null; }
  res.json({ success: true, gateways: {
    easebuzz: { configured: Boolean(EASEBUZZ_KEY && EASEBUZZ_SALT), environment: EASEBUZZ_ENV === 'prod' ? 'live' : 'test' },
    payu: { configured: Boolean(payu?.key && payu?.salt), environment: payu?.environment || 'test' },
    paddle: { configured: Boolean(getPaddleClientToken() && getPaddleWebhookSecret()), environment: getPaddleEnvironment() === 'production' ? 'live' : 'test' },
  }});
});

app.get('/api/config/paddle', (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const config = getClientPaddleConfig();
  res.json({ success: true, ...config });
});

app.post('/api/payments/paddle/initiate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId, agreeTerms } = req.body;
    const userId = req.userId!;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' });
    }

    if (agreeTerms !== true) {
      return res.status(400).json({ success: false, message: 'You must accept the terms before starting payment.' });
    }

    const order = await FirebaseRtdb.getUserOrderById(userId, orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (String(order.paymentStatus).toUpperCase() === 'PAID' ||
        ['REFUNDED', 'REVOKED', 'CANCELLED'].includes(String(order.status).toUpperCase()) ||
        order.deliveryStatus === 'REVOKED') {
      return res.status(400).json({ success: false, message: 'This order cannot be paid again.' });
    }

    if (order.paymentInitiatedAt || order.transactionId) return res.status(409).json({ success: false, message: 'This order already has a payment attempt.' });

    if (order.items?.length !== 1 || Number(order.items[0].quantity || 1) !== 1 || Number(order.discount || 0) !== 0) {
      return res.status(400).json({ success: false, message: 'Use Easebuzz or PayU for multi-item or discounted orders.' });
    }
    const clientToken = getPaddleClientToken();
    const environment = getPaddleEnvironment();

    const primaryProductId = order.productId || (order.items && order.items[0]?.productId);
    const paddlePriceId = getPaddlePriceIdForProduct(primaryProductId);

    if (!paddlePriceId) {
      return res.status(400).json({
        success: false,
        message: `Paddle Price ID is not configured for product "${primaryProductId}". Please configure PADDLE_PRICE_${primaryProductId.toUpperCase().replace(/[^A-Z0-9]/g, '_')} in environment variables.`,
      });
    }

    const initiatedAt = new Date().toISOString();
    const baseAppUrl = getHostUrl(req);

    order.paymentInitiatedAt = initiatedAt;
    order.termsAccepted = true;
    order.termsAcceptedAt = initiatedAt;
    order.termsAcceptedPolicies = ['terms', 'refund', 'privacy', 'cancellation', 'delivery'];
    order.termsDocumentUrl = `${baseAppUrl}/terms`;
    order.paymentEnvironment = environment === 'production' ? 'live' : 'test';
    order.paymentProvider = 'Paddle';
    order.status = 'PENDING_PAYMENT';
    order.paymentStatus = 'PENDING';
    await FirebaseRtdb.saveGlobalOrder(order);

    await AuditLogger.log({
      requestId: generateRequestId(),
      userId: order.userId,
      orderId: order.id,
      productId: primaryProductId,
      eventType: 'CHECKOUT_STARTED',
      eventStatus: 'SUCCESS',
      source: 'PADDLE_CHECKOUT',
      metadata: { paddlePriceId, environment },
      ip: getPaymentRequestIp(req),
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      success: true,
      priceId: paddlePriceId,
      orderId: order.id,
      orderNumber: order.orderNumber || order.id,
      customerEmail: order.customer?.email || order.customerEmail || req.userEmail || '',
      customerName: order.customer?.fullName || order.customerName || 'Customer',
      clientToken,
      environment,
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Paddle payment initiation failed.' });
  }
});

const handlePaddleWebhook = async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const requestId = generateRequestId();

  try {
    const rawBody: Buffer | string | undefined = (req as any).rawBody || (typeof req.body === 'string' ? req.body : Buffer.from(JSON.stringify(req.body)));
    const signatureHeader = (req.headers['paddle-signature'] || req.headers['Paddle-Signature']) as string | undefined;
    const webhookSecret = getPaddleWebhookSecret();

    if (!webhookSecret) {
      console.error('[Paddle Webhook Error]: PADDLE_WEBHOOK_SECRET is not configured.');
      return res.status(503).json({ success: false, message: 'Paddle webhook secret is not configured.' });
    }

    const verification = verifyPaddleWebhookSignature(rawBody, signatureHeader, webhookSecret);
    if (!verification.isValid) {
      await AuditLogger.log({
        requestId,
        userId: 'system',
        eventType: 'PADDLE_WEBHOOK_REJECTED',
        eventStatus: 'FAILED',
        source: 'PADDLE_WEBHOOK',
        metadata: { reason: verification.reason },
        ip: getPaymentRequestIp(req),
      });
      return res.status(400).json({ success: false, message: `Invalid Paddle webhook signature: ${verification.reason || 'Verification failed'}` });
    }

    let eventPayload: any;
    try {
      eventPayload = typeof req.body === 'object' && !Buffer.isBuffer(req.body)
        ? req.body
        : JSON.parse((rawBody as Buffer | string).toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, message: 'Malformed webhook JSON payload.' });
    }

    const eventId = eventPayload.event_id || eventPayload.id;
    const eventType = eventPayload.event_type || eventPayload.type;
    const eventData = eventPayload.data;

    if (!eventId || !eventType || !eventData) {
      return res.status(400).json({ success: false, message: 'Incomplete Paddle webhook event structure.' });
    }

    await AuditLogger.log({
      requestId,
      userId: eventData?.custom_data?.userId || 'system',
      eventType: 'PADDLE_WEBHOOK_RECEIVED',
      eventStatus: 'PENDING',
      source: 'PADDLE_WEBHOOK',
      metadata: { eventId, eventType, transactionId: eventData.id },
      ip: getPaymentRequestIp(req),
    });

    // Idempotency: check if event was already processed
    const existingEvent = await FirebaseRtdb.getPaymentEvent(eventId);
    if (existingEvent) {
      await AuditLogger.log({
        requestId,
        userId: eventData?.custom_data?.userId || 'system',
        eventType: 'PADDLE_WEBHOOK_DUPLICATE',
        eventStatus: 'SUCCESS',
        source: 'PADDLE_WEBHOOK',
        metadata: { eventId, eventType },
      });
      return res.status(200).json({ success: true, message: 'Event already processed.' });
    }

    // Save event for idempotency
    await FirebaseRtdb.savePaymentEvent(eventId, {
      eventId,
      eventType,
      receivedAt: new Date().toISOString(),
      transactionId: eventData.id,
      status: 'PROCESSED',
    });

    // Handle completed transactions
    if (eventType === 'transaction.completed' || eventType === 'transaction.paid') {
      const transactionId = eventData.id;
      const customData = eventData.custom_data || {};
      const customerId = eventData.customer_id;
      let orderId = customData.orderId;

      if (!orderId) {
        const matched = await FirebaseRtdb.getGlobalOrder(transactionId);
        if (matched) orderId = matched.id;
      }

      if (!orderId && customData.userId && customData.productId) {
        const userOrders = await FirebaseRtdb.getUserOrders(customData.userId);
        const candidate = userOrders.find((o: any) =>
          o.productId === customData.productId &&
          ['PENDING', 'PENDING_PAYMENT'].includes(String(o.paymentStatus).toUpperCase())
        );
        if (candidate) orderId = candidate.id;
      }

      if (!orderId) {
        console.warn('[Paddle Webhook] Transaction completed without matching orderId:', transactionId, customData);
        return res.status(200).json({ success: true, message: 'Transaction recorded; no matching order found.' });
      }

      await AuditLogger.log({
        requestId,
        userId: customData.userId || 'system',
        orderId,
        eventType: 'PADDLE_WEBHOOK_VERIFIED',
        eventStatus: 'SUCCESS',
        source: 'PADDLE_WEBHOOK',
        metadata: { eventId, eventType, transactionId },
      });

      const syncResult = await completeVerifiedPaddleOrder(orderId, transactionId, customerId, 'PADDLE_WEBHOOK', eventData);
      return res.status(syncResult.retryable ? 503 : 200).json({ success: syncResult.success, status: syncResult.status });
    }

    return res.status(200).json({ success: true, message: `Event ${eventType} received and acknowledged.` });
  } catch (err: any) {
    console.error('[Paddle Webhook Exception]:', err);
    return res.status(500).json({ success: false, message: 'Internal server error processing webhook.' });
  }
};

app.post('/api/payments/paddle/webhook', handlePaddleWebhook);
app.post('/api/paddle/webhook', handlePaddleWebhook);

app.post('/api/payments/paddle/reconcile/:orderId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const sid = req.cookies?.sid;
    if (!sid) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const payload = await AuthServiceServer.verifyOpaqueSession(sid);
    if (!payload || !payload.userId) {
      return res.status(401).json({ success: false, message: 'Invalid session.' });
    }
    const order = await FirebaseRtdb.getGlobalOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    const profile = await FirebaseRtdb.getUserProfile(payload.userId);
    const isAdmin = profile && profile.role === 'admin';
    if (!isAdmin && order.userId !== payload.userId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (String(order.paymentStatus).toUpperCase() === 'PAID') {
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.json({ success: true, status: 'PAID', orderId: order.id });
    }

    if (order.paddleTransactionId && getPaddleApiKey()) {
      const check = await fetchPaddleTransaction(order.paddleTransactionId);
      if (check.success && (check.data?.status === 'completed' || check.data?.status === 'paid')) {
        const result = await completeVerifiedPaddleOrder(order.id, order.paddleTransactionId, check.data.customer_id, 'PADDLE_RECONCILE', check.data);
        res.set('Cache-Control', 'private, no-store, max-age=0');
        return res.json(result);
      }
    }

    res.set('Cache-Control', 'private, no-store, max-age=0');
    return res.json({ success: false, status: order.paymentStatus || 'PENDING', orderId: order.id, message: 'Payment is pending webhook verification.' });
  } catch {
    res.status(500).json({ success: false, message: 'Paddle reconciliation failed.' });
  }
});

// ============================================
// SECURE DOWNLOAD TOKENS & STREAMING (RTDB ONLY)
// ============================================
const syncPayUOrder = registerPayURoutes(app, requireAuth, { appUrl: getConfiguredAppUrl, fulfill: fulfillPaidOrder, email: sendPurchaseEmailSafely });

app.post('/api/downloads/:productId/token', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const productId = req.params.productId;
    const requestedOrderId = typeof req.body?.orderId === 'string' ? req.body.orderId : undefined;
    const purchase = await findPaidPurchase(userId, productId, undefined, requestedOrderId);

    if (!purchase) {
      return res.status(403).json({ success: false, message: 'Active purchase access not found for this product.' });
    }

    if (purchase.downloadCount >= (purchase.downloadLimit || 10)) {
      return res.status(403).json({ success: false, message: 'Download limit has been reached for this purchase.' });
    }

    const tokenId = `DL-TOK-${crypto.randomBytes(24).toString('base64url')}`;
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    const tokenData = {
      tokenId,
      userId,
      productId,
      productTitle: purchase.productName || 'Digital Product',
      orderId: purchase.orderId,
      purchaseId: purchase.purchaseId,
      expiresAt,
      used: false,
    };

    await FirebaseRtdb.set(`downloadTokens/${tokenId}`, tokenData);

    res.json({
      success: true,
      token: tokenId,
      expiresAt,
      downloadUrl: `/api/downloads/stream?token=${tokenId}`,
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to generate download token.' });
  }
});

app.get('/api/downloads/stream', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (typeof token !== 'string' || !/^DL-TOK-[A-Za-z0-9_-]{32}$/.test(token)) {
      return res.status(400).send('A valid download token is required.');
    }

    const tokenData = await FirebaseRtdb.get<any>(`downloadTokens/${token}`);
    if (!tokenData) {
      return res.status(403).send('Invalid download token.');
    }

    if (Date.now() > tokenData.expiresAt) {
      await FirebaseRtdb.delete(`downloadTokens/${token}`);
      return res.status(403).send('Download link has expired.');
    }

    if (tokenData.used) {
      return res.status(403).send('Download link has already been used.');
    }

    // Re-check the active purchase immediately before opening the protected file.
    const purchase = await findPaidPurchase(tokenData.userId, tokenData.productId, tokenData.purchaseId, tokenData.orderId);

    if (!purchase) {
      return res.status(403).send('Active purchase access not found for this download.');
    }

    const currentCount = purchase.downloadCount || 0;
    const limit = purchase.downloadLimit || 10;
    if (currentCount >= limit) {
      return res.status(403).send('Download limit has been reached for this purchase.');
    }

    // Open the remote object before consuming the one-time token. This avoids
    // burning a customer's token when storage is temporarily unavailable.
    const source = await SecureFileManager.openProductFile(tokenData.productId);

    tokenData.used = true;
    await FirebaseRtdb.set(`downloadTokens/${token}`, tokenData);

    purchase.downloadCount = currentCount + 1;
    await FirebaseRtdb.savePurchase(tokenData.userId, purchase.purchaseId, purchase);

    const filename = `${tokenData.productId}-package.zip`;
    SecureFileManager.streamProductFileToResponse(source, filename, res);
  } catch (err: any) {
    if (!res.headersSent) {
      const isConfigurationError = String(err?.message || '').includes('PRODUCT_DOWNLOAD_URL');
      return res
        .status(isConfigurationError ? 503 : 502)
        .send(isConfigurationError ? 'Product download is not configured yet.' : 'Product download is temporarily unavailable.');
    }
    res.destroy(err);
  }
});

app.get('/api/downloads/email', async (req: Request, res: Response) => {
  try {
    const rawToken = typeof req.query.token === 'string' ? req.query.token : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
      return res.status(400).send('A valid email download token is required.');
    }

    const tokenHash = hashEmailDownloadToken(rawToken);
    const tokenPath = `emailDownloadTokens/${tokenHash}`;
    const tokenData = await FirebaseRtdb.get<any>(tokenPath);
    if (!tokenData) {
      return res.status(403).send('Invalid download link.');
    }

    if (Date.now() > tokenData.expiresAt) {
      await FirebaseRtdb.delete(tokenPath);
      return res.status(403).send('Download link has expired. Sign in to your account to create a new link.');
    }

    if (tokenData.used) {
      return res.status(403).send('Download link has already been used. Sign in to your account to create a new link.');
    }

    const purchase = await findPaidPurchase(tokenData.userId, tokenData.productId, tokenData.purchaseId, tokenData.orderId);

    if (!purchase) {
      return res.status(403).send('Active purchase access not found for this download.');
    }

    const currentCount = Number(purchase.downloadCount || 0);
    const limit = Number(purchase.downloadLimit || 10);
    if (currentCount >= limit) {
      return res.status(403).send('Download limit has been reached for this purchase.');
    }

    const source = await SecureFileManager.openProductFile(tokenData.productId);

    tokenData.used = true;
    tokenData.usedAt = new Date().toISOString();
    await FirebaseRtdb.set(tokenPath, tokenData);

    purchase.downloadCount = currentCount + 1;
    await FirebaseRtdb.savePurchase(tokenData.userId, purchase.purchaseId, purchase);

    SecureFileManager.streamProductFileToResponse(source, `${tokenData.productId}-package.zip`, res);
  } catch (err: any) {
    if (!res.headersSent) {
      const isConfigurationError = String(err?.message || '').includes('PRODUCT_DOWNLOAD_URL');
      return res
        .status(isConfigurationError ? 503 : 502)
        .send(isConfigurationError ? 'Product download is not configured yet.' : 'Product download is temporarily unavailable.');
    }
    res.destroy(err);
  }
});

app.get('/api/invoices/email', async (req: Request, res: Response) => {
  try {
    const rawToken = typeof req.query.token === 'string' ? req.query.token : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
      return res.status(400).send('A valid invoice token is required.');
    }

    const tokenHash = hashEmailDownloadToken(rawToken);
    const tokenPath = `invoiceDownloadTokens/${tokenHash}`;
    const tokenData = await FirebaseRtdb.get<any>(tokenPath);
    if (!tokenData) {
      return res.status(403).send('Invalid invoice link.');
    }

    if (Date.now() > tokenData.expiresAt) {
      await FirebaseRtdb.delete(tokenPath);
      return res.status(403).send('Invoice link has expired. Sign in to your account to view the order.');
    }

    const currentCount = Number(tokenData.downloadCount || 0);
    const limit = Number(tokenData.downloadLimit || 10);
    if (currentCount >= limit) {
      return res.status(403).send('Invoice download limit has been reached.');
    }

    const order = await FirebaseRtdb.getGlobalOrder(tokenData.orderId);
    if (
      !order || !Array.isArray(order.items) ||
      !order.items.some((item: any) => isPaidOrderForProduct(order, tokenData.userId, item.productId))
    ) {
      return res.status(403).send('Paid order not found for this invoice.');
    }

    const invoice = await buildInvoicePdf(order);
    tokenData.downloadCount = currentCount + 1;
    tokenData.lastDownloadedAt = new Date().toISOString();
    await FirebaseRtdb.set(tokenPath, tokenData);

    const orderNumber = String(order.orderNumber || order.id || 'order')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 80);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${orderNumber}.pdf"`);
    res.setHeader('Content-Length', invoice.length);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.status(200).send(invoice);
  } catch {
    return res.status(500).send('Invoice is temporarily unavailable.');
  }
});

// Admin Audit Logs & Analytics
app.get('/api/admin/audit-logs', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const logs = await AuditLogger.getAllLogs(100);
    res.json({ success: true, logs });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
});

export default app;
