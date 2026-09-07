# FEAT-001 — User Management: Requirements

> **Status:** Draft — awaiting tech-lead design
> **Last updated:** 2026-08-31

---

## 1. Overview

### Goal

Enable end-users of the Goodie Bag platform to create accounts, sign in, and manage a basic profile. Authentication is powered entirely by **Supabase Auth** — the platform's existing Supabase PostgreSQL instance already provides this capability at no additional infrastructure cost.

### Target Users

Parents and party planners who visit `https://www.smallgift.shop` to configure and save goodie-bag bundles for children's birthday parties.

### Scope

- Email + password registration and login
- Google OAuth registration and login (via Gmail)
- Supabase email verification flow
- User profile page (display name, phone number)
- Persistent authenticated session across browser refreshes
- Backend JWT verification middleware to protect future user-scoped endpoints

### Non-Goals (out of scope for this feature)

- Saving or re-loading previously generated bundles (a separate feature)
- Password-less magic link sign-in
- Social providers other than Google (Apple, Facebook, etc.)
- Admin-facing user management tools
- Role-based access control beyond "authenticated user" vs. "unauthenticated user"

---

## 2. Requirements

### R1 — Email + Password Registration

**User story:** As a new visitor, I want to register for an account using my email address and a password of my choosing, so that I can have a personal account on the platform.

#### Acceptance Criteria

**AC1.1 — Registration page availability**
WHEN a user navigates to `/register`, THEN the system SHALL display a registration form with fields for: email address, password, and password confirmation.

**AC1.2 — Field validation (client-side)**
WHEN a user submits the registration form, THEN the system SHALL validate:
- Email is non-empty and conforms to standard email format (RFC 5322 simplified).
- Password is at least 8 characters.
- Password confirmation matches the password field exactly.
Any failed validation MUST surface an inline error message adjacent to the relevant field without submitting to the server.

**AC1.3 — Successful registration flow**
WHEN all fields pass validation and the user submits, THEN the system SHALL:
1. Call Supabase Auth `signUp()` with the provided email and password.
2. Display a confirmation message instructing the user to check their inbox for a verification email.
3. Not automatically sign the user in until email verification is complete.

**AC1.4 — Duplicate email**
WHEN a user attempts to register with an email address already associated with a Supabase Auth account, THEN the system SHALL display an error message: "An account with this email already exists. Try signing in."

**AC1.5 — Network or Supabase error**
WHEN the Supabase `signUp()` call returns an error other than a duplicate-email error, THEN the system SHALL display a generic error message: "Registration failed. Please try again." and leave the form populated so the user can retry.

---

### R2 — Email Verification

**User story:** As a newly registered user, I want to verify my email address by clicking a link sent to my inbox, so that the platform can confirm I own the email I registered with.

#### Acceptance Criteria

**AC2.1 — Verification email dispatch**
WHEN a user completes registration (R1, AC1.3), THEN Supabase Auth SHALL automatically send a verification email to the supplied address using Supabase's built-in email flow.

**AC2.2 — Verification link handling**
WHEN a user clicks the verification link in their email, THEN the system SHALL:
1. Redirect the user to the frontend at a route that Supabase Auth handles (e.g., `/auth/callback`).
2. Exchange the token in the URL for an active Supabase session via `supabase.auth.exchangeCodeForSession()`.
3. Redirect the user to their profile page (`/profile`) upon successful exchange.

**AC2.3 — Expired or invalid verification link**
WHEN a user clicks a verification link that has expired or is malformed, THEN the system SHALL display an error page with the message: "This verification link is invalid or has expired. Please request a new one." and provide a button to trigger a new verification email.

**AC2.4 — Unverified user cannot access protected routes**
WHEN an unverified user (email_confirmed_at is null in Supabase) attempts to access the profile page (`/profile`), THEN the system SHALL redirect them to a notice page explaining that email verification is required, with an option to resend the verification email.

**AC2.5 — Resend verification email**
WHEN an unverified user requests a new verification email, THEN the system SHALL call Supabase Auth `resend()` with type `signup` and display a confirmation message: "Verification email sent. Please check your inbox."

---

### R3 — Sign In (Email + Password)

**User story:** As a registered and verified user, I want to sign in with my email and password, so that I can access my account.

#### Acceptance Criteria

**AC3.1 — Sign-in page availability**
WHEN a user navigates to `/login`, THEN the system SHALL display a sign-in form with fields for email and password, plus a link to the registration page and a link to the Google sign-in option.

**AC3.2 — Successful sign-in**
WHEN a registered, verified user submits correct credentials, THEN the system SHALL:
1. Call Supabase Auth `signInWithPassword()`.
2. Store the resulting session (access token + refresh token) via the Supabase JS client's built-in session persistence (localStorage).
3. Redirect the user to `/profile`.

**AC3.3 — Invalid credentials**
WHEN a user submits incorrect email or password, THEN the system SHALL display: "Invalid email or password." without indicating which field is wrong.

