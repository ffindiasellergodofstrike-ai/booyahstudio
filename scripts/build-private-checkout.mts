import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export async function buildPrivateCheckout() {
  const outDir = path.join(ROOT_DIR, 'build', 'private-checkout');
  fs.mkdirSync(outDir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(ROOT_DIR, 'private', 'checkout', 'main.tsx')],
    bundle: true,
    outfile: path.join(outDir, 'checkout.js'),
    format: 'iife',
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
  });

  console.log('Successfully built private checkout bundle at build/private-checkout/checkout.js');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  buildPrivateCheckout().catch(err => {
    console.error('Private checkout build failed:', err);
    process.exit(1);
  });
}
