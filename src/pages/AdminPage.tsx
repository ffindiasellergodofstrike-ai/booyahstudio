import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { AdminDashboardView } from '../components/admin/AdminDashboardView';
import { AdminProductsView } from '../components/admin/AdminProductsView';
import { AdminOrdersView } from '../components/admin/AdminOrdersView';
import { AdminCustomersView } from '../components/admin/AdminCustomersView';
import { AdminCouponsView } from '../components/admin/AdminCouponsView';
import { AdminService } from '../services/AdminService';
import { AuthService } from '../services/AuthService';
import { Loader2, ShieldAlert } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const loadAdminData = async () => {
    try {
      const authRes = await AdminService.verifyAdminMe();
      if (!authRes.success || !authRes.admin || authRes.admin.role !== 'admin') {
        window.location.href = '/';
        return;
      }
      setAdminUser(authRes.admin);
      setHealth(authRes.health);

      const [dashboardStats, productList, orderList, customerList] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getProducts(),
        AdminService.getOrders(),
        AdminService.getCustomers(),
      ]);

      if (dashboardStats.success) setStats(dashboardStats);
      setProducts(productList);
      setOrders(orderList);
      setCustomers(customerList);
    } catch {
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500">Verifying administrative access...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  };

  return (
    <AdminLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      adminUser={adminUser}
      onLogout={handleLogout}
      products={products}
    >
      {activeTab === 'dashboard' && (
        <AdminDashboardView
          stats={stats}
          recentOrders={stats?.recentOrders || orders}
          recentAuditLogs={stats?.recentAuditLogs || []}
          health={health}
        />
      )}

      {activeTab === 'products' && (
        <AdminProductsView
          products={products}
          onRefresh={loadAdminData}
          onSaveProduct={AdminService.saveProduct}
          onDeleteProduct={AdminService.deleteProduct}
          onCloneProduct={AdminService.cloneProduct}
        />
      )}

      {activeTab === 'orders' && (
        <AdminOrdersView orders={orders} onRefresh={loadAdminData} />
      )}

      {activeTab === 'customers' && (
        <AdminCustomersView customers={customers} onRefresh={loadAdminData} />
      )}

      {activeTab === 'coupons' && (
        <AdminCouponsView />
      )}

      {activeTab === 'downloads' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold mb-4">Downloads & Purchase Access</h3>
          <p className="text-sm text-slate-500">Manage user download limits and active product access.</p>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold mb-4">Security Audit Logs</h3>
          <div className="space-y-3">
            {stats?.recentAuditLogs?.map((log: any) => (
              <div key={log.logId} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-blue-600 mr-2">{log.eventType}</span>
                  <span className="text-slate-400 font-mono">{log.requestId}</span>
                </div>
                <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-lg font-bold">Store Settings</h3>
          <p className="text-sm text-slate-500">Configure global store details, payment environment, and maintenance mode.</p>
        </div>
      )}
    </AdminLayout>
  );
};
