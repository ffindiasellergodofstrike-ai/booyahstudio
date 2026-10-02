import { hasLivePayment } from '../src/services/PaymentEnvironment';
import { Router, Response, Request } from 'express';
import { FirebaseRtdb } from './firebaseRtdb';
import { AuditLogger, generateRequestId } from './audit';
import { z } from 'zod';
import crypto from 'crypto';
import multer from 'multer';
import { isAllowedProductPreviewUrl } from './productPreview';

export const adminRouter = Router();

export function safeCsvCell(value: unknown): string {
  const text = String(value ?? '').replace(/\r\n|\r/g, '\n');
  // Spreadsheet programs can execute cells beginning with these characters.
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Configure Multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Zod schemas for validation
const previewUrlSchema = z.union([z.literal(''), z.string().trim().max(2048)])
  .optional()
  .refine(
    (value) => !value || isAllowedProductPreviewUrl(value),
    'Live preview must use an HTTPS custom domain. Direct *.vercel.app URLs are not allowed.'
  )
  .transform((value) => value?.trim() || undefined);

const productSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2),
  slug: z.string().min(2),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  category: z.string().min(1),
  categoryLabel: z.string().optional(),
  productType: z.string().default('DOWNLOAD'),
  version: z.string().optional(),
  fileSize: z.string().optional(),
  fileFormat: z.string().optional(),
  image: z.string().url().or(z.string().min(1)),
  gallery: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  isFeatured: z.boolean().optional(),
  stock: z.number().int().nonnegative().optional(),
  unlimitedStock: z.boolean().optional(),
  features: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  faqs: z.array(z.any()).optional(),
  previewUrl: previewUrlSchema,
}).superRefine((product, context) => {
  if (product.previewUrl?.startsWith('/') && product.previewUrl !== `/demos/${product.id}/`) {
    context.addIssue({
      code: 'custom',
      path: ['previewUrl'],
      message: `Built-in preview path must match this product ID: /demos/${product.id}/`,
    });
  }
});

const couponSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(2),
  discountPercent: z.number().min(0).max(100).optional(),
  flatAmount: z.number().nonnegative().optional(),
  description: z.string().optional(),
  minSpend: z.number().nonnegative().optional(),
  active: z.boolean().default(true),
  usageCount: z.number().int().nonnegative().optional(),
  usageLimit: z.number().int().nonnegative().optional(),
  expiresAt: z.string().optional(),
});

/**
 * Middleware wrapper to ensure requireAuth and requireAdmin are used.
 * We access them from the request or import them in server/app.ts where router is mounted.
 */

