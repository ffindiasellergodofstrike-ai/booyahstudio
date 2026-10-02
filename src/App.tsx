import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { Header } from './components/Header';
import { MobileMenu } from './components/MobileMenu';
import { Footer } from './components/Footer';
import { QuickSearchModal } from './components/QuickSearchModal';
import { motion, AnimatePresence } from 'motion/react';
import { Flame } from 'lucide-react';

// Pages
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { CategoryPage } from './pages/CategoryPage';
import { SearchPage } from './pages/SearchPage';
import { CartPage } from './pages/CartPage';
import { WishlistPage } from './pages/WishlistPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { AccountPage } from './pages/AccountPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { FAQPage } from './pages/FAQPage';
import { LegalPoliciesPage } from './pages/LegalPoliciesPage';
import { PolicyDetailsPage } from './pages/policies/PolicyDetailsPage';
import { AdminPage } from './pages/AdminPage';

const AppContent: React.FC = () => {
  const { currentPath, pathParams, isNavigating } = useApp();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentPath, pathParams]);

  // Route Resolver
  const renderCurrentPage = () => {
    if (currentPath.startsWith('/product/')) {
      return <ProductDetailsPage />;
    }
    if (currentPath.startsWith('/category/')) {
      return <CategoryPage />;
    }
    if (currentPath.startsWith('/policies/')) {
      const slug = currentPath.substring('/policies/'.length);
      return <PolicyDetailsPage slug={slug} />;
    }

    switch (currentPath) {
      case '/':
        return <HomePage />;
      case '/products':
        return <ProductsPage />;
      case '/search':
        return <SearchPage />;
      case '/cart':
        return <CartPage />;
      case '/wishlist':
        return <WishlistPage />;
      case '/checkout':
        return <CheckoutPage />;
      case '/login':
        return <LoginPage />;
      case '/register':
        return <RegisterPage />;
      case '/forgot-password':
        return <ForgotPasswordPage />;
      case '/account':
      case '/account/orders':
      case '/account/downloads':
      case '/account/settings':
        return <AccountPage />;
      case '/about':
        return <AboutPage />;
      case '/contact':
        return <ContactPage />;
      case '/faq':
        return <FAQPage />;
      case '/terms':
        return <PolicyDetailsPage slug="terms" />;
      case '/privacy':
        return <PolicyDetailsPage slug="privacy" />;
      case '/refund':
        return <PolicyDetailsPage slug="refund" />;
      case '/policies':
        return <LegalPoliciesPage />;
      case '/admin':
        return <AdminPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <Header />

      {/* Main Page Body */}
      <main className="flex-1">
        {renderCurrentPage()}
      </main>

      {/* Footer */}
      <Footer />

      {/* Overlays & Modals */}
      <MobileMenu />
      <QuickSearchModal />

      {/* Clean Animated Loader on Click / Navigation Only */}
      <AnimatePresence>
        {isNavigating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 select-none pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="flex flex-col items-center justify-center gap-3"
            >
              {/* Spinner with Flame Icon Animation */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-700/40 border-t-blue-500 border-r-indigo-500 animate-spin" />
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 fill-amber-400 animate-pulse" />
                </div>
              </div>

              {/* Minimal Loading Text */}
              <p className="text-xs sm:text-sm font-bold text-white tracking-widest uppercase font-mono animate-pulse">
                Loading...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ToastProvider>
  );
}
