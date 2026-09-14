# Future Party — Technical Design

> **Feature ID:** FEAT-004
> **Status:** Updated — 2026-09-10
> **Conforms to:** `specs/tech-overview.md` (golden copy)
> **Requirements:** `specs/future-party/requirements.md`

---

## 1. Overview

This feature adds four independently deliverable layers:

1. **Public form** — a modal on the homepage (`HomePage.tsx`) that POSTs to a new public endpoint.
2. **Backend storage & endpoints** — a new DB table, a public POST, and admin endpoints (list, link-bundle, send-link, patch-bundle-item).
3. **Admin list UI** — a new page at `/admin/future-parties` with list, bundle-generation dialog, apply-bundle dialog, and email-send action.
4. **Admin bundle preview page** — an admin-only page at `/admin/bundle-preview/:bundlePublicId` that reuses the customer configurator layout with a "Send Link" CTA and per-item swap capability.

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
linked_bundle_public_id varchar(30)      NULL       -- plain varchar, no FK (see note below)
bundle_sent_at          timestamptz      NULL
source                  varchar(30)      NULL       -- 'signup-promotion' or NULL
redemption_code         varchar(6)       NULL UNIQUE -- 6-digit numeric, only for signup-promotion rows
redeemed_at             timestamptz      NULL
```

**Why no FK on `linked_bundle_public_id`:** Generated bundles can be deleted or expire. The admin should retain a historical record of what bundle was linked even if that bundle later disappears — identical to how `analytics_event.bundle_id` is a plain VARCHAR rather than an FK.

**Indexes:**
```sql
CREATE INDEX idx_future_parties_submitted_at ON future_parties(submitted_at DESC);
CREATE INDEX idx_future_parties_email ON future_parties(email);
```

### 2.2 `generated_bundle_item` table — no schema changes

The existing `generated_bundle_item` table (columns: `id`, `generated_bundle_id`, `slot_code`, `product_id`, `product_name_snapshot`, `sku_snapshot`, `cost_snapshot`, `description_snapshot`, `form_factor_snapshot`, `quantity_per_bag`, `display_order`) is updated in place by the new patch-item endpoint (§3.7). No migration is needed for this table.

### 2.3 Migration structure

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
findByRedemptionCode(code: string): Promise<FuturePartyRow | undefined>
markRedeemed(id: number): Promise<FuturePartyRow | undefined>
linkBundle(id: number, bundlePublicId: string): Promise<FuturePartyRow | undefined>
recordSend(id: number): Promise<FuturePartyRow | undefined>
```

`FuturePartyRow` is the raw snake_case DB shape:
```typescript
interface FuturePartyRow {
  id:                     number;
  email:                  string;
  party_date:             string;          // DATE comes back as string from postgres.js
  kid_gender:             string;
  kid_age:                number;
  submitted_at:           string;
  linked_bundle_public_id: string | null;
  bundle_sent_at:         string | null;
  source:                 string | null;
  redemption_code:        string | null;
  redeemed_at:            string | null;
}
```

### 3.2 Repository: `src/repositories/generatedBundles.ts` — new function

Add one function to the existing generated bundles repository:

```
patchBundleItem(
  bundlePublicId: string,
  slotCode: string,
  product: ProductRow,
): Promise<void>
```

This function issues an `UPDATE generated_bundle_item SET ... WHERE generated_bundle_id = (SELECT id FROM generated_bundle ...) AND slot_code = $slotCode` and updates all snapshot columns (`product_id`, `product_name_snapshot`, `sku_snapshot`, `cost_snapshot`, `description_snapshot`, `form_factor_snapshot`) from the `product` argument.

### 3.3 Repository: `src/repositories/products.ts` — new function

Add one function:

```
findEligibleAlternativesForSlot(
  formFactor: string,
  excludeProductIds: number[],
): Promise<ProductRow[]>
```

Query: `SELECT * FROM product WHERE form_factor = $formFactor AND active = true AND inventory_quantity > 0 AND id NOT IN ($...excludeProductIds) ORDER BY name`.

Age, audience, and occasion filters are intentionally omitted (admin override — AC-FP-C.3).

