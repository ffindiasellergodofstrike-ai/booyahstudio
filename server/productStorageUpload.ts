import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PRODUCTS } from '../src/data/products';
import { supabaseAdmin } from './supabase';
import { MAX_PRIVATE_ZIP_BYTES, verifyStagedZipHeader } from './adminManagement';
import { verifyZipArchive } from '../scripts/package-products.mjs';

export interface ProductArchiveSyncItem {
  productId: string;
  zipFilename: string;
  localExists: boolean;
  localSizeBytes: number | null;
  sha256: string | null;
  integrityValid: boolean;
  remoteExists: boolean | null;
  remoteSizeBytes: number | null;
  status:
    | 'dry_run_ready'
    | 'dry_run_exists_skip'
    | 'dry_run_would_replace'
    | 'uploaded_verified'
    | 'skipped_existing'
    | 'error';
  verifiedRemoteSize?: number | null;
  verifiedHeader?: boolean;
  error?: string;
}

export interface ProductArchiveSyncReport {
  dryRun: boolean;
  overwrite: boolean;
  bucket: 'products';
  bucketPrivateVerified: boolean;
  totalRequested: number;
  succeeded: number;
  skippedExisting: number;
  failed: number;
  items: ProductArchiveSyncItem[];
}

/**
 * Redacts URLs, query strings, JWTs, Bearer tokens, and configured secret values
 * from any error before logging or returning to callers.
 */
export function sanitizeStorageErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as any).message)
      : String(error ?? 'Unknown storage error');

  let safe = raw
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(token|key|secret|signature|password)=[^&\s"'<>]+/gi, '$1=[REDACTED]');

  for (const envKey of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_URL', 'CASHFREE_SECRET_KEY']) {
    const val = process.env[envKey];
    if (val && val.length >= 6) {
      safe = safe.split(val).join('[REDACTED_SECRET]');
    }
  }
  return safe.slice(0, 300);
}

async function getExistingRemoteObject(bucket: any, objectPath: string): Promise<{ exists: boolean; size: number | null }> {
  const { data, error } = await bucket.info(objectPath);
  if (error) {
    const status = Number(error.status || error.statusCode);
    const code = String(error.code || '');
    const msg = String(error.message || '');
    if (
      status === 404 ||
      (status === 400 && /^object not found\.?$/i.test(msg)) ||
      ['not_found', 'NoSuchKey', 'ObjectNotFound'].includes(code)
    ) {
      return { exists: false, size: null };
    }
    throw new Error(`Storage info lookup failed: ${sanitizeStorageErrorMessage(error)}`);
  }
  if (!data) return { exists: false, size: null };
  const rawSize = data.size ?? data.metadata?.size ?? data.metadata?.contentLength;
  return {
    exists: true,
    size: Number.isFinite(Number(rawSize)) ? Number(rawSize) : null,
  };
}

/**
 * Server-only utility to validate and upload packaged product ZIP archives
 * (`private-product-uploads/<productId>.zip`) to the private `products` bucket.
 *
 * Defaults to `dryRun: true` so production uploads are never executed accidentally.
 */