// 1. Admin Me & Dashboard Stats
adminRouter.get('/me', async (req: any, res: Response) => {
  try {
    const profile = await FirebaseRtdb.getUserProfile(req.userId);
    const firebaseStatus = await FirebaseRtdb.testConnection();
    res.json({
      success: true,
      admin: profile,
      health: {
        firebase: firebaseStatus,
        easebuzz: { status: process.env.EASEBUZZ_KEY && process.env.EASEBUZZ_SALT ? 'configured' : 'not_configured', environment: process.env.EASEBUZZ_ENV || 'unset' },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch admin profile.' });
  }
});

adminRouter.get('/dashboard/stats', async (req: any, res: Response) => {
  try {
    const orders = await FirebaseRtdb.getAllGlobalOrders();
    const products = await FirebaseRtdb.getAllProducts();
    const users = await FirebaseRtdb.getAllUsers();
    const auditLogs = await AuditLogger.getAllLogs(50);

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    let revenueToday = 0;
    let revenue7d = 0;
    let revenue30d = 0;
    let totalRevenue = 0;

    let paidCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    const dailyRevenue = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(now - (29 - index) * oneDay).toISOString().slice(0, 10);
      return { name: day, revenue: 0 };
    });
    const revenueByDay = new Map(dailyRevenue.map((day) => [day.name, day]));

    orders.forEach((o: any) => {
      if (o.paymentEnvironment !== 'live' && o.paymentStatus === 'PAID') return;
      const amount = Number(o.total) || 0;
      const paidDate = o.paymentVerifiedAt || o.paidAt || o.createdAt || o.date;
      const orderTime = new Date(paidDate || 0).getTime();
      const isPaid = hasLivePayment(o) && String(o.paymentStatus).toUpperCase() === 'PAID';

      if (isPaid) {
        totalRevenue += amount;
        if (Number.isFinite(orderTime)) {
          const dayKey = new Date(orderTime).toISOString().slice(0, 10);
          if (dayKey === new Date(now).toISOString().slice(0, 10)) revenueToday += amount;
          if (now - orderTime <= sevenDays) revenue7d += amount;
          if (now - orderTime <= thirtyDays) revenue30d += amount;
          const day = revenueByDay.get(dayKey);
          if (day) day.revenue += amount;
        }
        paidCount++;
      } else if (String(o.paymentStatus).toUpperCase() === 'FAILED') {
        failedCount++;
      } else {
        pendingCount++;
      }
    });

    res.json({
      success: true,
      stats: {
        revenue: { today: revenueToday, last7d: revenue7d, last30d: revenue30d, total: totalRevenue, daily: dailyRevenue },
        orders: { total: orders.length, paid: paidCount, pending: pendingCount, failed: failedCount },
        productsCount: products.length,
        customersCount: users.length,
        conversionRate: orders.length ? (paidCount / orders.length) * 100 : 0,
      },
      recentOrders: orders.slice(0, 10),
      recentAuditLogs: auditLogs.slice(0, 15),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch dashboard stats.' });
  }
});

// 2. Products Management CRUD & Actions
adminRouter.get('/products', async (req: any, res: Response) => {
  try {
    const products = await FirebaseRtdb.getAllProducts();
    res.json({ success: true, products });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch products.' });
  }
});

adminRouter.post('/products', async (req: any, res: Response) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: parsed.error.format() });
    }

    const productData = {
      ...parsed.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check slug uniqueness
    const existing = await FirebaseRtdb.getAllProducts();
    if (existing.some((p: any) => p.slug === productData.slug && p.id !== productData.id)) {
      return res.status(400).json({ success: false, message: 'Product slug must be unique.' });
    }

    await FirebaseRtdb.saveProduct(productData);

    await AuditLogger.log({
      requestId: generateRequestId(),
      userId: req.userId,
      eventType: 'PRODUCT_VIEWED', // or general admin write
      eventStatus: 'SUCCESS',
      productId: productData.id,
      source: 'ADMIN_PANEL',
      metadata: { action: 'CREATE_PRODUCT', productTitle: productData.title },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, product: productData, message: 'Product created successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create product.' });
  }
});

adminRouter.put('/products/:id', async (req: any, res: Response) => {
  try {
    const productId = req.params.id;
    const existing = await FirebaseRtdb.getProductById(productId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const parsed = productSchema.safeParse({ ...existing, ...req.body, id: productId });
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: parsed.error.format() });
    }

    const updated = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    await FirebaseRtdb.saveProduct(updated);

    await AuditLogger.log({
      requestId: generateRequestId(),
      userId: req.userId,
      eventType: 'PRODUCT_VIEWED',
      eventStatus: 'SUCCESS',
      productId,
      source: 'ADMIN_PANEL',
      metadata: { action: 'UPDATE_PRODUCT', before: existing, after: updated },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, product: updated, message: 'Product updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update product.' });
  }
});