### 3.4 Zod schemas: additions to `src/types/dtos.ts`

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

export const PatchBundleItemRequestSchema = z.object({
  productId: z.number().int().positive(),
});
```

Server-side date validation (`partyDate` must be in the future) is applied inside the route handler after Zod parsing — compare `partyDate` to `new Date().toISOString().slice(0, 10)`.

### 3.5 DTO mapper

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

Note: `source`, `redemption_code`, and `redeemed_at` are intentionally excluded from the DTO returned by the future-parties list endpoint; they are used only by the fair-booth kiosk flow.

### 3.6 Public route: `src/routes/futureParties.ts`

```
POST /api/future-parties
  Body: FuturePartyRequest
  Response 201: FuturePartyDto
  Response 400: ProblemDetail (validation failure)
```

Handler logic:
1. Parse body with `FuturePartyRequestSchema.parse(req.body)` — Zod errors auto-forwarded via `next(err)` to `errorHandler`.
2. Check `partyDate > today` — if not, return 400 ProblemDetail.
3. Call `insertFutureParty(parsed)`.
4. Return `res.status(201).json(toFuturePartyDto(row))`.

No auth middleware on this router — mirrors how `generatedBundlesRouter` is mounted.

### 3.7 Admin routes: `src/routes/admin/futureParties.ts`

All handlers are on a single router with `basicAuth` applied at router level.

#### GET `/admin/api/future-parties`

Returns all rows ordered by `submitted_at DESC`.

```
Response 200: FuturePartyDto[]
```

#### PATCH `/admin/api/future-parties/:id/link-bundle`

```
Body: { bundlePublicId: string }
Response 200: FuturePartyDto
Response 400: ProblemDetail — id not integer, or row already has a linked bundle
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
2. If `linked_bundle_public_id` is null, return 422 ProblemDetail.
3. Build bundle URL: `${process.env.FRONTEND_URL}/bundleCustomization/${row.linked_bundle_public_id}`.
4. Call `sendFuturePartyEmail({ toEmail, partyDate, kidGender, bundleUrl })` — see §3.9.
5. On success, call `recordSend(id)` to set `bundle_sent_at = now()`.
6. Return 200 `{ sentAt: updatedRow.bundle_sent_at }`.
7. On SES throw, do NOT call `recordSend`. Return 500 ProblemDetail (`type: "about:internal-error"`).

### 3.8 Admin routes: `src/routes/admin/generatedBundles.ts` (new file)

A new admin router handles the patch-bundle-item endpoint. `basicAuth` is applied at router level.

#### PATCH `/admin/api/generated-bundles/:bundlePublicId/items/:slotCode`

```
Body: { productId: number }
Response 200: GeneratedBundleResponse  (same shape as GET /api/generated-bundles/:publicId)
Response 400: ProblemDetail — product not found, form factor mismatch, out of stock, or validation failure
Response 404: ProblemDetail — bundle not found or slot not found in bundle
```

Handler logic:
1. Parse body with `PatchBundleItemRequestSchema`.
2. Fetch the bundle from DB using the existing `generatedBundleService.getByPublicId(bundlePublicId)` — return 404 if not found.
3. Find the `generated_bundle_item` row for `slotCode` within that bundle — return 404 if the slot does not exist.
4. Fetch the requested product via `productsRepo.findById(productId)` — return 400 if not found, not active, or `inventory_quantity < 1`.
5. Validate `product.form_factor === item.form_factor_snapshot` — return 400 if mismatch.
6. Call `generatedBundlesRepo.patchBundleItem(bundlePublicId, slotCode, product)`.
7. Re-fetch the bundle with `generatedBundleService.getByPublicId(bundlePublicId)` and return 200 with the full response.

#### GET `/admin/api/generated-bundles/:bundlePublicId/items/:slotCode/alternatives`

```
Response 200: AlternativeProductDto[]
Response 404: ProblemDetail — bundle not found or slot not found
```

This endpoint returns the list of eligible alternative products for the swap modal (AC-FP-C.3).

