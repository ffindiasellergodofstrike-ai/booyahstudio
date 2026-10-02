import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import { AuthServiceServer } from './auth';
import { FirebaseRtdb } from './firebaseRtdb';
import { AuditLogger } from './audit';

test('production initiation preserves the legacy payload and signed notifications deliver without dashboard lookup', async (context) => {
  process.env.EASEBUZZ_KEY = 'synthetic-prod-merchant';
  process.env.EASEBUZZ_SALT = 'synthetic-prod-salt';
  process.env.EASEBUZZ_ENV = 'prod';
  process.env.APP_URL = 'https://store.example.test';
  process.env.RESEND_API_KEY = 're_synthetic';
  process.env.RESEND_FROM_EMAIL = 'BOOYAH STUDIO <orders@example.test>';

  const makeOrder = (id: string) => ({
    id, orderNumber: id, userId: 'buyer', paymentEnvironment: 'live', paymentProvider: 'Easebuzz', easebuzzTxnId: id,
    transactionId: id, total: 550,
    status: 'PENDING_PAYMENT', paymentStatus: 'PENDING', orderStatus: 'PENDING',
    deliveryStatus: 'PENDING', downloadStatus: 'UNAVAILABLE',
    customer: { fullName: 'Demo Buyer', email: 'buyer@example.test', phone: '9876543210', country: 'India' },
    items: [{ productId: 'demo', productTitle: 'Demo', downloadUrl: '/api/downloads/demo' }],
  });
  const orders = new Map<string, any>([
    ['prod-manual-1', makeOrder('prod-manual-1')],
    ['prod-webhook-1', makeOrder('prod-webhook-1')],
    ['prod-callback-1', makeOrder('prod-callback-1')],
    ['prod-popup-1', makeOrder('prod-popup-1')],
    ['prod-initiate-1', { ...makeOrder('prod-initiate-1'), easebuzzTxnId: undefined, transactionId: undefined,
      checkoutStartedAt: '2026-09-25T00:00:00.000Z', requestId: 'synthetic-request-1' }],
  ]);
  const purchases: any[] = [];
  const downloads: any[] = [];
  const gatewayRequests: string[] = [];
  let gatewayAvailable = true;
  const sentEmails: any[] = [];
  let initiationForm: URLSearchParams | undefined;
  const originalFetch = globalThis.fetch;

  try {
    const { app } = await import('./app');
    context.mock.method(AuthServiceServer, 'verifyOpaqueSession', async () => ({
      userId: 'buyer', email: 'buyer@example.test', username: 'buyer',
    }));
    context.mock.method(FirebaseRtdb, 'getUserProfile', async () => ({ role: 'customer' }));
    context.mock.method(FirebaseRtdb, 'getGlobalOrder', async (id: string) => orders.get(id) || null);
    context.mock.method(FirebaseRtdb, 'saveGlobalOrder', async (order: any) => {
      orders.set(order.id, structuredClone(order));
    });
    context.mock.method(FirebaseRtdb, 'getUserPurchases', async () => purchases);
    context.mock.method(FirebaseRtdb, 'getUserDownloads', async () => downloads);
    context.mock.method(FirebaseRtdb, 'savePurchase', async (_user: string, _id: string, purchase: any) => {
      purchases.push(purchase);
    });
    context.mock.method(FirebaseRtdb, 'saveUserDownload', async (_user: string, _id: string, download: any) => {
      downloads.push(download);
    });
    context.mock.method(AuditLogger, 'log', async () => undefined);
    context.mock.method(FirebaseRtdb, 'set', async (_path: string, data: any) => data);

    globalThis.fetch = async (input: any, init?: any) => {
      const url = String(input);
      if (url === 'https://pay.easebuzz.in/payment/initiateLink') {
        initiationForm = new URLSearchParams(init?.body);
        return Response.json({ status: 1, data: 'synthetic-access-key' });
      }
      if (url.startsWith('https://api.resend.com/emails')) {
        sentEmails.push(JSON.parse(init?.body));
        return Response.json({ id: `synthetic-email-${sentEmails.length}` });
      }
      if (url === 'https://dashboard.easebuzz.in/transaction/v2/retrieve') {
        gatewayRequests.push(url);
        if (!gatewayAvailable) throw new Error('Synthetic dashboard outage');
        const form = new URLSearchParams(init?.body);
        const txnid = form.get('txnid');
        assert.ok(txnid && orders.has(txnid));
        assert.equal(form.get('hash'), crypto.createHash('sha512')
          .update(`synthetic-prod-merchant|${txnid}|synthetic-prod-salt`).digest('hex'));
        return Response.json({ status: 1, data: {
          status: 'success', txnid, amount: '550.00',
          easepayid: `provider-${txnid}`,
        } });
      }
      return originalFetch(input, init);
    };

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    context.after(() => server.close());
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const initiate = (agreeTerms: boolean) => originalFetch(`${base}/api/payments/easebuzz/initiate`, {
      method: 'POST', headers: { Cookie: 'sid=buyer', 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'prod-initiate-1', agreeTerms }),
    });
    assert.equal((await initiate(false)).status, 400);
    assert.equal((await initiate(true)).status, 200);
    assert.equal(initiationForm?.get('firstname'), 'Demo');
    assert.equal(initiationForm?.get('phone'), '9876543210');
    assert.equal(initiationForm?.get('productinfo'), 'BOOYAH STUDIO Products');
    assert.equal(initiationForm?.get('surl'), 'https://store.example.test/api/payments/easebuzz/callback');
    assert.equal(initiationForm?.get('furl'), 'https://store.example.test/api/payments/easebuzz/callback');
    for (let field = 1; field <= 10; field++) assert.equal(initiationForm?.get(`udf${field}`), null);
    const hashFields = ['key', 'txnid', 'amount', 'productinfo', 'firstname', 'email',
      ...Array.from({ length: 10 }, (_, i) => `udf${i + 1}`)];
    assert.equal(initiationForm?.get('hash'), crypto.createHash('sha512').update([
      ...hashFields.map((field) => initiationForm?.get(field) || ''), 'synthetic-prod-salt',
    ].join('|')).digest('hex'));
    assert.equal(orders.get('prod-initiate-1').termsAccepted, true);
    assert.equal(orders.get('prod-initiate-1').paymentInitiationIp, '127.0.0.1');
    assert.equal(orders.get('prod-initiate-1').customer.country, 'India');
    assert.equal(orders.get('prod-initiate-1').customer.fullName, 'Demo Buyer');
    assert.equal(orders.get('prod-initiate-1').items[0].productTitle, 'Demo');
    assert.equal(orders.get('prod-initiate-1').checkoutStartedAt, '2026-09-25T00:00:00.000Z');
    assert.equal(orders.get('prod-initiate-1').requestId, 'synthetic-request-1');

    const manual = await originalFetch(`${base}/api/payments/easebuzz/reconcile/prod-manual-1`, {
      method: 'POST', headers: { Cookie: 'sid=buyer' },
    });
    assert.equal(manual.status, 200);
    assert.equal((await manual.json()).status, 'PAID');
    assert.equal(orders.get('prod-manual-1').deliveryStatus, 'DELIVERED');
    assert.equal(orders.get('prod-manual-1').emailDelivery.status, 'sent');
    gatewayAvailable = false;

    const fields = {
      status: 'success', email: 'buyer@example.test', firstname: 'Buyer',
      productinfo: 'Demo', amount: '550.00', txnid: 'prod-webhook-1',
      key: 'synthetic-prod-merchant',
    };
    const hash = crypto.createHash('sha512').update([
      'synthetic-prod-salt', fields.status, ...Array(10).fill(''), fields.email,
      fields.firstname, fields.productinfo, fields.amount, fields.txnid, fields.key,
    ].join('|')).digest('hex');
    const notify = () => originalFetch(`${base}/api/payments/easebuzz/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...fields, hash }),
    });
    assert.equal((await notify()).status, 200);
    assert.equal(orders.get('prod-webhook-1').paymentStatus, 'PAID');
    assert.equal(orders.get('prod-webhook-1').deliveryStatus, 'DELIVERED');
    assert.equal(orders.get('prod-webhook-1').emailDelivery.status, 'sent');
    assert.match(orders.get('prod-webhook-1').paymentVerifiedAt, /^\d{4}-\d\d-\d\dT/);
    assert.equal(orders.get('prod-webhook-1').invoiceNumber, 'INV-prod-webhook-1');
    assert.equal(purchases.length, 2);
    assert.equal(downloads.length, 2);
    assert.equal(sentEmails.length, 2);
    assert.equal((await notify()).status, 200);
    assert.equal(gatewayRequests.length, 1);
    assert.equal(purchases.length, 2);
    assert.equal(downloads.length, 2);
    assert.equal(sentEmails.length, 2);

    const callbackFields = { ...fields, txnid: 'prod-callback-1' };
    const callbackHash = crypto.createHash('sha512').update([
      'synthetic-prod-salt', callbackFields.status, ...Array(10).fill(''), callbackFields.email,
      callbackFields.firstname, callbackFields.productinfo, callbackFields.amount,
      callbackFields.txnid, callbackFields.key,
    ].join('|')).digest('hex');
    const callback = await originalFetch(`${base}/api/payments/easebuzz/callback`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...callbackFields, hash: callbackHash }), redirect: 'manual',
    });
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get('location') || '', /status=success/);
    assert.equal(orders.get('prod-callback-1').deliveryStatus, 'DELIVERED');
    assert.equal(orders.get('prod-callback-1').emailDelivery.status, 'sent');
    assert.equal(sentEmails.length, 3);
    assert.equal(sentEmails[2].to, 'buyer@example.test');
    assert.equal(sentEmails[2].attachments[0].filename, 'invoice-prod-callback-1.pdf');
    assert.equal(gatewayRequests.length, 1);

    const popupFields = { ...fields, txnid: 'prod-popup-1' };
    const popupHash = crypto.createHash('sha512').update([
      'synthetic-prod-salt', popupFields.status, ...Array(10).fill(''), popupFields.email,
      popupFields.firstname, popupFields.productinfo, popupFields.amount,
      popupFields.txnid, popupFields.key,
    ].join('|')).digest('hex');
    const popup = await originalFetch(`${base}/api/payments/easebuzz/popup-response`, {
      method: 'POST', headers: { Cookie: 'sid=buyer', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...popupFields, hash: popupHash }),
    });
    assert.equal(popup.status, 200);
    assert.equal((await popup.json()).status, 'PAID');
    assert.equal(orders.get('prod-popup-1').deliveryStatus, 'DELIVERED');
    assert.equal(sentEmails.length, 4);
    assert.equal(gatewayRequests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
