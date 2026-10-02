import { AuthService } from './AuthService';

export class AdminService {
  public static async verifyAdminMe(): Promise<{ success: boolean; admin?: any; health?: any }> {
    try {
      const res = await fetch('/api/admin/me', { credentials: 'include' });
      const data = await res.json();
      return data;
    } catch {
      return { success: false };
    }
  }

  public static async getDashboardStats(): Promise<any> {
    const res = await fetch('/api/admin/dashboard/stats', { credentials: 'include' });
    const data = await res.json();
    return data;
  }

  public static async getProducts(): Promise<any[]> {
    const res = await fetch('/api/admin/products', { credentials: 'include' });
    const data = await res.json();
    return data.success ? data.products : [];
  }

  public static async saveProduct(product: any): Promise<{ success: boolean; message?: string; product?: any }> {
    const method = product.isNew ? 'POST' : 'PUT';
    const url = product.isNew ? '/api/admin/products' : `/api/admin/products/${product.id}`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(product),
    });
    return await res.json();
  }

  public static async deleteProduct(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return await res.json();
  }

  public static async cloneProduct(id: string): Promise<{ success: boolean; product?: any }> {
    const res = await fetch(`/api/admin/products/${id}/clone`, {
      method: 'POST',
      credentials: 'include',
    });
    return await res.json();
  }

  public static async getOrders(): Promise<any[]> {
    const res = await fetch('/api/admin/orders', { credentials: 'include' });
    const data = await res.json();
    return data.success ? data.orders : [];
  }

  public static async getOrderTimeline(orderId: string): Promise<any[]> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/timeline`, { credentials: 'include' });
    const data = await res.json();
    return data.success ? data.timeline : [];
  }

  public static async revokeOrderAccess(orderId: string): Promise<any> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ deliveryStatus: 'REVOKED' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Could not revoke download access.');
    return data;
  }

  public static async reconcileOrderPayment(orderId: string): Promise<any> {
    const res = await fetch(`/api/payments/easebuzz/reconcile/${encodeURIComponent(orderId)}`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Payment could not be verified.');
    return data;
  }

  public static async getCustomers(): Promise<any[]> {
    const res = await fetch('/api/admin/customers', { credentials: 'include' });
    const data = await res.json();
    return data.success ? data.customers : [];
  }

  public static async updateCustomerStatus(userId: string, statusPayload: { role?: string; blocked?: boolean }): Promise<any> {
    const res = await fetch(`/api/admin/customers/${encodeURIComponent(userId)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(statusPayload),
    });
    return await res.json();
  }

  public static async getCoupons(): Promise<any[]> {
    const res = await fetch('/api/admin/coupons', { credentials: 'include' });
    const data = await res.json();
    return data.success ? data.coupons : [];
  }

  public static async saveCoupon(coupon: any): Promise<any> {
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(coupon),
    });
    return await res.json();
  }

  public static async deleteCoupon(id: string): Promise<any> {
    const res = await fetch(`/api/admin/coupons/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return await res.json();
  }

  public static async getSettings(): Promise<any> {
    const res = await fetch('/api/admin/settings', { credentials: 'include' });
    const data = await res.json();
    return data.success ? data.settings : {};
  }

  public static async saveSettings(settings: any): Promise<any> {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(settings),
    });
    return await res.json();
  }

  public static async getAuditLogs(): Promise<any[]> {
    const res = await fetch('/api/admin/audit-logs', { credentials: 'include' });
    const data = await res.json();
    return data.success ? data.logs : [];
  }

  public static async uploadImage(file: File): Promise<{ success: boolean; url?: string; message?: string }> {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/admin/uploads/direct', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      return await res.json();
    } catch (err) {
      console.error('Upload API Error:', err);
      return { success: false, message: 'Network error during image upload.' };
    }
  }
}
