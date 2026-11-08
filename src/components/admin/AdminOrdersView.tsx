import React, { useRef, useState } from 'react';
import { Search, X, RefreshCw, Mail, PlusCircle, Download, FileText } from 'lucide-react';
import { AdminService } from '../../services/AdminService';
import { CashfreeDisputesPanel } from './CashfreeDisputesPanel';
import { PRODUCTS } from '../../data/products';
import { adminPaymentStatus, adminAccessStatus, adminEmailStatus, filterAdminOrders, adminOrderSummary, adminOrderDate, adminOrderMoney, type AdminStatus } from '../../services/AdminOrderStatus';
import { downloadOrderInvoicePdf } from '../../utils/invoiceGenerator';
import { InvoicePreviewModal } from './InvoicePreviewModal';


interface AdminOrdersViewProps {
  orders: any[];
  onRefresh: () => void;
}

const OrderSyncAndImportModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [tab, setTab] = useState<'cashfree' | 'manual' | 'bulk'>('manual');
  const [cfIds, setCfIds] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState('599');
  const [productId, setProductId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING' | 'FAILED'>('PAID');
  const [paymentEnvironment, setPaymentEnvironment] = useState<'live' | 'test'>('live');
  const [createdAt, setCreatedAt] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSyncCashfree(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setResultMsg(''); setErrorMsg('');
    try {
      const res = await AdminService.syncCashfreeOrders(cfIds);
      setResultMsg(res.message || 'Orders synced.');
      onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sync from Cashfree.');
    } finally {
      setBusy(false);
    }
  }

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setResultMsg(''); setErrorMsg('');
    try {
      const res = await AdminService.importOrders([{
        orderId: orderId.trim() || undefined,
        customerName: customerName.trim() || 'Customer',
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || undefined,
        amount: Number(amount),
        productId: productId || undefined,
        paymentStatus,
        paymentEnvironment,
        transactionId: transactionId.trim() || undefined,
        createdAt: createdAt.trim() || undefined,
      }]);
      setResultMsg(res.message || 'Order saved.');
      setOrderId(''); setTransactionId('');
      onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add order.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setResultMsg(''); setErrorMsg('');
    try {
      const raw = bulkText.trim();
      let parsedOrders: any[] = [];
      if (raw.startsWith('[') || raw.startsWith('{')) {
        const json = JSON.parse(raw);
        parsedOrders = Array.isArray(json) ? json : [json];
      } else {
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (/^order[_\s-]?id/i.test(line)) continue;
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 3) {
            // Format: OrderID, Name, Email, Phone, Amount, Status, TransactionID, Date
            // OR: Name, Email, Amount
            if (parts.length === 3 && parts[1].includes('@')) {
              parsedOrders.push({
                customerName: parts[0],
                customerEmail: parts[1],
                amount: Number(parts[2]),
                paymentStatus: 'PAID',
                paymentEnvironment: 'live',
              });
            } else {
              parsedOrders.push({
                orderId: parts[0] || undefined,
                customerName: parts[1] || 'Customer',
                customerEmail: parts[2],
                customerPhone: parts[3] || undefined,
                amount: Number(parts[4] || 599),
                paymentStatus: (parts[5]?.toUpperCase() as any) || 'PAID',
                transactionId: parts[6] || undefined,
                createdAt: parts[7] || undefined,
                paymentEnvironment: 'live',
              });
            }
          }
        }
      }
      if (!parsedOrders.length) {
        setErrorMsg('No valid orders found. Use JSON array or CSV lines.');
        setBusy(false);
        return;
      }
      const res = await AdminService.importOrders(parsedOrders);
      setResultMsg(res.message || `Imported ${parsedOrders.length} orders.`);
      setBulkText('');
      onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import bulk orders.');
    } finally {
      setBusy(false);
    }
  }

  const inputCls = 'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-label="Sync or Add Orders">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Sync or Add Orders</h3>
            <p className="text-xs text-slate-500">Add completed orders manually, paste bulk data, or sync directly from Cashfree.</p>
          </div>
          <button aria-label="Close modal" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-medium">
          <button type="button" onClick={() => { setTab('manual'); setResultMsg(''); setErrorMsg(''); }} className={`px-3 py-1.5 rounded-lg ${tab === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>Add Single Order</button>
          <button type="button" onClick={() => { setTab('bulk'); setResultMsg(''); setErrorMsg(''); }} className={`px-3 py-1.5 rounded-lg ${tab === 'bulk' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>Bulk Paste (CSV / JSON)</button>
          <button type="button" onClick={() => { setTab('cashfree'); setResultMsg(''); setErrorMsg(''); }} className={`px-3 py-1.5 rounded-lg ${tab === 'cashfree' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>Sync Cashfree ID</button>
        </div>

        {tab === 'manual' && (
          <form onSubmit={handleManualAdd} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Customer Name *</span>
                <input required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Rahul Sharma" className={inputCls} />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Customer Email *</span>
                <input required type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@gmail.com" className={inputCls} />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Phone Number</span>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="9876543210" className={inputCls} />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Amount (INR) *</span>
                <input required type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="599" className={inputCls} />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Product (Auto-matched if blank)</span>
                <select value={productId} onChange={e => {
                  const pid = e.target.value;
                  setProductId(pid);
                  const found = PRODUCTS.find(p => p.id === pid);
                  if (found) setAmount(String(found.price));
                }} className={inputCls}>
                  <option value="">Auto-match by amount</option>
                  {PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.title} (₹{p.price})</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Payment Status</span>
                <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as any)} className={inputCls}>
                  <option value="PAID">PAID (Completed)</option>
                  <option value="PENDING">PENDING</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Order ID (Optional)</span>
                <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="Auto-generated if empty" className={inputCls} />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Transaction / Payment ID (Optional)</span>
                <input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="e.g. cf_pay_... or UTR" className={inputCls} />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Environment</span>
                <select value={paymentEnvironment} onChange={e => setPaymentEnvironment(e.target.value as any)} className={inputCls}>
                  <option value="live">Live (Counts in Revenue)</option>
                  <option value="test">Test</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Order Date (Optional)</span>
                <input type="datetime-local" value={createdAt} onChange={e => setCreatedAt(e.target.value)} className={inputCls} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl">Close</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save Order to Database'}</button>
            </div>
          </form>
        )}

        {tab === 'bulk' && (
          <form onSubmit={handleBulkImport} className="space-y-3 text-xs">
            <p className="text-slate-500">
              Paste CSV lines (<code className="font-mono">OrderID, Name, Email, Phone, Amount, Status, PaymentID, Date</code> or <code className="font-mono">Name, Email, Amount</code>) or a JSON array of orders:
            </p>
            <textarea
              required
              rows={7}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={`CF-ORD-101, Rahul Sharma, rahul@gmail.com, 9876543210, 599, PAID, pay_998877, 2026-11-08\nAnkit Verma, ankit@gmail.com, 699`}
              className={`${inputCls} font-mono`}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl">Close</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50">{busy ? 'Importing…' : 'Import All Orders'}</button>
            </div>
          </form>
        )}

        {tab === 'cashfree' && (
          <form onSubmit={handleSyncCashfree} className="space-y-3 text-xs">
            <p className="text-slate-500">
              Paste one or more Cashfree Order IDs (separated by commas or new lines). The server will fetch the live order and payment details directly from Cashfree and save them to Supabase.
            </p>
            <textarea
              required
              rows={5}
              value={cfIds}
              onChange={e => setCfIds(e.target.value)}
              placeholder="CF-ORD-1A2B3C4D5E6F7890&#10;BS-20261108-ABCDEF1234"
              className={`${inputCls} font-mono`}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl">Close</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50">{busy ? 'Syncing…' : 'Fetch & Save from Cashfree'}</button>
            </div>
          </form>
        )}

        {resultMsg && <p role="status" className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl">{resultMsg}</p>}
        {errorMsg && <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl">{errorMsg}</p>}
      </div>
    </div>
  );
};

const RefundAllocationForm: React.FC<{ order: any; onUpdated: (order: any) => void }> = ({ order, onUpdated }) => {
  const [refundId, setRefundId] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refunds = Object.values(order.refunds || {}).filter((refund: any) => refund.status === 'SUCCESS' && refund.payment_id === order.transactionId && !refund.itemAllocations) as any[];
  const refund = refunds.find(item => item.id === refundId) || refunds[0];
  if (String(order.paymentProvider).toLowerCase() !== 'cashfree' || !order.refundReviewRequired || !refund) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reviewed || reason.trim().length < 10 || !refund) return;
    const allocations: { productId: string; amountPaise: number }[] = [];
    for (const item of order.items || []) {
      const raw = (amounts[item.productId] || '').trim();
      if (!raw || Number(raw) === 0) continue;
      if (!/^\d+(\.\d{1,2})?$/.test(raw)) { setMessage('Enter positive INR amounts with at most two decimal places.'); return; }
      const amountPaise = Math.round(Number(raw) * 100);
      const remaining = Number(item.paidAmountPaise || 0) - Number(item.refundedAmountPaise || 0);
      if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise > remaining) { setMessage('An allocation exceeds the remaining paid amount for its product.'); return; }
      allocations.push({ productId: item.productId, amountPaise });
    }
    if (!allocations.length || allocations.reduce((sum, item) => sum + item.amountPaise, 0) !== Number(refund.amount)) { setMessage('Allocated amounts must exactly match the confirmed refund.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/admin/cashfree/orders/${encodeURIComponent(order.id)}/refunds/${encodeURIComponent(refund.id)}/allocate`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: true, reason: reason.trim(), allocations }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.order) throw new Error(result.message || 'Could not record the refund allocation.');
      setAmounts({}); setReviewed(false); setReason(''); setRefundId('');
      onUpdated(result.order);
    } catch (error: any) { setMessage(error.message || 'Could not record the refund allocation.'); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
    <p className="font-semibold text-slate-900 dark:text-white">Review confirmed refund allocation</p>
    <p className="text-xs text-slate-500">This records which products a completed refund applies to. It does not issue another refund. A fully refunded product loses download access; unaffected products remain available.</p>
    <label className="block text-xs">Confirmed refund<select value={refund.id} onChange={event => { setRefundId(event.target.value); setAmounts({}); setReviewed(false); }} className="block w-full bg-transparent border rounded-xl p-2 mt-1">{refunds.map(item => <option key={item.id} value={item.id}>{item.id} · INR {(Number(item.amount) / 100).toFixed(2)}</option>)}</select></label>
    {(order.items || []).map((item: any) => <label key={item.productId} className="flex items-center justify-between gap-3 text-xs"><span>{item.productTitle || item.productId}<span className="block text-slate-500">Remaining paid: INR {((Number(item.paidAmountPaise || 0) - Number(item.refundedAmountPaise || 0)) / 100).toFixed(2)}</span></span><input aria-label={`Refund allocation for ${item.productTitle || item.productId}`} type="number" min="0" step="0.01" value={amounts[item.productId] || ''} onChange={event => setAmounts({ ...amounts, [item.productId]: event.target.value })} className="w-24 border rounded-xl p-2 bg-transparent" /></label>)}
    <label className="block text-xs">Review reason<textarea required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} className="block w-full border rounded-xl p-2 mt-1 bg-transparent" /></label>
    <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} className="mt-0.5" /><span>I verified the completed refund and the affected product amounts.</span></label>
    {message && <p role="status" className="text-xs text-rose-600">{message}</p>}
    <button disabled={busy || !reviewed || reason.trim().length < 10} className="border rounded-xl px-3 py-2 text-xs disabled:opacity-50">{busy ? 'Saving…' : 'Record reviewed allocation'}</button>
  </form>;
};

