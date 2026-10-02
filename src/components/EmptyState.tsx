import React from 'react';
import { LucideIcon, Search, ShoppingCart, Heart, FileQuestion, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface EmptyStateProps {
  type?: 'search' | 'cart' | 'wishlist' | 'orders' | 'generic';
  title: string;
  description: string;
  actionText?: string;
  actionPath?: string;
  onAction?: () => void;
  customIcon?: LucideIcon;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  actionText = 'Browse All Products',
  actionPath = '/products',
  onAction,
  customIcon,
}) => {
  const { navigate } = useApp();

  const getIcon = () => {
    if (customIcon) return customIcon;
    switch (type) {
      case 'search':
        return Search;
      case 'cart':
        return ShoppingCart;
      case 'wishlist':
        return Heart;
      case 'orders':
        return FileQuestion;
      default:
        return FileQuestion;
    }
  };

  const Icon = getIcon();

  return (
    <div className="flex flex-col items-center justify-center text-center p-6 sm:p-12 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg mx-auto my-4 sm:my-8">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-6 shadow-inner shrink-0">
        <Icon className="w-8 h-8 sm:w-10 sm:h-10" />
      </div>
      <div className="min-w-0 px-2">
        <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 mb-2 truncate">{title}</h3>
        <p className="text-xs sm:text-base text-slate-500 max-w-sm mb-8 leading-relaxed mx-auto">{description}</p>
      </div>
      <button
        id="empty-state-action-btn"
        onClick={() => {
          if (onAction) onAction();
          else if (actionPath) navigate(actionPath);
        }}
        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl sm:rounded-2xl text-sm sm:text-base transition-all shadow-lg shadow-blue-500/20 active:scale-95 w-full sm:w-auto min-h-[44px]"
      >
        <span>{actionText}</span>
        <ArrowRight className="w-4 h-4 sm:w-5 h-5" />
      </button>
    </div>
  );
};
