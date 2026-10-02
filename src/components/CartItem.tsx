import React from 'react';
import { Trash2, Plus, Minus } from 'lucide-react';
import { CartItem as CartItemType } from '../types';
import { ProductImage } from './ProductImage';
import { useApp } from '../context/AppContext';

interface CartItemProps {
  item: CartItemType;
}

export const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { removeFromCart, updateCartQuantity, navigate } = useApp();
  const { product, price, quantity } = item;
  const itemTotal = price * quantity;

  return (
    <div
      id={`cart-item-${product.id}`}
      className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all min-w-0 overflow-hidden"
    >
      {/* Thumbnail + Details */}
      <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto flex-1">
        <div
          onClick={() => navigate('/product/:slug', { slug: product.slug })}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 cursor-pointer bg-slate-50 border border-slate-100 flex items-center justify-center"
        >
          <ProductImage product={product} className="w-full h-full object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              {product.categoryLabel}
            </span>
          </div>

          <h4
            onClick={() => navigate('/product/:slug', { slug: product.slug })}
            className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 hover:text-blue-600 cursor-pointer break-words leading-snug"
          >
            {product.title}
          </h4>

          <p className="text-xs text-slate-500 mt-1">
            Unit Price: <span className="font-semibold text-slate-800">₹{price.toFixed(2)}</span>
            {product.version && ` • Version ${product.version}`}
          </p>
        </div>
      </div>

      {/* Quantity & Subtotal */}
      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
        {/* Quantity Controls */}
        <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
          <button
            id={`dec-qty-${product.id}`}
            onClick={() => updateCartQuantity(product.id, quantity - 1)}
            disabled={quantity <= 1}
            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-colors"
            aria-label="Decrease quantity"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="px-3 text-xs font-bold text-slate-800 min-w-[28px] text-center">
            {quantity}
          </span>
          <button
            id={`inc-qty-${product.id}`}
            onClick={() => updateCartQuantity(product.id, quantity + 1)}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-white transition-colors"
            aria-label="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Item Total */}
        <div className="text-right min-w-[80px]">
          <span className="text-base sm:text-lg font-bold text-emerald-600">
            ₹{itemTotal.toFixed(2)}
          </span>
        </div>

        {/* Remove Button */}
        <button
          id={`remove-cart-item-${product.id}`}
          onClick={() => removeFromCart(product.id)}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          aria-label={`Remove ${product.title} from cart`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
