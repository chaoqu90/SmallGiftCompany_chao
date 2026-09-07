# Future Party — Tasks (FEAT-004)

> **Status key:** `[ ]` pending · `[-]` in progress · `[x]` completed · `[!]` blocked

---

## Wave 1 — Backend foundation (all independent, run in parallel)

### T1 — Database migration
- **Status:** `[x]` completed
- **Owner:** backend
- **Depends on:** —
- **Requirements:** AC3.4, R7
- **Description:**
  Create `backend-node/migrations/008_future_parties.ts`.
  - `up`: `pgm.createTable('future_parties', ...)` with columns exactly as specified in design.md §2.1 (bigserial PK, varchar email, date party_date, varchar kid_gender with CHECK, smallint kid_age with CHECK, timestamptz submitted_at DEFAULT now(), varchar linked_bundle_public_id nullable with NO FK, timestamptz bundle_sent_at nullable). Then add two indexes via `pgm.sql(...)`:
    - `idx_future_parties_submitted_at ON future_parties(submitted_at DESC)`
    - `idx_future_parties_email ON future_parties(email)`
  - `down`: `pgm.dropTable('future_parties')`.
  - Migration must follow the exact pattern of `007_payment_and_shipping.ts` (ESM `import type { MigrationBuilder }`, named exports `up`/`down`).
  - Verify no migration `008_*` already exists before creating.

### T2 — Zod schemas in dtos.ts
- **Status:** `[x]` completed
- **Owner:** backend
- **Depends on:** —
- **Requirements:** AC3.2, AC3.3, AC5.5
- **Description:**
  Append to `backend-node/src/types/dtos.ts`:
  1. `FuturePartyRequestSchema` — z.object with: `email` (z.string().email().max(254)), `partyDate` (z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'partyDate must be YYYY-MM-DD')), `kidGender` (z.enum(['BOY','GIRL','MIXED'])), `kidAge` (z.number().int().min(1).max(12)).
  2. `export type FuturePartyRequest = z.infer<typeof FuturePartyRequestSchema>`.
  3. `LinkBundleRequestSchema` — z.object with: `bundlePublicId` (z.string().min(1).max(30)).
  Follow the existing coding style (comments, spacing) in the file.

### T3 — Repository: futureParties.ts
- **Status:** `[x]` completed
- **Owner:** backend
- **Depends on:** T1
- **Requirements:** AC3.1, AC4.3, AC5.5, AC6.3
- **Description:**
  Create `backend-node/src/repositories/futureParties.ts`.
  - Import `sql` from `../db.js`.
  - Define `FuturePartyRow` interface (snake_case fields as per design.md §3.1).
  - Implement five named export functions using postgres.js tagged-template SQL:
    1. `insertFutureParty(data: InsertFuturePartyData): Promise<FuturePartyRow>` — INSERT … RETURNING *.
    2. `listFutureParties(): Promise<FuturePartyRow[]>` — SELECT * ORDER BY submitted_at DESC.
    3. `findFuturePartyById(id: number): Promise<FuturePartyRow | undefined>` — SELECT * WHERE id = $id, return first row or undefined.
    4. `linkBundle(id: number, bundlePublicId: string): Promise<FuturePartyRow | undefined>` — UPDATE SET linked_bundle_public_id = $bundlePublicId WHERE id = $id RETURNING *, return first row or undefined.
    5. `recordSend(id: number): Promise<FuturePartyRow | undefined>` — UPDATE SET bundle_sent_at = now() WHERE id = $id RETURNING *, return first row or undefined.
  - `InsertFuturePartyData` type: `{ email: string; partyDate: string; kidGender: string; kidAge: number }`.
  - Follow the exact postgres.js tagged-template style used in `backend-node/src/repositories/orders.ts`.