Handler logic:
1. Fetch bundle; return 404 if not found.
2. Find the `generated_bundle_item` row for `slotCode`; return 404 if not found.
3. Collect the `product_id` values of all currently selected items in the bundle (to exclude them).
4. Call `productsRepo.findEligibleAlternativesForSlot(formFactor, excludeProductIds)`.
5. Map each `ProductRow` to `AlternativeProductDto` and return 200.

`AlternativeProductDto`:
```typescript
interface AlternativeProductDto {
  id:          number;
  name:        string;
  sku:         string;
  formFactor:  string;
  retailPrice: string;  // NUMERIC string, e.g. "12.99"
}
```

### 3.9 Email helper: `src/lib/email.ts` — new export `sendFuturePartyEmail`

Added alongside the existing `sendOrderConfirmation` function. Uses the same `sesClient` singleton.

```typescript
interface FuturePartyEmailData {
  toEmail:   string;
  partyDate: string;   // 'YYYY-MM-DD'
  kidGender: 'BOY' | 'GIRL' | 'MIXED';
  bundleUrl: string;
}

export async function sendFuturePartyEmail(data: FuturePartyEmailData): Promise<void>
```

This function THROWS on SES failure (unlike `sendOrderConfirmation` which swallows errors). The route handler catches the throw and returns 500.

**Subject:** `"Your personalised goodie bag is ready!"`

**HTML body structure:**
- Greeting: "Hi! We've curated a goodie bag just for your [boy/girl/mixed-age group] kid's party on [formatted date]."
- A prominent CTA button/link: "View Your Bundle" pointing to `bundleUrl`.
- Footer: "It Is A Small Gift Co. | smallgift.shop"
- Plain-text alternative with the raw `bundleUrl`.

Gender display label mapping: `BOY` → "boy", `GIRL` → "girl", `MIXED` → "mixed-age group".

### 3.10 `src/app.ts` — route registration additions

```typescript
// Import new routers
import { futurePartiesRouter }        from './routes/futureParties.js';
import { adminFuturePartiesRouter }   from './routes/admin/futureParties.js';
import { adminGeneratedBundlesRouter } from './routes/admin/generatedBundles.js';

// Inside createApp():
app.use('/api/future-parties',              futurePartiesRouter);          // public
app.use('/admin/api/future-parties',        adminFuturePartiesRouter);     // basic auth inside router
app.use('/admin/api/generated-bundles',     adminGeneratedBundlesRouter);  // basic auth inside router
```

All lines are inserted before `app.use(errorHandler)`.

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
email:     string
partyDate: string       // YYYY-MM-DD, native date input value
kidGender: 'BOY' | 'GIRL' | 'MIXED' | null
kidAge:    number | ''  // '' = unset
submitting: boolean
success:   boolean
apiError:  string | null
emailError:     string | null
dateError:      string | null
genderError:    string | null
ageError:       string | null
```

**Structure (MUI components):**
```
Dialog (maxWidth="xs", fullWidth)
  DialogTitle — "Plan For Future Party" + IconButton (CloseIcon) top-right
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
```

**Colors and styling:** Follow `COLORS` from `src/theme.ts`. Button uses `COLORS.coral` as `backgroundColor`. Chip selection uses `color="primary"` when selected, matching `GiftFinder`'s `ChipRow` pattern.

**Client-side validation (`handleSubmit`):**
1. Clear all `*Error` states.
2. Validate `email` with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
3. Validate `partyDate` is set and `new Date(partyDate) > new Date()`.
4. Validate `kidGender !== null`.
5. Validate `kidAge` is integer in [1, 12].
6. If any error, set the relevant `*Error` state and return.
7. Set `submitting = true`.
8. `POST /api/future-parties`.
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

export async function submitFutureParty(data: FuturePartySubmission): Promise<FuturePartyResponse>
```

### 4.3 `HomePage.tsx` changes

Add modal state and the second button in the hero section. No structural changes to the gift finder panel.

