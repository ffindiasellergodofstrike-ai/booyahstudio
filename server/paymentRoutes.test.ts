import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { AuthServiceServer } from './auth';
import { FirebaseRtdb } from './firebaseRtdb';
import { AuditLogger } from './audit';
import { SecureFileManager } from './secureFiles';

test('HTTP payment flow denies unpaid downloads and unverified payments, then revokes access', async (context) => {
  const oldMode = process.env.EASEBUZZ_ENV;
  process.env.EASEBUZZ_ENV = 'prod';
  const oldKey = process.env.EASEBUZZ_KEY;
  const oldSalt = process.env.EASEBUZZ_SALT;
  process.env.EASEBUZZ_KEY = 'synthetic-merchant';
  process.env.EASEBUZZ_SALT = 'synthetic-test-salt';

  const originalFetch = globalThis.fetch;
  const order: any = {
    id: 'synthetic-order-1', paymentEnvironment: 'live', paymentProvider: 'Easebuzz', orderNumber: 'synthetic-order-1', userId: 'buyer',
    transactionId: 'synthetic-gateway-txn-1', easebuzzTxnId: 'synthetic-gateway-txn-1',
    status: 'PENDING_PAYMENT', orderStatus: 'PENDING', paymentStatus: 'PENDING',
    deliveryStatus: 'PENDING', downloadStatus: 'UNAVAILABLE', total: 550,
    customer: { fullName: 'Demo Buyer', email: 'demo@example.test', phone: '9999999999', country: 'India' },
    items: [{ productId: 'linknest-pro', productTitle: 'Demo Product', downloadUrl: '/api/downloads/linknest-pro' }],
  };
  let storedOrder: any = structuredClone(order);
  const purchases: any[] = [{
    purchaseId: 'pur_synthetic-order-1_linknest-pro', userId: 'buyer',
    orderId: order.id, productId: 'linknest-pro', accessStatus: 'active',
    downloadCount: 2, downloadLimit: 10,
  }];
  const storedTokens = new Map<string, any>();
  const invoiceToken = 'S'.repeat(43);
  const invoiceTokenHash = crypto.createHash('sha256').update(invoiceToken).digest('hex');
  storedTokens.set(`invoiceDownloadTokens/${invoiceTokenHash}`, {
    userId: 'buyer', orderId: order.id, expiresAt: Date.now() + 60000,
    downloadCount: 0, downloadLimit: 10,
  });
  const savedDownloads: any[] = [];
  const profileUpdates: any[] = [];
  let gatewayPayment: any = { status: 'pending', txnid: order.easebuzzTxnId, amount: '550.00' };
  let gatewayAvailable = true;
  const gatewayRequests: string[] = [];

  try {
    const { app } = await import('./app');
    context.mock.method(AuthServiceServer, 'verifyOpaqueSession', async (sid: string) => ({
      userId: sid, email: `${sid}@example.test`, username: sid,
    }));
    context.mock.method(FirebaseRtdb, 'getGlobalOrder', async (orderId: string) =>
      orderId === order.id || orderId === storedOrder.easebuzzTxnId ? storedOrder : null);
    context.mock.method(FirebaseRtdb, 'getUserPurchases', async (userId: string) =>
      userId === 'buyer' ? purchases : []);
    context.mock.method(FirebaseRtdb, 'getUserDownloads', async () => savedDownloads);
    context.mock.method(FirebaseRtdb, 'getUserProfile', async (userId: string) =>
      ({ role: userId === 'admin' ? 'admin' : 'customer', email: `${userId}@example.test` }));
    context.mock.method(FirebaseRtdb, 'updateUserProfile', async (_userId: string, update: any) => {
      profileUpdates.push(update);
      return update;
    });
    context.mock.method(FirebaseRtdb, 'saveGlobalOrder', async (updated: any) => {
      storedOrder = structuredClone(updated);
    });
    context.mock.method(FirebaseRtdb, 'savePurchase', async (_userId: string, _id: string, updated: any) => {
      const index = purchases.findIndex((candidate) => candidate.purchaseId === updated.purchaseId);
      if (index < 0) purchases.push(updated);
      else purchases[index] = updated;
    });
    context.mock.method(FirebaseRtdb, 'saveUserDownload', async (_userId: string, _id: string, data: any) => {
      savedDownloads.push(data);
    });
    context.mock.method(FirebaseRtdb, 'set', async (path: string, data: any) => {
      storedTokens.set(path, structuredClone(data));
      return data;
    });
    context.mock.method(FirebaseRtdb, 'get', async (path: string) => storedTokens.get(path) || null);
    context.mock.method(AuditLogger, 'log', async () => undefined);
    context.mock.method(SecureFileManager, 'openProductFile', async () => ({
      stream: Readable.from([Buffer.from([0x50, 0x4b, 0x03, 0x04])]),
      contentLength: 4,
    }));

    globalThis.fetch = async (input: any, init?: any) => {
      if (String(input).startsWith('https://dashboard.easebuzz.in/')) {
        gatewayRequests.push(String(input));
        const form = new URLSearchParams(init?.body);
        const expectedHash = crypto.createHash('sha512')
          .update(`synthetic-merchant|${order.easebuzzTxnId}|synthetic-test-salt`).digest('hex');
        assert.equal(form.get('hash'), expectedHash);
        assert.equal(form.get('txnid'), order.easebuzzTxnId);
        assert.equal(form.get('amount'), null);
        if (!gatewayAvailable) throw new Error('Synthetic gateway outage');
        return Response.json({ status: 1, data: gatewayPayment });
      }
      return originalFetch(input, init);
    };

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    context.after(() => server.close());
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const request = (path: string, sid = 'buyer', body?: object) => originalFetch(`${baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: `sid=${sid}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const signedNotification = (status: string, endpoint: 'callback' | 'webhook' = 'callback', overrides: Record<string, string> = {}) => {
      const params = {
        status, email: 'demo@example.test', firstname: 'Demo', productinfo: 'Demo',
        amount: '550.00', txnid: order.easebuzzTxnId, key: 'synthetic-merchant', ...overrides,
      };
      const hash = crypto.createHash('sha512').update([
        'synthetic-test-salt', status, ...Array(10).fill(''), params.email,
        params.firstname, params.productinfo, params.amount, params.txnid, params.key,
      ].join('|')).digest('hex');
      return originalFetch(`${baseUrl}/api/payments/easebuzz/${endpoint}`, {
        method: 'POST', headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://attacker.example',
        },
        body: new URLSearchParams({ ...params, hash: overrides.hash || hash }), redirect: 'manual',
      });
    };
    const callback = (status: string) => signedNotification(status);
    const webhook = (status: string, overrides?: Record<string, string>) =>
      signedNotification(status, 'webhook', overrides);

    assert.equal((await request(`/api/orders/${order.id}`, 'stranger')).status, 404);
    assert.equal((await request(`/api/orders/${order.id}/invoice`)).status, 403);
    assert.equal((await request(`/api/orders/${order.id}/invoice`, 'stranger')).status, 404);
    assert.equal((await request('/api/newsletter/subscribe', 'buyer', { email: 'invalid' })).status, 400);
    assert.equal((await request('/api/newsletter/subscribe', 'buyer', { email: 'buyer@example.test' })).status, 200);
    assert.ok([...storedTokens.keys()].some((key) => key.startsWith('newsletterSubscribers/')));
    const updateProfile = (body: object) => originalFetch(`${baseUrl}/api/user/profile`, {
      method: 'PUT', headers: { Cookie: 'sid=buyer', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal((await updateProfile({ role: 'admin' })).status, 400);
    assert.equal(profileUpdates.length, 0);
    assert.equal((await updateProfile({ name: 'Buyer Name', company: 'Studio', country: 'India' })).status, 200);
    assert.equal(profileUpdates[0].company, 'Studio');
    assert.equal((await request('/api/orders/create', 'buyer', {
      items: [{ productId: 'linknest-pro' }], customer: { email: 'other@example.test' },
    })).status, 400);
    assert.equal((await request('/api/downloads/stream?token=../orders/synthetic-order-1')).status, 400);
    assert.equal((await request('/api/downloads/linknest-pro/token', 'buyer', {})).status, 403);
    assert.equal((await request(`/api/invoices/email?token=${invoiceToken}`)).status, 403);
    assert.equal((await request('/api/payments/easebuzz/initiate', 'buyer', {
      orderId: order.id, agreeTerms: true,
    })).status, 409);

    const reconcile = () => request(`/api/payments/easebuzz/reconcile/${order.id}`, 'buyer', {});
    const pending = await (await reconcile()).json();
    assert.equal(pending.status, 'PENDING');
    assert.equal(storedOrder.paymentStatus, 'PENDING');
    gatewayAvailable = false;
    assert.equal((await (await reconcile()).json()).status, 'PENDING');
    assert.equal(storedOrder.paymentStatus, 'PENDING');
    gatewayAvailable = true;
    assert.equal((await webhook('success', { hash: 'invalid' })).status, 400);
    assert.equal((await webhook('success', { amount: '5.50' })).status, 400);
    assert.match((await callback('pending')).headers.get('location') || '', /status=pending/);

    assert.match((await callback('failure')).headers.get('location') || '', /status=failed/);
    assert.equal(storedOrder.paymentStatus, 'PENDING');
    assert.equal((await request('/api/payments/easebuzz/initiate', 'buyer', {
      orderId: order.id, agreeTerms: true,
    })).status, 409);
    assert.equal(storedOrder.easebuzzTxnId, order.easebuzzTxnId);
    assert.equal((await request('/api/downloads/linknest-pro/token', 'buyer', {})).status, 403);

    gatewayPayment = { status: 'success', txnid: 'another-order', amount: '550.00' };
    assert.equal((await (await reconcile()).json()).success, false);
    gatewayPayment = { status: 'success', txnid: order.easebuzzTxnId, amount: '5.50' };
    assert.equal((await (await reconcile()).json()).success, false);
    assert.equal(storedOrder.paymentStatus, 'PENDING');

    gatewayPayment = { status: 'failure', txnid: order.easebuzzTxnId, amount: '550.00' };
    assert.equal((await (await reconcile()).json()).status, 'FAILED');
    assert.equal((await (await webhook('failure')).json()).status, 'FAILED');
    assert.equal(storedOrder.paymentStatus, 'PENDING');

    const manualPaid = await originalFetch(`${baseUrl}/api/admin/orders/${order.id}/status`, {
      method: 'PUT', headers: { Cookie: 'sid=admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID', paymentStatus: 'PAID' }),
    });
    assert.equal(manualPaid.status, 400);

    gatewayAvailable = false;
    const paidCallback = await callback('success');
    assert.match(paidCallback.headers.get('location') || '', /status=success/);
    assert.doesNotMatch(paidCallback.headers.get('location') || '', /attacker\.example/);
    assert.equal((await webhook('success')).status, 200);
    assert.equal(storedOrder.paymentStatus, 'PAID');
    assert.equal(storedOrder.invoiceNumber, `INV-${order.id}`);
    assert.match(storedOrder.paymentVerifiedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(storedOrder.deliveredAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(storedOrder.deliveryStatus, 'DELIVERED');
    const invoiceResponse = await request(`/api/orders/${order.id}/invoice`);
    assert.equal(invoiceResponse.status, 200);
    assert.equal(invoiceResponse.headers.get('content-type'), 'application/pdf');
    assert.equal((await (await request('/api/user/downloads')).json()).downloads.length, 1);
    assert.equal(storedOrder.easebuzzTxnId, order.easebuzzTxnId);
    assert.equal(storedOrder.transactionId, order.easebuzzTxnId);
    assert.equal(savedDownloads.length, 1);
    assert.equal(purchases[0].downloadCount, 2);
    assert.equal((await (await reconcile()).json()).status, 'PAID');
    assert.equal(savedDownloads.length, 1);
    assert.equal(purchases[0].downloadCount, 2);
    assert.deepEqual(gatewayRequests, Array(6).fill('https://dashboard.easebuzz.in/transaction/v2/retrieve'));

    assert.match((await callback('failure')).headers.get('location') || '', /status=success/);
    assert.equal(storedOrder.paymentStatus, 'PAID');

    const tokenResponse = await request('/api/downloads/linknest-pro/token', 'buyer', { orderId: order.id });
    assert.equal(tokenResponse.status, 200);
    const issuedToken = (await tokenResponse.json()).token;
    assert.equal((await request('/api/downloads/linknest-pro/token', 'stranger', { orderId: order.id })).status, 403);

    const delivered = await request(`/api/downloads/stream?token=${encodeURIComponent(issuedToken)}`);
    assert.equal(delivered.status, 200);
    assert.equal(delivered.headers.get('content-type'), 'application/zip');
    assert.deepEqual(Buffer.from(await delivered.arrayBuffer()), Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    assert.equal(purchases[0].downloadCount, 3);
    assert.equal((await request(`/api/downloads/stream?token=${encodeURIComponent(issuedToken)}`)).status, 403);

    const secondTokenResponse = await request('/api/downloads/linknest-pro/token', 'buyer', { orderId: order.id });
    assert.equal(secondTokenResponse.status, 200);
    const revokedToken = (await secondTokenResponse.json()).token;

    const revoke = await originalFetch(`${baseUrl}/api/admin/orders/${order.id}/status`, {
      method: 'PUT', headers: { Cookie: 'sid=admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryStatus: 'REVOKED' }),
    });
    assert.equal(revoke.status, 200);
    assert.equal((await request('/api/downloads/linknest-pro/token', 'buyer', { orderId: order.id })).status, 403);
    assert.equal((await (await request('/api/user/downloads')).json()).downloads.length, 0);
    assert.equal((await request(`/api/downloads/stream?token=${encodeURIComponent(revokedToken)}`)).status, 403);
    assert.equal((await request(`/api/invoices/email?token=${invoiceToken}`)).status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldMode === undefined) delete process.env.EASEBUZZ_ENV; else process.env.EASEBUZZ_ENV = oldMode;
    if (oldKey === undefined) delete process.env.EASEBUZZ_KEY;
    else process.env.EASEBUZZ_KEY = oldKey;
    if (oldSalt === undefined) delete process.env.EASEBUZZ_SALT;
    else process.env.EASEBUZZ_SALT = oldSalt;
  }
});
