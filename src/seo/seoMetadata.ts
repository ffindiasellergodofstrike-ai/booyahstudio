import { PRODUCTS, CATEGORIES } from '../data/products';
import { policyData, POLICY_REDIRECTS, type SupportedPolicySlug } from '../data/policyData';
import { BUSINESS } from '../config/business';

export { POLICY_REDIRECTS, policyData };

export interface SEOPageData {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage: string;
  ogImageAlt: string;
  ogType: 'website' | 'product' | 'article';
  noindex: boolean;
  statusCode?: number;
  jsonLd: object[];
}

export const BASE_URL = 'https://www.booyahstudio.shop';
export const DEFAULT_OG_IMAGE = `${BASE_URL}/images/og-share-booyah.png`;

export const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  'name': BUSINESS.name,
  'legalName': BUSINESS.legalName,
  'taxID': BUSINESS.gstin,
  'url': BASE_URL,
  'logo': `${BASE_URL}/favicon.svg`,
  'email': BUSINESS.email,
  'telephone': BUSINESS.phone,
  'address': {
    '@type': 'PostalAddress',
    'streetAddress': 'S-8/88 A-1, Panchkosi Road, PURANI CHUNGI, SHIVPUR',
    'addressLocality': 'Varanasi',
    'addressRegion': 'Uttar Pradesh',
    'postalCode': '221003',
    'addressCountry': 'IN',
  },
};

