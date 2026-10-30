import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { verifyZipArchive, packageAllProducts } from './package-products.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MAX_PRIVATE_ZIP_BYTES = 50 * 1024 * 1024;

export function redactError(error) {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  let safe = raw
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(token|key|secret|signature|password)=[^&\s"'<>]+/gi, '$1=[REDACTED]');
  for (const envKey of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_URL']) {
    const val = process.env[envKey];
    if (val && val.length >= 6) safe = safe.split(val).join('[REDACTED_SECRET]');
  }
  return safe.slice(0, 300);
}

/**
 * CLI & programmatic utility for verifying and uploading the 25 packaged product ZIPs
 * to the private Supabase `products` bucket.
 *
 * Defaults to dry-run (`--dry-run`) unless `--execute` is explicitly passed.
 */
export async function runProductZipUploadCli(args = process.argv.slice(2)) {
  const execute = args.includes('--execute');
  const dryRun = !execute || args.includes('--dry-run');
  const overwrite = args.includes('--overwrite');
  const sourceDir = path.join(ROOT_DIR, 'private-product-uploads');

  if (!fs.existsSync(path.join(sourceDir, 'product-inventory.json'))) {
    packageAllProducts({ rootDir: ROOT_DIR, outDir: sourceDir });
  }

  const inventory = JSON.parse(fs.readFileSync(path.join(sourceDir, 'product-inventory.json'), 'utf8'));
  const results = [];

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const hasRemoteCredentials = Boolean(supabaseUrl && serviceRoleKey);

  let storage = null;
  let bucketPrivateVerified = false;

  if (hasRemoteCredentials) {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    storage = client.storage;
    const bucketCheck = await storage.getBucket('products');
    if (bucketCheck.error || !bucketCheck.data) {
      throw new Error(`Private 'products' bucket check failed: ${redactError(bucketCheck.error)}`);
    }
    if (bucketCheck.data.public !== false) {
      throw new Error("Security violation: Supabase 'products' bucket must be private (public=false).");
    }
    bucketPrivateVerified = true;
  } else if (!dryRun) {
    throw new Error('Cannot execute live Supabase Storage upload: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.');
  }

  const bucket = storage ? storage.from('products') : null;

  for (const entry of inventory.products) {
    const zipFilename = entry.zipFilename;
    const filePath = path.join(sourceDir, zipFilename);
    const bytes = fs.readFileSync(filePath);

    if (bytes.length < 22 || bytes.length > MAX_PRIVATE_ZIP_BYTES) {
      throw new Error(`Archive ${zipFilename} size (${bytes.length} B) is out of allowed bounds.`);
    }
    verifyZipArchive(bytes);
    const actualSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (actualSha256 !== entry.sha256) {
      throw new Error(`Checksum mismatch for ${zipFilename}: expected ${entry.sha256}, got ${actualSha256}`);
    }

    let remoteExists = null;
    let remoteSize = null;
    if (bucket) {
      const infoRes = await bucket.info(zipFilename);
      if (!infoRes.error && infoRes.data) {
        remoteExists = true;
        remoteSize = Number(infoRes.data.size ?? infoRes.data.metadata?.size ?? null);
      } else {
        const status = Number(infoRes.error?.status || infoRes.error?.statusCode);
        if (status === 404 || status === 400 || ['not_found', 'NoSuchKey', 'ObjectNotFound'].includes(String(infoRes.error?.code || ''))) {
          remoteExists = false;
        } else if (infoRes.error) {
          throw new Error(`Existing-file lookup failed for ${zipFilename}: ${redactError(infoRes.error)}`);
        }
      }
    }

    if (dryRun) {
      results.push({
        productId: entry.productId,
        zipFilename,
        sizeBytes: bytes.length,
        sha256: actualSha256,
        remoteExists,
        remoteSize,
        action: remoteExists && !overwrite ? 'SKIP_EXISTING (dry-run)' : remoteExists && overwrite ? 'REPLACE_EXISTING (dry-run)' : 'UPLOAD_TO_PRIVATE_PRODUCTS_BUCKET (dry-run)',
      });
      continue;
    }

    if (remoteExists && !overwrite) {
      results.push({
        productId: entry.productId,
        zipFilename,
        sizeBytes: bytes.length,
        sha256: actualSha256,
        remoteExists: true,
        remoteSize,
        action: 'SKIPPED_EXISTING',
      });
      continue;
    }

    const up = await bucket.upload(zipFilename, bytes, {
      contentType: 'application/zip',
      upsert: overwrite,
    });
    if (up.error) {
      throw new Error(`Upload failed for ${zipFilename}: ${redactError(up.error)}`);
    }

    const verifyInfo = await bucket.info(zipFilename);
    const verifiedSize = Number(verifyInfo.data?.size ?? verifyInfo.data?.metadata?.size ?? bytes.length);
    if (verifyInfo.error || !verifyInfo.data || verifiedSize !== bytes.length) {
      throw new Error(`Upload verification failed for ${zipFilename}: remote size ${verifiedSize} != local ${bytes.length}`);
    }

    results.push({
      productId: entry.productId,
      zipFilename,
      sizeBytes: bytes.length,
      sha256: actualSha256,
      remoteExists,
      remoteSize: verifiedSize,
      action: 'UPLOADED_AND_VERIFIED',
    });
  }

  return {
    mode: dryRun ? 'DRY_RUN' : 'LIVE_UPLOAD',
    bucket: 'products (private)',
    remoteCredentialsConfigured: hasRemoteCredentials,
    bucketPrivateVerified,
    totalArchives: results.length,
    results,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runProductZipUploadCli()
    .then((summary) => {
      console.log(`Mode: ${summary.mode} | Bucket: ${summary.bucket} | Remote Configured: ${summary.remoteCredentialsConfigured} | Archives Checked: ${summary.totalArchives}`);
      for (const r of summary.results) {
        console.log(`  - ${r.zipFilename.padEnd(24)} | ${String(r.sizeBytes).padStart(7)} B | sha256: ${r.sha256.slice(0, 16)}... | ${r.action}`);
      }
    })
    .catch((err) => {
      console.error(`Product ZIP upload utility error: ${redactError(err)}`);
      process.exitCode = 1;
    });
}
