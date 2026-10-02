import React, { useState } from 'react';
import {
  ShoppingCart,
  ArrowRight,
  ShieldCheck,
  Tag,
  Trash2,
  Lock,
  Sparkles,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { CartItem } from '../components/CartItem';
import { EmptyState } from '../components/EmptyState';
import { Price } from '../components/Price';

export const CartPage: React.FC = () => {
  const {
    cartItems,
    cartSummary,
    clearCart,
    applyCoupon,
    removeCoupon,
    appliedCoupon,
    navigate,
  } = useApp();
  const { showToast } = useToast();

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (!couponCode.trim()) return;

    const res = applyCoupon(couponCode.trim());
    if (res.success) {
      showToast('success', 'Coupon Applied!', `Saved ₹${res.discount.toFixed(2)} with ${couponCode.toUpperCase()}`);
      setCouponCode('');
    } else {
      setCouponError(res.message);
      showToast('error', 'Coupon Error', res.message);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          type="cart"
          title="Your shopping cart is empty"
          description="Explore our curated catalog of production-tested PHP scripts, source code, web templates, and masterclasses."
          actionText="Browse Digital Catalog"
          actionPath="/products"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Shopping Cart</h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">
          Review your digital products and proceed to instant checkout.
        </p>
      </div>

      {/* Combined Single Card layout */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          
          {/* Left Column: Cart Items List - 7 cols */}
          <div className="lg:col-span-7 p-5 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-100">
              Shopping Bag Items ({cartSummary.itemCount})
            </h3>
            
            <div className="space-y-4">
              {cartItems.map((item) => (
                <CartItem key={item.product.id} item={item} />
              ))}
            </div>
          </div>

          {/* Right Column: Order Summary & Coupon Box - 5 cols */}
          <div className="lg:col-span-5 p-5 sm:p-8 bg-slate-50/50 space-y-6">
            <h3 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-100">
              Order Summary
            </h3>

            {/* Subtotal, Discount, Tax, Total */}
            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900 font-mono">
                  ₹{cartSummary.subtotal.toFixed(2)}
                </span>
              </div>

              {cartSummary.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold bg-emerald-50 p-2 rounded-xl">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" /> Coupon ({appliedCoupon?.code})
                  </span>
                  <span className="font-mono">-₹{cartSummary.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Digital Delivery & Handling</span>
                <span className="text-emerald-600 font-semibold">FREE (Instant)</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-base font-bold text-slate-900">Total Price</span>
                <span className="text-2xl font-extrabold text-emerald-600 font-mono">
                  ₹{cartSummary.total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Coupon Box */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Have a Promo Code?
              </label>

              {appliedCoupon ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs bg-white">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-600" />
                    <div>
                      <span className="font-mono font-bold text-blue-700">{appliedCoupon.code}</span>
                      <span className="text-slate-500 ml-1.5">
                        ({appliedCoupon.discountPercent}% OFF)
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-slate-400 hover:text-red-600 p-1"
                    aria-label="Remove coupon"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. SAVE20 or LAUNCH50"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError('');
                      }}
                      className="flex-1 px-3 py-2 text-xs uppercase font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors animate-all"
                    >
                      Apply
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {couponError}
                    </p>
                  )}
                </form>
              )}
            </div>

            {/* Checkout Action Button */}
            <div className="space-y-3">
              <button
                id="proceed-checkout-btn"
                onClick={() => navigate('/checkout')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-sm sm:text-base transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Proceed to Instant Checkout</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Secure Instant Digital Delivery</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