export async function syncProductArchivesToSupabase(options: {
  adminUserId: string;
  dryRun?: boolean;
  overwrite?: boolean;
  productIds?: string[];
  sourceDir?: string;
  storageClient?: any;
  verifySignedHeader?: boolean;
}): Promise<ProductArchiveSyncReport> {
  if (!options?.adminUserId || typeof options.adminUserId !== 'string' || !options.adminUserId.trim()) {
    throw new Error('Administrator identity is required for product storage uploads.');
  }

  const dryRun = options.dryRun !== false;
  const overwrite = Boolean(options.overwrite);
  const sourceDir = options.sourceDir || path.resolve(process.cwd(), 'private-product-uploads');

  const activeIds = PRODUCTS.filter((p) => p.status === 'active').map((p) => p.id);
  const activeSet = new Set(activeIds);
  const targetIds = options.productIds?.length ? options.productIds : activeIds;

  for (const id of targetIds) {
    if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(id) || !activeSet.has(id)) {
      throw new Error(`Invalid or inactive product ID: ${id}`);
    }
  }

  const storage = options.storageClient || supabaseAdmin().storage;
  const bucketResult = await storage.getBucket('products');
  if (bucketResult.error || !bucketResult.data) {
    throw new Error(`Private 'products' bucket is not accessible: ${sanitizeStorageErrorMessage(bucketResult.error)}`);
  }
  if (bucketResult.data.public !== false) {
    throw new Error("Security violation: Supabase 'products' bucket must be private (public=false).");
  }

  const bucket = storage.from('products');
  const items: ProductArchiveSyncItem[] = [];
  let succeeded = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const productId of targetIds) {
    const zipFilename = `${productId}.zip`;
    const localFilePath = path.join(sourceDir, zipFilename);

    if (!fs.existsSync(localFilePath)) {
      failed++;
      items.push({
        productId,
        zipFilename,
        localExists: false,
        localSizeBytes: null,
        sha256: null,
        integrityValid: false,
        remoteExists: null,
        remoteSizeBytes: null,
        status: 'error',
        error: `Local archive missing: private-product-uploads/${zipFilename}`,
      });
      continue;
    }

    let fileBytes: Buffer;
    let sha256: string;
    try {
      fileBytes = fs.readFileSync(localFilePath);
      if (fileBytes.length < 22 || fileBytes.length > MAX_PRIVATE_ZIP_BYTES) {
        throw new Error(`Archive size (${fileBytes.length} B) is outside allowed bounds.`);
      }
      verifyZipArchive(fileBytes);
      sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');
    } catch (err) {
      failed++;
      items.push({
        productId,
        zipFilename,
        localExists: true,
        localSizeBytes: null,
        sha256: null,
        integrityValid: false,
        remoteExists: null,
        remoteSizeBytes: null,
        status: 'error',
        error: sanitizeStorageErrorMessage(err),
      });
      continue;
    }

    try {
      const existing = await getExistingRemoteObject(bucket, zipFilename);

      if (dryRun) {
        if (existing.exists && !overwrite) {
          skippedExisting++;
          items.push({
            productId,
            zipFilename,
            localExists: true,
            localSizeBytes: fileBytes.length,
            sha256,
            integrityValid: true,
            remoteExists: true,
            remoteSizeBytes: existing.size,
            status: 'dry_run_exists_skip',
          });
        } else {
          succeeded++;
          items.push({
            productId,
            zipFilename,
            localExists: true,
            localSizeBytes: fileBytes.length,
            sha256,
            integrityValid: true,
            remoteExists: existing.exists,
            remoteSizeBytes: existing.size,
            status: existing.exists ? 'dry_run_would_replace' : 'dry_run_ready',
          });
        }
        continue;
      }

      if (existing.exists && !overwrite) {
        skippedExisting++;
        items.push({
          productId,
          zipFilename,
          localExists: true,
          localSizeBytes: fileBytes.length,
          sha256,
          integrityValid: true,
          remoteExists: true,
          remoteSizeBytes: existing.size,
          status: 'skipped_existing',
        });
        continue;
      }

      const uploadRes = await bucket.upload(zipFilename, fileBytes, {
        contentType: 'application/zip',
        upsert: overwrite,
      });
      if (uploadRes.error) {
        throw new Error(`Upload failed for ${zipFilename}: ${sanitizeStorageErrorMessage(uploadRes.error)}`);
      }

      // Post-upload verification: check stored object info and exact byte length
      const verified = await getExistingRemoteObject(bucket, zipFilename);
      if (!verified.exists || (verified.size !== null && verified.size !== fileBytes.length)) {
        throw new Error(
          `Post-upload size verification failed for ${zipFilename}: expected ${fileBytes.length} B, got ${verified.size ?? 'missing'}.`
        );
      }

      let verifiedHeader = false;
      if (options.verifySignedHeader !== false && typeof bucket.createSignedUrl === 'function') {
        const signed = await bucket.createSignedUrl(zipFilename, 30);
        if (signed.error || !signed.data?.signedUrl) {
          throw new Error(`Could not sign uploaded archive ${zipFilename} for header verification.`);
        }
        await verifyStagedZipHeader(signed.data.signedUrl);
        verifiedHeader = true;
      }

      succeeded++;
      items.push({
        productId,
        zipFilename,
        localExists: true,
        localSizeBytes: fileBytes.length,
        sha256,
        integrityValid: true,
        remoteExists: existing.exists,
        remoteSizeBytes: existing.size,
        status: 'uploaded_verified',
        verifiedRemoteSize: verified.size ?? fileBytes.length,
        verifiedHeader,
      });
    } catch (err) {
      failed++;
      items.push({
        productId,
        zipFilename,
        localExists: true,
        localSizeBytes: fileBytes.length,
        sha256,
        integrityValid: true,
        remoteExists: null,
        remoteSizeBytes: null,
        status: 'error',
        error: sanitizeStorageErrorMessage(err),
      });
    }
  }

  return {
    dryRun,
    overwrite,
    bucket: 'products',
    bucketPrivateVerified: true,
    totalRequested: targetIds.length,
    succeeded,
    skippedExisting,
    failed,
    items,
  };
}
