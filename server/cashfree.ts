import crypto from 'node:crypto';
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { Store } from './store';
import { FirebaseRtdb } from './firebaseRtdb';
import { supabaseAdmin } from './supabase';
import { appOrigin } from './config';
import { policyDocuments, policyVersion } from './policies';
import { sendOrderEmail, sendRefundEmail } from './orderEmail';
import { PRODUCTS } from '../src/data/products';
import {
  mapExternalAmountToCatalogProduct,
  validateInternalCartItems,
  type CatalogMappingResult,
} from '../src/lib/catalog-product-picker';
import { prepareCashfreeCustomerPayload } from '../src/lib/cashfree-payload-mapper';

const merchantOrderId = /^[A-Za-z0-9_-]{3,45}$/;
const providerId = /^[A-Za-z0-9_-]{1,100}$/;
const paymentStates = new Set(['SUCCESS', 'FAILED', 'PENDING', 'USER_DROPPED', 'CANCELLED', 'NOT_ATTEMPTED']);

// Per-order atomic lock queue to prevent race conditions during concurrent status checks & webhooks
const orderLocks = new Map<string, Promise<any>>();
async function withOrderLock<T>(orderId: string, fn: () => Promise<T>): Promise<T> {
  const prev = orderLocks.get(orderId) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  orderLocks.set(orderId, next);
  try {
    return await next;
  } finally {
    if (orderLocks.get(orderId) === next) {
      orderLocks.delete(orderId);
    }
  }
}

