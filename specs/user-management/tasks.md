# FEAT-001 — User Management: Implementation Tasks

> **Status:** In progress — tests deferred
> **Last updated:** 2026-08-31
> **Design:** `specs/user-management/design.md`
> **Requirements:** `specs/user-management/requirements.md`

---

## Parallelism Map

```
Phase 1 (T1)          ──────────────────────────────────────┐
                                                             ▼
Phase 2 (T2 → T3 → T4 → T5)  backend work (sequential)    Phase 5 (T10, T11) tests
                                                             ▲
Phase 3 (T6 → T7)     ──────────────────────────────────────┤
                                                             │
Phase 4 (T8, T9 parallel → T9b)  frontend pages             │
                                                             │
Phase 6 (T12)          smoke — depends on all               ▘
```

- **T1 and T6 can start immediately in parallel** (no dependencies).
- T2 depends on T1.
- T3 depends on T2; T4 depends on T3; T5 depends on T4.
- T7 depends on T6.
- T8 depends on T7; T9 depends on T7.
- T9b depends on T8, T9, and T5 (profile page needs backend endpoint live).
- T10 depends on T5; T11 depends on T5.
- T12 depends on all.

---

## Tasks

### T1 — DB Migration: create user_profile table

- **Agent:** backend-engineer
- **Status:** `[x]` completed
- **Depends on:** none
- **Requirements:** R6 (AC6.2, AC6.3), R8 (AC8.1, AC8.4)

**Description:**
Create the node-pg-migrate SQL migration file at `backend-node/migrations/<timestamp>_create_user_profile.sql`.

Expected output: a SQL file containing the `CREATE TABLE user_profile` DDL (with cross-schema FK to `auth.users(id) ON DELETE CASCADE`), the `set_updated_at` trigger function, and the trigger binding. See `specs/user-management/design.md` Section 3 for the exact DDL.

Verify by running `npm run migrate` locally against a Supabase dev database and confirming the table exists with the correct columns and FK.

---

### T2 — Backend: JWT middleware + Express type augmentation

- **Agent:** backend-engineer
- **Status:** `[x]` completed
- **Depends on:** T1
- **Requirements:** R7 (AC7.1, AC7.2, AC7.3, AC7.4, AC7.5)

**Description:**
1. Install `jose` package: `npm install jose` in `backend-node/`.
2. Create `backend-node/src/types/express.d.ts` with the `req.user` type augmentation (`id: string`, `email: string`). See design Section 4 and Section 8.
3. Create `backend-node/src/middleware/jwtAuth.ts`:
   - Read `SUPABASE_JWT_SECRET` from env at module scope; throw on missing.
   - Use `jose` `jwtVerify` with `HS256` algorithm.
   - On invalid/missing/expired token → return HTTP 401 ProblemDetail (type `about:unauthorized`, shape per AC7.2).
   - On success → set `req.user = { id: payload.sub, email: payload.email }` → call `next()`.

Expected output: the two new files; `npm run build` passes; `npm run lint` passes.

---

### T3 — Backend: User profile repository

- **Agent:** backend-engineer
- **Status:** `[x]` completed
- **Depends on:** T2
- **Requirements:** R8 (AC8.1, AC8.2, AC8.4)

**Description:**
1. Add `UserProfileRow` interface to `backend-node/src/types/entities.ts`.
2. Create `backend-node/src/repositories/userProfile.ts` with two exported functions:
   - `getProfile(userId: string): Promise<UserProfileRow | null>` — SELECT from `user_profile` WHERE `user_id = $1`.
   - `upsertProfile(userId: string, data: { displayName?: string | null; phoneNumber?: string | null }): Promise<UserProfileRow>` — INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
   Both functions use the `sql` tagged-template singleton from `db.ts`. `prepare: false` is already set.

Expected output: the repository file; builds and lints cleanly.

---

### T4 — Backend: Profile route + app wiring

- **Agent:** backend-engineer
- **Status:** `[x]` completed
- **Depends on:** T3
- **Requirements:** R6 (AC6.4), R7 (AC7.1, AC7.5), R8 (AC8.1, AC8.2, AC8.3, AC8.4)

