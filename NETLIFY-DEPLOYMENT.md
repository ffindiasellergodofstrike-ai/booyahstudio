# BooyahStudio — Netlify migration

The Vercel-specific routes in `vercel.json` are not used by Netlify.
The Netlify adapter at `netlify/functions/site.ts` passes requests to the
existing Express app, including authentication, products, downloads, checkout,
signed payment webhooks, SEO pages, and admin APIs.

## Deploy target

- GitHub: `ffindiasellergodofstrike-ai/booyahstudio`
- Netlify site: `booyahstudio-7253`
- Site URL: `https://booyahstudio-7253.netlify.app`
- Build: `pnpm run build`
- Publish: `dist`
- Functions: `netlify/functions`
- Node: 22

**Not live until the repository/branch is linked to the Netlify site, a build succeeds,
and API routes are smoke-tested.** An empty Netlify site is not a completed migration.

## Required environment settings

Set credentials in Netlify **Project configuration > Environment variables** (not
in the repository). Keep server secrets accessible to Netlify Functions and don't
prefix them with `VITE_`.

- `APP_URL=https://booyahstudio-7253.netlify.app` (already configured for the site)
- `NODE_ENV=production` (already configured for the site)
- `SUPABASE_URL=https://<your-project-ref>.supabase.co`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; NEVER publish in front-end)
- Additional credentials required by the features you enable: `ADMIN_PASSWORD`,
  `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`,
  `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, Razorpay credentials.
- Temporarily set `PNPM_FLAGS=--no-frozen-lockfile` on the Netlify project:
  `serverless-http` is a newly added dependency and `pnpm-lock.yaml` has not been regenerated.
  Regenerate and commit the lockfile with `pnpm install` and remove this setting.

## Production checks before accepting payments

1. Link GitHub to the existing Netlify site, targeting the migration branch
   for a preview build or merge the changes after review.
2. Confirm every environment variable is present for **Functions** scope; redeploy.
3. Verify `/api/health`, `/api/products`, product page, login/sign-up,
   password reset, admin, downloads and checkout routes.
4. Add the Netlify origin to the Supabase Auth URL allowlist, email redirects,
   and API provider allowed origins; test real email delivery.
5. Configure payment provider webhook URLs to use Netlify only after
   a full verified checkout and webhook test, with signature verification.
6. Confirm scheduled reconciliation is running; the daily schedule is UTC.
7. Avoid enabling real payment collection until the backend and database
   tests pass. Do not move existing DNS until the site is proven healthy.
