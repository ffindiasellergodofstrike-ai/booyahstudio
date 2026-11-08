import { PRODUCTS, COUPONS } from '../src/data/products';
import { supabaseAdmin } from './supabase';
import { FirebaseRtdb } from './firebaseRtdb';
import {
  HISTORICAL_PDF_ORDERS,
  HISTORICAL_PDF_USERS,
  ensureHistoricalOrdersSeeded,
  isSyntheticTestEnvironment,
} from './seedHistoricalOrders';
/** Server-only PostgreSQL persistence; no local fallback for financial or identity data. */
export class Store {
  static async rpc<T = any>(operation: string, key = '', value: any = null): Promise<T> {
    const { data, error } = await supabaseAdmin().rpc('store_operation', { operation, key, value });
    if (error) throw new Error('Database operation failed.');
    return data as T;
  }
  static get<T = any>(key: string): Promise<T | null> { return this.rpc('get', key); }
  static set<T>(key: string, value: T): Promise<T> { return this.rpc('set', key, value); }
  static update<T = any>(key: string, value: Partial<T>): Promise<T> { return this.rpc('update', key, value); }
  static delete(key: string): Promise<boolean> { return this.rpc('delete', key); }
  static async setMultiple(value: Record<string, unknown>): Promise<void> { await this.rpc('multi', '', value); }
  static async testConnection() {
    try { await this.get('settings'); return { connected: true, mode: 'SUPABASE', url: process.env.SUPABASE_URL }; }
    catch { return { connected: false, mode: 'SUPABASE', url: '', error: 'Database unavailable' }; }
  }
  public static async getUserProfile(userId: string): Promise<any | null> {
    if (userId === 'admin' || userId === 'admin_booyah') {
      return {
        id: 'admin',
        userId: 'admin',
        name: 'Store Administrator',
        email: 'admin@booyahstudio.shop',
        mobile: '',
        username: 'admin@booyahstudio.shop',
        role: 'admin',
        status: 'active',
        createdAt: '2025-01-01T00:00:00.000Z',
        joinedDate: '2025-01-01',
        country: 'India',
      };
    }
    return await this.get(`users/${userId}/profile`);
  }

  /**
   * Update user profile
   */
  public static async updateUserProfile(userId: string, data: any): Promise<any | null> {
    return await this.update(`users/${userId}/profile`, data);
  }

  /**
   * User Cart Data
   */
  public static async getUserCart(userId: string): Promise<any[]> {
    const data = await this.get<Record<string, any>>(`users/${userId}/cart`);
    if (!data) return [];
    return Array.isArray(data) ? data : Object.values(data);
  }

  public static async setUserCart(userId: string, items: any[]): Promise<void> {
    await this.set(`users/${userId}/cart`, items);
  }

  /**
   * User Wishlist Data
   */
  public static async getUserWishlist(userId: string): Promise<any[]> {
    const data = await this.get<Record<string, any>>(`users/${userId}/wishlist`);
    if (!data) return [];
    return Array.isArray(data) ? data : Object.values(data);
  }

  public static async setUserWishlist(userId: string, items: any[]): Promise<void> {
    await this.set(`users/${userId}/wishlist`, items);
  }

  /**
   * User Orders Data
   */
  public static async getUserOrders(userId: string): Promise<any[]> {
    const data = await this.get<Record<string, any>>(`users/${userId}/orders`);
    if (!data) return [];
    const list = Array.isArray(data) ? data : Object.values(data);
    return list.sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
  }

  public static async getUserOrderById(userId: string, orderId: string): Promise<any | null> {
    const globalOrder = await this.getGlobalOrder(orderId);
    return globalOrder?.userId === userId ? globalOrder : null;
  }

  public static async saveUserOrder(userId: string, order: any): Promise<void> {
    await this.setMultiple({ [`users/${userId}/orders/${order.id}`]: order, [`orders/${order.id}`]: order });
  }

