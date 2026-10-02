import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { AdminService } from '../../services/AdminService';

interface AdminOrdersViewProps {
  orders: any[];
  onRefresh: () => void;
}

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({ orders, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const filtered = orders.filter(o => 
    o.orderNumber?.toLowerCase().includes(search.toLowerCase()) || 
    o.customerEmail?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDrawer = async (order: any) => {
    setSelectedOrder(order);
    setLoadingTimeline(true);
    try {
      const t = await AdminService.getOrderTimeline(order.id);
      setTimeline(t);
    } catch {
      setTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleVerifyPayment = async (orderId: string) => {
    try {
      const result = await AdminService.reconcileOrderPayment(orderId);
      onRefresh();
      if (selectedOrder) {
        setSelectedOrder({ ...selectedOrder, paymentStatus: result.status });
      }
    } catch (error: any) {
      alert(error.message || 'Could not verify payment with the gateway.');
    }
  };

  const handleRevokeAccess = async (orderId: string) => {
    if (!window.confirm('Revoke this order’s download access? This does not issue a refund.')) return;
    try {
      const result = await AdminService.revokeOrderAccess(orderId);
      onRefresh();
      setSelectedOrder(result.order);
    } catch (error: any) {
      alert(error.message || 'Could not revoke download access.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order # or email..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="py-4 px-6">Order #</th>
                <th className="py-4 px-6">Customer</th>
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Total</th>
                <th className="py-4 px-6">Payment</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                  <td className="py-4 px-6 font-mono font-semibold text-blue-600 dark:text-blue-400">{o.orderNumber}</td>
                  <td className="py-4 px-6 text-slate-800 dark:text-slate-200">{o.customerEmail || o.customer?.email || 'N/A'}</td>
                  <td className="py-4 px-6 text-slate-500 text-xs">{new Date(o.date || o.createdAt || Date.now()).toLocaleDateString()}</td>
                  <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">₹{o.total}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      o.paymentStatus?.toUpperCase() === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {o.paymentStatus || 'PENDING'}
                    </span>
                  </td>
                  <td className="py-4 px-6 capitalize text-slate-600 dark:text-slate-300">{o.status || 'processing'}</td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleOpenDrawer(o)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full overflow-y-auto p-6 shadow-2xl border-l border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Order {selectedOrder.orderNumber}</h3>
                <p className="text-xs text-slate-400 font-mono">ID: {selectedOrder.id}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-2">
                <p className="font-semibold text-slate-900 dark:text-white">Customer Information</p>
                <p className="text-slate-600 dark:text-slate-300">Email: {selectedOrder.customerEmail || selectedOrder.customer?.email}</p>
                <p className="text-slate-600 dark:text-slate-300">Payment ID: {selectedOrder.easebuzzPaymentId || selectedOrder.paymentId || 'N/A'}</p>
                <p className="text-slate-600 dark:text-slate-300">Total: <strong className="text-slate-900 dark:text-white">₹{selectedOrder.total}</strong></p>
              </div>

              <div>
                <p className="font-semibold text-slate-900 dark:text-white mb-2">Order Items</p>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span>{item.productTitle || item.title || 'Digital Product'} (x{item.quantity || 1})</span>
                      <span className="font-bold">₹{item.price * (item.quantity || 1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => handleVerifyPayment(selectedOrder.id)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Verify with Easebuzz
                </button>
                <button
                  onClick={() => handleRevokeAccess(selectedOrder.id)}
                  disabled={selectedOrder.paymentStatus?.toUpperCase() !== 'PAID' || selectedOrder.deliveryStatus === 'REVOKED'}
                  className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Revoke Access
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="font-semibold text-slate-900 dark:text-white mb-3">Order Audit Timeline</p>
                {loadingTimeline ? (
                  <p className="text-xs text-slate-400">Loading timeline...</p>
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-slate-400">No timeline records found.</p>
                ) : (
                  <div className="space-y-3">
                    {timeline.map((log: any, idx: number) => (
                      <div key={idx} className="flex items-start space-x-3 text-xs">
                        <div className="w-2 h-2 mt-1 rounded-full bg-blue-500 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{log.eventType} <span className="text-slate-400 font-normal">({log.source})</span></p>
                          <p className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
