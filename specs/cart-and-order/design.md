# Cart & Order Management — Technical Design

> **Status:** Approved — revised 2026-09-07 (frontend-memory cart)
> **Last updated:** 2026-09-07

---

## 1. Overview

This feature adds a shopping cart and order tracking layer on top of the existing immutable bundle snapshot model. Key decisions:

- **Cart lives entirely in the browser** — cart items (bundle snapshots + user choices) are stored in `localStorage` + React context. No DB writes until the user proceeds to checkout. No backend cart API calls for add/update/remove operations.
- **Bundles are always saved to DB on generation** — `POST /api/generated-bundles` persists the snapshot immediately for both public and admin requests. Lambda statelessness means the in-memory cache cannot be relied on across invocations (checkout frequently hits a different Lambda instance). The bundle snapshot is also kept in the in-memory cache for fast same-instance `GET` retrieval.
- **Cart items remain local until checkout** — `cart_item` rows are only written to the DB when the user clicks "Continue to Payment". Cart add/update/remove during browsing are all localStorage operations with no backend calls.
- **DB writes at `POST /api/checkout/intent`** — the server looks up each bundle by `public_id` (guaranteed to be in DB), upserts `cart_item` rows keyed by `session_id`, then creates the Stripe PaymentIntent.
- **Stripe webhook creates the order** — after payment confirmation, the webhook reads `cart_item` from DB by `session_id` (already persisted at intent time), creates `customer_order` + `order_line_item` rows atomically, and clears the cart.
- **Orders identified by email** — customer email is collected at checkout. No account required. The email address is the primary identifier for anonymous orders.
- **Logged-in users get order history** — if a user is signed in at checkout time, their `user_id` is also stored on the order.
- **Users can pick any active gift bag option** in the cart, not just the one pre-generated with the bundle.
- **Prices computed client-side for display, server-side for billing** — the `GeneratedBundleResponse` carries all pricing fields (`bundleRetailPrice`, `upgrade.standardRetailAdjustment`, `upgrade.upgradedRetailAdjustment`, `giftBag.retailPriceAdjustment`). The CartPage computes display prices locally. The server re-computes authoritatively at checkout intent time — the client-sent price is never trusted.

**Design principle:** Zero DB writes for cart management (add/update/remove). Bundles are persisted immediately on generation because Lambda statelessness makes in-memory-only storage unreliable across invocations. The cart itself (item choices, quantities) is localStorage-only until checkout. Abandoned sessions leave bundle rows but no cart rows in the DB.

### DB write timeline

| User action | DB write? |
|---|---|
| Generate bundle (public) | Yes — immediately (Lambda statelessness requires DB persistence) |
| Generate bundle (admin Basic auth) | Yes — immediately |
| Add to cart | No — localStorage only |
| Update/remove cart item | No — localStorage only |
| Click "Continue to Payment" (`POST /api/checkout/intent`) | Yes — saves bundles + cart_items + creates Stripe PI |
| Stripe webhook fires (payment confirmed) | Yes — creates customer_order + order_line_item, clears cart_item |

---

## 2. Schema Changes

All changes land in a single migration: `backend-node/migrations/005_cart_and_orders.ts`.

---

### 2.1 Modify `generated_bundle` — add `user_id`

```
ALTER TABLE generated_bundle
  ADD COLUMN user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_generated_bundle_user_id
  ON generated_bundle(user_id)
  WHERE user_id IS NOT NULL;
```

**Purpose:** Track which authenticated user generated a bundle. This is ownership metadata, not cart or order state. Populated at generation time when a valid JWT is present; `NULL` for anonymous generations.

**`ON DELETE SET NULL`:** If a user deletes their account, the generation record survives as an anonymous historical record — consistent with how `analytics_event.bundle_id` survives bundle deletion.

---

