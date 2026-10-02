import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEmailDownloadUrl,
  buildInvoiceDownloadUrl,
  buildInvoicePdf,
  buildPurchaseEmailHtml,
  createEmailDownloadToken,
  hashEmailDownloadToken,
  sendPurchaseConfirmationEmail,
} from './purchaseEmail';

const order = {
  id: 'ORDER-123',
  orderNumber: 'ORDER-123',
  createdAt: '2026-09-22T10:00:00.000Z',
  customer: { fullName: 'Test <Buyer>', email: 'buyer@example.com' },
  items: [{ productId: 'demo-product', productTitle: 'Demo & Product', price: 499, quantity: 1 }],
  subtotal: 499,
  discount: 0,
  tax: 0,
  total: 499,
  paymentStatus: 'PAID', paymentEnvironment: 'live',
  transactionId: 'TXN-123',
};

test('email download tokens are random and stored by one-way hash', () => {
  const first = createEmailDownloadToken();
  const second = createEmailDownloadToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hashEmailDownloadToken(first), /^[a-f0-9]{64}$/);
  assert.equal(hashEmailDownloadToken(first), hashEmailDownloadToken(first));
  assert.notEqual(hashEmailDownloadToken(first), first);
});

test('email item and invoice URLs stay on the application domain', () => {
  const priorUrl = process.env.APP_URL;
  delete process.env.APP_URL;
  try {
    const url = buildEmailDownloadUrl('safe_token');
    const invoiceUrl = buildInvoiceDownloadUrl('invoice_token');
    assert.equal(url, 'https://www.booyahstudio.shop/api/downloads/email?token=safe_token');
    assert.equal(invoiceUrl, 'https://www.booyahstudio.shop/api/invoices/email?token=invoice_token');
    assert.doesNotMatch(url, /mega\.nz/i);
    assert.doesNotMatch(invoiceUrl, /mega\.nz/i);
  } finally {
    if (priorUrl !== undefined) process.env.APP_URL = priorUrl;
  }
});

test('email links use the configured storefront URL', () => {
  const priorUrl = process.env.APP_URL;
  process.env.APP_URL = 'https://shop.example.com/some-path';
  try {
    assert.equal(buildEmailDownloadUrl('safe_token'), 'https://shop.example.com/api/downloads/email?token=safe_token');
    assert.equal(buildInvoiceDownloadUrl('safe_token'), 'https://shop.example.com/api/invoices/email?token=safe_token');
  } finally {
    if (priorUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = priorUrl;
  }
});

test('professional purchase email escapes data and includes item, invoice, and terms sections', () => {
  const html = buildPurchaseEmailHtml(order, [{
    productId: 'demo-product',
    productTitle: 'Demo & Product',
    downloadUrl: 'https://shop.example.com/api/downloads/email?token=safe_token',
    expiresAt: Date.now() + 60_000,
  }], {
    invoiceUrl: 'https://shop.example.com/api/invoices/email?token=invoice_token',
  });
  assert.match(html, /Test &lt;Buyer&gt;/);
  assert.match(html, /Demo &amp; Product/);
  assert.match(html, /Download your order items/);
  assert.match(html, /Download Invoice/);
  assert.match(html, /Invoice INV-ORDER-123/);
  assert.match(html, /Important terms/);
  assert.match(html, /shop\.example\.com\/api\/downloads\/email/);
  assert.match(html, /shop\.example\.com\/api\/invoices\/email/);
  assert.doesNotMatch(html, /mega\.nz/i);
});

test('invoice generator returns a valid PDF document', async () => {
  const pdf = await buildInvoicePdf(order);
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(pdf.length > 1_000);
});

test('purchase email sends a numbered invoice through Resend with an idempotency key', async (context) => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.RESEND_FROM_EMAIL;
  process.env.RESEND_API_KEY = 're_synthetic';
  process.env.RESEND_FROM_EMAIL = 'BOOYAH STUDIO <orders@example.test>';
  context.after(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = previousFrom;
  });
  const requests: { url: string; body: any; idempotencyKey: string | null }[] = [];
  context.mock.method(globalThis, 'fetch', async (input: any, init: any) => {
    requests.push({ url: String(input), body: JSON.parse(init.body),
      idempotencyKey: new Headers(init.headers).get('idempotency-key') });
    return Response.json({ id: 'synthetic-email-id' });
  });
  const result = await sendPurchaseConfirmationEmail({ ...order, invoiceNumber: 'INV-ORDER-123' }, [], {});
  assert.deepEqual(result, { status: 'sent', emailId: 'synthetic-email-id' });
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /api\.resend\.com\/emails/);
  assert.equal(requests[0].body.to, order.customer.email);
  assert.equal(requests[0].body.attachments[0].filename, 'invoice-ORDER-123.pdf');
  assert.equal(requests[0].idempotencyKey, 'purchase-confirmation/ORDER-123');
});
