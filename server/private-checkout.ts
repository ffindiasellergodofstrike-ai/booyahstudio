import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readCheckoutParameters } from '../src/lib/booyah-checkout-access';

export function applyPrivateCheckoutHeaders(res: Response, nonce: string) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self' https://sdk.cashfree.com https://*.cashfree.com https://checkout.razorpay.com https://api.razorpay.com; script-src 'self' 'nonce-${nonce}' https://sdk.cashfree.com https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.cashfree.com https://api.razorpay.com https://*.supabase.co; frame-src 'self' https://*.cashfree.com https://api.razorpay.com https://checkout.razorpay.com;`
  );
}

export function handlePrivateCheckoutRequest(req: Request, res: Response, next: NextFunction) {
  delete req.headers['referer'];
  delete req.headers['referrer'];

  if (req.method !== 'GET') {
    return res.status(404).send('Not found');
  }

  // Check query parameters
  const queryObj = req.query || {};
  const asset = typeof queryObj.asset === 'string' ? queryObj.asset : null;

  // Validate 5 parameters via readCheckoutParameters
  const checkoutParams = readCheckoutParameters(req.query as any);
  if (!checkoutParams) {
    applyPrivateCheckoutHeaders(res, 'invalid-nonce');
    return res.status(404).send('Not found');
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  applyPrivateCheckoutHeaders(res, nonce);

  if (asset === 'checkout.js') {
    const jsPath = path.resolve(process.cwd(), 'build', 'private-checkout', 'checkout.js');
    if (!fs.existsSync(jsPath)) {
      return res.status(404).send('Not found');
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(200).sendFile(jsPath);
  }

  // Serve HTML shell
  const rawRoutePath = req.baseUrl || req.path || '/booyahpay';
  const scriptRoutePath = /^\/api\/private-checkout/i.test(rawRoutePath) ? '/booyahpay' : rawRoutePath;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <meta name="referrer" content="no-referrer" />
  <title>Secure Checkout</title>
  <script nonce="${nonce}">
    try {
      Object.defineProperty(document, 'referrer', { get: function() { return ''; }, configurable: true });
      Object.defineProperty(Document.prototype.referrer ? Document.prototype : document, 'referrer', { get: function() { return ''; }, configurable: true });
    } catch (e) {}
    window.__CHECKOUT__ = ${JSON.stringify(checkoutParams)};
  </script>
</head>
<body style="margin:0;padding:0;background:#f5f6fa;">
  <div id="private-checkout-root"></div>
  <script nonce="${nonce}" referrerpolicy="no-referrer" src="${scriptRoutePath}?${new URLSearchParams(req.query as any).toString()}&asset=checkout.js" defer></script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
