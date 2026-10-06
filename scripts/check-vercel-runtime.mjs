// Run after pnpm build. Deliberately uses native Node, not tsx/Vite's module loader.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL']) delete process.env[key];
process.env.NODE_ENV = 'production';
process.env.APP_URL = 'https://shop.example.com';
const { default: app } = await import('../api/index.ts');
const { default: page } = await import('../api/page.ts');
const server = createServer((req, res) => {
  if (req.url.startsWith('/page-check')) {
    req.query = { slug: new URL(req.url, 'http://localhost').searchParams.get('slug') };
    return page(req, res);
  }
  app(req, res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
try {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  const registration = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://shop.example.com' }, body: '{}',
  });
  assert.equal(registration.status, 503, 'Unconfigured database must return a handled JSON error, not a function crash');
  assert.equal((await registration.json()).success, false);
  assert.equal((await fetch(`${base}/api/not-a-route`)).status, 404);
  const malformed = await fetch(`${base}/page-check?slug=..`);
  assert.equal(malformed.status, 404);
  assert.equal(malformed.headers.get('x-robots-tag'), 'noindex');
  const product = await fetch(`${base}/page-check?slug=margin-portfolio`, { headers: { Accept: 'text/html' } });
  assert.equal(product.status, 200);
  assert.match(await product.text(), /Margin/i);
  // Exercise registration through the bundled API with synthetic Supabase responses.
  // The real Supabase SDK serializes these requests; no hosted account is created.
  process.env.SUPABASE_URL = 'https://synthetic.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'synthetic-anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service';
  let signupCalls = 0;
  let rateAllowed = true;
  let rejectSignup = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url || input);
    if (url === 'https://synthetic.supabase.co/rest/v1/rpc/store_operation') return Response.json(rateAllowed);
    if (url === 'https://synthetic.supabase.co/auth/v1/signup?redirect_to=https%3A%2F%2Fshop.example.com%2Flogin') {
      signupCalls++;
      const payload = JSON.parse(init.body);
      assert.equal(payload.email, 'customer@example.com');
      assert.equal(payload.data.name, 'Test Customer');
      if (rejectSignup) return Response.json({ msg: 'Signup rejected', code: 'validation_failed' }, { status: 422 });
      return Response.json({ id: 'synthetic-user', email: payload.email });
    }
    if (url.startsWith(`${base}/`)) return originalFetch(input, init);
    throw new Error('Unexpected external request in runtime check');
  };
  const register = body => fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://shop.example.com' }, body: JSON.stringify(body),
  });
  const details = { name: 'Test Customer', email: 'customer@example.com', mobile: '9876543210', password: 'synthetic-password', confirmPassword: 'synthetic-password' };
  assert.equal((await register({})).status, 400);
  assert.equal(signupCalls, 0);
  const signup = await register(details);
  assert.equal(signup.status, 201);
  assert.equal((await signup.json()).success, true);
  assert.equal(signup.headers.get('set-cookie'), null, 'Signup must wait for email confirmation');
  assert.equal(signupCalls, 1);
  rejectSignup = true;
  const rejected = await register(details);
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).success, false);
  rateAllowed = false;
  assert.equal((await register(details)).status, 429);
  assert.equal(signupCalls, 2, 'Rate limited requests must not reach Supabase Auth');
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.functions['api/index.ts'].includeFiles, 'build/api-app.mjs');
  assert.equal(config.functions['api/page.ts'].includeFiles, '{build/api-app.mjs,dist/index.html}');
  console.log('PASS: native Node API startup; health200; unconfigured503; API404; product404/200; simulated Supabase signup201, invalid400, provider rejection400, rate limit429. No hosted accounts or provider calls.');
} finally {
  globalThis.fetch = originalFetch;
  await new Promise(resolve => server.close(resolve));
}