### T4 — Email helper: sendFuturePartyEmail
- **Status:** `[x]` completed
- **Owner:** backend
- **Depends on:** —
- **Requirements:** AC6.3, AC6.4, AC6.5
- **Description:**
  Append to `backend-node/src/lib/email.ts`:
  1. `FuturePartyEmailData` interface: `{ toEmail: string; partyDate: string; kidGender: 'BOY' | 'GIRL' | 'MIXED'; bundleUrl: string }`.
  2. `buildFuturePartyText(data: FuturePartyEmailData): string` — plain-text fallback containing the gender label, formatted party date, and raw bundleUrl.
  3. `buildFuturePartyHtml(data: FuturePartyEmailData): string` — HTML body exactly as specified in design.md §6.2. Date formatted with `Intl.DateTimeFormat('en-US', { year:'numeric', month:'long', day:'numeric' })`. Gender label mapping: BOY → "boy", GIRL → "girl", MIXED → "mixed-age group".
  4. `export async function sendFuturePartyEmail(data: FuturePartyEmailData): Promise<void>` — uses the existing `sesClient` singleton. Calls `sesClient.send(new SendEmailCommand(...))` with subject "Your personalised goodie bag is ready!", HTML body, and text body. **NO try/catch** — errors propagate to the caller (unlike `sendOrderConfirmation`).

---

## Wave 2 — Backend routes (depend on Wave 1)

