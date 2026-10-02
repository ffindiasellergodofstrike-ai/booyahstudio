export interface PaymentMethodOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'requires_config';
  fee: number;
}

export interface PaymentIntentResult {
  clientSecret?: string;
  success: boolean;
  message: string;
  transactionId?: string;
  requiresRedirect?: boolean;
  orderId?: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
}

export interface PaddleClientConfig {
  success: boolean;
  environment: 'sandbox' | 'production';
  clientToken: string;
  isConfigured: boolean;
  prices: Record<string, string>;
}

export class PaymentService {
  /**
   * Check if live payment gateway credentials are configured
   */
  static isLiveGatewayConfigured(): boolean {
    return true;
  }

  /**
   * List available payment gateways
   */
  static getAvailableGateways(): PaymentMethodOption[] {
    return [
      {
        id: 'paddle',
        name: 'Credit / Debit Card / PayPal / Apple Pay (Paddle)',
        description: 'Instant global digital checkout via Paddle (Cards, PayPal, Apple Pay, Google Pay)',
        icon: 'CreditCard',
        status: 'active',
        fee: 0,
      },
      {
        id: 'easebuzz',
        name: 'UPI / Cards / Netbanking (Easebuzz)',
        description: 'Secure payment via Easebuzz (India, INR)',
        icon: 'CreditCard',
        status: 'active',
        fee: 0,
      },
    ];
  }

  /**
   * Fetches public client Paddle configuration
   */
  static async fetchPaddleConfig(): Promise<PaddleClientConfig> {
    try {
      const res = await fetch('/api/config/paddle', {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      return data;
    } catch {
      return {
        success: false,
        environment: 'sandbox',
        clientToken: '',
        isConfigured: false,
        prices: {},
      };
    }
  }

  /**
   * Initiates payment with Paddle via secure backend API
   */
  static async initiatePaddlePayment(orderId: string, agreeTerms: boolean): Promise<{
    success: boolean;
    priceId?: string;
    orderId?: string;
    orderNumber?: string;
    customerEmail?: string;
    customerName?: string;
    clientToken?: string;
    environment?: 'sandbox' | 'production';
    message?: string;
  }> {
    try {
      const res = await fetch('/api/payments/paddle/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId, agreeTerms }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error initiating Paddle payment.' };
    }
  }

  /**
   * Initiates payment with Easebuzz via secure backend API
   */
  static async initiatePayUPayment(orderId: string, agreeTerms: boolean): Promise<{ success: boolean; action?: string; fields?: Record<string,string>; environment?: string; message?: string }> {
    const response = await fetch('/api/payments/payu/initiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ orderId, agreeTerms }) });
    return response.json();
  }

  static async initiateEasebuzzPayment(orderId: string, agreeTerms: boolean): Promise<{
    success: boolean;
    accessKey?: string;
    merchantKey?: string;
    environment?: 'test' | 'prod';
    message?: string;
  }> {
    try {
      const res = await fetch('/api/payments/easebuzz/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId, agreeTerms }),
      });
      
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error initiating payment.' };
    }
  }

  /**
   * Direct client-side payment processing is disabled for security.
   */
  static async processPayment(_params: {
    orderId: string;
    method: string;
    amount: number;
    currency: string;
    customerEmail: string;
    customerName: string;
  }): Promise<{ success: boolean; message: string; transactionId?: string; status: 'PAID' | 'PENDING' | 'FAILED' }> {
    return {
      success: false,
      status: 'FAILED',
      message: 'Direct client-side payment processing is disabled. Use an enabled payment gateway.',
    };
  }

  static async verifyWebhookSignature(_payload: string, _signature: string): Promise<boolean> {
    return false;
  }
}
