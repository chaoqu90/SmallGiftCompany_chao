# Signup Promotion — Requirements

> **Feature ID:** FEAT-005
> **Status:** Draft — 2026-09-07
> **Conforms to:** `specs/tech-overview.md` (golden copy)
> **Technical design:** `specs/signup-promotion/design.md`
> **Parent feature:** FEAT-004 Future Party (`specs/future-party/requirements.md`)

---

## Overview

Small Gift Shop is in its early-launch phase and wants to capture leads at the Loudoun
Children's Business Fair (Saturday, September 12, 2026, 11 AM – 3 PM). When a visitor
lands on the `/build` path (prod: `https://www.smallgift.shop/build`; local:
`localhost:5173/build`), the existing HomePage renders and a "sign-up promotion" modal
opens automatically — no click required. The visitor fills in their email, party
timeframe, kid's gender, and kid's age, and submits. The submission is stored in the
existing `future_parties` table via the existing `POST /api/future-parties` endpoint.
Immediately on submission, a gift-redemption confirmation email is sent to the visitor's
email address using the existing AWS SES infrastructure.

No new pages, routes, or database tables are introduced. This feature is entirely
additive and must not break any existing FEAT-004 behaviour.

---

## R1 — Auto-open Promotion Modal on the `/build` Path

**User story:** As a visitor who lands on `https://www.smallgift.shop/build` (or
`localhost:5173/build`), I want a promotion modal to open automatically so that I am
immediately invited to sign up and learn about the gift offer without having to look for
it.

**Context:** The `/build` path resolves to the existing `HomePage` component. No new
route or page is created. The modal must open on mount when the URL pathname is exactly
`/build`. The existing "Plan For Future" button and its `FuturePartyModal` behaviour on
all other paths must remain unchanged.

### Acceptance Criteria

**AC1.1 — Auto-open trigger**
WHEN a visitor navigates to a URL whose pathname is exactly `/build` THEN the system
SHALL automatically open the signup promotion modal without any user interaction, as soon
as the `HomePage` component mounts.

**AC1.2 — Normal paths unaffected**
WHEN a visitor navigates to any pathname other than `/build` (e.g., `/`, `/build/`) THEN
the signup promotion modal SHALL NOT open automatically. The "Plan For Future" button's
existing manual-open behaviour (FEAT-004 R1) SHALL remain fully functional.

**AC1.3 — URL does not change**
WHEN the modal auto-opens THEN the browser URL SHALL remain `/build` unchanged. No query
parameters, hash fragments, or redirects are introduced.

**AC1.4 — No new route registration**
The `/build` path SHALL NOT be registered as a new React Router `<Route>`. The existing
route configuration that renders `HomePage` at the root path SHALL be reused (or the
`/build` path SHALL be handled by the same route element). The pathname is read from
`useLocation()` inside `HomePage` to determine whether to auto-open the modal.

**AC1.5 — Modal close behaviour**
WHEN the visitor closes the auto-opened modal (by clicking the X, clicking the backdrop,
or submitting successfully) THEN the modal closes and the homepage remains visible at
`/build`. The URL SHALL remain `/build` after close. The modal SHALL NOT reopen unless
the page is refreshed.

---

## R2 — Signup Promotion Modal Content

**User story:** As a visitor who sees the auto-opened modal, I want to understand why I
am being asked for my information and what I will receive in exchange, so that I can
decide whether to sign up.

**Context:** The modal is a new component (`SignupPromotionModal`) that reuses the same
form fields as `FuturePartyModal` (FEAT-004 R2) but has different copy, a different
title, and a different success message. It is not a rename of `FuturePartyModal` — both
components coexist. The form fields and validation rules are identical to FEAT-004 AC2.1
through AC2.5.

### Acceptance Criteria

**AC2.1 — Modal title**
WHEN the modal is open THEN the system SHALL display the title "Welcome to Small Gift
Shop!".

**AC2.2 — Welcome message**
WHEN the modal is open THEN the system SHALL display the following welcome message
verbatim in the modal body, above the form fields:

> "Small Gift Shop is in early launching stage, and we want to appreciate your support
> by sharing a small gift with you! Sign up with your email address and join us at
> Loudoun Children's Business Fair to receive a surprise gift!"

