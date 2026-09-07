# Payment — Technical Design

> **Status:** Approved — 2026-08-31
> **Last updated:** 2026-08-31

---

## 1. Overview

Integrates Stripe to replace the placeholder checkout flow. Key decisions:

- **Credit card + Apple Pay** via Stripe Payment Element (single component handles both)
- **Two-phase flow**: frontend creates a Payment Intent to get a `clientSecret`, then confirms payment client-side via Stripe.js; the webhook fires after success to create the DB order
- **Shipping collected at checkout** — 5 address fields added to `customer_order`
- **Order confirmation email** via AWS SES after successful payment (webhook-triggered)
- **Order search** — public endpoint: `GET /api/orders/search?orderNumber=&email=` (no login required)
- **No payment required to browse or generate bundles** — all existing flows unchanged

---

## 2. Stripe Account Setup

### 2.1 Create Account
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → sign up / log in
2. Switch to **Test mode** (toggle in top-left)

### 2.2 Get API Keys
Stripe Dashboard → **Developers → API keys**:
- **Publishable key** (`pk_test_...`) → `frontend/.env.local` as `VITE_STRIPE_PUBLISHABLE_KEY`
- **Secret key** (`sk_test_...`) → `backend-node/.env` as `STRIPE_SECRET_KEY` (never expose to frontend)

### 2.3 Webhook Setup (Local Dev)
```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to http://localhost:8080/api/webhooks/stripe
# Copy the printed webhook signing secret (whsec_...) → STRIPE_WEBHOOK_SECRET
```

### 2.4 Webhook Setup (Production)
Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
- URL: `https://your-domain.com/api/webhooks/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- Copy **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`

### 2.5 Apple Pay Domain Verification (Production)
Apple Pay requires the domain to be registered with Apple through Stripe:

1. Stripe Dashboard → **Settings → Payment methods → Apple Pay → Add domain**
2. Download the verification file
3. Serve it at `/.well-known/apple-developer-merchantid-domain-association`
4. In `app.ts`, before other routes: `app.use('/.well-known', express.static('public/.well-known'))`
5. Place file at `backend-node/public/.well-known/apple-developer-merchantid-domain-association`

> In local dev, Apple Pay simulation is not available. Use test card `4242 4242 4242 4242` instead.

### 2.6 New Environment Variables

**`backend-node/.env`:**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
EMAIL_FROM=orders@yourdomain.com
FRONTEND_URL=http://localhost:5173
AWS_REGION=us-east-1
# No SES API key — uses Lambda IAM role (ses:SendEmail permission) in production.
# For local dev, configure AWS credentials via `aws configure` or AWS_PROFILE.
```

**`frontend/.env.local`:**
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 3. Schema Changes (Migration 007)

**File:** `backend-node/migrations/007_payment_and_shipping.ts`

Add 5 nullable shipping address columns to `customer_order`:

```sql
ALTER TABLE customer_order
  ADD COLUMN IF NOT EXISTS shipping_street  VARCHAR(200),
  ADD COLUMN IF NOT EXISTS shipping_city    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_state   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_zip     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(2) DEFAULT 'US';
