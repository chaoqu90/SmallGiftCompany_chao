# Future Party — Technical Design

> **Feature ID:** FEAT-004
> **Status:** Draft — 2026-09-06
> **Conforms to:** `specs/tech-overview.md` (golden copy)
> **Requirements:** `specs/future-party/requirements.md`

---

## 1. Overview

This feature adds three independently deliverable layers:

1. **Public form** — a modal on the homepage (`HomePage.tsx`) that POSTs to a new public endpoint.
2. **Backend storage & endpoints** — a new DB table, a public POST, and three admin endpoints (list, link-bundle, send-link).
3. **Admin UI** — a new page at `/admin/future-parties` with list, bundle-generation dialog, and email-send action.

All backend work follows the established patterns in `specs/tech-overview.md`: Express + Zod validation + raw SQL via `postgres.js` + RFC 7807 error responses + AWS SES for email.

---

## 2. Database

### 2.1 New table: `future_parties`

Migration file: `backend-node/migrations/008_future_parties.ts`

```
future_parties
──────────────────────────────────────────────────────────────
id                      bigserial        PRIMARY KEY
email                   varchar(254)     NOT NULL
party_date              date             NOT NULL
kid_gender              varchar(10)      NOT NULL  CHECK (kid_gender IN ('BOY','GIRL','MIXED'))
kid_age                 smallint         NOT NULL  CHECK (kid_age BETWEEN 1 AND 12)
submitted_at            timestamptz      NOT NULL  DEFAULT now()
linked_bundle_public_id varchar(30)      NULL       -- FK-like reference; stored as plain varchar (no FK constraint)
bundle_sent_at          timestamptz      NULL
```

**Why no FK on `linked_bundle_public_id`:** Generated bundles can be deleted or expire. The admin should retain a historical record of what bundle was linked even if that bundle later disappears — identical to how `analytics_event.bundle_id` is a plain VARCHAR rather than an FK (see `003_analytics_event.ts`, constraint `AC6.3` in cart-and-order requirements).

**Indexes:**
```sql
CREATE INDEX idx_future_parties_submitted_at ON future_parties(submitted_at DESC);
CREATE INDEX idx_future_parties_email ON future_parties(email);
```

### 2.2 Migration structure

Follow the exact `up`/`down` pattern from `006_anonymous_cart.ts` and `007_payment_and_shipping.ts`:

```typescript
import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('future_parties', { ... });
  pgm.sql(`CREATE INDEX ...`);
  pgm.sql(`CREATE INDEX ...`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('future_parties');
}
```

---

## 3. Backend

### 3.1 Repository: `src/repositories/futureParties.ts`

All DB queries live here as named functions operating on the singleton `sql` client from `src/db.ts`. No ORM — raw SQL tagged templates only.

```
insertFutureParty(data: InsertFuturePartyData): Promise<FuturePartyRow>
listFutureParties(): Promise<FuturePartyRow[]>
findFuturePartyById(id: number): Promise<FuturePartyRow | undefined>
linkBundle(id: number, bundlePublicId: string): Promise<FuturePartyRow | undefined>
recordSend(id: number): Promise<FuturePartyRow | undefined>
```

`FuturePartyRow` is the raw snake_case DB shape:
```typescript
interface FuturePartyRow {
  id: number;
  email: string;
  party_date: string;          // DATE comes back as string from postgres.js
  kid_gender: string;
  kid_age: number;
  submitted_at: string;
  linked_bundle_public_id: string | null;
  bundle_sent_at: string | null;
}
```

### 3.2 Zod schemas: added to `src/types/dtos.ts`

```typescript
export const FuturePartyRequestSchema = z.object({
  email:     z.string().email().max(254),
  partyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'partyDate must be YYYY-MM-DD'),
  kidGender: z.enum(['BOY', 'GIRL', 'MIXED']),
  kidAge:    z.number().int().min(1).max(12),
});

export type FuturePartyRequest = z.infer<typeof FuturePartyRequestSchema>;

export const LinkBundleRequestSchema = z.object({
  bundlePublicId: z.string().min(1).max(30),
});
```

Server-side date validation (partyDate must be in the future) is applied inside the route handler after Zod parsing — compare `partyDate` to `new Date().toISOString().slice(0, 10)`.

