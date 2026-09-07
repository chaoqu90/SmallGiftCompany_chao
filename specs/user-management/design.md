# FEAT-001 — User Management: Technical Design

> **Status:** Draft
> **Last updated:** 2026-08-31
> **Conforms to:** `specs/tech-overview.md` (golden copy)

---

## 1. Overview

This feature adds Supabase Auth-based user accounts to the Goodie Bag platform. The design is strictly additive — no existing routes, middleware, or DB tables are modified. All new backend endpoints live under `/api/user/**`; all new frontend routes live alongside existing SPA routes.

---

## 2. Supabase Dashboard Setup (Manual Steps — Not in Code)

These steps must be completed by an operator in the Supabase project dashboard before any code is deployed.

| Step | Location in Dashboard | Action |
|---|---|---|
| Enable email + password | Auth > Providers > Email | Ensure enabled; enable "Confirm email" toggle so new sign-ups require verification |
| Enable Google OAuth | Auth > Providers > Google | Enter Google Cloud OAuth 2.0 Client ID and Client Secret (obtained from Google Cloud Console) |
| Set Site URL | Auth > URL Configuration > Site URL | `https://www.smallgift.shop` |
| Add redirect URLs | Auth > URL Configuration > Redirect URLs | `https://www.smallgift.shop/auth/callback` and `http://localhost:5173/auth/callback` (for local dev) |
| Copy JWT secret | Project Settings > API > JWT Secret | Copy value → store as `SUPABASE_JWT_SECRET` GitHub Actions secret |
| Copy Anon key | Project Settings > API > anon public | Copy value → store as `VITE_SUPABASE_ANON_KEY` GitHub Actions variable |
| Copy Project URL | Project Settings > API > Project URL | Copy value → store as `VITE_SUPABASE_URL` GitHub Actions variable |

**Google Cloud Console steps (prerequisite for Google OAuth):**
1. Create an OAuth 2.0 Client ID (Web application type).
2. Add `https://<supabase-project-ref>.supabase.co/auth/v1/callback` as an Authorized Redirect URI.
3. Copy Client ID and Client Secret into the Supabase dashboard (step above).

---

### Local Development `.env` Setup

After completing the dashboard steps above, configure the local environment files so the app runs correctly on your machine.

#### `backend-node/.env`

Add the following variable (get the value from Supabase → Project Settings → API → JWT Secret):

```bash
# ── Supabase Auth ─────────────────────────────────────────────────────────────
# JWT secret used to verify Supabase-issued access tokens on protected endpoints
SUPABASE_JWT_SECRET=<paste-jwt-secret-here>
```

The full `backend-node/.env` should now look like:

```bash
DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
CORS_ALLOWED_ORIGIN=http://localhost:5173
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
NODE_ENV=development
SUPABASE_JWT_SECRET=<paste-jwt-secret-here>
```

#### `frontend/.env.local` (create this file — it is gitignored)

The Vite dev server reads `frontend/.env.local` for local overrides. Create it with:

```bash
# ── Supabase ──────────────────────────────────────────────────────────────────
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<paste-anon-key-here>

# ── Backend API ───────────────────────────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:8080
```

Get the values from Supabase → Project Settings → API:
- **`VITE_SUPABASE_URL`** — "Project URL" field
- **`VITE_SUPABASE_ANON_KEY`** — "anon public" key under "Project API keys"

> **Note:** Never commit `frontend/.env.local` or any file containing real keys. The `.gitignore` already excludes `.env.local`. Use `frontend/.env.example` (committed, no real values) as the reference template.

#### Verifying local setup

Once both files are populated, start the backend and frontend as usual:

```bash
# Terminal 1 — backend
cd backend-node
npm run migrate:local   # applies migration 004 (user_profile table)
npm run dev             # starts on http://localhost:8080

# Terminal 2 — frontend
cd frontend
npm run dev             # starts on http://localhost:5173
```

Then visit `http://localhost:5173/register` — the registration page should render. Attempting to register will make a real Supabase Auth call (email goes to your Supabase project's email delivery, which uses Supabase's built-in SMTP in development).

---

## 3. Database Migration

**File:** `backend-node/migrations/<timestamp>_create_user_profile.sql`

Use `node-pg-migrate`'s SQL migration format. The file is named with a Unix timestamp prefix matching the project's existing migration naming convention (e.g., `1722000000000_create_user_profile.sql`).

