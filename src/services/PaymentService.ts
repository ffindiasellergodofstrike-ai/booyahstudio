export class PaymentService {
 static async initiateCashfreePayment(orderId: string, agreeTerms: boolean) {
  const response = await fetch('/api/payments/cashfree/initiate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, agreeTerms }) });
  const data = await response.json();
  if (!response.ok) return { ...data, success: false };
  return data;
 }
 static async initiateRazorpayPayment(orderId: string, agreeTerms: boolean) {
  const response = await fetch('/api/payments/razorpay/initiate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, agreeTerms }) });
  return response.json();
 }
}
