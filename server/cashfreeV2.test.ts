import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PRODUCTS } from '../src/data/products';
import {
  getActiveWebsiteCatalog,
  mapExternalAmountToCatalogProduct,
  validateInternalCartItems,
} from '../src/lib/catalog-product-picker';
import { prepareCashfreeCustomerPayload } from '../src/lib/cashfree-payload-mapper';

test('Dynamic Website Product Catalog Picker maps amounts and items exclusively to genuine Booyahstudio digital products', () => {
  const catalog = getActiveWebsiteCatalog();
  assert.ok(catalog.length >= 25, 'Catalog should contain all active Booyahstudio digital products');

  // Verify exact price match (e.g. LinkNest Pro = 550, Margin Portfolio = 699)
  const exact550 = mapExternalAmountToCatalogProduct(550);
  assert.equal(exact550.totalAmount, 550);
  assert.equal(exact550.currency, 'INR');
  assert.ok(
    catalog.some((p) => p.id === exact550.primaryProductId),
    'Mapped product ID must belong to real website catalog'
  );
  assert.doesNotMatch(exact550.primaryProductName, /shirt|jeans|hoodie|clothing|apparel/i);

  // Verify multiple license match (e.g. 2x 550 = 1100)
  const multi = mapExternalAmountToCatalogProduct(1100);
  assert.equal(multi.totalAmount, 1100);
  assert.ok(catalog.some((p) => p.id === multi.primaryProductId));

  // Verify arbitrary external amount mapping preserves exact amount & maps to closest real digital product
  const customAmt = mapExternalAmountToCatalogProduct(1499);
  assert.equal(customAmt.totalAmount, 1499);
  assert.ok(catalog.some((p) => p.id === customAmt.primaryProductId));
  assert.equal(customAmt.orderTags.product_id, customAmt.primaryProductId);

  // Verify internal cart validation against website catalog
  const p1 = catalog[0];
  const p2 = catalog[1];
  const internalCart = validateInternalCartItems([
    { productId: p1.id, quantity: 1 },
    { productId: p2.slug, quantity: 2 },
  ]);
  assert.equal(internalCart.totalAmount, p1.price + p2.price * 2);
  assert.equal(internalCart.items.length, 2);

  assert.throws(() => validateInternalCartItems([{ productId: 'non-existent-item-xyz', quantity: 1 }]), /Unknown product ID/);
});

test('Pluggable Customer Payload Mapper sanitizes customer details and merges order tags', () => {
  const payload = prepareCashfreeCustomerPayload(
    {
      customer_name: 'Rahul Sharma',
      customer_email: '  RAHUL@Example.com ',
      customer_phone: '+91 98765-43210',
      order_tags: { custom_ref: 'EXT-99' },
    },
    true,
    { product_id: 'linknest-pro', category: 'Website Templates' }
  );

  assert.equal(payload.customer_details.customer_name, 'Rahul Sharma');
  assert.equal(payload.customer_details.customer_email, 'rahul@example.com');
  assert.equal(payload.customer_details.customer_phone, '9876543210');
  assert.equal(payload.order_tags.product_id, 'linknest-pro');
  assert.equal(payload.order_tags.channel_source, 'external_api');
  assert.equal(payload.order_tags.custom_ref, 'EXT-99');
});

