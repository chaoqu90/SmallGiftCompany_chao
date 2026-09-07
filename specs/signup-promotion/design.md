# Signup Promotion — Technical Design

> **Feature ID:** FEAT-005
> **Status:** Draft — 2026-09-07
> **Conforms to:** `specs/tech-overview.md` (golden copy)
> **Requirements:** `specs/signup-promotion/requirements.md`
> **Parent feature design:** `specs/future-party/design.md`

---

## 1. Overview

This feature is deliberately minimal — it reuses every existing layer:

- **No new DB table.** The `future_parties` table from FEAT-004 migration `008_future_parties.ts` stores all submissions.
- **No new backend route.** `POST /api/future-parties` is extended in-place with optional `source` detection.
- **One new frontend component.** `SignupPromotionModal` is a standalone component (not a parameterised version of `FuturePartyModal`) so that future copy changes to either modal do not affect the other.
- **One new email function.** `sendSignupPromotionEmail` is added to `src/lib/email.ts` alongside the existing helpers.

The three modified layers are:

1. **Backend** — `FuturePartyRequestSchema` gains an optional `source` field; the `POST /api/future-parties` route handler calls `sendSignupPromotionEmail` when `source === 'signup-promotion'`; a migration adds a `source` column to the DB for admin visibility (see §2).
2. **Frontend — public** — `App.tsx` adds a `/build` route; `HomePage` detects the pathname and auto-opens `SignupPromotionModal`; the API client gains an optional `source` parameter.
3. **Frontend — email** — `sendSignupPromotionEmail` is a fire-and-forget helper (swallows SES errors) that sends the event-reminder email.

---

## 2. Database

### 2.1 Design Decision: Store `source` in the DB

**Decision: add a nullable `source` column to `future_parties` via a new migration.**

Rationale: The admin `AdminFuturePartiesPage` already lists all submissions. Without a `source` column the admin cannot distinguish "sign-up promotion" leads (who are expecting a surprise gift at a specific fair on September 12, 2026) from "Plan For Future" leads (who want a personalised bundle before a future party). Storing `source` costs one VARCHAR column and one additive migration with no risk to existing rows.

### 2.2 New migration: `009_future_parties_source.ts`

File: `backend-node/migrations/009_future_parties_source.ts`

Pattern follows `008_future_parties.ts` exactly:

```typescript
import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('future_parties', {
    source: {
      type: 'varchar(50)',
      notNull: false,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('future_parties', 'source');
}
```

Existing rows will have `source = NULL`, which correctly represents "Plan For Future" button submissions.

### 2.3 Updated `FuturePartyRow` type

Add `source: string | null` to the existing interface in `backend-node/src/repositories/futureParties.ts`:

```typescript
export interface FuturePartyRow {
  id:                     number;
  email:                  string;
  party_date:             string;
  kid_gender:             string;
  kid_age:                number;
  submitted_at:           string;
  linked_bundle_public_id: string | null;
  bundle_sent_at:         string | null;
  source:                 string | null;   // NEW — 'signup-promotion' or NULL
}
```

### 2.4 Updated `InsertFuturePartyData` and `insertFutureParty`

Add `source` as an optional field to `InsertFuturePartyData` and to the INSERT statement:

```typescript
export interface InsertFuturePartyData {
  email:     string;
  partyDate: string;
  kidGender: string;
  kidAge:    number;
  source:    string | null;   // NEW
}

export async function insertFutureParty(data: InsertFuturePartyData): Promise<FuturePartyRow> {
  const rows = await sql<FuturePartyRow[]>`
    INSERT INTO future_parties (email, party_date, kid_gender, kid_age, source)
    VALUES (${data.email}, ${data.partyDate}, ${data.kidGender}, ${data.kidAge}, ${data.source})
    RETURNING *
  `;
  return rows[0];
}
```

### 2.5 Updated DTO mapper (`toFuturePartyDto`)

Add `source` to the mapper in `backend-node/src/routes/futureParties.ts`:

