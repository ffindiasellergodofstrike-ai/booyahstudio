import React, { useState } from 'react';
import { LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { EmptyState } from './EmptyState';

interface ProductGridProps {
  products: Product[];
  title?: string;
  subtitle?: string;
  totalCount?: number;
  onSortChange?: (sort: 'popular' | 'newest' | 'price-low' | 'price-high' | 'rating') => void;
  currentSort?: string;
  allowLayoutToggle?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onResetFilters?: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  title,
  subtitle,
  totalCount,
  onSortChange,
  currentSort = 'popular',
  allowLayoutToggle = true,
  emptyTitle = 'No digital products found',
  emptyDescription = 'Try adjusting your search criteria, category filters, or price range.',
  onResetFilters,
}) => {
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  if (products.length === 0) {
    return (
      <EmptyState
        type="search"
        title={emptyTitle}
        description={emptyDescription}
        actionText="Reset All Filters"
        onAction={onResetFilters}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      {(title || totalCount !== undefined || onSortChange || allowLayoutToggle) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            {title && <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            <p className="text-xs text-slate-500 font-mono mt-1">
              Showing <span className="font-bold text-slate-900">{products.length}</span>
              {totalCount ? ` of ${totalCount}` : ''} products
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {/* Sort Selector */}
            {onSortChange && (
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <ArrowUpDown className="w-4 h-4 text-slate-400" />
                <select
                  id="product-sort-select"
                  value={currentSort}
                  onChange={(e) => onSortChange(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-xs"
                >
                  <option value="popular">Most Popular</option>
                  <option value="newest">Recently Released</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>
            )}

            {/* Layout Toggle */}
            {allowLayoutToggle && (
              <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  id="grid-layout-btn"
                  onClick={() => setLayout('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    layout === 'grid'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  id="list-layout-btn"
                  onClick={() => setLayout('list')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    layout === 'list'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid or List Container */}
      <div
        className={
          layout === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6'
            : 'space-y-4'
        }
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} variant={layout} />
        ))}
      </div>
    </div>
  );
};
