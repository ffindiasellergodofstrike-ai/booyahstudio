# BOOYAH STUDIO — storefront and policy update

## Included

- Customer-facing payment wording: **Delivery on email** and **Secure online payment**. Internal provider setup and simulation copy are removed from the store UI. Actual bank/provider checkout pages may display their required branding.
- Public checkout chooses a configured production payment flow. If none is available, checkout stays unavailable and offers a support link. Internal non-production transactions still cannot issue paid files.
- Detailed policies across all 17 existing routes: terms, refunds/returns, cancellation, delivery/shipping, chargebacks/disputes, privacy, cookies, grievance, support, licensing, intellectual property, acceptable use, security, disclaimer, fraud and content. The footer links to the primary order policies.
- Checkout disclosures and recorded accepted-policy lists agree. Policy section navigation works on mobile and desktop. Payment reconciliation messages avoid exposing provider diagnostics.

## Before publishing

The included business name, address, email, phone and support hours come from the existing store configuration. Confirm the registered merchant/owner identity and designated grievance contact; no new legal identity or registration number has been invented. Confirm you can meet the stated complaint acknowledgement, resolution, delivery and refund timeframes.

Configure the production database, approved merchant account, transactional email and private product delivery URLs using the existing deployment documentation. None of the merchant credentials or private order/customer data are included in this ZIP. A successful local build or a policy page does not establish live payment acceptance, legal certification or merchant approval.

Provider requirements were checked against https://easebuzz.in/terms/ (merchant website requirements). Keep descriptions, limited-refund disclosures, delivery region, merchant identity and transaction records accurate. Internal deployment documentation retains provider configuration instructions. Existing PayU category eligibility concerns remain unresolved: obtain explicit provider confirmation for downloadable source packages before enabling that account. Provider-imposed disclosures on their hosted checkout must remain intact.

## Running the source

Use Node 24 and pnpm 10.34.5. Install with `pnpm install --frozen-lockfile`; copy `.env.example` to a private `.env` and configure as needed. Run `pnpm dev` for a local preview, `pnpm typecheck`, `pnpm test` and `pnpm build` for verification. `pnpm start` serves the production build. Follow DEPLOYMENT.md for Vercel and DOWNLOAD_SETUP.md for private file delivery.

The ZIP contains source, assets, demos and setup examples. Dependencies, generated build directories, secrets and local customer data are excluded. Individual private template delivery ZIPs are managed separately by the collection packaging script.
