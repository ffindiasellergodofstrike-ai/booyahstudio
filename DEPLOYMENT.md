# Deploy BOOYAH STUDIO

## Prepare

Use Node 24 and pnpm 10.34.5. Run `pnpm install --frozen-lockfile`,
`pnpm typecheck`, `pnpm test`, and `pnpm build`. `pnpm dev` serves local development
on port 3000. `pnpm start` serves the production build and requires production
Firebase configuration. Vercel uses the included `vercel.json` and committed `api/index.ts` function entrypoint.

Copy `.env.example` to `.env` for local configuration; never commit it. Set the
same required values in the hosting environment. Source business information is
centralized in `src/config/business.ts`. Do not reuse previous-owner database
credentials or archived customer/session data. Use your own authenticated Firebase
project with the supplied deny-public-access database rules.

## Domain and merchant verification

Set `APP_URL=https://www.booyahstudio.shop`. Configure DNS and HTTPS for this hostname
and redirect HTTP to HTTPS. Verify the www and apex hostnames in your hosting
provider. The site must be publicly reachable before gateway callbacks can work.

Confirm that the business name and address match the documents submitted to your
payment providers. Supply any legally required proprietor/company and grievance
officer details after confirming them; the source does not invent a legal owner.
Confirm rights to distribute the products and accuracy of their descriptions.
Gateway approval is determined by each provider and is not guaranteed by this code.

## Easebuzz

Set private `EASEBUZZ_KEY`, `EASEBUZZ_SALT`, and `EASEBUZZ_ENV=test`.
Use sandbox merchant credentials. The integration uses signed initiation,
reverse-hash validation, order/amount matching, and reconciliation.

- Return/callback URL: `https://www.booyahstudio.shop/api/payments/easebuzz/callback`
- Webhook URL: `https://www.booyahstudio.shop/api/payments/easebuzz/webhook`

After merchant approval and successful sandbox validation, use your live merchant
credentials with `EASEBUZZ_ENV=prod`. Restart/redeploy when changing credentials.

## PayU Hosted Checkout

Set private `PAYU_KEY`, `PAYU_SALT`, and `PAYU_ENV=test`.
The server hashes an order-priced checkout request; the browser posts it to PayU.
Responses must pass reverse-hash validation and match the recorded order.
The server additionally calls PayU's Verify Payment API and requires the exact
transaction, amount, `success` status, and `captured` state before confirmation.

- Success/failure URL: `https://www.booyahstudio.shop/api/payments/payu/callback`
- Payment webhook URL: `https://www.booyahstudio.shop/api/payments/payu/webhook`

Enable payment events in the PayU dashboard and validate actual callback payloads
using your sandbox merchant account. Set `PAYU_ENV=prod` with live credentials
only after approval. Salt must never use a `VITE_` prefix or appear in client code.

## Test payments never deliver products

Each order records its gateway environment at initiation. Test payments send a
plainly labeled confirmation email only: no real product files, purchase records,
download tokens, or purchase invoice. The server denies access even if a stale
purchase/token exists. Changing the gateway to live later does not upgrade a test
order. Legacy orders missing a recorded environment also cannot authorize files;
only migrate legitimate old orders after independently verifying their provenance.
The checkout and account pages label test payments explicitly.

Optional existing Paddle checkout follows the same test/live rules. Enable it only
with a matching INR catalog and webhook secret. Multi-item or discounted orders
must use Easebuzz or PayU. Sandbox amounts never authorize live fulfillment.

## Resend

Verify the sending domain `booyahstudio.shop` in Resend and publish its required DNS
records. Configure private `RESEND_API_KEY` and
`RESEND_FROM_EMAIL="BOOYAH STUDIO <orders@booyahstudio.shop>"`.
Replies go to `connectbooyahstudio@gmail.com`. Gmail is the contact address; do not
use it as an unverified Resend sender. Real inbox delivery requires a verified
domain and a valid Resend account. Local tests use a Resend emulator and send no
real email. Never set `RESEND_BASE_URL` to the local emulator in production.

Failed emails do not change the verified payment result. The reconciliation cron
retries email delivery, using provider-specific verification and idempotency keys.
Set a private `CRON_SECRET`. The configured Vercel cron runs daily; use an appropriate
supported schedule on your hosting plan if faster retries are required.

## Live files and support

Configure each `PRODUCT_DOWNLOAD_URL_<PRODUCT_ID>` with a private HTTPS ZIP source
or complete MEGA file link. Keep files out of `public/`. Validate each real product
archive before accepting live payments. A template demo is not a paid ZIP delivery.

Contact submissions are saved under `supportRequests` and can be read by an
authenticated administrator at `/api/admin/support-requests`; they are not falsely
reported as emailed. Monitor this inbox and the published contact email. Assign
admin roles only through trusted database administration; knowing the contact email
does not grant admin privileges.

## Final provider checks

1. Confirm legal merchant identity, KYC and settlement account with each provider.
2. Confirm public HTTPS pages: About, Contact, Terms, Privacy, Refunds, Cancellation,
   and Shipping & Delivery; all must match the merchant application.
3. Configure your Firebase, gateway, Resend and private file-source settings.
4. Perform sandbox success, failure, cancellation and duplicate-callback checks.
   Confirm test emails contain no real file links and account downloads stay locked.
5. After approval, deploy live credentials and perform an authorized live acceptance
   test, including file delivery and refund handling. No live transaction was performed
   during this development task.

Official references:
- [Easebuzz merchant website requirements](https://easebuzz.in/terms/)
- [PayU Hosted Checkout](https://docs.payu.in/reference/_payment_payu_hosted_checkout)
- [PayU request and response hashes](https://docs.payu.in/docs/hashing-request-and-response)
- [PayU Verify Payment API](https://docs.payu.in/reference/verify_payment_api)

## Original 20-product collection

The store now includes 26 built-in products. The 20 new source projects live under
`templates/`; those folders are never copied to the public build. Their public,
watermarked demos live under `public/demos/<product-id>/` and screenshots under
`public/product-images/`. Every new template has four actual static HTML pages.

`api/index.ts` is the committed Vercel function entrypoint. The build also creates
26 static product share pages with per-product Open Graph/Twitter image, title and
description plus a sitemap. `vercel.json` routes APIs, demo directories and product
pages before the general SPA fallback. The standalone server is built under
`build/`, outside the public `dist/` output. Do not upload `build/` as static assets.

To regenerate source/demos, run `python3 scripts/create-template-collection.py`.
To package the source ZIPs, run `python3 scripts/package-template-collection.py`;
this writes customer ZIPs, a master owner bundle and an upload manifest under
`$WORKSPACE_ROOT/output/`. The package script requires Python 3 only. Re-capture
product screenshots after visual edits, then build the store.

Use `booyah-products/upload-manifest.csv` to match every individual ZIP to its
`PRODUCT_DOWNLOAD_URL_...` server environment variable. Upload those ZIPs to a
protected source host first, set the URLs in Vercel and redeploy. No real paid
product ZIP is bundled under `public/` or linked in the catalog. Live delivery
requires the existing approved gateway/Firebase/Resend setup. Test payments
continue to issue only a test notice.

The new templates are static frontends with the browser features documented on
each listing. They do not include real subscriptions, email delivery, bookings,
shared data or authentication backends. Original geometric SVGs and sample copy
are bundled, with no third-party photos, logos, fonts or audio. This source audit
does not establish global trademark clearance or ownership of the six previously
imported products. Verify rights for any future images, names or code you add.
