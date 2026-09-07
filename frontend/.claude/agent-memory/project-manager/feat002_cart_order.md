---
name: FEAT-002 Cart & Order — execution summary
description: Implementation record for the cart-and-order feature (FEAT-002), including the anonymous cart redesign (T15–T21)
type: project
---

FEAT-002 (Cart & Order Management) was fully implemented. Original 14 tasks completed 2026-08-31. Anonymous cart redesign (T15–T21) completed 2026-08-31.

**Why:** Adds cart-to-order flow on top of the immutable bundle snapshot engine. No payment processor in this phase — orders are manual fulfillment tracking. Cart was redesigned to be session-based (anonymous) after initial implementation.

**How to apply:** When working on FEAT-003 or later, the cart/order tables and routes are live. Cart does NOT require auth — it uses X-Session-Id (UUID from localStorage). Orders do NOT require auth for POST or GET /:publicId — only GET / (list) requires JWT. The order status lifecycle is PENDING→CONFIRMED→FULFILLED→COMPLETED (with CANCELLED/REFUNDED branches). The checkout transaction uses `sql.begin()` in `orders.ts`.

## Files created (original T1–T14)

### Backend
- `backend-node/migrations/005_cart_and_orders.ts` — DDL for cart_item (originally with user_id), customer_order, order_line_item + user_id column on generated_bundle
- `backend-node/src/types/entities.ts` — added CartItemRow, CustomerOrderRow, OrderLineItemRow; updated GeneratedBundleRow with user_id
- `backend-node/src/repositories/cart.ts` — all cart operations
- `backend-node/src/repositories/orders.ts` — checkout transaction + list/find/update
- `backend-node/src/routes/user/cart.ts` — /api/cart endpoints
- `backend-node/src/routes/user/orders.ts` — /api/orders endpoints
- `backend-node/src/routes/admin/orders.ts` — /admin/api/orders endpoints (Basic auth)
- `backend-node/src/routes/giftBagOptions.ts` — public /api/gift-bag-options endpoint
- Modified `generatedBundles.ts` + `bundleGeneration.ts` to accept optional userId
- Modified `app.ts` to mount all new routers

### Frontend
- `frontend/src/lib/cartApi.ts` — typed cart fetch wrappers
- `frontend/src/lib/ordersApi.ts` — typed orders fetch wrappers
- `frontend/src/contexts/CartContext.tsx` — global cart count + session ID management
- `frontend/src/components/NavBar.tsx` — MUI AppBar with auth-aware controls + cart badge for all users
- `frontend/src/pages/CartPage.tsx` — cart item cards, upgrade toggle, gift bag selector, quantity
- `frontend/src/pages/CheckoutPage.tsx` — payment placeholder, email field, contact form, POST /api/orders
- `frontend/src/pages/OrdersPage.tsx` — paginated order list with status chips (protected)
- `frontend/src/pages/OrderDetailPage.tsx` — line item table, success alert, public access by publicId
- `frontend/src/pages/admin/AdminOrdersPage.tsx` — admin order list with status filter
- `frontend/src/pages/admin/AdminOrderDetailPage.tsx` — admin detail with status update dropdown
- Modified `BundleCustomizationPage.tsx` — "Continue" button adds to cart directly (no auth check)
- Modified `LoginPage.tsx` — removed pendingBundlePublicId auto-add logic (no longer needed)
- Modified `App.tsx` — /cart, /checkout, /orders/:publicId are public; /orders (list) stays protected

## Migration sequence

- Migration 005: creates initial schema (run first)
- Migration 006 (`backend-node/migrations/006_anonymous_cart.ts`): anonymous cart changes — run `npm run migrate:local` after code deploy

## Anonymous cart redesign changes (T15–T21)

- `cart_item.user_id UUID NOT NULL` → `session_id VARCHAR(100) NOT NULL`; unique constraint updated to (session_id, generated_bundle_id)
- `customer_order.user_id` made nullable; `session_id VARCHAR(100) NOT NULL` added
- All cart endpoints: JWT auth removed, X-Session-Id header required (400 if missing)
- POST /api/orders: JWT auth removed; X-Session-Id required; body now needs `{ email, name? }`; JWT forwarded optionally for order history
- GET /api/orders/:publicId: JWT auth removed (publicId is unguessable)
- CartContext: manages session UUID in localStorage; exposes `sessionId`
- cartApi.ts: all functions take `sessionId` instead of `accessToken`
- ordersApi.ts: `createOrder` takes sessionId + email + optional JWT; `getOrder` needs no auth
- NavBar: cart icon shown to ALL users

## Deviations from design

1. `updateCartItem` in cart.ts uses a read-then-write pattern (fetch current row, merge fields, update) rather than pure SQL COALESCE/CASE, to handle the case where gift_bag_option_id can be intentionally set to NULL.

2. `CartProvider` was added as a new context (`contexts/CartContext.tsx`) not explicitly called out in the design doc — needed to share cart count and session ID across NavBar and cart-mutating pages.

3. `RootLayout` wrapper in App.tsx renders NavBar above all user-facing routes. Admin routes remain in their own layout without NavBar.

4. `findOrderByPublicId` retains the optional `userId` parameter (marked void internally) for forward compatibility, per design.md specification.

## Open items / follow-ups

- Migration 006 must be run: `npm run migrate:local` in `backend-node/`
- Migration 005 must also have been run (prerequisite)
- Payment processing (Stripe): schema stubs (payment_intent_id, payment_status) on customer_order are ready; no migration needed to wire Stripe later
- AC1.4 (auto-add after registration / Google OAuth) — the pendingBundlePublicId flow has been removed entirely. Users can add to cart without logging in, so this is no longer needed.
- The `OrdersPage` ("My Orders" list) remains protected by JWT — only signed-in users can list their orders
