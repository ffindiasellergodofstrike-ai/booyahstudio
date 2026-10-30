import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Canonical mapping for the 5 flagship products whose original source archives live in `demofiles/`.
 * The remaining 20 active products are packaged from `templates/<productId>/`.
 */
export const DEMOFILES_SOURCE_MAP = Object.freeze({
  'linknest-pro': 'demofiles/LinkNest-Pro-Creator-Commerce-Kit.zip',
  'neura-ai': 'demofiles/neuraai.zip',
  'finora': 'demofiles/finora.zip',
  'learnify': 'demofiles/learnify.zip',
  'velora': 'demofiles/velora.zip',
});

/**
 * Returns true if a relative POSIX archive member path is an environment file,
 * Git metadata file, credential/key file, OS artifact, or development dependency directory.
 */
export function isExcludedMemberPath(posixPath) {
  const normalized = String(posixPath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.endsWith('/')) return true;
  const segments = normalized.split('/');
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (
      lower === '.git' ||
      lower === '.github' ||
      lower === '.gitignore' ||
      lower === '.gitattributes' ||
      lower === '.gitmodules' ||
      lower === 'node_modules' ||
      lower === '.ds_store' ||
      lower === 'thumbs.db' ||
      lower === '.npmrc' ||
      lower.startsWith('.yarnrc') ||
      lower === '.env' ||
      lower.startsWith('.env.')
    ) {
      return true;
    }
  }
  const base = path.posix.basename(normalized).toLowerCase();
  if (
    base.endsWith('.pem') ||
    base.endsWith('.key') ||
    base.endsWith('.p12') ||
    base.endsWith('.pfx') ||
    base.includes('credentials') ||
    base.includes('service-account') ||
    base.includes('secret')
  ) {
    return true;
  }
  return false;
}

// Precompute IEEE 802.3 CRC-32 lookup table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Reads all file entries from an existing ZIP buffer using the Central Directory,
 * verifying each member's CRC-32 and returning [{ name, data }].
 */
export function readZipEntries(zipBuffer) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length < 22) {
    throw new Error('Invalid ZIP buffer: too short.');
  }
  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  const minEocdOffset = Math.max(0, zipBuffer.length - 65557);
  for (let i = zipBuffer.length - 22; i >= minEocdOffset; i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP archive: End of Central Directory not found.');
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralDirSize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  if (centralDirOffset + centralDirSize > eocdOffset) {
    throw new Error('Invalid ZIP archive: Central Directory bounds exceed EOCD offset.');
  }

  const entries = [];
  let ptr = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (zipBuffer.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error(`Invalid Central Directory header signature at offset ${ptr}.`);
    }
    const compressionMethod = zipBuffer.readUInt16LE(ptr + 10);
    const expectedCrc = zipBuffer.readUInt32LE(ptr + 16);
    const compressedSize = zipBuffer.readUInt32LE(ptr + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(ptr + 24);
    const fileNameLen = zipBuffer.readUInt16LE(ptr + 28);
    const extraLen = zipBuffer.readUInt16LE(ptr + 30);
    const commentLen = zipBuffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(ptr + 42);

    const name = zipBuffer.subarray(ptr + 46, ptr + 46 + fileNameLen).toString('utf8');
    ptr += 46 + fileNameLen + extraLen + commentLen;

    if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid Local File Header signature for ${name}.`);
    }
    const localNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize);

    if (name.endsWith('/')) {
      continue;
    }

    let data;
    if (compressionMethod === 0) {
      data = Buffer.from(compressedData);
    } else if (compressionMethod === 8) {
      data = zlib.inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported ZIP compression method ${compressionMethod} in ${name}.`);
    }

    if (data.length !== uncompressedSize) {
      throw new Error(`Uncompressed size mismatch for ${name}: expected ${uncompressedSize}, got ${data.length}.`);
    }
    const actualCrc = crc32(data);
    if (actualCrc !== expectedCrc) {
      throw new Error(`CRC-32 mismatch for ${name}: expected ${expectedCrc.toString(16)}, got ${actualCrc.toString(16)}.`);
    }

    entries.push({ name: name.replace(/\\/g, '/'), data });
  }
  return entries;
}