### 3.3 DTO mapper

```typescript
function toFuturePartyDto(row: FuturePartyRow) {
  return {
    id:                   row.id,
    email:                row.email,
    partyDate:            row.party_date,
    kidGender:            row.kid_gender,
    kidAge:               row.kid_age,
    submittedAt:          row.submitted_at,
    linkedBundlePublicId: row.linked_bundle_public_id,
    bundleSentAt:         row.bundle_sent_at,
  };
}
```

### 3.4 Public route: `src/routes/futureParties.ts`

```
POST /api/future-parties
  Body: FuturePartyRequest
  Response 201: FuturePartyDto
  Response 400: ProblemDetail (validation failure)
```

Handler logic:
1. Parse body with `FuturePartyRequestSchema.parse(req.body)` — Zod errors auto-forwarded via `next(err)` to `errorHandler`.
2. Check `partyDate > today` — if not, call `next` with a Zod-like error or return 400 ProblemDetail manually.
3. Call `insertFutureParty(parsed)`.
4. Return `res.status(201).json(toFuturePartyDto(row))`.

No auth middleware on this router — it mirrors how `generatedBundlesRouter` is mounted.

### 3.5 Admin routes: `src/routes/admin/futureParties.ts`

All three handlers are on a single router with `basicAuth` applied at router level (same pattern as `adminOrdersRouter`).

#### GET `/admin/api/future-parties`

Returns all rows ordered by `submitted_at DESC`.

```
Response 200: FuturePartyDto[]
```

#### PATCH `/admin/api/future-parties/:id/link-bundle`

```
Body: { bundlePublicId: string }
Response 200: FuturePartyDto
Response 400: ProblemDetail — already has a linked bundle
Response 404: ProblemDetail — submission not found
```

Handler logic:
1. Parse and validate `id` as integer; return 400 if non-integer.
2. `findFuturePartyById(id)` — return 404 if not found.
3. If `row.linked_bundle_public_id` is already set, return 400 ProblemDetail (`"type": "about:validation-error"`, detail: "This submission already has a linked bundle.").
4. `linkBundle(id, bundlePublicId)`.
5. Return 200 with the updated DTO.

#### POST `/admin/api/future-parties/:id/send-link`

```
Response 200: { sentAt: string }
Response 404: ProblemDetail — submission not found
Response 422: ProblemDetail — no linked bundle
Response 500: ProblemDetail — SES failure
```

Handler logic:
1. `findFuturePartyById(id)` — return 404 if not found.
2. If `linked_bundle_public_id` is null, return 422 ProblemDetail (`type: "about:validation-error"`, detail: "No bundle linked to this submission.").
3. Build bundle URL: `${process.env.FRONTEND_URL}/bundleCustomization/${row.linked_bundle_public_id}`.
4. Call `sendFuturePartyEmail({ toEmail, partyDate, kidGender, bundleUrl })` — see §3.6.
5. On success, call `recordSend(id)` to set `bundle_sent_at = now()`.
6. Return 200 `{ sentAt: updatedRow.bundle_sent_at }`.
7. On SES throw, do NOT call `recordSend`. Return 500 ProblemDetail (`type: "about:internal-error"`). Do not swallow the error silently — the admin must know.

### 3.6 Email helper: `src/lib/email.ts` — new export `sendFuturePartyEmail`

Add alongside the existing `sendOrderConfirmation` function. Uses the same `sesClient` singleton.

```typescript
interface FuturePartyEmailData {
  toEmail:   string;
  partyDate: string;   // 'YYYY-MM-DD'
  kidGender: 'BOY' | 'GIRL' | 'MIXED';
  bundleUrl: string;
}

export async function sendFuturePartyEmail(data: FuturePartyEmailData): Promise<void>
```

The function THROWS on SES failure (unlike `sendOrderConfirmation` which swallows errors). The route handler catches the throw and returns 500.

**Subject:** `"Your personalised goodie bag is ready!"`

**HTML body structure:**
- Greeting: "Hi! We've curated a goodie bag just for your [Boy/Girl/Mixed] kid's party on [formatted date]."
- A prominent CTA button/link: "View Your Bundle" pointing to `bundleUrl`.
- Footer: "It Is A Small Gift Co. | smallgift.shop"
- Plain-text alternative with the raw `bundleUrl`.

