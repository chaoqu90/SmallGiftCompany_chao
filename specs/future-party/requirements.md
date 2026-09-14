# Future Party — Requirements

> **Feature ID:** FEAT-004
> **Status:** Updated — 2026-09-10
> **Conforms to:** `specs/tech-overview.md` (golden copy)
> **Technical design:** `specs/future-party/design.md`

---

## Overview

Some shoppers are planning a party weeks or months in advance and are not ready to build a bundle today. This feature lets them register their interest early by providing an email address, party date, kid gender, and kid age. The data is stored so the admin can later generate a tailored bundle and email it to the parent as a ready-to-buy link — creating a warm lead with a personalised recommendation.

The admin workflow has three steps: (1) generate or associate a bundle for the submission, (2) optionally review and swap items in an admin-only bundle preview page, and (3) send the personalised link to the parent.

---

## R1 — "Plan For Future" Entry Point on the Landing Page

**User story:** As a visitor who is not ready to order today, I want a clear call-to-action on the homepage so that I can register my future party details without having to navigate elsewhere.

**Context:** `frontend/src/pages/HomePage.tsx` currently has a single "BUILD YOURS NOW" button (coral, `COLORS.coral`) in the hero section. A second button is added below it.

### Acceptance Criteria

**AC1.1 — Button placement**
WHEN the homepage renders THEN the system SHALL display a "Plan For Future" button directly below the "BUILD YOURS NOW" button in the hero section. The two buttons SHALL be stacked vertically on mobile and may sit side-by-side or stacked on wider viewports.

**AC1.2 — Button style**
The "Plan For Future" button SHALL use the MUI `outlined` variant (not `contained`) so it is visually secondary to "BUILD YOURS NOW". It SHALL share the same `size="large"` and horizontal padding. Its color SHALL be `COLORS.coral` on border and text, consistent with the site palette.

**AC1.3 — Button triggers modal**
WHEN the visitor clicks "Plan For Future" THEN the system SHALL open a modal dialog containing the future party registration form. The homepage hero content SHALL remain visible in the background (standard MUI Dialog backdrop).

**AC1.4 — No navigation**
WHEN the visitor clicks "Plan For Future" THEN the browser URL SHALL NOT change. The modal opens in place.

---

## R2 — Future Party Registration Form (Modal)

**User story:** As a visitor who wants to plan ahead, I want to provide my email, the party date, the kid's gender, and the kid's age in a simple form so that the site can prepare a personalised bundle recommendation for me.

**Context:** The modal is a standard MUI `Dialog`. All four fields are required.

### Acceptance Criteria

**AC2.1 — Form fields**
WHEN the modal is open THEN the system SHALL display all four of the following fields in order:
1. **Email** — a text input that accepts a valid email address.
2. **Party date** — a date input that accepts a calendar date.
3. **Kid gender** — a selection control (chip row or radio group) with exactly three options: **Boy**, **Girl**, **Mixed / Either**.
4. **Kid age** — a numeric input or chip row accepting integer values from 1 to 12 inclusive.

**AC2.2 — Email validation**
WHEN the visitor submits the form THEN the system SHALL validate that the email field is non-empty and conforms to a standard email format (RFC 5322 simplified). WHEN validation fails THEN the system SHALL display an inline error beneath the email field and SHALL NOT call the backend.

