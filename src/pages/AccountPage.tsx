import { hasLivePayment } from '../services/PaymentEnvironment';
import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Package,
  Download,
  LogOut,
  ShieldCheck,
  FolderDown,
  Heart,
  Settings,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  ArrowRight,
  Eye,
  KeyRound,
  Calendar,
  Building,
  Globe,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { OrderService } from '../services/OrderService';
import { DownloadService } from '../services/DownloadService';
import type { Order } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';

const formatISTDate = (isoString?: string): string => {
  if (!isoString) return 'Not recorded';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (err) {
    return isoString;
  }
};

export const AccountPage: React.FC = () => {
  const {
    currentUser,
    isAuthenticated,
    signOut,
    updateProfile,
    wishlistCount,
    currentPath,
    navigate,
  } = useApp();
  const { showToast } = useToast();

  // Tab State synced with current path
  const getInitialTab = (): 'orders' | 'downloads' | 'settings' => {
    if (currentPath === '/account/downloads') return 'downloads';
    if (currentPath === '/account/settings') return 'settings';
    return 'orders';
  };

  const [activeTab, setActiveTab] = useState<'orders' | 'downloads' | 'settings'>(getInitialTab);

  useEffect(() => {
    if (currentPath === '/account/downloads') setActiveTab('downloads');
    else if (currentPath === '/account/settings') setActiveTab('settings');
    else if (currentPath === '/account/orders' || currentPath === '/account') setActiveTab('orders');
  }, [currentPath]);

  const switchTab = (tab: 'orders' | 'downloads' | 'settings') => {
    setActiveTab(tab);
    if (tab === 'orders') navigate('/account/orders');
    else if (tab === 'downloads') navigate('/account/downloads');
    else if (tab === 'settings') navigate('/account/settings');
  };

  // Profile Edit Inputs
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileCompany, setProfileCompany] = useState(currentUser?.company || '');
  const [profileCountry, setProfileCountry] = useState(currentUser?.country || 'United States');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileCompany(currentUser.company || '');
      setProfileCountry(currentUser.country || 'United States');
    }
  }, [currentUser]);

  // Invoice Modal State
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  const handleSecureDownload = async (productId: string, defaultName: string) => {
    try {
      showToast('info', 'Authorizing Download', 'Validating purchase access and secure token...');
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
        showToast('error', 'Download Denied', 'We could not prepare your download. Please contact support with your order reference.');
      }
    } catch (err) {
      showToast('error', 'Download Failed', 'Could not request secure download link.');
    }
  };

  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    let active = true;
    setOrders([]);
    if (currentUser) {
      void OrderService.fetchUserOrders().then((latestOrders) => {
        if (active) setOrders(latestOrders);
      });
    }
    return () => { active = false; };
  }, [currentUser?.id]);

  const downloads = orders
    .filter((order) => hasLivePayment(order) && order.paymentStatus?.toUpperCase() === 'PAID' &&
      order.deliveryStatus === 'DELIVERED' && order.downloadStatus === 'AVAILABLE' &&
      !['REFUNDED', 'PARTIALLY_REFUNDED', 'REVOKED', 'CANCELLED', 'FAILED'].includes(String(order.status).toUpperCase()) &&
      ['Easebuzz', 'PayU', 'Paddle'].includes(order.paymentProvider || '') && Boolean(order.transactionId))
    .flatMap((order) => order.items.map((item) => ({ ...item, orderId: order.id })));

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await updateProfile({
        name: profileName,
        company: profileCompany,
        country: profileCountry,
      });
      if (res.success) {
        showToast('success', 'Profile Updated', 'Your customer details have been synchronized.');
      } else {
        showToast('error', 'Update Failed', 'Could not save profile changes.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProtectedDownload = async (orderId: string, productId: string, fileName: string) => {
    showToast('info', 'Verifying Token', `Authorizing digital package for ${fileName}...`);
    try {
      const authResult = await DownloadService.getProtectedDownload(orderId, productId);
      if (authResult.success && authResult.downloadUrl) {
        showToast('success', 'Download Authorized', `Starting secure transfer of ${fileName}`);
        const a = document.createElement('a');
        a.href = authResult.downloadUrl;
        a.download = fileName.endsWith('.zip') ? fileName : `${fileName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        showToast('error', 'Download Unauthorized', 'We could not confirm download access. Please contact support with your order reference.');
      }
    } catch {
      showToast('error', 'Download Error', 'Could not generate verified download token.');
    }
  };

  const handleInvoiceDownload = async (order: Order) => {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/invoice`, {
        credentials: 'include', cache: 'no-store',
      });
      if (!response.ok) throw new Error('Invoice is unavailable.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${order.invoiceNumber || `INV-${order.orderNumber}`}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      showToast('error', 'Invoice Unavailable', 'Could not download your invoice. Please retry.');
    }
  };

  // UNAUTHENTICATED: Present sign in options
  if (!isAuthenticated || !currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100 p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Portal</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Please sign in to access your digital assets, download vault, and order receipts.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Sign In to Your Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate('/register')}
              className="w-full py-3.5 px-6 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-sm transition-all border border-slate-200 flex items-center justify-center gap-2"
            >
              <UserIcon className="w-4 h-4 text-slate-500" />
              <span>Create New Account</span>
            </button>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3 text-xs text-slate-600 text-left">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Secure server authentication with isolated user data stores.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATED: Dashboard View
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* User Header Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
        <div className="flex items-start sm:items-center gap-4 sm:gap-6 min-w-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md shadow-blue-500/20 border-2 border-white shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 truncate">{currentUser.name}</h1>
              {currentUser.username && (
                <span className="text-[10px] sm:text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200 truncate">
                  @{currentUser.username}
                </span>
              )}
              <span className="text-[9px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-2 min-w-0">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{currentUser.email}</span>
            </p>
            {currentUser.mobile && (
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex items-center gap-2 min-w-0">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">+91 {currentUser.mobile}</span>
              </p>
            )}
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1.5 min-w-0">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">Member since {formatISTDate(currentUser.createdAt)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center flex-wrap shrink-0">
          <button
            onClick={() => navigate('/wishlist')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-slate-200 min-h-[44px]"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="truncate">Wishlist ({wishlistCount})</span>
          </button>

          <button
            onClick={signOut}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-red-200/60 min-h-[44px]"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-hide">
        <button
          id="account-tab-orders"
          onClick={() => switchTab('orders')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap min-h-[44px] ${
            activeTab === 'orders'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" />
          <span>Orders ({orders.length})</span>
        </button>

        <button
          id="account-tab-downloads"
          onClick={() => switchTab('downloads')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap min-h-[44px] ${
            activeTab === 'downloads'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FolderDown className="w-4 h-4 shrink-0" />
          <span>Vault ({downloads.length})</span>
        </button>

        <button
          id="account-tab-settings"
          onClick={() => switchTab('settings')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap min-h-[44px] ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings</span>
        </button>
      </div>

      {/* Tab 1: Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <EmptyState
              type="orders"
              title="No orders yet"
              description="Browse our digital store and purchase scripts, tools or resources to populate your order history."
              actionText="Shop Catalog"
              actionPath="/products"
            />
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5 transition-all hover:border-slate-300"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
                  <div className="min-w-0">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 block">Reference</span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 font-mono truncate">
                      {order.orderNumber}
                    </h3>
                    <span className="text-[10px] sm:text-xs text-slate-500 block mt-0.5">{formatISTDate(order.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border tracking-wider ${
                      order.paymentStatus?.toUpperCase() === 'PAID'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {order.paymentStatus?.toUpperCase() === 'PAID' ? hasLivePayment(order) ? 'PAID' : 'NO PURCHASE' : order.status.toUpperCase()}
                    </span>
                    <button
                      onClick={() => setViewingOrder(order)}
                      className="p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 border border-slate-200 min-h-[44px] min-w-[44px] sm:min-w-0"
                    >
                      <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">Details</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {order.items.map((item, iIdx) => (
                    <div key={iIdx} className="flex items-start justify-between gap-4 text-xs">
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-900 truncate">{item.product?.title || item.productTitle}</p>
                        <p className="text-slate-500 mt-0.5 truncate">
                          Qty: {item.quantity || 1}
                        </p>
                      </div>
                      <span className="font-mono font-black text-slate-900 shrink-0 text-right">
                        ₹{(item.price * (item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">Payment: Online</span>
                  </div>
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                    <span className="text-lg sm:text-xl font-black text-emerald-600 font-mono">
                      ₹{order.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Downloads */}
      {activeTab === 'downloads' && (
        <div className="space-y-4">
          {downloads.length === 0 ? (
            <EmptyState
              type="orders"
              title="No active downloads found"
              description="All digital products purchased under this account appear here with secure download authorization."
              actionText="Browse Catalog"
              actionPath="/products"
            />
          ) : (
            downloads.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5 transition-all hover:border-slate-300"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block">
                      {item.product.categoryLabel}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 truncate">{item.product?.title || item.productTitle}</h3>
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1">
                      Version: <strong className="text-slate-800">v{item.product.version || '1.0.0'}</strong> • Archive: {item.product.fileSize || '25 MB'}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      handleProtectedDownload(
                        (item as any).orderId || 'ord_direct',
                        item.productId,
                        `${item.product.slug}-v${item.product.version || '1.0.0'}.zip`
                      )
                    }
                    className="p-2 sm:px-5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] sm:min-w-0 shrink-0"
                  >
                    <Download className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="hidden sm:inline">Download (.ZIP)</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <FolderDown className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest block">
                        Digital Asset Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Account Settings */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <span>Customer Information</span>
            </h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`@${currentUser.username || 'user'}`}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Account Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={currentUser.email}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Company / Organization
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={profileCompany}
                      onChange={(e) => setProfileCompany(e.target.value)}
                      placeholder="e.g. Acme Labs"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Country
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={profileCountry}
                      onChange={(e) => setProfileCountry(e.target.value)}
                      placeholder="e.g. United States"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                {isUpdating ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-5">
            <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Security & Encryption</span>
            </h3>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-950">Zero Plaintext Storage</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Password and security code are salted and hashed using bcrypt on the server before storage.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-950">Email and Mobile Recovery</p>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Reset your password with your registered email and mobile number.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Reset Password with Email and Mobile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {viewingOrder && (() => {
        const isPaid = hasLivePayment(viewingOrder) && String(viewingOrder.paymentStatus || '').toUpperCase() === 'PAID';
        const isDelivered = viewingOrder.deliveryStatus === 'DELIVERED' && viewingOrder.downloadStatus === 'AVAILABLE';
        const isTest = !hasLivePayment(viewingOrder) && viewingOrder.paymentStatus === 'PAID';
        const isFailed =
          String(viewingOrder.paymentStatus || '').toUpperCase() === 'FAILED' ||
          String(viewingOrder.status || '').toUpperCase() === 'FAILED';

        return (
          <Modal
            isOpen={!!viewingOrder}
            onClose={() => setViewingOrder(null)}
            title={`Order #${viewingOrder.orderNumber}`}
            maxWidth="md"
          >
            <div className="space-y-6">
              {isPaid ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Payment Status</p>
                    <p className="text-sm font-black text-emerald-900 truncate">COMPLETED & VERIFIED</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0 self-start sm:self-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-700">PAID IN FULL</span>
                  </div>
                </div>
              ) : isFailed ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Payment Status</p>
                    <p className="text-sm font-black text-rose-900 truncate">PAYMENT FAILED</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-rose-200 shrink-0 self-start sm:self-center">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <span className="text-[10px] font-black text-rose-700">NOT PAID</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Payment Status</p>
                    <p className="text-sm font-black text-amber-900 truncate">{isTest ? 'NO PURCHASE CREATED' : 'PAYMENT PENDING'}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shrink-0 self-start sm:self-center">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-black text-amber-700">{isTest ? 'NO PRODUCT DELIVERY' : 'AWAITING PAYMENT'}</span>
                  </div>
                </div>
              )}

              {!isPaid && !isFailed && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center gap-3 text-xs text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-medium">{isTest ? 'This transaction did not create a purchase. No files or purchase invoice will be issued.' : 'Downloads and your receipt become available after payment confirmation.'}</span>
                </div>
              )}
              {isPaid && <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 space-y-1">
                <p>{hasLivePayment(viewingOrder) ? `Invoice: ${viewingOrder.invoiceNumber || `INV-${viewingOrder.orderNumber}`}` : 'No completed purchase — no files or invoice.'}</p>
                <p>Payment verified: {formatISTDate(viewingOrder.paymentVerifiedAt)}</p>
                <p>Digital access: {isDelivered ? `Delivered ${formatISTDate(viewingOrder.deliveredAt)}` : 'Preparing delivery'}</p>
                <p>Email: {viewingOrder.emailDelivery?.status === 'sent' ? 'Sent' : ['failed', 'not_configured'].includes(viewingOrder.emailDelivery?.status || '') ? 'Delivery needs attention — contact support' : 'Being prepared'}</p>
              </div>}

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Order Items
                </h4>
                <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {viewingOrder.items.map((i: any, idx: number) => (
                    <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-50 transition-colors">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 text-sm truncate">{i.product.title}</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
                          Qty: {i.quantity || 1}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {isPaid && isDelivered && (
                          <button
                            onClick={() => handleSecureDownload(i.productId, `${i.productSlug || 'product'}-v${i.version || '1.0'}.zip`)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all active:scale-95 flex items-center gap-2"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        )}
                        <span className="font-mono font-black text-slate-900 shrink-0 text-right text-sm">
                          ₹{(i.price * i.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-900">₹{Number(viewingOrder.subtotal ?? viewingOrder.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <span>Tax (GST)</span>
                  <span className="font-mono text-slate-900">₹{Number(viewingOrder.tax || 0).toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-black text-slate-900">Total Amount</span>
                  <span className="text-xl font-black text-emerald-600 font-mono">₹{viewingOrder.total.toFixed(2)}</span>
                </div>
              </div>

              {isPaid && (
                <button
                  onClick={() => { void handleInvoiceDownload(viewingOrder); }}
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl text-xs sm:text-sm transition-all shadow-xl active:scale-95 min-h-[44px]"
                >
                  Print / Save PDF Receipt
                </button>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
