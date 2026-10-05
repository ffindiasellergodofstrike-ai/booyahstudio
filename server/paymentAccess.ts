import { hasLivePayment } from '../src/services/PaymentEnvironment';
import { Store } from './store';

export function isPaidOrderForProduct(order: any, userId: string, productId: string): boolean {
  const provider = String(order?.paymentProvider || '').toLowerCase();
  return Boolean(
    order && hasLivePayment(order) && order.userId === userId &&
    String(order.paymentStatus).toUpperCase() === 'PAID' &&
    provider === 'razorpay' && Boolean(order.transactionId) &&
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
  const purchases = await Store.getUserPurchases(userId);
  for (const purchase of purchases) {
    if (!purchase || purchase.userId !== userId || purchase.productId !== productId ||
        purchase.accessStatus !== 'active' || !purchase.orderId || !purchase.purchaseId ||
        (purchaseId && purchase.purchaseId !== purchaseId) ||
        (orderId && purchase.orderId !== orderId)) continue;
    const order = await Store.getGlobalOrder(purchase.orderId);
    if (isPaidOrderForProduct(order, userId, productId)) return purchase;
  }
  return null;
}
