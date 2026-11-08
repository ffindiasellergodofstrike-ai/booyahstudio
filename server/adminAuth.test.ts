import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { app } from './app';
import { Store } from './store';

test('admin@booyahstudio.shop logs in via ADMIN_PASSWORD environment variable and accesses /api/admin/me', async (context) => {
  const origAdminPass = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;

  context.mock.method(Store, 'rpc', async (op: string) => {
    if (op === 'rate') return true;
    return null;
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => {
    server.close();
    if (origAdminPass !== undefined) process.env.ADMIN_PASSWORD = origAdminPass;
    else delete process.env.ADMIN_PASSWORD;
  });

  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const origAppUrl = process.env.APP_URL;
  process.env.APP_URL = base;
  context.after(() => {
    if (origAppUrl !== undefined) process.env.APP_URL = origAppUrl;
    else delete process.env.APP_URL;
  });

  // 1. Without ADMIN_PASSWORD configured
  const resNoEnv = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@booyahstudio.shop', password: 'any' }),
  });
  assert.equal(resNoEnv.status, 500);
  const jsonNoEnv = await resNoEnv.json();
  assert.equal(jsonNoEnv.success, false);
  assert.match(jsonNoEnv.message, /ADMIN_PASSWORD/i);

  // 2. Set ADMIN_PASSWORD in environment
  process.env.ADMIN_PASSWORD = 'TestMasterAdminPassword2025!';

  // 3. Wrong password
  const resBadPass = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@booyahstudio.shop', password: 'WrongPassword!' }),
  });
  assert.equal(resBadPass.status, 401);
  const jsonBadPass = await resBadPass.json();
  assert.equal(jsonBadPass.success, false);

  // 4. Correct password
  const resSuccess = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@booyahstudio.shop', password: 'TestMasterAdminPassword2025!' }),
  });
  assert.equal(resSuccess.status, 200);
  const jsonSuccess = await resSuccess.json();
  assert.equal(jsonSuccess.success, true);
  assert.ok(jsonSuccess.token, 'login must return token for iframe resilience');
  assert.equal(jsonSuccess.user.email, 'admin@booyahstudio.shop');
  assert.equal(jsonSuccess.user.role, 'admin');

  // Verify sid cookie was set
  const setCookie = resSuccess.headers.get('set-cookie');
  assert.ok(setCookie && setCookie.includes('sid='));
  const match = setCookie.match(/sid=([a-f0-9]+)/);
  assert.ok(match && match[1]);
  const sid = match[1];

  // 5. Access /api/admin/me using the sid cookie
  const resAdminMe = await fetch(`${base}/api/admin/me`, {
    headers: { Cookie: `sid=${sid}` },
  });
  assert.equal(resAdminMe.status, 200);
  const jsonAdminMe = await resAdminMe.json();
  assert.equal(jsonAdminMe.success, true);
  assert.equal(jsonAdminMe.admin.role, 'admin');
  assert.equal(jsonAdminMe.admin.email, 'admin@booyahstudio.shop');

  // 5b. Access /api/admin/me using Authorization: Bearer token (no cookies)
  const resBearerAdminMe = await fetch(`${base}/api/admin/me`, {
    headers: { 'Authorization': `Bearer ${jsonSuccess.token}` },
  });
  assert.equal(resBearerAdminMe.status, 200);
  const jsonBearer = await resBearerAdminMe.json();
  assert.equal(jsonBearer.success, true);
  assert.equal(jsonBearer.admin.role, 'admin');

  // 6. Access /api/auth/me using the sid cookie
  const resAuthMe = await fetch(`${base}/api/auth/me`, {
    headers: { Cookie: `sid=${sid}` },
  });
  assert.equal(resAuthMe.status, 200);
  const jsonAuthMe = await resAuthMe.json();
  assert.equal(jsonAuthMe.success, true);
  assert.equal(jsonAuthMe.user.role, 'admin');

  // 7. Prevent customer registration with reserved admin email
  const resRegister = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({
      email: 'admin@booyahstudio.shop',
      password: 'password123',
      confirmPassword: 'password123',
      name: 'Fake Admin',
      mobile: '9876543210',
    }),
  });
  assert.equal(resRegister.status, 400);
  const jsonRegister = await resRegister.json();
  assert.equal(jsonRegister.success, false);
});