```sql
-- Migration: create user_profile table
-- References auth.users in the Supabase auth schema (cross-schema FK)

CREATE TABLE user_profile (
  user_id     UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100)  NULL,
  phone_number VARCHAR(20)   NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Index is not needed beyond the PK (user_id is the sole lookup key)

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_profile_updated_at
  BEFORE UPDATE ON user_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Notes:**
- `auth.users` lives in Supabase's managed `auth` schema. The FK `REFERENCES auth.users(id)` is valid because Supabase PostgreSQL grants cross-schema references.
- `ON DELETE CASCADE` means deleting a Supabase Auth user automatically removes their profile row.
- `prepare: false` is already set on the postgres.js client — no changes needed for the migration runner.
- The `set_updated_at` function may already exist from a prior migration. Use `CREATE OR REPLACE` to be safe.

---

## 4. Backend: Type Augmentation for `req.user`

**File:** `backend-node/src/types/express.d.ts` (new file)

Augments the Express `Request` type so that TypeScript recognizes `req.user` after the JWT middleware runs.

```typescript
// Declaration merging for Express Request
declare namespace Express {
  interface Request {
    user?: {
      id: string; // Supabase user UUID (JWT `sub` claim)
    };
  }
}
```

This file does not need to be imported anywhere — TypeScript picks it up via `tsconfig.json`'s `include` glob. Verify `tsconfig.json` includes `src/**/*.d.ts` or `src/**/*.ts`.

---

## 5. Backend: JWT Verification Middleware

**File:** `backend-node/src/middleware/jwtAuth.ts`

**Library:** `jose` (ESM-native; no CommonJS shim needed; recommended over `jsonwebtoken` for ESM projects).

Install: `npm install jose` (in `backend-node/`).

**Design:**
- Read `SUPABASE_JWT_SECRET` from `process.env` at module initialization (fail fast if missing).
- Convert the secret to a `KeyLike` using `jose`'s `createSecretKey(Buffer.from(secret, 'utf8'))`.
- On each request: extract `Authorization: Bearer <token>` header; if absent → 401. Call `jwtVerify(token, secretKey, { algorithms: ['HS256'] })`; if it throws → 401. On success, set `req.user = { id: payload.sub as string }` and call `next()`.
- Error response shape matches AC7.2 (RFC 7807 ProblemDetail).

**Module initialization guard:**

```typescript
if (!process.env.SUPABASE_JWT_SECRET) {
  throw new Error('SUPABASE_JWT_SECRET environment variable is required.');
}
```

This mirrors the pattern in `db.ts` — fail at cold start rather than silently at runtime.

---

## 6. Backend: User Profile Repository

**File:** `backend-node/src/repositories/userProfile.ts`

Uses the existing `sql` singleton from `db.ts`. Two exported functions:

**`getProfile(userId: string)`** — returns `UserProfileRow | null`. Query:
```sql
SELECT user_id, display_name, phone_number, created_at
FROM user_profile
WHERE user_id = $1
```

**`upsertProfile(userId: string, data: { displayName?: string | null; phoneNumber?: string | null })`** — returns `UserProfileRow`. Query:
```sql
INSERT INTO user_profile (user_id, display_name, phone_number)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE
  SET display_name  = EXCLUDED.display_name,
      phone_number  = EXCLUDED.phone_number,
      updated_at    = now()