**AC3.4 — Unverified user sign-in attempt**
WHEN a user with an unverified email attempts to sign in with correct credentials, THEN the system SHALL display: "Please verify your email before signing in." with a link to resend the verification email.

**AC3.5 — Network or Supabase error**
WHEN the `signInWithPassword()` call fails for a reason other than invalid credentials or unverified email, THEN the system SHALL display: "Sign-in failed. Please try again." and leave the form populated.

---

### R4 — Google OAuth Sign-In / Registration

**User story:** As a user with a Google account, I want to register or sign in using Google, so that I do not need to create and remember a separate password.

#### Acceptance Criteria

**AC4.1 — Google sign-in button**
WHEN a user is on the `/login` or `/register` page, THEN the system SHALL display a "Continue with Google" button.

**AC4.2 — OAuth redirect initiation**
WHEN a user clicks "Continue with Google", THEN the system SHALL call Supabase Auth `signInWithOAuth({ provider: 'google', options: { redirectTo: '<frontend_origin>/auth/callback' } })`, which redirects the browser to Google's OAuth consent screen.

**AC4.3 — Successful OAuth callback**
WHEN Google redirects back to `/auth/callback` with a valid authorization code, THEN the system SHALL:
1. Exchange the code for a Supabase session via `supabase.auth.exchangeCodeForSession()`.
2. Persist the session via the Supabase JS client.
3. Redirect the user to `/profile`.

**AC4.4 — OAuth cancellation or denial**
WHEN the user cancels the Google OAuth consent screen or Google returns an error, THEN the system SHALL redirect the user back to `/login` with an inline message: "Google sign-in was cancelled or failed. Please try again."

**AC4.5 — First-time Google sign-in (auto-registration)**
WHEN a user signs in with Google for the first time, THEN Supabase Auth SHALL automatically create a new account linked to the Google identity. No separate registration step is required for Google users.

