import { Resend } from 'resend';
import { Store } from './store';
import { BUSINESS } from '../src/config/business';
import { appOrigin } from './config';

async function notify(order: any, refund: boolean) {
  const kind = refund ? 'refundEmailDelivery' : 'emailDelivery';
  if ((!refund && (order.paymentStatus !== 'PAID' || order.deliveryStatus === 'REVOKED')) ||
      (refund && order.paymentStatus !== 'REFUNDED')) return;
  const notificationId = `${refund ? `refund-${Math.round(order.refundedAmount * 100)}` : 'order'}-${order.id}`;
  if (order[kind]?.status === 'sent' && (!refund || order[kind]?.notificationId === notificationId)) return;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    await Store.rpc('email_status', `orders/${order.id}`, { kind, status: 'not_configured' });
    return;
  }
  const origin = appOrigin();
  if (!await Store.rpc('claim_email', `notifications/${notificationId}`, { now: Date.now() })) return;
  try {
    const live = order.paymentEnvironment === 'live';
    const subject = refund ? 'refund recorded' : live ? 'order confirmed' : 'test payment recorded';
    const detail = refund
      ? `Refund recorded by the payment provider: INR ${Number(order.refundedAmount).toFixed(2)}. Bank credit timing depends on your payment provider/bank. Contact support if unresolved. Further downloads are restricted pending resolution.`
      : live ? `Sign in to download your products: ${origin}/account` : 'This was a test transaction. No real purchase or product access was created.';
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_EMAIL, to: order.customerEmail,
      subject: `${BUSINESS.name}: ${subject} ${order.id}`,
      text: `${BUSINESS.owner} | ${BUSINESS.legalName} | ${BUSINESS.name}\nGSTIN: ${BUSINESS.gstin}\n${BUSINESS.address}\n\nOrder: ${order.id}\nAmount: INR ${Number(order.total).toFixed(2)}\n${detail}\n\nSupport: ${BUSINESS.email}\nWhatsApp: ${BUSINESS.phone}`,
    }, { idempotencyKey: notificationId });
    if (result.error || !result.data?.id) throw new Error('Email rejected');
    const state = { status: 'sent', notificationId, emailId: result.data.id, sentAt: new Date().toISOString() };
    await Store.update(`notifications/${notificationId}`, state);
    await Store.rpc('email_status', `orders/${order.id}`, { kind, ...state });
  } catch {
    // Preserve provider idempotency and leave an expired-window retry for manual review.
    const current = await Store.get<any>(`notifications/${notificationId}`);
    if (current?.status === 'sent') {
      await Store.rpc('email_status', `orders/${order.id}`, { kind, ...current });
      return;
    }
    await Store.update(`notifications/${notificationId}`, { status: 'failed' });
    await Store.rpc('email_status', `orders/${order.id}`, { kind, status: 'failed', notificationId });
  }
}
export async function sendOrderEmail(order: any) { await notify(order, false); }
export async function sendRefundEmail(order: any) { await notify(order, true); }
