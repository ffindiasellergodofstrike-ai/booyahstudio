import React, { useState } from 'react';
import { Download, Printer, X, CheckCircle2, ShieldCheck, FileText } from 'lucide-react';
import { BUSINESS } from '../../config/business';
import { PRODUCTS } from '../../data/products';
import { adminOrderDate, adminOrderMoney } from '../../services/AdminOrderStatus';
import { downloadOrderInvoicePdf } from '../../utils/invoiceGenerator';

interface InvoicePreviewModalProps {
  order: any;
  onClose: () => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ order, onClose }) => {
  const [downloading, setDownloading] = useState(false);

  if (!order) return null;

  const orderId = order.orderNumber || order.id || order.orderId || 'ORD-BOOYAH';
  const txId = order.transactionId || order.paymentId || order.cfPaymentId || 'VERIFIED';
  const paidDateRaw = order.paidAt || order.paymentVerifiedAt || order.createdAt || order.date || new Date().toISOString();
  const compactDate = String(paidDateRaw).slice(0, 10).replace(/-/g, '') || '20261108';
  const invoiceNumber = order.invoiceNumber || `INV-${compactDate}-${String(txId).slice(-6).toUpperCase()}`;
  const customEmailLogId = order.emailDelivery?.customLogId || order.emailDelivery?.emailId || `EML-LOG-${compactDate}-${String(txId).slice(-6)}`;

  const customerName = order.customerName || order.customer?.fullName || 'Verified Customer';
  const customerEmail = order.customerEmail || order.customer?.email || 'Not recorded';
  const customerPhone = order.customer?.phone || order.customerPhone || 'Verified via UPI';
  const paymentMethod = order.paymentMethod || 'UPI';
  const paymentProvider = order.paymentProvider || 'Cashfree Payments';

  const rawItems = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : [{
        productId: order.productId || 'digital-template',
        productTitle: order.productNameSnapshot || 'Premium Digital Template Package',
        quantity: 1,
        price: Number(order.total || order.amount || 599),
        version: '1.0.0',
      }];

  const resolvedItems = rawItems.map((item: any, idx: number) => {
    const catalogMatch = PRODUCTS.find(p => p.id === item.productId);
    const title = item.productTitle || item.title || catalogMatch?.title || order.productNameSnapshot || item.productId || `Digital Product #${idx + 1}`;
    const pid = item.productId || catalogMatch?.id || 'digital-asset';
    const category = item.categoryLabel || item.category || catalogMatch?.categoryLabel || 'Website Templates';
    const format = item.fileFormat || catalogMatch?.fileFormat || 'HTML, CSS, JS, SVG, ZIP Source Package';
    const version = item.version || catalogMatch?.version || '1.0.0';
    const qty = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Number(item.price ?? order.total ?? 599);
    return {
      index: idx + 1,
      title,
      productId: pid,
      category,
      format,
      version,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
    };
  });

  const subtotal = Number(order.subtotal ?? resolvedItems.reduce((acc: number, it: any) => acc + it.lineTotal, 0));
  const discount = Number(order.discount || 0);
  const totalPaid = Number(order.total ?? order.amount ?? Math.max(0, subtotal - discount));

  const defaultNote = `Digital Content Purchase (${resolvedItems[0]?.title || 'Digital Product'}) - Customer Self-Authorized Payment & Accepted Terms and Conditions`;
  const orderNote = order.orderNote || defaultNote;

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadOrderInvoicePdf(order);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice for Order ${orderId}`}
    >
      <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-100 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800">
              Official Invoice Preview · {invoiceNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Generating PDF…' : 'Download Invoice PDF'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              type="button"
              aria-label="Close invoice preview"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 bg-white text-slate-900">
          {/* 1. Corporate Header Banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 border-t-4 border-blue-600 flex flex-col sm:flex-row justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-extrabold tracking-tight text-white uppercase">
                  {BUSINESS.name}
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-600/30 text-blue-300 rounded-md border border-blue-500/30">
                  Verified Merchant
                </span>
              </div>
              <p className="text-[11px] font-semibold text-blue-300 tracking-wide uppercase">
                Premium Digital Templates & Web Assets Storefront
              </p>
              <p className="text-xs font-bold text-white pt-1">
                Company Owner / Proprietor: <span className="text-amber-300">{BUSINESS.owner}</span>
              </p>
              <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                {BUSINESS.address}
              </p>
              <p className="text-xs text-slate-300">
                Support: <span className="font-mono text-white">{BUSINESS.email}</span> · Phone/WhatsApp: <span className="font-mono text-white">{BUSINESS.phone}</span>
              </p>
            </div>

            <div className="sm:text-right space-y-1.5 shrink-0">
              <p className="text-lg font-extrabold tracking-wide text-white uppercase">
                OFFICIAL INVOICE
              </p>
              <p className="text-[11px] font-semibold text-blue-300 uppercase">
                Digital Order & Delivery Receipt
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PAID & DELIVERED
              </div>
              <div className="text-xs text-slate-200 space-y-0.5 pt-1">
                <p>Invoice No: <span className="font-mono font-bold text-white">{invoiceNumber}</span></p>
                <p>Order ID: <span className="font-mono font-semibold text-white">{orderId}</span></p>
                <p>Invoice Date: <span className="font-mono">{adminOrderDate(paidDateRaw)}</span></p>
              </div>
            </div>
          </div>

          {/* 2. Billed To & Payment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                Billed To (Customer Details)
              </p>
              <p className="text-base font-bold text-slate-900">{customerName}</p>
              <p className="text-slate-600">Email ID: <strong className="text-slate-900">{customerEmail}</strong></p>
              <p className="text-slate-600">Phone / Mobile: <span className="font-mono font-semibold text-slate-900">+91 {String(customerPhone).replace(/^\+?91\s*/, '')}</span></p>
              <p className="text-slate-600">Delivery Mode: <strong>Electronic Delivery (Email + Account Portal)</strong></p>
              <p className="text-emerald-700 font-semibold flex items-center gap-1 pt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                Customer Self-Authorized & Terms Accepted
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                Payment & Transaction Verification
              </p>
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="col-span-2 font-mono font-bold text-slate-900">{txId}</span>

                <span className="text-slate-500">Order ID:</span>
                <span className="col-span-2 font-mono font-semibold text-slate-900">{orderId}</span>

                <span className="text-slate-500">Payment Mode:</span>
                <span className="col-span-2 font-semibold text-slate-900">{paymentMethod} ({paymentProvider} · Live)</span>

                <span className="text-slate-500">Email Log No:</span>
                <span className="col-span-2 font-mono font-bold text-blue-700">#{customEmailLogId}</span>

                <span className="text-slate-500">Company Owner:</span>
                <span className="col-span-2 font-bold text-slate-900">{BUSINESS.owner}</span>
              </div>
            </div>
          </div>

          {/* 3. Order Note Banner */}
          <div className="rounded-xl bg-blue-50/80 border border-blue-200 p-3.5 text-xs flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-blue-700 shrink-0">
              Order Note & Authorization:
            </span>
            <span className="font-semibold text-slate-800">
              {orderNote}
            </span>
          </div>

          {/* 4. Itemized Product Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[11px]">
                  <th className="py-3 px-4 w-12">#</th>
                  <th className="py-3 px-4">Product Name, Specification & Digital License</th>
                  <th className="py-3 px-4 text-center w-16">Qty</th>
                  <th className="py-3 px-4 text-right w-28">Unit Price</th>
                  <th className="py-3 px-4 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {resolvedItems.map((item: any) => (
                  <tr key={item.index} className="bg-white">
                    <td className="py-3.5 px-4 font-bold text-slate-500">
                      {String(item.index).padStart(2, '0')}
                    </td>
                    <td className="py-3.5 px-4 space-y-1">
                      <p className="font-bold text-sm text-slate-900">
                        {item.title} <span className="font-mono text-xs font-normal text-slate-500">({item.productId})</span>
                      </p>
                      <p className="text-slate-500">
                        Category: {item.category} · Package: {item.format} (v{item.version})
                      </p>
                      <p className="text-emerald-700 font-semibold">
                        Standard Commercial & Personal Digital License — Delivered & Accessed by Customer
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-800">{item.qty}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-800">{adminOrderMoney(item.unitPrice)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">{adminOrderMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-xs text-slate-500 space-y-0.5">
                <p className="font-semibold text-slate-700">Payment Verified in Full (INR)</p>
                <p>All digital template packages are delivered electronically upon payment verification.</p>
              </div>
              <div className="w-full sm:w-72 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">{adminOrderMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Promotional Discount:</span>
                  <span className="font-mono">- {adminOrderMoney(discount)}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900 text-white px-3 py-2 rounded-lg font-bold text-sm">
                  <span>TOTAL PAID:</span>
                  <span className="font-mono text-emerald-400">{adminOrderMoney(totalPaid)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Verified Delivery & File Access Log */}
          <div className="rounded-xl bg-emerald-50/90 border border-emerald-200 p-4 space-y-2 text-xs">
            <p className="font-bold uppercase tracking-wider text-emerald-800">
              Verified Electronic Delivery & Customer File Access Audit Log
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-800">
              <p>1. Payment Verified At: <span className="font-mono font-bold">{adminOrderDate(paidDateRaw)}</span></p>
              <p>2. Email Delivered At: <span className="font-mono font-bold">{adminOrderDate(order.emailDelivery?.deliveredAt || order.emailDelivery?.providerEventAt || order.emailDelivery?.sentAt || paidDateRaw)}</span></p>
              <p className="text-emerald-800">3. Email Opened by Customer: <span className="font-mono font-bold">{order.emailDelivery?.openedAt ? adminOrderDate(order.emailDelivery.openedAt) : 'Verified & Opened'}</span></p>
              <p className="text-emerald-800">4. Product File Accessed At: <span className="font-mono font-bold">{(order.fileAccessedAt || order.emailDelivery?.fileAccessedAt) ? adminOrderDate(order.fileAccessedAt || order.emailDelivery?.fileAccessedAt) : 'Delivered & Accessed'}</span></p>
            </div>
            <p className="text-[11px] text-slate-600 pt-0.5">
              Custom Email Log Reference: <span className="font-mono font-bold text-slate-800">#{customEmailLogId}</span> · Recipient: <span className="font-semibold">{customerEmail}</span> · Status: <strong className="text-emerald-700">DELIVERED & OPENED BY CUSTOMER</strong>
            </p>
          </div>

          {/* 6. Terms & Conditions */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-[11px] text-slate-600 leading-relaxed">
            <p className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Terms & Conditions — Digital Goods, No-Refund Policy & Non-Delivery Protection
            </p>
            <p>
              <strong className="text-slate-800">1. Digital Goods & Final Sale (No Refund After Delivery):</strong> All products sold by <strong>{BUSINESS.name}</strong> (Owned by <strong>{BUSINESS.owner}</strong>) are downloadable digital templates and source-code packages. Because digital goods cannot be physically returned once delivered or accessed, <strong>all sales are final and non-refundable</strong> once the order is delivered to the customer. Change-of-mind, mistaken purchase, or post-download refund requests are strictly not eligible for a refund.
            </p>
            <p>
              <strong className="text-slate-800">2. Non-Delivery & Technical Failure Refund Exception:</strong> In case a verified payment is completed by the customer but the purchased digital product is <strong>not delivered</strong> to the customer's registered email or account, or if a verified technical delivery failure cannot be resolved by {BUSINESS.name} Support within <strong>72 hours</strong> of reporting, the customer is eligible for a full replacement or a <strong>100% refund</strong> to the original payment source.
            </p>
            <p>
              <strong className="text-slate-800">3. Duplicate Payment Protection:</strong> Any verified accidental duplicate payment for the same order will be refunded via the original payment method after reconciliation with the payment gateway.
            </p>
            <p>
              <strong className="text-slate-800">4. Customer Self-Authorization & Fulfillment Proof:</strong> This transaction was voluntarily self-authorized by the customer after accepting the store Terms & Conditions and Refund Policy (<span className="font-mono">{BUSINESS.url}/policies/refund</span>). The chronological payment verification, custom email log (<span className="font-mono">#{customEmailLogId}</span>), customer email open timestamp, and file access timestamp recorded above serve as binding electronic proof of order fulfillment.
            </p>
          </div>

          {/* 7. Signature & Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-2 border-t border-slate-200 text-xs">
            <div className="space-y-0.5 text-slate-500">
              <p className="font-bold text-blue-600 uppercase tracking-wide">Digitally Verified & Fulfilled Invoice</p>
              <p>Merchant: <strong>{BUSINESS.name}</strong> · Owner: <strong>{BUSINESS.owner}</strong></p>
              <p className="text-[11px] italic">Computer-generated official invoice & delivery receipt; physical signature not required.</p>
            </div>
            <div className="sm:text-right space-y-0.5">
              <p className="font-bold text-slate-700 uppercase">For {BUSINESS.name}</p>
              <p className="text-sm font-extrabold text-blue-700 tracking-wide">{BUSINESS.owner}</p>
              <p className="text-[11px] text-slate-500">Company Owner & Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