**AC4.6 — Google email already registered via email+password**
WHEN a user attempts Google OAuth with an email address that already has an email+password account, THEN Supabase Auth SHALL link the Google identity to the existing account (per Supabase's default identity-linking behavior). The user MUST be signed in to the existing account.

---

### R5 — Session Management

**User story:** As a signed-in user, I want my session to persist across browser refreshes and tabs, and to be able to sign out explicitly, so that I remain signed in when I return and can end my session when I choose.

#### Acceptance Criteria

**AC5.1 — Session persistence**
WHEN a user signs in (email+password or Google), THEN the Supabase JS client SHALL persist the session in localStorage so that the session survives browser refresh and new tab opens within the same origin.

**AC5.2 — Automatic token refresh**
WHEN the Supabase access token (JWT) nears expiry (default: 1 hour), THEN the Supabase JS client SHALL automatically use the refresh token to obtain a new access token without requiring the user to sign in again.

**AC5.3 — Sign-out**
WHEN a signed-in user clicks "Sign out", THEN the system SHALL:
1. Call Supabase Auth `signOut()`.
2. Clear the local session from localStorage.
3. Redirect the user to `/login`.

**AC5.4 — Protected route enforcement (frontend)**
WHEN an unauthenticated user (no valid Supabase session) navigates directly to `/profile`, THEN the system SHALL redirect them to `/login`.

**AC5.5 — Auth state on app load**
WHEN the React application loads, THEN the system SHALL call `supabase.auth.getSession()` to restore any existing session before rendering route-dependent UI, preventing a flash of unauthenticated state.

**AC5.6 — Auth state listener**
WHEN the Supabase session changes (sign-in, sign-out, token refresh), THEN the system SHALL update the application's auth state via `supabase.auth.onAuthStateChange()` so that all components reflect the current session immediately.

---

### R6 — User Profile Page

**User story:** As a signed-in user, I want to view and update my profile information, so that I can keep my account details current.

#### Acceptance Criteria

**AC6.1 — Profile page availability**
WHEN a verified, signed-in user navigates to `/profile`, THEN the system SHALL display their profile information: email address (read-only), display name, and phone number.

**AC6.2 — Profile data source**
WHEN the profile page loads, THEN the system SHALL:
1. Read the user's email from the active Supabase session (`session.user.email`).
2. Fetch the user's `display_name` and `phone_number` from the `user_profile` table in the application database using the authenticated user's Supabase `user.id` as the lookup key.

**AC6.3 — First-time profile load (no profile row exists)**
WHEN a user accesses the profile page for the first time and no row exists in `user_profile` for their `user_id`, THEN the system SHALL display empty/placeholder values for display name and phone number, and allow the user to fill them in.

**AC6.4 — Update profile**
WHEN a signed-in user edits their display name or phone number and submits the profile form, THEN the system SHALL:
1. Send a `PATCH /api/user/profile` request to the backend, including the Supabase JWT in the `Authorization: Bearer <token>` header.
2. The backend SHALL verify the JWT (see R7), upsert the `user_profile` row for the authenticated `user_id`, and return the updated profile.
3. The frontend SHALL display a success message: "Profile updated."

**AC6.5 — Profile validation**
WHEN a user submits the profile form, THEN the system SHALL validate:
- Display name: 1–100 characters if provided; optional.
- Phone number: valid E.164 format (e.g., `+12125551234`) or empty; optional.
Any failed validation MUST display an inline error without submitting to the server.

**AC6.6 — Profile update failure**
WHEN the backend returns an error on profile update, THEN the frontend SHALL display: "Failed to save profile. Please try again." without clearing the form.

---

### R7 — Backend JWT Verification

**User story:** As the platform operator, I want all user-scoped API endpoints to verify the caller's Supabase JWT, so that users can only access and modify their own data.

#### Acceptance Criteria

**AC7.1 — JWT middleware presence**
WHEN a request arrives at any endpoint under `/api/user/**`, THEN the system SHALL extract the `Authorization: Bearer <token>` header and verify the JWT is a valid, unexpired Supabase-issued token before processing the request.

**AC7.2 — Valid JWT required**
WHEN the `Authorization` header is absent or the token is invalid/expired, THEN the system SHALL return HTTP 401 with a ProblemDetail body:
```json
{
  "type": "about:unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "A valid authentication token is required.",
  "instance": "<request path>"
}
```

**AC7.3 — User identity extraction**
WHEN a valid JWT is verified, THEN the system SHALL make the Supabase `user.id` (UUID) available to downstream route handlers as `req.user.id`.

**AC7.4 — JWT verification method**
The backend SHALL verify Supabase JWTs by validating the signature against the Supabase project's JWT secret (`SUPABASE_JWT_SECRET` environment variable). Verification MUST be done with a standard JWT library (e.g., `jose` or `jsonwebtoken`) — the backend MUST NOT call the Supabase Management API or make a network round-trip per request to validate tokens.

**AC7.5 — No interference with existing routes**
The JWT middleware SHALL only apply to `/api/user/**` routes. Existing public routes (`/api/**`) and admin routes (`/admin/api/**`) MUST NOT be affected.

---

### R8 — Profile API Endpoints

**User story:** As the platform's backend, I want to expose minimal RESTful endpoints for reading and writing a user's profile, so that the frontend profile page has a clear API contract.

#### Acceptance Criteria

**AC8.1 — Get profile endpoint**
WHEN a verified request is received at `GET /api/user/profile`, THEN the system SHALL return the authenticated user's profile as JSON:
```json
{
  "userId": "<uuid>",
  "email": "<email from JWT claims>",
  "displayName": "<string or null>",
  "phoneNumber": "<string or null>",
  "createdAt": "<ISO 8601 timestamp>"
}
```
If no `user_profile` row exists for the user, the system SHALL return the above with `displayName: null` and `phoneNumber: null`.

**AC8.2 — Upsert profile endpoint**
WHEN a verified request is received at `PATCH /api/user/profile` with a body containing `displayName` (string | null) and/or `phoneNumber` (string | null), THEN the system SHALL upsert the `user_profile` row for the authenticated `user_id` and return the full updated profile (same shape as AC8.1).

**AC8.3 — Validation on upsert**
WHEN the request body for `PATCH /api/user/profile` fails Zod validation, THEN the system SHALL return HTTP 400 with a ProblemDetail body (same error format as existing routes).

**AC8.4 — User isolation**
The system SHALL ensure that a user can only read and modify their own profile row. The `user_id` used in all queries SHALL be taken from the verified JWT (`req.user.id`), never from the request body or URL params.

---

## 3. Error Taxonomy

All new backend error responses MUST conform to the existing RFC 7807 `ProblemDetail` format defined in `specs/tech-overview.md` Section 6.

| Condition | HTTP Status | `type` |
|---|---|---|
| Missing or invalid JWT | 401 | `about:unauthorized` |
| Valid JWT, accessing another user's data (future) | 403 | `about:forbidden` |
| `user_profile` row not found (GET) | Returns 200 with null fields, not 404 | — |
| Profile validation failure | 400 | `about:validation-error` |

---

## 4. Constraints and Assumptions

1. **Supabase Auth is the identity provider.** No custom auth tables or password hashing logic is introduced on the application side.
2. **Frontend uses the Supabase JS client (`@supabase/supabase-js` v2).** The `anon` key (public, safe to embed) is used on the frontend. The `service_role` key is never used on the frontend.
3. **Backend verifies JWTs offline** using `SUPABASE_JWT_SECRET` — no network call per request.
4. **Google OAuth must be enabled** in the Supabase project dashboard under Authentication > Providers before the feature can function.
5. **Email templates** (verification, password reset) are managed in the Supabase dashboard. Custom branding (logo, copy) is a separate concern outside this feature.
6. **The `user_profile` table** stores only supplemental profile fields (display name, phone number). Core identity fields (email, provider, UID) remain in Supabase's `auth.users` table and are never duplicated in application tables.
7. **Existing API contract is frozen.** New endpoints (`/api/user/**`) are additive. No existing routes are modified.
8. **Session storage:** Supabase JS client default (localStorage). No custom cookie-based sessions.
9. **PKCE flow** is used for OAuth to avoid token exposure in the URL fragment (Supabase JS v2 default for browser clients).