### 2.2 New table: `cart_item`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigserial | PK | |
| `session_id` | varchar(100) | NOT NULL | Client-generated UUID stored in localStorage, sent via `X-Session-Id` header |
| `generated_bundle_id` | bigint | NOT NULL, FK → generated_bundle(id) ON DELETE CASCADE | If bundle is deleted/expired, cart item disappears |
| `upgrade_tier` | varchar(20) | NOT NULL, default `'STANDARD'` | User's upgrade choice: `STANDARD` or `PREMIUM` |
| `gift_bag_option_id` | bigint | NULLABLE, FK → gift_bag_option(id) ON DELETE SET NULL | Any active gift bag option; NULL = no gift bag |
| `quantity` | smallint | NOT NULL, default 1, CHECK (quantity > 0) | Copies for party guests |
| `created_at` | timestamptz | NOT NULL, default now() | |
| `updated_at` | timestamptz | NOT NULL, default now() | |

**Constraints:**
- `UNIQUE(session_id, generated_bundle_id)` — one cart row per bundle per session; prevents duplicate-add bugs
- `CHECK (upgrade_tier IN ('STANDARD', 'PREMIUM'))`

**Index:** `CREATE INDEX idx_cart_item_session_id ON cart_item(session_id)`

**Why session_id instead of user_id:** Cart is anonymous. The `session_id` is a UUID generated once in the browser (stored in localStorage), sent on every request as `X-Session-Id`. No login is needed to add to or manage the cart.

**Why `upgrade_tier` lives here:** The generation engine always produces both standard and premium snapshots in `generated_bundle_upgrade`. The user's tier choice is a shopping decision, not a generation decision. Storing it on `cart_item` keeps the bundle snapshot clean and lets users change their minds without mutating the immutable record.

---

### 2.3 New table: `customer_order`

Named `customer_order` to avoid the SQL reserved word `ORDER`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigserial | PK | |
| `public_id` | varchar(30) | NOT NULL, UNIQUE | Format: `ord_<12hex>` (mirrors `gb_<12hex>`) |
| `user_id` | uuid | NULLABLE, FK → auth.users(id) ON DELETE SET NULL | Set only if user was signed in at checkout; NULL for anonymous orders |
| `session_id` | varchar(100) | NOT NULL | Session that placed the order — links back to cart_item history |
| `status` | varchar(20) | NOT NULL, default `'PENDING'` | See status lifecycle below |
| `subtotal` | numeric(10,2) | NOT NULL | Sum of all line_total values |
| `total` | numeric(10,2) | NOT NULL | Equals subtotal for now (no tax/shipping) |
| `currency` | varchar(3) | NOT NULL, default `'USD'` | ISO 4217 |
| `customer_email` | varchar(254) | NOT NULL | Collected at checkout — primary identifier for anonymous orders |
| `customer_name` | varchar(200) | NULLABLE | Collected at checkout |
| `payment_intent_id` | varchar(100) | NULLABLE | **Stripe stub** — null until payment integrated |
| `payment_status` | varchar(20) | NULLABLE | **Stripe stub** — null until payment integrated |
| `notes` | text | NULLABLE | Customer or admin notes |
| `created_at` | timestamptz | NOT NULL, default now() | |
| `updated_at` | timestamptz | NOT NULL, default now() | |

**Indexes:** `user_id` (partial, WHERE NOT NULL), `customer_email`, `created_at`, `status`

**`user_id` is nullable:** Orders can be placed without a user account. If the user is signed in at checkout, `user_id` is populated (enables order history page). If anonymous, only `customer_email` identifies the order. `ON DELETE SET NULL` means account deletion doesn't destroy order records — the email remains for fulfillment purposes.

---

### 2.4 New table: `order_line_item`

One row per cart item at the moment of checkout. Prices are locked server-side.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigserial | PK | |
| `customer_order_id` | bigint | NOT NULL, FK → customer_order(id) ON DELETE CASCADE | |
| `generated_bundle_id` | bigint | NOT NULL, FK → generated_bundle(id) ON DELETE RESTRICT | Blocks bundle deletion if part of any order |
| `upgrade_tier` | varchar(20) | NOT NULL | Snapshotted from cart_item at checkout |
| `gift_bag_option_id` | bigint | NULLABLE, FK → gift_bag_option(id) | Snapshotted from cart_item |
| `quantity` | smallint | NOT NULL, CHECK (quantity > 0) | |
| `unit_price` | numeric(10,2) | NOT NULL | Server-computed: base_retail_price + upgrade_adj + gift_bag_adj |
| `line_total` | numeric(10,2) | NOT NULL | `unit_price × quantity` |
| `gift_bag_name_snapshot` | varchar(100) | NULLABLE | Gift bag name at order time |
| `gift_bag_price_snapshot` | numeric(10,2) | NULLABLE | Gift bag retail_price_adjustment at order time |

