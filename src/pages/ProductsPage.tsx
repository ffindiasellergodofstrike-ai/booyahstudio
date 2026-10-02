import React, { useState, useMemo } from 'react';
import { Filter, X, ArrowUpDown, Tag, Star, SlidersHorizontal, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProductService, ProductFilters } from '../services/ProductService';
import { CATEGORIES } from '../data/products';
import { ProductGrid } from '../components/ProductGrid';
import { useProductCatalog } from '../hooks/useProductCatalog';

export const ProductsPage: React.FC = () => {
  const catalog = useProductCatalog();
  const { searchParams, navigate } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.category || 'all'
  );
  const [selectedTag, setSelectedTag] = useState<string>(searchParams.tag || '');
  const [minRating, setMinRating] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(300);
  const [sortBy, setSortBy] = useState<
    'popular' | 'newest' | 'price-low' | 'price-high' | 'rating'
  >('popular');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    ProductService.getAllProducts().forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [catalog]);

  // Filter products
  const filterCriteria: ProductFilters = {
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    tag: selectedTag || undefined,
    minRating: minRating > 0 ? minRating : undefined,
    maxPrice: maxPrice < 300 ? maxPrice : undefined,
    sortBy,
  };

  const { products, total } = ProductService.searchProducts(filterCriteria);

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedTag('');
    setMinRating(0);
    setMaxPrice(300);
    setSortBy('popular');
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedTag !== '' ||
    minRating > 0 ||
    maxPrice < 300 ||
    sortBy !== 'popular';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Digital Products Catalog
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-1 max-w-2xl">
            Browse premium PHP scripts, full-stack source code, responsive templates, CLI tools, and masterclass courses.
          </p>
        </div>

        {/* Mobile Filter Toggle */}
        <button
          id="mobile-filter-btn"
          onClick={() => setIsMobileFilterOpen(true)}
          className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs self-start"
        >
          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
          <span>Filters & Categories</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-blue-600" />
          )}
        </button>
      </div>

      {/* Main Layout: 2 Columns (Sidebar + Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Desktop Sidebar Filters */}
        <div className="hidden lg:block lg:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-6 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>Filters</span>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Category Filter */}
            {CATEGORIES.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Categories
                </label>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left ${
                      selectedCategory === 'all'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>All Products</span>
                    <span className="text-[11px] text-slate-400">
                      {ProductService.getAllProducts().length}
                    </span>
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.slug)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left ${
                        selectedCategory === cat.slug
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-[11px] text-slate-400">{cat.productCount}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                <span>Max Price</span>
                <span className="text-blue-600 font-mono font-bold">₹{maxPrice}</span>
              </div>
              <input
                type="range"
                min="20"
                max="300"
                step="5"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>₹20</span>
                <span>₹150</span>
                <span>₹300+</span>
              </div>
            </div>

            {/* Rating Filter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Minimum Rating
              </label>
              <div className="space-y-1">
                {[
                  { rating: 0, label: 'Any Rating' },
                  { rating: 4.5, label: '4.5 Stars & Up' },
                  { rating: 4.8, label: '4.8 Stars & Up' },
                  { rating: 5.0, label: '5.0 Stars Perfect' },
                ].map((r) => (
                  <button
                    key={r.rating}
                    onClick={() => setMinRating(r.rating)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                      minRating === r.rating
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {r.rating > 0 && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                      <span>{r.label}</span>
                    </div>
                    {minRating === r.rating && <Check className="w-3.5 h-3.5 text-amber-600" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Tech Tags Filter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Popular Technologies
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.slice(0, 12).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono transition-colors ${
                      selectedTag === tag
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Product Grid Area */}
        <div className="lg:col-span-3">
          <ProductGrid
            products={products}
            totalCount={total}
            currentSort={sortBy}
            onSortChange={(sort) => setSortBy(sort)}
            onResetFilters={handleResetFilters}
          />
        </div>
      </div>

      {/* Mobile Filters Slide-over / Modal */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          <div
            onClick={() => setIsMobileFilterOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-xs bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between z-10">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Catalog Filters</h3>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Categories */}
              {CATEGORIES.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Category</label>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold ${
                        selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      All Categories
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.slug)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold ${
                          selectedCategory === cat.slug ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Max Price */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                  Max Price: ₹{maxPrice}
                </label>
                <input
                  type="range"
                  min="20"
                  max="300"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 space-y-2">
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-sm"
              >
                Apply Filters ({products.length} Results)
              </button>
              <button
                onClick={() => {
                  handleResetFilters();
                  setIsMobileFilterOpen(false);
                }}
                className="w-full py-2.5 text-slate-600 text-xs font-semibold hover:bg-slate-50 rounded-xl"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
