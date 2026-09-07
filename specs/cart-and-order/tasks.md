# FEAT-002 — Cart & Order Management: Task Plan

> **Status:** In progress — T15–T21 added 2026-09-01 (anonymous cart redesign)
> **Last updated:** 2026-09-01

---

## Task Status Key

- `[ ]` pending
- `[-]` in progress
- `[x]` completed
- `[!]` blocked

---

## Tasks

### T1 — Migration 005 (backend-engineer)
**Status:** `[x]` completed
**File:** `backend-node/migrations/005_cart_and_orders.ts`
**Depends on:** nothing
**Requirements:** design.md §2

- Add nullable `user_id UUID` column to `generated_bundle` with FK → auth.users(id) ON DELETE SET NULL and partial index
- Create `cart_item` table (id, user_id, generated_bundle_id, upgrade_tier, gift_bag_option_id, quantity, created_at, updated_at) with UNIQUE(user_id, generated_bundle_id)
- Create `customer_order` table (id, public_id, user_id, status, subtotal, total, currency, customer_email, customer_name, payment_intent_id, payment_status, notes, created_at, updated_at)
- Create `order_line_item` table (id, customer_order_id, generated_bundle_id, upgrade_tier, gift_bag_option_id, quantity, unit_price, line_total, gift_bag_name_snapshot, gift_bag_price_snapshot)

---

### T2 — Backend entities + bundle generation update (backend-engineer)
**Status:** `[x]` completed
**Depends on:** T1
**Requirements:** design.md §2, §5; AC4.1

- Add `CartItemRow`, `CustomerOrderRow`, `OrderLineItemRow` to `entities.ts`
- Add `user_id?: string | null` to `GeneratedBundleRow`
- Update `saveBundle` in `generatedBundles.ts` to accept optional `userId`
- Update `BundleSnapshot` to include `userId`
- Update `generate()` and `GenerationRepos` to accept and forward `userId`
- Update bundle generation route to optionally extract userId from JWT (try/catch with jose jwtVerify)

---

### T3 — Cart repository (backend-engineer)
**Status:** `[x]` completed
**File:** `backend-node/src/repositories/cart.ts`
**Depends on:** T2
**Requirements:** design.md §5; AC4.1–AC4.6

- `getCartWithDetails(userId)` — joined fetch with bundle data
- `addOrUpdateCartItem(userId, generatedBundleId, upgradeTier, giftBagOptionId, quantity)` — upsert
- `updateCartItem(id, userId, data)` — update with user isolation
- `removeCartItem(id, userId)` — delete with user isolation
- `clearCart(userId)` — delete all for user
- `getCartItemCount(userId)` — COUNT(*) for badge

---

### T4 — Cart routes (backend-engineer)
**Status:** `[x]` completed
**File:** `backend-node/src/routes/user/cart.ts`
**Depends on:** T3
**Requirements:** design.md §5; AC4.1–AC4.6; AC3.1–AC3.12
Also: add `GET /api/gift-bag-options` public endpoint (no auth)

- `GET /` → getCartWithDetails + computed prices DTO
- `POST /items` — Zod body validation, resolve bundlePublicId → 404 if not found, addOrUpdateCartItem, 201
- `PATCH /items/:id` — Zod body, updateCartItem, 404 if not found/not owned
- `DELETE /items/:id` → removeCartItem, 204
- `DELETE /` → clearCart, 204
Mount at `/api/cart` in `app.ts`
Also create `GET /api/gift-bag-options` public route, mount in `app.ts`

---

### T5 — Orders repository (backend-engineer)
**Status:** `[x]` completed
**File:** `backend-node/src/repositories/orders.ts`
**Depends on:** T3
**Requirements:** design.md §4; AC5.6; AC6.1–AC6.8

- `createOrder(userId, userEmail, userName)` — atomic transaction per design.md §4
- `listUserOrders(userId, page, limit)` — paginated newest-first
- `findOrderByPublicId(publicId, userId?)` — with ownership check
- `listAllOrders(filters)` — admin: all orders filterable by status
- `updateOrderStatus(publicId, status)` — admin: update status

---

### T6 — Order routes + admin order routes (backend-engineer)
**Status:** `[x]` completed
**Depends on:** T5
**Requirements:** design.md §5; AC5.6–AC5.9; AC6.1–AC6.10; AC8.1–AC8.10