**Index:** `customer_order_id`

**Why re-snapshot prices:** The order line item owns `unit_price` as the canonical "what we charged" record. Even though bundle snapshots are immutable today, having prices on the order line makes it self-contained for accounting, audit, and future discount/promotion logic without re-joining to generation tables.

---

## 3. Status Lifecycle

### `customer_order.status`

```
PENDING ──→ CONFIRMED ──→ FULFILLED ──→ COMPLETED
   │             │              │
   └──→ CANCELLED └──→ CANCELLED └──→ CANCELLED
                      │              │
                      └──→ REFUNDED  └──→ REFUNDED
```

| Status | Meaning | Trigger |
|--------|---------|---------|
| `PENDING` | Order created, awaiting payment confirmation | `POST /api/orders` |
| `CONFIRMED` | Payment received (manual for now; Stripe webhook later) | Admin PATCH |
| `FULFILLED` | Items assembled and shipped | Admin PATCH |
| `COMPLETED` | Customer received goods | Admin PATCH |
| `CANCELLED` | Cancelled before fulfillment | User or admin |
| `REFUNDED` | Payment returned | Admin (+ Stripe refund when integrated) |

**`cart_item` has no status.** A cart item either exists (in cart) or does not (removed or checked out). Items are deleted atomically when the order is created.

---

## 4. Checkout Flow (Two-Phase)

### Phase 1 — `POST /api/checkout/intent` (new: accepts cart in body)

The frontend sends the full cart along with shipping/contact info. The server:

```
Body: {
  email, name?, shippingStreet, shippingCity, shippingState, shippingZip, shippingCountry,
  items: [
    {
      bundlePublicId: string,          // public_id of the already-persisted bundle
      upgradeTier: 'STANDARD' | 'PREMIUM',
      giftBagOptionId: number | null,
      quantity: number
    }
  ]
}

1. For each item.bundlePublicId:
   - Look up the bundle by public_id (always present in DB since generation persists immediately)
   - Returns the internal DB id

2. Upsert cart_item rows (ON CONFLICT (session_id, generated_bundle_id) DO UPDATE)

3. Compute total server-side from DB price data (never trust client prices)

4. Create Stripe PaymentIntent with session_id + customer info in metadata

5. Return { clientSecret, totalCents }
```

### Phase 2 — Stripe webhook `payment_intent.succeeded`

Unchanged from original design — reads `cart_item` by `session_id` from DB (now populated by Phase 1):

```
1. SELECT ... FROM cart_item WHERE session_id = $1 FOR UPDATE
2. Compute unit prices server-side
3. INSERT customer_order
4. INSERT order_line_item (one per cart item)
5. DELETE cart_item WHERE session_id = $1
6. COMMIT
```

The `FOR UPDATE` lock prevents duplicate-webhook race conditions.

---

## 5. API Endpoints

### Cart — No auth required; `X-Session-Id` header required (`/api/cart`)

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/api/cart` | — | 200: cart with items, bundle summaries, computed prices |
| `POST` | `/api/cart/items` | `{ bundlePublicId, upgradeTier?, giftBagOptionId?, quantity? }` | 201: cart item |
| `PATCH` | `/api/cart/items/:id` | `{ upgradeTier?, giftBagOptionId?, quantity? }` | 200: updated cart item |
| `DELETE` | `/api/cart/items/:id` | — | 204 |
| `DELETE` | `/api/cart` | — | 204 |

All cart endpoints require the `X-Session-Id` header (returns 400 if missing). The session ID is a UUID generated once by the frontend and persisted in `localStorage`.

**`POST /api/cart/items`** resolves `bundlePublicId` to internal ID, then upserts on `UNIQUE(session_id, generated_bundle_id)` — adding the same bundle again updates the existing row rather than erroring.

### Orders — No auth required; `X-Session-Id` + body email required (`/api/orders`)

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/api/orders` | `{ email, name? }` | 201: order with `public_id`, line items, totals |
| `GET` | `/api/orders` | `?page=1&limit=20` | 200: paginated order list — **JWT required** (logged-in users only) |
| `GET` | `/api/orders/:publicId` | — | 200: full order with line items — no auth required (publicId is unguessable) |

