import { hasLivePayment } from './PaymentEnvironment';
import type { Order } from '../types';

export const isConfirmedPaidOrder = (order: Order | null): order is Order => {
  const provider = String(order?.paymentProvider || '').toLowerCase();
  return Boolean(
    order && order.paymentStatus?.toUpperCase() === 'PAID' &&
    (provider === 'easebuzz' || provider === 'paddle' || provider === 'payu') && order.transactionId &&
    !['REFUNDED', 'PARTIALLY_REFUNDED', 'REVOKED', 'CANCELLED', 'FAILED'].includes(String(order.status).toUpperCase())
  );
};

export const isVerifiedPaidOrder = (order: Order | null): order is Order => Boolean(
  isConfirmedPaidOrder(order) && hasLivePayment(order) &&
  order.deliveryStatus === 'DELIVERED' && order.downloadStatus === 'AVAILABLE'
);

export type ReconciliationResult = {
  success?: boolean;
  status?: string;
  message?: string;
  httpStatus: number;
};

export type PaymentVerificationResult =
  | { kind: 'paid'; order: Order }
  | { kind: 'pending'; message?: string }
  | { kind: 'failed'; message: string }
  | { kind: 'auth_required' };

/** The browser callback is only a hint; payment comes from the server order. */
export async function verifyReturnedPayment(
  getOrder: () => Promise<Order | null>,
  reconcile: () => Promise<ReconciliationResult>,
): Promise<PaymentVerificationResult> {
  let order = await getOrder();
  if (isConfirmedPaidOrder(order)) return { kind: 'paid', order };

  const result = await reconcile();
  if (result.httpStatus === 401) return { kind: 'auth_required' };
  if (result.success || result.status === 'FAILED' || result.status === 'REVOKED') {
    order = await getOrder();
    if (isConfirmedPaidOrder(order)) return { kind: 'paid', order };
  }
  if (result.status === 'REVOKED' || result.status === 'FAILED') {
    return { kind: 'failed', message: result.message || 'The payment gateway did not confirm this payment.' };
  }
  return { kind: 'pending', message: result.message };
}