Files:
- `backend-node/src/routes/user/orders.ts` (JWT auth)
  - `POST /` → createOrder, 201. 400 if cart empty.
  - `GET /` → listUserOrders with pagination
  - `GET /:publicId` → findOrderByPublicId with user ownership check, 404 if not found

- `backend-node/src/routes/admin/orders.ts` (Basic auth)
  - `GET /` → listAllOrders with ?status=&page= filters
  - `GET /:publicId` → findOrderByPublicId (no ownership check)
  - `PATCH /:publicId/status` — Zod validate status enum, updateOrderStatus

Mount in `app.ts`: `/api/orders` and `/admin/api/orders`

---

### T7 — Frontend: API clients (frontend-engineer)
**Status:** `[x]` completed
**Depends on:** T6
**Requirements:** AC4.1–AC4.6; AC5.6; AC6.1

- `frontend/src/lib/cartApi.ts` — getCart, addToCart, updateCartItem, removeCartItem, clearCart
- `frontend/src/lib/ordersApi.ts` — createOrder, listOrders, getOrder

---

### T8 — Frontend: NavBar component (frontend-engineer)
**Status:** `[x]` completed
**Depends on:** T6
**Requirements:** R2 (AC2.1–AC2.8); R7 (AC7.1–AC7.3)

File: `frontend/src/components/NavBar.tsx`
- MUI AppBar + Toolbar
- Auth-aware: avatar+menu vs sign-in/register buttons
- Cart icon with live badge
- Integrate into App.tsx root layout

---

### T9 — Frontend: Cart page (frontend-engineer)
**Status:** `[x]` completed
**Depends on:** T7, T8
**Requirements:** R3 (AC3.1–AC3.12); R4 (AC4.1–AC4.7); R9 (AC9.2–AC9.6)

File: `frontend/src/pages/CartPage.tsx`
- Protected route
- Fetch cart on mount
- Cart item cards with upgrade toggle, gift bag selector, quantity, pricing
- Remove button, clear cart, subtotal/total, "Proceed to Payment" CTA
- Empty state

---

### T10 — Frontend: Checkout placeholder page (frontend-engineer)
**Status:** `[x]` completed
**Depends on:** T9
**Requirements:** R5 (AC5.1–AC5.9)

File: `frontend/src/pages/CheckoutPage.tsx`
- Protected route
- Read-only cart summary
- Payment placeholder notice
- Name + address form
- "Place Order" button → POST /api/orders → navigate to /orders/:publicId

---

### T11 — Frontend: Orders pages (frontend-engineer)
**Status:** `[x]` completed
**Depends on:** T10
**Requirements:** R6 (AC6.1–AC6.10); R7 (AC7.1–AC7.3)

Files:
- `frontend/src/pages/OrdersPage.tsx` — list with pagination, status chips
- `frontend/src/pages/OrderDetailPage.tsx` — detail with line items, success alert

---

### T12 — Frontend: Auth gate for bundle confirmation (frontend-engineer)
**Status:** `[x]` completed
**Depends on:** T9
**Requirements:** R1 (AC1.1–AC1.6)

- Modify `BundleCustomizationPage.tsx` "Continue" button to check auth and call addToCart or redirect to /login with pendingBundlePublicId
- Modify `LoginPage.tsx` to auto-add pending bundle after successful sign-in and navigate to /cart

---

### T13 — Frontend: Admin orders section (frontend-engineer)
**Status:** `[x]` completed
**Depends on:** T6, T8
**Requirements:** R8 (AC8.1–AC8.10)

- Add "Orders" link to `AdminNav.tsx`
- Create `frontend/src/pages/admin/AdminOrdersPage.tsx` — orders list with status filter
- Create `frontend/src/pages/admin/AdminOrderDetailPage.tsx` — detail with status update control
- Add routes to `App.tsx`

---

### T14 — Update App.tsx routes (frontend-engineer)
**Status:** `[x]` completed
**Depends on:** T9, T10, T11
**Requirements:** Route summary in requirements.md

Add to `App.tsx`:
- `/cart` → ProtectedRoute > CartPage
- `/checkout` → ProtectedRoute > CheckoutPage
- `/orders` → ProtectedRoute > OrdersPage
- `/orders/:publicId` → ProtectedRoute > OrderDetailPage

---

