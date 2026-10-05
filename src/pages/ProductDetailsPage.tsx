import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Zap,
  FileCode,
  Download,
  Layers,
  Check,
  ShoppingCart,
  CheckCircle2,
  FileText,
  HelpCircle,
  History,
  Sparkles,
  ArrowRight,
  Terminal,
  MonitorPlay,
  Share2,
  Wrench,
  Video,
  FolderArchive,
  BookOpen,
  Lock,
  ChevronDown,
  ExternalLink,
  Loader2,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { ProductService } from '../services/ProductService';
import { ProductImage } from '../components/ProductImage';
import { Price } from '../components/Price';
import { WishlistButton } from '../components/WishlistButton';
import { FAQAccordion, FAQItem } from '../components/FAQAccordion';
import { Modal } from '../components/Modal';
import { ShareModal } from '../components/ShareModal';
import { ProductCard } from '../components/ProductCard';
import { AlertCircle } from 'lucide-react';
import { ProductType } from '../types';
import { useProductCatalog } from '../hooks/useProductCatalog';

const getTypeIcon = (type: ProductType) => {
  switch (type) {
    case 'SCRIPT':
      return <FileCode className="w-3.5 h-3.5 text-blue-600" />;
    case 'TOOL':
      return <Wrench className="w-3.5 h-3.5 text-emerald-600" />;
    case 'DOWNLOAD':
      return <Download className="w-3.5 h-3.5 text-indigo-600" />;
    case 'VIDEO':
      return <Video className="w-3.5 h-3.5 text-amber-600" />;
    case 'RESOURCE':
      return <FolderArchive className="w-3.5 h-3.5 text-sky-600" />;
    default:
      return <Layers className="w-3.5 h-3.5 text-slate-600" />;
  }
};

interface DetailSectionProps {
  id: string;
  title: string;
  icon: any;
  color: string;
  content: React.ReactNode;
  defaultOpen?: boolean;
}