export const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  'name': BUSINESS.name,
  'url': `${BASE_URL}/`,
  'description': 'Official Booyahstudio store offering modern website templates, React source code packages, and developer tools with verified electronic delivery.',
  'potentialAction': {
    '@type': 'SearchAction',
    'target': `${BASE_URL}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export function getSEOPageData(pathname: string, searchParams: Record<string, string> = {}, products: typeof PRODUCTS = PRODUCTS): SEOPageData {
  const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/';

  // Private routes (noindex)
  const privateRoutes = ['/admin', '/account', '/checkout', '/cart', '/login', '/register', '/forgot-password', '/wishlist', '/search'];
  if (privateRoutes.some((p) => cleanPath === p || cleanPath.startsWith(`${p}/`))) {
    return {
      title: `Account & Checkout | ${BUSINESS.name}`,
      description: `Secure checkout, customer account downloads, and order management at ${BUSINESS.name}.`,
      canonicalUrl: `${BASE_URL}${cleanPath}`,
      ogImage: DEFAULT_OG_IMAGE,
      ogImageAlt: `${BUSINESS.name} Secure Portal`,
      ogType: 'website',
      noindex: true,
      jsonLd: [ORGANIZATION_JSON_LD],
    };
  }

  // Product routes
  if (cleanPath.startsWith('/product/')) {
    const rawSlug = cleanPath.replace('/product/', '');
    let slug = rawSlug;
    try { slug = decodeURIComponent(rawSlug); } catch { /* Invalid path stays unmatched. */ }
    const product = products.find((p) => p.slug.toLowerCase() === slug.toLowerCase() || p.id === slug);

    if (!product) {
      return {
        title: `404 — Product Not Found | ${BUSINESS.name}`,
        description: `The requested digital item or website template could not be found in our active catalog.`,
        canonicalUrl: `${BASE_URL}${cleanPath}`,
        ogImage: DEFAULT_OG_IMAGE,
        ogImageAlt: `${BUSINESS.name} Storefront`,
        ogType: 'website',
        noindex: true,
        statusCode: 404,
        jsonLd: [ORGANIZATION_JSON_LD],
      };
    }

    const canonicalUrl = `${BASE_URL}/product/${encodeURIComponent(product.slug)}`;
    const imgUrl = product.image.startsWith('http') ? product.image : `${BASE_URL}${product.image}`;

    const breadcrumbsJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': `${BASE_URL}/`,
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': product.categoryLabel || 'Website Templates',
          'item': `${BASE_URL}/category/${product.category}`,
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': product.title,
          'item': canonicalUrl,
        },
      ],
    };

    const productJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': product.title,
      'description': product.shortDescription,
      'image': [imgUrl],
      'brand': {
        '@type': 'Brand',
        'name': BUSINESS.name,
      },
      'offers': {
        '@type': 'Offer',
        'url': canonicalUrl,
        'priceCurrency': 'INR',
        'price': product.price,
        'itemCondition': 'https://schema.org/NewCondition',
        'availability': 'https://schema.org/InStock',
        'seller': {
          '@type': 'Organization',
          'name': BUSINESS.name,
        },
      },
    };

    return {
      title: `${product.title} | ${BUSINESS.name}`,
      description: product.shortDescription,
      canonicalUrl,
      ogImage: imgUrl,
      ogImageAlt: `${product.title} template preview`,
      ogType: 'product',
      noindex: false,
      statusCode: 200,
      jsonLd: [ORGANIZATION_JSON_LD, breadcrumbsJsonLd, productJsonLd],
    };
  }

  // Category routes
  if (cleanPath.startsWith('/category/')) {
    const catSlug = cleanPath.replace('/category/', '');
    const category = CATEGORIES.find((c) => c.slug.toLowerCase() === catSlug.toLowerCase() || c.id === catSlug);

    if (!category) {
      return {
        title: `404 — Category Not Found | ${BUSINESS.name}`,
        description: `The requested product category was not found. Browse all digital website templates.`,
        canonicalUrl: `${BASE_URL}${cleanPath}`,
        ogImage: DEFAULT_OG_IMAGE,
        ogImageAlt: `${BUSINESS.name} Categories`,
        ogType: 'website',
        noindex: true,
        statusCode: 404,
        jsonLd: [ORGANIZATION_JSON_LD],
      };
    }

    const canonicalUrl = `${BASE_URL}/category/${category.slug}`;
    const breadcrumbsJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': `${BASE_URL}/`,
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': category.name,
          'item': canonicalUrl,
        },
      ],
    };

    return {
      title: `${category.name} | ${BUSINESS.name}`,
      description: category.description,
      canonicalUrl,
      ogImage: DEFAULT_OG_IMAGE,
      ogImageAlt: `${category.name} at ${BUSINESS.name}`,
      ogType: 'website',
      noindex: false,
      statusCode: 200,
      jsonLd: [ORGANIZATION_JSON_LD, breadcrumbsJsonLd],
    };
  }

  // Policy routes
  if (cleanPath.startsWith('/policies/') || POLICY_REDIRECTS[cleanPath.replace('/', '')]) {
    let slugKey = cleanPath.startsWith('/policies/') ? cleanPath.replace('/policies/', '') : cleanPath.replace('/', '');
    const targetSlug = POLICY_REDIRECTS[slugKey] || slugKey;
    const policy = policyData[targetSlug as SupportedPolicySlug];

    if (policy) {
      const canonicalUrl = `${BASE_URL}/policies/${policy.slug}`;
      const breadcrumbsJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': `${BASE_URL}/`,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Policies',
            'item': `${BASE_URL}/policies/terms`,
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': policy.title,
            'item': canonicalUrl,
          },
        ],
      };

      return {
        title: `${policy.title} | ${BUSINESS.name}`,
        description: policy.quickSummary?.[0] || `${policy.title} for purchases at ${BUSINESS.name}.`,
        canonicalUrl,
        ogImage: DEFAULT_OG_IMAGE,
        ogImageAlt: `${policy.title} at ${BUSINESS.name}`,
        ogType: 'article',
        noindex: false,
        statusCode: 200,
        jsonLd: [ORGANIZATION_JSON_LD, breadcrumbsJsonLd],
      };
    }
  }

  // Specific Static Routes
  switch (cleanPath) {
    case '/products':
      return {
        title: `All Templates & Digital Assets | ${BUSINESS.name}`,
        description: `Browse our entire collection of modern website templates, React codebases, and developer source packages with verified electronic delivery.`,
        canonicalUrl: `${BASE_URL}/products`,
        ogImage: DEFAULT_OG_IMAGE,
        ogImageAlt: `All Digital Products at ${BUSINESS.name}`,
        ogType: 'website',
        noindex: false,
        jsonLd: [
          ORGANIZATION_JSON_LD,
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': [
              { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${BASE_URL}/` },
              { '@type': 'ListItem', 'position': 2, 'name': 'All Products', 'item': `${BASE_URL}/products` },
            ],
          },
        ],
      };

    case '/about':
      return {
        title: `Our Story & Design Philosophy | ${BUSINESS.name}`,
        description: `Learn about Booyahstudio, our design principles, and our commitment to clean, high-performance website templates and developer goods.`,
        canonicalUrl: `${BASE_URL}/about`,
        ogImage: DEFAULT_OG_IMAGE,
        ogImageAlt: `About ${BUSINESS.name}`,
        ogType: 'website',
        noindex: false,
        jsonLd: [
          ORGANIZATION_JSON_LD,
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': [
              { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${BASE_URL}/` },
              { '@type': 'ListItem', 'position': 2, 'name': 'Our Story', 'item': `${BASE_URL}/about` },
            ],
          },
        ],
      };

    case '/contact':
      return {
        title: `Contact & Customer Support | ${BUSINESS.name}`,
        description: `Get in touch with the Booyahstudio support team in Varanasi, India for help with orders, digital downloads, and template setup.`,
        canonicalUrl: `${BASE_URL}/contact`,
        ogImage: DEFAULT_OG_IMAGE,
        ogImageAlt: `Contact ${BUSINESS.name} Support`,
        ogType: 'website',
        noindex: false,
        jsonLd: [
          ORGANIZATION_JSON_LD,
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': [
              { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${BASE_URL}/` },
              { '@type': 'ListItem', 'position': 2, 'name': 'Contact & Support', 'item': `${BASE_URL}/contact` },
            ],
          },
        ],
      };

    case '/faq':
      return {
        title: `Help & Frequently Asked Questions | ${BUSINESS.name}`,
        description: `Find answers regarding payment verification, verified digital delivery, single-project licensing, and technical prerequisites.`,
        canonicalUrl: `${BASE_URL}/faq`,
        ogImage: DEFAULT_OG_IMAGE,
        ogImageAlt: `Help & FAQs at ${BUSINESS.name}`,
        ogType: 'website',
        noindex: false,
        jsonLd: [
          ORGANIZATION_JSON_LD,
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': [
              { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${BASE_URL}/` },
              { '@type': 'ListItem', 'position': 2, 'name': 'Help & FAQs', 'item': `${BASE_URL}/faq` },
            ],
          },
        ],
      };

    case '/search':
      const q = searchParams.q ? ` "${searchParams.q}"` : '';
      return {
        title: `Search Digital Templates${q} | ${BUSINESS.name}`,
        description: `Search website templates, React code packages, and developer tools across ${BUSINESS.name}.`,
        canonicalUrl: `${BASE_URL}/search`,
        ogImage: DEFAULT_OG_IMAGE,
        ogImageAlt: `Search ${BUSINESS.name}`,
        ogType: 'website',
        noindex: false,
        jsonLd: [ORGANIZATION_JSON_LD],
      };

    case '/':
      return {
        title: `Booyahstudio – Premium Website Templates, Source Code & Digital Assets`,
        description: `Official Booyahstudio storefront offering modern website templates, React code packages, and digital developer goods with verified electronic delivery.`,
        canonicalUrl: `${BASE_URL}/`,
        ogImage: DEFAULT_OG_IMAGE,
        ogImageAlt: `Booyahstudio Storefront`,
        ogType: 'website',
        noindex: false,
        jsonLd: [ORGANIZATION_JSON_LD, WEBSITE_JSON_LD],
      };
    default:
      return { title: `Page not found | ${BUSINESS.name}`, description: 'This page is unavailable.', canonicalUrl: `${BASE_URL}${cleanPath}`, ogImage: DEFAULT_OG_IMAGE, ogImageAlt: BUSINESS.name, ogType: 'website', noindex: true, statusCode: 404, jsonLd: [] };
  }
}

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

export function injectSEOMetadata(htmlShell: string, pageData: SEOPageData): string {
  const robotsContent = pageData.noindex ? 'noindex, nofollow' : 'index, follow';

  let result = htmlShell;

  // Replace <title>
  result = result.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(pageData.title)}</title>`);

  // Strip existing meta tags & canonical link to avoid duplicates
  result = result
    .replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]*|twitter:[^"]*)"[\s\S]*?\/?>/gi, '')
    .replace(/<link rel="canonical"[^>]*>/gi, '')
    .replace(/<script id="json-ld-data"[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');

  // Build complete SEO meta tags
  const metaTags = `
    <meta name="description" content="${escapeHtml(pageData.description)}" />
    <meta name="robots" content="${robotsContent}" />
    <link rel="canonical" href="${escapeHtml(pageData.canonicalUrl)}" />

    <!-- Open Graph Metadata -->
    <meta property="og:type" content="${pageData.ogType}" />
    <meta property="og:site_name" content="${BUSINESS.name}" />
    <meta property="og:title" content="${escapeHtml(pageData.title)}" />
    <meta property="og:description" content="${escapeHtml(pageData.description)}" />
    <meta property="og:url" content="${escapeHtml(pageData.canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(pageData.ogImage)}" />
    <meta property="og:image:alt" content="${escapeHtml(pageData.ogImageAlt)}" />

    <!-- Twitter / X Card Metadata -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageData.title)}" />
    <meta name="twitter:description" content="${escapeHtml(pageData.description)}" />
    <meta name="twitter:image" content="${escapeHtml(pageData.ogImage)}" />

    <!-- Schema.org JSON-LD Structured Data -->
    ${pageData.jsonLd
      .map(
        (data) =>
          `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`
      )
      .join('\n    ')}
  `;

  return result.replace('</head>', `${metaTags}\n  </head>`);
}