## Implementation Order (original T1–T14)

| Step | Tasks | Notes |
|------|-------|-------|
| 1 | T1 | No deps |
| 2 | T2 | After T1 |
| 3 | T3 | After T2 |
| 4 | T4, T5 | Both after T3, run in parallel |
| 5 | T6 | After T5 |
| 6 | T7, T8 | Both after T6, run in parallel |
| 7 | T9 | After T7, T8 |
| 8 | T10 | After T9 |
| 9 | T11, T12 | Both after T9/T10, run in parallel |
| 10 | T13 | After T6, T8 |
| 11 | T14 | After T9, T10, T11 |

---

## Design Change: Anonymous Cart (2026-09-01)

Cart no longer requires authentication. Tasks T15–T21 replace the auth-gated cart with a session-based anonymous cart. Key changes:

- `cart_item.user_id UUID NOT NULL` → `session_id VARCHAR(100) NOT NULL`
- `customer_order.user_id` becomes nullable; `session_id` and `customer_email` added
- All cart API endpoints drop JWT requirement; use `X-Session-Id` header instead
- `POST /api/orders` body now includes `{ email, name? }`; JWT is optional
- `/cart` and `/checkout` become public routes
- `/orders/:publicId` becomes public; `/orders` (list) remains protected (JWT)
- Frontend `CartContext` manages session ID from localStorage
- Auth gate on bundle confirm removed — add to cart directly

---

### T15 — Migration 006: anonymous cart schema (backend-engineer)
**Status:** `[x]` completed
**File:** `backend-node/migrations/006_anonymous_cart.ts`
**Depends on:** T1 (already applied)

- `ALTER TABLE cart_item DROP CONSTRAINT IF EXISTS cart_item_user_id_fkey`
- `ALTER TABLE cart_item DROP CONSTRAINT IF EXISTS cart_item_user_id_generated_bundle_id_key`
- `ALTER TABLE cart_item DROP COLUMN IF EXISTS user_id`
- `ALTER TABLE cart_item ADD COLUMN session_id VARCHAR(100) NOT NULL DEFAULT ''`
- `ALTER TABLE cart_item ALTER COLUMN session_id DROP DEFAULT`
- `ALTER TABLE cart_item ADD CONSTRAINT cart_item_session_bundle_unique UNIQUE(session_id, generated_bundle_id)`
- `CREATE INDEX idx_cart_item_session_id ON cart_item(session_id)`
- `ALTER TABLE customer_order ALTER COLUMN user_id DROP NOT NULL` (make nullable)
- `ALTER TABLE customer_order ADD COLUMN IF NOT EXISTS session_id VARCHAR(100) NOT NULL DEFAULT ''`
- `ALTER TABLE customer_order ALTER COLUMN session_id DROP DEFAULT`
- `CREATE INDEX idx_customer_order_email ON customer_order(customer_email)`
- `CREATE INDEX idx_customer_order_session ON customer_order(session_id)`

Use `pgm.sql()` for each statement since node-pg-migrate's `alterColumn` may not support all of these.

---

### T16 — Backend: update cart repository (backend-engineer)
**Status:** `[x]` completed
**File:** `backend-node/src/repositories/cart.ts`
**Depends on:** T15

Replace all `userId: string` params with `sessionId: string`. Update all SQL queries:
- `WHERE user_id = $1` → `WHERE session_id = $1`
- Upsert constraint: `ON CONFLICT (user_id, generated_bundle_id)` → `ON CONFLICT (session_id, generated_bundle_id)`
- Remove user-isolation checks on `updateCartItem` and `removeCartItem` (isolation is by session_id now)
- Update `CartItemRow` in entities.ts: replace `user_id` field with `session_id`

---

### T17 — Backend: update cart routes (backend-engineer)
**Status:** `[x]` completed
**File:** `backend-node/src/routes/user/cart.ts`
**Depends on:** T16

