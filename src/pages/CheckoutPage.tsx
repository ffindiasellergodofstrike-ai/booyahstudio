import { selectCustomerCheckout, type GatewayAvailability } from '../config/checkout';
import { hasLivePayment } from '../services/PaymentEnvironment';
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CreditCard,
  Lock,
  CheckCircle2,
  XCircle,
  Download,
  Sparkles,
  ChevronRight,
  PackageCheck,
  RefreshCw,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { OrderService } from '../services/OrderService';
import { PaymentService } from '../services/PaymentService';
import { isVerifiedPaidOrder, verifyReturnedPayment } from '../services/PaymentVerification';
import { Order } from '../types';

import { AuthService } from '../services/AuthService';

declare global {
  interface Window {
    EasebuzzCheckout: any;
    Paddle: any;
  }
}

const PADDLE_CHECKOUT_SCRIPT = 'https://cdn.paddle.com/paddle/v2/paddle.js';
let paddleScriptPromise: Promise<void> | null = null;

const loadPaddleCheckout = (): Promise<void> => {
  if (window.Paddle) return Promise.resolve();
  if (!paddleScriptPromise) {
    paddleScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PADDLE_CHECKOUT_SCRIPT;
      script.async = true;
      script.onload = () => (window.Paddle ? resolve() : reject(new Error('Secure checkout failed to load.')));
      script.onerror = () => reject(new Error('Secure checkout could not load. Please check your connection.'));
      document.body.appendChild(script);
    }).catch((error) => {
      document.querySelector(`script[src="${PADDLE_CHECKOUT_SCRIPT}"]`)?.remove();
      paddleScriptPromise = null;
      throw error;
    });
  }
  return paddleScriptPromise;
};

const EASEBUZZ_CHECKOUT_SCRIPT = 'https://ebz-static.s3.ap-south-1.amazonaws.com/easecheckout/v2.0.0/easebuzz-checkout-v2.min.js';
let easebuzzScriptPromise: Promise<void> | null = null;

const loadEasebuzzCheckout = (): Promise<void> => {
  if (window.EasebuzzCheckout) return Promise.resolve();
  if (!easebuzzScriptPromise) {
    easebuzzScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = EASEBUZZ_CHECKOUT_SCRIPT;
      script.async = true;
      script.onload = () => window.EasebuzzCheckout
        ? resolve()
        : reject(new Error('Secure checkout did not load. Please try again.'));
      script.onerror = () => reject(new Error('Secure checkout could not load. Please check your connection and try again.'));
      document.body.appendChild(script);
    }).catch((error) => {
      document.querySelector(`script[src="${EASEBUZZ_CHECKOUT_SCRIPT}"]`)?.remove();
      easebuzzScriptPromise = null;
      throw error;
    });
  }
  return easebuzzScriptPromise;
};

