export type CheckoutProvider = 'cashfree' | 'razorpay';
export type GatewayAvailability = Partial<Record<CheckoutProvider, { configured: boolean; environment: string }>>;
export function selectCustomerCheckout(gateways: GatewayAvailability, _singleItem = true): CheckoutProvider | null {
 if (gateways.cashfree?.configured && ['live', 'test'].includes(gateways.cashfree.environment)) return 'cashfree';
 return gateways.razorpay?.configured && ['live', 'test'].includes(gateways.razorpay.environment) ? 'razorpay' : null;
}