- Remove `jwtAuth` middleware from router
- Add `sessionId` extractor middleware: read `req.headers['x-session-id']` as string; if missing or empty → 400 ProblemDetail `{ type: 'about:bad-request', title: 'Bad Request', status: 400, detail: 'X-Session-Id header is required' }`
- Pass `sessionId` to all repository calls in place of `userId`
- Move file from `routes/user/cart.ts` to `routes/cart.ts` if appropriate (it's no longer user-specific), or keep path but remove user dependency

---

### T18 — Backend: update orders repository and routes (backend-engineer)
**Status:** `[x]` completed
**Files:** `backend-node/src/repositories/orders.ts`, `backend-node/src/routes/user/orders.ts`
**Depends on:** T17

**Repository changes (`orders.ts`):**
- `createOrder(sessionId, email, name, userId?)` — cart looked up by `session_id`; order inserts `session_id`, `customer_email`, nullable `user_id`
- `findOrderByPublicId(publicId, userId?)` — remove ownership enforcement (publicId is unguessable); if `userId` provided, still verify for the list endpoint
- `listUserOrders(userId, page, limit)` — unchanged (still requires userId)

**Route changes (`routes/user/orders.ts`):**
- `POST /` — remove `jwtAuth`; extract `sessionId` from `X-Session-Id` header (required, 400 if missing); Zod body: `{ email: z.string().email(), name: z.string().optional() }`; optionally extract userId from JWT if present (try/catch, no error if absent); call `createOrder(sessionId, email, name, userId)`
- `GET /` — keep `jwtAuth` required (list is login-only)
- `GET /:publicId` — remove `jwtAuth`; no ownership check (public by publicId)

---

### T19 — Frontend: update CartContext with session ID (frontend-engineer)
**Status:** `[x]` completed
**File:** `frontend/src/contexts/CartContext.tsx`
**Depends on:** T18

- On mount: read `localStorage.getItem('cart_session_id')`; if null, generate UUID v4 (`crypto.randomUUID()`), store in localStorage, set in state
- Export `sessionId` from CartContext so all cart API calls can access it
- Update `cartApi.ts`: replace `Authorization: Bearer ${accessToken}` header with `'X-Session-Id': sessionId` on all cart endpoints
- Update `ordersApi.ts` `createOrder`: send `X-Session-Id: sessionId` header + `{ email, name }` body; remove `accessToken` param. Keep `Authorization` header on `listOrders` (still JWT-protected).

---

### T20 — Frontend: remove auth gates from cart/checkout routes (frontend-engineer)
**Status:** `[x]` completed
**Files:** `frontend/src/App.tsx`, `frontend/src/pages/CartPage.tsx`, `frontend/src/pages/CheckoutPage.tsx`
**Depends on:** T19

- In `App.tsx`: remove `<ProtectedRoute>` wrapper from `/cart` and `/checkout` routes. Keep `<ProtectedRoute>` on `/orders` (list only). Remove `<ProtectedRoute>` from `/orders/:publicId`.
- `CartPage.tsx`: remove any auth checks; the page renders for all users.
- `CheckoutPage.tsx`: add required email field (MUI TextField, `type="email"`); if user is logged in, pre-fill from `session.user.email`; pass `{ email, name }` in `createOrder` body; remove `ProtectedRoute` dependency.
- Remove auth-gate logic from bundle confirmation page (T12 changes): replace the auth-check + redirect flow with a direct `addToCart` call using session ID.
- Update NavBar cart badge: fetch cart count using `X-Session-Id` (works for all users, not just authenticated).
- Update LoginPage: remove `pendingBundlePublicId` auto-add logic (no longer needed).

---

### T21 — Frontend: order detail page public access (frontend-engineer)
**Status:** `[x]` completed
**File:** `frontend/src/pages/OrderDetailPage.tsx`
**Depends on:** T20

- `GET /api/orders/:publicId` no longer requires auth — update `ordersApi.getOrder()` to not send `Authorization` header
- `OrderDetailPage` does not need to be wrapped in `ProtectedRoute`; any user with the publicId can view the confirmation
- `/orders` (list page) remains protected — keep `ProtectedRoute` there
- After `POST /api/orders` succeeds on CheckoutPage, navigate to `/orders/:publicId` (same as before)

---

## Implementation Order (T15–T21)

| Step | Tasks | Notes |
|------|-------|-------|
| 12 | T15 | Migration — run `npm run migrate:local` after |
| 13 | T16 | Cart repo — after T15 |
| 14 | T17 | Cart routes — after T16 |
| 15 | T18 | Orders repo + routes — after T17 |
| 16 | T19 | Frontend CartContext + API clients — after T18 |
| 17 | T20, T21 | Frontend route/page changes — after T19, run in parallel |