### T5 — Public route: src/routes/futureParties.ts
- **Status:** `[x]` completed
- **Owner:** backend
- **Depends on:** T2, T3
- **Requirements:** AC3.1, AC3.2, AC3.3, AC3.5, R7
- **Description:**
  Create `backend-node/src/routes/futureParties.ts`.
  - ESM Router using `express.Router()`.
  - `toFuturePartyDto(row: FuturePartyRow)` mapper function (design.md §3.3, camelCase fields).
  - `POST /` handler:
    1. `FuturePartyRequestSchema.parse(req.body)` — let Zod errors propagate to `next(err)`.
    2. After parse, check `parsed.partyDate > new Date().toISOString().slice(0, 10)` — if not, call `next` with a manual 400 ProblemDetail (`type: 'about:validation-error'`, `detail: 'partyDate must be in the future'`).
    3. `insertFutureParty(parsed)`.
    4. `res.status(201).json(toFuturePartyDto(row))`.
  - **No auth middleware on this router** (AC3.5 / Key Constraint #1).
  - Export as `futurePartiesRouter`.

### T6 — Admin routes: src/routes/admin/futureParties.ts
- **Status:** `[x]` completed
- **Owner:** backend
- **Depends on:** T2, T3, T4
- **Requirements:** AC4.3, AC5.5, AC6.3, AC6.4, AC6.5
- **Description:**
  Create `backend-node/src/routes/admin/futureParties.ts`.
  - Apply `basicAuth` at router level (same pattern as `adminOrdersRouter`).
  - `toFuturePartyDto` mapper (can be imported from the public routes file or duplicated — engineer's preference).
  - **GET `/`:** call `listFutureParties()`, return 200 with mapped array.
  - **PATCH `/:id/link-bundle`:**
    1. Parse `id` as integer; 400 if NaN.
    2. `findFuturePartyById(id)` — 404 ProblemDetail if not found.
    3. If `row.linked_bundle_public_id` is already set, return 400 ProblemDetail (`type: 'about:validation-error'`, `detail: 'This submission already has a linked bundle.'`) — Key Constraint #4.
    4. `LinkBundleRequestSchema.parse(req.body)`.
    5. `linkBundle(id, bundlePublicId)`.
    6. Return 200 with updated DTO.
  - **POST `/:id/send-link`:**
    1. `findFuturePartyById(id)` — 404 ProblemDetail if not found.
    2. If `linked_bundle_public_id` is null, return 422 ProblemDetail (`type: 'about:validation-error'`, `detail: 'No bundle linked to this submission.'`).
    3. Build `bundleUrl = \`${process.env.FRONTEND_URL}/bundleCustomization/${row.linked_bundle_public_id}\``.
    4. `await sendFuturePartyEmail(...)` — if it throws, do NOT call `recordSend`; let the error propagate to `next(err)` — errorHandler will return 500 ProblemDetail (Key Constraint #2).
    5. `recordSend(id)`.
    6. Return 200 `{ sentAt: updatedRow.bundle_sent_at }`.
  - Export as `adminFuturePartiesRouter`.

### T7 — Route registration in app.ts
- **Status:** `[x]` completed
- **Owner:** backend
- **Depends on:** T5, T6
- **Requirements:** AC7.1, AC7.2, AC7.3
- **Description:**
  Modify `backend-node/src/app.ts`:
  1. Add import: `import { futurePartiesRouter } from './routes/futureParties.js';`
  2. Add import: `import { adminFuturePartiesRouter } from './routes/admin/futureParties.js';`
  3. Inside `createApp()`, before `app.use(errorHandler)`:
     - `app.use('/api/future-parties', futurePartiesRouter);`  (public — no auth)
     - `app.use('/admin/api/future-parties', adminFuturePartiesRouter);`  (auth inside router)
  4. Place after the existing FEAT-003 payment routes for readability.
  Do not change any existing routes.

---

## Wave 1 (parallel) — Frontend public flow

### T8 — API module: src/api/futureParties.ts
- **Status:** `[x]` completed
- **Owner:** frontend
- **Depends on:** —
- **Requirements:** AC3.1, AC2.7, AC2.8
- **Description:**
  Create `frontend/src/api/futureParties.ts` exactly as specified in design.md §4.2:
  - `const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''`
  - `FuturePartySubmission` interface (email, partyDate, kidGender, kidAge).
  - `FuturePartyResponse` interface (id, email, partyDate, kidGender, kidAge, submittedAt, linkedBundlePublicId, bundleSentAt).
  - `submitFutureParty(data: FuturePartySubmission): Promise<FuturePartyResponse>` — POST to `/api/future-parties`, throws on non-ok response.

### T9 — Modal component: src/components/FuturePartyModal.tsx
- **Status:** `[x]` completed
- **Owner:** frontend
- **Depends on:** T8
- **Requirements:** R2 (AC2.1–AC2.9)
- **Description:**
  Create `frontend/src/components/FuturePartyModal.tsx` as specified in design.md §4.1.
  - Props: `{ open: boolean; onClose: () => void }`.
  - All state fields as listed in design.md §4.1.
  - MUI Dialog (maxWidth="xs", fullWidth) with DialogTitle containing "Plan For Future Party" and a CloseIcon IconButton top-right.
  - Four fields in order: email TextField, partyDate TextField (type="date", InputLabelProps={{shrink:true}}), kid gender chip row (Boy / Girl / Mixed / Either — three chips), kidAge TextField (type="number", inputProps min=1 max=12).
  - Chip selection pattern: follow `GiftFinder.tsx` ChipRow style — selected chip uses `color="primary"`, unselected uses default outlined style.
  - `handleSubmit` validation as per design.md §4.1 (regex email, date > today, gender not null, age 1–12 integer), then calls `submitFutureParty`.
  - Success state: replace form with Alert severity="success" + "Close" button.
  - Error state: inline Alert severity="error" below form, re-enable submit.
  - `handleClose`: reset all state to initial, call `onClose()`. Guard: no-op if `submitting`.
  - AC2.6: submit button disabled + CircularProgress size=20 while submitting; all fields disabled.

### T10 — HomePage.tsx changes
- **Status:** `[x]` completed
- **Owner:** frontend
- **Depends on:** T9
- **Requirements:** R1 (AC1.1–AC1.4)
- **Description:**
  Modify `frontend/src/pages/HomePage.tsx`:
  1. Add `import { useState } from 'react'`.
  2. Add `import { FuturePartyModal } from '../components/FuturePartyModal'`.
  3. Inside `HomePage`, add state: `const [futurePartyOpen, setFuturePartyOpen] = useState(false)`.
  4. After the existing "BUILD YOURS NOW" Button (around line 59–73), add the "PLAN FOR FUTURE" Button with `variant="outlined"` and sx exactly as specified in design.md §4.3 (mt:1.5, coral color/border, hover darkens).
  5. At the bottom of the outer `Box` (before the closing tag), render: `<FuturePartyModal open={futurePartyOpen} onClose={() => setFuturePartyOpen(false)} />`.
  - Do not alter the existing "BUILD YOURS NOW" button or the GiftFinder section.

---

## Wave 2 — Frontend admin flow (depends on admin API being defined)

### T11 — Admin API additions: src/api/admin.ts
- **Status:** `[x]` completed
- **Owner:** frontend
- **Depends on:** —
- **Requirements:** AC4.3, AC5.5, AC6.3
- **Description:**
  Modify `frontend/src/api/admin.ts`:
  1. Add `AdminFutureParty` interface (all fields camelCase: id, email, partyDate, kidGender, kidAge, submittedAt, linkedBundlePublicId, bundleSentAt) — as per design.md §5.2.
  2. Add three methods to the `adminApi` object:
     - `getFutureParties(auth)` → GET `/admin/api/future-parties`
     - `linkBundleToFutureParty(auth, id, bundlePublicId)` → PATCH `/admin/api/future-parties/${id}/link-bundle` with body `{ bundlePublicId }`
     - `sendFuturePartyLink(auth, id)` → POST `/admin/api/future-parties/${id}/send-link`
  Follow the existing `adminRequest<T>` style.

### T12 — AdminNav.tsx: add Future Parties link
- **Status:** `[x]` completed
- **Owner:** frontend
- **Depends on:** —
- **Requirements:** AC4.1
- **Description:**
  Modify `frontend/src/pages/admin/AdminNav.tsx`.
  In the nav links array, add `{ to: '/admin/future-parties', label: 'Future Parties' }` after the `{ to: '/admin/orders', label: 'Orders' }` entry.

### T13 — CreateBundleForFuturePartyDialog component
- **Status:** `[x]` completed
- **Owner:** frontend
- **Depends on:** T11
- **Requirements:** AC5.2, AC5.3, AC5.4, AC5.5, AC5.6, AC5.7
- **Description:**
  Create `frontend/src/pages/admin/CreateBundleForFuturePartyDialog.tsx` as per design.md §5.3.
  - Props: `{ open, submission, authHeader, onClose, onLinked }`.
  - State: interest, partyType, budgetTier (all nullable), submitting, error, three validation error strings.
  - Read-only summary panel showing email, party date, kid gender, kid age from `submission`.
  - Audience mapping: BOY → MASCULINE, GIRL → FEMININE, MIXED → NO_PREFERENCE (displayed as read-only text).
  - Chip rows for Interest (5 options matching GiftFinder: POP_MUSIC, TOYS_PLAY, CUTE_MAGICAL, SPORTS, READING_PUZZLE), Party Type (CELEBRATION / HALLOWEEN), Budget Tier (LOW / MID / HIGH). Show user-friendly labels (e.g. "Pop Music", "Toys & Play", "Celebration", "Low", etc.).
  - `handleSubmit`:
    1. Validate all three selections are set.
    2. Clamp kidAge: `Math.min(12, Math.max(3, submission.kidAge))`.
    3. POST to `/api/generated-bundles` (no auth) with `{ age, audiencePreference, interest, partyType, budgetTierCode, maxRetailPrice: null }`.
    4. Extract `generatedBundleId` from 201 response.
    5. Call `adminApi.linkBundleToFutureParty(authHeader, submission.id, generatedBundleId)`.
    6. On success call `onLinked(updatedRow)` then close.
    7. On error set `error` string.
  - MUI Dialog (maxWidth="sm", fullWidth) with Cancel / "Generate & Link" buttons in DialogActions.

### T14 — AdminFuturePartiesPage + App.tsx route
- **Status:** `[x]` completed
- **Owner:** frontend
- **Depends on:** T11, T12, T13
- **Requirements:** AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC5.1, AC5.6, AC6.1, AC6.2, AC6.6
- **Description:**
  1. Create `frontend/src/pages/admin/AdminFuturePartiesPage.tsx` as per design.md §5.2:
     - Top-level state: submissions, loading, error, dialogOpen, selectedRow, sendingId, sendError, snackbar.
     - On mount, fetch `adminApi.getFutureParties(authHeader)`. Loading spinner and error alert patterns matching `AdminOrdersPage.tsx`.
     - Empty state: single table row with centered "No future party submissions yet."
     - Table columns: Email | Party Date | Kid Gender | Kid Age | Submitted | Bundle Sent | Actions (7 columns).
     - Actions column logic per row:
       - No `linkedBundlePublicId`: "Create Bundle" outlined button → sets `selectedRow` and `dialogOpen=true`.
       - Has `linkedBundlePublicId`, no `bundleSentAt`: bundle ID chip + "Send Link" contained button.
       - Has both: bundle ID chip + formatted bundleSentAt date + "Re-send" outlined button.
     - Send Link / Re-send handler: calls `adminApi.sendFuturePartyLink(auth, id)`, sets `sendingId` while loading, on success updates the row in state and sets `snackbar` success message, on error sets `sendError`.
     - On `onLinked` callback from dialog: replace the matching row in `submissions` state.
     - Renders `<CreateBundleForFuturePartyDialog>` with props wired up.
     - Renders a MUI `Snackbar` (autoHideDuration=4000) for `snackbar` success messages.
  2. Modify `frontend/src/App.tsx`:
     - Add import: `import { AdminFuturePartiesPage } from './pages/admin/AdminFuturePartiesPage'`.
     - Inside `<AdminGuard>` block, add: `<Route path="/admin/future-parties" element={<AdminFuturePartiesPage />} />` after the orders routes.

---

## Dependency graph

```
T1 (migration) ──────────────────────────────────────────────────────┐
T2 (dtos) ──────────────────────────────────────────────────────┐    │
T4 (email helper) ─────────────────────────────────────────┐   │    │
                                                            │   │    │
                                                            ▼   ▼    ▼
                                                    T5 (public route) T3 (repo)
                                                    T6 (admin routes) ───────┘
                                                            │
                                                            ▼
                                                    T7 (app.ts wiring)

T8 (api/futureParties.ts) ─────────────────────────────────┐
                                                            ▼
                                                    T9 (FuturePartyModal)
                                                            │
                                                            ▼
                                                    T10 (HomePage)

T11 (admin.ts additions) ──────────────────────────────────┐
T12 (AdminNav) [independent]                               │
                                                            ▼
                                                    T13 (CreateBundleDialog)
                                                            │
                                                    T11, T12, T13
                                                            │
                                                            ▼
                                                    T14 (AdminFuturePartiesPage + App.tsx route)
```

---

## Execution waves (parallelism plan)

| Wave | Tasks | Can run in parallel |
|------|-------|---------------------|
| 1a | T1, T2, T4 (backend) | Yes — all independent |
| 1b | T8, T12 (frontend) | Yes — both independent |
| 2a | T3 (after T1), T5 (after T2+T3), T6 (after T2+T3+T4) | Sequential within backend |
| 2b | T9 (after T8) | Frontend |
| 2c | T11 (frontend, independent of backend) | Frontend |
| 3a | T7 (after T5+T6) | Backend |
| 3b | T10 (after T9) | Frontend |
| 3c | T13 (after T11) | Frontend |
| 4 | T14 (after T11+T12+T13) | Frontend |
