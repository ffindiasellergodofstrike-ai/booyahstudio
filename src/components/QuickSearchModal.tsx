import React, { useState, useEffect } from 'react';
import { Search, X, Code2, FileCode, LayoutTemplate, Wrench, GraduationCap, ArrowRight, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { useApp } from '../context/AppContext';
import { ProductService } from '../services/ProductService';
import { Product } from '../types';
import { useProductCatalog } from '../hooks/useProductCatalog';

export const QuickSearchModal: React.FC = () => {
  const catalog = useProductCatalog();
  const { isQuickSearchOpen, setIsQuickSearchOpen, navigate } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    if (query.trim().length > 0) {
      const res = ProductService.searchProducts({ query: query.trim() });
      setResults(res.products.slice(0, 6));
    } else {
      setResults(ProductService.getFeaturedProducts().slice(0, 4));
    }
  }, [query, catalog]);

  const handleSelect = (slug: string) => {
    setIsQuickSearchOpen(false);
    setQuery('');
    navigate('/product/:slug', { slug });
  };

  const handleSearchAll = () => {
    setIsQuickSearchOpen(false);
    const q = query.trim();
    setQuery('');
    navigate('/search', undefined, q ? { q } : undefined);
  };

  const getCatIcon = (cat: string) => {
    switch (cat) {
      case 'php-scripts':
        return Code2;
      case 'source-code':
        return FileCode;
      case 'templates':
        return LayoutTemplate;
      case 'tools':
        return Wrench;
      case 'courses':
        return GraduationCap;
      default:
        return Sparkles;
    }
  };

  return (
    <Modal
      isOpen={isQuickSearchOpen}
      onClose={() => setIsQuickSearchOpen(false)}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Search Header */}
        <div className="relative flex items-center group">
          <Search className="w-5 h-5 text-blue-600 absolute left-3.5 pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchAll();
            }}
            autoFocus
            className="w-full pl-11 pr-11 py-3.5 text-base sm:text-lg bg-slate-100/80 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white text-slate-900 placeholder-slate-400 font-medium transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 p-2 text-slate-400 hover:text-slate-600 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Category Chips */}
        {ProductService.getCategories().length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap shrink-0">Filters:</span>
            {ProductService.getCategories().map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setIsQuickSearchOpen(false);
                  navigate('/category/:slug', { slug: c.slug });
                }}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 transition-all whitespace-nowrap font-bold text-[10px] sm:text-xs shrink-0 border border-transparent hover:shadow-md hover:shadow-blue-500/20 min-h-[32px] flex items-center"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Search Results List */}
        <div className="space-y-1 max-h-80 overflow-y-auto pt-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {query.trim() ? `Search Results (${results.length})` : 'Featured Products'}
          </p>

          {results.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No products match "{query}". Try another keyword or browse categories.
            </div>
          ) : (
            results.map((item) => {
              const Icon = getCatIcon(item.category);
              return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.slug)}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:flex sm:justify-between items-center p-3 hover:bg-blue-50/80 rounded-xl cursor-pointer transition-all group border border-transparent hover:border-blue-100 min-h-[64px]"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-blue-400 flex items-center justify-center shrink-0 shadow-lg shadow-slate-900/10 group-hover:scale-105 transition-transform">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600">
                          {item.title}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-slate-500 truncate max-w-full">
                          {item.shortDescription}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pl-3 shrink-0">
                      <span className="text-sm font-extrabold text-emerald-600">${item.price.toFixed(2)}</span>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono">ESC</kbd> to exit</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono">ENTER</kbd> to search</span>
          </div>
          <button
            onClick={handleSearchAll}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            View Full Search Page →
          </button>
        </div>
      </div>
    </Modal>
  );
};
