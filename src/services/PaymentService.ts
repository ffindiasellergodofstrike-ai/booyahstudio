export class PaymentService {
 static async initiateRazorpayPayment(orderId: string, agreeTerms: boolean) {
  const response = await fetch('/api/payments/razorpay/initiate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, agreeTerms }) });
  return response.json();
 }
}
