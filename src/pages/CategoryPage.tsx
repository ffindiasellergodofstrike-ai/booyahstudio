import React, { useState } from 'react';
import {
  Code2,
  Wrench,
  Download,
  PlayCircle,
  FolderArchive,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProductService } from '../services/ProductService';
import { CATEGORIES } from '../data/products';
import { ProductGrid } from '../components/ProductGrid';
import { useProductCatalog } from '../hooks/useProductCatalog';

export const CategoryPage: React.FC = () => {
  useProductCatalog();
  const { pathParams } = useApp();
  const slug = pathParams.slug || 'scripts';

  const category = CATEGORIES.find((c) => c.slug === slug);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'price-low' | 'price-high'>('featured');

  if (!category) {
    const { products, total } = ProductService.searchProducts({
      query: slug !== 'scripts' ? slug : undefined,
      tag: selectedTag || undefined,
      sortBy: sortBy as any,
    });

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <ProductGrid
          products={products}
          totalCount={total}
          currentSort={sortBy as any}
          onSortChange={(s) => setSortBy(s as any)}
          onResetFilters={() => setSelectedTag('')}
          emptyTitle="No products found"
          emptyDescription="Try searching for another keyword or browse all available products."
        />
      </div>
    );
  }

  const { products, total } = ProductService.searchProducts({
    category: category.slug,
    tag: selectedTag || undefined,
    sortBy: sortBy as any,
  });

  const getCatIcon = (iconName: string) => {
    switch (iconName) {
      case 'Code2':
        return Code2;
      case 'Wrench':
        return Wrench;
      case 'Download':
        return Download;
      case 'PlayCircle':
        return PlayCircle;
      case 'FolderArchive':
        return FolderArchive;
      default:
        return Sparkles;
    }
  };

  const Icon = getCatIcon(category.iconName);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Category Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start gap-4 sm:gap-6 relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg">
            <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-blue-100" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-blue-200 text-xs font-semibold backdrop-blur-xs">
              <span>Authorized Category</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {category.name}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {category.description}
            </p>
          </div>
        </div>

        <div className="self-end md:self-center shrink-0 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-right">
          <span className="text-xs text-blue-200 block">Available Items</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-white">{total}</span>
        </div>
      </div>

      {/* Tags Filter Chips */}
      {category.featuredTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> Filter by Tag:
          </span>
          <button
            onClick={() => setSelectedTag('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              selectedTag === ''
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All {category.name}
          </button>
          {category.featuredTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedTag === tag
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <ProductGrid
        products={products}
        totalCount={total}
        currentSort={sortBy as any}
        onSortChange={(s) => setSortBy(s as any)}
        onResetFilters={() => setSelectedTag('')}
        emptyTitle={`No ${category.name} found for this filter`}
        emptyDescription="Try selecting another technology tag or browse all available products."
      />
    </div>
  );
};