RETURNING user_id, display_name, phone_number, created_at
```

**`UserProfileRow` type** (add to `backend-node/src/types/entities.ts`):
```typescript
export interface UserProfileRow {
  user_id:      string;
  display_name: string | null;
  phone_number: string | null;
  created_at:   Date;
}
```

---

## 7. Backend: User Profile Route

**File:** `backend-node/src/routes/user/profile.ts`

**Pattern:** Follows `routes/admin/products.ts` exactly (Router export, Zod validation, RFC 7807 errors).

**Zod schema for PATCH body:**
```typescript
const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).nullable().optional(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional(),
});
```

E.164 regex: `^\+[1-9]\d{6,14}$` — matches `+12125551234` style; total length 8–16 chars including `+`.

**DTO mapper** — maps `UserProfileRow` + JWT email to the response shape (AC8.1):
```typescript
function toProfileDto(row: UserProfileRow | null, userId: string, email: string) {
  return {
    userId:      userId,
    email:       email,
    displayName: row?.display_name ?? null,
    phoneNumber: row?.phone_number ?? null,
    createdAt:   row?.created_at?.toISOString() ?? null,
  };
}
```

**GET /api/user/profile:**
1. `req.user.id` is available (guaranteed by `jwtAuth` middleware applied at router level).
2. Email is extracted from the decoded JWT payload stored on `req.user` — extend `req.user` to also carry `email: string` (add to the type augmentation in step 4).
3. Call `getProfile(req.user.id)`.
4. Return `toProfileDto(row, req.user.id, req.user.email)` with HTTP 200 (even if row is null).

**PATCH /api/user/profile:**
1. Parse and validate body with `UpdateProfileSchema`.
2. Call `upsertProfile(req.user.id, data)`.
3. Return updated `toProfileDto(row, req.user.id, req.user.email)` with HTTP 200.

**Router export:**
```typescript
export const userProfileRouter = Router();
userProfileRouter.use(jwtAuth);
userProfileRouter.get('/', handler);
userProfileRouter.patch('/', handler);
```

---

## 8. Backend: Updated Type Augmentation (carrying email)

Extend the `req.user` type (from section 4) to also hold `email`:

```typescript
declare namespace Express {
  interface Request {
    user?: {
      id:    string; // JWT `sub` claim — Supabase user UUID
      email: string; // JWT `email` claim
    };
  }
}
```

In `jwtAuth.ts`, after `jwtVerify`, set:
```typescript
req.user = {
  id:    payload.sub as string,
  email: payload.email as string,
};
```

Supabase JWTs always include the `email` claim for email-based identities. For Google OAuth users the email comes from the Google identity and is also present in the JWT.

---

## 9. Backend: App Wiring

**File:** `backend-node/src/app.ts` (modify — additive only)

Add the new user router after existing route mounts:

```typescript
import { userProfileRouter } from './routes/user/profile.js';
// ...existing imports...