Gender display label mapping: `BOY` → "boy", `GIRL` → "girl", `MIXED` → "mixed-age group".

### 3.7 `src/app.ts` — route registration additions

```typescript
// Import new routers
import { futurePartiesRouter }      from './routes/futureParties.js';
import { adminFuturePartiesRouter } from './routes/admin/futureParties.js';

// Inside createApp():
app.use('/api/future-parties',       futurePartiesRouter);        // public
app.use('/admin/api/future-parties', adminFuturePartiesRouter);   // basic auth inside router
```

Both lines are inserted before `app.use(errorHandler)`.

---

## 4. Frontend — Public Modal

### 4.1 New component: `src/components/FuturePartyModal.tsx`

**Props:**
```typescript
interface FuturePartyModalProps {
  open: boolean;
  onClose: () => void;
}
```

**State:**
```typescript
email:     string       // controlled input
partyDate: string       // YYYY-MM-DD, native date input value
kidGender: 'BOY' | 'GIRL' | 'MIXED' | null
kidAge:    number | ''  // '' = unset
submitting: boolean
success:   boolean
apiError:  string | null
// Per-field validation errors:
emailError:     string | null
dateError:      string | null
genderError:    string | null
ageError:       string | null
```

**Structure (MUI components):**
```
Dialog (maxWidth="xs", fullWidth)
  DialogTitle — "Plan For Future Party"  + IconButton (CloseIcon) top-right
  DialogContent
    [success=false]
      TextField (email, type="email", label="Your email")
      TextField (partyDate, type="date", label="Party date", InputLabelProps={{shrink:true}})
      Typography — "Kid's gender"
      Stack (direction="row", spacing=1) of 3 Chips: Boy | Girl | Mixed / Either
      TextField (kidAge, type="number", label="Kid's age (1–12)", inputProps={{min:1,max:12}})
      [apiError] Alert severity="error"
      Button (variant="contained", fullWidth, onClick=handleSubmit, disabled=submitting)
        [submitting] CircularProgress size=20 else "Get My Personalised Bundle"
    [success=true]
      Alert severity="success" — success message
      Button (onClick=onClose) — "Close"
  DialogActions (hidden when success=true — the Close button is inside DialogContent)
```

**Colors and styling:** Follow `COLORS` from `src/theme.ts`. Button uses `COLORS.coral` as `backgroundColor` matching the hero "BUILD YOURS NOW" button. Chip selection uses `color="primary"` when selected, matching `GiftFinder`'s `ChipRow` pattern.

**Client-side validation (`handleSubmit`):**
1. Clear all `*Error` states.
2. Validate `email` with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
3. Validate `partyDate` is set and `new Date(partyDate) > new Date()` (compare at day boundary).
4. Validate `kidGender !== null`.
5. Validate `kidAge` is integer in [1, 12].
6. If any error, set the relevant `*Error` state and return.
7. Set `submitting = true`.
8. `POST /api/future-parties` — see §4.2.
9. On 201: set `success = true`.
10. On error: set `apiError`, re-enable submit.
11. Finally: `submitting = false`.

**Reset on close (`handleClose`):** All state resets to initial values. Calls `onClose()`. Guard: if `submitting` is true, do not close.

### 4.2 API call: `src/api/futureParties.ts` (new file)

```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export interface FuturePartySubmission {
  email:     string;
  partyDate: string;
  kidGender: 'BOY' | 'GIRL' | 'MIXED';
  kidAge:    number;
}

export interface FuturePartyResponse {
  id:                   number;
  email:                string;
  partyDate:            string;
  kidGender:            string;
  kidAge:               number;
  submittedAt:          string;
  linkedBundlePublicId: string | null;
  bundleSentAt:         string | null;
}

export async function submitFutureParty(data: FuturePartySubmission): Promise<FuturePartyResponse> {
  const res = await fetch(`${BASE_URL}/api/future-parties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<FuturePartyResponse>;
}
```

### 4.3 `HomePage.tsx` changes

Add modal state and the second button in the hero section. No structural changes to the gift finder panel.

```typescript
// New state in HomePage:
const [futurePartyOpen, setFuturePartyOpen] = useState(false);

