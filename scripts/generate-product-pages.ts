import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PRODUCTS, CATEGORIES } from '../src/data/products';
import { getSEOPageData, injectSEOMetadata, BASE_URL } from '../src/seo/seoMetadata';

async function generateBuildAssets() {
  const shell = await readFile('dist/index.html', 'utf8');

  const policySlugs = ['terms', 'privacy', 'refund', 'cancellation', 'delivery', 'chargebacks', 'grievance', 'license'];

  const publicRoutes = [
    '/',
    '/products',
    '/about',
    '/contact',
    '/faq',
    '/search',
    ...policySlugs.map((p) => `/policies/${p}`),
    ...CATEGORIES.map((c) => `/category/${c.slug}`),
    ...PRODUCTS.map((p) => `/product/${p.slug}`),
  ];

  // Pre-render static HTML pages for crawlers and direct visits
  for (const route of publicRoutes) {
    const pageData = getSEOPageData(route);
    const renderedHtml = injectSEOMetadata(shell, pageData);

    if (route === '/') {
      await writeFile('dist/index.html', renderedHtml);
    } else {
      const dirPath = `dist${route}`;
      await mkdir(dirPath, { recursive: true });
      await writeFile(`${dirPath}/index.html`, renderedHtml);
    }
  }

  // Generate sitemap.xml
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes.map((route) => `  <url><loc>${BASE_URL}${route === '/' ? '/' : route}</loc></url>`).join('\n')}
</urlset>`;

  await writeFile('dist/sitemap.xml', sitemapXml);

  // Generate robots.txt
  const robotsTxt = `User-agent: *
Disallow: /admin
Disallow: /account
Disallow: /checkout
Disallow: /cart
Disallow: /api/
Disallow: /.data/

Sitemap: ${BASE_URL}/sitemap.xml
`;

  await writeFile('dist/robots.txt', robotsTxt);

  console.log(`Successfully pre-rendered metadata for ${publicRoutes.length} public canonical pages, sitemap.xml, and robots.txt.`);
}

generateBuildAssets().catch((err) => {
  console.error('Error generating pre-rendered build assets:', err);
  process.exit(1);
});