export const CheckoutPage: React.FC = () => {
  const { cartItems, cartSummary, appliedCoupon, clearCart, currentUser, navigate, searchParams } = useApp();
  const { showToast } = useToast();

  // Form State
  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.mobile || '');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState<GatewayAvailability>({});
  useEffect(() => {
    fetch('/api/config/payments').then(response => response.json()).then(data => { if(data.success) setGatewayConfig(data.gateways); }).catch(() => undefined);
  }, []);
  const paymentMethod = selectCustomerCheckout(gatewayConfig, cartItems.length === 1 && cartItems[0].quantity === 1 && cartSummary.discount === 0);
  const canCheckout = paymentMethod !== null;

  // Processing & Completed State
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [paymentView, setPaymentView] = useState<'checking' | 'pending' | 'failed'>(() =>
    searchParams.status === 'failed' ? 'failed' : searchParams.status === 'pending' ? 'pending' : 'checking');

  // Handle Redirect Back from Gateways
  useEffect(() => {
    let isCancelled = false;
    const status = searchParams.status;
    const orderId = searchParams.orderId;

    if ((status === 'success' || status === 'pending' || status === 'failed') && orderId) {
      let retryTimer: number | undefined;
      let lastVerificationMessage: string | undefined;
      const verificationStartedAt = Date.now();
      const canRetry = (attempt: number) => attempt < 14 && Date.now() - verificationStartedAt < 60_000;
      setVerificationError(null);
      setPaymentView(status === 'failed' ? 'failed' : status === 'pending' ? 'pending' : 'checking');

      const poll = async (attempt: number) => {
        try {
          const outcome = await verifyReturnedPayment(
            () => OrderService.fetchOrderById(orderId),
            async () => {
              const order = await OrderService.fetchOrderById(orderId);
              const provider = String(order?.paymentProvider || '').toLowerCase();
              if (!['easebuzz', 'payu', 'paddle'].includes(provider)) return { success: false, httpStatus: 409, status: 'PENDING', message: 'No payment has been initiated for this order.' };
              const response = await fetch(`/api/payments/${provider}/reconcile/${encodeURIComponent(orderId)}`, { method: 'POST', credentials: 'include', cache: 'no-store' });
              const result = await response.json();
              return { ...result, httpStatus: response.status };
            },
          );
          if (isCancelled) return;
          if (outcome.kind === 'auth_required') {
            setPaymentView(status === 'failed' ? 'failed' : 'pending');
            setVerificationError('Your session expired. Please sign in and check the order in your account.');
            return;
          }
          if (outcome.kind === 'paid') {
            setCompletedOrder(outcome.order);
            clearCart();
            try {
              confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            } catch {}
            showToast('success', hasLivePayment(outcome.order) ? 'Payment confirmed' : 'Payment check complete', hasLivePayment(outcome.order) ? 'Your payment is confirmed.' : 'This transaction did not create a purchase.');
            return;
          }
          if (outcome.kind === 'failed') {
            setPaymentView('failed');
            setVerificationError(outcome.message);
            if (attempt < 3 && canRetry(attempt)) {
              retryTimer = window.setTimeout(() => { void poll(attempt + 1); }, 2000);
            }
            return;
          }
          setPaymentView((current) => status === 'failed' && current === 'failed' ? 'failed' : 'pending');
          if (canRetry(attempt)) {
            lastVerificationMessage = outcome.message || lastVerificationMessage;
            retryTimer = window.setTimeout(() => { void poll(attempt + 1); }, 2000);
          } else {
            setVerificationError(outcome.message || lastVerificationMessage ||
              'Payment is still pending. Check again or view the order in your account.');
          }
        } catch {
          if (isCancelled) return;
          setPaymentView(status === 'failed' ? 'failed' : 'pending');
          if (canRetry(attempt)) {
            retryTimer = window.setTimeout(() => { void poll(attempt + 1); }, 2000);
          } else {
            setVerificationError('We could not get the latest result yet. Your order will update automatically once payment is verified.');
          }
        }
      };

      void poll(0);
      return () => {
        isCancelled = true;
        if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      };
    }
  }, [searchParams.status, searchParams.orderId]);

  useEffect(() => {
    if (!completedOrder || completedOrder.deliveryStatus === 'REVOKED' ||
        ((isVerifiedPaidOrder(completedOrder) || !hasLivePayment(completedOrder)) && completedOrder.emailDelivery?.status)) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (++attempts > 20) {
        window.clearInterval(timer);
        return;
      }
      void OrderService.fetchOrderById(completedOrder.id).then((latest) => {
        if (latest?.paymentStatus === 'PAID') setCompletedOrder(latest);
      }).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [completedOrder?.id, completedOrder?.deliveryStatus, completedOrder?.emailDelivery?.status]);

  // Sync customer form data when currentUser is loaded
  useEffect(() => {
    if (currentUser) {
      if (!customerName) setCustomerName(currentUser.name || '');
      setCustomerEmail(currentUser.email || '');
      if (!customerPhone) setCustomerPhone(currentUser.mobile || '');
    }
  }, [currentUser]);

  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      showToast('error', 'Terms Required', 'Please accept the terms and purchase policies before continuing.');
      return;
    }
    if (cartItems.length === 0) {
      showToast('error', 'Cart Empty', 'Add products to your cart before proceeding.');
      return;
    }

    if (!canCheckout) { showToast('info', 'Checkout unavailable', 'Online checkout is temporarily unavailable. Please contact us for help.'); return; }
    setIsProcessing(true);

    try {
      const sanitizedPhone = (customerPhone || '').replace(/\D/g, '').slice(-10);

      if (paymentMethod === 'payu') {
        const pendingOrder = await OrderService.createPendingOrderAsync(cartItems, { fullName: customerName, email: customerEmail, country: 'India', phone: sanitizedPhone } as any, cartSummary.discount, appliedCoupon?.code, 'PayU');
        const result = await PaymentService.initiatePayUPayment(pendingOrder.id, agreeTerms);
        if (!result.success || !result.action || !result.fields) throw new Error(result.message || 'Could not start secure checkout.');
        if (!['https://test.payu.in/_payment', 'https://secure.payu.in/_payment'].includes(result.action)) throw new Error('Unexpected payment destination.');
        const form = document.createElement('form');
        form.method = 'POST'; form.action = result.action;
        for (const [name, value] of Object.entries(result.fields)) { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input); }
        document.body.appendChild(form); form.submit(); form.remove();
      } else if (paymentMethod === 'paddle') {
        // 1. Preload Paddle.js
        await loadPaddleCheckout();

        // 2. Create pending order via backend API
        const pendingOrder = await OrderService.createPendingOrderAsync(
          cartItems,
          {
            fullName: customerName,
            email: customerEmail,
            country: 'India',
            phone: sanitizedPhone,
          } as any,
          cartSummary.discount,
          appliedCoupon?.code,
          'Paddle (Card / PayPal / Apple Pay)'
        );

        // 3. Initiate Paddle checkout on backend
        const initResult = await PaymentService.initiatePaddlePayment(pendingOrder.id, agreeTerms);

        if (initResult.success && initResult.priceId && initResult.clientToken) {
          if (!window.Paddle) {
            throw new Error('Secure checkout is not ready. Please refresh and retry.');
          }

          // Initialize Paddle with client token and environment
          if (initResult.environment === 'sandbox') {
            window.Paddle.Environment.set('sandbox');
          }

          window.Paddle.Initialize({
            token: initResult.clientToken,
            eventCallback: (data: any) => {
              if (data?.name === 'checkout.completed') {
                window.location.href = `/checkout?status=pending&orderId=${encodeURIComponent(pendingOrder.id)}`;
              } else if (data?.name === 'checkout.closed') {
                setIsProcessing(false);
              }
            },
          });

          const returnUrl = `${window.location.origin}/checkout?status=pending&orderId=${encodeURIComponent(pendingOrder.id)}`;

          // 4. Open Paddle Overlay Checkout
          window.Paddle.Checkout.open({
            items: [{ priceId: initResult.priceId, quantity: 1 }],
            customer: {
              email: customerEmail,
            },
            customData: {
              orderId: pendingOrder.id,
              userId: currentUser?.id || '',
              productId: (pendingOrder as any).productId || pendingOrder.items?.[0]?.productId || '',
            },
            settings: {
              displayMode: 'overlay',
              theme: 'light',
              locale: 'en',
              successUrl: returnUrl,
            },
          });
        } else {
          setIsProcessing(false);
          showToast('error', 'Initiation Failed', 'We could not open checkout. Please try again or contact support.');
        }
      } else {
        // Easebuzz checkout flow
        await loadEasebuzzCheckout();
        const pendingOrder = await OrderService.createPendingOrderAsync(
          cartItems,
          {
            fullName: customerName,
            email: customerEmail,
            country: 'India',
            phone: sanitizedPhone,
          } as any,
          cartSummary.discount,
          appliedCoupon?.code,
          'Easebuzz UPI/Cards/Netbanking'
        );

        const initResult = await PaymentService.initiateEasebuzzPayment(pendingOrder.id, agreeTerms);

        if (initResult.success && initResult.accessKey && initResult.merchantKey) {
          const easebuzzCheckout = new window.EasebuzzCheckout(
            initResult.merchantKey,
            initResult.environment || 'test'
          );

          const options = {
            access_key: initResult.accessKey,
            onResponse: async (response: any) => {
              const failed = ['failure', 'failed', 'usercancelled', 'cancelled']
                .includes(String(response?.status || '').toLowerCase());
              let status = failed ? 'failed' : 'pending';

              if (response?.hash && response?.txnid) {
                try {
                  const result = await fetch('/api/payments/easebuzz/popup-response', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(response), signal: AbortSignal.timeout(8000),
                  });
                  const verified = await result.json();
                  if (result.ok && verified.status === 'PAID') status = 'success';
                  else if (result.ok && verified.status === 'FAILED') status = 'failed';
                } catch {}
              }
              window.location.href = `/checkout?status=${status}&orderId=${encodeURIComponent(pendingOrder.id)}`;
            },
          };

          easebuzzCheckout.initiatePayment(options);
        } else {
          setIsProcessing(false);
          showToast('error', 'Initiation Failed', 'We could not open checkout. Please try again or contact support.');
        }
      }
    } catch (err: any) {
      setIsProcessing(false);
      showToast('error', 'Checkout Error', 'We could not open checkout. Please try again or contact support.');
    }
  };

  const handleSecureDownload = async (productId: string, defaultName: string) => {
    try {
      showToast('info', 'Authorizing Download', 'Preparing your download link…');
      const res = await OrderService.requestDownloadToken(productId);
      if (res.success && res.downloadUrl) {
        showToast('success', 'Download Initiated', `Streaming ${defaultName}...`);
        const a = document.createElement('a');
        a.href = res.downloadUrl;
        a.download = defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        showToast('error', 'Download unavailable', 'We could not prepare your download. Check your order in your account or contact support.');
      }
    } catch (err) {
      showToast('error', 'Download Failed', 'Could not request secure download link.');
    }
  };

  if (completedOrder && !hasLivePayment(completedOrder)) {
    return <div className="max-w-2xl mx-auto px-6 py-16 text-center space-y-6"><p className="eyebrow justify-center">BOOYAH STUDIO</p><h1 className="text-3xl font-bold">Payment check complete</h1><p className="text-slate-600 leading-8">This transaction did not create a purchase. No product files, download access or purchase invoice will be issued. Contact us if you need help with a payment shown on your bank statement.</p><p className="text-sm">Reference: {completedOrder.orderNumber}</p><p role="status" className="text-sm">{completedOrder.emailDelivery?.status === 'sent' ? 'A confirmation email has been sent.' : completedOrder.emailDelivery?.status === 'failed' || completedOrder.emailDelivery?.status === 'not_configured' ? 'This transaction was recorded, but the email could not be sent. Please contact support.' : 'A confirmation email is being prepared.'}</p><button className="studio-button primary" onClick={()=>navigate('/account')}>View account</button></div>;
  }

  // SUCCESS CONFIRMATION VIEW
  if (completedOrder) {
    const deliveryReady = isVerifiedPaidOrder(completedOrder);
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Success Header */}
      <div className="bg-white rounded-3xl border border-emerald-200 shadow-xl p-6 sm:p-10 text-center space-y-5">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner border-4 border-white">
          <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
            Payment Successful
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {deliveryReady ? 'Thank You For Your Purchase!' : 'Payment Confirmed'}
          </h1>
          <p className="text-slate-600 text-xs sm:text-base max-w-lg mx-auto leading-relaxed">
            {deliveryReady ? 'Your digital products are ready for' : 'We are preparing digital access for'}{' '}
            <strong className="text-slate-900 break-all">{completedOrder.customerEmail || completedOrder.customer?.email}</strong>.
          </p>
          <p className="text-slate-600 text-xs sm:text-sm">
            Invoice: <strong>{completedOrder.invoiceNumber || `INV-${completedOrder.orderNumber}`}</strong>
            {completedOrder.emailDelivery?.status === 'sent'
              ? ' · Confirmation email accepted for delivery.'
              : completedOrder.emailDelivery?.status === 'failed' || completedOrder.emailDelivery?.status === 'not_configured'
                ? ' · Email delivery needs attention. Your order remains available in your account.'
                : ' · Confirmation email is being prepared. Your order is saved in your account.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 px-4 py-3 sm:py-4 bg-slate-50 rounded-2xl border border-slate-200 text-[10px] sm:text-xs font-mono font-bold text-slate-700">
          <span className="break-all">Reference: <strong className="text-slate-900">{completedOrder.orderNumber}</strong></span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="truncate">Paid: <strong className="text-emerald-600">₹{completedOrder.total.toFixed(2)}</strong></span>
        </div>
      </div>

      {!deliveryReady && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 sm:p-6 text-sm text-blue-900 leading-relaxed">
          Payment is confirmed. Your files and email are being prepared. Check My Account in a moment for your downloads and invoice.
        </div>
      )}

      {/* Digital Downloads Card */}
      {deliveryReady && (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
        <div className="p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <PackageCheck className="w-6 h-6 text-blue-600 shrink-0" />
            <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">Your downloads</h2>
          </div>
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 uppercase tracking-widest self-start sm:self-center">
            Instant Access
          </span>
        </div>

        <div className="p-5 sm:p-8 space-y-6">
          <div className="space-y-4">
            {completedOrder.items.map((item, idx) => (
              <div
                key={idx}
                className="p-5 sm:p-6 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-5 transition-all hover:border-slate-300"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                      {item.product?.categoryLabel || item.category || 'Digital Product'}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 break-words">{item.product?.title || item.productTitle}</h3>
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">
                      Archive: {item.product?.slug || item.productSlug || item.productId}-v{item.product?.version || item.version || '1.0'}.zip ({item.product?.fileSize || item.fileSize || 'Size varies'})
                    </p>
                  </div>

                  <button
                    id={`download-archive-btn-${idx}`}
                    onClick={() => handleSecureDownload(item.productId || item.product?.id, `${item.product?.slug || item.productSlug || item.productId}-v${item.product?.version || item.version || '1.0'}.zip`)}
                    className="p-2 sm:px-6 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] sm:min-w-0 shrink-0"
                  >
                    <Download className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="hidden sm:inline">Download Package</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
            <button
              onClick={() => navigate('/account')}
              className="w-full sm:w-auto text-xs sm:text-sm font-black text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1.5 py-2 group min-h-[44px]"
            >
              <span className="truncate">View All Orders in Dashboard</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1 shrink-0" />
            </button>

            <button
              onClick={() => navigate('/products')}
              className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-black text-white font-black rounded-xl text-xs sm:text-sm transition-all shadow-xl active:scale-95 min-h-[44px]"
            >
              Continue Browsing Store
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
    );
  }

  // The URL is a hint; order and gateway state decide the visible result.
  const isReturningFromGateway = ['success', 'pending', 'failed'].includes(searchParams.status || '') &&
    Boolean(searchParams.orderId);
  if (isReturningFromGateway) {
    const failed = paymentView === 'failed';
    const checking = paymentView === 'checking';
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16 text-center space-y-6 min-w-0">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${failed ? 'bg-red-50 text-red-600' : checking ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
          {failed ? <XCircle className="w-10 h-10" /> : <Clock className="w-10 h-10" />}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 break-words">
            {failed ? 'Payment Failed' : checking ? 'Checking Payment Status' : 'Payment Pending'}
          </h1>
          <p className="text-slate-600 max-w-lg mx-auto text-sm leading-relaxed">
            {failed
              ? 'The payment was not completed. No download access was granted. If you were charged, your saved order will update when your payment provider confirms the final result.'
              : checking
                ? 'Loading the latest result for your order.'
                : 'The bank has not confirmed this payment yet. This page updates automatically when a confirmed result arrives.'}
          </p>
        </div>
        {verificationError && <p className={`max-w-md mx-auto p-4 rounded-2xl text-sm break-words ${failed ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>{verificationError}</p>}
        <div className="flex justify-center max-w-md mx-auto">
          <button onClick={() => navigate('/account')}
            className="px-5 py-3 bg-white border border-slate-200 text-slate-800 font-bold rounded-xl min-h-[44px]">
            View My Orders
          </button>
        </div>
        <p className="text-xs text-slate-500 break-all">Order: {searchParams.orderId}</p>
      </div>
    );
  }

  // AUTH REQUIREMENT GUARD
  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-8">
        <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner border border-blue-100">
          <Lock className="w-10 h-10" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Login Required</h1>
          <p className="text-slate-600 max-w-sm mx-auto text-sm leading-relaxed">
            Please sign in to your BOOYAH STUDIO account or create a new one to place orders, manage billing, and access instant downloads.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate('/login', undefined, { redirect: 'checkout' })}
            className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 active:scale-95 min-h-[44px]"
          >
            Sign In Now
          </button>
          <button
            onClick={() => navigate('/register', undefined, { redirect: 'checkout' })}
            className="w-full sm:w-auto px-8 py-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-extrabold rounded-xl text-sm transition-all active:scale-95 min-h-[44px]"
          >
            Create Account
          </button>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-[11px] text-slate-500 flex items-start gap-2.5 text-left max-w-md mx-auto">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <span>You can still add items to your cart without signing in, but a registered customer account is required to generate transactional secure download vaults and invoices.</span>
        </div>
      </div>
    );
  }

  // STANDARD CHECKOUT FORM VIEW
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Checkout Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleProcessCheckout} className="space-y-6">
            {/* 1. Customer Digital Delivery Info */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span>Customer & Digital Delivery Info</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="checkout-name" className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    id="checkout-name"
                    autoComplete="name"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Alex Henderson"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="checkout-email" className="block text-xs font-bold text-slate-700 mb-1">
                    Account Email <span className="text-slate-600 font-normal">(for file delivery)</span>
                  </label>
                  <input
                    type="email"
                    id="checkout-email"
                    autoComplete="email"
                    required
                    value={customerEmail}
                    readOnly
                    placeholder="alex@company.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="checkout-phone" className="block text-xs font-bold text-slate-700 mb-1">Indian Mobile Number</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-600 font-bold">+91</span>
                    <input
                      type="tel"
                      id="checkout-phone"
                      autoComplete="tel-national"
                      required
                      pattern="[6-9][0-9]{9}"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9998887776"
                      className="w-full pl-12 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Country</label>
                  <div className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700">India</div>
                </div>
              </div>
            </div>

            {/* 2. Payment Method Selector */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span>Payment Method</span>
              </h2>

              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <p className="font-bold text-slate-900">Secure online payment</p>
                <p className="text-sm text-slate-600">Choose from the payment options available when you continue. Your order total is shown before you pay.</p>
                <p className="text-sm text-slate-600">Delivery on email · Secure download links are sent after payment confirmation.</p>
              </div>
              {!canCheckout && <p role="status" className="text-sm text-slate-600 leading-6">Online checkout is temporarily unavailable. <button type="button" onClick={() => navigate('/contact')} className="underline font-semibold">Contact us for help</button>.</p>}
              <p className="text-xs leading-6 text-slate-600">India checkout · INR · Digital delivery only, no shipping fees. Review the <button type="button" onClick={()=>navigate('/policies/refund')} className="underline font-medium hover:text-blue-600">Refund & Return Policy</button>, <button type="button" onClick={()=>navigate('/policies/cancellation')} className="underline font-medium hover:text-blue-600">Cancellation Policy</button>, and <button type="button" onClick={()=>navigate('/policies/delivery')} className="underline font-medium hover:text-blue-600">Digital Delivery Policy</button> before paying. Change-of-mind refunds are generally unavailable after access is delivered; non-delivery, defects, and duplicate charges remain covered.</p>

              {/* Terms Checkbox */}
              <div className="pt-2 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 rounded text-blue-600 accent-blue-600 w-4 h-4 cursor-pointer shrink-0"
                />
                <label htmlFor="agree-terms" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
                  I explicitly acknowledge and agree to the BOOYAH STUDIO{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/policies/terms')}
                    className="text-blue-600 font-bold hover:underline inline-block align-baseline"
                  >
                    Terms & Conditions
                  </button>
                  ,{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/policies/refund')}
                    className="text-blue-600 font-bold hover:underline inline-block align-baseline"
                  >
                    Refund & Return Policy
                  </button>
                  ,{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/policies/delivery')}
                    className="text-blue-600 font-bold hover:underline inline-block align-baseline"
                  >
                    Digital Delivery Policy
                  </button>
                  , and{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/policies/cancellation')}
                    className="text-blue-600 font-bold hover:underline inline-block align-baseline"
                  >
                    Cancellation Policy
                  </button>
                  . I have read the{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/policies/privacy')}
                    className="text-blue-600 font-bold hover:underline inline-block align-baseline"
                  >
                    Privacy Policy
                  </button>
                  {' '}and understand that digital delivery begins after payment confirmation.
                </label>
              </div>
            </div>

            {/* Complete Purchase Button */}
            <button
              id="submit-order-btn"
              type="submit"
              disabled={isProcessing || !canCheckout}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-base transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Preparing Secure Checkout...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{!canCheckout ? "Checkout temporarily unavailable" : `Continue to payment (₹${cartSummary.total.toFixed(2)})`}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Order Review Sidebar (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-4 sticky top-24">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Order Review ({cartItems.length} Items)
            </h2>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto space-y-2">
              {cartItems.map((item) => (
                <div key={item.product.id} className="pt-2 flex justify-between gap-4 text-xs min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 line-clamp-2 break-words leading-tight">{item.product.title}</p>
                    <p className="text-slate-500 mt-0.5">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-slate-800 shrink-0">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">₹{cartSummary.subtotal.toFixed(2)}</span>
              </div>
              {cartSummary.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount ({appliedCoupon?.code}):</span>
                  <span className="font-mono">-₹{cartSummary.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery:</span>
                <span className="text-emerald-700 font-semibold">Delivery on email</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900">Total Price:</span>
                <span className="text-xl font-extrabold text-emerald-600 font-mono">
                  ₹{cartSummary.total.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/80 border border-blue-100 rounded-2xl text-[11px] text-blue-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">BOOYAH STUDIO Digital Delivery</span>
                <p className="text-blue-700/90 leading-relaxed">
                  Secure download links are delivered by email and in your account after payment confirmation. We aim to acknowledge support complaints within 48 hours; see our policies for resolution and refund timelines.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