// Existing hero Button remains unchanged.
// New button added directly below it (same Container):
<Button
  variant="outlined"
  size="large"
  onClick={() => setFuturePartyOpen(true)}
  sx={{
    mt: 1.5,
    fontSize: '1rem',
    py: 1.5,
    px: 4,
    color: COLORS.coral,
    borderColor: COLORS.coral,
    '&:hover': { borderColor: '#e06b57', color: '#e06b57', backgroundColor: 'rgba(244,127,107,0.05)' },
  }}
>
  PLAN FOR FUTURE
</Button>

// Modal rendered at the bottom of the outer Box:
<FuturePartyModal open={futurePartyOpen} onClose={() => setFuturePartyOpen(false)} />
```

---

## 5. Frontend — Admin Panel

### 5.1 `AdminNav.tsx` change

Add one entry to the existing navigation array:

```typescript
{ to: '/admin/future-parties', label: 'Future Parties' },
```

Inserted after the `{ to: '/admin/orders', label: 'Orders' }` entry.

### 5.2 New page: `src/pages/admin/AdminFuturePartiesPage.tsx`

**Pattern:** Identical structure to `AdminOrdersPage.tsx` — `AdminNav` at the top, `Box p={3}`, `Typography h5` title, loading spinner, error alert, and a `TableContainer`.

**Shared types (co-located in the file or in `src/api/admin.ts`):**

```typescript
export interface AdminFutureParty {
  id:                   number;
  email:                string;
  partyDate:            string;
  kidGender:            'BOY' | 'GIRL' | 'MIXED';
  kidAge:               number;
  submittedAt:          string;
  linkedBundlePublicId: string | null;
  bundleSentAt:         string | null;
}
```

**State:**
```typescript
submissions:       AdminFutureParty[]
loading:           boolean
error:             string | null
// Bundle generation dialog:
dialogOpen:        boolean
selectedRow:       AdminFutureParty | null
// Send link:
sendingId:         number | null
sendError:         { id: number; msg: string } | null
snackbar:          string | null  // success message text; null = hidden
```

**Table columns:** Email | Party Date | Kid Gender | Kid Age | Submitted | Bundle Sent | Actions

**Actions column logic (per row):**
- If `linkedBundlePublicId` is null: show "Create Bundle" `Button` (variant="outlined", size="small").
- If `linkedBundlePublicId` is set and `bundleSentAt` is null: show bundle public ID chip + "Send Link" `Button` (variant="contained", color="primary", size="small").
- If both are set: show bundle public ID chip + formatted `bundleSentAt` date + "Re-send" `Button` (variant="outlined", size="small").

**`adminApi` additions (in `src/api/admin.ts`):**
```typescript
getFutureParties: (auth: string) =>
  adminRequest<AdminFutureParty[]>('/admin/api/future-parties', auth),

linkBundleToFutureParty: (auth: string, id: number, bundlePublicId: string) =>
  adminRequest<AdminFutureParty>(`/admin/api/future-parties/${id}/link-bundle`, auth, {
    method: 'PATCH',
    body: JSON.stringify({ bundlePublicId }),
  }),

sendFuturePartyLink: (auth: string, id: number) =>
  adminRequest<{ sentAt: string }>(`/admin/api/future-parties/${id}/send-link`, auth, {
    method: 'POST',
  }),