**AC2.3 — Form fields**
WHEN the modal is open THEN the system SHALL display the same four fields used in
`FuturePartyModal`, in the same order:
1. Email — text input, required, validated as a valid email format.
2. Party date — radio group (Within 1 month / 1–3 months / 3–6 months) plus an
   optional specific date input; exactly one must be selected or entered.
3. Kid's gender — chip row with exactly three options: Boy / Girl / Mixed / Either.
4. Kid's age — numeric input, integer 1–12 inclusive.

**AC2.4 — Field validation (identical to FEAT-004 AC2.2–AC2.5)**
WHEN the visitor submits the form THEN the system SHALL apply client-side validation
identical to `FuturePartyModal`:
- Email: non-empty, matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- Party date: one of the radio options selected, OR a manual date entered that is
  strictly after today's date.
- Kid's gender: one of the three options selected.
- Kid's age: integer in [1, 12].
WHEN any field fails validation THEN the system SHALL display an inline error beneath
that field and SHALL NOT call the backend.

**AC2.5 — Submit button label and loading state**
The submit button label SHALL be "Sign Up and Get My Gift". WHILE the form is being
submitted THEN the button SHALL be disabled and SHALL display a `CircularProgress`
spinner (size 20). The form fields SHALL also be disabled during submission.

**AC2.6 — Success message**
WHEN the backend returns HTTP 201 THEN the system SHALL replace the form content with
the following success message:

> "Thank you! We'll see you at the Loudoun Children's Business Fair on Saturday,
> September 12, 2026. Your surprise gift is waiting for you — check your email for
> details!"

A "Close" button SHALL allow the visitor to dismiss the modal.

**AC2.7 — API error state**
WHEN the backend returns a 4xx or 5xx response, or when a network error occurs THEN the
system SHALL display an inline error alert inside the modal: "Something went wrong.
Please try again." The modal SHALL NOT close. The submit button SHALL be re-enabled so
the visitor can retry.

**AC2.8 — Dismiss without submitting**
WHEN the visitor clicks the X icon or the modal backdrop THEN the modal SHALL close and
all form state SHALL be reset. No backend call is made.

**AC2.9 — Close guard during submission**
WHEN the form submission is in progress THEN clicking the X icon or the backdrop SHALL
have no effect. The modal SHALL not close until the submission completes or fails.

---

## R3 — Backend: Reuse Existing POST /api/future-parties Endpoint

**User story:** As the system, I want the signup promotion form to store its data in the
existing `future_parties` table so that no new database schema or backend route is
needed.

**Context:** The existing `POST /api/future-parties` endpoint (FEAT-004 R3, AC3.1–AC3.6)
already accepts the four fields. The frontend calls `submitFutureParty()` from
`src/api/futureParties.ts` with identical payload shape. No backend changes are required
to store the submission — the endpoint is already public and already validates all four
fields. The only backend change introduced by this feature is in the email layer (R4).

### Acceptance Criteria

**AC3.1 — Same endpoint and payload**
WHEN the visitor submits the signup promotion form THEN the system SHALL call
`POST /api/future-parties` with the same payload shape as `FuturePartyModal`:
`{ email, partyDate, kidGender, kidAge }`. No additional fields are sent.

**AC3.2 — No new endpoint**
This feature SHALL NOT introduce any new backend route. All persistence is handled by
the existing `POST /api/future-parties` route without modification.

**AC3.3 — Validation errors surfaced**
WHEN `POST /api/future-parties` returns HTTP 400 THEN the frontend SHALL treat it as an
API error and display the generic error message defined in AC2.7. The specific backend
validation detail need not be displayed to the visitor.

---

## R4 — Confirmation / Gift-Redemption Email Sent on Submission

**User story:** As a visitor who submits the signup promotion form, I want to receive a
confirmation email immediately so that I know my sign-up was recorded and I have the
event details I need to collect my gift.

**Context:** The existing `sendFuturePartyEmail` function in
`backend-node/src/lib/email.ts` sends a personalised bundle link email and is triggered
manually by an admin. For this feature, a new email function `sendSignupPromotionEmail`
is added to `src/lib/email.ts` and is called automatically inside the
`POST /api/future-parties` route handler immediately after the DB insert succeeds. Unlike
the admin bundle-link email, this email does not require a bundle URL and is always sent
at submission time.

