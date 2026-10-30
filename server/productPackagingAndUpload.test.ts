import 'express-async-errors';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { once } from 'node:events';
import { PRODUCTS } from '../src/data/products';
import {
  packageAllProducts,
  verifyZipArchive,
  isExcludedMemberPath,
} from '../scripts/package-products.mjs';
import {
  syncProductArchivesToSupabase,
  sanitizeStorageErrorMessage,
} from './productStorageUpload';
import { adminManagementRouter } from './adminManagement';
import { AuditLogger } from './audit';
import { cashfreeConfig } from './cashfree';

test('product packaging generates all 25 active product ZIPs with verified CRC-32 and excludes sensitive files', () => {
  assert.equal(isExcludedMemberPath('.env'), true);
  assert.equal(isExcludedMemberPath('.env.example'), true);
  assert.equal(isExcludedMemberPath('.git/config'), true);
  assert.equal(isExcludedMemberPath('.gitignore'), true);
  assert.equal(isExcludedMemberPath('node_modules/react/index.js'), true);
  assert.equal(isExcludedMemberPath('secrets/service-account.json'), true);
  assert.equal(isExcludedMemberPath('src/App.tsx'), false);
  assert.equal(isExcludedMemberPath('index.html'), false);

  const report = packageAllProducts();
  const activeProducts = PRODUCTS.filter((p) => p.status === 'active');
  assert.equal(report.totalProducts, 25);
  assert.equal(activeProducts.length, 25);

  const byId = new Map(report.products.map((item: any) => [item.productId, item]));
  for (const product of activeProducts) {
    const entry: any = byId.get(product.id);
    assert.ok(entry, `Missing packaged entry for ${product.id}`);
    assert.equal(entry.zipFilename, `${product.id}.zip`);
    const diskPath = path.resolve(process.cwd(), entry.outputPath);
    assert.equal(fs.existsSync(diskPath), true, `Expected ${diskPath} on disk`);
    const bytes = fs.readFileSync(diskPath);
    assert.equal(bytes.length, entry.sizeBytes);
    const verification = verifyZipArchive(bytes);
    assert.equal(verification.valid, true);
    assert.equal(verification.fileCount, entry.fileCount);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  }
});

test('Supabase product ZIP upload utility enforces private bucket, dry-run, existing-file detection, upload verification, and secret redaction', async (t) => {
  const prevServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevUrl = process.env.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.supersecretpayload.signature123';
  process.env.SUPABASE_URL = 'https://private-store.synthetic.supabase.co';
  t.after(() => {
    if (prevServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceRole;
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
  });

  const leakedMessage = `Failed at ${process.env.SUPABASE_URL}/storage/v1/object/products?token=secret123 with key ${process.env.SUPABASE_SERVICE_ROLE_KEY} Bearer my-secret-token`;
  const redacted = sanitizeStorageErrorMessage(new Error(leakedMessage));
  assert.ok(!redacted.includes('supersecretpayload'));
  assert.ok(!redacted.includes('secret123'));
  assert.ok(!redacted.includes('my-secret-token'));
  assert.ok(!redacted.includes('private-store.synthetic.supabase.co'));

  // Rejects public bucket
  const publicStorageMock = {
    getBucket: async () => ({ data: { id: 'products', public: true }, error: null }),
    from: () => ({}),
  };
  await assert.rejects(
    syncProductArchivesToSupabase({
      adminUserId: 'owner',
      dryRun: true,
      productIds: ['learnify'],
      storageClient: publicStorageMock,
    }),
    /must be private/
  );

  // Tracks remote files in synthetic private bucket
  const remoteObjects = new Map<string, Uint8Array>();
  let uploadCalls = 0;

  const privateStorageMock = {
    getBucket: async (id: string) => {
      assert.equal(id, 'products');
      return { data: { id: 'products', public: false }, error: null };
    },
    from: (bucketId: string) => {
      assert.equal(bucketId, 'products');
      return {
        info: async (name: string) => {
          const existing = remoteObjects.get(name);
          if (!existing) return { data: null, error: { status: 404, code: 'not_found', message: 'Object not found' } };
          return { data: { name, size: existing.byteLength }, error: null };
        },
        upload: async (name: string, bytes: Buffer, opts: any) => {
          uploadCalls++;
          assert.equal(opts.contentType, 'application/zip');
          remoteObjects.set(name, new Uint8Array(bytes));
          return { data: { path: name }, error: null };
        },
      };
    },
  };

  // 1. Dry-run for all 25 products performs zero uploads
  const dryReport = await syncProductArchivesToSupabase({
    adminUserId: 'owner',
    dryRun: true,
    storageClient: privateStorageMock,
    verifySignedHeader: false,
  });
  assert.equal(dryReport.dryRun, true);
  assert.equal(dryReport.totalRequested, 25);
  assert.equal(dryReport.succeeded, 25);
  assert.equal(dryReport.failed, 0);
  assert.equal(uploadCalls, 0);

  // 2. Live upload for 2 products uploads and verifies size
  const liveReport = await syncProductArchivesToSupabase({
    adminUserId: 'owner',
    dryRun: false,
    overwrite: false,
    productIds: ['learnify', 'margin-portfolio'],
    storageClient: privateStorageMock,
    verifySignedHeader: false,
  });
  assert.equal(liveReport.dryRun, false);
  assert.equal(liveReport.succeeded, 2);
  assert.equal(liveReport.skippedExisting, 0);
  assert.equal(uploadCalls, 2);
  assert.equal(remoteObjects.has('learnify.zip'), true);
  assert.equal(remoteObjects.has('margin-portfolio.zip'), true);

  // 3. Re-running with overwrite=false detects existing files and skips them
  const skipReport = await syncProductArchivesToSupabase({
    adminUserId: 'owner',
    dryRun: false,
    overwrite: false,
    productIds: ['learnify', 'margin-portfolio'],
    storageClient: privateStorageMock,
    verifySignedHeader: false,
  });
  assert.equal(skipReport.succeeded, 0);
  assert.equal(skipReport.skippedExisting, 2);
  assert.equal(uploadCalls, 2, 'No extra uploads when existing files are skipped');

  // 4. Admin HTTP route requires admin role
  t.mock.method(AuditLogger, 'log', async () => ({}));
  const app = express();
  app.use(express.json());
  app.use(
    '/api/admin',
    (req: any, res, next) => {
      if (req.get('x-admin') !== 'owner') return res.status(403).json({ success: false });
      req.userId = 'owner';
      next();
    },
    adminManagementRouter
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/admin`;

  const unauthRes = await fetch(`${base}/products/bulk-upload-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun: true, reason: 'Unauthenticated attempt' }),
  });
  assert.equal(unauthRes.status, 403);
});

test('Cashfree environment configuration accepts uppercase SANDBOX and PRODUCTION values safely', () => {
  const prev = process.env.CASHFREE_ENV;
  try {
    process.env.CASHFREE_ENV = 'SANDBOX';
    assert.equal(cashfreeConfig().mode, 'sandbox');
    assert.equal(cashfreeConfig().environment, 'test');
    process.env.CASHFREE_ENV = 'PRODUCTION';
    assert.equal(cashfreeConfig().mode, 'production');
    assert.equal(cashfreeConfig().environment, 'live');
    process.env.CASHFREE_ENV = 'invalid_env';
    assert.throws(() => cashfreeConfig(), /CASHFREE_ENV must be sandbox or production/);
  } finally {
    if (prev === undefined) delete process.env.CASHFREE_ENV;
    else process.env.CASHFREE_ENV = prev;
  }
});