```

### 5.3 Bundle generation dialog: `src/pages/admin/CreateBundleForFuturePartyDialog.tsx`

**Props:**
```typescript
interface Props {
  open: boolean;
  submission: AdminFutureParty | null;
  authHeader: string;
  onClose: () => void;
  onLinked: (updated: AdminFutureParty) => void;
}
```

**State:**
```typescript
interest:   Interest | null     // from src/types/catalog.ts
partyType:  PartyType | null
budgetTier: 'LOW' | 'MID' | 'HIGH' | null
submitting: boolean
error:      string | null
// Validation:
interestError:   string | null
partyTypeError:  string | null
budgetTierError: string | null
```

**Audience preference derivation (read-only display):**
```
BOY   → MASCULINE
GIRL  → FEMININE
MIXED → NO_PREFERENCE
```

**Age mapping for bundle generation:** `submission.kidAge` is passed directly as the `age` field to `POST /api/generated-bundles`. The bundle generation engine accepts ages 3–12 (AC4.2 of FEAT-001 requirements). If `kidAge < 3`, use `3`; if `kidAge > 12`, use `12` (clamp silently — this edge case can only occur if data was inserted outside the form, which is blocked by the DB constraint).

**Submit flow:**
1. Validate `interest`, `partyType`, `budgetTier` are all set.
2. `POST /api/generated-bundles` (no auth header — public endpoint):
   ```json
   {
     "age": <clamped kidAge>,
     "audiencePreference": <derived>,
     "interest": <selected>,
     "partyType": <selected>,
     "budgetTierCode": <selected LOW|MID|HIGH>,
     "maxRetailPrice": null
   }
   ```
3. On 201, extract `generatedBundleId` from response.
4. `PATCH /admin/api/future-parties/:id/link-bundle` with `{ bundlePublicId: generatedBundleId }` (with admin auth header).
5. On 200, call `onLinked(updatedRow)` and close.
6. On any error, display error inside the dialog.

**Dialog structure (MUI):**
```
Dialog (maxWidth="sm", fullWidth)
  DialogTitle — "Create Bundle for Future Party"
  DialogContent
    Read-only summary: email, party date, gender, age
    Divider
    ChipRow or Chip group for Interest (5 options matching GiftFinder labels)
    ChipRow for Party Type (Celebration / Halloween)
    ChipRow for Budget Tier (Low / Mid / High)
    Read-only text: "Audience: [MASCULINE/FEMININE/NO_PREFERENCE]"
    [error] Alert severity="error"
  DialogActions
    Button "Cancel" → onClose()
    Button "Generate & Link" → handleSubmit (disabled when submitting)
```

Reuse the `ChipRow` component pattern from `GiftFinder.tsx` for consistency (or extract it to a shared component if the engineer prefers — design decision at implementation time).

### 5.4 `App.tsx` — new route

Add inside the `<AdminGuard />` block:

```tsx
import { AdminFuturePartiesPage } from './pages/admin/AdminFuturePartiesPage';

<Route path="/admin/future-parties" element={<AdminFuturePartiesPage />} />
```

---

## 6. Email Design

### 6.1 `sendFuturePartyEmail` function (addition to `src/lib/email.ts`)

Uses the same `sesClient` singleton initialised at module scope. Unlike `sendOrderConfirmation` (which swallows errors), this function re-throws so the admin route handler can return 500.

```typescript
export async function sendFuturePartyEmail(data: FuturePartyEmailData): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'orders@example.com';
  await sesClient.send(new SendEmailCommand({
    Destination: { ToAddresses: [data.toEmail] },
    Source: from,
    Message: {
      Subject: { Data: "Your personalised goodie bag is ready!", Charset: 'UTF-8' },
      Body: {
        Html:  { Data: buildFuturePartyHtml(data), Charset: 'UTF-8' },
        Text:  { Data: buildFuturePartyText(data), Charset: 'UTF-8' },
      },
    },
  }));
  // No try/catch — let errors propagate to the route handler.
}
```

### 6.2 HTML template (`buildFuturePartyHtml`)

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
  <h2 style="color:#F47F6B;">Your Goodie Bag is Ready!</h2>
  <p>We've curated a personalised goodie bag for your <strong>[boy/girl/mixed-age group]</strong>
     kid's party on <strong>[formatted date]</strong>.</p>
  <p style="text-align:center;margin:32px 0;">
    <a href="[bundleUrl]"
       style="background:#F47F6B;color:#fff;padding:14px 28px;border-radius:16px;
              text-decoration:none;font-weight:600;font-size:1rem;">
      View Your Bundle
    </a>
  </p>
  <p style="color:#666;font-size:14px;">
    Or copy this link into your browser:<br>
    <a href="[bundleUrl]">[bundleUrl]</a>
  </p>
  <hr style="margin:24px 0;">
  <p style="color:#999;font-size:12px;">It Is A Small Gift Co. — Good Stuff. Handpicked By Kids.</p>
</body>
</html>
```

Date formatting: `new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(partyDate))`.

---

## 7. API Contract Summary

### Public

