# Booyahstudio

**Vercel registration fix:** Read `VERCEL-REGISTRATION-FIX.md` before redeploying. Use Node 24.x and the full `pnpm build` command; it builds and checks the private API bundle.

MANISH KUMAR SONKAR | Booyahstudio

Single-seller digital-products store. React/Vite frontend, Express API on Vercel, Supabase Auth/PostgreSQL/private Storage, Razorpay checkout and Resend email.

**Keep the GitHub repository private:** the complete owner source includes paid product files. Only `dist` is the public website output. Never publish the owner ZIP as a public site asset.

## Start

Use Node 24 and pnpm 10.34.5.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Open http://localhost:3000. Catalog browsing works without credentials; accounts, orders, support submissions and protected files require the Supabase schema/configuration. There is no local financial-data fallback.

```sh
pnpm typecheck
pnpm test
pnpm build
```

Read **START-HERE-HINDI.md** and **DEPLOYMENT.md** for the complete setup, private file upload, recovery emails, owner admin access and launch checks. Do not enable live payments before completing the live configuration checklist.

See **FINAL-AUDIT.md** for the before/after matrix, exact validation results and remaining owner setup. This ZIP is source code with verified local checks; it does not contain your production provider credentials.

## Included

- 25 active digital product listings and your original source archives.
- 20 editable static template packages in `templates/`.
- The retired WorkHub package remains in `demofiles/`; its preview is kept privately in `owner-files/`. It is excluded from the active catalog.
- 19 consistent legal pages, including all 18 requested policy topics and the compatible old cancellation URL.
- Copy-ready policy Markdown in `docs/policies/`; source in `src/data/policies.json`.
- Atomic server-only database operations in `supabase/schema.sql`.

No production credentials, customer records or uploaded private product files are included in the project source. Supply your own provider settings. Payment receipts are provided; GST tax invoicing needs your confirmed classification/rate and accounting process.
