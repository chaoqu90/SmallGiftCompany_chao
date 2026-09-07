# Future Party — Requirements

> **Feature ID:** FEAT-004
> **Status:** Draft — 2026-09-06
> **Conforms to:** `specs/tech-overview.md` (golden copy)
> **Technical design:** `specs/future-party/design.md`

---

## Overview

Some shoppers are planning a party weeks or months in advance and are not ready to build a bundle today. This feature lets them register their interest early by providing an email address, party date, kid gender, and kid age. The data is stored so the admin can later generate a tailored bundle and email it to the parent as a ready-to-buy link — creating a warm lead with a personalised recommendation.

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

**User story:** As an admin, I want to see all future party submissions in the admin panel so that I can identify leads to act on.

**Context:** A new page is added at `/admin/future-parties`. A new "Future Parties" link is added to `AdminNav.tsx` alongside the existing Products, Bundles, Dashboard, and Orders links.

### Acceptance Criteria

**AC4.1 — Navigation link**
WHEN an admin is logged in and views any admin page THEN the `AdminNav` SHALL display a "Future Parties" link. Clicking it SHALL navigate to `/admin/future-parties` using `react-router-dom`.

**AC4.2 — New admin route**
A new route `<Route path="/admin/future-parties" element={<AdminFuturePartiesPage />} />` SHALL be registered inside the existing `<AdminGuard />` block in `App.tsx`.

**AC4.3 — List endpoint**
A new admin endpoint `GET /admin/api/future-parties` (HTTP Basic auth required) SHALL return all future party rows ordered by `submitted_at` descending (newest first). The response SHALL be a JSON array of objects with fields: `id`, `email`, `partyDate`, `kidGender`, `kidAge`, `submittedAt`, `linkedBundlePublicId` (nullable), `bundleSentAt` (nullable).

**AC4.4 — Table columns**
WHEN the admin visits `/admin/future-parties` THEN the system SHALL render a MUI `Table` with the following columns: Email, Party Date, Kid Gender, Kid Age, Submitted, Bundle Sent. The table SHALL show all records returned by the list endpoint.

**AC4.5 — Loading and error states**
WHEN the page is loading data THEN a `CircularProgress` spinner SHALL be displayed. WHEN the fetch fails THEN a MUI `Alert severity="error"` SHALL be displayed with a message "Failed to load future party submissions." These patterns match the existing admin pages.

**AC4.6 — Empty state**
WHEN no submissions exist THEN the table body SHALL display a single row with a centered message "No future party submissions yet."

---

## R5 — Admin Action: Generate Bundle for a Future Party

**User story:** As an admin, I want to generate a personalised goodie bag bundle for a future party submission so that I can send a ready-to-buy link to the parent.

**Context:** In the future parties list, each row that does not yet have a linked bundle SHALL have a "Create Bundle" button. Clicking it opens a bundle-generation flow that pre-fills what it can from the submission (gender → audience preference, age → bundle age) and lets the admin fill in the remaining options (interest, party type, budget tier). On confirmation, the backend generates a bundle and links its `public_id` to the `future_parties` row.

### Acceptance Criteria

**AC5.1 — "Create Bundle" button visibility**
WHEN a future party row has no `linkedBundlePublicId` THEN the system SHALL display a "Create Bundle" button in the row's action column. WHEN a row already has a `linkedBundlePublicId` THEN the system SHALL display the bundle public ID as a read-only chip or label in place of the button.

**AC5.2 — Bundle generation dialog**
WHEN the admin clicks "Create Bundle" THEN the system SHALL open a dialog containing:
- A read-only display of the submission's email, party date, kid gender, and kid age for reference.
- A selection for **Interest** (chip row or dropdown with the same options as the existing `GiftFinder`): Pop Music, Toys & Play, Cute & Magical, Sports, Reading & Puzzles.
- A selection for **Party Type**: Celebration, Halloween.
- A selection for **Budget Tier**: Low, Mid, High.
- The **Audience Preference** pre-filled from kid gender (`BOY` → `MASCULINE`, `GIRL` → `FEMININE`, `MIXED` → `NO_PREFERENCE`) and displayed as read-only.
- The **Age** pre-filled from `kidAge` and displayed as read-only.

**AC5.3 — Dialog validation**
WHEN the admin submits the dialog without selecting Interest or Party Type or Budget Tier THEN the system SHALL display inline validation errors and SHALL NOT call the backend.