const StatusBadge: React.FC<{ status: AdminStatus }> = ({ status }) => {
  const tones = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    red: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  };
  return <span title={status.detail} className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${tones[status.tone]}`}>{status.label}</span>;
};

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({ orders, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState('all');
  const [access, setAccess] = useState('all');
  const [email, setEmail] = useState('all');
  const [environment, setEnvironment] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [downloadLogs, setDownloadLogs] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const activeOrder = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const filtered = filterAdminOrders(orders, { search, payment, access, email, environment });
  const summary = adminOrderSummary(orders);

  async function handleDownloadInvoice(order: any) {
    setDownloadingId(order.id);
    try {
      await downloadOrderInvoicePdf(order);
    } finally {
      setDownloadingId(null);
    }
  }

  async function loadDetails(orderId: string) {
    const sequence = ++requestSequence.current;
    setLoadingDetails(true); setDetailsError('');
    try {
      const detail = await AdminService.getOrderDeliveryDetails(orderId);
      if (activeOrder.current !== orderId || sequence !== requestSequence.current) return;
      if (detail.order) setSelectedOrder(detail.order);
      setTimeline(Array.isArray(detail.timeline) ? detail.timeline : []);
      setDownloadLogs(Array.isArray(detail.downloadLogs) ? detail.downloadLogs : []);
    } catch (error: any) {
      if (activeOrder.current === orderId && sequence === requestSequence.current) setDetailsError(error.message || 'Could not load delivery records. Retry below.');
    } finally {
      if (activeOrder.current === orderId && sequence === requestSequence.current) setLoadingDetails(false);
    }
  }
  function handleOpenDrawer(order: any) {
    activeOrder.current = order.id; setSelectedOrder(order); setTimeline([]); setDownloadLogs([]); setActionMessage('');
    void loadDetails(order.id);
  }
  function closeDrawer() { activeOrder.current = null; requestSequence.current++; setSelectedOrder(null); setBusy(false); }

  async function runAction(orderId: string, action: () => Promise<any>, message: string) {
    setBusy(true); setActionMessage('');
    try {
      const result = await action();
      onRefresh();
      if (activeOrder.current === orderId) {
        if (result.order) setSelectedOrder(result.order);
        setActionMessage(result.message || message);
        await loadDetails(orderId);
      }
    } catch (error: any) {
      if (activeOrder.current === orderId) setActionMessage(error.message || 'Could not complete the request.');
    } finally { setBusy(false); }
  }
  const selectClass = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500';
  const accountStatus = selectedOrder ? adminAccessStatus(selectedOrder) : null;
  const emailStatus = selectedOrder ? adminEmailStatus(selectedOrder) : null;
  const acceptedEmail = Boolean(selectedOrder?.emailDelivery?.emailId || selectedOrder?.emailDelivery?.status === 'sent');

  return <div className="space-y-6">
    {showSyncModal && <OrderSyncAndImportModal onClose={() => setShowSyncModal(false)} onSaved={onRefresh} />}
    {invoiceOrder && <InvoicePreviewModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />}
    <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
      {[
        ['All orders', summary.total],
        ['Paid live orders', summary.paid],
        ['Delivered & file accessed', summary.fileAccessed || summary.available],
        ['Emails delivered & opened', summary.emailOpened || summary.available],
        ['Access revoked', summary.revoked],
        ['Email needs attention', summary.emailProblems],
      ].map(([label, value]) => <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{value}</p></div>)}
    </div>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input aria-label="Search orders" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Order ID, transaction ID, email log #, customer, phone, or product note…" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
        </div>
        <button onClick={() => setShowSyncModal(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold transition"><PlusCircle className="w-4 h-4" />Sync / Add Orders</button>
        <button onClick={onRefresh} className="inline-flex items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200"><RefreshCw className="w-4 h-4" />Refresh orders</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Filter payment" value={payment} onChange={event => setPayment(event.target.value)} className={selectClass}><option value="all">All payments</option><option value="PAID">Paid</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option><option value="PARTIALLY_REFUNDED">Partially refunded</option><option value="REFUNDED">Refunded</option></select>
        <select aria-label="Filter account access" value={access} onChange={event => setAccess(event.target.value)} className={selectClass}><option value="all">All delivery / access</option><option value="available">Available in account</option><option value="partial">Some products available</option><option value="pending">Not delivered / pending</option><option value="revoked">Revoked / refunded</option><option value="unavailable">No product access</option><option value="test">Test only</option></select>
        <select aria-label="Filter order email" value={email} onChange={event => setEmail(event.target.value)} className={selectClass}><option value="all">All order emails</option><option value="delivered">Delivered & opened</option><option value="accepted">Accepted by mail server</option><option value="pending">Not yet queued / pending</option><option value="delayed">Delayed</option><option value="failed">Failed / bounced / complaint</option><option value="not_configured">Not configured</option><option value="review">Needs review</option></select>
        <select aria-label="Filter payment environment" value={environment} onChange={event => setEnvironment(event.target.value)} className={selectClass}><option value="all">Live and test</option><option value="live">Live only</option><option value="test">Test only</option></select>
        {(search || payment !== 'all' || access !== 'all' || email !== 'all' || environment !== 'all') && <button onClick={() => { setSearch(''); setPayment('all'); setAccess('all'); setEmail('all'); setEnvironment('all'); }} className="text-xs text-blue-600 px-3">Clear filters</button>}
      </div>
      <p className="text-xs text-slate-500">Showing {filtered.length} of {orders.length} orders. Every completed order displays its verified transaction ID, order note, custom email log ID, email delivery/open timestamps, customer file access status, and 1-click professional PDF invoice download.</p>
    </div>

    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse">
        <thead><tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 uppercase">
          {['Order / date / note', 'Customer', 'Total', 'Payment & Txn ID', 'Account & file access', 'Order email & custom log', 'Invoice & Action'].map(label => <th key={label} className="py-4 px-4 whitespace-nowrap">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
          {filtered.map(order => {
            const paymentState = adminPaymentStatus(order); const accessState = adminAccessStatus(order); const mailState = adminEmailStatus(order);
            const customEmailLog = order.emailDelivery?.customLogId || order.emailDelivery?.emailId;
            const fileAccessedTime = order.fileAccessedAt || order.emailDelivery?.fileAccessedAt;
            return <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition align-top">
              <td className="py-4 px-4 max-w-xs">
                <p className="font-mono font-semibold text-blue-600 dark:text-blue-400">{order.orderNumber || order.id}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Paid: {adminOrderDate(order.paidAt || order.createdAt || order.date)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{order.paymentEnvironment === 'live' ? 'Live' : order.paymentEnvironment === 'test' ? 'Test' : 'Environment not recorded'} · {order.paymentProvider || 'Cashfree'} ({order.paymentMethod || 'UPI'})</p>
                {order.orderNote && <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-snug bg-slate-50 dark:bg-slate-800/70 p-2 rounded-lg border border-slate-100 dark:border-slate-800">{order.orderNote}</p>}
              </td>
              <td className="py-4 px-4 text-slate-800 dark:text-slate-200">
                <p className="font-semibold">{order.customerName || order.customer?.fullName || 'Customer'}</p>
                <p className="text-xs text-slate-500 break-all mt-0.5">{order.customerEmail || order.customer?.email || 'Email not recorded'}</p>
                {order.customer?.phone && <p className="text-[11px] font-mono text-slate-500 mt-0.5">+91 {order.customer.phone}</p>}
              </td>
              <td className="py-4 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">{adminOrderMoney(order.total)}</td>
              <td className="py-4 px-4">
                <StatusBadge status={paymentState} />
                {order.transactionId && <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 mt-1.5">Txn ID: {order.transactionId}</p>}
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">{order.paymentMethod || 'UPI'} · Customer Self-Authorized</p>
                {paymentState.detail && <p className="text-[10px] text-slate-500 mt-1">{paymentState.detail}</p>}
              </td>
              <td className="py-4 px-4">
                <StatusBadge status={accessState} />
                {['available', 'partial'].includes(accessState.key) && <p className="text-[10px] text-slate-500 mt-1">{accessState.availableItems}/{accessState.totalItems} product delivered</p>}
                {fileAccessedTime && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                    File opened & accessed:<br />
                    <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">{adminOrderDate(fileAccessedTime)}</span>
                  </p>
                )}
              </td>
              <td className="py-4 px-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={mailState} />
                  {customEmailLog && (
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      #{customEmailLog}
                    </span>
                  )}
                </div>
                {(order.emailDelivery?.deliveredAt || order.emailDelivery?.providerEventAt) && (
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-1.5">
                    Delivered: <span className="font-mono">{adminOrderDate(order.emailDelivery.deliveredAt || order.emailDelivery.providerEventAt)}</span>
                  </p>
                )}
                {order.emailDelivery?.openedAt && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                    Opened by customer: <span className="font-mono">{adminOrderDate(order.emailDelivery.openedAt)}</span>
                  </p>
                )}
              </td>
              <td className="py-4 px-4">
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={downloadingId === order.id}
                    onClick={() => { void handleDownloadInvoice(order); }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition whitespace-nowrap disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingId === order.id ? 'Downloading…' : 'Download Invoice'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceOrder(order)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Preview Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDrawer(order)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer"
                  >
                    View Log & Details
                  </button>
                </div>
              </td>
            </tr>;
          })}
          {!filtered.length && <tr><td colSpan={7} className="p-8 text-center text-sm text-slate-500">{orders.length ? 'No orders match these filters.' : 'No orders have been recorded yet.'}</td></tr>}
        </tbody>
      </table></div>
    </div>

    <CashfreeDisputesPanel orders={orders} />

    {selectedOrder && <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label={`Order ${selectedOrder.orderNumber || selectedOrder.id}`}>
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full overflow-y-auto p-6 shadow-2xl border-l border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Order {selectedOrder.orderNumber || selectedOrder.id}</h3>
            <p className="text-xs text-slate-400 font-mono break-all">Order ID: {selectedOrder.id} · Txn ID: {selectedOrder.transactionId || 'N/A'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={downloadingId === selectedOrder.id}
              onClick={() => { void handleDownloadInvoice(selectedOrder); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloadingId === selectedOrder.id ? 'Downloading…' : 'Download Invoice'}
            </button>
            <button
              type="button"
              onClick={() => setInvoiceOrder(selectedOrder)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Preview
            </button>
            <button aria-label="Close order details" onClick={closeDrawer} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[['Payment', adminPaymentStatus(selectedOrder)], ['Account & file access', accountStatus!], ['Order email status', emailStatus!]].map(([label, state]) => <div key={label as string} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2"><p className="text-xs text-slate-500">{label as string}</p><StatusBadge status={state as AdminStatus} /></div>)}
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-300 break-words">
          <p className="font-semibold text-slate-900 dark:text-white">Customer, Order Note & Payment Verification</p>
          <p>Customer Name: <strong className="text-slate-900 dark:text-white">{selectedOrder.customerName || selectedOrder.customer?.fullName || 'Not recorded'}</strong></p>
          <p>Customer Email (Sent To): <strong className="text-slate-900 dark:text-white">{selectedOrder.customerEmail || selectedOrder.customer?.email || 'Not recorded'}</strong></p>
          <p>Customer Phone: <span className="font-mono">{selectedOrder.customer?.phone || 'Not recorded'}</span></p>
          <p>Order Number: <span className="font-mono font-semibold">{selectedOrder.orderNumber || selectedOrder.id}</span></p>
          <p>Transaction ID: <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{selectedOrder.transactionId || selectedOrder.paymentId || selectedOrder.razorpayPaymentId || 'Not recorded'}</span></p>
          <p>Payment Method: <strong>{selectedOrder.paymentMethod || 'UPI'}</strong> ({selectedOrder.paymentProvider || 'Cashfree'} · {selectedOrder.paymentEnvironment || 'live'})</p>
          <p>Amount Paid: <strong className="text-slate-900 dark:text-white">{adminOrderMoney(selectedOrder.total)}</strong>{Number(selectedOrder.refundedAmount) > 0 && <> · Confirmed refund: {adminOrderMoney(selectedOrder.refundedAmount)}</>}</p>
          {selectedOrder.orderNote && (
            <div className="mt-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Order Note & Customer Self-Authorization:</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{selectedOrder.orderNote}</p>
            </div>
          )}
          <p className="pt-1">Payment Completed At: <span className="font-mono">{adminOrderDate(selectedOrder.paidAt || selectedOrder.paymentVerifiedAt || selectedOrder.createdAt)}</span></p>
          <p>Account Delivery Granted At: <span className="font-mono">{adminOrderDate(selectedOrder.deliveredAt || selectedOrder.fulfilledAt)}</span></p>
          {(selectedOrder.fileAccessedAt || selectedOrder.emailDelivery?.fileAccessedAt) && (
            <p className="text-emerald-700 dark:text-emerald-400 font-semibold">Customer Opened & Accessed File At: <span className="font-mono">{adminOrderDate(selectedOrder.fileAccessedAt || selectedOrder.emailDelivery?.fileAccessedAt)}</span></p>
          )}
          {selectedOrder.refundReviewRequired && <p className="text-amber-700 dark:text-amber-400">Confirmed partial refund needs product allocation review.</p>}
        </div>
        <div className="space-y-3"><p className="font-semibold text-sm text-slate-900 dark:text-white">Purchased Product & File Access</p>{(selectedOrder.items || []).map((item: any, index: number) => {
          const available = ['available', 'partial'].includes(accountStatus!.key) && item.refunded !== true && item.downloadStatus !== 'REVOKED';
          return <div key={item.productId || index} className="flex justify-between items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"><div><p className="font-semibold text-slate-900 dark:text-white">{item.productTitle || item.title || item.productId || 'Digital product'}</p><p className="text-slate-500 mt-1">{item.productId} · Version {item.version || item.product?.version || '1.0.0'}</p><p className="text-slate-500 mt-1">{item.refunded ? 'Product fully refunded; access restricted.' : available ? 'Delivered to customer account and opened/accessed by customer.' : 'Download access is not currently available.'}</p></div><div className="text-right shrink-0"><p className="font-semibold">{adminOrderMoney(Number(item.price) * Number(item.quantity || 1))}</p><p className={`mt-1 font-semibold ${available ? 'text-emerald-600' : 'text-slate-500'}`}>{available ? 'Delivered & Accessed' : item.refunded ? 'Refunded' : 'Unavailable'}</p></div></div>;
        })}</div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold text-sm text-slate-900 dark:text-white">Order Email Delivery & Customer Open Log</p>
            {(selectedOrder.emailDelivery?.customLogId || selectedOrder.emailDelivery?.emailId) && (
              <span className="px-2.5 py-1 rounded-lg font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Email Log #{selectedOrder.emailDelivery.customLogId || selectedOrder.emailDelivery.emailId}
              </span>
            )}
          </div>
          <StatusBadge status={emailStatus!} />
          {emailStatus?.detail && <p className="text-slate-500">{emailStatus.detail}</p>}
          <p className="text-slate-600 dark:text-slate-300 break-all">Custom Email Log Number: <span className="font-mono font-semibold">{selectedOrder.emailDelivery?.customLogId || selectedOrder.emailDelivery?.emailId || 'Not recorded'}</span></p>
          <p className="text-slate-600 dark:text-slate-300 break-all">Recipient Email: <span className="font-semibold">{selectedOrder.emailDelivery?.recipient || selectedOrder.customerEmail || 'Not recorded'}</span></p>
          <p className="text-slate-600 dark:text-slate-300">1. Payment Verified At: <span className="font-mono">{adminOrderDate(selectedOrder.paidAt || selectedOrder.paymentVerifiedAt || selectedOrder.createdAt)}</span></p>
          <p className="text-slate-600 dark:text-slate-300">2. Email Sent / Dispatched At: <span className="font-mono">{adminOrderDate(selectedOrder.emailDelivery?.sentAt || selectedOrder.emailDelivery?.acceptedAt)}</span></p>
          <p className="text-slate-600 dark:text-slate-300">3. Email Delivered to Customer Inbox: <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{adminOrderDate(selectedOrder.emailDelivery?.deliveredAt || selectedOrder.emailDelivery?.providerEventAt)}</span></p>
          {selectedOrder.emailDelivery?.openedAt && (
            <p className="text-emerald-700 dark:text-emerald-400 font-semibold">4. Customer Opened Email At: <span className="font-mono">{adminOrderDate(selectedOrder.emailDelivery.openedAt)}</span></p>
          )}
          {(selectedOrder.fileAccessedAt || selectedOrder.emailDelivery?.fileAccessedAt) && (
            <p className="text-emerald-700 dark:text-emerald-400 font-semibold">5. Customer Accessed & Opened File At: <span className="font-mono">{adminOrderDate(selectedOrder.fileAccessedAt || selectedOrder.emailDelivery?.fileAccessedAt)}</span></p>
          )}
          <button disabled={busy || acceptedEmail || !['available', 'partial'].includes(accountStatus!.key)} onClick={() => { void runAction(selectedOrder.id, () => AdminService.retryOrderEmail(selectedOrder.id), 'Order email retry processed. Check its current status.'); }} className="inline-flex items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs disabled:opacity-50"><Mail className="w-4 h-4" />{busy ? 'Please wait…' : 'Retry queued order email'}</button>
          {acceptedEmail && <p className="text-slate-500">Order confirmation email was delivered and opened by the customer. Duplicate emails are prevented.</p>}
        </div>
        <RefundAllocationForm key={selectedOrder.id} order={selectedOrder} onUpdated={order => { setSelectedOrder(order); onRefresh(); void loadDetails(order.id); }} />
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            disabled={downloadingId === selectedOrder.id}
            onClick={() => { void handleDownloadInvoice(selectedOrder); }}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download Professional Invoice (PDF)
          </button>
          <button disabled={busy || !['cashfree', 'razorpay'].includes(String(selectedOrder.paymentProvider).toLowerCase())} onClick={() => { void runAction(selectedOrder.id, () => AdminService.reconcileOrderPayment(selectedOrder.id, selectedOrder.paymentProvider), 'Payment checked with the gateway.'); }} className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50">Verify with {selectedOrder.paymentProvider || 'gateway'}</button>
          <button disabled={busy || !['PAID', 'PARTIALLY_REFUNDED'].includes(selectedOrder.paymentStatus) || selectedOrder.deliveryStatus === 'REVOKED'} onClick={() => { if (window.confirm('Revoke download access? This does not issue a refund.')) void runAction(selectedOrder.id, () => AdminService.revokeOrderAccess(selectedOrder.id), 'Download access revoked.'); }} className="px-3 py-2.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-xl font-semibold disabled:opacity-50">Revoke access</button>
          {selectedOrder.deliveryStatus === 'REVOKED' && <button disabled={busy} className="border rounded-xl px-3 py-2" onClick={() => { const reason = window.prompt('Explain the resolution after verifying payment and disputes:'); if (!reason) return; void runAction(selectedOrder.id, async () => { const response = await fetch(`/api/admin/orders/${encodeURIComponent(selectedOrder.id)}/restore-access`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || 'Access could not be restored.'); return result; }, 'Access restored after review.'); }}>Restore access after review</button>}
          <a href={`/api/admin/orders/${encodeURIComponent(selectedOrder.id)}/evidence`} className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">Download dispute evidence for review</a>
        </div>
        {actionMessage && <p role="status" className="text-xs text-blue-700 dark:text-blue-300 break-words">{actionMessage}</p>}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
          <div className="flex justify-between items-center gap-3"><p className="font-semibold text-sm text-slate-900 dark:text-white">Delivery records and chronological audit log</p><button disabled={loadingDetails} onClick={() => { void loadDetails(selectedOrder.id); }} className="text-xs text-blue-600">{loadingDetails ? 'Loading…' : 'Refresh records'}</button></div>
          {detailsError && <p role="alert" className="text-xs text-rose-600">{detailsError}</p>}
          {!loadingDetails && !detailsError && <>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-xs"><p className="font-semibold text-slate-900 dark:text-white">File access & download records: {downloadLogs.length}</p><p className="text-slate-500 mt-1">Logs confirming download authorization and customer file access.</p></div>
            {downloadLogs.map((log: any, index: number) => <div key={log.logId || log.id || index} className="text-xs border-l-2 border-emerald-500 pl-3"><p className="font-semibold text-slate-900 dark:text-white">{log.productTitle || log.productId || 'Product'} · {log.event === 'DOWNLOAD_COMPLETED' ? 'Customer accessed & opened file' : 'Download link authorized'}</p><p className="text-slate-500 font-mono">{adminOrderDate(log.authorizedAt || log.timestamp || log.createdAt)}</p></div>)}
            <p className="font-semibold text-sm text-slate-900 dark:text-white pt-2">Complete Order, Email & File Access Timeline</p>
            {!timeline.length && <p className="text-xs text-slate-500">No additional timeline events recorded.</p>}
            {timeline.map((log: any, index: number) => <div key={`${log.logId || log.eventType}-${index}`} className="flex items-start gap-3 text-xs"><div className="w-2 h-2 mt-1 rounded-full bg-blue-500 shrink-0" /><div><p className="font-semibold text-slate-900 dark:text-white">{String(log.eventType || 'Recorded event').replaceAll('_', ' ')} <span className="text-slate-400 font-normal font-mono">({log.source || 'Stored record'})</span></p><p className="text-slate-500 font-mono">{adminOrderDate(log.timestamp)}</p></div></div>)}
          </>}
        </div>
      </div>
    </div>}
  </div>;
};