### Acceptance Criteria

**AC4.1 — Email triggered on every successful submission from /build**
WHEN `POST /api/future-parties` successfully inserts a row (HTTP 201) AND the
`source` field in the request body is `"signup-promotion"` THEN the system SHALL call
`sendSignupPromotionEmail` with the submitted `email` address before returning the 201
response. The email send happens synchronously within the request; the response is
returned only after the send attempt completes (success or failure).

**AC4.2 — source field**
The request body for the signup promotion form SHALL include an additional field
`source: "signup-promotion"`. The `POST /api/future-parties` route handler SHALL accept
this field (stripping it before the DB insert or storing it as-is per the design
decision in `design.md`). Submissions from `FuturePartyModal` (the "Plan For Future"
button flow) SHALL continue to work without a `source` field; the email send is skipped
when `source` is absent or not `"signup-promotion"`.

**AC4.3 — Email subject**
The confirmation email subject SHALL be:
"You're signed up — see you at the Loudoun Children's Business Fair!"

**AC4.4 — Email HTML body content**
The HTML body SHALL include all of the following:
- A thank-you heading: "Thank you for signing up!"
- A sentence thanking the visitor for their support during the early launch.
- The event name: "Loudoun Children's Business Fair".
- The event date: Saturday, September 12, 2026.
- The event time: 11 AM – 3 PM.
- A reminder to visit the Small Gift Shop booth to collect their surprise gift.
- The site name "It Is A Small Gift Co." in the footer.
- The brand color `#F47F6B` used for the heading, consistent with other emails.

**AC4.5 — Plain-text fallback**
The email SHALL include a plain-text alternative body with the same key information
(thank-you, event name, date, time, gift reminder) and no HTML markup.

**AC4.6 — SES failure is silent (does not block the 201 response)**
WHEN SES fails to send the confirmation email THEN the system SHALL log a warning to
`console.warn` (matching the pattern of `sendOrderConfirmation`) and SHALL still return
HTTP 201 to the frontend. Email delivery failure SHALL NOT cause the submission to fail.
The visitor's data is already persisted; an admin can follow up manually if needed.

**AC4.7 — No effect on existing future-party admin email flow**
The existing `sendFuturePartyEmail` function (used by the admin `POST
/admin/api/future-parties/:id/send-link` endpoint) SHALL remain unchanged. Adding
`sendSignupPromotionEmail` SHALL be an additive change only.

---

## R5 — Route Registration: /build Path Serves HomePage

**User story:** As a developer, I want the `/build` path to resolve to the existing
`HomePage` so that no new page or component is created just to host this feature.

**Context:** `frontend/src/App.tsx` currently defines the React Router routes. The
`/build` path may not be registered yet. If it is not, it must be added as an alias that
renders the same `HomePage` component. If it already resolves to `HomePage`, no change
is needed.

### Acceptance Criteria

**AC5.1 — /build resolves to HomePage**
WHEN a visitor navigates to `/build` THEN the React Router SHALL render the `HomePage`
component (same component rendered at `/`).

**AC5.2 — No new page component**
The `/build` route SHALL NOT introduce a new page component. It SHALL reference the
existing `HomePage`.

**AC5.3 — Other routes unaffected**
Adding (or confirming) the `/build` route SHALL NOT change the behaviour of any other
route in `App.tsx`.

---

## Non-Goals

- Creating a new database table or backend endpoint for this feature.
- Persisting the `/build` path or the `source` field in a dedicated column in
  `future_parties` (the design may choose to store `source` in a column or strip it —
  that is a design decision, not a business requirement).
- Admin UI changes — no new admin page, list column, or action is introduced for
  sign-up promotion submissions (they appear in the existing future-parties admin list).
- Email open/click tracking.
- Scheduled or batched emails (the confirmation email is always sent at submission time).
- Editing or deleting a signup-promotion submission via the admin UI.
- Showing a different success message to the admin based on whether the submission came
  from the promotion modal vs. the "Plan For Future" button.