```

> `payment_intent_id VARCHAR(100)` and `payment_status VARCHAR(20)` already exist as stubs from migration 005.

---

## 4. Payment Flow

### 4.1 Phase A — Create Payment Intent

`POST /api/checkout/intent` (no auth required; `X-Session-Id` required):
```
Body: {
  email: string,
  name?: string,
  shippingStreet: string,
  shippingCity: string,
  shippingState: string,
  shippingZip: string,
  shippingCountry?: string  // default 'US'
}
→ 200: { clientSecret: string, totalCents: number }
```

Server-side:
1. Validate X-Session-Id and body
2. Read cart items for sessionId (400 if empty)
3. Compute total in cents (same price logic as createOrder)
4. Optionally extract userId from JWT (silent, for metadata)
5. `stripe.paymentIntents.create({ amount: totalCents, currency: 'usd', metadata: { sessionId, email, name, userId, shippingStreet, shippingCity, shippingState, shippingZip, shippingCountry } })`
6. Return `{ clientSecret: pi.client_secret, totalCents }`

Cart is NOT modified at this stage.

### 4.2 Phase B — Frontend Confirms Payment

1. Wrap form in `<Elements stripe={stripePromise} options={{ clientSecret }}>`
2. Render `<PaymentElement />` (handles credit card + Apple Pay)
3. On submit: `stripe.confirmPayment({ elements, confirmParams: { return_url: '${FRONTEND_URL}/orders/confirmation' } })`
4. Stripe redirects to `/orders/confirmation?payment_intent=pi_xxx&redirect_status=succeeded`

### 4.3 Phase C — Webhook Creates Order

`POST /api/webhooks/stripe` (raw body; Stripe signature verified):

1. `stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)` — 400 if invalid
2. On `payment_intent.succeeded`:
   - Read all metadata from PI: sessionId, email, name, userId, shipping fields
   - Run `confirmOrder(paymentIntentId, metadata)` — atomic transaction:
     a. `SELECT ... FROM cart_item WHERE session_id = $1 FOR UPDATE`
     b. Compute unit prices (same as createOrder)
     c. `INSERT INTO customer_order` with `status = 'CONFIRMED'`, `payment_intent_id`, `payment_status = 'succeeded'`, all shipping fields
     d. `INSERT INTO order_line_item` (one per cart item)
     e. `DELETE FROM cart_item WHERE session_id = $1`
   - Send confirmation email with publicId + line items
3. On `payment_intent.payment_failed`: log only, no DB change
4. Return 200 (Stripe retries on non-2xx)

### 4.4 Confirmation Page

`/orders/confirmation?payment_intent=pi_xxx&redirect_status=succeeded`

- Reads `redirect_status` param from URL
- If `succeeded`: shows success message + "Check your email for your order number"
- If `failed` / other: shows error message + link back to checkout
- Includes a "Find My Order" link → `/orders/search`

---

## 5. Order Search

`GET /api/orders/search?orderNumber=ord_xxx&email=user@example.com` (public, no auth):

```sql
SELECT * FROM customer_order
WHERE public_id = $1 AND LOWER(customer_email) = LOWER($2)
```

Returns order with line items, or 404. Both params required (400 if missing).
This endpoint is mounted before `GET /api/orders/:publicId` to avoid route collision.

---

## 6. Confirmation Email (AWS SES)

Sent by `confirmOrder()` after the DB transaction commits.

**Why SES over SendGrid:** No additional API key or vendor account required — the Lambda execution role's IAM policy grants `ses:SendEmail`. Cost is $0.10/1,000 emails vs SendGrid's paid tiers.

**Prerequisites:**
- Verify the `EMAIL_FROM` address (or domain) in SES → **Identities**.
- Request production access (exit sandbox) in SES → **Account dashboard** — sandbox only allows sending to verified addresses.
- Add `ses:SendEmail` to the Lambda IAM role policy in `serverless.yml`.

**Implementation:** `src/lib/email.ts` uses `@aws-sdk/client-ses`. The `SESClient` is initialised once at module scope (Lambda warm-reuse). Region is read from `AWS_REGION` env var (set automatically in Lambda).

- **Subject:** `Your Goodie Bag Order #${publicId}`
- **Body (HTML):**
  - Order number (`publicId`)
  - Line items: interest, tier, gift bag, qty, unit price, line total
  - Subtotal + total
  - Shipping address
  - "Search for your order at: {FRONTEND_URL}/orders/search"

---

## 7. Files to Create / Modify

### Migration
| File | Action |
|------|--------|
| `backend-node/migrations/007_payment_and_shipping.ts` | New — shipping columns |

### Backend
| File | Action |
|------|--------|
| `backend-node/src/lib/stripe.ts` | New — Stripe client singleton |
| `backend-node/src/lib/email.ts` | New — AWS SES email helper |
| `backend-node/src/routes/checkout.ts` | New — `POST /api/checkout/intent` |
| `backend-node/src/routes/webhooks.ts` | New — `POST /api/webhooks/stripe` |
| `backend-node/src/repositories/orders.ts` | Modify — add `confirmOrder()`, `searchOrder()` |
| `backend-node/src/routes/user/orders.ts` | Modify — add `GET /api/orders/search` |
| `backend-node/src/types/entities.ts` | Modify — add 5 shipping fields to `CustomerOrderRow` |
| `backend-node/src/app.ts` | Modify — mount webhook before `express.json()`, mount checkout router |

### Frontend
| File | Action |
|------|--------|
| `frontend/src/lib/ordersApi.ts` | Modify — add `createPaymentIntent()`, `searchOrder()` |
| `frontend/src/pages/CheckoutPage.tsx` | Modify — two-phase UI (form → Stripe Payment Element) + shipping fields |
| `frontend/src/pages/OrderConfirmationPage.tsx` | New — post-payment confirmation |
| `frontend/src/pages/OrderSearchPage.tsx` | New — search by order number + email |
| `frontend/src/App.tsx` | Modify — add `/orders/confirmation`, `/orders/search` routes |

---

## 8. Verification

| # | Test | Expected |
|---|------|----------|
| 1 | `npm run migrate:local` | Migration 007 applies cleanly |
| 2 | `POST /api/checkout/intent` (valid session + cart) | 200, `clientSecret` starts with `pi_` |
| 3 | Complete payment with test card `4242 4242 4242 4242` | Redirected to `/orders/confirmation?redirect_status=succeeded` |
| 4 | Check webhook logs (Stripe CLI) | `payment_intent.succeeded` event received, 200 returned |
| 5 | Check email inbox | Confirmation email with order number + line items |
| 6 | `GET /api/orders/search?orderNumber=ord_xxx&email=test@x.com` | 200, order with CONFIRMED status |
| 7 | `GET /api/orders/search?orderNumber=ord_xxx&email=wrong@x.com` | 404 |
| 8 | `POST /api/webhooks/stripe` with bad signature | 400 |
| 9 | Open `/orders/search` in browser | Form renders, search works |
| 10 | `GET /api/health` | 200 (no regression) |
