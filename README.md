# BOOYAH STUDIO (BOOYAH STUDIO) Storefront

Digital e-commerce platform for high-performance website templates, React templates, SaaS templates, and developer assets.

## Local development

The application source is available directly in this repository.
Use Node.js 24 and the declared pnpm version (10.34.5).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Browsing uses the bundled six-product catalog and
local development storage when Firebase is not configured. Start with an empty
`.data/` directory; do not reuse customer/session data from the original archive.
Provider credentials are not needed to preview the storefront. Live payments,
email delivery, and production persistence require the configuration below.

```sh
pnpm typecheck
pnpm test
pnpm build
```

The build produces the public site in `dist/`, per-product share pages, and a standalone server in `build/server.mjs`. Vercel compiles the committed `api/index.ts` function entrypoint.

## Paddle Payment Integration

This project integrates official **Paddle Billing (v2)** overlay checkout and cryptographic webhook verification for one-time digital products, fully compatible with Vercel serverless deployment and Firebase Realtime Database.

### 1. Sandbox Setup & Environment Variables

Configure the following environment variables in your local `.env` (for development) and in **Vercel Project Settings → Environment Variables**:

| Variable Name | Environment | Description |
|---|---|---|
| `PADDLE_ENVIRONMENT` | All | `sandbox` for testing, `production` for live |
| `PADDLE_CLIENT_TOKEN` | Public / Frontend | Paddle Client-side Token (starts with `test_` or `live_`) |
| `PADDLE_API_KEY` | Backend Only | Secret Paddle API Key (starts with `pdl_...`) |
| `PADDLE_WEBHOOK_SECRET` | Backend Only | Webhook Secret Key for signature verification (starts with `pdl_ntf_set_...`) |

### 2. Product and Paddle Price ID Mapping

In the Paddle Dashboard, create one-time products and prices for each digital template. Then configure the corresponding Price IDs (`pri_...`) in your environment variables:

| Product ID | Product Name | Environment Variable |
|---|---|---|
| `linknest-pro` | LinkNest Pro — Bio Link & Digital Store | `PADDLE_PRICE_LINKNEST_PRO` |
| `neura-ai` | NeuraAI — Premium AI SaaS Template | `PADDLE_PRICE_NEURA_AI` |
| `finora` | Finora — Premium Fintech Template | `PADDLE_PRICE_FINORA` |
| `learnify` | Learnify — Premium LMS Template | `PADDLE_PRICE_LEARNIFY` |
| `velora` | Velora — Complete E-Commerce Template | `PADDLE_PRICE_VELORA` |
| `workhub` | WorkHub — Freelancer Marketplace Template | `PADDLE_PRICE_WORKHUB` |

### 3. Webhook Endpoint Configuration

Configure the webhook destination in your Paddle Dashboard (**Developer Tools → Notifications → New Notification Destination**):

- **Webhook URL**: `https://www.booyahstudio.shop/api/payments/paddle/webhook` (or `https://your-domain.vercel.app/api/payments/paddle/webhook`)
- **Event Types to Subscribe**:
  - `transaction.completed` (Primary event triggered upon successful payment)
  - `transaction.paid`
  - `transaction.canceled`

### 4. How Webhook Signature Verification Works

Paddle signs every webhook payload using HMAC-SHA256:
1. The raw HTTP request body is preserved without mutations.
2. The `Paddle-Signature` header provides the timestamp `ts` and one or more `h1` hashes.
3. The server computes `HMAC-SHA256(key = PADDLE_WEBHOOK_SECRET, data = "${ts}:${rawBody}")`.
4. The computed hash is compared with `h1` using `crypto.timingSafeEqual` with a 300-second drift tolerance against replay attacks.
5. Invalid signatures are rejected immediately with HTTP 400.

### 5. Idempotency & Order Fulfillment Flow

1. Customer clicks **Complete Order & Get Instant Access** with Paddle selected.
2. Backend creates a pending order in Firebase RTDB and returns the mapped `priceId` and `clientToken`.
3. Paddle.js opens the overlay checkout modal with order metadata (`custom_data: { orderId, userId, productId }`).
4. Customer completes payment inside Paddle's secure modal.
5. Paddle delivers a cryptographically signed `transaction.completed` webhook to `/api/payments/paddle/webhook`.
6. The backend verifies the signature, stores the `event_id` in `paymentEvents/${eventId}` for strict idempotency, marks the order `PAID`, activates the digital purchase entitlement, and generates time-limited secure download tokens.
7. Frontend polling / callback receives the verified order state and unlocks the vault download buttons.

### 6. Testing in Paddle Sandbox

1. Set `PADDLE_ENVIRONMENT=sandbox`.
2. Add your Sandbox `PADDLE_CLIENT_TOKEN` (starts with `test_`).
3. Add your Sandbox `PADDLE_WEBHOOK_SECRET` and product price IDs.
4. Go to checkout, select Paddle, and use Paddle Sandbox test cards (e.g. Visa/Mastercard test numbers provided in Paddle docs).
5. Verify webhook receipt, order completion, and instant download vault access.

### 7. Switching to Live / Production Mode

1. In Paddle Dashboard, ensure your business domain and account verification are approved.
2. Change `PADDLE_ENVIRONMENT=production` in Vercel.
3. Update `PADDLE_CLIENT_TOKEN` to your Live Client Token (`live_...`).
4. Update `PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` to your Live keys.
5. Enter live product Price IDs (`pri_...`) generated in your live Paddle catalog.
6. Verify your production domain under Paddle's Checkout Domains settings.

## Original template collection

The catalog includes 20 new original, four-page static templates (26 products total). See `templates/collection.json` for prices and `templates/<id>/README.md` for each package. Run `python3 scripts/package-template-collection.py` to produce individual customer ZIPs and the owner upload manifest under `$WORKSPACE_ROOT/output/`. See DEPLOYMENT.md for protected delivery and Vercel routing.
