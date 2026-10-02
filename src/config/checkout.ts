export type CheckoutProvider = 'easebuzz' | 'payu' | 'paddle';
export type GatewayAvailability = Partial<Record<CheckoutProvider, { configured: boolean; environment: string }>>;

/** Customer checkout only offers a configured production payment flow. */
export function selectCustomerCheckout(gateways: GatewayAvailability, allowPaddle = true): CheckoutProvider | null {
  return (['easebuzz', 'payu', 'paddle'] as const).find(provider =>
    (provider !== 'paddle' || allowPaddle) && gateways[provider]?.configured === true && gateways[provider]?.environment === 'live'
  ) || null;
}