```typescript
const [futurePartyOpen, setFuturePartyOpen] = useState(false);

// New button added directly below the existing hero button:
<Button
  variant="outlined"
  size="large"
  onClick={() => setFuturePartyOpen(true)}
  sx={{
    mt: 1.5, fontSize: '1rem', py: 1.5, px: 4,
    color: COLORS.coral, borderColor: COLORS.coral,
    '&:hover': { borderColor: '#e06b57', color: '#e06b57', backgroundColor: 'rgba(244,127,107,0.05)' },
  }}
>
  PLAN FOR FUTURE
</Button>

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

### 5.2 Updated page: `src/pages/admin/AdminFuturePartiesPage.tsx`

**State additions / changes:**
```typescript
submissions:       AdminFutureParty[]
loading:           boolean
error:             string | null
// Generate bundle dialog:
generateDialogOpen: boolean
selectedRow:        AdminFutureParty | null
// Apply bundle dialog:
applyDialogOpen:    boolean
applyRow:           AdminFutureParty | null
// Send link:
sendingId:         number | null
sendError:         { id: number; msg: string } | null
snackbar:          string | null
```

**Table columns (AC4.4, AC-FP-B.1, AC-FP-B.2):**
Email | Party Date | Gender | Age | Submitted | Bundle Sent | Generated Bundle Number | Actions

The "Code" column is removed entirely. The "Generated Bundle Number" column displays `linkedBundlePublicId` or "—".

**Actions column logic per row (AC-FP-B.3, AC-FP-B.4, AC-FP-B.5):**

```
if (row.linkedBundlePublicId !== null):
  "View Bundle" Button  — navigates to /admin/bundle-preview/:linkedBundlePublicId?futurePartyId=:id
  [bundleSentAt timestamp if non-null]
  "Send Link" or "Re-send" Button (existing AC6.1/AC6.2 logic)
else:
  "Generate Bundle" Button — opens generate dialog
  "Apply Bundle" Button   — opens apply dialog
```

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

getAlternativesForSlot: (auth: string, bundlePublicId: string, slotCode: string) =>
  adminRequest<AlternativeProductDto[]>(
    `/admin/api/generated-bundles/${bundlePublicId}/items/${slotCode}/alternatives`, auth,
  ),

patchBundleItem: (auth: string, bundlePublicId: string, slotCode: string, productId: number) =>
  adminRequest<GeneratedBundleResponse>(
    `/admin/api/generated-bundles/${bundlePublicId}/items/${slotCode}`, auth, {
      method: 'PATCH',
      body: JSON.stringify({ productId }),
    },
  ),
```

### 5.3 Bundle generation dialog: `src/pages/admin/CreateBundleForFuturePartyDialog.tsx`

**Props:**
```typescript
interface Props {
  open:        boolean;
  submission:  AdminFutureParty | null;
  authHeader:  string;
  onClose:     () => void;
  onLinked:    (updated: AdminFutureParty) => void;
}
```

**Submit flow:**
1. Validate `interest`, `partyType`, `budgetTier` are all set.
2. `POST /api/generated-bundles` (no auth — public endpoint):
   ```json
   {
     "age": <clamped kidAge 3–12>,
     "audiencePreference": <derived from kidGender>,
     "interest": <selected>,
     "partyType": <selected>,
     "budgetTierCode": <"LOW"|"MID"|"HIGH">,
     "maxRetailPrice": null
   }
   ```
3. On 201, extract `publicId` from response.
4. `PATCH /admin/api/future-parties/:id/link-bundle` with `{ bundlePublicId: publicId }` (admin auth).
5. On 200, call `onLinked(updatedRow)` — the parent navigates to `/admin/bundle-preview/:publicId?futurePartyId=:id`.
6. On any error, display inline error inside the dialog.

**Audience preference derivation:**
```
BOY   → MASCULINE
GIRL  → FEMININE
MIXED → NO_PREFERENCE
```

**Age clamping:** `Math.max(3, Math.min(12, submission.kidAge))` when calling the bundle generation API.

**Dialog structure (MUI):**
```
Dialog (maxWidth="sm", fullWidth)
  DialogTitle — "Create Bundle for Future Party"
  DialogContent
    Read-only summary: email, party date, gender, age
    Divider
    ChipRow for Interest (5 options matching GiftFinder labels)
    ChipRow for Party Type (Celebration / Halloween)
    ChipRow for Budget Tier (Low / Mid / High)
    Read-only text: "Audience: [MASCULINE/FEMININE/NO_PREFERENCE]"
    [error] Alert severity="error"
  DialogActions
    Button "Cancel" → onClose()
    Button "Generate & Link" → handleSubmit (disabled when submitting)
```