/**
 * Builds a deterministic PKZIP 2.0 archive Buffer from [{ name, data }].
 * Uses fixed DOS timestamp (1980-01-01 00:00:00) so SHA-256 hashes are reproducible.
 */
export function createDeterministicZip(files) {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  // Fixed DOS time/date: 1980-01-01 00:00:00 -> time = 0x0000, date = 0x0021
  const dosTime = 0x0000;
  const dosDate = 0x0021;

  for (const file of sorted) {
    const cleanName = file.name.replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBuf = Buffer.from(cleanName, 'utf8');
    const uncompressed = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const entryCrc = crc32(uncompressed);
    const deflated = zlib.deflateRawSync(uncompressed, { level: 9 });
    const useStore = deflated.length >= uncompressed.length;
    const method = useStore ? 0 : 8;
    const payload = useStore ? uncompressed : deflated;

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // UTF-8 flag
    localHeader.writeUInt16LE(method, 8);     // compression method
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(entryCrc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // extra length

    localParts.push(localHeader, nameBuf, payload);

    // Central directory header (46 bytes + name)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4);         // version made by
    centralHeader.writeUInt16LE(20, 6);         // version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // UTF-8 flag
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(entryCrc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // extra length
    centralHeader.writeUInt16LE(0, 32);         // comment length
    centralHeader.writeUInt16LE(0, 34);         // disk number
    centralHeader.writeUInt16LE(0, 36);         // internal attrs
    centralHeader.writeUInt32LE(0, 38);         // external attrs
    centralHeader.writeUInt32LE(localOffset, 42);

    centralParts.push(centralHeader, nameBuf);
    localOffset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralDirBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(sorted.length, 8);
  eocd.writeUInt16LE(sorted.length, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuffer, eocd]);
}

/**
 * Verifies a generated product ZIP archive:
 * 1. Valid PKZIP local header + EOCD + Central Directory structure
 * 2. Every entry inflates cleanly and matches its CRC-32 and uncompressed size
 * 3. Contains at least 1 file and zero excluded credential/env/Git/node_modules paths
 */
export function verifyZipArchive(zipBuffer) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length < 22) {
    throw new Error('Archive is empty or smaller than minimum ZIP size.');
  }
  if (
    zipBuffer[0] !== 0x50 ||
    zipBuffer[1] !== 0x4b ||
    zipBuffer[2] !== 0x03 ||
    zipBuffer[3] !== 0x04
  ) {
    throw new Error('Archive does not start with PK\\x03\\x04 signature.');
  }
  const entries = readZipEntries(zipBuffer);
  if (entries.length === 0) {
    throw new Error('Archive contains zero files.');
  }
  for (const entry of entries) {
    if (isExcludedMemberPath(entry.name)) {
      throw new Error(`Archive contains forbidden path: ${entry.name}`);
    }
  }
  return {
    valid: true,
    fileCount: entries.length,
    memberNames: entries.map((e) => e.name),
  };
}

function collectDirectoryFiles(dirPath, baseDir = dirPath) {
  const collected = [];
  const excluded = [];
  for (const dirent of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, dirent.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (dirent.isDirectory()) {
      if (isExcludedMemberPath(`${relPath}/placeholder`)) {
        excluded.push(`${relPath}/`);
        continue;
      }
      const sub = collectDirectoryFiles(fullPath, baseDir);
      collected.push(...sub.collected);
      excluded.push(...sub.excluded);
    } else if (dirent.isFile()) {
      if (isExcludedMemberPath(relPath)) {
        excluded.push(relPath);
        continue;
      }
      collected.push({
        name: relPath,
        data: fs.readFileSync(fullPath),
      });
    }
  }
  return { collected, excluded };
}

