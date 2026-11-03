import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { handlePrivateCheckoutRequest } from '../server/private-checkout';
import { readCheckoutParameters } from '../src/lib/booyah-checkout-access';
import { pickCatalogProduct } from '../src/lib/catalog-product-picker';

test('booyah checkout parameter validation rejects missing, invalid or duplicate parameters', () => {
  assert.equal(readCheckoutParameters(new URLSearchParams('')), null);
  assert.equal(readCheckoutParameters(new URLSearchParams('pkg=100&diamonds=100&uid=12345&nick=Player')), null); // missing level
  assert.equal(readCheckoutParameters(new URLSearchParams('pkg=invalid&diamonds=100&uid=12345&nick=Player&level=10')), null);
  assert.equal(readCheckoutParameters(new URLSearchParams('pkg=100&diamonds=100&uid=00000&nick=Player&level=10')), null); // zero uid
  assert.equal(readCheckoutParameters(new URLSearchParams('pkg=100&diamonds=100&uid=12345&nick=Player&level=10&pkg=200')), null); // duplicate pkg
});

test('catalog product picker maps amount to store products', () => {
  const item = pickCatalogProduct(550);
  assert.ok(item);
  assert.equal(typeof item.id, 'string');
  assert.equal(typeof item.name, 'string');
  assert.equal(item.price, 550);
});

test('private checkout server route enforces 404 on bare or invalid access and 200 with security headers on valid 5-param GET', async (t) => {
  const app = express();
  app.get('/booyahpay', handlePrivateCheckoutRequest);
  app.post('/booyahpay', handlePrivateCheckoutRequest);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise<void>(r => server.close(() => r()));
  });

  const base = `http://127.0.0.1:${(server.address() as any).port}`;

  // 1. Bare URL returns 404
  const resBare = await fetch(`${base}/booyahpay`);
  assert.equal(resBare.status, 404);
  assert.equal(resBare.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  // 2. POST returns 404
  const resPost = await fetch(`${base}/booyahpay`, { method: 'POST' });
  assert.equal(resPost.status, 404);

  // 3. Valid 5 params returns 200 with cache-control no-store and noindex headers
  const validUrl = `${base}/booyahpay?pkg=550&diamonds=100&uid=123456789&nick=TestUser&level=50`;
  const resValid = await fetch(validUrl);
  assert.equal(resValid.status, 200);
  assert.equal(resValid.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(resValid.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.equal(resValid.headers.get('x-frame-options'), 'DENY');
  const html = await resValid.text();
  assert.ok(html.includes('TestUser'));
});