adminRouter.delete('/products/:id', async (req: any, res: Response) => {
  try {
    const productId = req.params.id;
    const existing = await FirebaseRtdb.getProductById(productId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Soft delete via status archived
    existing.status = 'archived';
    existing.updatedAt = new Date().toISOString();
    await FirebaseRtdb.saveProduct(existing);

    await AuditLogger.log({
      requestId: generateRequestId(),
      userId: req.userId,
      eventType: 'PRODUCT_VIEWED',
      eventStatus: 'SUCCESS',
      productId,
      source: 'ADMIN_PANEL',
      metadata: { action: 'ARCHIVE_PRODUCT', productId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, message: 'Product archived successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to archive product.' });
  }
});

adminRouter.post('/products/:id/clone', async (req: any, res: Response) => {
  try {
    const productId = req.params.id;
    const existing = await FirebaseRtdb.getProductById(productId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const newId = `${existing.id}-copy-${Math.random().toString(36).substring(2, 6)}`;
    const cloned = {
      ...existing,
      id: newId,
      title: `${existing.title} (Copy)`,
      slug: `${existing.slug}-copy-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await FirebaseRtdb.saveProduct(cloned);
    res.json({ success: true, product: cloned, message: 'Product cloned successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to clone product.' });
  }
});

// 3. Image Upload Handler (Real Firebase Storage REST API)
adminRouter.post('/uploads/direct', upload.single('image') as any, async (req: any, res: any) => {
  const requestId = generateRequestId();
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No image file provided.', requestId });
    }

    const bucket = process.env.FIREBASE_STORAGE_BUCKET || 'booyah-studio-shop.appspot.com';
    const filename = `products/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodeURIComponent(filename)}`;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': file.mimetype,
      },
      body: file.buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firebase Storage Error: ${errorText}`);
    }

    const data = await response.json();
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filename)}?alt=media&token=${data.downloadTokens || ''}`;

    await AuditLogger.log({
      requestId,
      userId: req.userId,
      eventType: 'PRODUCT_VIEWED',
      eventStatus: 'SUCCESS',
      source: 'ADMIN_UPLOAD',
      metadata: { filename, size: file.size, mimetype: file.mimetype },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ 
      success: true, 
      url: publicUrl, 
      message: 'Image uploaded successfully to Firebase Storage.' 
    });
  } catch (err: any) {
    console.error('[Admin Upload Error]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload image to storage. Ensure FIREBASE_STORAGE_BUCKET is configured.', 
      requestId 
    });
  }
});

adminRouter.post('/uploads/sign', async (req: any, res: Response) => {
  res.json({
    success: true,
    uploadUrl: `/api/admin/uploads/direct`,
    message: 'Use direct upload endpoint with multipart/form-data.'
  });
});

// 4. Orders Management
adminRouter.get('/orders', async (req: any, res: Response) => {
  try {
    const orders = await FirebaseRtdb.getAllGlobalOrders();
    res.json({ success: true, orders });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch orders.' });
  }
});

adminRouter.get('/orders/:id/timeline', async (req: any, res: Response) => {
  try {
    const orderId = req.params.id;
    const auditLogs = await FirebaseRtdb.get<Record<string, any>>(`orderAuditIndex/${orderId}`) || {};
    const timeline = Object.values(auditLogs).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    res.json({ success: true, timeline });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch order timeline.' });
  }
});

adminRouter.put('/orders/:id/status', async (req: any, res: Response) => {
  try {
    const orderId = req.params.id;
    const { status, paymentStatus, deliveryStatus } = req.body;
    const order = await FirebaseRtdb.getGlobalOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (status !== undefined || paymentStatus !== undefined || deliveryStatus !== 'REVOKED' ||
        String(order.paymentStatus).toUpperCase() !== 'PAID') {
      return res.status(400).json({ success: false, message: 'Only paid-order download access can be revoked here. Payment status must be verified by Easebuzz.' });
    }

    order.deliveryStatus = 'REVOKED';
    order.downloadStatus = 'REVOKED';
    order.items = (order.items || []).map((item: any) => ({ ...item, downloadStatus: 'REVOKED' }));
    order.updatedAt = new Date().toISOString();

    await FirebaseRtdb.saveGlobalOrder(order);

    await AuditLogger.log({
      requestId: generateRequestId(),
      userId: req.userId,
      eventType: 'ORDER_UPDATED',
      eventStatus: 'SUCCESS',
      orderId,
      source: 'ADMIN_PANEL',
      metadata: { action: 'REVOKE_DOWNLOAD_ACCESS' },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, order, message: 'Download access revoked. No refund was initiated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update order status.' });
  }
});

// 5. Customers Management
adminRouter.get('/customers', async (req: any, res: Response) => {
  try {
    const users = await FirebaseRtdb.getAllUsers();
    const orders = await FirebaseRtdb.getAllGlobalOrders();

    const customersWithMetrics = users.map((u: any) => {
      const userOrders = orders.filter((o: any) => o.customerEmail?.toLowerCase() === u.email?.toLowerCase());
      const totalSpent = userOrders.reduce(
        (sum: number, o: any) => sum + (String(o.paymentStatus).toUpperCase() === 'PAID' ? o.total : 0),
        0
      );
      return {
        ...u,
        ordersCount: userOrders.length,
        totalSpent,
      };
    });

    res.json({ success: true, customers: customersWithMetrics });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch customers.' });
  }
});

adminRouter.put('/customers/:userId/status', async (req: any, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    const { role, blocked } = req.body;
    const profile = await FirebaseRtdb.getUserProfile(targetUserId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (role) profile.role = role;
    if (blocked !== undefined) profile.blocked = blocked;

    await FirebaseRtdb.setUserProfile(targetUserId, profile);
    res.json({ success: true, profile, message: 'Customer status updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update customer status.' });
  }
});

// 6. Coupons Management
adminRouter.get('/coupons', async (req: any, res: Response) => {
  try {
    const coupons = await FirebaseRtdb.getAllCoupons();
    res.json({ success: true, coupons });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch coupons.' });
  }
});

adminRouter.post('/coupons', async (req: any, res: Response) => {
  try {
    const parsed = couponSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: parsed.error.format() });
    }
    await FirebaseRtdb.saveCoupon(parsed.data);
    res.json({ success: true, coupon: parsed.data, message: 'Coupon created successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create coupon.' });
  }
});

adminRouter.delete('/coupons/:id', async (req: any, res: Response) => {
  try {
    await FirebaseRtdb.deleteCoupon(req.params.id);
    res.json({ success: true, message: 'Coupon deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete coupon.' });
  }
});

// 7. Settings & CMS
adminRouter.get('/settings', async (req: any, res: Response) => {
  try {
    const settings = await FirebaseRtdb.getGlobalSettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch settings.' });
  }
});

adminRouter.put('/settings', async (req: any, res: Response) => {
  try {
    await FirebaseRtdb.saveGlobalSettings(req.body);
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to save settings.' });
  }
});

// 8. CSV Exports
adminRouter.get('/export/orders', async (req: any, res: Response) => {
  try {
    const orders = await FirebaseRtdb.getAllGlobalOrders();
    const csvRows = ['Order Number,Invoice Number,Date,Customer Name,Customer Email,Status,Payment Status,Total,Payment Verified At,Delivered At,Email Status'];
    orders.forEach((o: any) => {
      csvRows.push([
        o.orderNumber, o.invoiceNumber, o.date, o.customerName || o.customer?.fullName,
        o.customerEmail || o.customer?.email, o.status, o.paymentStatus, o.total,
        o.paymentVerifiedAt, o.deliveredAt, o.emailDelivery?.status,
      ].map(safeCsvCell).join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders_export.csv');
    res.send(csvRows.join('\n'));
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Export failed.' });
  }
});

adminRouter.get('/export/customers', async (req: any, res: Response) => {
  try {
    const users = await FirebaseRtdb.getAllUsers();
    const csvRows = ['Name,Email,Mobile,Role,Joined Date'];
    users.forEach((u: any) => {
      csvRows.push([u.name, u.email, u.mobile, u.role || 'customer', u.joinedDate].map(safeCsvCell).join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customers_export.csv');
    res.send(csvRows.join('\n'));
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Export failed.' });
  }
});

adminRouter.get('/support-requests', async (_req, res) => {
  try { res.json({ success: true, requests: await FirebaseRtdb.get('supportRequests') || {} }); }
  catch { res.status(503).json({ success: false, message: 'Support inbox unavailable.' }); }
});