### 5.4 New dialog: `src/pages/admin/ApplyBundleDialog.tsx`

**Props:**
```typescript
interface Props {
  open:        boolean;
  submission:  AdminFutureParty | null;
  authHeader:  string;
  onClose:     () => void;
  onApplied:   (updated: AdminFutureParty) => void;
}
```

**State:**
```typescript
bundlePublicId: string   // controlled text input
submitting:     boolean
error:          string | null
```

**Submit flow (AC5.8):**
1. Validate `bundlePublicId` is non-empty.
2. Call `adminApi.linkBundleToFutureParty(authHeader, submission.id, bundlePublicId)`.
3. On 200: call `onApplied(updatedRow)` and close.
4. On error: set `error` with the backend detail message.

**Dialog structure:**
```
Dialog (maxWidth="xs", fullWidth)
  DialogTitle — "Apply Existing Bundle"
  DialogContent
    Typography — "Enter the bundle number to associate with this submission."
    TextField (label="Bundle Number", value=bundlePublicId, onChange=...)
    [error] Alert severity="error"
  DialogActions
    Button "Cancel" → onClose()
    Button "Apply" → handleSubmit (disabled when submitting or bundlePublicId.trim() === '')
```

### 5.5 New page: `src/pages/admin/AdminBundlePreviewPage.tsx`

This page reuses `BundleCustomizationPage` layout components but is a separate component. It MUST NOT modify `BundleCustomizationPage` itself — the customer page remains unchanged.

**Route:** `/admin/bundle-preview/:bundlePublicId?futurePartyId=:futurePartyId`

Both `bundlePublicId` (from `useParams`) and `futurePartyId` (from `useSearchParams`) are required. If either is missing, redirect to `/admin/future-parties`.

**State:**
```typescript
bundle:      GeneratedBundleResponse | null
loading:     boolean
error:       string | null
sending:     boolean
sendError:   string | null
sentAt:      string | null
// Swap modal:
swapSlotCode:     string | null   // which slot is being swapped; null = modal closed
swapSlotName:     string          // product name shown in dialog title
alternatives:     AlternativeProductDto[]
altLoading:       boolean
altError:         string | null
selectedAltId:    number | null   // product ID selected but not yet confirmed
swapping:         boolean
swapError:        string | null
```

**Data loading:**
- On mount, fetch `GET /api/generated-bundles/:bundlePublicId` (public endpoint — no auth needed to read).
- Render the same left-column `ConfiguratorVisual` + image gallery and right-column item cards, upgrade options, and gift bag options as `BundleCustomizationPage`.

**Top bar (AC-FP-A.5):**
```
Sticky top bar — same visual style as BundleCustomizationPage's top bar
  Left: Button "< Back to Future Parties" → navigate('/admin/future-parties')
  Right: nothing (no price display)
```

**Item cards with swap icon (AC-FP-C.1):**
Each item in the "Included" section is rendered using `IncludedItemCard` (or an admin-specific wrapper). An `IconButton` with `SwapHorizIcon` is overlaid at the top-right of each card. Clicking it opens the swap modal for that slot.

**Swap modal (AC-FP-C.2 through AC-FP-C.9):**
```
Dialog (maxWidth="sm", fullWidth)
  DialogTitle — "Replace [swapSlotName]"
  DialogContent
    [altLoading] CircularProgress
    [altError]   Alert severity="error"
    [alternatives.length === 0] Typography — "No alternative products are available for this slot."
    [alternatives.length > 0]
      List of AlternativeProductDto cards:
        Each card shows: name, SKU, form factor, retail price
        Clicking a card sets selectedAltId
        Selected card has highlighted border (color="primary")
    [swapError] Alert severity="error"
  DialogActions
    Button "Cancel"  → close modal, reset selectedAltId
    Button "Replace" → handleSwapConfirm (disabled if selectedAltId === null or swapping)
```