**AC5.4 — Bundle generation call**
WHEN the admin submits valid selections THEN the system SHALL call the existing `POST /api/generated-bundles` endpoint with the selected parameters (using the admin's `Authorization: Basic` header is NOT required for this endpoint; it is public). On a 201 response the system SHALL call a new admin endpoint `PATCH /admin/api/future-parties/:id/link-bundle` with the generated bundle's `publicId`.

**AC5.5 — Link bundle endpoint**
A new admin endpoint `PATCH /admin/api/future-parties/:id/link-bundle` (HTTP Basic auth required) SHALL:
- Accept body `{ bundlePublicId: string }`.
- Update the `future_parties` row: set `linked_bundle_public_id = bundlePublicId`.
- Return HTTP 200 with the updated row.
- Return HTTP 404 if the `future_parties` row does not exist.
- Return HTTP 400 if the row already has a linked bundle (idempotency guard — admin cannot overwrite an existing link).

**AC5.6 — Success feedback**
WHEN the bundle is successfully generated and linked THEN the dialog SHALL close and the table SHALL refresh to show the new `linkedBundlePublicId` in the row. A brief success `Alert` or `Snackbar` SHALL inform the admin.

**AC5.7 — Error feedback**
WHEN either the bundle generation call or the link call fails THEN the dialog SHALL remain open and display an inline error. The admin SHALL be able to retry.

---

## R6 — Admin Action: Send Bundle Link by Email

**User story:** As an admin, I want to send a personalised bundle link to a future party parent's email address so that they can review and purchase the recommended goodie bag directly.

**Context:** Once a bundle has been linked (R5), the row shows a "Send Link" button (or re-send if already sent). Clicking it triggers the backend to send an email to the submission's `email` address. The email contains the public bundle URL (constructed as `${FRONTEND_URL}/bundleCustomization/${linkedBundlePublicId}`). The backend uses the existing AWS SES infrastructure in `src/lib/email.ts`.

### Acceptance Criteria

**AC6.1 — "Send Link" button visibility**
WHEN a future party row has a `linkedBundlePublicId` AND has not yet had a bundle link sent (`bundleSentAt` is null) THEN the system SHALL display a "Send Link" button in the action column.

**AC6.2 — Re-send button**
WHEN a future party row has a `linkedBundlePublicId` AND `bundleSentAt` is non-null THEN the system SHALL display the date of the last send alongside a "Re-send" button, enabling the admin to send the email again.

**AC6.3 — Send link endpoint**
A new admin endpoint `POST /admin/api/future-parties/:id/send-link` (HTTP Basic auth required) SHALL:
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

**AC6.6 — Frontend feedback**
WHEN the "Send Link" or "Re-send" button is clicked THEN it SHALL show a loading state (disabled + spinner). WHEN the response is 200 THEN the row SHALL update to show the new `bundleSentAt` timestamp and the button SHALL change to "Re-send". WHEN the response is an error THEN a MUI `Alert severity="error"` SHALL appear near the row.

---

## R7 — Backend Endpoint Registration

**User story:** As a developer, I want all new endpoints to be correctly registered in the Express app so that they are reachable from both the frontend and external clients.

### Acceptance Criteria

**AC7.1 — Public route registration**
`POST /api/future-parties` SHALL be registered in `src/app.ts` under the `/api` namespace, after `express.json()` middleware, consistent with how `generatedBundlesRouter` and `analyticsRouter` are registered.

**AC7.2 — Admin route registration**
`GET /admin/api/future-parties`, `PATCH /admin/api/future-parties/:id/link-bundle`, and `POST /admin/api/future-parties/:id/send-link` SHALL be registered in `src/app.ts` under the `/admin/api/future-parties` prefix, consistent with how `adminOrdersRouter` is registered.

**AC7.3 — Auth enforcement**
All three admin endpoints SHALL be protected by the existing `basicAuth` middleware imported from `src/middleware/auth.ts`. The public `POST /api/future-parties` endpoint SHALL NOT require any auth.

---

## Non-Goals

- Automated/scheduled email sending (admin always triggers the send manually).
- Tracking email open rates or click-through.
- Allowing the parent to fill in interest/party-type themselves (admin curates the bundle).
- Editing or deleting a future party submission via the admin UI.
- Pagination of the future parties list (initial scope: render all rows).