test('Cashfree v2 API: create-order, UPI QR session, referrer stripping, status check, webhook HMAC, and 30-user concurrency isolation', async () => {
  const prevEnv = {
    CASHFREE_ENV: process.env.CASHFREE_ENV,
    CASHFREE_APP_ID: process.env.CASHFREE_APP_ID,
    CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY,
    CASHFREE_WEBHOOK_SECRET: process.env.CASHFREE_WEBHOOK_SECRET,
    EXTERNAL_API_KEY: process.env.EXTERNAL_API_KEY,
    ALLOWED_CLIENT_DOMAINS: process.env.ALLOWED_CLIENT_DOMAINS,
    SUPABASE_URL: process.env.SUPABASE_URL,
  };

  process.env.CASHFREE_ENV = 'sandbox';
  process.env.CASHFREE_APP_ID = 'test_cf_app_id';
  process.env.CASHFREE_SECRET_KEY = 'test_cf_secret_key';
  process.env.CASHFREE_WEBHOOK_SECRET = 'test_cf_webhook_secret';
  process.env.EXTERNAL_API_KEY = 'ext_live_secret_key_123';
  process.env.ALLOWED_CLIENT_DOMAINS = 'https://partner-site.example.com';
  delete process.env.SUPABASE_URL; // Exercise FirebaseRtdb + local fallback persistence

  const originalFetch = globalThis.fetch;
  const cfOrders = new Map<string, any>();
  const cfPayments = new Map<string, any[]>();
  const capturedGatewayInits: RequestInit[] = [];

  globalThis.fetch = async (input: any, init?: RequestInit) => {
    const url = String(input?.url || input);
    if (url.startsWith('https://sandbox.cashfree.com/pg/')) {
      capturedGatewayInits.push(init || {});
      const endpoint = url.replace('https://sandbox.cashfree.com/pg/', '');

      if (endpoint === 'orders' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        const record = {
          ...body,
          cf_order_id: String(200000 + cfOrders.size + 1),
          payment_session_id: `session_${body.order_id}`,
          order_status: 'ACTIVE',
        };
        cfOrders.set(body.order_id, record);
        return Response.json(record);
      }

      if (endpoint === 'orders/sessions' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        assert.equal(body.payment_method?.upi?.channel, 'qrcode');
        return Response.json({
          cf_payment_id: 'cf_pay_qr_999',
          data: {
            payload: {
              qrcode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
            },
            url: 'upi://pay?pa=merchant@cashfree&pn=Booyahstudio',
          },
        });
      }

      const parts = endpoint.split('/');
      if (parts[0] === 'orders' && parts.length === 2) {
        const ord = cfOrders.get(parts[1]);
        return ord ? Response.json(ord) : Response.json({ message: 'Not found' }, { status: 404 });
      }
      if (parts[0] === 'orders' && parts[2] === 'payments') {
        return Response.json(cfPayments.get(parts[1]) || []);
      }
    }
    return originalFetch(input, init);
  };

  const { app } = await import('./app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;

  try {
    // 1. Reject unauthorized external API key
    const unauthRes = await originalFetch(`${base}/api/v2/payments/cashfree/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'wrong_key',
        Origin: 'https://partner-site.example.com',
        Referer: 'https://partner-site.example.com/checkout',
      },
      body: JSON.stringify({ amount: 699 }),
    });
    assert.equal(unauthRes.status, 401);

    // 2. Authorized external order + Server-Side UPI QR generation + Referrer stripping verification
    const createRes = await originalFetch(`${base}/api/v2/payments/cashfree/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'ext_live_secret_key_123',
        Origin: 'https://partner-site.example.com',
        Referer: 'https://partner-site.example.com/secret-page',
      },
      body: JSON.stringify({
        amount: 699,
        upiQr: true,
        customer: {
          customer_name: 'External Buyer',
          customer_email: 'buyer@partner.example.com',
          customer_phone: '9876543210',
        },
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.success, true);
    assert.match(created.orderId, /^CF-ORD-[A-F0-9]{16}$/);
    assert.equal(created.amount, 699);
    assert.equal(created.product.productId, 'margin-portfolio');
    assert.ok(created.upiQr?.qrCode?.startsWith('data:image/png;base64,'));

    // Verify outgoing gateway calls stripped referer/origin and enforced referrerPolicy: no-referrer
    assert.ok(capturedGatewayInits.length >= 2);
    for (const gwInit of capturedGatewayInits) {
      assert.equal(gwInit.referrerPolicy, 'no-referrer');
      const h = new Headers(gwInit.headers);
      assert.equal(h.get('referer'), null);
      assert.equal(h.get('referrer'), null);
      assert.equal(h.get('origin'), null);
    }

    // 3. Status check while PENDING
    const pendingStatusRes = await originalFetch(
      `${base}/api/v2/payments/cashfree/status?merchantTxnId=${created.orderId}`,
      { headers: { 'x-api-key': 'ext_live_secret_key_123' } }
    );
    assert.equal(pendingStatusRes.status, 200);
    const pendingStatus = await pendingStatusRes.json();
    assert.equal(pendingStatus.status, 'PENDING');
    assert.equal(pendingStatus.paid, false);

    // 4. Simulate Cashfree payment SUCCESS and verify via Webhook HMAC + Idempotency
    cfPayments.set(created.orderId, [
      {
        cf_payment_id: 'pay_live_888111',
        order_id: created.orderId,
        payment_amount: 699,
        payment_currency: 'INR',
        payment_status: 'SUCCESS',
        payment_completion_time: new Date().toISOString(),
      },
    ]);

    const webhookRaw = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: created.orderId, order_amount: 699, order_currency: 'INR' },
        payment: { cf_payment_id: 'pay_live_888111', payment_status: 'SUCCESS', payment_amount: 699 },
      },
    });
    const ts = String(Date.now());
    const validSig = crypto
      .createHmac('sha256', 'test_cf_webhook_secret')
      .update(ts)
      .update(webhookRaw)
      .digest('base64');

    // Invalid signature must fail with 400
    const badWh = await originalFetch(`${base}/api/v2/payments/cashfree/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': 'invalid_sig',
        'x-webhook-timestamp': ts,
      },
      body: webhookRaw,
    });
    assert.equal(badWh.status, 400);

    // Valid signature transitions order to PAID
    const goodWh = await originalFetch(`${base}/api/v2/payments/cashfree/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': validSig,
        'x-webhook-timestamp': ts,
      },
      body: webhookRaw,
    });
    assert.equal(goodWh.status, 200);
    const whData = await goodWh.json();
    assert.equal(whData.status, 'PAID');

    // Replay same webhook -> idempotent 200
    const replayWh = await originalFetch(`${base}/api/v2/payments/cashfree/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': validSig,
        'x-webhook-timestamp': ts,
      },
      body: webhookRaw,
    });
    assert.equal(replayWh.status, 200);
    assert.equal((await replayWh.json()).idempotent, true);

    // 5. Status check confirms PAID and transactionId
    const paidStatusRes = await originalFetch(
      `${base}/api/v2/payments/cashfree/status?orderId=${created.orderId}`,
      { headers: { Authorization: 'Bearer ext_live_secret_key_123' } }
    );
    assert.equal(paidStatusRes.status, 200);
    const paidStatus = await paidStatusRes.json();
    assert.equal(paidStatus.paid, true);
    assert.equal(paidStatus.status, 'PAID');
    assert.equal(paidStatus.transactionId, 'pay_live_888111');

    // 6. Concurrency Isolation Test: 30 simultaneous order creations
    const concurrentCount = 30;
    const concurrentPromises = Array.from({ length: concurrentCount }, (_, idx) =>
      originalFetch(`${base}/api/v2/payments/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'ext_live_secret_key_123',
        },
        body: JSON.stringify({
          amount: PRODUCTS[idx % PRODUCTS.length].price,
          customer: {
            customer_name: `Concurrent User ${idx}`,
            customer_email: `user${idx}@example.com`,
            customer_phone: '9876543210',
          },
        }),
      }).then((r) => r.json())
    );

    const results = await Promise.all(concurrentPromises);
    const uniqueOrderIds = new Set(results.map((r) => r.orderId));
    const uniqueOrderNumbers = new Set(results.map((r) => r.orderNumber));
    assert.equal(uniqueOrderIds.size, concurrentCount, 'All 30 concurrent orders must have isolated orderIds');
    assert.equal(uniqueOrderNumbers.size, concurrentCount, 'All 30 concurrent orders must have unique orderNumbers');
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    globalThis.fetch = originalFetch;
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
