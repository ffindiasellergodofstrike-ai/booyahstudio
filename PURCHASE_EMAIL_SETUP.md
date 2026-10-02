# Purchase email and invoice setup

After Easebuzz verifies a payment, the server creates purchase entitlements and
sends the customer a branded Resend confirmation email. The email contains one
secure website download link per product, a secure Download Invoice button, an
itemized PDF invoice attachment, and a concise Terms & Conditions summary.

The original private product URL (including a MEGA link/key) always remains on
the server. Email links point to `/api/downloads/email`, expire after seven days
by default, work once, re-check the paid purchase, and count toward the existing
download limit. The invoice button points to `/api/invoices/email`, re-checks
the paid order, expires on the same schedule, and permits up to ten downloads.
Only SHA-256 hashes of item and invoice tokens are stored in Firebase.

## Vercel environment variables

Set these for the production deployment:

```text
APP_URL=https://your-production-domain.example
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=BOOYAH STUDIO <orders@your-verified-domain.example>
PURCHASE_EMAIL_LINK_TTL_HOURS=168
INVOICE_BUSINESS_NAME=BOOYAH STUDIO
INVOICE_BUSINESS_ADDRESS=Your business address
INVOICE_GSTIN=
INVOICE_SUPPORT_EMAIL=support@your-domain.example
```

`RESEND_FROM_EMAIL` must use a domain verified in the Resend dashboard. Never
put the Resend API key or complete private download URL in client-side variables.

Email delivery does not roll back a successful payment. Its result is saved on
the order as `emailDelivery`. A later payment reconciliation retries failed or
not-yet-configured delivery, while Resend's order-specific idempotency key avoids
duplicate confirmation emails.
