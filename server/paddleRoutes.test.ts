import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import { once } from 'node:events';
import { AuthServiceServer } from './auth';
import { FirebaseRtdb } from './firebaseRtdb';
import { AuditLogger } from './audit';

test('Paddle HTTP routes: client config, checkout initiation, signed webhook verification & fulfillment', async (context) => {
  const prevEnv = process.env.PADDLE_ENVIRONMENT;
  const prevClientToken = process.env.PADDLE_CLIENT_TOKEN;
  const prevWebhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const prevPriceId = process.env.PADDLE_PRICE_LINKNEST_PRO;

  const testSecret = 'pdl_ntf_set_synthetic_paddle_secret_999';
  process.env.PADDLE_ENVIRONMENT = 'sandbox';
  process.env.PADDLE_CLIENT_TOKEN = 'test_token_synthetic_123';
  process.env.PADDLE_WEBHOOK_SECRET = testSecret;
  process.env.PADDLE_PRICE_LINKNEST_PRO = 'pri_synthetic_linknest_550';

  const orderId = 'LN-20260929-TEST01';
  const order: any = {
    id: orderId,
    orderId,
    orderNumber: orderId,
    userId: 'paddle-buyer',
    productId: 'linknest-pro',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    orderStatus: 'PENDING',
    deliveryStatus: 'PENDING',
    downloadStatus: 'UNAVAILABLE',
    amount: 550,
    total: 550,
    currency: 'INR',
    customer: { fullName: 'Paddle Buyer', email: 'paddle-buyer@example.test', country: 'India' },
    items: [
      {
        productId: 'linknest-pro',
        productTitle: 'LinkNest Pro',
        price: 550,
        quantity: 1,
        downloadUrl: '/api/downloads/linknest-pro',
      },
    ],
  };

  let storedOrder: any = structuredClone(order);
  const storedEvents = new Map<string, any>();
  const purchases: any[] = [];
  const savedDownloads: any[] = [];

  try {
    const { app } = await import('./app');

    context.mock.method(AuthServiceServer, 'verifyOpaqueSession', async (sid: string) => ({
      userId: sid,
      email: `${sid}@example.test`,
      username: sid,
    }));

    context.mock.method(FirebaseRtdb, 'getGlobalOrder', async (id: string) => (id === orderId ? storedOrder : null));
    context.mock.method(FirebaseRtdb, 'getUserOrderById', async (userId: string, id: string) =>
      userId === 'paddle-buyer' && id === orderId ? storedOrder : null
    );
    context.mock.method(FirebaseRtdb, 'getUserProfile', async (userId: string) => ({
      role: 'customer',
      email: `${userId}@example.test`,
      name: 'Paddle Buyer',
    }));
    context.mock.method(FirebaseRtdb, 'saveGlobalOrder', async (updated: any) => {
      storedOrder = structuredClone(updated);
    });
    context.mock.method(FirebaseRtdb, 'getPaymentEvent', async (eventId: string) => storedEvents.get(eventId) || null);
    context.mock.method(FirebaseRtdb, 'savePaymentEvent', async (eventId: string, data: any) => {
      storedEvents.set(eventId, data);
    });
    context.mock.method(FirebaseRtdb, 'getUserPurchases', async () => purchases);
    context.mock.method(FirebaseRtdb, 'getUserDownloads', async () => savedDownloads);
    context.mock.method(FirebaseRtdb, 'savePurchase', async (_userId: string, _id: string, item: any) => {
      purchases.push(item);
    });
    context.mock.method(FirebaseRtdb, 'saveUserDownload', async (_userId: string, _id: string, item: any) => {
      savedDownloads.push(item);
    });
    context.mock.method(AuditLogger, 'log', async () => {});

    const server = app.listen(0);
    await once(server, 'listening');
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. Test /api/config/paddle
      const configRes = await fetch(`${baseUrl}/api/config/paddle`);
      assert.equal(configRes.status, 200);
      const configJson = await configRes.json();
      assert.equal(configJson.success, true);
      assert.equal(configJson.environment, 'sandbox');
      assert.equal(configJson.clientToken, 'test_token_synthetic_123');
      assert.equal(configJson.prices['linknest-pro'], 'pri_synthetic_linknest_550');

      // 2. Test /api/payments/paddle/initiate (without terms acceptance should fail)
      const initFailRes = await fetch(`${baseUrl}/api/payments/paddle/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'sid=paddle-buyer',
        },
        body: JSON.stringify({ orderId, agreeTerms: false }),
      });
      assert.equal(initFailRes.status, 400);

      // 3. Test /api/payments/paddle/initiate (with valid session & terms)
      const initRes = await fetch(`${baseUrl}/api/payments/paddle/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'sid=paddle-buyer',
        },
        body: JSON.stringify({ orderId, agreeTerms: true }),
      });
      assert.equal(initRes.status, 200);
      const initJson = await initRes.json();
      assert.equal(initJson.success, true);
      assert.equal(initJson.priceId, 'pri_synthetic_linknest_550');
      assert.equal(initJson.orderId, orderId);

      // 4. Test Webhook with invalid signature (should be rejected with 400)
      const fakeWebhookRes = await fetch(`${baseUrl}/api/payments/paddle/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Paddle-Signature': 'ts=1000;h1=invalid_fake_hash',
        },
        body: JSON.stringify({ event_type: 'transaction.completed' }),
      });
      assert.equal(fakeWebhookRes.status, 400);

      // 5. Test Webhook with valid signature (transaction.completed)
      const eventPayload = {
        event_id: 'evt_test_paddle_completion_001',
        event_type: 'transaction.completed',
        occurred_at: new Date().toISOString(),
        data: {
          id: 'txn_paddle_live_test_001',
          status: 'completed',
          customer_id: 'ctm_paddle_test_001',
          custom_data: {
            orderId: orderId,
            userId: 'paddle-buyer',
            productId: 'linknest-pro',
          },
          details: {
            totals: {
              currency_code: 'INR',
              total: '55000',
            },
          },
        },
      };

      const underpaid = { ...eventPayload, event_id: 'evt_underpaid', data: { ...eventPayload.data, details: { totals: { currency_code: 'INR', total: '550' } } } };
      const badRaw = JSON.stringify(underpaid); const badTs = String(Math.floor(Date.now()/1000));
      const badHash = crypto.createHmac('sha256', testSecret).update(`${badTs}:${badRaw}`).digest('hex');
      const underpaidRes = await fetch(`${baseUrl}/api/payments/paddle/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Paddle-Signature': `ts=${badTs};h1=${badHash}` }, body: badRaw });
      assert.equal((await underpaidRes.json()).success, false);
      assert.equal(storedOrder.paymentStatus, 'PENDING');

      const rawPayload = JSON.stringify(eventPayload);
      const ts = String(Math.floor(Date.now() / 1000));
      const h1 = crypto.createHmac('sha256', testSecret).update(`${ts}:${rawPayload}`, 'utf8').digest('hex');

      const webhookRes = await fetch(`${baseUrl}/api/payments/paddle/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Paddle-Signature': `ts=${ts};h1=${h1}`,
        },
        body: rawPayload,
      });

      assert.equal(webhookRes.status, 200);
      const webhookJson = await webhookRes.json();
      assert.equal(webhookJson.success, true);
      assert.equal(webhookJson.status, 'PAID');

      // Verify order is now marked PAID with Paddle transaction ID
      assert.equal(storedOrder.paymentStatus, 'PAID');
      assert.equal(storedOrder.paymentProvider, 'Paddle');
      assert.equal(storedOrder.paddleTransactionId, 'txn_paddle_live_test_001');
      assert.equal(storedOrder.downloadStatus, 'UNAVAILABLE');
      assert.equal(storedOrder.paymentEnvironment, 'test');
      assert.equal(storedOrder.deliveryStatus, 'TEST_ONLY');

      // Verify digital purchase access was granted
      assert.equal(purchases.length, 0);
      assert.equal(savedDownloads.length, 0);

      // 6. Test Idempotent Duplicate Webhook (same event_id should return 200 without duplicate processing)
      const dupRes = await fetch(`${baseUrl}/api/payments/paddle/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Paddle-Signature': `ts=${ts};h1=${h1}`,
        },
        body: rawPayload,
      });
      assert.equal(dupRes.status, 200);
      const dupJson = await dupRes.json();
      assert.equal(dupJson.success, true);
      assert.equal(dupJson.message, 'Event already processed.');

      // 7. Test Reconcile Endpoint (/api/payments/paddle/reconcile/:orderId)
      const reconcileRes = await fetch(`${baseUrl}/api/payments/paddle/reconcile/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'sid=paddle-buyer',
        },
      });
      assert.equal(reconcileRes.status, 200);
      const reconcileJson = await reconcileRes.json();
      assert.equal(reconcileJson.success, true);
      assert.equal(reconcileJson.status, 'PAID');
    } finally {
      server.close();
    }
  } finally {
    if (prevEnv) process.env.PADDLE_ENVIRONMENT = prevEnv;
    else delete process.env.PADDLE_ENVIRONMENT;
    if (prevClientToken) process.env.PADDLE_CLIENT_TOKEN = prevClientToken;
    else delete process.env.PADDLE_CLIENT_TOKEN;
    if (prevWebhookSecret) process.env.PADDLE_WEBHOOK_SECRET = prevWebhookSecret;
    else delete process.env.PADDLE_WEBHOOK_SECRET;
    if (prevPriceId) process.env.PADDLE_PRICE_LINKNEST_PRO = prevPriceId;
    else delete process.env.PADDLE_PRICE_LINKNEST_PRO;
  }
});
