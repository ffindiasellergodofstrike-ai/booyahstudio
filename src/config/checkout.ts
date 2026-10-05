export type CheckoutProvider = 'razorpay';
export type GatewayAvailability = Partial<Record<CheckoutProvider, { configured: boolean; environment: string }>>;
export function selectCustomerCheckout(gateways: GatewayAvailability, _singleItem = true): CheckoutProvider | null {
 return gateways.razorpay?.configured && ['live', 'test'].includes(gateways.razorpay.environment) ? 'razorpay' : null;
}
