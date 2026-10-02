import React, { useState, useEffect } from 'react';
import { Search, Filter, X, ArrowUpDown, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProductService, ProductFilters } from '../services/ProductService';
import { CATEGORIES } from '../data/products';
import { ProductGrid } from '../components/ProductGrid';
import { useProductCatalog } from '../hooks/useProductCatalog';

export const SearchPage: React.FC = () => {
  useProductCatalog();
  const { searchParams, navigate } = useApp();
  const initialQuery = searchParams.q || '';

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(searchParams.category || 'all');
  const [maxPrice, setMaxPrice] = useState<number>(300);
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'price-low' | 'price-high' | 'rating'>('popular');

  // Update query state if URL params change
  useEffect(() => {
    if (searchParams.q !== undefined) {
      setQuery(searchParams.q);
    }
  }, [searchParams.q]);

  const filterParams: ProductFilters = {
    query: query.trim() || undefined,
    category: category !== 'all' ? category : undefined,
    maxPrice: maxPrice < 300 ? maxPrice : undefined,
    minRating: minRating > 0 ? minRating : undefined,
    sortBy,
  };

  const { products, total } = ProductService.searchProducts(filterParams);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/search', undefined, { q: query });
  };

  const handleClearFilters = () => {
    setQuery('');
    setCategory('all');
    setMaxPrice(300);
    setMinRating(0);
    setSortBy('popular');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Search Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Search Digital Products
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Find scripts, full-stack repos, templates, tools, and courses instantly across our entire catalog.
        </p>

        {/* Large Search Box */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="w-5 h-5 text-blue-600 absolute left-4 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type keywords like 'Laravel', 'React SaaS', 'Stripe API', 'Tailwind'..."
            className="w-full pl-12 pr-24 py-3.5 sm:py-4 text-base bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white text-slate-900 font-medium"
          />
          <button
            type="submit"
            className="absolute right-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
          >
            Search
          </button>
        </form>

        {/* Popular Search Suggestions */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 pt-1">
          <span className="font-semibold text-slate-700">Quick Searches:</span>
          {['Laravel', 'SaaS', 'Admin', 'Next.js', 'PHP Script', 'Flutter', 'Python', 'Affiliate'].map(
            (term) => (
              <button
                key={term}
                onClick={() => {
                  setQuery(term);
                  navigate('/search', undefined, { q: term });
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors font-medium"
              >
                {term}
              </button>
            )
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Dropdown */}
          <select
            id="search-category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Rating Dropdown */}
          <select
            id="search-rating-select"
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value={0}>Any Rating</option>
            <option value={4.5}>4.5+ Stars</option>
            <option value={4.8}>4.8+ Stars</option>
          </select>

          {/* Price Max Slider */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            <span>Max Price:</span>
            <input
              type="range"
              min="20"
              max="300"
              step="10"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-20 accent-blue-600"
            />
            <span className="font-mono font-bold text-slate-900">${maxPrice}</span>
          </div>
        </div>

        {/* Active Filters Clear */}
        {(query || category !== 'all' || maxPrice < 300 || minRating > 0) && (
          <button
            onClick={handleClearFilters}
            className="text-xs font-bold text-blue-600 hover:text-blue-800"
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Search Results Grid */}
      <ProductGrid
        products={products}
        totalCount={total}
        title={query ? `Results for "${query}"` : 'All Available Results'}
        subtitle={total > 0 ? `Found ${total} matching items.` : undefined}
        currentSort={sortBy}
        onSortChange={(s) => setSortBy(s)}
        onResetFilters={handleClearFilters}
        emptyTitle={query ? `No items found matching "${query}"` : 'No products found'}
        emptyDescription="Try broadening your search terms or exploring our popular categories."
      />
    </div>
  );
};