export function cashfreeConfig() {
  const rawMode = (process.env.CASHFREE_ENV || 'sandbox').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  const mode = rawMode === 'live' || rawMode === 'prod' ? 'production' : rawMode === 'test' ? 'sandbox' : rawMode;
  if (!['sandbox', 'production'].includes(mode)) throw new Error('CASHFREE_ENV must be sandbox or production.');
  const rawVersion = (process.env.CASHFREE_API_VERSION || '2023-08-01').trim().replace(/^['"]|['"]$/g, '').replace(/^v/i, '');
  const version = /^20\d{2}-\d{2}-\d{2}$/.test(rawVersion) ? rawVersion : '2023-08-01';
  const hasKeys = Boolean(process.env.CASHFREE_APP_ID?.trim() && process.env.CASHFREE_SECRET_KEY?.trim());
  return {
    mode,
    environment: mode === 'production' ? 'live' : 'test',
    version,
    base: mode === 'production' ? 'https://api.cashfree.com/pg/' : 'https://sandbox.cashfree.com/pg/',
    configured: Boolean(hasKeys && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    v2Configured: hasKeys,
  };
}

export class CashfreeError extends Error {
  constructor(public status: number, public code = '', public details = '') {
    super(details || 'Cashfree request could not be completed.');
  }
}

/**
 * Strips referer, referrer, and origin headers from incoming request objects
 * so external caller origins are never leaked downstream.
 */
export function stripIncomingReferrerHeaders(req: Request): void {
  delete req.headers['referer'];
  delete req.headers['referrer'];
  delete req.headers['origin'];
}

/** Only trusted relative API paths and fixed provider hosts may receive our secrets. */
export async function cashfreeRequest(endpoint: string, body?: unknown, options: RequestInit = {}) {
  if (!/^[A-Za-z0-9_/-]+$/.test(endpoint) || endpoint.includes('..') || endpoint.startsWith('/')) {
    throw new Error('Invalid Cashfree endpoint');
  }
  const config = cashfreeConfig();
  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    throw new Error('Cashfree is not configured.');
  }
  const headers = new Headers(options.headers);
  // Explicitly strip any referrer/origin headers before outgoing gateway call
  headers.delete('referer');
  headers.delete('referrer');
  headers.delete('origin');
  headers.set('x-client-id', process.env.CASHFREE_APP_ID);
  headers.set('x-client-secret', process.env.CASHFREE_SECRET_KEY);
  headers.set('x-api-version', config.version);
  headers.set('accept', 'application/json');
  let requestBody = options.body;
  if (body !== undefined) {
    requestBody = JSON.stringify(body);
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(`${config.base}${endpoint}`, {
    ...options,
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    method: options.method || (body === undefined ? 'GET' : 'POST'),
    headers,
    ...(requestBody === undefined ? {} : { body: requestBody }),
    signal: options.signal || AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new CashfreeError(
      response.status,
      typeof data.code === 'string' ? data.code.slice(0, 100) : '',
      typeof data.message === 'string' ? data.message.slice(0, 200) : ''
    );
  }
  return response.json();
}

export function cashfreeIdempotencyKey(value: string): string {
  const bytes = crypto.createHash('sha256').update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function moneyPaise(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const amount = Number(value),
    paise = Math.round(amount * 100);
  return Number.isFinite(amount) && Number.isSafeInteger(paise) && paise >= 0 && Math.abs(amount * 100 - paise) < 0.00001
    ? paise
    : null;
}

export function verifyCashfreeSignature(raw: Buffer, signature: unknown, timestamp: unknown): boolean {
  const secret = process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_SECRET_KEY;
  if (
    !secret ||
    !Buffer.isBuffer(raw) ||
    typeof signature !== 'string' ||
    typeof timestamp !== 'string' ||
    !/^\d{10,16}$/.test(timestamp) ||
    !/^[A-Za-z0-9+/]{43}=$/.test(signature)
  )
    return false;
  const tsMs = timestamp.length <= 10 ? Number(timestamp) * 1000 : Number(timestamp);
  if (!Number.isFinite(tsMs) || tsMs > Date.now() + 300000) return false;
  const expected = crypto.createHmac('sha256', secret).update(timestamp).update(raw).digest();
  const actual = Buffer.from(signature, 'base64');
  return actual.length === expected.length && crypto.timingSafeEqual(expected, actual);
}

export function matchesCashfreeOrder(remote: any, order: any): boolean {
  return Boolean(
    remote &&
      order &&
      remote.order_id === (order.cashfreeOrderId || order.id) &&
      remote.order_currency === 'INR' &&
      moneyPaise(remote.order_amount) === moneyPaise(order.total) &&
      moneyPaise(order.total)! > 0 &&
      (!order.cfOrderId || String(remote.cf_order_id) === String(order.cfOrderId))
  );
}

export function matchesCashfreePayment(payment: any, order: any): boolean {
  return Boolean(
    order?.cashfreeOrderId &&
      String(order.paymentProvider).toLowerCase() === 'cashfree' &&
      order.paymentEnvironment === cashfreeConfig().environment &&
      providerId.test(String(payment?.cf_payment_id || '')) &&
      payment.order_id === order.cashfreeOrderId &&
      payment.payment_currency === 'INR' &&
      moneyPaise(payment.payment_amount) === moneyPaise(order.total) &&
      paymentStates.has(payment.payment_status)
  );
}

export async function syncCashfreeOrder(original: any) {
  if (
    !original?.cashfreeOrderId ||
    String(original.paymentProvider).toLowerCase() !== 'cashfree' ||
    original.paymentEnvironment !== cashfreeConfig().environment
  )
    throw new Error('Cashfree order environment mismatch');
  const remote = await cashfreeRequest(`orders/${original.cashfreeOrderId}`);
  if (!matchesCashfreeOrder(remote, original)) throw new Error('Cashfree order mismatch');
  const payments = await cashfreeRequest(`orders/${original.cashfreeOrderId}/payments`);
  if (!Array.isArray(payments)) throw new Error('Invalid Cashfree payment response');
  const current = await Store.getGlobalOrder(original.id);
  const verifiedPayments: any[] = [];
  payments.sort(
    (a: any, b: any) =>
      (Date.parse(a.payment_completion_time || a.payment_time || '') || 0) -
      (Date.parse(b.payment_completion_time || b.payment_time || '') || 0)
  );
  for (const payment of payments) {
    if (!matchesCashfreePayment(payment, current)) continue;
    verifiedPayments.push({
      id: String(payment.cf_payment_id),
      order_id: payment.order_id,
      amount: moneyPaise(payment.payment_amount),
      currency: payment.payment_currency,
      status: payment.payment_status,
      environment: cashfreeConfig().environment,
      providerCreatedAt: payment.payment_completion_time || payment.payment_time || null,
    });
  }
  const refunds = await cashfreeRequest(`orders/${original.cashfreeOrderId}/refunds`);
  if (!Array.isArray(refunds)) throw new Error('Invalid Cashfree refund response');
  const knownSuccessfulPayments = new Set([
    ...Object.values(current?.payments || {})
      .filter((payment: any) => payment.status === 'SUCCESS')
      .map((payment: any) => String(payment.id)),
    ...verifiedPayments.filter((payment) => payment.status === 'SUCCESS').map((payment) => payment.id),
  ]);
  const verifiedRefunds: any[] = [];
  for (const refund of refunds) {
    const id = String(refund.refund_id || '');
    const paymentId = String(refund.cf_payment_id || '');
    if (refund.refund_status !== 'SUCCESS') continue;
    if (
      !providerId.test(id) ||
      refund.order_id !== original.cashfreeOrderId ||
      refund.refund_currency !== 'INR' ||
      !knownSuccessfulPayments.has(paymentId) ||
      moneyPaise(refund.refund_amount) === null ||
      moneyPaise(refund.refund_amount)! <= 0
    )
      throw new Error('Cashfree refund mismatch');
    verifiedRefunds.push({
      id,
      payment_id: paymentId,
      order_id: original.cashfreeOrderId,
      amount: moneyPaise(refund.refund_amount),
      currency: 'INR',
      environment: cashfreeConfig().environment,
    });
  }
  const saved = await Store.rpc('sync_cashfree_snapshot', `orders/${original.id}`, {
    payments: verifiedPayments,
    refunds: verifiedRefunds,
  });
  try {
    if (saved.refundedAmount > 0) await sendRefundEmail(saved);
    if (['PAID', 'PARTIALLY_REFUNDED'].includes(saved.paymentStatus) && saved.deliveryStatus !== 'REVOKED')
      await sendOrderEmail(saved);
  } catch {
    /* A stored purchase remains valid when email delivery is unavailable. */
  }
  return saved;
}

export function cashfreeResult(order: any) {
  const revoked = order.deliveryStatus === 'REVOKED' || order.paymentStatus === 'REFUNDED';
  const paid = ['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus) && !revoked;
  return {
    success: paid,
    status: revoked
      ? 'REVOKED'
      : paid
      ? order.paymentStatus
      : order.latestPaymentStatus === 'FAILED' || order.latestPaymentStatus === 'USER_DROPPED'
      ? 'FAILED'
      : 'PENDING',
    orderId: order.id,
  };
}

// ============================================================================
// V2 EXTERNAL & INTERNAL CASHFREE ORDER + UPI QR SYSTEM
// ============================================================================

export function getAllowedClientDomains(): string[] {
  const raw = process.env.ALLOWED_CLIENT_DOMAINS || '';
  return raw
    .split(',')
    .map((d) => d.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
}

export function isAuthorizedExternalCall(req: Request): { isExternal: boolean; authorized: boolean } {
  const apiKeyHeader = req.get('x-api-key')?.trim();
  const bearerHeader = req.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const providedKey = apiKeyHeader || bearerHeader || '';
  const configuredKey = (process.env.EXTERNAL_API_KEY || '').trim();

  if (providedKey) {
    if (!configuredKey) {
      return { isExternal: true, authorized: false };
    }
    const a = Buffer.from(providedKey);
    const b = Buffer.from(configuredKey);
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { isExternal: true, authorized: match };
  }

  const origin = (req.get('origin') || '').trim().replace(/\/+$/, '').toLowerCase();
  const allowedDomains = getAllowedClientDomains();
  if (origin && allowedDomains.length > 0) {
    let originHost = '';
    try {
      originHost = new URL(origin).hostname.toLowerCase();
    } catch {
      originHost = '';
    }
    const isAllowedDomain = allowedDomains.some(
      (d) => d === '*' || d === origin || (originHost && d === originHost)
    );
    if (isAllowedDomain) {
      // If EXTERNAL_API_KEY is also required in env, enforce it; otherwise domain allowlist suffices
      if (configuredKey) {
        return { isExternal: true, authorized: false };
      }
      return { isExternal: true, authorized: true };
    }
  }

  return { isExternal: false, authorized: true };
}

const v2OrderMemoryCache = new Map<string, any>();

async function saveV2OrderRecord(orderRecord: any): Promise<void> {
  v2OrderMemoryCache.set(orderRecord.id, orderRecord);
  if (orderRecord.cashfreeOrderId) {
    v2OrderMemoryCache.set(orderRecord.cashfreeOrderId, orderRecord);
  }
  const statusBucket =
    orderRecord.paymentStatus === 'PAID'
      ? 'orders_paid'
      : orderRecord.paymentStatus === 'FAILED'
      ? 'orders_failed'
      : 'orders_pending';
  try {
    await FirebaseRtdb.setMultiple({
      [`orders/${orderRecord.id}`]: orderRecord,
      [`${statusBucket}/${orderRecord.id}`]: orderRecord,
      [`cashfreeOrderIndex/${orderRecord.cashfreeOrderId}`]: orderRecord.id,
      ...(orderRecord.userId ? { [`users/${orderRecord.userId}/orders/${orderRecord.id}`]: orderRecord } : {}),
    });
  } catch (err) {
    console.warn('[Cashfree V2] Non-fatal Firebase storage warning:', (err as any)?.message || err);
  }
}

async function getV2OrderRecord(orderIdOrTxnId: string): Promise<any | null> {
  if (!merchantOrderId.test(orderIdOrTxnId)) return null;
  const cached = v2OrderMemoryCache.get(orderIdOrTxnId);
  if (cached) return cached;
  try {
    const direct = await FirebaseRtdb.get<any>(`orders/${orderIdOrTxnId}`);
    if (direct) {
      v2OrderMemoryCache.set(orderIdOrTxnId, direct);
      return direct;
    }
    const indexedId = await FirebaseRtdb.get<string>(`cashfreeOrderIndex/${orderIdOrTxnId}`);
    if (indexedId) {
      const indexedRecord = await FirebaseRtdb.get<any>(`orders/${indexedId}`);
      if (indexedRecord) {
        v2OrderMemoryCache.set(orderIdOrTxnId, indexedRecord);
        return indexedRecord;
      }
    }
  } catch {
    // Ignore storage read errors and fall back to Cashfree remote state
  }
  return null;
}

export async function verifyAndSyncV2Order(orderId: string): Promise<any> {
  return withOrderLock(orderId, async () => {
    let existing = await getV2OrderRecord(orderId);
    const cfOrderId = existing?.cashfreeOrderId || existing?.id || orderId;
    const remoteOrder = await cashfreeRequest(`orders/${cfOrderId}`);
    if (!existing) {
      if (!remoteOrder || remoteOrder.order_id !== cfOrderId) {
        throw new CashfreeError(404, 'order_not_found', 'Order not found.');
      }
      const reconstructedAmount = Number(remoteOrder.order_amount) || 599;
      existing = {
        id: remoteOrder.order_id,
        orderId: remoteOrder.order_id,
        cashfreeOrderId: remoteOrder.order_id,
        cfOrderId: String(remoteOrder.cf_order_id || ''),
        orderNumber: remoteOrder.order_id,
        total: reconstructedAmount,
        amount: reconstructedAmount,
        currency: remoteOrder.order_currency || 'INR',
        paymentProvider: 'Cashfree',
        paymentEnvironment: cashfreeConfig().environment,
        paymentStatus: remoteOrder.order_status === 'PAID' ? 'PAID' : 'PENDING',
        status: remoteOrder.order_status === 'PAID' ? 'PAID' : 'PENDING',
        productId: remoteOrder.order_tags?.product_id || 'linknest-pro',
        productNameSnapshot: remoteOrder.order_note || 'Digital Product',
        category: 'templates',
        orderNote: remoteOrder.order_note || 'Digital Content Purchase',
      };
    }
    if (!matchesCashfreeOrder(remoteOrder, existing)) {
      throw new CashfreeError(409, 'order_mismatch', 'Cashfree order amount or currency mismatch.');
    }

    const payments = await cashfreeRequest(`orders/${cfOrderId}/payments`);
    if (!Array.isArray(payments)) {
      throw new CashfreeError(502, 'invalid_payments', 'Invalid payment list from Cashfree.');
    }

    // Find verified SUCCESS payment matching exact paise amount and INR currency
    const expectedPaise = moneyPaise(existing.total);
    let verifiedSuccessPayment: any = null;
    let latestAttemptStatus = existing.latestPaymentStatus || 'PENDING';

    for (const p of payments) {
      if (
        p &&
        p.order_id === cfOrderId &&
        p.payment_currency === 'INR' &&
        moneyPaise(p.payment_amount) === expectedPaise &&
        providerId.test(String(p.cf_payment_id || ''))
      ) {
        if (p.payment_status === 'SUCCESS') {
          verifiedSuccessPayment = p;
          break;
        }
        if (paymentStates.has(p.payment_status)) {
          latestAttemptStatus = p.payment_status;
        }
      }
    }

    const now = new Date().toISOString();
    // Never downgrade an already PAID order
    if (existing.paymentStatus === 'PAID') {
      return existing;
    }

    if (verifiedSuccessPayment) {
      const updated = {
        ...existing,
        status: 'PAID',
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
        deliveryStatus: existing.paymentEnvironment === 'live' ? 'DELIVERED' : 'TEST_ONLY',
        downloadStatus: existing.paymentEnvironment === 'live' ? 'AVAILABLE' : 'UNAVAILABLE',
        latestPaymentStatus: 'SUCCESS',
        transactionId: String(verifiedSuccessPayment.cf_payment_id),
        cfPaymentId: String(verifiedSuccessPayment.cf_payment_id),
        paidAt: verifiedSuccessPayment.payment_completion_time || now,
        paymentVerifiedAt: now,
        updatedAt: now,
      };
      await saveV2OrderRecord(updated);
      return updated;
    }

    const isFailed = latestAttemptStatus === 'FAILED' || latestAttemptStatus === 'USER_DROPPED';
    const updated = {
      ...existing,
      status: isFailed ? 'FAILED' : 'PENDING',
      paymentStatus: isFailed ? 'FAILED' : 'PENDING',
      latestPaymentStatus: latestAttemptStatus,
      updatedAt: now,
    };
    await saveV2OrderRecord(updated);
    return updated;
  });
}

export function registerCashfreeRoutes(app: Express, auth: RequestHandler, limiter: RequestHandler) {
  // ============================================================================
  // EXISTING V1 ROUTES (Preserved for existing frontend & test suite)
  // ============================================================================
  app.post('/api/payments/cashfree/initiate', auth, limiter, async (req: any, res) => {
    const input = z.object({ orderId: z.string().regex(merchantOrderId), agreeTerms: z.literal(true) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, message: 'Accept the purchase policies and provide a valid order.' });
    if (!cashfreeConfig().configured) return res.status(503).json({ success: false, message: 'Online checkout is not configured yet.' });
    let order = await Store.getUserOrderById(req.userId, input.data.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (
      !['PENDING', 'FAILED'].includes(order.paymentStatus) ||
      order.transactionId ||
      order.razorpayOrderId ||
      (order.paymentProvider && String(order.paymentProvider).toLowerCase() !== 'cashfree') ||
      (order.cashfreeOrderId && order.paymentEnvironment !== cashfreeConfig().environment)
    )
      return res.status(409).json({ success: false, message: 'This order is not payable in the current environment. Check it in your account.' });
    const phone = String(order.customer?.phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian contact number. No mobile OTP is required.' });
    const totalPaise = moneyPaise(order.total);
    if (totalPaise === null || totalPaise < 100) return res.status(400).json({ success: false, message: 'Online checkout requires an order total of at least ₹1. Please contact support.' });
    for (const item of order.items || []) {
      const { data, error } = await supabaseAdmin().storage.from('products').info(`${item.productId}.zip`);
      if (error || !data) return res.status(503).json({ success: false, message: 'A product file is temporarily unavailable. Contact support before paying.' });
    }
    await Store.set(`policyDocuments/${policyVersion}`, policyDocuments);
    stripIncomingReferrerHeaders(req);
    let remote: any;
    if (order.cashfreeOrderId) remote = await cashfreeRequest(`orders/${order.cashfreeOrderId}`);
    else {
      try {
        remote = await cashfreeRequest(
          'orders',
          {
            order_id: order.id,
            order_amount: Number(order.total.toFixed(2)),
            order_currency: 'INR',
            customer_details: {
              customer_id: order.userId,
              customer_name: String(order.customerName || order.customer?.fullName || 'Customer').slice(0, 100),
              customer_email: order.customerEmail,
              customer_phone: phone,
            },
            order_meta: {
              return_url: `${appOrigin()}/checkout?status=pending&orderId=${encodeURIComponent(order.id)}`,
              notify_url: `${appOrigin()}/api/payments/cashfree/webhook`,
            },
            order_note: 'Booyahstudio digital products',
          },
          { headers: { 'x-idempotency-key': cashfreeIdempotencyKey(`order:${cashfreeConfig().environment}:${order.id}`) } }
        );
      } catch (error) {
        if (!(error instanceof CashfreeError) || ![400, 409].includes(error.status) || !/order.*(exist|already)|idempotency/.test(error.code))
          throw error;
        remote = await cashfreeRequest(`orders/${order.id}`);
      }
    }
    if (!matchesCashfreeOrder(remote, order) || !providerId.test(String(remote.cf_order_id || '')))
      throw new Error('Cashfree created an unexpected order');
    order = await Store.rpc('bind_cashfree', `orders/${order.id}`, {
      cashfreeOrderId: remote.order_id,
      cfOrderId: String(remote.cf_order_id),
      paymentProvider: 'Cashfree',
      paymentEnvironment: cashfreeConfig().environment,
      policyAcceptedAt: new Date().toISOString(),
      policyVersion,
    });
    if (remote.order_status === 'PAID' || order.transactionId || !['PENDING', 'FAILED'].includes(order.paymentStatus))
      return res.json({ ...cashfreeResult(await syncCashfreeOrder(order)), alreadyPaid: true });
    if (remote.order_status !== 'ACTIVE' || typeof remote.payment_session_id !== 'string' || !remote.payment_session_id)
      return res.status(409).json({ success: false, message: 'This checkout has expired. Check the order before starting another purchase.' });
    res.json({
      success: true,
      orderId: order.id,
      paymentSessionId: remote.payment_session_id,
      environment: order.paymentEnvironment,
      mode: cashfreeConfig().mode,
    });
  });

  app.post('/api/payments/cashfree/reconcile/:orderId', auth, limiter, async (req: any, res) => {
    if (typeof req.params.orderId !== 'string' || !merchantOrderId.test(req.params.orderId))
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    stripIncomingReferrerHeaders(req);
    const order = await Store.getGlobalOrder(req.params.orderId);
    const profile = await Store.getUserProfile(req.userId);
    if (!order || (order.userId !== req.userId && profile?.role !== 'admin'))
      return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.cashfreeOrderId || order.paymentEnvironment !== cashfreeConfig().environment)
      return res.status(409).json({ success: false, status: 'PENDING', message: 'Cashfree payment has not been initiated in this environment.' });
    res.json(cashfreeResult(await syncCashfreeOrder(order)));
  });

  app.post('/api/payments/cashfree/webhook', async (req: any, res) => {
    stripIncomingReferrerHeaders(req);
    if (!verifyCashfreeSignature(req.rawBody, req.get('x-webhook-signature'), req.get('x-webhook-timestamp')))
      return res.status(400).json({ success: false });
    if (!['PAYMENT_SUCCESS_WEBHOOK', 'PAYMENT_FAILED_WEBHOOK', 'PAYMENT_USER_DROPPED_WEBHOOK', 'REFUND_STATUS_WEBHOOK'].includes(req.body?.type))
      return res.json({ success: true });
    const orderId = req.body?.data?.order?.order_id || req.body?.data?.refund?.order_id;
    if (typeof orderId !== 'string' || !merchantOrderId.test(orderId)) return res.status(400).json({ success: false });
    const localId = await Store.get<string>(`cashfreeOrderIndex/${orderId}`);
    const order = localId ? await Store.getGlobalOrder(localId) : null;
    if (!order) return res.status(503).json({ success: false });
    await syncCashfreeOrder(order);
    const eventId = crypto.createHash('sha256').update(req.rawBody).digest('hex');
    await Store.rpc('record_event', `paymentEvents/cashfree_${eventId}`, { orderId: order.id, event: req.body.type, source: 'Cashfree' });
    res.json({ success: true });
  });

  // ============================================================================
  // V2 PRODUCTION ENDPOINTS (Internal Checkout + Authorized External API + UPI QR)
  // ============================================================================

  /**
   * 1. Create Order & UPI QR / Payment Session Endpoint
   * Route: POST /api/v2/payments/cashfree/create-order
   */
  app.post('/api/v2/payments/cashfree/create-order', async (req: Request, res: Response) => {
    const authCheck = isAuthorizedExternalCall(req);
    // Strip incoming referer, referrer, and origin headers immediately after authorization check
    stripIncomingReferrerHeaders(req);

    if (authCheck.isExternal && !authCheck.authorized) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized external API call. Provide a valid x-api-key or Bearer token.',
      });
    }

    const cfg = cashfreeConfig();
    if (!cfg.v2Configured) {
      return res.status(503).json({
        success: false,
        message: 'Cashfree payment gateway credentials are not configured on the server.',
      });
    }

    try {
      const body = req.body || {};
      const hasInternalItems = Array.isArray(body.items) && body.items.length > 0;
      const rawExternalAmount = body.amount ?? body.price ?? body.order_amount;

      let catalogMapping: CatalogMappingResult;
      if (hasInternalItems) {
        catalogMapping = validateInternalCartItems(body.items, PRODUCTS);
      } else if (rawExternalAmount !== undefined && rawExternalAmount !== null) {
        catalogMapping = mapExternalAmountToCatalogProduct(
          rawExternalAmount,
          body.productId || body.product_id,
          PRODUCTS
        );
      } else {
        return res.status(400).json({
          success: false,
          message: 'Provide either valid catalog `items` or an `amount` (INR >= 1).',
        });
      }

      // Generate isolated UUID-based Cashfree Order ID and Store Order Number
      const uuidHex = crypto.randomUUID().replace(/-/g, '').toUpperCase();
      const orderId = `CF-ORD-${uuidHex.slice(0, 16)}`;
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const orderNumber = `BS-${todayStr}-${uuidHex.slice(16, 26)}`;

      const rawCustomer = body.customer || body.customer_details || {
        customer_id: body.customer_id || body.customerId,
        customer_name: body.customer_name || body.customerName || body.name,
        customer_email: body.customer_email || body.customerEmail || body.email,
        customer_phone: body.customer_phone || body.customerPhone || body.phone,
        order_tags: body.order_tags || body.orderTags,
      };

      const originalCustomerData = body.originalCustomerData || null;

      const mappedCustomer = prepareCashfreeCustomerPayload(
        rawCustomer,
        authCheck.isExternal,
        catalogMapping.orderTags
      );

      const idempotencyKey = cashfreeIdempotencyKey(`v2:${cfg.environment}:${orderId}`);

      // Force generic order note with explicit Customer Self-Authorization & Terms Acceptance
      const acceptedAtIso = new Date().toISOString();
      const secureOrderNote = `Digital Content Purchase (${catalogMapping.primaryProductName}) - Customer Self-Authorized Payment & Accepted Terms and Conditions`;

      const cfOrderPayload = {
        order_id: orderId,
        order_amount: catalogMapping.totalAmount,
        order_currency: 'INR',
        customer_details: mappedCustomer.customer_details,
        order_note: secureOrderNote.slice(0, 200),
        order_tags: {
          ...mappedCustomer.order_tags,
          terms_accepted_at: acceptedAtIso,
        },
        order_meta: {
          return_url: `${appOrigin()}/api/v2/payments/cashfree/return?orderId=${encodeURIComponent(orderId)}&pkg=${encodeURIComponent(String(catalogMapping.totalAmount))}`,
          notify_url: `${appOrigin()}/api/v2/payments/cashfree/webhook`,
        },
      };

      const cfOrderResponse = await cashfreeRequest('orders', cfOrderPayload, {
        headers: { 'x-idempotency-key': idempotencyKey },
      });

      if (
        !cfOrderResponse ||
        cfOrderResponse.order_id !== orderId ||
        typeof cfOrderResponse.payment_session_id !== 'string'
      ) {
        return res.status(502).json({
          success: false,
          message: 'Unexpected response from Cashfree order creation.',
        });
      }

      // Normal Checkout API (`POST /orders` + `payment_session_id`) is used for all checkout modes.
      // S2S QR (`orders/sessions`) is only attempted if explicitly requested via `s2sQrOnly: true`,
      // and never blocks standard checkout if not enabled on the merchant account.
      let upiQrPayload: { qrCode?: string; upiLink?: string; cfPaymentId?: string } | undefined;
      if (body.s2sQrOnly === true) {
        try {
          const sessionResponse = await cashfreeRequest('orders/sessions', {
            payment_session_id: cfOrderResponse.payment_session_id,
            payment_method: {
              upi: {
                channel: 'qrcode',
              },
            },
          });
          upiQrPayload = {
            qrCode:
              sessionResponse?.data?.payload?.qrcode ||
              sessionResponse?.payload?.qrcode ||
              sessionResponse?.qrcode ||
              undefined,
            upiLink:
              sessionResponse?.data?.url ||
              sessionResponse?.data?.payload?.default ||
              undefined,
            cfPaymentId: sessionResponse?.cf_payment_id
              ? String(sessionResponse.cf_payment_id)
              : undefined,
          };
        } catch (qrErr) {
          console.warn('[Cashfree V2] S2S QR not enabled on account, using standard checkout session:', (qrErr as any)?.message);
        }
      }

      const now = acceptedAtIso;
      const orderRecord = {
        id: orderId,
        orderId,
        cashfreeOrderId: orderId,
        cfOrderId: String(cfOrderResponse.cf_order_id || ''),
        orderNumber,
        userId: mappedCustomer.customer_details.customer_id,
        customerName: mappedCustomer.customer_details.customer_name,
        customerEmail: mappedCustomer.customer_details.customer_email,
        customer: {
          fullName: mappedCustomer.customer_details.customer_name,
          email: mappedCustomer.customer_details.customer_email,
          phone: mappedCustomer.customer_details.customer_phone,
        },
        // Log original details for internal use only
        originalCustomer: originalCustomerData,
        productId: catalogMapping.primaryProductId,
        productNameSnapshot: catalogMapping.primaryProductName,
        category: catalogMapping.primaryCategory,
        orderNote: secureOrderNote.slice(0, 200),
        orderTags: cfOrderPayload.order_tags,
        customerAuthorized: true,
        termsAccepted: true,
        policyAcceptedAt: acceptedAtIso,
        policyVersion,
        items: catalogMapping.items,
        subtotal: catalogMapping.totalAmount,
        discount: 0,
        tax: 0,
        total: catalogMapping.totalAmount,
        amount: catalogMapping.totalAmount,
        currency: 'INR',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        deliveryStatus: 'PENDING',
        downloadStatus: 'UNAVAILABLE',
        paymentProvider: 'Cashfree',
        paymentEnvironment: cfg.environment,
        paymentSessionId: cfOrderResponse.payment_session_id,
        channelSource: authCheck.isExternal ? 'external_api' : 'store_checkout',
        createdAt: now,
        updatedAt: now,
      };

      await withOrderLock(orderId, () => saveV2OrderRecord(orderRecord));

      return res.status(201).json({
        success: true,
        orderId,
        orderNumber,
        cfOrderId: String(cfOrderResponse.cf_order_id || ''),
        paymentSessionId: cfOrderResponse.payment_session_id,
        amount: catalogMapping.totalAmount,
        currency: 'INR',
        environment: cfg.environment,
        mode: cfg.mode,
        product: {
          productId: catalogMapping.primaryProductId,
          productName: catalogMapping.primaryProductName,
          category: catalogMapping.primaryCategory,
          orderNote: catalogMapping.orderNote,
          items: catalogMapping.items,
        },
        ...(upiQrPayload ? { upiQr: upiQrPayload } : {}),
      });
    } catch (err: any) {
      if (err instanceof CashfreeError) {
        return res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({
          success: false,
          code: err.code || 'cashfree_error',
          message: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        message: err?.message || 'Failed to create Cashfree order.',
      });
    }
  });

  /**
   * 2. Payment Status Check Endpoint
   * Route: GET /api/v2/payments/cashfree/status
   */
  app.get('/api/v2/payments/cashfree/status', async (req: Request, res: Response) => {
    const authCheck = isAuthorizedExternalCall(req);
    stripIncomingReferrerHeaders(req);

    if (authCheck.isExternal && !authCheck.authorized) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized external API call.',
      });
    }

    const rawOrderId = String(req.query.merchantTxnId || req.query.orderId || req.query.order_id || '').trim();
    if (!merchantOrderId.test(rawOrderId)) {
      return res.status(400).json({
        success: false,
        message: 'Provide a valid `merchantTxnId` or `orderId` query parameter.',
      });
    }

    try {
      const updated = await verifyAndSyncV2Order(rawOrderId);
      const isPaid = updated.paymentStatus === 'PAID';
      return res.json({
        success: true,
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.paymentStatus,
        paid: isPaid,
        amount: updated.total,
        currency: updated.currency,
        transactionId: updated.transactionId || null,
        product: {
          productId: updated.productId,
          productName: updated.productNameSnapshot,
          category: updated.category,
          orderNote: updated.orderNote,
        },
        updatedAt: updated.updatedAt,
      });
    } catch (err: any) {
      if (err instanceof CashfreeError) {
        return res.status(err.status).json({
          success: false,
          code: err.code,
          message: err.message,
        });
      }
      return res.status(502).json({
        success: false,
        message: 'Could not verify payment status with Cashfree.',
      });
    }
  });

  /**
   * 2b. Standard Checkout Return Redirect Handler
   * Route: GET /api/v2/payments/cashfree/return
   */
  app.get('/api/v2/payments/cashfree/return', async (req: Request, res: Response) => {
    stripIncomingReferrerHeaders(req);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    const rawOrderId = String(req.query.orderId || req.query.order_id || '').trim();
    const rawPkg = String(req.query.pkg || '599').replace(/[^0-9]/g, '') || '599';

    if (!merchantOrderId.test(rawOrderId)) {
      return res.redirect(302, `/booyahpay?status=failed&pkg=${encodeURIComponent(rawPkg)}`);
    }

    try {
      const updated = await verifyAndSyncV2Order(rawOrderId);
      const isPaid = updated.paymentStatus === 'PAID';
      const pkgVal = String(updated.total || rawPkg);
      return res.redirect(
        302,
        `/booyahpay?status=${isPaid ? 'success' : 'failed'}&pkg=${encodeURIComponent(pkgVal)}`
      );
    } catch {
      return res.redirect(302, `/booyahpay?status=failed&pkg=${encodeURIComponent(rawPkg)}`);
    }
  });

  /**
   * 3. Cashfree V2 Webhook Handler
   * Route: POST /api/v2/payments/cashfree/webhook
   */
  app.post('/api/v2/payments/cashfree/webhook', async (req: any, res: Response) => {
    stripIncomingReferrerHeaders(req);

    if (!verifyCashfreeSignature(req.rawBody, req.get('x-webhook-signature'), req.get('x-webhook-timestamp'))) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const eventType = String(req.body?.type || '');
    if (!['PAYMENT_SUCCESS_WEBHOOK', 'PAYMENT_FAILED_WEBHOOK', 'PAYMENT_USER_DROPPED_WEBHOOK'].includes(eventType)) {
      return res.json({ success: true, ignored: true });
    }

    const orderId = String(req.body?.data?.order?.order_id || '').trim();
    if (!merchantOrderId.test(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order_id in webhook payload.' });
    }

    const eventHash = crypto.createHash('sha256').update(req.rawBody).digest('hex');
    const eventKey = `paymentEvents/cashfree_v2_${eventHash}`;

    try {
      const alreadyProcessed = await FirebaseRtdb.get<any>(eventKey);
      if (alreadyProcessed) {
        return res.json({ success: true, idempotent: true, orderId });
      }

      const updated = await verifyAndSyncV2Order(orderId);
      await FirebaseRtdb.set(eventKey, {
        orderId,
        eventType,
        processedAt: new Date().toISOString(),
        paymentStatus: updated.paymentStatus,
      });

      return res.json({
        success: true,
        orderId: updated.id,
        status: updated.paymentStatus,
      });
    } catch (err: any) {
      if (err instanceof CashfreeError && err.status === 404) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
      return res.status(503).json({ success: false, message: 'Webhook processing failed; retry.' });
    }
  });
}
