import React, { useState } from 'react';
import { AdminService } from '../../services/AdminService';
import { adminDate, adminInput, adminPanel, AdminLoadState, AdminRefresh, useAdminCollection } from './AdminManagementShared';

const getDownloads = () => AdminService.getDownloadHistory();
export function AdminDownloadsView({ refreshKey }: { refreshKey?: number }) {
  const { rows, loading, error, load } = useAdminCollection<any>(getDownloads, refreshKey);
  const [search, setSearch] = useState('');
  const filtered = rows.filter(row => `${row.orderId} ${row.productId} ${row.productTitle || ''} ${row.userId} ${row.customerEmail || ''} ${row.customerName || ''} ${row.event || ''}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Download authorizations & file access logs</h2>
          <p className="text-sm text-slate-500">History of protected file links issued and product files opened by verified customers.</p>
        </div>
        <AdminRefresh loading={loading} onClick={load} />
      </div>
      <AdminLoadState loading={loading} error={error} onRetry={load} />
      <div className="rounded-xl p-4 text-sm bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
        Records include both initial download link authorization at checkout and verified customer file access events.
      </div>
      <input aria-label="Search download authorizations" value={search} onChange={e => setSearch(e.target.value)} className={adminInput} placeholder="Search order, product, customer name or email..." />
      <div className={`${adminPanel} overflow-x-auto`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-500">
              <th className="py-3 pr-4">Order</th>
              <th className="py-3 pr-4">Product</th>
              <th className="py-3 pr-4">Customer</th>
              <th className="py-3 pr-4">Activity Status</th>
              <th className="py-3 pr-4">Timestamp</th>
              <th className="py-3">Link expiry</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => (
              <tr key={row.id || row.downloadLogId || `${row.orderId}-${row.productId}-${index}`} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-3 pr-4 text-xs break-all font-mono">{row.orderId}</td>
                <td className="py-3 pr-4">
                  <p className="font-medium">{row.productTitle || row.productId}</p>
                  {row.productTitle && <p className="text-xs text-slate-500 font-mono">{row.productId}</p>}
                </td>
                <td className="py-3 pr-4 text-xs break-all">
                  {row.customerName && <p className="font-medium text-slate-800 dark:text-slate-100">{row.customerName}</p>}
                  <p className="text-slate-500">{row.customerEmail || row.userId}</p>
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${row.event === 'DOWNLOAD_COMPLETED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'}`}>
                    {row.event === 'DOWNLOAD_COMPLETED' ? 'File Opened & Accessed' : 'Access Link Authorized'}
                  </span>
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">{adminDate(row.authorizedAt)}</td>
                <td className="py-3 whitespace-nowrap">{adminDate(row.expiresAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && !filtered.length && <p className="text-sm py-4 text-slate-500">No download authorizations match this view.</p>}
      </div>
    </div>
  );
}

