import { Brand } from './Brand';
import React, { useState } from 'react';
import {
  X,
  Flame,
  Search,
  ShoppingCart,
  Heart,
  User,
  ChevronRight,
  ChevronDown,
  Code2,
  FileCode,
  LayoutTemplate,
  Wrench,
  GraduationCap,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Briefcase,
  Mail,
  Info,
  LogOut,
  FolderDown,
  Package,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { CATEGORIES } from '../data/products';

export const MobileMenu: React.FC = () => {
  const {
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    navigate,
    cartCount,
    wishlistCount,
    currentUser,
    isAuthenticated,
    signOut,
    setIsQuickSearchOpen,
  } = useApp();

  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  if (!isMobileMenuOpen) return null;

  const handleNav = (path: string, params?: Record<string, string>) => {
    setIsMobileMenuOpen(false);
    navigate(path, params);
  };

  const getCatIcon = (iconName: string) => {
    switch (iconName) {
      case 'Code2':
        return Code2;
      case 'FileCode':
        return FileCode;
      case 'LayoutTemplate':
        return LayoutTemplate;
      case 'Wrench':
        return Wrench;
      case 'GraduationCap':
        return GraduationCap;
      default:
        return Sparkles;
    }
  };

  return (
    <AnimatePresence>
      <div id="mobile-menu-container" className="fixed inset-0 z-50 lg:hidden overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col z-10 max-h-[100dvh]"
        >
          {/* Header */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:flex sm:justify-between items-center p-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Brand />
            </div>
            <button
              id="close-mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px]"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Quick Search Button */}
            <div className="p-4 border-b border-slate-100">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsQuickSearchOpen(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors min-h-[44px]"
              >
                <Search className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">Search products...</span>
              </button>
            </div>

            {/* User Profile / Auth Quick Card */}
            <div className="p-4 border-b border-slate-100 bg-blue-50/40">
              {isAuthenticated && currentUser ? (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:flex sm:justify-between items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={currentUser.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser.email}`}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full border border-blue-200 object-cover bg-white shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</p>
                      <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                      {currentUser.role === 'admin' && (
                        <span className="inline-block mt-1 text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">ADMIN</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleNav('/account')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 min-h-[44px] min-w-[80px]"
                  >
                    Dashboard
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleNav('/account')}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs text-center shadow-xs min-h-[44px]"
                  >
                    Sign In / Register
                  </button>
                </div>
              )}
            </div>

            {/* Quick Action Badges */}
            <div className="grid grid-cols-3 gap-2 p-4 border-b border-slate-100 text-center">
              <button
                onClick={() => handleNav('/cart')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 transition-colors flex flex-col items-center gap-1 text-slate-700 min-h-[44px]"
              >
                <div className="relative shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold truncate w-full px-1">Cart</span>
              </button>

              <button
                onClick={() => handleNav('/wishlist')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 transition-colors flex flex-col items-center gap-1 text-slate-700 min-h-[44px]"
              >
                <div className="relative shrink-0">
                  <Heart className="w-5 h-5" />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {wishlistCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold truncate w-full px-1">Wishlist</span>
              </button>

              <button
                onClick={() => handleNav('/account')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex flex-col items-center gap-1 text-slate-700 min-h-[44px]"
              >
                <FolderDown className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-bold truncate w-full px-1">Downloads</span>
              </button>
            </div>

            {/* Navigation Links */}
            <div className="p-4 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1">
                Store Navigation
              </p>

              <button
                onClick={() => handleNav('/')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-100 text-slate-800 font-semibold text-sm transition-colors text-left min-h-[44px]"
              >
                <span className="truncate">Home Store</span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => handleNav('/products')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-100 text-slate-800 font-semibold text-sm transition-colors text-left min-h-[44px]"
              >
                <span className="truncate">All Products Catalog</span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <div className="pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1">
                  Company & Information
                </p>

                <button
                  onClick={() => handleNav('/about')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors text-left min-h-[44px]"
                >
                  <span className="truncate">About BOOYAH STUDIO</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                <button
                  onClick={() => handleNav('/contact')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors text-left min-h-[44px]"
                >
                  <span className="truncate">Contact & Support</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                <button
                  onClick={() => handleNav('/faq')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors text-left min-h-[44px]"
                >
                  <span className="truncate">Help & FAQs</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                <button
                  onClick={() => handleNav('/policies/terms')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors text-left min-h-[44px]"
                >
                  <span className="truncate">Store Policies</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => handleNav('/admin')}
                    className="w-full mt-2 flex items-center justify-between px-3 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm transition-colors text-left min-h-[44px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span className="truncate">System Administration</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sign Out / Bottom Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 shrink-0">
            {isAuthenticated && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  signOut();
                }}
                className="w-full mb-3 py-3 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out Account</span>
              </button>
            )}
            <p className="text-center text-[10px] font-medium text-slate-400 uppercase tracking-widest">
              © 2026 BOOYAH STUDIO
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