**Description:**
1. Create `backend-node/src/routes/user/profile.ts`:
   - Export `userProfileRouter` (Express Router).
   - Apply `jwtAuth` middleware at router level.
   - `GET /` — fetch profile via `getProfile(req.user.id)`, return `toProfileDto(...)` with HTTP 200 (null fields if no row).
   - `PATCH /` — Zod-validate body with `UpdateProfileSchema` (displayName max 100 chars, phoneNumber E.164 regex or null); call `upsertProfile`; return updated DTO.
   - Zod validation errors → pass to existing `errorHandler` middleware (HTTP 400 ProblemDetail, type `about:validation-error`).
2. Modify `backend-node/src/app.ts` (additive only):
   - Import `userProfileRouter`.
   - Mount at `/api/user/profile`.
   - No existing mounts are changed.

Expected output: the route file; `app.ts` updated; `GET /api/user/profile` returns 401 when called without a token (verifiable with `curl`); `npm run build` and `npm run lint` pass.

---

### T5 — Backend: Environment variable wiring (serverless.yml + deploy workflow)

- **Agent:** backend-engineer
- **Status:** `[x]` completed
- **Depends on:** T4
- **Requirements:** R7 (AC7.4)

**Description:**
1. In `infra/serverless.yml`, add `SUPABASE_JWT_SECRET: ${env:SUPABASE_JWT_SECRET}` to the Lambda function's `environment` block.
2. In `.github/workflows/deploy.yml`, Job 2 (deploy-frontend), update the frontend build step to also pass `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables (from GitHub Actions Variables).
3. Document in the PR description that the following must be added in GitHub before the deploy will succeed:
   - Secret: `SUPABASE_JWT_SECRET`
   - Variable: `VITE_SUPABASE_URL`
   - Variable: `VITE_SUPABASE_ANON_KEY`

Expected output: updated `serverless.yml` and `deploy.yml`; no new secrets committed to the repo.

---

### T6 — Frontend: Install Supabase client + create singleton + auth context

- **Agent:** frontend-engineer
- **Status:** `[x]` completed
- **Depends on:** none
- **Requirements:** R1 (AC1.3), R3 (AC3.2), R4 (AC4.2, AC4.3), R5 (AC5.1, AC5.5, AC5.6)

**Description:**
1. Install `@supabase/supabase-js` in `frontend/`: `npm install @supabase/supabase-js`.
2. Create `frontend/src/lib/supabaseClient.ts` — singleton `supabase` client initialized with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Throw at module init if either env var is missing. See design Section 11.
3. Create `frontend/src/contexts/AuthContext.tsx`:
   - On mount: `supabase.auth.getSession()` → set `session` and `user`; set `loading = false`.
   - Subscribe to `supabase.auth.onAuthStateChange()` → update state; unsubscribe on unmount.
   - Export `AuthProvider` and `useAuth` hook. See design Section 12.
4. Wrap the application root (in `main.tsx` or `App.tsx`) with `<AuthProvider>`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` entries to `frontend/.env.example`.

Expected output: app builds (`npm run build`); auth context available to all components; no `VITE_SUPABASE_*` values committed (only `.env.example` with placeholder text).

---

### T7 — Frontend: Router setup + ProtectedRoute component

- **Agent:** frontend-engineer
- **Status:** `[x]` completed
- **Depends on:** T6
- **Requirements:** R2 (AC2.4), R5 (AC5.4, AC5.5)

**Description:**
1. Create `frontend/src/components/ProtectedRoute.tsx`:
   - While `loading` is true → show a centered `<CircularProgress />`.
   - If `session` is null → `<Navigate to="/login" replace />`.
   - If `session.user.email_confirmed_at` is null → `<Navigate to="/verify-email" replace />`.
   - Otherwise → render `children` (or `<Outlet />` for nested routes).
2. Add new routes to the existing React Router configuration (in `App.tsx` or the router file):
   - `/login` → `<LoginPage>` (wrap with GuestRoute that redirects to `/profile` if already authenticated)
   - `/register` → `<RegisterPage>` (same GuestRoute)
   - `/auth/callback` → `<AuthCallbackPage>` (no guard)
   - `/profile` → `<ProtectedRoute><ProfilePage /></ProtectedRoute>`
   - `/verify-email` → `<EmailVerificationNoticePage>` (no guard needed; shows notice regardless)

Expected output: navigating to `/profile` without a session redirects to `/login`; router renders without errors; `npm run build` passes.

---

### T8 — Frontend: LoginPage and RegisterPage

