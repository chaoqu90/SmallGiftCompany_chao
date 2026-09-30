---
name: Frontend-memory cart architecture
description: Cart moved from server-backed to localStorage + React state; DB writes only at checkout time
type: project
---

Cart items and bundles are no longer saved to DB during browsing. The cart lives entirely in localStorage + React state (`LocalCartItem[]` in CartContext). DB writes happen only when the user clicks "Continue to Payment".

**Why:** Simplifies browsing flow, removes round-trip latency on bundle customization page, avoids stale server-side cart state.

**How to apply:** When working on cart-related features, never call `addToCart`, `updateCartItem`, or `removeCartItem` from cartApi for normal browsing interactions. Use `addItem`, `updateItem`, `removeItem` from CartContext instead. The `createPaymentIntent` call in ordersApi.ts now receives the full `items` array in its body — this is the single DB write moment. `getCart` from cartApi is no longer called anywhere in the browsing flow; `refreshCart` and `setCartCount` are no-ops kept for interface compatibility.
