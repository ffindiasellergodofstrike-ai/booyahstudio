import React, { useState, useEffect } from 'react';
import { Plus, Tag, Trash2, Check, X } from 'lucide-react';
import { AdminService } from '../../services/AdminService';

export const AdminCouponsView: React.FC = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(10);
  const [minSpend, setMinSpend] = useState(0);
  const [description, setDescription] = useState('');

  const fetchCoupons = async () => {
    try {
      const res = await fetch('/api/admin/coupons', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setCoupons(data.coupons);
    } catch {}
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: `coup_${Math.random().toString(36).substring(2, 8)}`,
          code: code.toUpperCase(),
          discountPercent: Number(discountPercent),
          minSpend: Number(minSpend),
          description,
          active: true,
          usageCount: 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCode('');
        setDescription('');
        fetchCoupons();
      } else {
        alert(data.message || 'Failed to create coupon');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this coupon?')) {
      await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchCoupons();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Create New Discount Coupon</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Coupon Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SUMMER25"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Discount %</label>
            <input
              type="number"
              required
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Min Spend (INR)</label>
            <input
              type="number"
              value={minSpend}
              onChange={(e) => setMinSpend(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition shadow-sm"
            >
              Add Coupon
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
              <th className="py-4 px-6">Code</th>
              <th className="py-4 px-6">Discount</th>
              <th className="py-4 px-6">Min Spend</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {coupons.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                <td className="py-4 px-6 font-mono font-bold text-blue-600 dark:text-blue-400">{c.code}</td>
                <td className="py-4 px-6 font-semibold">{c.discountPercent}% OFF</td>
                <td className="py-4 px-6">₹{c.minSpend || 0}</td>
                <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Active</span></td>
                <td className="py-4 px-6 text-right">
                  <button onClick={() => handleDelete(c.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
