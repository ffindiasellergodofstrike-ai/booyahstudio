import { SUPPORTED_POLICY_SLUGS } from '../src/data/policyData';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { PRODUCTS } from '../src/data/products';
import { NEW_PRODUCTS } from '../src/data/newProducts';
import { BUSINESS } from '../src/config/business';
for (const product of PRODUCTS) {
 const page = await readFile(`dist/product/${product.slug}/index.html`, 'utf8');
 assert.ok(page.includes(`${BUSINESS.url}/product/${product.slug}`));
 assert.ok(page.includes(`content="${BUSINESS.url}${product.image}"`));
 assert.ok(page.includes('name="twitter:card" content="summary_large_image"'));
 assert.ok(page.includes(product.title.replaceAll('&','&amp;')));
 for (const [, asset] of page.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
  assert.ok((await stat(`dist${asset}`)).isFile());
 }
 assert.ok((await stat(`dist${product.image}`)).size > 1000);
 assert.ok((await readFile(`dist${product.previewUrl}index.html`,'utf8')).includes('Preview'));
}
for (const product of NEW_PRODUCTS) {
 for (const name of ['index','about','work','contact']) {
  const file=await readFile(`dist/demos/${product.id}/${name}.html`,'utf8');
  assert.ok(file.includes('template-data'));
 }
}
const root = await readdir('dist');
assert.ok(!root.some(f => f.endsWith('.mjs') || f.endsWith('.zip')), 'private server/archives must not be static output');
assert.ok(!root.includes('templates'));
const sitemap=await readFile('dist/sitemap.xml','utf8');
assert.equal((sitemap.match(/<loc>/g)||[]).length, 36);
console.log('25 product share pages, screenshots, bundles, 80 new demo pages and private-source boundaries passed.');

for (const slug of SUPPORTED_POLICY_SLUGS) {
 const html = await readFile(`dist/policies/${slug}/index.html`, 'utf8');
 assert.ok(html.includes('MANISH KUMAR SONKAR'));
 assert.ok(html.includes('<section>'), 'policy must contain crawlable text');
}
console.log('4 static policy pages contain supplied identity and readable text.');
