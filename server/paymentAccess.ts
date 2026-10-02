import { hasLivePayment } from '../src/services/PaymentEnvironment';
import { FirebaseRtdb } from './firebaseRtdb';
import { generateEasebuzzRetrieveHash } from './easebuzz';

export function isPaidOrderForProduct(order: any, userId: string, productId: string): boolean {
  const provider = String(order?.paymentProvider || '').toLowerCase();
  return Boolean(
    order && hasLivePayment(order) && order.userId === userId &&
    String(order.paymentStatus).toUpperCase() === 'PAID' &&
    (provider === 'easebuzz' || provider === 'paddle' || provider === 'payu') && Boolean(order.transactionId) &&
    !['REFUNDED', 'PARTIALLY_REFUNDED', 'REVOKED', 'CANCELLED', 'FAILED'].includes(String(order.status).toUpperCase()) &&
    order.deliveryStatus === 'DELIVERED' && order.downloadStatus === 'AVAILABLE' &&
    Array.isArray(order.items) && order.items.some((item: any) => item.productId === productId)
  );
}

export async function findPaidPurchase(
  userId: string,
  productId: string,
  purchaseId?: string,
  orderId?: string
): Promise<any | null> {
  const purchases = await FirebaseRtdb.getUserPurchases(userId);
  for (const purchase of purchases) {
    if (!purchase || purchase.userId !== userId || purchase.productId !== productId ||
        purchase.accessStatus !== 'active' || !purchase.orderId || !purchase.purchaseId ||
        (purchaseId && purchase.purchaseId !== purchaseId) ||
        (orderId && purchase.orderId !== orderId)) continue;
    const order = await FirebaseRtdb.getGlobalOrder(purchase.orderId);
    if (isPaidOrderForProduct(order, userId, productId)) return purchase;
  }
  return null;
}

export function easebuzzRetrieveHash(key: string, txnid: string, salt: string): string {
  return generateEasebuzzRetrieveHash({ key, txnid, salt });
}

export function matchesEasebuzzPaymentIdentity(data: any, order: any, merchantKey: string): boolean {
  const expectedAmount = Number(order.total);
  const receivedAmount = Number(data?.amount);
  return Boolean(
    data &&
    data.txnid === (order.easebuzzTxnId || order.transactionId || order.orderNumber || order.id) &&
    (!data.key || data.key === merchantKey) &&
    Number.isFinite(expectedAmount) && expectedAmount > 0 &&
    Number.isFinite(receivedAmount) && receivedAmount > 0 &&
    Math.round(expectedAmount * 100) === Math.round(receivedAmount * 100)
  );
}

export function matchesVerifiedEasebuzzPayment(data: any, order: any, merchantKey: string): boolean {
  return matchesEasebuzzPaymentIdentity(data, order, merchantKey) &&
    String(data.status).toLowerCase() === 'success';
}