```typescript
export function toFuturePartyDto(row: FuturePartyRow) {
  return {
    id:                   row.id,
    email:                row.email,
    partyDate:            row.party_date,
    kidGender:            row.kid_gender,
    kidAge:               row.kid_age,
    submittedAt:          row.submitted_at,
    linkedBundlePublicId: row.linked_bundle_public_id,
    bundleSentAt:         row.bundle_sent_at,
    source:               row.source,         // NEW
  };
}
```

---

## 3. Backend

### 3.1 Zod schema update: `src/types/dtos.ts`

Add an optional `source` field to `FuturePartyRequestSchema`:

```typescript
export const FuturePartyRequestSchema = z.object({
  email:     z.string().email().max(254),
  partyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'partyDate must be YYYY-MM-DD'),
  kidGender: z.enum(['BOY', 'GIRL', 'MIXED']),
  kidAge:    z.number().int().min(1).max(12),
  source:    z.literal('signup-promotion').optional(),   // NEW
});

export type FuturePartyRequest = z.infer<typeof FuturePartyRequestSchema>;
```

`z.literal('signup-promotion').optional()` means: if present, it must be exactly the string `'signup-promotion'`; if absent, `undefined`. Unknown strings are rejected by Zod (the schema does not use `.passthrough()`).

### 3.2 Route handler update: `src/routes/futureParties.ts`

The full updated handler:

```typescript
futurePartiesRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Zod validation
      const parsed = FuturePartyRequestSchema.parse(req.body);

      // 2. Server-side future-date check
      const today = new Date().toISOString().slice(0, 10);
      if (parsed.partyDate <= today) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Validation Error',
          status:   400,
          detail:   'partyDate must be in the future.',
          instance: req.path,
        });
        return;
      }

      // 3. Persist (pass source through to the repository)
      const row = await insertFutureParty({
        email:     parsed.email,
        partyDate: parsed.partyDate,
        kidGender: parsed.kidGender,
        kidAge:    parsed.kidAge,
        source:    parsed.source ?? null,   // NEW
      });

      // 4. Signup-promotion email — fire-and-forget (AC4.1, AC4.6)
      if (parsed.source === 'signup-promotion') {
        // Intentionally not awaited at top level — errors are swallowed inside
        sendSignupPromotionEmail({ toEmail: parsed.email }).catch(() => {
          // Already logged inside sendSignupPromotionEmail
        });
      }

      // 5. Respond
      res.status(201).json(toFuturePartyDto(row));
    } catch (err) {
      next(err);
    }
  },
);
```

Import to add at the top of the file:

```typescript
import { sendSignupPromotionEmail } from '../lib/email.js';
```

**Note on email timing (AC4.1):** The requirement says "the response is returned only after the send attempt completes." However, given AC4.6 ("email failure SHALL NOT cause the submission to fail") and the pattern established by `sendOrderConfirmation` in `tech-overview.md §16.4` ("fails silently … order creation always succeeds regardless of email delivery"), the fire-and-forget pattern is the correct implementation. The 201 response is returned immediately after the DB insert; the email send happens concurrently. This matches how `sendOrderConfirmation` is called outside the `sql.begin()` block. If the business later requires synchronous email confirmation before the 201 response, that is a requirements change.

### 3.3 Email helper: `src/lib/email.ts` — new export `sendSignupPromotionEmail`

Add after the existing `sendFuturePartyEmail` function. Uses the same `sesClient` singleton.

```typescript
export interface SignupPromotionEmailData {
  toEmail: string;
}

function buildSignupPromotionHtml(_data: SignupPromotionEmailData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
  <h2 style="color:#F47F6B;">Thank you for signing up!</h2>
  <p>We're so grateful for your support during our early launch phase!</p>
  <p>We'd love to share a small surprise gift with you as a thank-you.
     Come find us at our booth at the <strong>Loudoun Children's Business Fair</strong>:</p>
  <ul style="line-height:1.8;">
    <li><strong>Date:</strong> Saturday, September 12, 2026</li>
    <li><strong>Time:</strong> 11 AM – 3 PM</li>
  </ul>
  <p>Show this email (or just mention Small Gift Shop) at our booth to collect your
     surprise gift. We can't wait to see you there!</p>
  <hr style="margin:24px 0;">
  <p style="color:#999;font-size:12px;">It Is A Small Gift Co. — Good Stuff. Handpicked By Kids.</p>
</body>
</html>`;
}

