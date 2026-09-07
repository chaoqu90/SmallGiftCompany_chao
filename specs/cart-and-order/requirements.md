# Cart & Order Management — Requirements

> **Feature ID:** FEAT-002
> **Status:** Draft — revised 2026-09-01 (anonymous cart)
> **Last updated:** 2026-09-01
> **Conforms to:** `specs/tech-overview.md` (golden copy)
> **Technical design:** `specs/cart-and-order/design.md`

---

## Overview

This feature introduces a cart-to-order flow on top of the existing immutable bundle recommendation engine. **No login is required to add to cart or check out.** The cart is keyed by a session ID (UUID stored in the browser's localStorage, sent as `X-Session-Id` on every cart/checkout request). Customer email is collected at checkout and is the primary identifier for anonymous orders. Logged-in users additionally get order history. An admin order management section allows operators to track and advance order status for fulfillment.

---

## R1 — Bundle Confirmation and Add to Cart (No Login Required)

**User story:** As a visitor who has filled in the gift questionnaire and confirmed a bundle, I want to add it to my cart immediately without being forced to create an account.

**Context:** The bundle generation page ends with the user clicking "Confirm" or "Add to Cart". The system adds the bundle to the server-side cart using the session ID from localStorage. No auth check is performed.

### Acceptance Criteria

**AC1.1 — Add to cart (no auth required)**
WHEN a user clicks "Add to Cart" on a generated bundle THEN the system SHALL call `POST /api/cart/items` with the bundle's `public_id`, the `X-Session-Id` header, and default `upgradeTier = 'STANDARD'` AND navigate the user to `/cart` on a 201 response. No login check is performed.

**AC1.2 — Session ID initialization**
WHEN the application loads for the first time AND no `cart_session_id` key exists in `localStorage` THEN the frontend SHALL generate a UUID v4, store it in `localStorage` as `cart_session_id`, and use it as the `X-Session-Id` header on all subsequent cart requests.

**AC1.3 — Session ID persistence**
WHEN the application loads AND a `cart_session_id` key exists in `localStorage` THEN the frontend SHALL use the stored value as the `X-Session-Id` header. The session ID persists across page reloads and browser sessions until localStorage is cleared.

**AC1.4 — Add to cart failure**
WHEN `POST /api/cart/items` fails (network error or 4xx/5xx) THEN the user SHALL see an inline error message on the bundle page. The user SHALL NOT be navigated to `/cart`.

**AC1.5 — Cart page accessible without login**
WHEN an unauthenticated user navigates to `/cart` THEN the cart page SHALL render normally (no redirect). If the cart is empty, the empty state is shown.

---

## R2 — Top Navigation Banner

**User story:** As a user, I want a persistent header visible on every page so that I can always access my cart and account from anywhere in the app.

**Context:** The header is a new MUI `AppBar` component mounted above the router outlet in the root layout so it appears on all pages without re-rendering between navigation events.

### Acceptance Criteria

**AC2.1 — Header renders on all pages**
WHEN any page in the application is rendered THEN the top navigation `AppBar` SHALL be visible at the top of the viewport on all routes including `/`, `/cart`, `/checkout`, `/orders`, `/orders/:publicId`, `/login`, `/register`, `/profile`, and `/admin`.

**AC2.2 — Authenticated state: profile icon**
WHEN `AuthContext.session` is non-null THEN the header SHALL display a MUI `IconButton` containing a MUI `Avatar`. The avatar SHALL show the user's `displayName` initial if `displayName` is set in their profile, otherwise the first character of their email address. Clicking the icon opens a MUI `Menu` dropdown.

**AC2.3 — Profile dropdown contents**
WHEN the profile `Menu` is open THEN it SHALL contain exactly three `MenuItem` entries in order: "Profile" (navigates to `/profile`), "My Orders" (navigates to `/orders`), "Sign Out" (calls `supabase.auth.signOut()` then navigates to `/`).

**AC2.4 — Cart icon with live badge (always visible)**
The header SHALL always display a MUI `IconButton` with a shopping cart icon regardless of auth state. A MUI `Badge` SHALL show the total quantity of items in the session cart (fetched from `GET /api/cart` using `X-Session-Id`). Clicking the icon navigates to `/cart`.

**AC2.5 — Cart badge count reflects live server state**
WHEN the user adds or removes items from the cart THEN the badge count SHALL update to reflect the new server state without requiring a full page reload. The count is fetched on initial load and updated in `CartContext` after every successful cart operation.

**AC2.6 — Badge hidden when count is zero**
WHEN the session cart is empty (zero items) THEN the cart badge SHALL not be rendered (`showZero={false}`). The cart icon itself remains visible.

**AC2.7 — Unauthenticated state: sign in / register links**
WHEN `AuthContext.session` is null THEN the header SHALL display text links "Sign In" (navigates to `/login`) and "Register" (navigates to `/register`) in place of the profile icon. The cart icon with badge is still shown (cart works without auth).

**AC2.8 — Loading state**
WHEN `AuthContext.loading` is true (session check in progress on initial page load) THEN the header SHALL render a skeleton or neutral state (no profile icon, no cart icon, no sign in/register links) so that the header does not flicker between authenticated and unauthenticated appearances.

---

## R3 — Shopping Cart Page

**User story:** As an authenticated user, I want to review all bundles in my cart with their configuration options before committing to an order so that I can adjust my choices and verify the totals.

**Context:** `/cart` is a protected route. The page fetches cart contents from `GET /api/cart`. Each `cart_item` row is displayed as a card showing bundle summary, upgrade tier toggle, gift bag selector, quantity selector, line pricing, and a remove button. See `design.md` Section 5 for the `GET /api/cart` response shape.

### Acceptance Criteria

**AC3.1 — Public route (no login required)**
`/cart` is a public route. Unauthenticated users SHALL be able to view and manage their cart. The cart contents are determined by the `X-Session-Id` header (from `localStorage`), not by the user's account.

**AC3.2 — Cart item card: bundle summary**
WHEN the cart page renders a cart item THEN the item card SHALL display the following fields from the `generated_bundle` snapshot: interest category, recipient age, party type, and budget tier label. These fields are read-only on this page.

**AC3.3 — Cart item card: upgrade tier toggle**
WHEN a cart item card is rendered THEN it SHALL display a MUI `ToggleButtonGroup` with two options — "Standard" and "Premium" — reflecting the current `upgrade_tier` on the `cart_item` row. Selecting the other option SHALL call `PATCH /api/cart/items/:id` with `{ upgradeTier: 'STANDARD' | 'PREMIUM' }` and update the displayed unit price and line total on success.

**AC3.4 — Cart item card: gift bag selector**
WHEN a cart item card is rendered THEN it SHALL display a MUI `Select` (dropdown) populated with all currently active gift bag options fetched from the backend, plus a "No gift bag" option (value null). The current selection SHALL reflect `gift_bag_option_id` on the cart item. Changing the selection SHALL call `PATCH /api/cart/items/:id` with `{ giftBagOptionId: <id> | null }` and update the displayed unit price and line total on success.

**AC3.5 — Cart item card: quantity selector**
WHEN a cart item card is rendered THEN it SHALL display a numeric quantity input (MUI `TextField` type="number" or equivalent increment/decrement buttons) reflecting `cart_item.quantity`. The minimum value is 1. Changing the quantity SHALL call `PATCH /api/cart/items/:id` with `{ quantity: <n> }` and update the line total on success. Submitting quantity 0 or a negative number SHALL show an inline validation error and not call the API.

**AC3.6 — Cart item card: pricing display**
WHEN a cart item card is rendered THEN it SHALL display:
- Unit price (computed server-side: `base_retail_price + upgrade_adjustment + gift_bag_adjustment`)
- Line total (`unit_price × quantity`)

Both values SHALL be formatted as USD currency (e.g., `$12.50`). Prices are read from the server response and never computed in the browser.

**AC3.7 — Cart item remove button**
WHEN the user clicks the remove button on a cart item THEN the system SHALL call `DELETE /api/cart/items/:id`. On a 204 response the item SHALL be removed from the displayed list and the cart badge count in the header SHALL decrement. The remove button SHALL be a MUI `IconButton` with a trash/delete icon.

**AC3.8 — Order subtotal and total**
WHEN the cart contains one or more items THEN the cart page SHALL display a summary section showing: subtotal (sum of all line totals), and total (equal to subtotal in this phase — no tax or shipping). Both SHALL be formatted as USD currency.

**AC3.9 — "Proceed to Payment" button**
WHEN the cart contains one or more items THEN the cart page SHALL display a "Proceed to Payment" MUI `Button` (variant="contained"). Clicking it navigates to `/checkout`.

**AC3.10 — "Proceed to Payment" disabled when cart is empty**
WHEN the cart contains zero items THEN the "Proceed to Payment" button SHALL be rendered as `disabled`. See also AC9.2.

**AC3.11 — Empty cart state**
WHEN `GET /api/cart` returns an empty items array THEN the cart page SHALL display an empty-state illustration or message (e.g., "Your cart is empty") and a MUI `Button` CTA that navigates to the bundle generation page (root `/` or the questionnaire path).

**AC3.12 — Loading state**
WHEN the cart page is fetching data from `GET /api/cart` THEN each cart item area SHALL display a MUI `Skeleton` placeholder of approximately the same height as a cart item card. The "Proceed to Payment" button SHALL be disabled during loading.

---

## R4 — Cart Persistence

**User story:** As an authenticated user, I want my cart contents to be saved on the server so that items I add are still present if I close the browser and return later.

**Context:** Cart state lives entirely in the `cart_item` database table. There is no localStorage cart. All cart mutations go through the backend REST endpoints defined in `design.md` Section 5.

### Acceptance Criteria

**AC4.1 — Server-side add**
WHEN a user adds a bundle to the cart THEN the system SHALL call `POST /api/cart/items` with body `{ bundlePublicId, upgradeTier?, giftBagOptionId?, quantity? }` as defined in `design.md` Section 5. The server SHALL resolve `bundlePublicId` to the internal `generated_bundle.id` and upsert on the `UNIQUE(user_id, generated_bundle_id)` constraint.

**AC4.2 — Duplicate add behavior (upsert)**
WHEN `POST /api/cart/items` is called with a `bundlePublicId` that already has a `cart_item` row for this user THEN the server SHALL update the existing row's quantity (incrementing by the requested quantity) rather than returning an error. The response SHALL be HTTP 200 with the updated cart item. The frontend SHALL update the header badge count accordingly.

**AC4.3 — Server-side update**
WHEN a user changes the upgrade tier, gift bag selection, or quantity on an existing cart item THEN the system SHALL call `PATCH /api/cart/items/:id` with only the changed fields. The server SHALL return 200 with the full updated cart item including recomputed pricing.

**AC4.4 — Server-side remove**
WHEN a user removes a cart item THEN the system SHALL call `DELETE /api/cart/items/:id`. The server SHALL return 204 with no body.

**AC4.5 — Cart count accuracy**
WHEN the authenticated user's cart state changes (add, update quantity, remove) THEN the cart item count shown in the header badge SHALL reflect the current sum of all `cart_item.quantity` values for that user, sourced from the most recent successful server response.

**AC4.6 — Cart count on initial load**
WHEN an authenticated user first loads any page in the app THEN the cart API SHALL be queried once via `GET /api/cart` to hydrate the badge count. This call SHALL be initiated in a global cart context or equivalent, not re-fired on every route change.

**AC4.7 — No anonymous cart**
WHEN an unauthenticated user interacts with the bundle generation flow THEN no cart data SHALL be stored in localStorage, sessionStorage, or any client-side persistence mechanism. The `pendingBundlePublicId` in route state (R1) is the only form of pre-auth state transfer, and it is cleared after use.

---

## R5 — Checkout Placeholder Page

**User story:** As a visitor with items in my cart, I want to review my order and submit it — without creating an account — so that the business can begin preparing my shipment, even though payment processing is not yet active.

**Context:** `/checkout` is a **public route** (no login required). It is a placeholder for future payment integration. The page shows a read-only order summary pulled from the session cart, a contact form (email required, name optional), and a "Place Order" button. No real payment processor is called. The customer's email address collected here is the primary identifier for the order.

### Acceptance Criteria

**AC5.1 — Public route (no login required)**
WHEN any user (authenticated or not) navigates to `/checkout` THEN the checkout page SHALL render. No redirect to login occurs. If the user is already signed in, their email is pre-filled in the email field.

**AC5.2 — Order summary (read-only)**
WHEN the checkout page loads THEN it SHALL display a read-only summary of all current cart items, each showing: bundle summary label, upgrade tier, gift bag option name (or "No gift bag"), quantity, unit price, and line total. The order subtotal and total SHALL be displayed below the item list. All prices are read from `GET /api/cart` — they are never input by the user or computed in the browser.

**AC5.3 — Payment placeholder notice**
WHEN the checkout page is rendered THEN it SHALL display a clearly visible notice (MUI `Alert` severity="info" or equivalent) stating that payment is not processed in this version and the order will be submitted for manual processing. The notice SHALL appear above the contact form.

**AC5.4 — Contact form fields**
WHEN the checkout page renders the contact form THEN it SHALL include:
- "Full Name" text field (MUI `TextField`, pre-populated from `user_profile.display_name` if set)
- "Shipping Address" multi-line text field (MUI `TextField` multiline)

Both fields are required to submit the order (AC5.6). No address format validation beyond non-empty is required in this phase.

**AC5.5 — "Place Order" button**
WHEN the checkout page is rendered THEN it SHALL display a "Place Order" MUI `Button` (variant="contained"). The button is enabled only when both contact form fields are non-empty and the cart is non-empty.

**AC5.6 — Order submission**
WHEN the user clicks "Place Order" with valid form fields THEN the system SHALL call `POST /api/orders` with a Bearer token (no request body — the server builds the order from the authenticated user's cart rows). On a 201 response the system SHALL navigate to `/orders/:publicId` where `:publicId` is the `public_id` returned in the response. The contact form fields (name and address) are passed as query parameters or stored in route state for display on the confirmation page; they are NOT sent in the order POST body (the backend reads name from `user_profile`).

**AC5.7 — "Place Order" loading state**
WHEN the "Place Order" button has been clicked and the `POST /api/orders` call is in flight THEN the button SHALL display a MUI `CircularProgress` spinner and be disabled to prevent double submission.

**AC5.8 — Order creation failure**
WHEN `POST /api/orders` returns a non-2xx response THEN the checkout page SHALL display an inline MUI `Alert` severity="error" with the message "Order submission failed. Your cart has been preserved — please try again." The cart SHALL NOT be modified on the client side.

**AC5.9 — Empty cart guard**
WHEN `GET /api/cart` on the checkout page load returns an empty cart THEN the "Place Order" button SHALL be disabled and a notice SHALL inform the user their cart is empty, with a link back to `/cart`.

---

## R6 — Order Confirmation and Orders Pages

**User story:** As a user who has placed an order, I want to see confirmation and be able to review my order detail, regardless of whether I have an account.

**Context:** Order visibility spans three pages: the order confirmation/detail page (`/orders/:publicId` — public, accessible by anyone with the link), and the orders list page (`/orders` — protected, for signed-in users only). `GET /api/orders/:publicId` requires no auth (the publicId is unguessable). `GET /api/orders` requires JWT. Data sourced per `design.md` Section 5.

### Acceptance Criteria

**AC6.1 — Order confirmation redirect**
WHEN `POST /api/orders` returns a 201 response THEN the system SHALL navigate to `/orders/:publicId` using the `public_id` from the response body. The confirmation page and the order detail page share the same route and component.

**AC6.2 — Order detail page: header info**
WHEN `/orders/:publicId` is rendered THEN the page SHALL display:
- Order ID: the `public_id` value (e.g., `ord_a1b2c3d4e5f6`)
- Order status (styled MUI `Chip` with color coding: PENDING=default, CONFIRMED=info, FULFILLED=warning, COMPLETED=success, CANCELLED=error, REFUNDED=default)
- Order creation date formatted as a human-readable date string
- Order total formatted as USD currency

**AC6.3 — Order detail page: line items**
WHEN `/orders/:publicId` is rendered THEN each `order_line_item` SHALL be displayed in a table or card list showing: bundle summary (interest, age, party type, budget tier), upgrade tier, gift bag name (or "No gift bag"), quantity, unit price, and line total. All values are sourced from the `order_line_item` snapshot fields — they are not re-fetched from `generated_bundle`.

**AC6.4 — Order detail page: new order indicator**
WHEN the user arrives at `/orders/:publicId` immediately after checkout (i.e., navigated from the checkout flow) THEN the page SHALL display a MUI `Alert` severity="success" confirming "Your order has been placed. We will prepare your shipment." This alert is shown only on the initial post-checkout navigation and not on subsequent direct visits to the same URL.

**AC6.5 — Orders list page: protected route**
WHEN an unauthenticated user navigates to `/orders` THEN the `ProtectedRoute` component SHALL redirect them to `/login`.

**AC6.6 — Orders list page: order rows**
WHEN `/orders` is rendered for an authenticated user with past orders THEN the page SHALL display a list of all orders sorted newest-first. Each row SHALL show: order `public_id`, status chip, total (USD), item count, and creation date. Each row SHALL be clickable and navigate to `/orders/:publicId`.

**AC6.7 — Orders list page: empty state**
WHEN `GET /api/orders` returns an empty array THEN the page SHALL display an empty-state message "You have not placed any orders yet" and a CTA button navigating to the bundle generation page.

**AC6.8 — Orders list page: pagination**
WHEN the user has more than 20 orders THEN the orders list SHALL display a MUI `Pagination` component allowing navigation between pages. The page number is passed as `?page=N` to `GET /api/orders?page=N&limit=20`.

**AC6.9 — Order detail page: loading state**
WHEN `GET /api/orders/:publicId` is in flight THEN the page SHALL display MUI `Skeleton` placeholders for the header info section and line items table.

**AC6.10 — Order detail page: not found**
WHEN `GET /api/orders/:publicId` returns 404 THEN the page SHALL display "Order not found" and a link back to `/orders`.

---

## R7 — User Profile Menu — My Orders Entry

**User story:** As an authenticated user, I want easy access to my order history from the profile menu in the header so that I can review past purchases without hunting for the URL.

**Context:** The profile dropdown (AC2.3) already specifies a "My Orders" entry. This requirement governs the destination route and its auth protection.

### Acceptance Criteria

**AC7.1 — "My Orders" entry in profile menu**
WHEN the profile dropdown menu is open THEN "My Orders" SHALL appear as the second `MenuItem` (between "Profile" and "Sign Out"). Clicking it SHALL navigate to `/orders` and close the menu.

**AC7.2 — Protected destination**
WHEN a user navigates to `/orders` or `/orders/:publicId` without an active session THEN the `ProtectedRoute` component SHALL redirect to `/login`. This is consistent with AC6.5 and AC6.1.

**AC7.3 — Menu closes on navigation**
WHEN any `MenuItem` in the profile dropdown is clicked THEN the MUI `Menu` SHALL close regardless of the navigation outcome.

---

## R8 — Admin Order Management

**User story:** As an admin, I want to see all customer orders with full item details from the admin panel so that I can prepare shipments and advance orders through fulfillment stages.

**Context:** The existing admin panel lives at `/admin` and is protected by HTTP Basic auth (managed in the frontend, not by `ProtectedRoute`). A new "Orders" section is added to the admin nav. All admin order endpoints are defined in `design.md` Section 5 under `/admin/api/orders` and require HTTP Basic auth credentials. The frontend sends the Basic auth header on every admin API call consistent with the existing admin pattern.

### Acceptance Criteria

**AC8.1 — Admin nav: Orders section**
WHEN the admin panel at `/admin` is rendered THEN the sidebar or top navigation SHALL include an "Orders" link that navigates to the admin orders list view (e.g., `/admin/orders` or a tab within the admin SPA). The exact nav pattern SHALL match the existing admin panel's navigation style.

**AC8.2 — Admin orders list: columns**
WHEN the admin orders list view is rendered THEN it SHALL display a MUI `DataGrid` or table with the following columns: Order ID (`public_id`), Customer Email (`customer_email`), Status (as a styled chip), Total (USD), Item Count, Created Date. Rows SHALL be sorted newest-first by default.

**AC8.3 — Admin orders list: pagination**
WHEN the admin orders list is rendered THEN it SHALL be paginated. The page size SHALL default to 20. Page and status filter parameters SHALL be passed as query strings to `GET /admin/api/orders?page=N&limit=20&status=<status>`.

**AC8.4 — Admin orders list: status filter**
WHEN the admin orders list is rendered THEN it SHALL include a status filter control (MUI `Select` or `ToggleButtonGroup`) with options: All, PENDING, CONFIRMED, FULFILLED, COMPLETED, CANCELLED, REFUNDED. Selecting a status SHALL reload the list with `?status=<status>` appended to the query. "All" sends no `status` param.

**AC8.5 — Admin orders list: row click**
WHEN an admin clicks any row in the orders list THEN the view SHALL navigate to the admin order detail view for that order (e.g., `/admin/orders/:publicId`).

**AC8.6 — Admin order detail: customer info**
WHEN the admin order detail view for `/admin/orders/:publicId` is rendered THEN it SHALL display: order `public_id`, customer email, customer name (if set), order status chip, created date, order total.

**AC8.7 — Admin order detail: line items table**
WHEN the admin order detail view is rendered THEN it SHALL display all line items in a table with columns: Bundle Summary (interest, age, party type, budget tier), Upgrade Tier, Gift Bag (name or "None"), Quantity, Unit Price, Line Total. The order total SHALL appear as a summary row below the table.

**AC8.8 — Admin order detail: status update**
WHEN the admin views an order detail THEN they SHALL see a MUI `Select` or segmented control showing the current status. Selecting a new status value SHALL call `PATCH /admin/api/orders/:publicId/status` with body `{ status: '<new_status>' }` and the Basic auth header. On a 200 response the displayed status SHALL update without a full page reload.

**AC8.9 — Admin status transitions**
The status update control SHALL only offer valid forward transitions per the lifecycle defined in `design.md` Section 3:
- PENDING → CONFIRMED, CANCELLED
- CONFIRMED → FULFILLED, CANCELLED, REFUNDED
- FULFILLED → COMPLETED, CANCELLED, REFUNDED
- COMPLETED, CANCELLED, REFUNDED → no further transitions (control disabled or hidden)

**AC8.10 — Admin order detail: loading and error states**
WHEN `GET /admin/api/orders/:publicId` is in flight THEN the page SHALL show MUI `Skeleton` placeholders. WHEN it returns 404 THEN the page SHALL show "Order not found" with a back link.

---

## R9 — Error States and Edge Cases

**User story:** As a user or admin, I want the system to handle errors predictably so that my data is never silently lost or corrupted and I understand what went wrong.

### Acceptance Criteria

**AC9.1 — Duplicate add (upsert) feedback**
WHEN a user adds a bundle to the cart that already has a `cart_item` row for their account THEN the server SHALL upsert (update quantity, per AC4.2) and return 200. The frontend SHALL update the cart badge count and navigate to `/cart`. No "already in cart" error message is shown — the upsert is silent and the updated cart state speaks for itself.

**AC9.2 — Empty cart blocks checkout**
WHEN the user's cart is empty THEN the "Proceed to Payment" button on the cart page SHALL be rendered as `disabled` (MUI `Button disabled`). No navigation to `/checkout` is possible from the UI. Direct URL access to `/checkout` with an empty cart triggers AC5.9.

**AC9.3 — Unavailable bundle in cart**
WHEN `GET /api/cart` returns a cart item whose `generated_bundle` record has been deleted (the cart item's `generated_bundle_id` FK was cascade-deleted and the item itself is gone) THEN the item simply no longer appears in the response — the cascade deletion on `cart_item.generated_bundle_id` removes the row. No special "item unavailable" UI state is required for this case.

WHEN `GET /api/cart` returns a cart item whose `generated_bundle` exists but has been soft-marked inactive (if such a mechanism exists in future) THEN the cart item card SHALL display an inline warning "This item may no longer be available" and the remove button SHALL remain accessible.

**AC9.4 — Network error on cart add**
WHEN `POST /api/cart/items` fails due to a network error or non-2xx server response THEN the system SHALL display an inline MUI `Alert` severity="error" in the vicinity of the "Confirm" button on the bundle page with message "Could not add to cart. Please try again." The user SHALL remain on the bundle confirmation page. No navigation to `/cart` occurs.

**AC9.5 — Network error on cart update (tier/gift bag/quantity)**
WHEN `PATCH /api/cart/items/:id` fails THEN the cart item card SHALL display an inline error message "Could not save changes. Please try again." The control (toggle, dropdown, or quantity input) SHALL revert to its previous value (optimistic updates are NOT used — update the UI only on confirmed 200 response).

**AC9.6 — Network error on cart remove**
WHEN `DELETE /api/cart/items/:id` fails THEN the cart item card SHALL display an inline error "Could not remove item. Please try again." The item SHALL remain in the displayed list.

**AC9.7 — Order creation failure preserves cart**
WHEN `POST /api/orders` returns a non-2xx response THEN the checkout page SHALL display the error described in AC5.8. The cart SHALL remain intact on the server (the transaction in `design.md` Section 4 rolls back on failure, leaving `cart_item` rows untouched). The client SHALL NOT clear cart state on a failed order submission.

**AC9.8 — JWT expiry during cart session**
WHEN an API call returns 401 (expired or invalid JWT) during a cart or order operation THEN the system SHALL redirect the user to `/login` with the current path in route state so they can re-authenticate and return. The in-progress cart operation is abandoned (not retried automatically).

**AC9.9 — Admin: invalid status transition**
WHEN the admin attempts to submit a status transition not permitted by the lifecycle (AC8.9) THEN the backend SHALL return a 422 response with RFC 7807 `ProblemDetail` `type: "about:validation-error"`. The admin UI SHALL display the error message from the response body inline near the status control.

---

## Route Summary

| Path | Auth Required | Auth Mechanism | Notes |
|------|--------------|----------------|-------|
| `/cart` | Yes | Supabase JWT via `ProtectedRoute` | Redirects to `/login` if unauthenticated |
| `/checkout` | Yes | Supabase JWT via `ProtectedRoute` | Redirects to `/login` if unauthenticated |
| `/orders` | Yes | Supabase JWT via `ProtectedRoute` | Redirects to `/login` if unauthenticated |
| `/orders/:publicId` | Yes | Supabase JWT via `ProtectedRoute` | Redirects to `/login` if unauthenticated |
| `/admin/orders` | Yes | HTTP Basic (existing admin pattern) | Handled by existing admin auth layer |
| `/admin/orders/:publicId` | Yes | HTTP Basic (existing admin pattern) | Handled by existing admin auth layer |

All API calls to `/api/cart/**` and `/api/orders/**` require `Authorization: Bearer <supabase_access_token>` per the JWT middleware defined in `specs/user-management/design.md` Section 5.

All API calls to `/admin/api/orders/**` require `Authorization: Basic <base64(user:pass)>` consistent with all other `/admin/api/**` endpoints per `specs/tech-overview.md` Section 5.

---

## UI Component Conventions

These conventions apply across all pages in this feature to maintain consistency with the existing frontend:

- **Layout:** MUI `Container` with `maxWidth="md"` for content pages; `AppBar` extends full width.
- **Cards:** MUI `Card` + `CardContent` for cart item cards and order line item cards.
- **Tables:** MUI `Table`/`TableRow`/`TableCell` for order detail line item tables; MUI `DataGrid` acceptable for admin order list if already used in the admin panel.
- **Buttons:** Primary actions use `variant="contained"`; secondary/destructive actions use `variant="outlined"` or `variant="text"`.
- **Alerts:** MUI `Alert` for all inline error and success messages — never `window.alert()`.
- **Loading:** MUI `CircularProgress` for button loading states; MUI `Skeleton` for page-level data loading.
- **Currency:** All monetary values formatted with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` or equivalent.
- **Dates:** All dates formatted with `Intl.DateTimeFormat` in the user's local timezone.