When the swap modal opens (`swapSlotCode` becomes non-null):
1. Set `altLoading = true`.
2. Call `adminApi.getAlternativesForSlot(authHeader, bundlePublicId, slotCode)`.
3. Set `alternatives` from response; set `altLoading = false`.

When "Replace" is clicked (`handleSwapConfirm`):
1. `swapping = true`.
2. Call `adminApi.patchBundleItem(authHeader, bundlePublicId, swapSlotCode, selectedAltId)`.
3. On 200: set `bundle` to the returned response, close the modal.
4. On error: set `swapError`.
5. Finally: `swapping = false`.

**Sticky bottom CTA bar (AC-FP-A.3, AC-FP-A.4):**
```
Sticky bottom bar — same visual style as BundleCustomizationPage's bottom bar
  No quantity selector. No price breakdown.
  Right side:
    [sentAt !== null]
      Typography "Sent [formatted sentAt]"
    Button "Send Link" / "Re-send" (variant="contained", color="primary")
      [sending] CircularProgress size=16
    [sendError] Alert severity="error" below bar
```

Send Link click handler:
1. `sending = true`.
2. Call `adminApi.sendFuturePartyLink(authHeader, Number(futurePartyId))`.
3. On 200: set `sentAt = response.sentAt`.
4. On error: set `sendError`.
5. Finally: `sending = false`.

### 5.6 `App.tsx` — new routes

Add inside the `<AdminGuard />` block:

```tsx
import { AdminFuturePartiesPage } from './pages/admin/AdminFuturePartiesPage';
import { AdminBundlePreviewPage } from './pages/admin/AdminBundlePreviewPage';

<Route path="/admin/future-parties"                element={<AdminFuturePartiesPage />} />
<Route path="/admin/bundle-preview/:bundlePublicId" element={<AdminBundlePreviewPage />} />
```

### 5.7 Navigation flow after bundle generation

```
Admin clicks "Generate Bundle"
  → CreateBundleForFuturePartyDialog submits
  → POST /api/generated-bundles  →  201
  → PATCH /admin/api/future-parties/:id/link-bundle  →  200
  → onLinked(updatedRow) called in AdminFuturePartiesPage
  → navigate(`/admin/bundle-preview/${publicId}?futurePartyId=${submission.id}`)
```

This means the list page does NOT need to refresh; the user is immediately taken to the preview page where they can inspect, swap items, and trigger the email send.

---

## 6. Email Design

### 6.1 `sendFuturePartyEmail` function (addition to `src/lib/email.ts`)

Uses the same `sesClient` singleton. Unlike `sendOrderConfirmation` (which swallows errors), this function re-throws so the admin route handler can return 500.

**Subject:** `"Your personalised goodie bag is ready!"`

**HTML body (`buildFuturePartyHtml`):**
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
| GET  | `/api/generated-bundles/:publicId` | None | — | 200 `GeneratedBundleResponse` |

### Admin (HTTP Basic)

| Method | Path | Auth | Request body | Success |
|--------|------|------|--------------|---------|
| GET    | `/admin/api/future-parties` | Basic | — | 200 `FuturePartyDto[]` |
| PATCH  | `/admin/api/future-parties/:id/link-bundle` | Basic | `{ bundlePublicId }` | 200 `FuturePartyDto` |
| POST   | `/admin/api/future-parties/:id/send-link` | Basic | — | 200 `{ sentAt }` |
| GET    | `/admin/api/generated-bundles/:bundlePublicId/items/:slotCode/alternatives` | Basic | — | 200 `AlternativeProductDto[]` |
| PATCH  | `/admin/api/generated-bundles/:bundlePublicId/items/:slotCode` | Basic | `{ productId }` | 200 `GeneratedBundleResponse` |

### Error responses (all endpoints)

All errors conform to the RFC 7807 `ProblemDetail` shape already used throughout the backend:

| Condition | HTTP | `type` |
|-----------|------|--------|
| Validation failure | 400 | `about:validation-error` |
| Row not found | 404 | `about:not-found` |
| Business rule violation (no bundle linked; already linked; slot mismatch) | 422 / 400 | `about:validation-error` |
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
| `backend-node/src/routes/admin/generatedBundles.ts` | Backend engineer |
| `frontend/src/api/futureParties.ts` | Frontend engineer |
| `frontend/src/components/FuturePartyModal.tsx` | Frontend engineer |
| `frontend/src/pages/admin/AdminFuturePartiesPage.tsx` | Frontend engineer |
| `frontend/src/pages/admin/AdminBundlePreviewPage.tsx` | Frontend engineer |
| `frontend/src/pages/admin/CreateBundleForFuturePartyDialog.tsx` | Frontend engineer |
| `frontend/src/pages/admin/ApplyBundleDialog.tsx` | Frontend engineer |

### Modified files

| File | Change |
|------|--------|
| `backend-node/src/types/dtos.ts` | Add `FuturePartyRequestSchema`, `LinkBundleRequestSchema`, `PatchBundleItemRequestSchema` |
| `backend-node/src/lib/email.ts` | Add `FuturePartyEmailData`, `sendFuturePartyEmail`, `buildFuturePartyHtml`, `buildFuturePartyText` |
| `backend-node/src/app.ts` | Register `futurePartiesRouter`, `adminFuturePartiesRouter`, `adminGeneratedBundlesRouter` |
| `backend-node/src/repositories/generatedBundles.ts` | Add `patchBundleItem` function |
| `backend-node/src/repositories/products.ts` | Add `findEligibleAlternativesForSlot` function |
| `frontend/src/api/admin.ts` | Add `AdminFutureParty`, `AlternativeProductDto`, `getFutureParties`, `linkBundleToFutureParty`, `sendFuturePartyLink`, `getAlternativesForSlot`, `patchBundleItem` |
| `frontend/src/pages/HomePage.tsx` | Add `futurePartyOpen` state, "Plan For Future" button, `FuturePartyModal` |
| `frontend/src/pages/admin/AdminNav.tsx` | Add "Future Parties" nav link |
| `frontend/src/App.tsx` | Add `/admin/future-parties` and `/admin/bundle-preview/:bundlePublicId` routes inside `AdminGuard` |

---

## 9. Key Constraints (must not be violated)

1. The `POST /api/future-parties` endpoint requires no auth — it is a public lead-capture form. Do not apply `basicAuth` to this router.
2. `sendFuturePartyEmail` MUST throw on SES failure (unlike `sendOrderConfirmation` which swallows). The route handler catches the throw and returns 500 so the admin knows the email was not sent.
3. `linked_bundle_public_id` is a plain `varchar` column with no FK constraint. This is intentional — matches the pattern of `analytics_event.bundle_id`.
4. The `PATCH /:id/link-bundle` endpoint MUST reject attempts to overwrite an existing `linked_bundle_public_id` with a 400 response. Both the Generate Bundle flow and the Apply Bundle flow use this endpoint; the guard applies equally to both.
5. The bundle generation step in the admin dialog calls `POST /api/generated-bundles` — the existing public endpoint — with no admin credentials. The linking step (`PATCH /admin/api/future-parties/:id/link-bundle`) requires admin credentials.
6. Migration numbering: the next migration is `008`. Verify no other migration with that number exists before creating the file.
7. All new backend code is ESM (`import`/`export`), uses `postgres.js` tagged-template SQL, and validates request bodies with Zod — following `tech-overview.md`.
8. `kid_age` stores the exact value entered by the user (1–12). When calling `POST /api/generated-bundles`, clamp to the API's accepted range (3–12).
9. `AdminBundlePreviewPage` is a NEW component. `BundleCustomizationPage` MUST NOT be modified. The two pages share sub-components (`ConfiguratorVisual`, `IncludedItemCard`, `OptionCard`) but are otherwise independent.
10. The `PATCH /admin/api/generated-bundles/:bundlePublicId/items/:slotCode` endpoint MUST validate form factor compatibility and active/inventory status before updating. It MUST NOT apply age/audience/occasion filters (admin override).
11. The route `/admin/bundle-preview/:bundlePublicId` receives `futurePartyId` as a query parameter (not a path segment) so that the preview page can be navigated to independently (e.g. via "View Bundle") while still knowing which future party row to update when sending the link.