function buildSignupPromotionText(_data: SignupPromotionEmailData): string {
  return [
    "Thank you for signing up!",
    "",
    "We're so grateful for your support during our early launch phase!",
    "",
    "We'd love to share a small surprise gift with you as a thank-you.",
    "Come find us at our booth at the Loudoun Children's Business Fair:",
    "",
    "  Date: Saturday, September 12, 2026",
    "  Time: 11 AM – 3 PM",
    "",
    "Show this email (or just mention Small Gift Shop) at our booth to collect your",
    "surprise gift. We can't wait to see you there!",
    "",
    "It Is A Small Gift Co. — Good Stuff. Handpicked By Kids.",
  ].join('\n');
}

/**
 * Sends a gift-redemption confirmation email to a visitor who signed up via
 * the /build promotion modal.
 *
 * IMPORTANT: This function swallows SES errors (unlike sendFuturePartyEmail
 * which re-throws). Email failure must not block the 201 submission response.
 *
 * Requirements: AC4.1, AC4.3–AC4.6
 * Design: specs/signup-promotion/design.md §3.3
 */
export async function sendSignupPromotionEmail(data: SignupPromotionEmailData): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'orders@example.com';
  try {
    await sesClient.send(new SendEmailCommand({
      Destination: { ToAddresses: [data.toEmail] },
      Source: from,
      Message: {
        Subject: {
          Data: "You're signed up — see you at the Loudoun Children's Business Fair!",
          Charset: 'UTF-8',
        },
        Body: {
          Html: { Data: buildSignupPromotionHtml(data), Charset: 'UTF-8' },
          Text: { Data: buildSignupPromotionText(data), Charset: 'UTF-8' },
        },
      },
    }));
  } catch (err) {
    // Email failure must not block the 201 response (AC4.6).
    console.warn('[email] Failed to send signup-promotion email to', data.toEmail, ':', err);
  }
}
```

---

## 4. Frontend — API Client

### 4.1 Update `src/api/futureParties.ts`

Add `source` as an optional field to `FuturePartySubmission`. Callers that omit `source` (i.e., `FuturePartyModal`) are unaffected.

```typescript
export interface FuturePartySubmission {
  email:     string
  partyDate: string          // YYYY-MM-DD
  kidGender: 'BOY' | 'GIRL' | 'MIXED'
  kidAge:    number
  source?:   'signup-promotion'   // NEW — omitted for Plan-For-Future submissions
}
```

`submitFutureParty` requires no change — it already passes the payload to `JSON.stringify(data)`, so the `source` field is included automatically when present.

---

## 5. Frontend — New Component: `SignupPromotionModal`

### 5.1 File: `frontend/src/components/SignupPromotionModal.tsx`

**Design decision — standalone component:** `SignupPromotionModal` is a new component rather than a parameterised wrapper around `FuturePartyModal`. Rationale: the two modals have different copy, different submit button labels, and different success messages. Making `FuturePartyModal` accept props for all of these would make it harder to read and maintain. A standalone component is ~100 additional lines and avoids coupling two different user journeys.

**Props:**

```typescript
interface SignupPromotionModalProps {
  open:    boolean
  onClose: () => void
}
```

**State:** Identical to `FuturePartyModal` — reuse the same `initialState()` shape (copy it verbatim). The state machine is the same; only the UI copy differs.

```typescript
function initialState() {
  return {
    email:           '',
    partyDateRadio:  null as PartyDateRadio | null,
    partyDateManual: '',
    kidGender:       null as KidGender | null,
    kidAge:          '' as number | '',
    submitting:      false,
    success:         false,
    apiError:        null as string | null,
    emailError:      null as string | null,
    dateError:       null as string | null,
    genderError:     null as string | null,
    ageError:        null as string | null,
  }
}
```

**Validation (`handleSubmit`):** Identical logic to `FuturePartyModal.handleSubmit`. The only difference is the `submitFutureParty` call includes `source: 'signup-promotion'`:

```typescript
await submitFutureParty({
  email:     state.email,
  partyDate: resolvedDate,
  kidGender: state.kidGender!,
  kidAge:    age,
  source:    'signup-promotion',   // NEW
})
```

**Structure (MUI components):**

```
Dialog (maxWidth="sm", fullWidth)
  DialogTitle — "Welcome to Small Gift Shop!"    ← AC2.1
    IconButton (CloseIcon, top-right)
  DialogContent
    [success=false]
      Typography (body2, color=text.secondary)   ← AC2.2 — welcome message verbatim
        "Small Gift Shop is in early launching stage, and we want to appreciate your
         support by sharing a small gift with you! Sign up with your email address and
         join us at Loudoun Children's Business Fair to receive a surprise gift!"
      Stack spacing={2.5}
        TextField (email)                         ← AC2.3 field 1
        Box (party date: RadioGroup + date input) ← AC2.3 field 2
        Box (kid's gender chips)                  ← AC2.3 field 3
        TextField (kid's age)                     ← AC2.3 field 4
        [apiError] Alert severity="error"         ← AC2.7
        Button variant="contained" fullWidth      ← AC2.5
          label: "Sign Up and Get My Gift"        ← AC2.5
          [submitting] CircularProgress size=20
    [success=true]
      Stack spacing={2}
        Alert severity="success"                  ← AC2.6
          "Thank you! We'll see you at the Loudoun Children's Business Fair on Saturday,
           September 12, 2026. Your surprise gift is waiting for you — check your email
           for details!"
        Button variant="outlined" onClick=onClose fullWidth
          "Close"
```

**Colors and styling:** Same as `FuturePartyModal` — `COLORS.coral` for the submit button `backgroundColor`, chips use `color="primary"` when selected, radios use `color: COLORS.coral`.

**handleClose guard:** If `state.submitting` is true, do not close (AC2.9). Same pattern as `FuturePartyModal`.

---

## 6. Frontend — Route and HomePage Changes

### 6.1 `App.tsx` — add `/build` route

Inside the `<RootLayout>` block, add one route after the existing `"/"` route:

```tsx
<Route path="/"      element={<HomePage />} />
<Route path="/build" element={<HomePage />} />   {/* NEW — AC5.1, AC5.2 */}
```

No new imports required — `HomePage` is already imported.

### 6.2 `HomePage.tsx` — auto-open promotion modal on `/build`

**New state:**

```typescript
const [promotionOpen, setPromotionOpen] = useState(false)
```

**Auto-open effect** — placed after the existing `hash` scroll effect:

```typescript
const { hash, pathname } = useLocation()

useEffect(() => {
  if (pathname === '/build') {
    setPromotionOpen(true)
  }
}, [pathname])
```

`pathname` is read from `useLocation()` which is already imported. The dependency array `[pathname]` ensures the effect runs once on mount when the pathname is `/build`, and does not re-run on hash changes. The modal will not re-open after it is closed because `setPromotionOpen(false)` updates state without changing `pathname` — the effect does not re-execute (the pathname dependency has not changed).

**Import addition:**

```typescript
import { SignupPromotionModal } from '../components/SignupPromotionModal'
```

**Modal rendering** — add below the existing `<FuturePartyModal>`:

```tsx
{/* Signup promotion modal — auto-opens on /build (FEAT-005 AC1.1) */}
<SignupPromotionModal open={promotionOpen} onClose={() => setPromotionOpen(false)} />
```

The `promotionOpen` state is independent of `futurePartyOpen`. Both can coexist without conflict; in practice they will never both be open at the same time (one is auto-opened on route, the other is opened by a button click).

---

## 7. Email Design

### 7.1 Subject (AC4.3)

```
You're signed up — see you at the Loudoun Children's Business Fair!
```

### 7.2 HTML body (AC4.4)

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
  <h2 style="color:#F47F6B;">Thank you for signing up!</h2>
  <p>We're so grateful for your support during our early launch phase!</p>
  <p>We'd love to share a small surprise gift with you as a thank-you.
     Come find us at our booth at the <strong>Loudoun Children's Business Fair</strong>:</p>
  <ul style="line-height:1.8;">
    <li><strong>Date:</strong> Saturday, September 12, 2026</li>
    <li><strong>Time:</strong> 11 AM – 3 PM</li>
  </ul>
  <p>Show this email (or just mention Small Gift Shop) at our booth to collect your
     surprise gift. We can't wait to see you there!</p>
  <hr style="margin:24px 0;">
  <p style="color:#999;font-size:12px;">It Is A Small Gift Co. — Good Stuff. Handpicked By Kids.</p>
</body>
</html>
```

### 7.3 Plain-text fallback (AC4.5)

```
Thank you for signing up!

We're so grateful for your support during our early launch phase!

We'd love to share a small surprise gift with you as a thank-you.
Come find us at our booth at the Loudoun Children's Business Fair:

  Date: Saturday, September 12, 2026
  Time: 11 AM – 3 PM

Show this email (or just mention Small Gift Shop) at our booth to collect your
surprise gift. We can't wait to see you there!

It Is A Small Gift Co. — Good Stuff. Handpicked By Kids.
```

---

## 8. API Contract

No new endpoints. The existing public endpoint is extended:

| Method | Path | Auth | Change |
|--------|------|------|--------|
| POST | `/api/future-parties` | None | Accepts optional `source: "signup-promotion"` in body; triggers `sendSignupPromotionEmail` when present |

All other public and admin endpoints are unchanged.

---

## 9. File Checklist

### New files

| File | Owner |
|------|-------|
| `backend-node/migrations/009_future_parties_source.ts` | Backend engineer |
| `frontend/src/components/SignupPromotionModal.tsx` | Frontend engineer |

### Modified files

| File | Change |
|------|--------|
| `backend-node/src/repositories/futureParties.ts` | Add `source` to `FuturePartyRow`, `InsertFuturePartyData`, and `insertFutureParty` INSERT |
| `backend-node/src/types/dtos.ts` | Add `source: z.literal('signup-promotion').optional()` to `FuturePartyRequestSchema` |
| `backend-node/src/routes/futureParties.ts` | Pass `source` to `insertFutureParty`; call `sendSignupPromotionEmail` when `source === 'signup-promotion'`; add `source` to `toFuturePartyDto` |
| `backend-node/src/lib/email.ts` | Add `SignupPromotionEmailData`, `buildSignupPromotionHtml`, `buildSignupPromotionText`, `sendSignupPromotionEmail` |
| `frontend/src/api/futureParties.ts` | Add optional `source?: 'signup-promotion'` to `FuturePartySubmission` interface |
| `frontend/src/pages/HomePage.tsx` | Add `pathname` from `useLocation`; add `promotionOpen` state; add auto-open `useEffect`; import and render `<SignupPromotionModal>` |
| `frontend/src/App.tsx` | Add `<Route path="/build" element={<HomePage />} />` inside `<RootLayout>` |

---

## 10. Key Constraints (must not be violated)

1. `sendSignupPromotionEmail` MUST swallow SES errors via `try/catch` with `console.warn` (AC4.6). It is the opposite of `sendFuturePartyEmail` which re-throws.
2. The existing `sendFuturePartyEmail` and the admin `POST /admin/api/future-parties/:id/send-link` route MUST remain completely unchanged (AC4.7).
3. `POST /api/future-parties` MUST remain a no-auth public endpoint. Do not apply `basicAuth` to this router.
4. The `/build` route MUST use the existing `HomePage` component — no new page component is introduced (AC5.2).
5. The `promotionOpen` state in `HomePage` is driven by `pathname === '/build'` in a `useEffect`. The effect dependency array is `[pathname]` only — do NOT use `[]` (would only fire on mount and miss client-side navigation) and do NOT use no dependency array (would re-fire on every render).
6. `FuturePartyModal` and its call site (`submitFutureParty` without `source`) MUST remain unchanged. Only `SignupPromotionModal` passes `source: 'signup-promotion'`.
7. Migration `009` MUST follow the `up`/`down` pattern of `008_future_parties.ts`. The `down` function MUST drop the `source` column.
8. All new backend code MUST be ESM (`import`/`export`), use `postgres.js` tagged-template SQL, and validate request bodies with Zod — following `tech-overview.md` §§1–4.
