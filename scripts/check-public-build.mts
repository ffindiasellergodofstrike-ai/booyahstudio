import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export function checkPublicBuild() {
  const distDir = path.join(ROOT_DIR, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ directory not found. Run vite build first.');
  }

  const allFiles = walkDir(distDir);
  const forbiddenRegex = /booyah.?pay|garena.?checkout|codashop|official top up center|instant diamond credit/i;

  for (const filePath of allFiles) {
    const relPath = path.relative(distDir, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();

    // 1. No leaked source, source map, or cjs files
    if (['.map', '.ts', '.tsx', '.cjs'].includes(ext)) {
      throw new Error(`SECURITY ERROR: Leaked forbidden file type in dist/: ${relPath}`);
    }

    // 2. Check filename
    if (forbiddenRegex.test(relPath)) {
      throw new Error(`SECURITY ERROR: Forbidden term in dist filename: ${relPath}`);
    }

    // 3. Check file content for HTML, JS, CSS
    if (['.html', '.js', '.css', '.xml', '.txt'].includes(ext)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (forbiddenRegex.test(content)) {
        throw new Error(`SECURITY ERROR: Forbidden checkout/game term found inside dist file: ${relPath}`);
      }
    }
  }

  // 4. Check sitemap.xml and robots.txt specifically for /booyahpay or aliases
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
    if (/booyahpay/i.test(sitemapContent)) {
      throw new Error('SECURITY ERROR: /booyahpay leaked into sitemap.xml');
    }
  }

  const robotsPath = path.join(distDir, 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    const robotsContent = fs.readFileSync(robotsPath, 'utf8');
    if (/booyahpay/i.test(robotsContent)) {
      throw new Error('SECURITY ERROR: /booyahpay leaked into robots.txt');
    }
  }

  console.log('PASS: Public build verification successfully confirmed zero leakage of private checkout or game terms in dist/.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    checkPublicBuild();
  } catch (err: any) {
    console.error(err.message || err);
    process.exit(1);
  }
}
