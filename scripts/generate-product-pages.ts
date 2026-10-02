import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PRODUCTS } from '../src/data/products';
import { BUSINESS } from '../src/config/business';
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const shell = await readFile('dist/index.html', 'utf8');
for (const product of PRODUCTS) {
  const url = `${BUSINESS.url}/product/${product.slug}`;
  const title = `${product.title} | ${BUSINESS.name}`;
  const image = new URL(product.image, BUSINESS.url).href;
  let page = shell.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta\s+(?:name|property)="(?:description|og:[^"]*|twitter:[^"]*)"[\s\S]*?\/?>/g, '')
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  // Crawlers receive product metadata without executing React.
  const metadata = `<meta name="description" content="${escape(product.shortDescription)}" />
<meta property="og:type" content="website" /><meta property="og:site_name" content="${BUSINESS.name}" />
<meta property="og:title" content="${escape(title)}" /><meta property="og:description" content="${escape(product.shortDescription)}" />
<meta property="og:url" content="${url}" /><meta property="og:image" content="${image}" /><meta property="og:image:alt" content="${escape(product.title)} preview" />
<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${escape(title)}" />
<meta name="twitter:description" content="${escape(product.shortDescription)}" /><meta name="twitter:image" content="${image}" />`;
  page = page.replace('</head>', `${metadata}\n</head>`);
  const directory = `dist/product/${product.slug}`;
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/index.html`, page);
}
const paths = ['/', '/products', '/about', '/contact', '/policies', ...['terms','privacy','refund','cancellation','shipping-delivery','grievance'].map(p=>`/policies/${p}`), ...PRODUCTS.map(p=>`/product/${p.slug}`)];
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path=>`<url><loc>${BUSINESS.url}${path}</loc></url>`).join('')}</urlset>`);
console.log(`Generated ${PRODUCTS.length} static product share pages and sitemap.`);