// After existing route mounts:
app.use('/api/user/profile', userProfileRouter);
```

No existing mounts are changed. The new route namespace `/api/user/**` does not conflict with `/api/**` (existing public routes) or `/admin/api/**`.

---

## 10. Backend: New Environment Variables

### `serverless.yml` (in `infra/`)

Add to the `environment` section under the `app` function:
```yaml
SUPABASE_JWT_SECRET: ${env:SUPABASE_JWT_SECRET}
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are frontend-only Vite build-time variables — they are NOT injected into Lambda.

### GitHub Actions Secrets (new)
| Secret | Value |
|---|---|
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase dashboard (sensitive — keep as a secret, not a variable) |

### GitHub Actions Variables (new, non-sensitive)
| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (e.g., `https://xyzabc.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (safe to embed in browser JS) |

### Frontend build command update (`deploy.yml`, Job 2, step 2)

```yaml
- name: Build frontend
  run: |
    VITE_API_BASE_URL=${{ steps.backend.outputs.ApiGatewayUrl }} \
    VITE_SUPABASE_URL=${{ vars.VITE_SUPABASE_URL }} \
    VITE_SUPABASE_ANON_KEY=${{ vars.VITE_SUPABASE_ANON_KEY }} \
    npm run build
  working-directory: frontend
```

---

## 11. Frontend: Supabase Client Singleton

**File:** `frontend/src/lib/supabaseClient.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
```

Install: `npm install @supabase/supabase-js` (in `frontend/`).

The singleton is imported wherever auth calls are needed. It must never be re-instantiated.

---

## 12. Frontend: Auth Context

**File:** `frontend/src/contexts/AuthContext.tsx`

**Shape:**
```typescript
interface AuthContextValue {
  session:  Session | null;
  user:     User | null;
  loading:  boolean;
}
```

**Behavior:**
- On mount: call `supabase.auth.getSession()` to restore any existing session. Set `loading = false` when done.
- Subscribe to `supabase.auth.onAuthStateChange()` — update `session` and `user` on every state change event. Unsubscribe on component unmount (use the `subscription.unsubscribe()` returned by `onAuthStateChange`).
- Wrap `<App />` (or the router) with `<AuthProvider>` in `main.tsx` or `App.tsx`.

**Usage in components:** `const { session, user, loading } = useAuth();`

---

## 13. Frontend: React Router Route Structure

**Existing pattern:** React Router v6+ with `<BrowserRouter>` and `<Routes>`.

**New routes to add:**

| Path | Component | Guard |
|---|---|---|
| `/login` | `LoginPage` | Redirect to `/profile` if already authenticated |
| `/register` | `RegisterPage` | Redirect to `/profile` if already authenticated |
| `/auth/callback` | `AuthCallbackPage` | None (must be accessible unauthenticated) |
| `/profile` | `ProfilePage` | `<ProtectedRoute>` — redirect to `/login` if not authenticated; redirect to `/verify-email` if authenticated but email not confirmed |
| `/verify-email` | `EmailVerificationNoticePage` | Redirect to `/profile` if authenticated + verified |

**`ProtectedRoute` component** — reads from `AuthContext`. While `loading` is true, renders a loading spinner. If `session` is null, navigates to `/login`. If `session.user.email_confirmed_at` is null (unverified), navigates to `/verify-email`. Otherwise renders `children`.

**`GuestRoute` component** (optional) — wraps `/login` and `/register`. If a session exists, redirects to `/profile` to prevent duplicate sign-in.

---

## 14. Frontend: Page Components

All pages use MUI components (`TextField`, `Button`, `Alert`, `CircularProgress`) consistent with the existing frontend design system.

### `LoginPage.tsx` (`frontend/src/pages/LoginPage.tsx`)
- State: `email`, `password`, `error`, `loading`, `pendingVerification`.
- "Continue with Google" button → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })`.
- Email form submit → `supabase.auth.signInWithPassword({ email, password })`.
  - Success → `navigate('/profile')`.
  - Error code `email_not_confirmed` → set `pendingVerification = true`, show resend link (AC3.4).
  - Error code `invalid_credentials` → show "Invalid email or password." (AC3.3).
  - Other errors → show "Sign-in failed. Please try again." (AC3.5).
- Link to `/register`.

### `RegisterPage.tsx` (`frontend/src/pages/RegisterPage.tsx`)
- State: `email`, `password`, `confirm`, `error`, `success`, `loading`.
- Client-side validation before calling Supabase (AC1.2).
- Submit → `supabase.auth.signUp({ email, password })`.
  - Success → show "Check your inbox for a verification email." (AC1.3). Do NOT navigate.
  - Error `User already registered` → show "An account with this email already exists. Try signing in." (AC1.4).
  - Other errors → show "Registration failed. Please try again." (AC1.5).
- "Continue with Google" button (same as LoginPage).
- Link to `/login`.

### `AuthCallbackPage.tsx` (`frontend/src/pages/AuthCallbackPage.tsx`)
- On mount: call `supabase.auth.exchangeCodeForSession(window.location.search)` (Supabase PKCE uses the `code` query param).
- Success → `navigate('/profile')`.
- Error (expired/invalid code, AC2.3; cancelled OAuth, AC4.4):
  - If URL contains `error` query param (OAuth cancellation) → `navigate('/login', { state: { oauthError: true } })`.
  - If `exchangeCodeForSession` fails → show error page with "This verification link is invalid or has expired." + resend button.
- Show a loading spinner while the exchange is in progress.

### `ProfilePage.tsx` (`frontend/src/pages/ProfilePage.tsx`)
- On mount: fetch `GET /api/user/profile` with `Authorization: Bearer ${session.access_token}`.
- State: `displayName`, `phoneNumber`, `saving`, `saveError`, `saveSuccess`.
- Display email (read-only) from `session.user.email`.
- Form submit → client-side validate (AC6.5) → `PATCH /api/user/profile` with Bearer token → update state → show "Profile updated." (AC6.4).
- "Sign out" button → `supabase.auth.signOut()` → `navigate('/login')` (AC5.3).

### `EmailVerificationNoticePage.tsx` (`frontend/src/pages/EmailVerificationNoticePage.tsx`)
- Displays: "Please verify your email address. Check your inbox for a verification link."
- "Resend verification email" button → `supabase.auth.resend({ type: 'signup', email: user.email })` → confirmation message (AC2.5).
- "Sign out" link.

---

## 15. Frontend: API Client for User Endpoints

**File:** `frontend/src/lib/userApi.ts`

Thin wrapper that fetches `/api/user/profile` with the Bearer token. Uses `VITE_API_BASE_URL` (already set at build time in the existing deploy workflow).

```typescript
const BASE = import.meta.env.VITE_API_BASE_URL;

export async function getProfile(accessToken: string) {
  const res = await fetch(`${BASE}/api/user/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

export async function updateProfile(
  accessToken: string,
  body: { displayName?: string | null; phoneNumber?: string | null }
) {
  const res = await fetch(`${BASE}/api/user/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}
```

---

## 16. Frontend: New `.env` Variables

**File:** `frontend/.env.example` (add entries — actual values in CI/CD, not committed)

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

For local development, create `frontend/.env.local` (gitignored) with real values.

---

## 17. Testing Strategy

### Backend integration tests

**File:** `backend-node/tests/integration/userProfile.test.ts`

Test cases (using Vitest + supertest against a real PostgreSQL instance):

1. `GET /api/user/profile` with no Authorization header → 401.
2. `GET /api/user/profile` with an expired JWT → 401.
3. `GET /api/user/profile` with a valid JWT for a user with no profile row → 200 with null fields.
4. `PATCH /api/user/profile` with valid JWT + valid body → 200 with updated profile.
5. `PATCH /api/user/profile` with valid JWT + invalid phone number → 400 ProblemDetail.
6. `PATCH /api/user/profile` followed by `GET` → returns same values.

**JWT generation for tests:** Sign a test JWT with the same `SUPABASE_JWT_SECRET` using `jose` in a test helper. Use a deterministic test UUID as the `sub` claim.

**No mocked DB:** Per `specs/tech-overview.md` Section 13, all integration tests hit a real PostgreSQL instance. The test setup must insert a test user into `auth.users` (or mock the FK constraint) before inserting `user_profile` rows.

> **Note on FK constraint in tests:** Since `user_profile.user_id` references `auth.users(id)`, integration tests need either (a) a test Supabase instance where they can insert into `auth.users`, or (b) temporarily disable the FK in the test schema. Recommend using a test Supabase project or a local `supabase` CLI instance that has the `auth` schema available.

### Frontend unit tests

Not required as part of this feature (no pure business-logic functions to unit test on the frontend). Auth flow is covered by the integration tests and manual smoke testing.

---

## 18. Security Notes

1. **`SUPABASE_JWT_SECRET` must never appear in frontend code or browser-accessible resources.**
2. **`SUPABASE_ANON_KEY` is public by design** — Supabase's Row Level Security (RLS) is the defense layer for the Supabase-managed tables. For the application's own `user_profile` table, the backend JWT middleware + `req.user.id` isolation provides the equivalent protection.
3. **Constant-time comparison is not needed for JWT verification** — `jose`'s `jwtVerify` is already cryptographically safe.
4. **PKCE** is used by default in `@supabase/supabase-js` v2 for browser OAuth flows — no additional configuration needed.
5. **Refresh tokens** are stored in localStorage by the Supabase JS client. This is the library's default and acceptable for this use case. Cookie-based storage would require server-side session handling which is out of scope.

---

## 19. New Files Summary

### Backend (`backend-node/src/`)
| File | Action |
|---|---|
| `middleware/jwtAuth.ts` | New — JWT verification middleware |
| `routes/user/profile.ts` | New — profile GET + PATCH handlers |
| `repositories/userProfile.ts` | New — getProfile + upsertProfile SQL functions |
| `types/express.d.ts` | New — Express Request type augmentation |
| `types/entities.ts` | Modify — add UserProfileRow interface |
| `app.ts` | Modify — mount /api/user/profile router |

### Backend migrations
| File | Action |
|---|---|
| `migrations/<timestamp>_create_user_profile.sql` | New — user_profile DDL |

### Frontend (`frontend/src/`)
| File | Action |
|---|---|
| `lib/supabaseClient.ts` | New — Supabase JS client singleton |
| `lib/userApi.ts` | New — typed fetch wrappers for /api/user/profile |
| `contexts/AuthContext.tsx` | New — session state + onAuthStateChange |
| `pages/LoginPage.tsx` | New — email+password + Google sign-in |
| `pages/RegisterPage.tsx` | New — email+password + Google registration |
| `pages/AuthCallbackPage.tsx` | New — PKCE code exchange + redirect |
| `pages/ProfilePage.tsx` | New — profile view + edit |
| `pages/EmailVerificationNoticePage.tsx` | New — unverified email notice + resend |
| `components/ProtectedRoute.tsx` | New — auth guard wrapper |
| `App.tsx` or router file | Modify — add new routes |
| `main.tsx` or `App.tsx` | Modify — wrap with AuthProvider |
| `.env.example` | Modify — add VITE_SUPABASE_* entries |

### Infrastructure
| File | Action |
|---|---|
| `infra/serverless.yml` | Modify — add SUPABASE_JWT_SECRET env var |
| `.github/workflows/deploy.yml` | Modify — add VITE_SUPABASE_* to frontend build step |
