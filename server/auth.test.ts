import assert from 'node:assert/strict';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import { AuthServiceServer } from './auth';
import { FirebaseRtdb } from './firebaseRtdb';

test('password reset uses the registered email and mobile number and revokes old sessions', async (context) => {
  const email = 'buyer@example.test';
  const mobile = '9876543210';
  const writes: string[] = [];
  context.mock.method(FirebaseRtdb, 'findUserIdByIdentifier', async () => 'buyer');
  context.mock.method(FirebaseRtdb, 'getUserProfile', async () => ({ email, mobile }));
  context.mock.method(FirebaseRtdb, 'updatePasswordHash', async () => { writes.push('password'); return true; });
  context.mock.method(FirebaseRtdb, 'updateUserProfile', async () => { writes.push('revoke-sessions'); return {}; });

  const payload = { email, mobile, newPassword: 'new-secret-password', confirmNewPassword: 'new-secret-password' };
  assert.equal((await AuthServiceServer.resetPasswordWithEmailAndMobile({ ...payload, mobile: '9876543211' })).success, false);
  assert.deepEqual(writes, []);
  assert.equal((await AuthServiceServer.resetPasswordWithEmailAndMobile(payload)).success, true);
  assert.deepEqual(writes, ['password', 'revoke-sessions']);
});

test('old sessions are rejected after password reset', async (context) => {
  context.mock.method(FirebaseRtdb, 'get', async () => ({
    userId: 'buyer', email: 'buyer@example.test', username: 'buyer',
    createdAt: '2026-09-20T00:00:00.000Z', expiresAt: Date.now() + 60_000,
  }));
  context.mock.method(FirebaseRtdb, 'getUserProfile', async () => ({ sessionValidAfter: Date.now() }));
  assert.equal(await AuthServiceServer.verifyOpaqueSession('synthetic-session'), null);
});

test('forgot-password HTTP route accepts the direct email and mobile reset', async (context) => {
  const { app } = await import('./app');
  const calls: any[] = [];
  context.mock.method(FirebaseRtdb, 'get', async () => null);
  context.mock.method(FirebaseRtdb, 'set', async () => undefined);
  context.mock.method(AuthServiceServer, 'resetPasswordWithEmailAndMobile', async (payload: any) => {
    calls.push(payload);
    return { success: true, message: 'Password reset successfully.' };
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const response = await fetch(`${base}/api/auth/forgot-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'buyer@example.test', mobile: '9876543210',
      newPassword: 'new-secret-password', confirmNewPassword: 'new-secret-password',
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    email: 'buyer@example.test', mobile: '9876543210',
    newPassword: 'new-secret-password', confirmNewPassword: 'new-secret-password',
  });
  assert.equal((await fetch(`${base}/api/auth/reset-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })).status, 404);
});
