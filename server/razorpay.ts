import { policyVersion, policyDocuments } from './policies';
import crypto from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import { Store } from './store';
import { sendOrderEmail, sendRefundEmail } from './orderEmail';
import { supabaseAdmin } from './supabase';
export const paymentEnvironment = () => process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_') ? 'live' : 'test';
export function verifySignature(body: string | Buffer, signature: unknown, secret: string): boolean {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return crypto.timingSafeEqual(crypto.createHmac('sha256', secret).update(body).digest(), Buffer.from(signature, 'hex'));
}
export function matchesPaymentReference(payment: any, order: any): boolean {
  return Boolean(/^pay_[A-Za-z0-9]+$/.test(payment?.id || '') && order?.razorpayOrderId && payment?.order_id === order.razorpayOrderId &&
    payment.currency === 'INR' && Number.isSafeInteger(payment.amount) && payment.amount === Math.round(order.total * 100) &&
    order.paymentEnvironment === paymentEnvironment() && ['created', 'authorized', 'captured', 'refunded', 'failed'].includes(payment.status) &&
    (!['captured', 'refunded'].includes(payment.status) || payment.captured === true) && Number.isSafeInteger(payment.amount_refunded) && payment.amount_refunded >= 0 && payment.amount_refunded <= payment.amount);
}
export function matchesPayment(payment: any, order: any): boolean {
  return matchesPaymentReference(payment, order) && ['captured', 'refunded'].includes(payment.status);
}
export async function razorpayRequest(endpoint: string, body?: unknown) {
  const key = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new Error('Payment gateway unavailable');
  const response = await fetch(`https://api.razorpay.com/v1/${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Payment provider request failed');
  return response.json();
}
export async function syncPayment(order: any, payment: any) {
  if (!matchesPaymentReference(payment, order)) throw new Error('Payment mismatch');
  const saved = await Store.rpc('confirm_payment', `orders/${order.id}`, { id: payment.id, order_id: payment.order_id, amount: payment.amount, currency: payment.currency, status: payment.status, amount_refunded: payment.amount_refunded, environment: paymentEnvironment(), providerCreatedAt: payment.created_at || null });
  if (saved.paymentStatus === 'PAID' && saved.transactionId === payment.id && saved.deliveryStatus !== 'REVOKED') await sendOrderEmail(saved);
  if (saved.paymentStatus === 'REFUNDED' && saved.transactionId === payment.id) await sendRefundEmail(saved);
  return saved;
}
const disputeEvents = ['payment.dispute.created', 'payment.dispute.won', 'payment.dispute.lost', 'payment.dispute.closed', 'payment.dispute.under_review', 'payment.dispute.action_required'];
export async function syncDispute(order: any, disputeId: unknown) {
  if (typeof disputeId !== 'string' || !/^disp_[A-Za-z0-9]+$/.test(disputeId)) throw new Error('Invalid dispute');
  const dispute = await razorpayRequest(`disputes/${disputeId}`);
  if (dispute.id !== disputeId || !order.payments?.[dispute.payment_id] || dispute.currency !== 'INR' ||
      !Number.isSafeInteger(dispute.amount) || dispute.amount < 0 || dispute.amount > Math.round(order.total * 100) ||
      !['open', 'won', 'lost', 'closed', 'under_review', 'action_required'].includes(dispute.status)) throw new Error('Dispute mismatch');
  // Allowlist fields: never retain provider payloads/card or authentication data.
  return Store.rpc('record_dispute', `orders/${order.id}`, {
    id: dispute.id, payment_id: dispute.payment_id, amount: dispute.amount, currency: dispute.currency,
    status: dispute.status, reason_code: String(dispute.reason_code || '').slice(0, 200),
    respond_by: dispute.respond_by || null, created_at: dispute.created_at || null,
  });
}
export function registerRazorpayRoutes(app: Express, auth: RequestHandler, limiter: RequestHandler) {
  app.get('/api/config/payments', (_req, res) => res.json({ success: true, gateways: { razorpay: { configured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.RAZORPAY_WEBHOOK_SECRET), environment: paymentEnvironment() } } }));
  app.post('/api/payments/razorpay/initiate', auth, limiter, async (req: any, res) => {
    if (req.body.agreeTerms !== true) return res.status(400).json({ success: false, message: 'Please accept the purchase policies.' });
    let order = await Store.getUserOrderById(req.userId, req.body.orderId);
    if (!order || order.paymentStatus !== 'PENDING') return res.status(409).json({ success: false, message: 'Order is not payable.' });
    if (order.razorpayOrderId && order.paymentEnvironment !== paymentEnvironment()) return res.status(409).json({ success: false, message: 'Create a new order for the current payment environment.' });
    // Verify every product ZIP exists before accepting payment.
    for (const item of order.items) {
      const { data, error } = await supabaseAdmin().storage.from('products').info(`${item.productId}.zip`);
      if (error || !data) return res.status(503).json({ success: false, message: 'A product file is temporarily unavailable. Contact support.' });
    }
    await Store.set(`policyDocuments/${policyVersion}`, policyDocuments);
    if (!order.razorpayOrderId) {
      const remote = await razorpayRequest('orders', { amount: Math.round(order.total * 100), currency: 'INR', receipt: order.id, notes: { store_order_id: order.id } });
      if (!/^order_[A-Za-z0-9]+$/.test(remote.id) || remote.amount !== Math.round(order.total * 100) || remote.currency !== 'INR') throw new Error('Unexpected payment order');
      order = await Store.rpc('bind_payment', `orders/${order.id}`, { razorpayOrderId: remote.id, paymentProvider: 'Razorpay', paymentEnvironment: paymentEnvironment(), policyAcceptedAt: new Date().toISOString(), policyVersion });
    }
    res.json({ success: true, key: process.env.RAZORPAY_KEY_ID, razorpayOrderId: order.razorpayOrderId, amount: Math.round(order.total * 100), currency: 'INR', environment: order.paymentEnvironment });
  });
  app.post('/api/payments/razorpay/verify', auth, limiter, async (req: any, res) => {
    const order = await Store.getUserOrderById(req.userId, req.body.orderId);
    const paymentId = req.body.razorpay_payment_id;
    if (!order?.razorpayOrderId || !/^pay_[A-Za-z0-9]+$/.test(paymentId || '') || req.body.razorpay_order_id !== order.razorpayOrderId || !verifySignature(`${order.razorpayOrderId}|${paymentId}`, req.body.razorpay_signature, process.env.RAZORPAY_KEY_SECRET || '')) return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    const payment = await razorpayRequest(`payments/${paymentId}`);
    if (payment.id !== paymentId || !matchesPaymentReference(payment, order)) return res.status(409).json({ success: false, message: 'Payment does not match this order.' });
    const saved = await syncPayment(order, payment);
    res.json({ success: saved.paymentStatus === 'PAID' && saved.deliveryStatus !== 'REVOKED', status: saved.deliveryStatus === 'REVOKED' ? 'REVOKED' : saved.paymentStatus });
  });
  app.post('/api/payments/razorpay/reconcile/:orderId', auth, async (req: any, res) => {
    const order = await Store.getGlobalOrder(req.params.orderId);
    const profile = await Store.getUserProfile(req.userId);
    if (!order || (order.userId !== req.userId && profile?.role !== 'admin')) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.razorpayOrderId || order.paymentEnvironment !== paymentEnvironment()) return res.status(409).json({ success: false, status: 'PENDING', message: 'Payment has not been initiated in this environment.' });
    const result = await razorpayRequest(`orders/${order.razorpayOrderId}/payments`);
    let saved = order;
    for (const payment of result.items || []) { if (matchesPaymentReference(payment, saved)) saved = await syncPayment(saved, payment); }
    for (const disputeId of Object.keys(saved.disputes || {})) saved = await syncDispute(saved, disputeId);
    res.json({ success: saved.paymentStatus === 'PAID' && saved.deliveryStatus !== 'REVOKED', status: saved.deliveryStatus === 'REVOKED' ? 'REVOKED' : saved.paymentStatus });
  });
  app.post('/api/payments/razorpay/checkout-closed', auth, limiter, async (req: any, res) => {
    const order = await Store.getUserOrderById(req.userId, req.body.orderId);
    if (!order) return res.status(404).json({ success: false });
    await Store.rpc('order_note', `orders/${order.id}`, { checkoutClosedAt: new Date().toISOString(), checkoutClosedSource: 'customer_browser' });
    res.json({ success: true, message: 'Checkout closure recorded; payment remains subject to provider verification.' });
  });
  app.post('/api/payments/razorpay/webhook', async (req: any, res) => {
    if (!Buffer.isBuffer(req.rawBody) || !verifySignature(req.rawBody, req.get('x-razorpay-signature'), process.env.RAZORPAY_WEBHOOK_SECRET || '')) return res.status(400).json({ success: false });
    const event = req.body;
    if (!['payment.captured', 'payment.failed', 'payment.authorized', 'order.paid', 'refund.processed', ...disputeEvents].includes(event.event)) return res.json({ success: true });
    const paymentId = event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.payment_id || event.payload?.dispute?.entity?.payment_id;
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId || '')) return res.status(400).json({ success: false });
    // Fetch current provider state; late or duplicate events cannot restore refunded access.
    const payment = await razorpayRequest(`payments/${paymentId}`);
    const id = await Store.get<string>(`paymentTxnIndex/${payment.order_id}`);
    if (!id) return res.status(503).json({ success: false }); // Retry if binding has not committed yet.
    const order = await Store.getGlobalOrder(id);
    if (payment.id !== paymentId || !matchesPaymentReference(payment, order)) return res.status(409).json({ success: false });
    const saved = await syncPayment(order, payment);
    if (disputeEvents.includes(event.event)) await syncDispute(saved, event.payload?.dispute?.entity?.id);
    const eventId = crypto.createHash('sha256').update(req.get('x-razorpay-event-id') || req.rawBody).digest('hex');
    await Store.rpc('record_event', `paymentEvents/${eventId}`, { orderId: order.id, paymentId, event: event.event, providerCreatedAt: event.created_at || null });
    res.json({ success: true });
  });
}