**AC2.3 — Party date validation**
WHEN the visitor submits the form THEN the system SHALL validate that a party date has been selected and that the selected date is in the future (strictly after today's date). WHEN validation fails THEN the system SHALL display an inline error beneath the date field and SHALL NOT call the backend.

**AC2.4 — Kid gender validation**
WHEN the visitor submits the form THEN the system SHALL validate that one of the three gender options has been selected. WHEN validation fails THEN the system SHALL display an inline error and SHALL NOT call the backend.

**AC2.5 — Kid age validation**
WHEN the visitor submits the form THEN the system SHALL validate that an age has been entered and that the value is an integer between 1 and 12 inclusive. WHEN validation fails THEN the system SHALL display an inline error beneath the age field and SHALL NOT call the backend.

**AC2.6 — Submit button state**
WHILE the form is being submitted to the backend THEN the submit button SHALL be disabled and SHALL display a loading indicator. The form fields SHALL also be disabled to prevent double-submission.

**AC2.7 — Success state**
WHEN the backend returns a 201 response THEN the system SHALL replace the form content with a success message confirming that the submission was received (e.g., "Got it! We'll send you a personalised bundle link before your party."). A "Close" button SHALL allow the visitor to dismiss the modal.

**AC2.8 — Error state**
WHEN the backend returns a 4xx or 5xx response, or when a network error occurs THEN the system SHALL display an inline error alert inside the modal without closing it. The visitor SHALL be able to correct their input and resubmit. The submit button SHALL be re-enabled.

**AC2.9 — Dismiss without submitting**
WHEN the visitor clicks the modal backdrop or a close icon (X) THEN the modal SHALL close and the form SHALL be reset to its empty initial state. No backend call is made.

---

## R3 — Backend API: Store Future Party Submission

**User story:** As the system, I want to persist each future party submission in the database so that admins can retrieve and act on them later.

**Context:** A new public `POST` endpoint receives the form data and writes one row to the `future_parties` table. No authentication is required — this is a public lead-capture endpoint equivalent in nature to `POST /api/generated-bundles`.

### Acceptance Criteria

**AC3.1 — New endpoint**
WHEN a `POST /api/future-parties` request is received with a valid body THEN the system SHALL insert one row into the `future_parties` table and respond with HTTP 201 and the persisted record (all fields, camelCase).

**AC3.2 — Request body shape**
The request body SHALL contain:
- `email` — required, valid email format, maximum 254 characters.
- `partyDate` — required, ISO 8601 date string (`YYYY-MM-DD`), must be in the future relative to the server's current date.
- `kidGender` — required, one of: `BOY`, `GIRL`, `MIXED`.
- `kidAge` — required, integer 1–12 inclusive.

**AC3.3 — Validation errors**
WHEN any required field is missing or invalid THEN the system SHALL respond with HTTP 400 and a RFC 7807 `ProblemDetail` body (`type: "about:validation-error"`, matching the existing `GlobalExceptionHandler` pattern used across the backend).

**AC3.4 — Database migration**
A new `node-pg-migrate` migration file (`008_future_parties.ts`) SHALL create the `future_parties` table. The migration SHALL be runnable via `npm run migrate` and SHALL be reversible (`down` function drops the table).

**AC3.5 — No authentication required**
The `POST /api/future-parties` endpoint SHALL NOT require any `Authorization` header. It is a public endpoint.

**AC3.6 — CORS**
The endpoint SHALL be covered by the existing CORS middleware (same `corsOptions` as all other `/api/*` routes).

---

## R4 — Admin Panel: Future Parties List Page

**User story:** As an admin, I want to see all future party submissions in a table with clear status indicators so that I can identify and act on leads efficiently.

**Context:** A page exists at `/admin/future-parties`. The table columns and action buttons are defined below. The "Code" column that was present in earlier versions of this page is removed; a "Generated Bundle Number" column is added instead.

### Acceptance Criteria

**AC4.1 — Navigation link**
WHEN an admin is logged in and views any admin page THEN the `AdminNav` SHALL display a "Future Parties" link. Clicking it SHALL navigate to `/admin/future-parties` using `react-router-dom`.

**AC4.2 — New admin route**
A route `<Route path="/admin/future-parties" element={<AdminFuturePartiesPage />} />` SHALL be registered inside the existing `<AdminGuard />` block in `App.tsx`.

**AC4.3 — List endpoint**
The admin endpoint `GET /admin/api/future-parties` (HTTP Basic auth required) SHALL return all future party rows ordered by `submitted_at` descending (newest first). The response SHALL be a JSON array of objects with fields: `id`, `email`, `partyDate`, `kidGender`, `kidAge`, `submittedAt`, `linkedBundlePublicId` (nullable), `bundleSentAt` (nullable).

**AC4.4 — Table columns**
WHEN the admin visits `/admin/future-parties` THEN the system SHALL render a MUI `Table` with the following columns (in order):
1. **Email**
2. **Party Date**
3. **Kid Gender**
4. **Kid Age**
5. **Submitted**
6. **Bundle Sent**
7. **Generated Bundle Number** — shows the `linkedBundlePublicId` value for the row, or "—" if none has been linked yet
8. **Actions**

The table SHALL NOT include a "Code" column.

**AC4.5 — Loading and error states**
WHEN the page is loading data THEN a `CircularProgress` spinner SHALL be displayed. WHEN the fetch fails THEN a MUI `Alert severity="error"` SHALL be displayed with the message "Failed to load future party submissions." These patterns match the existing admin pages.

**AC4.6 — Empty state**
WHEN no submissions exist THEN the table body SHALL display a single row with a centered message "No future party submissions yet."

---

## R5 — Admin Action: Generate Bundle for a Future Party

**User story:** As an admin, I want to generate a personalised goodie bag bundle for a future party submission so that I can preview it and then send a ready-to-buy link to the parent.

**Context:** In the future parties list, each row that does not yet have a linked bundle has a "Generate Bundle" button and an "Apply Bundle" button. Clicking "Generate Bundle" opens the bundle-generation dialog. On successful generation the admin is taken directly to the admin bundle preview page (R-FP-A) instead of returning to the list.

### Acceptance Criteria

**AC5.1 — Action buttons when no bundle is linked**
WHEN a future party row has no `linkedBundlePublicId` THEN the system SHALL display two buttons in the row's Actions column:
1. **"Generate Bundle"** — opens the bundle-generation dialog (AC5.2).
2. **"Apply Bundle"** — opens the Apply Bundle dialog (AC5.8).

**AC5.2 — Bundle generation dialog**
WHEN the admin clicks "Generate Bundle" THEN the system SHALL open a dialog containing:
- A read-only display of the submission's email, party date, kid gender, and kid age for reference.
- A selection for **Interest** (chip row or dropdown with the same options as the existing `GiftFinder`): Pop Music, Toys & Play, Cute & Magical, Sports, Reading & Puzzles.
- A selection for **Party Type**: Celebration, Halloween.
- A selection for **Budget Tier**: Low, Mid, High.
- The **Audience Preference** pre-filled from kid gender (`BOY` → `MASCULINE`, `GIRL` → `FEMININE`, `MIXED` → `NO_PREFERENCE`) and displayed as read-only.
- The **Age** pre-filled from `kidAge` and displayed as read-only.

**AC5.3 — Dialog validation**
WHEN the admin submits the dialog without selecting Interest or Party Type or Budget Tier THEN the system SHALL display inline validation errors and SHALL NOT call the backend.

**AC5.4 — Bundle generation call**
WHEN the admin submits valid selections THEN the system SHALL call the existing `POST /api/generated-bundles` endpoint with the selected parameters. On a 201 response the system SHALL call `PATCH /admin/api/future-parties/:id/link-bundle` with the generated bundle's `publicId`. On success, the dialog SHALL close and the admin SHALL be navigated to the admin bundle preview page for that bundle (R-FP-A), not back to the list.

**AC5.5 — Link bundle endpoint**
The admin endpoint `PATCH /admin/api/future-parties/:id/link-bundle` (HTTP Basic auth required) SHALL:
- Accept body `{ bundlePublicId: string }`.
- Update the `future_parties` row: set `linked_bundle_public_id = bundlePublicId`.
- Return HTTP 200 with the updated row.
- Return HTTP 404 if the `future_parties` row does not exist.
- Return HTTP 400 if the row already has a linked bundle (idempotency guard — admin cannot overwrite an existing link via this endpoint; the Apply Bundle dialog enforces the same guard).

**AC5.6 — Success feedback**
WHEN the bundle is successfully generated and linked THEN the admin is navigated to the admin bundle preview page (R-FP-A). A success `Snackbar` or `Alert` SHALL be shown on that page confirming the bundle was created and linked.

**AC5.7 — Error feedback**
WHEN either the bundle generation call or the link call fails THEN the dialog SHALL remain open and display an inline error. The admin SHALL be able to retry.

**AC5.8 — Apply Bundle dialog**
WHEN the admin clicks "Apply Bundle" THEN the system SHALL open a dialog containing:
- A single text input labelled "Bundle Number".
- A submit button labelled "Apply".
- A cancel button.

WHEN the admin submits the dialog THEN the system SHALL call `PATCH /admin/api/future-parties/:id/link-bundle` with the entered bundle public ID.

WHEN the backend returns 200 THEN the dialog SHALL close and the table row SHALL refresh to display the newly linked `linkedBundlePublicId` in the "Generated Bundle Number" column.

WHEN the backend returns an error (bundle not found, already linked elsewhere, or validation failure) THEN the dialog SHALL remain open and display an inline validation error message. The admin SHALL be able to correct the input and retry.

---

## R6 — Admin Action: Send Bundle Link by Email

**User story:** As an admin, I want to send a personalised bundle link to a future party parent's email address so that they can review and purchase the recommended goodie bag directly.

**Context:** Once a bundle has been linked (R5), the row in the list shows send/re-send controls. The admin may also trigger the send from the admin bundle preview page (R-FP-A) via the "Send Link" CTA button.

### Acceptance Criteria

**AC6.1 — Send controls visibility in the list**
WHEN a future party row has a `linkedBundlePublicId` AND `bundleSentAt` is null THEN the system SHALL display a "Send Link" button in the Actions column.

**AC6.2 — Re-send controls in the list**
WHEN a future party row has a `linkedBundlePublicId` AND `bundleSentAt` is non-null THEN the system SHALL display the date of the last send alongside a "Re-send" button, enabling the admin to send the email again.

**AC6.3 — Send link endpoint**
The admin endpoint `POST /admin/api/future-parties/:id/send-link` (HTTP Basic auth required) SHALL:
- Fetch the `future_parties` row.
- Return HTTP 404 if the row does not exist.
- Return HTTP 422 if `linked_bundle_public_id` is null (cannot send a link without a bundle).
- Construct the bundle URL as `${FRONTEND_URL}/bundleCustomization/${linked_bundle_public_id}`.
- Send an email to the submission's `email` address using `SESClient` (the singleton already initialised in `src/lib/email.ts`).
- Record the send time: update `bundle_sent_at = now()` on the `future_parties` row.
- Return HTTP 200 with `{ sentAt: <ISO timestamp> }`.

**AC6.4 — Email content**
The email SHALL contain:
- A friendly subject line: "Your personalised goodie bag is ready!"
- The parent's party date and a brief description such as "We've put together a bundle for your [gender] kid's party on [date]."
- A clear, prominent link (hyperlink button or large anchor) to the bundle URL.
- The site name "It Is A Small Gift Co." and the `EMAIL_FROM` sender address already configured in the environment.
- Plain-text fallback body with the raw bundle URL.

**AC6.5 — SES failure handling**
WHEN SES fails to send the email THEN the system SHALL NOT update `bundle_sent_at` and SHALL return HTTP 500 with a `ProblemDetail` body. This is distinct from the order confirmation email flow (which fails silently) — here, the admin must know the email was not sent so they can retry.

**AC6.6 — Frontend feedback (list)**
WHEN the "Send Link" or "Re-send" button is clicked from the list THEN it SHALL show a loading state (disabled + spinner). WHEN the response is 200 THEN the row SHALL update to show the new `bundleSentAt` timestamp and the button SHALL change to "Re-send". WHEN the response is an error THEN a MUI `Alert severity="error"` SHALL appear near the row.

---

## R7 — Backend Endpoint Registration

**User story:** As a developer, I want all new endpoints to be correctly registered in the Express app so that they are reachable from both the frontend and external clients.

### Acceptance Criteria

**AC7.1 — Public route registration**
`POST /api/future-parties` SHALL be registered in `src/app.ts` under the `/api` namespace, after `express.json()` middleware, consistent with how `generatedBundlesRouter` and `analyticsRouter` are registered.

**AC7.2 — Admin route registration**
`GET /admin/api/future-parties`, `PATCH /admin/api/future-parties/:id/link-bundle`, `POST /admin/api/future-parties/:id/send-link`, and `PATCH /admin/api/generated-bundles/:bundlePublicId/items/:slotCode` SHALL be registered in `src/app.ts` under their respective prefixes, consistent with how `adminOrdersRouter` is registered.

**AC7.3 — Auth enforcement**
All admin endpoints SHALL be protected by the existing `basicAuth` middleware. The public `POST /api/future-parties` endpoint SHALL NOT require any auth.

---

## R-FP-A — Admin Bundle Preview Page

**User story:** As an admin, I want to preview the generated bundle using the same visual layout the customer will see, so that I can review the items and trigger the send-link action from a single page.

**Context:** After a bundle is generated and linked to a future party submission (R5), the admin is taken to an admin-only bundle preview page. This page reuses the layout and visual components of the customer-facing `BundleCustomizationPage` but has a distinct route, distinct top-bar CTA, and item-swap capability. Customers never see this page. Access is protected by HTTP Basic auth (the admin `Authorization` header is forwarded automatically via the admin API client).

### Acceptance Criteria

**AC-FP-A.1 — Admin-only route**
The admin bundle preview page SHALL be accessible at `/admin/bundle-preview/:bundlePublicId`. The route SHALL be registered inside the existing `<AdminGuard />` block in `App.tsx` so it is protected by admin authentication. The customer `BundleCustomizationPage` at `/bundleCustomization/:bundleId` SHALL remain unchanged.

**AC-FP-A.2 — Bundle data loading**
WHEN the admin navigates to `/admin/bundle-preview/:bundlePublicId` THEN the system SHALL fetch the bundle from the existing `GET /api/generated-bundles/:publicId` endpoint and render the same `ConfiguratorVisual`, image gallery, item cards, upgrade options, and gift bag options that `BundleCustomizationPage` renders.

**AC-FP-A.3 — "Send Link" CTA**
The sticky bottom CTA bar SHALL display a **"Send Link"** button in place of the customer-facing "Continue" / "Add to Cart" button. The quantity selector and price breakdown SHALL NOT be shown on the admin preview page — the bottom bar contains only the "Send Link" button.

**AC-FP-A.4 — Send Link action**
WHEN the admin clicks "Send Link" THEN the system SHALL call `POST /admin/api/future-parties/:futurePartyId/send-link` using the admin auth header. The `futurePartyId` SHALL be passed to this page as a route parameter or query parameter so the correct future party row is updated. WHEN the call returns 200 THEN the button SHALL change to "Re-send" and display the `sentAt` timestamp. WHEN the call returns an error THEN a MUI `Alert severity="error"` SHALL appear near the button and the button SHALL be re-enabled.

**AC-FP-A.5 — Navigation back**
The sticky top bar SHALL contain a "Back to Future Parties" link that navigates to `/admin/future-parties`.

**AC-FP-A.6 — Loading and error states**
WHEN the bundle is loading THEN a centered `CircularProgress` SHALL be shown. WHEN the bundle cannot be loaded (404 or network error) THEN an `Alert severity="error"` with the message "Bundle not found." SHALL be shown alongside a "Back to Future Parties" link.

---

## R-FP-B — Future Parties List — Updated Columns and Actions

**User story:** As an admin, I want the future parties list to show the linked bundle number and give me clear, contextual action buttons for each row so that I can navigate directly to a generated bundle or associate an existing bundle without re-generating one.

**Context:** The table columns and actions column are updated. The "Code" column is removed. A "Generated Bundle Number" column is added. When a bundle has already been linked, the "Generate Bundle" button is replaced by a "View Bundle" button that navigates to the admin bundle preview page (R-FP-A). When no bundle is linked, both "Generate Bundle" and "Apply Bundle" buttons are shown.

### Acceptance Criteria

**AC-FP-B.1 — No Code column**
The `AdminFuturePartiesPage` table SHALL NOT render a "Code" column or any column displaying `redemptionCode` or `redeemedAt` values. If these fields exist on the `AdminFutureParty` type they are used only internally (e.g. by a redemption-kiosk flow) and are not displayed in this table.

**AC-FP-B.2 — Generated Bundle Number column**
The table SHALL include a "Generated Bundle Number" column. WHEN `linkedBundlePublicId` is non-null THEN the cell SHALL display the `linkedBundlePublicId` value (e.g. as a monospace label or outlined chip). WHEN `linkedBundlePublicId` is null THEN the cell SHALL display "—".

**AC-FP-B.3 — Actions when bundle is already linked**
WHEN a row has a non-null `linkedBundlePublicId` THEN the Actions column SHALL display a **"View Bundle"** button. Clicking "View Bundle" SHALL navigate to `/admin/bundle-preview/:linkedBundlePublicId?futurePartyId=:id` (passing both the bundle public ID and the future party ID so the preview page can invoke the send-link endpoint on the correct row).

**AC-FP-B.4 — Actions when no bundle is linked**
WHEN a row has a null `linkedBundlePublicId` THEN the Actions column SHALL display two buttons:
1. **"Generate Bundle"** — opens the generate-bundle dialog (AC5.2).
2. **"Apply Bundle"** — opens the Apply Bundle dialog (AC5.8).

**AC-FP-B.5 — Send / Re-send remain in the Actions column**
The "Send Link" and "Re-send" buttons (AC6.1, AC6.2) continue to appear in the Actions column for rows that have a linked bundle, alongside the "View Bundle" button.

---

## R-FP-C — Item Swap in Admin Bundle Preview

**User story:** As an admin, I want to replace individual items in a generated bundle from the preview page so that I can make manual overrides before sending the link to the parent.

**Context:** On the admin bundle preview page (R-FP-A), each item card in the "Included" section has a swap icon. Clicking it opens a modal where the admin can select an alternative product for that slot. The swap respects hard eligibility constraints (form factor, active status, available inventory) but does not filter by age/audience/occasion — this is an intentional admin override capability. The updated selection is persisted immediately via a new backend endpoint.

### Acceptance Criteria

**AC-FP-C.1 — Swap icon on each item card**
WHEN the admin bundle preview page renders the "Included" items THEN each item card SHALL display a swap icon (e.g. MUI `SwapHorizIcon`) in the top-right corner of the card. The icon SHALL be visible at all times (not only on hover).

**AC-FP-C.2 — Swap modal opens**
WHEN the admin clicks the swap icon on an item card THEN the system SHALL open a modal dialog. The dialog title SHALL be "Replace [Product Name]" where [Product Name] is the current product's name.

**AC-FP-C.3 — Alternative products list**
WHEN the swap modal opens THEN the system SHALL display a list of alternative products eligible for the same slot. Eligibility is determined by the backend and SHALL satisfy all of the following conditions:
- The product's `form_factor` matches the slot's required form factor.
- The product is active (`active = true`).
- The product has `inventory_quantity > 0`.
- The product is NOT already selected in another slot of the same bundle.
- Products that fail any of these conditions SHALL NOT appear in the list.
- Age, audience, and occasion filters SHALL NOT be applied — this is an admin override.

**AC-FP-C.4 — Alternative product display**
Each alternative product in the list SHALL show: product name, SKU, form factor, and retail price. The currently selected product for that slot SHALL be visually distinguished (e.g. a "Current" badge or highlighted border) and MAY appear in the list but SHALL NOT be selectable as a replacement.

**AC-FP-C.5 — Selecting an alternative**
WHEN the admin clicks an alternative product in the list THEN that product SHALL become highlighted/selected within the modal. WHEN the admin confirms the selection (e.g. clicks "Replace") THEN the system SHALL call `PATCH /admin/api/generated-bundles/:bundlePublicId/items/:slotCode` with `{ productId: <selectedProductId> }`.

**AC-FP-C.6 — New backend endpoint: patch bundle item**
`PATCH /admin/api/generated-bundles/:bundlePublicId/items/:slotCode` (HTTP Basic auth required) SHALL:
- Validate that `bundlePublicId` identifies an existing generated bundle; return 404 if not found.
- Validate that `slotCode` identifies a slot within that bundle; return 404 if the slot does not exist.
- Validate that the requested `productId` exists and is active; return 400 if not.
- Validate that the product's `form_factor` matches the slot's required form factor; return 400 if not.
- Validate that the product has `inventory_quantity > 0`; return 400 if not.
- Update the `generated_bundle_item` row for that slot: set `product_id`, `product_name_snapshot`, `sku_snapshot`, `cost_snapshot`, `description_snapshot`, and `form_factor_snapshot` to the new product's values.
- Return HTTP 200 with the full updated bundle (same shape as `GET /api/generated-bundles/:publicId`).

**AC-FP-C.7 — Frontend refresh after swap**
WHEN the backend returns 200 THEN the swap modal SHALL close and the admin bundle preview page SHALL update to display the new product in the affected item card and in the `ConfiguratorVisual`. No full page reload is required.

**AC-FP-C.8 — Error handling in swap modal**
WHEN the backend returns an error THEN the swap modal SHALL remain open and display an inline `Alert severity="error"` with the error detail. The admin SHALL be able to retry or cancel.

**AC-FP-C.9 — Empty alternatives list**
WHEN no eligible alternative products exist for a slot THEN the swap modal SHALL display a message "No alternative products are available for this slot." The admin can dismiss the modal.

---

## Non-Goals

- Automated/scheduled email sending (admin always triggers the send manually).
- Tracking email open rates or click-through.
- Allowing the parent to fill in interest/party-type themselves (admin curates the bundle).
- Editing or deleting a future party submission via the admin UI.
- Pagination of the future parties list (initial scope: render all rows).
- Showing redemption codes or redeemed-at timestamps in the future parties table (those fields exist in the DB for the fair-booth kiosk flow but are not displayed here).
- Applying age/audience/occasion filters in the item-swap modal (admin override is intentional).
