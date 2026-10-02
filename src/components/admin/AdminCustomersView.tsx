import React, { useState } from 'react';
import { Search, Shield, UserX, UserCheck, Mail, Phone, ExternalLink } from 'lucide-react';
import { AdminService } from '../../services/AdminService';

interface AdminCustomersViewProps {
  customers: any[];
  onRefresh: () => void;
}

export const AdminCustomersView: React.FC<AdminCustomersViewProps> = ({ customers, onRefresh }) => {
  const [search, setSearch] = useState('');

  const filtered = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile?.includes(search)
  );

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'customer' : 'admin';
    if (confirm(`Change role to ${newRole}?`)) {
      await AdminService.updateCustomerStatus(userId, { role: newRole });
      onRefresh();
    }
  };

  const handleToggleBlock = async (userId: string, blocked: boolean) => {
    await AdminService.updateCustomerStatus(userId, { blocked: !blocked });
    onRefresh();
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
            placeholder="Search customers..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="py-4 px-6">Customer</th>
                <th className="py-4 px-6">Contact</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Orders</th>
                <th className="py-4 px-6">Total Spent</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filtered.map((c) => (
                <tr key={c.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        {c.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{c.name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400 font-mono">ID: {c.userId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-slate-800 dark:text-slate-200 flex items-center"><Mail className="w-3.5 h-3.5 mr-1.5 text-slate-400" />{c.email}</p>
                    <p className="text-xs text-slate-400 flex items-center mt-0.5"><Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400" />{c.mobile || 'N/A'}</p>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      c.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {c.role || 'customer'}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-semibold">{c.ordersCount || 0}</td>
                  <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">₹{c.totalSpent || 0}</td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleToggleRole(c.userId, c.role)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition"
                        title="Toggle Admin Role"
                      >
                        <Shield className="w-3.5 h-3.5 mr-1 inline" /> {c.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
