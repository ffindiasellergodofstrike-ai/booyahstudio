export const db = null;
export async function saveRtdbOrder(_path: string, orderData: any, _key?: string) {
  // Store order via backend API
  try {
    await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: orderData.items || [],
        customer: orderData.customerData || orderData.shippingAddress || {},
        discountCode: '',
      }),
    });
  } catch (err) {
    console.warn('Firebase shim order save error:', err);
  }
}