- **Agent:** frontend-engineer
- **Status:** `[x]` completed
- **Depends on:** T7
- **Requirements:** R1 (AC1.1–AC1.5), R3 (AC3.1–AC3.5), R4 (AC4.1–AC4.4)

**Description:**
Create `frontend/src/pages/LoginPage.tsx` and `frontend/src/pages/RegisterPage.tsx`. Both use MUI components.

`LoginPage`:
- Fields: email, password.
- "Continue with Google" MUI Button → `signInWithOAuth`.
- Submit → `signInWithPassword`. Map Supabase error codes to user messages per AC3.3, AC3.4, AC3.5.
- On success → `navigate('/profile')`.
- Link to `/register`.
- If navigated here with `location.state.oauthError` → display OAuth cancel message (AC4.4).

`RegisterPage`:
- Fields: email, password, confirm password.
- Client-side validation before calling Supabase (AC1.2): email format, password length >= 8, passwords match. Inline MUI `FormHelperText` errors.
- "Continue with Google" button.
- Submit → `signUp`. Map duplicate-email error per AC1.4; other errors per AC1.5.
- On success → show success alert; do NOT navigate (AC1.3).
- Link to `/login`.

Expected output: both pages render; form validation works without network calls; Supabase calls are wired (even if Supabase env vars are placeholder values during development, the call shape must be correct).

---

### T9 — Frontend: AuthCallbackPage and EmailVerificationNoticePage

- **Agent:** frontend-engineer
- **Status:** `[x]` completed
- **Depends on:** T7
- **Requirements:** R2 (AC2.2, AC2.3, AC2.5), R4 (AC4.3, AC4.4)

**Description:**
Create `frontend/src/pages/AuthCallbackPage.tsx` and `frontend/src/pages/EmailVerificationNoticePage.tsx`.

`AuthCallbackPage`:
- On mount: inspect URL for `error` query param → if present, navigate to `/login` with `oauthError` state (AC4.4).
- Otherwise call `supabase.auth.exchangeCodeForSession(window.location.search)`.
- On success → navigate to `/profile` (AC2.2, AC4.3).
- On error → show error message with resend button (AC2.3); call `supabase.auth.resend(...)` on button click.
- Show loading spinner while exchange is in progress.

`EmailVerificationNoticePage`:
- Display notice text per AC2.4.
- "Resend verification email" button → `supabase.auth.resend({ type: 'signup', email: user?.email })` → show confirmation per AC2.5.
- "Sign out" link → `supabase.auth.signOut()` → navigate `/login`.

Expected output: both pages render; code paths are wired; `npm run build` passes.

---

### T9b — Frontend: ProfilePage

- **Agent:** frontend-engineer
- **Status:** `[x]` completed
- **Depends on:** T8, T9, T5
- **Requirements:** R6 (AC6.1–AC6.6)

**Note:** Depends on T5 because it makes live API calls to `/api/user/profile`. Can be built and mocked locally before T5 completes, but the full end-to-end flow requires the backend to be deployed with `SUPABASE_JWT_SECRET` set.

**Description:**
Create `frontend/src/lib/userApi.ts` (typed fetch wrappers) and `frontend/src/pages/ProfilePage.tsx`.

`userApi.ts`:
- `getProfile(accessToken)` → GET `/api/user/profile`.
- `updateProfile(accessToken, body)` → PATCH `/api/user/profile`.
See design Section 15 for the exact shape.

`ProfilePage.tsx`:
- On mount: call `getProfile(session.access_token)` → populate form state.
- Display email (read-only) from `session.user.email`.
- Display name and phone number fields (editable).
- Client-side validation before submit (AC6.5): displayName 1–100 chars optional; phone E.164 or empty optional.
- Submit → `updateProfile(session.access_token, { displayName, phoneNumber })`.
  - Success → show MUI success alert "Profile updated." (AC6.4).
  - Error → show "Failed to save profile. Please try again." without clearing form (AC6.6).
- "Sign out" button → `supabase.auth.signOut()` → navigate `/login`.

Expected output: ProfilePage renders; form populated from API; submit wired; sign-out works.

---

### T10 — Backend integration tests: JWT middleware

- **Agent:** backend-engineer
- **Status:** `[ ]` pending — deferred (out of scope for this execution pass)
- **Depends on:** T5
- **Requirements:** R7 (AC7.1, AC7.2, AC7.3, AC7.5)