`POST /api/orders` reads `X-Session-Id` to find cart items. JWT auth is optional — if a valid `Authorization: Bearer` header is present, `user_id` is stored on the order.

`GET /api/orders` (list) requires JWT — it queries by `user_id`. Anonymous users cannot list orders (they use the publicId confirmation page instead).

### Admin Orders — Basic auth (`/admin/api/orders`)

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/admin/api/orders` | `?status=&from=&to=&page=` | 200: paginated all orders |
| `GET` | `/admin/api/orders/:publicId` | — | 200: order detail |
| `PATCH` | `/admin/api/orders/:publicId/status` | `{ status }` | 200: updated order |

### Modified: Bundle generation

`POST /api/generated-bundles` remains **public** (no auth required). If a valid `Authorization: Bearer` header is present, `generated_bundle.user_id` is populated from the JWT. If absent, `user_id` stays null.

---

## 6. Files to Create / Modify

### Migration
| File | Action |
|------|--------|
| `backend-node/migrations/005_cart_and_orders.ts` | New — all DDL for this feature |

### Backend
| File | Action |
|------|--------|
| `backend-node/src/types/entities.ts` | Modify — add `CartItemRow`, `CustomerOrderRow`, `OrderLineItemRow` |
| `backend-node/src/repositories/cart.ts` | New — `getCart`, `addItem`, `updateItem`, `removeItem`, `clearCart` |
| `backend-node/src/repositories/orders.ts` | New — `createOrder` (transaction), `listOrders`, `findOrder`, `updateOrderStatus` |
| `backend-node/src/routes/user/cart.ts` | New — cart endpoints, JWT auth |
| `backend-node/src/routes/user/orders.ts` | New — user order endpoints, JWT auth |
| `backend-node/src/routes/admin/orders.ts` | New — admin order endpoints, Basic auth |
| `backend-node/src/app.ts` | Modify — mount new routers |
| `backend-node/src/repositories/generatedBundles.ts` | Modify — `saveBundle` accepts optional `userId` |
| `backend-node/src/services/bundleGeneration.ts` | Modify — forward `userId` from JWT (if present) to `saveBundle` |

### Specs / Docs
| File | Action |
|------|--------|
| `specs/db-entities.md` | Update ER diagram with new tables |

---

## 7. Verification

| # | Test | Expected |
|---|------|----------|
| 1 | `npm run migrate:local` | Migration 005 applies cleanly |
| 2 | `POST /api/generated-bundles` (no auth) | 201, `user_id = null` |
| 3 | `POST /api/generated-bundles` (with JWT) | 201, `user_id = <uuid>` |
| 4 | `GET /api/cart` (no auth) | 401 |
| 5 | `POST /api/cart/items` (valid JWT, valid bundlePublicId) | 201, cart item created |
| 6 | `POST /api/cart/items` (same bundle again) | 200, quantity updated (upsert) |
| 7 | `PATCH /api/cart/items/:id` (change upgradeTier) | 200, tier updated |
| 8 | `DELETE /api/cart/items/:id` | 204, item removed |
| 9 | `POST /api/orders` (cart has items) | 201, `public_id` starts with `ord_`, cart cleared |
| 10 | `POST /api/orders` (empty cart) | 400 or 422 |
| 11 | `GET /api/orders/:publicId` | 200, line items with correct `unit_price` |
| 12 | `PATCH /admin/api/orders/:publicId/status` (Basic auth) | 200, status updated |
| 13 | `GET /api/health` | 200 (no regression) |
