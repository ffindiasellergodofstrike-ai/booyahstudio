import React from 'react';
import { Heart, Trash2, ShoppingCart, Share2, Sparkles, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/EmptyState';
import { ProductCard } from '../components/ProductCard';

export const WishlistPage: React.FC = () => {
  const { wishlistItems, clearWishlist, addToCart, navigate } = useApp();
  const { showToast } = useToast();

  const handleShareWishlist = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('success', 'Wishlist Link Copied', 'Share your wishlist with your development team.');
    }
  };

  const handleAddAllToCart = () => {
    wishlistItems.forEach((item) => {
      addToCart(item.product, 1);
    });
    showToast('success', 'All Items Added', 'All wishlist products moved to your shopping cart.');
  };

  if (wishlistItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          type="wishlist"
          title="Your wishlist is empty"
          description="Save high-utility scripts, masterclasses, and codebases to review later or purchase when your sprint starts."
          actionText="Explore Featured Products"
          actionPath="/products"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Saved Wishlist</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold">
              {wishlistItems.length} {wishlistItems.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Keep track of the codebases, tools, and courses you plan to purchase for upcoming projects.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          <button
            id="share-wishlist-btn"
            onClick={handleShareWishlist}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Share List</span>
          </button>

          <button
            id="add-all-cart-btn"
            onClick={handleAddAllToCart}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Add All to Cart</span>
          </button>

          <button
            id="clear-wishlist-btn"
            onClick={clearWishlist}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            aria-label="Clear wishlist"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Wishlist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
        {wishlistItems.map((item) => (
          <ProductCard key={item.productId} product={item.product} />
        ))}
      </div>
    </div>
  );
};