**Description:**
Create `backend-node/tests/integration/jwtAuth.test.ts`. Use Vitest + supertest.

Test cases:
1. Request to `GET /api/user/profile` with no Authorization header → 401, body matches AC7.2 shape.
2. Request with `Authorization: Bearer invalid-token` → 401.
3. Request with an expired valid-structure JWT (sign with test secret, set `exp` in the past) → 401.
4. Request with a valid JWT signed with wrong secret → 401.
5. Request with a valid JWT → 200 (may return null profile, but not 401).
6. Confirm `GET /api/health` (existing public route) with no auth → still 200 (AC7.5 — no interference).

**Test JWT helper:** create `backend-node/tests/helpers/testJwt.ts` that signs a JWT using `jose` with `SUPABASE_JWT_SECRET` from env, a given `sub` UUID, and a given `exp`.

Expected output: all 6 tests pass against a real test database.

---

### T11 — Backend integration tests: profile endpoints

- **Agent:** backend-engineer
- **Status:** `[ ]` pending — deferred (out of scope for this execution pass)
- **Depends on:** T10
- **Requirements:** R8 (AC8.1, AC8.2, AC8.3, AC8.4)

**Description:**
Create `backend-node/tests/integration/userProfile.test.ts`. Use Vitest + supertest.

Test cases:
1. `GET /api/user/profile` with valid JWT, no profile row → 200, `displayName: null`, `phoneNumber: null`.
2. `PATCH /api/user/profile` with valid JWT + `{ displayName: "Alice" }` → 200, returns `displayName: "Alice"`.
3. Subsequent `GET` → 200, `displayName: "Alice"`.
4. `PATCH` with `{ phoneNumber: "+12125551234" }` → 200, phone updated, displayName preserved.
5. `PATCH` with `{ phoneNumber: "not-e164" }` → 400 ProblemDetail, type `about:validation-error`.
6. `PATCH` with `{ displayName: "x".repeat(101) }` → 400 ProblemDetail.
7. Confirm that a JWT for user A cannot see or overwrite user B's profile (user isolation — AC8.4). Use two different sub UUIDs; each should only see their own data.

**FK note:** The test setup must insert a row into `auth.users` for each test UUID, or the FK constraint will reject the `user_profile` insert. Use the Supabase CLI local dev stack or a test Supabase project. If neither is available, a test teardown that temporarily drops the FK in the test schema is acceptable as a documented workaround.

Expected output: all 7 tests pass.

---

### T12 — Manual smoke test: full end-to-end auth flow

- **Agent:** qa-engineer
- **Status:** `[ ]` pending — deferred (requires live Supabase env; run after deployment)
- **Depends on:** T9b, T11
- **Requirements:** All (R1–R8)

**Description:**
After deployment to the staging/production environment with all environment variables set, verify the following flows manually:

1. **Email registration:** Register new account → receive email → click link → land on `/profile` → profile shows correct email.
2. **Duplicate email:** Attempt to register with same email → see correct error message.
3. **Email login:** Sign out → log back in with email+password → land on `/profile`.
4. **Wrong password:** Attempt login with wrong password → see "Invalid email or password."
5. **Google OAuth:** Click "Continue with Google" → Google consent screen → redirect back → land on `/profile`.
6. **Google OAuth cancel:** Click "Continue with Google" → cancel on Google screen → redirected to `/login` with cancel message.
7. **Profile update:** Edit display name and phone number → submit → see "Profile updated." → refresh page → values persist.
8. **Phone validation:** Enter invalid phone (e.g., `123`) → see inline error → no network call made.
9. **Session persistence:** Sign in → close tab → reopen `https://www.smallgift.shop/profile` → should remain signed in (session restored from localStorage).
10. **Sign out:** Click Sign out → redirected to `/login` → navigating to `/profile` redirects back to `/login`.
11. **Protected route:** Navigate directly to `/profile` without session → redirected to `/login`.
12. **Existing routes unaffected:** `GET /api/health`, `POST /api/generated-bundles`, admin endpoints → all behave as before with no regressions.

Expected output: all 12 scenarios pass. Document any failures with screenshots and open issues.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| `[ ]` | Pending |
| `[-]` | In progress (note assigned agent) |
| `[x]` | Completed |
| `[!]` | Blocked (note reason) |
