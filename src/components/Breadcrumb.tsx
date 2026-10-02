import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  const { navigate } = useApp();

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs sm:text-sm text-slate-500 overflow-x-auto py-2 ${className}`}>
      <ol className="flex items-center gap-1.5 whitespace-nowrap">
        <li className="flex items-center">
          <button
            id="breadcrumb-home"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded px-1"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Store</span>
          </button>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {isLast || !item.path ? (
                <span className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-xs" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <button
                  id={`breadcrumb-${index}`}
                  onClick={() => navigate(item.path!, item.params, item.search)}
                  className="text-slate-500 hover:text-blue-600 transition-colors py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded px-1"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
