import assert from 'node:assert/strict';
import test from 'node:test';
import { safeCsvCell } from './adminRoutes';
import { adminRouter } from './adminRoutes';
import { FirebaseRtdb } from './firebaseRtdb';
import { AuditLogger } from './audit';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

test('admin CSV export escapes quotes and spreadsheet formulas in customer input', () => {
  assert.equal(safeCsvCell('Buyer "One"'), '"Buyer ""One"""');
  assert.equal(safeCsvCell('=HYPERLINK("https://example.test")'), '"\'=HYPERLINK(""https://example.test"")"');
  assert.equal(safeCsvCell('  +1+2'), '"\'  +1+2"');
  assert.equal(safeCsvCell('normal@example.test'), '"normal@example.test"');
});

test('admin revenue uses verified payment time and real daily totals', async (context) => {
  context.mock.method(FirebaseRtdb, 'getAllGlobalOrders', async () => [{
    paymentStatus: 'PAID', paymentEnvironment: 'live', total: 500,
    createdAt: '2026-01-01T00:00:00.000Z', paymentVerifiedAt: new Date().toISOString(),
  }]);
  context.mock.method(FirebaseRtdb, 'getAllProducts', async () => []);
  context.mock.method(FirebaseRtdb, 'getAllUsers', async () => []);
  context.mock.method(AuditLogger, 'getAllLogs', async () => []);
  const app = express();
  app.use(adminRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/dashboard/stats`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.stats.revenue.today, 500);
  assert.equal(payload.stats.revenue.last30d, 500);
  assert.equal(payload.stats.revenue.daily.at(-1).revenue, 500);
});