| Method | Path | Auth | Request body | Success |
|--------|------|------|--------------|---------|
| POST | `/api/future-parties` | None | `FuturePartyRequest` | 201 `FuturePartyDto` |

### Admin (HTTP Basic)

| Method | Path | Auth | Request body | Success |
|--------|------|------|--------------|---------|
| GET | `/admin/api/future-parties` | Basic | — | 200 `FuturePartyDto[]` |
| PATCH | `/admin/api/future-parties/:id/link-bundle` | Basic | `{ bundlePublicId }` | 200 `FuturePartyDto` |
| POST | `/admin/api/future-parties/:id/send-link` | Basic | — | 200 `{ sentAt }` |

### Error responses (all endpoints)

All errors conform to the RFC 7807 `ProblemDetail` shape already used throughout the backend (see `tech-overview.md` §6):

| Condition | HTTP | `type` |
|-----------|------|--------|
| Validation failure | 400 | `about:validation-error` |
| Row not found | 404 | `about:not-found` |
| Business rule violation (no bundle linked; already linked) | 422 | `about:validation-error` |
| SES send failure | 500 | `about:internal-error` |

---

## 8. File Checklist

### New files

| File | Owner |
|------|-------|
| `backend-node/migrations/008_future_parties.ts` | Backend engineer |
| `backend-node/src/repositories/futureParties.ts` | Backend engineer |
| `backend-node/src/routes/futureParties.ts` | Backend engineer |
| `backend-node/src/routes/admin/futureParties.ts` | Backend engineer |
| `frontend/src/api/futureParties.ts` | Frontend engineer |
| `frontend/src/components/FuturePartyModal.tsx` | Frontend engineer |
| `frontend/src/pages/admin/AdminFuturePartiesPage.tsx` | Frontend engineer |
| `frontend/src/pages/admin/CreateBundleForFuturePartyDialog.tsx` | Frontend engineer |

### Modified files

| File | Change |
|------|--------|
| `backend-node/src/types/dtos.ts` | Add `FuturePartyRequestSchema`, `FuturePartyRequest`, `LinkBundleRequestSchema` |
| `backend-node/src/lib/email.ts` | Add `FuturePartyEmailData`, `sendFuturePartyEmail`, `buildFuturePartyHtml`, `buildFuturePartyText` |
| `backend-node/src/app.ts` | Register `futurePartiesRouter` and `adminFuturePartiesRouter` |
| `frontend/src/api/admin.ts` | Add `AdminFutureParty` interface, `getFutureParties`, `linkBundleToFutureParty`, `sendFuturePartyLink` |
| `frontend/src/pages/HomePage.tsx` | Add `futurePartyOpen` state, "Plan For Future" button, `FuturePartyModal` |
| `frontend/src/pages/admin/AdminNav.tsx` | Add "Future Parties" nav link |
| `frontend/src/App.tsx` | Add `/admin/future-parties` route inside `AdminGuard` |

---

## 9. Key Constraints (must not be violated)

1. The `POST /api/future-parties` endpoint requires no auth — it is a public lead-capture form. Do not apply `basicAuth` to this router.
2. The `sendFuturePartyEmail` function MUST throw on SES failure (unlike `sendOrderConfirmation` which swallows). The route handler catches the throw and returns 500 so the admin knows the email was not sent.
3. `linked_bundle_public_id` is a plain `varchar` column with no FK constraint. This is intentional — matches the pattern of `analytics_event.bundle_id`.
4. The `PATCH /:id/link-bundle` endpoint MUST reject attempts to overwrite an existing `linked_bundle_public_id` with a 400 response.
5. The bundle generation step in the admin dialog calls `POST /api/generated-bundles` — the existing public endpoint — with no admin credentials. This is correct: the bundle generation engine is public. The linking step (`PATCH /admin/api/future-parties/:id/link-bundle`) requires admin credentials.
6. Migration numbering: the next migration is `008`. Check that no other migration with that number exists before creating the file.
7. All new backend code is ESM (`import`/`export`), uses `postgres.js` tagged-template SQL, and validates request bodies with Zod — following `tech-overview.md` §§1–4.
8. `kid_age` stores the exact value entered by the user (1–12). When calling `POST /api/generated-bundles`, clamp to the API's accepted range (3–12) if the stored age is below 3.
