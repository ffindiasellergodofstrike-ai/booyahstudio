# Live product demo setup

The storefront embeds product demos in a sandboxed, watermarked preview modal. Six built-in previews are served as optimized static files from the same deployment. Direct `*.vercel.app` URLs are rejected by both the admin API and the public catalog.

## Bundled product previews

Each source archive is retained in `demofiles/`, and each production preview is isolated under the matching product ID in `public/demos/`:

| Product ID | Source archive | Preview path |
| --- | --- | --- |
| `linknest-pro` | `LinkNest-Pro-Creator-Commerce-Kit.zip` | `/demos/linknest-pro/` |
| `neura-ai` | `neuraai.zip` | `/demos/neura-ai/` |
| `finora` | `finora.zip` | `/demos/finora/` |
| `learnify` | `learnify.zip` | `/demos/learnify/` |
| `velora` | `velora.zip` | `/demos/velora/` |
| `workhub` | `workhub-—-premium-freelancer-marketplace.zip` | `/demos/workhub/` |

The React/Vite demos are production-minified and use subpath-safe asset URLs. Finora and WorkHub use hash navigation in their preview builds so internal links remain inside their own demo. Every generated `index.html` contains its matching product watermark, a restrictive content-security policy, and no live API credentials.

The public catalog enforces `/demos/<product-id>/` ownership. A product cannot be assigned another bundled product's preview path.

## Connect a branded demo domain

1. Deploy the demo as a separate Vercel project.
2. In that demo project, open **Settings → Domains** and add a custom hostname such as `linknest-demo.yourdomain.com`.
3. Add the DNS record Vercel requests and wait until the domain shows as valid with HTTPS enabled.
4. In this store, open **Admin → Products → Edit Product**.
5. Enter the custom HTTPS address in **Live Demo URL or Built-in Path** and save.

The product page replaces the static “Product Overview & Specs” action with **Open Live Demo Preview** whenever either a bundled path or a custom preview URL is configured.

## Demo project requirements

- The custom hostname must serve the demo without redirecting to `*.vercel.app`.
- The demo must allow iframe embedding. Do not send `X-Frame-Options: DENY` or a CSP `frame-ancestors` rule that excludes the storefront domain.
- Use relative asset/API paths, or configure the demo's CORS rules for its custom hostname.
- Keep demo data synthetic. Disable real payments, destructive actions, private dashboards, and production credentials.

## Privacy boundary

The raw Vercel deployment address is not stored or rendered by the storefront. A browser must still know the custom demo hostname to load the iframe, so a technical user can inspect that branded hostname. No browser-based implementation can make the active iframe URL completely secret. The watermark is a visual deterrent, not DRM.