export function packageAllProducts(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const outDir = options.outDir || path.join(rootDir, 'private-product-uploads');
  fs.mkdirSync(outDir, { recursive: true });

  const collectionPath = path.join(rootDir, 'templates', 'collection.json');
  const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  const templateIds = collection.map((item) => item.id);
  const flagshipIds = Object.keys(DEMOFILES_SOURCE_MAP);
  const allProductIds = [...flagshipIds, ...templateIds];

  if (allProductIds.length !== 25) {
    throw new Error(`Expected 25 active products, found ${allProductIds.length}.`);
  }

  const inventory = [];

  for (const productId of allProductIds) {
    let sourceRelPath;
    let sourceType;
    let filesToPackage = [];
    let excludedRemoved = [];

    if (Object.prototype.hasOwnProperty.call(DEMOFILES_SOURCE_MAP, productId)) {
      sourceRelPath = DEMOFILES_SOURCE_MAP[productId];
      sourceType = 'demofiles_archive';
      let fullSourcePath = path.join(rootDir, sourceRelPath);
      if (!fs.existsSync(fullSourcePath)) {
        const fallbackPath = path.join(rootDir, 'private-product-uploads', `${productId}.zip`);
        if (fs.existsSync(fallbackPath)) {
          fullSourcePath = fallbackPath;
          sourceRelPath = `private-product-uploads/${productId}.zip`;
        } else {
          throw new Error(`Missing source archive for ${productId}: ${sourceRelPath}`);
        }
      }
      const rawEntries = readZipEntries(fs.readFileSync(fullSourcePath));
      for (const entry of rawEntries) {
        if (isExcludedMemberPath(entry.name)) {
          excludedRemoved.push(entry.name);
        } else {
          filesToPackage.push(entry);
        }
      }
    } else {
      sourceRelPath = `templates/${productId}`;
      sourceType = 'template_directory';
      const fullSourcePath = path.join(rootDir, sourceRelPath);
      if (!fs.existsSync(fullSourcePath)) {
        throw new Error(`Missing template directory for ${productId}: ${sourceRelPath}`);
      }
      const { collected, excluded } = collectDirectoryFiles(fullSourcePath);
      filesToPackage = collected;
      excludedRemoved = excluded;
      if (!filesToPackage.some((f) => f.name === 'LICENSE.txt')) {
        throw new Error(`Template ${productId} is missing LICENSE.txt.`);
      }
    }

    const zipFilename = `${productId}.zip`;
    const destPath = path.join(outDir, zipFilename);
    const zipBuffer = createDeterministicZip(filesToPackage);
    fs.writeFileSync(destPath, zipBuffer);

    // Re-read from disk to verify persisted bytes
    const persistedBytes = fs.readFileSync(destPath);
    const verification = verifyZipArchive(persistedBytes);
    const sha256 = crypto.createHash('sha256').update(persistedBytes).digest('hex');

    inventory.push({
      productId,
      sourcePath: sourceRelPath,
      sourceType,
      zipFilename,
      outputPath: path.relative(rootDir, destPath).replace(/\\/g, '/'),
      sizeBytes: persistedBytes.length,
      fileCount: verification.fileCount,
      excludedFilesRemoved: excludedRemoved,
      integrity: 'PASS (PKZIP header, Central Directory, inflate & CRC-32 verified)',
      sha256,
    });
  }

  const inventoryReport = {
    generatedAt: new Date().toISOString(),
    totalProducts: inventory.length,
    bucket: 'products',
    bucketVisibility: 'private',
    products: inventory,
  };

  fs.writeFileSync(
    path.join(outDir, 'product-inventory.json'),
    JSON.stringify(inventoryReport, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'upload-manifest.json'),
    JSON.stringify(
      inventory.map((item) => ({
        productId: item.productId,
        file: item.zipFilename,
        sourcePath: item.sourcePath,
        sizeBytes: item.sizeBytes,
        bucket: 'products (private)',
        integrity: item.integrity,
        sha256: item.sha256,
      })),
      null,
      2
    ) + '\n',
    'utf8'
  );

  return inventoryReport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const report = packageAllProducts();
  console.log(`Successfully packaged and verified ${report.totalProducts} product ZIP archives in private-product-uploads/.`);
  for (const item of report.products) {
    console.log(
      `  - ${item.zipFilename.padEnd(24)} | source: ${item.sourcePath.padEnd(46)} | files: ${String(item.fileCount).padStart(2)} | size: ${String(item.sizeBytes).padStart(7)} B | sha256: ${item.sha256}`
    );
  }
}