const ProductDetailSection: React.FC<DetailSectionProps> = ({
  title,
  icon: Icon,
  color,
  content,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div 
      className={`border rounded-xl transition-all overflow-hidden ${
        isOpen ? 'border-blue-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50/30 hover:border-slate-300'
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 sm:p-3.5 text-left focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 leading-tight">{title}</h3>
        </div>
        <div className={`p-1 rounded-full transition-transform duration-200 ${isOpen ? 'rotate-180 bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="px-4 pb-5 pt-1 sm:px-5 sm:pb-6 border-t border-slate-100">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ProductDetailsPage: React.FC = () => {
  useProductCatalog();
  const { pathParams, navigate, addToCart } = useApp();
  const { showToast } = useToast();

  const rawSlug = pathParams.slug || (window.location.pathname.startsWith('/product/') ? window.location.pathname.replace('/product/', '').split('?')[0] : '');
  const slug = decodeURIComponent(rawSlug);
  const product = ProductService.getProductBySlug(slug) || ProductService.getProductBySlug(rawSlug);

  const quantity = 1;
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [previewLoadStatus, setPreviewLoadStatus] = useState<'loading' | 'ready' | 'slow'>('loading');
  const [previewReloadKey, setPreviewReloadKey] = useState(0);

  useEffect(() => {
    if (!isDemoModalOpen || !product?.previewUrl) return;

    setPreviewLoadStatus('loading');
    const slowLoadTimer = window.setTimeout(() => {
      setPreviewLoadStatus((current) => current === 'loading' ? 'slow' : current);
    }, 8000);

    return () => window.clearTimeout(slowLoadTimer);
  }, [isDemoModalOpen, previewReloadKey, product?.previewUrl]);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="inline-flex p-4 rounded-3xl bg-rose-50 text-rose-600 mb-2 border border-rose-100">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">404 — Product Not Found</h1>
        <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
          The digital template or software package you are searching for is not in our active catalog.
        </p>
        <div className="pt-2 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => navigate('/products')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-xs sm:text-sm transition-all shadow-md"
          >
            Explore Product Catalog
          </button>
          <button
            onClick={() => navigate('/search')}
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs sm:text-sm transition-all"
          >
            Search Store
          </button>
        </div>
      </div>
    );
  }

  const currentPrice = product.price;
  const relatedProducts = ProductService.getRelatedProducts(product.id, 4);

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    navigate('/checkout');
  };

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  const handlePreviewLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    if (!product.previewUrl) return;

    const previewUrl = new URL(product.previewUrl, window.location.href);
    if (previewUrl.origin === window.location.origin) {
      const previewDocument = event.currentTarget.contentDocument;
      if (!previewDocument?.documentElement || !previewDocument.body?.childElementCount) {
        setPreviewLoadStatus('slow');
        return;
      }
    }

    setPreviewLoadStatus('ready');
  };

  const faqsList: FAQItem[] = product.faqs || [
    {
      question: 'How is this digital product delivered after payment?',
      answer: 'After captured-payment verification, your account provides protected download links. Confirmation emails link to your account. Contact support if purchased access is missing.',
    },
    {
      question: 'Are future version updates and security fixes included?',
      answer: 'Review this product’s listing and supplied documentation for its update and support terms. Future updates are included only when expressly stated.',
    },
    {
      question: 'Can I customize the purchased files for my own project?',
      answer: 'Yes. You can customize the purchased files for your own project. The original package may not be redistributed or resold as a competing product.',
    },
    {
      question: 'What if I encounter technical issues with my files?',
      answer: 'Our technical team is available to assist you. If a technical non-delivery issue occurs that cannot be resolved, you are covered by our Digital Product Refund Policy.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Main 2-Column Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Visual Gallery & Key Specs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Visual Frame */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="aspect-16/10 rounded-2xl overflow-hidden bg-slate-900 relative shadow-inner">
              <ProductImage
                product={product}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Action Bar Below Image */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                id="launch-interactive-demo-btn"
                onClick={() => {
                  setPreviewLoadStatus('loading');
                  setIsDemoModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-all shadow-xs"
              >
                <MonitorPlay className="w-4 h-4" />
                <span>{product.previewUrl ? 'Open Live Demo Preview' : 'Product Overview & Specs'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  id="share-product-btn"
                  onClick={handleShare}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  aria-label="Share product"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <WishlistButton product={product} size="md" showLabel />
              </div>
            </div>
          </div>

          {/* Technical Specifications Vertical List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">File Type</span>
              <p className="text-sm font-extrabold text-slate-900">Zip</p>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">File Size</span>
              <p className="text-sm font-extrabold text-slate-900">{product.fileSize || 'Direct Access'}</p>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Delivery</span>
              <p className="text-sm font-extrabold text-emerald-700">Delivery on email</p>
            </div>
          </div>
        </div>

        {/* Right Column (Purchase Box) - 5 cols */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6 sticky top-24">
            {/* Header / Titles */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  Digital source package
                </span>
              </div>

              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {product.title}
              </h1>

              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {product.shortDescription}
              </p>
            </div>

            {/* Price Display */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-600 block">Total Due:</span>
                <Price
                  price={currentPrice}
                  originalPrice={product.originalPrice}
                  size="xl"
                />
              </div>
            </div>

            {/* Purchase CTA Buttons */}
            <div className="space-y-2.5">
              <button
                id="buy-now-btn"
                onClick={handleBuyNow}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-98"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Continue to checkout</span>
              </button>

              <button
                id="add-to-cart-detail-btn"
                onClick={handleAddToCart}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 active:scale-98"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Add to Shopping Cart</span>
              </button>
            </div>

            {/* Value Guarantees list */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Account access after payment verification</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Protected download links; updates only where offered</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Clear setup and technical documentation</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details - Collapsible Dropdown Sections */}
      <div className="space-y-4 py-8">
        {[
          {
            id: 'overview',
            title: 'Product Overview',
            icon: FileText,
            color: 'bg-blue-50 text-blue-600',
            defaultOpen: true,
            content: (
              <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
                <p className="text-base text-slate-600 whitespace-pre-line">{product.description}</p>
              </div>
            )
          },
          {
            id: 'requirements',
            title: 'System Requirements',
            icon: Terminal,
            color: 'bg-slate-50 text-slate-600',
            content: (
              <ul className="space-y-2.5 text-sm">
                {(product.requirements || ['Standard web browser']).map((req, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            )
          },
          {
            id: 'assets',
            title: 'Assets Included',
            icon: FileCode,
            color: 'bg-purple-50 text-purple-600',
            content: (
              <div className="flex flex-wrap gap-2">
                {product.whatsIncluded.map((file, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-700">
                    {file}
                  </span>
                ))}
              </div>
            )
          },
          {
            id: 'features',
            title: 'Core Features',
            icon: Sparkles,
            color: 'bg-emerald-50 text-emerald-600',
            content: (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {product.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{feat}</span>
                  </div>
                ))}
              </div>
            )
          },
          {
            id: 'faqs',
            title: 'Frequently Asked Questions (FAQs)',
            icon: HelpCircle,
            color: 'bg-amber-50 text-amber-600',
            content: <FAQAccordion items={faqsList} allowMultiple />
          }
        ].map((section) => (
          <ProductDetailSection
            key={section.id}
            id={section.id}
            title={section.title}
            icon={section.icon}
            color={section.color}
            content={section.content}
            defaultOpen={section.defaultOpen}
          />
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 p-5 my-5"><h2 className="font-bold mb-2">License & usage</h2><p className="text-sm leading-6">{product.licenseTerms || 'Use and customise this product for your project as described in the listing and included documentation. Do not redistribute the original package. Contact support before purchase if you need additional rights.'}</p><a href="/policies/license" className="text-sm underline">Read the Digital Product License & Usage Policy</a></section>
            {/* Related Products Carousel */}
      {relatedProducts.length > 0 && (
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-slate-900">Related Digital Products</h2>
            <button
              onClick={() => navigate('/category/:slug', { slug: product.category })}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>View All {product.categoryLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* Sandboxed live preview / product overview modal */}
      {isDemoModalOpen && (
        <Modal
          isOpen={isDemoModalOpen}
          onClose={() => setIsDemoModalOpen(false)}
          title={product.previewUrl ? `Live Demo: ${product.title}` : `Overview: ${product.title}`}
          maxWidth={product.previewUrl ? '6xl' : 'lg'}
          mobileFullscreen={Boolean(product.previewUrl)}
        >
          {product.previewUrl ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4 sm:py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Interactive product demo</p>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500">Preview environment • actions here do not affect your purchase</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 sm:px-3 text-[10px] sm:text-[11px] font-semibold text-slate-600 shadow-xs ring-1 ring-slate-200">
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="sm:hidden">Mobile</span>
                  <span className="hidden sm:inline">Responsive preview</span>
                </div>
              </div>

              <div className="relative h-[clamp(20rem,58dvh,35rem)] sm:h-[70dvh] sm:min-h-[460px] overflow-hidden rounded-xl sm:rounded-2xl border border-slate-300 bg-slate-950 shadow-inner">
                {previewLoadStatus === 'loading' && (
                  <div
                    className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950 text-white"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex flex-col items-center gap-3 px-6 text-center">
                      <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
                      <div>
                        <p className="text-sm font-bold">Loading interactive preview…</p>
                        <p className="mt-1 text-xs text-slate-400">Large demos may take a moment on mobile networks.</p>
                      </div>
                    </div>
                  </div>
                )}

                {previewLoadStatus === 'slow' && (
                  <div
                    className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/95 px-5 text-white"
                    role="alert"
                  >
                    <div className="max-w-sm text-center">
                      <p className="text-sm font-bold">The preview is taking longer than expected.</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                        Check your connection, retry inside the preview, or open the demo directly.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewLoadStatus('loading');
                            setPreviewReloadKey((current) => current + 1);
                          }}
                          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Retry preview
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(product.previewUrl, '_blank', 'noopener,noreferrer')}
                          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open directly
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <iframe
                  key={`${product.previewUrl}-${previewReloadKey}`}
                  src={product.previewUrl}
                  title={`${product.title} live demo preview`}
                  className="h-full w-full bg-white"
                  sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-downloads"
                  referrerPolicy="no-referrer"
                  loading="eager"
                  onLoad={handlePreviewLoad}
                  onError={() => setPreviewLoadStatus('slow')}
                />

                <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
                  <div className="absolute left-1/2 top-1/2 w-[88%] -translate-x-1/2 -translate-y-1/2 -rotate-20 text-center text-2xl font-black uppercase leading-tight tracking-[0.12em] text-slate-900/8 sm:w-auto sm:whitespace-nowrap sm:text-6xl sm:tracking-[0.25em]">
                    {product.title} • Preview
                  </div>
                  <div className="absolute bottom-2 right-2 rounded-md border border-white/30 bg-slate-950/70 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur-sm sm:bottom-3 sm:right-3 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-widest">
                    Demo Preview • Not for redistribution
                  </div>
                </div>
              </div>

              <p className="px-1 text-center text-[10px] sm:text-[11px] leading-relaxed text-slate-500">
                This demo runs inside a restricted preview frame. Some sign-in, payment, download, or new-window actions may be disabled.
              </p>
            </div>
          ) : (
            <div className="space-y-6 py-2">
              <div className="aspect-16/10 rounded-2xl overflow-hidden bg-slate-900">
                <ProductImage product={product} className="w-full h-full object-cover" />
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-base">Digital Delivery & Verification</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  This digital product is delivered electronically upon verified payment. Access includes the files and documentation stated in the listing; future updates are included only if expressly offered.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setIsDemoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setIsDemoModalOpen(false);
                    handleAddToCart();
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  Add to Cart (₹{product.price.toFixed(2)})
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Share Modal */}
      {product && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title={product.title}
          description={product.shortDescription}
          path={`/product/${product.slug}`}
        />
      )}
    </div>
  );
};