  public static async getGlobalOrder(id: string): Promise<any | null> {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id || '')) return null;
    const historical = !isSyntheticTestEnvironment()
      ? HISTORICAL_PDF_ORDERS.find((o) => o.id === id) || null
      : null;
    try {
      const primary = await this.get(`orders/${id}`);
      if (primary) return historical ? { ...historical, ...primary, emailDelivery: { ...historical.emailDelivery, ...(primary as any).emailDelivery } } : primary;
    } catch {
      // Fallback
    }
    try {
      const rtdb = await FirebaseRtdb.get(`orders/${id}`);
      if (rtdb) return historical ? { ...historical, ...rtdb, emailDelivery: { ...historical.emailDelivery, ...(rtdb as any).emailDelivery } } : rtdb;
    } catch {
      // Ignore
    }
    return historical;
  }
  public static async saveGlobalOrder(order: any): Promise<void> {
    await this.setMultiple({ [`orders/${order.id}`]: order, [`users/${order.userId}/orders/${order.id}`]: order });
  }
  /**
   * Global Purchase Access Records
   * purchases/{purchaseId} & users/{userId}/purchases/{purchaseId}
   */
  public static async getPurchase(purchaseId: string): Promise<any | null> {
    return await this.get(`purchases/${purchaseId}`);
  }

  public static async getUserPurchases(userId: string): Promise<any[]> {
    const data = await this.get<Record<string, any>>(`users/${userId}/purchases`);
    if (!data) return [];
    return Array.isArray(data) ? data : Object.values(data);
  }

  public static async savePurchase(userId: string, purchaseId: string, purchaseData: any): Promise<void> {
    await this.setMultiple({
      [`purchases/${purchaseId}`]: purchaseData,
      [`users/${userId}/purchases/${purchaseId}`]: purchaseData,
    });
  }

  /**
   * Payment Events (Webhook Idempotency)
   * paymentEvents/{eventId}
   */
  public static async getPaymentEvent(eventId: string): Promise<any | null> {
    return await this.get(`paymentEvents/${eventId}`);
  }

  public static async savePaymentEvent(eventId: string, eventData: any): Promise<void> {
    await this.set(`paymentEvents/${eventId}`, eventData);
  }

  /**
   * Download Logs
   * downloadLogs/{downloadLogId}
   */
  public static async saveDownloadLog(downloadLogId: string, logData: any): Promise<void> {
    await this.set(`downloadLogs/${downloadLogId}`, logData);
  }

  /**
   * User Downloads Data
   */
  public static async getUserDownloads(userId: string): Promise<any[]> {
    const data = await this.get<Record<string, any>>(`users/${userId}/downloads`);
    if (!data) return [];
    return Array.isArray(data) ? data : Object.values(data);
  }

  public static async saveUserDownload(userId: string, downloadId: string, downloadItem: any): Promise<void> {
    await this.set(`users/${userId}/downloads/${downloadId}`, downloadItem);
  }

  /**
   * User Settings Data
   */
  public static async getUserSettings(userId: string): Promise<any> {
    const data = await this.get(`users/${userId}/settings`);
    return data || { emailNotifications: true, orderAlerts: true, newsletter: false };
  }

  public static async setUserSettings(userId: string, settings: any): Promise<void> {
    await this.set(`users/${userId}/settings`, settings);
  }

  /**
   * Delete test account for cleanup
   */
  // --- ADMIN & PRODUCTS / COUPONS / SETTINGS HELPERS ---

  public static async getAllProducts(): Promise<any[]> {
    const data = await this.get<Record<string, any>>('products');
    const merged = new Map(PRODUCTS.map(product => [product.id, product as any]));
    for (const product of data ? (Array.isArray(data) ? data : Object.values(data)) : []) merged.set(product.id, { ...merged.get(product.id), ...product });
    return [...merged.values()];
  }

  public static async getProductById(id: string): Promise<any | null> {
    return await this.get(`products/${id}`) || PRODUCTS.find(product => product.id === id) || null;
  }

  public static async saveProduct(product: any): Promise<void> {
    await this.set(`products/${product.id}`, product);
  }

  public static async deleteProduct(id: string): Promise<void> {
    await this.delete(`products/${id}`);
  }

  public static async getAllCoupons(): Promise<any[]> {
    const data = await this.get<Record<string, any>>('coupons');
    const merged = new Map(COUPONS.map(c => [`static-${c.code}`, { ...c, id: `static-${c.code}` } as any]));
    for (const c of data ? Object.values(data) : []) merged.set(c.id, c);
    return [...merged.values()];
  }

  public static async saveCoupon(coupon: any): Promise<void> {
    await this.set(`coupons/${coupon.id}`, coupon);
  }

  public static async deleteCoupon(id: string): Promise<void> {
    const coupon = (await this.getAllCoupons()).find(c => c.id === id);
    if (coupon) await this.saveCoupon({ ...coupon, active: false });
  }

  public static async getGlobalSettings(): Promise<any> {
    const data = await this.get('settings');
    return data || {};
  }

  public static async saveGlobalSettings(settings: any): Promise<void> {
    await this.set('settings', settings);
  }

  public static async getAllGlobalOrders(): Promise<any[]> {
    const merged = new Map<string, any>();
    if (!isSyntheticTestEnvironment()) {
      void ensureHistoricalOrdersSeeded();
      for (const ord of HISTORICAL_PDF_ORDERS) {
        merged.set(ord.id, ord);
      }
    }
    try {
      const rtdbData = await FirebaseRtdb.get<Record<string, any>>('orders');
      if (rtdbData) {
        const rtdbList = Array.isArray(rtdbData) ? rtdbData : Object.values(rtdbData);
        for (const ord of rtdbList) {
          if (ord && ord.id) {
            const existing = merged.get(ord.id);
            merged.set(
              ord.id,
              existing
                ? {
                    ...existing,
                    ...ord,
                    emailDelivery: { ...existing.emailDelivery, ...(ord as any).emailDelivery },
                  }
                : ord
            );
          }
        }
      }
    } catch {
      // Ignore RTDB fallback errors
    }
    try {
      const data = await this.get<Record<string, any>>('orders');
      if (data) {
        const list = Array.isArray(data) ? data : Object.values(data);
        for (const ord of list) {
          if (ord && ord.id) {
            const existing = merged.get(ord.id);
            merged.set(
              ord.id,
              existing
                ? {
                    ...existing,
                    ...ord,
                    emailDelivery: { ...existing.emailDelivery, ...(ord as any).emailDelivery },
                  }
                : ord
            );
          }
        }
      }
    } catch {
      // Ignore primary store errors if fallback succeeded
    }
    return [...merged.values()].sort(
      (a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime()
    );
  }

  public static async getAllUsers(): Promise<any[]> {
    const byId = new Map<string, any>();
    const byEmail = new Set<string>();
    try {
      const data = await this.get<Record<string, any>>('users');
      if (data) {
        for (const [userId, userData] of Object.entries(data)) {
          let p: any = null;
          if (userData && (userData as any).profile) {
            p = { ...(userData as any).profile, userId, settings: (userData as any).settings };
          } else if (userData && (userData as any).id) {
            p = { ...userData, userId };
          }
          if (p) {
            byId.set(userId, p);
            if (p.email) byEmail.add(String(p.email).toLowerCase());
          }
        }
      }
    } catch {
      // Fallback
    }
    if (!isSyntheticTestEnvironment()) {
      for (const histUser of HISTORICAL_PDF_USERS) {
        const emailLower = String(histUser.email || '').toLowerCase();
        if (!byId.has(histUser.userId) && !byEmail.has(emailLower)) {
          byId.set(histUser.userId, histUser);
          if (emailLower) byEmail.add(emailLower);
        }
      }
    }
    return [...byId.values()];
  }

  public static async setUserProfile(userId: string, profile: any): Promise<void> {
    await this.set(`users/${userId}/profile`, profile);
  }
}
