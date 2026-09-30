# Punch Box — Technical Design

**Feature ID:** FEAT-PB
**Spec date:** 2026-09-20
**Last updated:** 2026-09-20 (rev 2 — user corrections applied)
**Author:** Tech Lead
**Conforms to:** `specs/tech-overview.md`
**Requirements source:** `specs/punch-box/requirements.md`

---

## 1. Overview

This document describes the full technical design for the Punch Box feature: database schema, migration, backend API routes, service/repository layer, frontend pages/components, and data-flow contracts.

Punch Box is an admin-only feature (no customer-facing page). All backend routes are under `/admin/api/punch-boxes` behind the existing `basicAuth` middleware.

---

## 2. Database Schema

### 2.1 New Table: `punch_box`

```sql
CREATE TABLE punch_box (
  id              BIGSERIAL       PRIMARY KEY,
  public_id       VARCHAR(30)     NOT NULL UNIQUE,
  future_party_id BIGINT          REFERENCES future_parties(id) ON DELETE SET NULL,
  slot_count      SMALLINT        NOT NULL CHECK (slot_count IN (30, 50, 70)),
  total_cogs_usd  NUMERIC(10,2)   NOT NULL,
  retail_price    NUMERIC(10,2)   NOT NULL,
  profit_usd      NUMERIC(10,2)   NOT NULL,
  status          VARCHAR(20)     NOT NULL DEFAULT 'ASSIGNED'
                    CHECK (status IN ('ASSIGNED', 'ORDERED')),
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_punch_box_future_party_id ON punch_box(future_party_id);
CREATE INDEX idx_punch_box_created_at ON punch_box(created_at DESC);
CREATE INDEX idx_punch_box_status ON punch_box(status);
```

### 2.2 New Table: `punch_box_item`

```sql
CREATE TABLE punch_box_item (
  id                    BIGSERIAL     PRIMARY KEY,
  punch_box_id          BIGINT        NOT NULL REFERENCES punch_box(id) ON DELETE CASCADE,
  product_id            BIGINT        REFERENCES product(id) ON DELETE SET NULL,
  product_name_snapshot VARCHAR(200)  NOT NULL,
  sku_snapshot          VARCHAR(100)  NOT NULL,
  cost_snapshot         NUMERIC(10,2) NOT NULL,    -- product.cost at creation time (RMB)
  quantity              SMALLINT      NOT NULL CHECK (quantity >= 1),
  display_order         SMALLINT      NOT NULL
);

CREATE INDEX idx_punch_box_item_punch_box_id ON punch_box_item(punch_box_id);
```

### 2.3 Alter Table: `future_parties`

```sql
ALTER TABLE future_parties
  ADD COLUMN linked_punch_box_id BIGINT REFERENCES punch_box(id) ON DELETE SET NULL;
```

Note: Unlike `linked_bundle_public_id` (which is a plain varchar for survivability), `linked_punch_box_id` uses a real FK because punch boxes are admin-created objects with a stable lifecycle; they are never deleted in this MVP.

A future party may have both `linked_bundle_public_id` and `linked_punch_box_id` set simultaneously — these are independent links.

### 2.4 Migration File

**File:** `backend-node/migrations/012_punch_box.ts`
**Sequence:** Next after `011_offline_fair.ts`. Verify no `012_*` file exists before creating.

---

## 3. Public ID Generation

Punch box public IDs follow the same pattern as `ord_` in `orders.ts`:

```ts
import { randomBytes } from 'crypto';
const publicId = `pb_${randomBytes(6).toString('hex')}`; // pb_<12-char-hex>
```

This is generated server-side; the client never supplies a public ID.

---

## 4. RMB→USD Conversion & Pricing Rule

- **COGS conversion:** `product.cost / 6.5` (cost is stored in RMB in the `product` table; divisor 6.5 is hardcoded)
- **Default retail price suggestion:** Apply the existing `computeRetailPrice(cog_adjusted)` function (imported from `src/services/retailPricing.ts`) per product using `product.cog_adjusted`, then sum the per-product retail prices weighted by quantity.
- **Server-side recomputation:** On POST creation, the server recomputes `total_cogs_usd` from the submitted product IDs + quantities by loading current product rows. The client-submitted COGS is ignored. `profit_usd = retail_price − total_cogs_usd` (where `retail_price` IS trusted from the client, per AC8.4).

---

## 5. Backend Implementation

### 5.1 New Files

| File | Role |
|---|---|
| `src/repositories/punchBoxes.ts` | Raw SQL: insert, find, list, patchItem, status transition |
| `src/routes/admin/punchBoxes.ts` | Express router, all admin punch-box routes |
| `migrations/012_punch_box.ts` | DB migration |

### 5.2 Router Registration (app.ts)

```ts
import { adminPunchBoxesRouter } from './routes/admin/punchBoxes.js';
// ...
app.use('/admin/api/punch-boxes', adminPunchBoxesRouter);
```

### 5.3 Route Table

| Method | Path | Description |
|---|---|---|
| POST | `/admin/api/punch-boxes` | Create a punch box |
| GET | `/admin/api/punch-boxes` | List all punch boxes |
| GET | `/admin/api/punch-boxes/:publicId` | Get full punch box aggregate with items |
| PATCH | `/admin/api/punch-boxes/:publicId/items/:itemId` | Edit item quantity or swap product |
| POST | `/admin/api/punch-boxes/:publicId/order` | Mark as ORDERED (inventory deduction) |

All routes apply `basicAuth` at router level.

### 5.4 POST `/admin/api/punch-boxes` — Create

**Request body (Zod-validated):**

```ts
const CreatePunchBoxSchema = z.object({
  futurePartyId: z.number().int().positive().optional(),
  slotCount: z.union([z.literal(30), z.literal(50), z.literal(70)]),
  retailPrice: z.number().positive(),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1),
    displayOrder: z.number().int().min(0),
  })).min(1),
});
```

**Server logic:**

1. Validate body via Zod (400 on failure).
2. Load product rows for all `productId` values in the items array. Return 400 if any product ID is not found or not active.
3. Compute `total_cogs_usd = sum((product.cost / 6.5) * item.quantity)` for all items, rounded to 2 dp.
4. Compute `profit_usd = retailPrice − total_cogs_usd`, rounded to 2 dp.
5. Generate `public_id = pb_<12-char-hex>`.
6. In a single `sql.begin()` transaction:
   a. INSERT `punch_box` row; get back `id`.
   b. INSERT all `punch_box_item` rows (using the product snapshot values from the loaded product rows).
   c. If `futurePartyId` is supplied: UPDATE `future_parties SET linked_punch_box_id = <new id> WHERE id = futurePartyId`.
7. Return 201 with the created punch box detail DTO.

**Error cases:**
- Product not found or inactive → 400 `about:validation-error`
- `futurePartyId` not found in `future_parties` → 400 `about:validation-error`

### 5.5 GET `/admin/api/punch-boxes` — List

Returns all punch boxes, newest first, up to 200 rows (no pagination needed in MVP).

**Response shape:**

```ts
interface PunchBoxListItem {
  publicId: string;
  slotCount: number;
  totalCogsUsd: number;
  retailPrice: number;
  profitUsd: number;
  status: 'ASSIGNED' | 'ORDERED';
  createdAt: string;
  futurePartyId: number | null;
}
```

### 5.6 GET `/admin/api/punch-boxes/:publicId` — Detail

Returns full punch box aggregate: the `punch_box` row plus all `punch_box_item` rows joined with current product details (for display purposes). Returns 404 if not found.

**Response shape:**

```ts
interface PunchBoxDetail extends PunchBoxListItem {
  items: PunchBoxItemDto[];
}

interface PunchBoxItemDto {
  itemId: number;           // punch_box_item.id — needed by PATCH route
  productId: number | null;
  productNameSnapshot: string;
  skuSnapshot: string;
  costSnapshotRmb: number;
  quantity: number;
  displayOrder: number;
}
```

Note: `itemId` is included so the frontend can call `PATCH .../items/:itemId`.

### 5.7 PATCH `/admin/api/punch-boxes/:publicId/items/:itemId` — Edit Item

Allows quantity change or product swap on a single item. Only permitted when punch box status is ASSIGNED.

**Request body (Zod-validated):**

```ts
const PatchPunchBoxItemSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  productId: z.number().int().positive().optional(),
}).refine(data => data.quantity !== undefined || data.productId !== undefined, {
  message: 'At least one of quantity or productId must be provided',
});
```

**Server logic:**

1. Fetch punch box by `publicId`; return 404 if not found.
2. If status is ORDERED, return 409 `{ detail: 'Cannot edit an ordered punch box.' }`.
3. Fetch the `punch_box_item` row by `itemId`; return 404 if not found or if `punch_box_id` does not match.
4. If `productId` is provided: load new product row; return 400 if not found/inactive; update `product_id`, `product_name_snapshot`, `sku_snapshot`, `cost_snapshot` on the item row.
5. If `quantity` is provided: update `quantity` on the item row.
6. Recompute `total_cogs_usd` across all items of the punch box (reload all items after the update); recompute `profit_usd = retail_price − new_total_cogs_usd`; UPDATE `punch_box` row.
7. Return 200 with the updated `PunchBoxDetail` DTO.

### 5.8 POST `/admin/api/punch-boxes/:publicId/order` — Mark as ORDERED

This is a dedicated action route (not a PATCH /status) to allow the inventory deduction to be co-located with the status change.

**Server logic:**

1. Fetch punch box by `publicId`; return 404 if not found.
2. If status is already `ORDERED`, return 409 Conflict with `detail: 'Punch box is already ordered.'`
3. In a single `sql.begin()` transaction:
   a. For each `punch_box_item`, execute:
      ```sql
      UPDATE product SET inventory_quantity = inventory_quantity - $quantity
      WHERE id = $product_id
      ```
      (if `product_id` is NULL, skip deduction for that item)
   b. `UPDATE punch_box SET status = 'ORDERED' WHERE id = $id`
4. Return 200 with `{ publicId, status: 'ORDERED' }`.

**Note:** Negative inventory is allowed per AC5.5 — no CHECK constraint prevents it.

---

## 6. Repository Layer (`src/repositories/punchBoxes.ts`)

Key functions:

```ts
// Insert punch_box + items + optional future_parties update atomically
savePunchBox(snapshot: PunchBoxSnapshot): Promise<PunchBoxRow>

// List all punch boxes, newest first
listPunchBoxes(limit?: number): Promise<PunchBoxRow[]>

// Find single punch box with items (full aggregate)
findPunchBoxByPublicId(publicId: string): Promise<PunchBoxAggregate | null>

// Update a single punch_box_item (quantity and/or product swap); recompute punch_box totals
patchPunchBoxItem(punchBoxId: number, itemId: number, patch: PunchBoxItemPatch): Promise<PunchBoxAggregate>

// Atomically deduct inventory + set status = ORDERED
markPunchBoxOrdered(id: number, items: PunchBoxItemRow[]): Promise<void>
```

Types mirror the DB columns. `NUMERIC` columns come back as strings from `postgres.js` — cast with `parseFloat()` in the service/route layer when building DTOs.

---

## 7. Frontend Implementation

### 7.1 New Routes (App.tsx additions)

```tsx
// Inside <AdminGuard>:
<Route path="/admin/punch-box/new" element={<AdminPunchBoxBuilderPage />} />
<Route path="/admin/punch-box/:publicId" element={<AdminPunchBoxEditPage />} />
```

Note: `/admin/punch-box/new` must be listed before `/admin/punch-box/:publicId` to prevent the router matching "new" as a publicId.

### 7.2 New Frontend Files

| File | Role |
|---|---|
| `src/pages/admin/AdminPunchBoxBuilderPage.tsx` | Two-column builder (R2, R3) |
| `src/pages/admin/AdminPunchBoxEditPage.tsx` | Pre-populated view/edit page (R_PREVIEW) |
| `src/utils/punchBoxHtml.ts` | Client-side HTML generation utility (R_HTML) |
| `src/api/admin.ts` additions | `createPunchBox`, `listPunchBoxes`, `getPunchBoxDetail`, `patchPunchBoxItem`, `orderPunchBox` API helpers |

### 7.3 AdminPunchBoxBuilderPage Layout

```
┌─────────────────────────────────────────────────────────┐
│ AdminNav                                                  │
├──────────────────────────┬──────────────────────────────┤
│ LEFT: Product Table       │ RIGHT: Configuration Panel   │
│                           │                              │
│ [Search]  [Category ...]  │ Punch Box Size: [30 50 70]   │
│                           │                              │
│ ☐ Name       Price  Inv  │ Selected Products:           │
│ ☑ Widget A   $2.99  120  │  Widget A  qty: [2]          │
│ ☐ Gadget B   $1.50  80   │  Gadget C  qty: [1]          │
│ ☑ Gadget C   $3.00  55   │                              │
│ ...                       │ [Calculate Retail Price]     │
│                           │                              │
│                           │ Total COGS: $4.12            │
│                           │ Profit: [$X.XX] (editable)   │
│                           │ Retail Price: [$Y.YY] (edit) │
│                           │                              │
│                           │ [Generate Preview]           │
│                           │ [Generate Punch Box]         │
└──────────────────────────┴──────────────────────────────┘
```

**State:**
- `products: ProductRow[]` — loaded once on mount from `GET /admin/api/products` (existing endpoint, filtered to `active: true` client-side)
- `selectedItems: Map<productId, { product, quantity }>` — tracks selections
- `slotCount: 30 | 50 | 70 | null`
- `retailPrice: number | null` — admin-controlled
- `profit: number | null` — derived or admin-controlled
- `totalCogsUsd: number` — computed from selectedItems
- `search: string`, `categoryFilter: string`

**Pricing calculation (client-side, for display only):**
```ts
const totalCogsUsd = sum over selectedItems: (item.product.cost / 6.5) * item.quantity
const suggestedRetailPrice = sum over selectedItems:
  computeRetailPrice(item.product.cog_adjusted) * item.quantity
const defaultProfit = suggestedRetailPrice - totalCogsUsd
```

`computeRetailPrice` is replicated client-side as a pure utility function (mirrors `src/services/retailPricing.ts`).

**On "Calculate Retail Price" click:** Populate `retailPrice` and `profit` from the computed values if not yet set, or re-derive from current `totalCogsUsd`.

**On Retail Price edit:** `profit = retailPrice - totalCogsUsd`
**On Profit edit:** `retailPrice = totalCogsUsd + profit`

**On "Generate Preview" click:** Call `generatePunchBoxHtml(data)` utility (see section 9) and trigger download.

**On "Generate Punch Box" click:**
1. Client-side validation (AC3.6).
2. POST to `/admin/api/punch-boxes` with:
   ```json
   {
     "futurePartyId": <from query param, if present>,
     "slotCount": 30,
     "retailPrice": 42.50,
     "items": [
       { "productId": 7, "quantity": 2, "displayOrder": 0 },
       { "productId": 12, "quantity": 1, "displayOrder": 1 }
     ]
   }
   ```
3. On success: navigate to `/admin/bundles` with a success snackbar.
4. On error: display inline error message.

### 7.4 AdminPunchBoxEditPage Layout

Mounted at `/admin/punch-box/:publicId`. On mount, fetch `GET /admin/api/punch-boxes/:publicId`.

**Layout:** Same two-column layout as the Builder page, but pre-populated from the fetched `PunchBoxDetail`.

**Left column (product table):**
- Same product table as builder (all active products).
- Products already in the punch box have their checkboxes pre-checked and rows highlighted.
- Changing a checkbox selection or quantity triggers a `PATCH /admin/api/punch-boxes/:publicId/items/:itemId` call on submission (or inline on change — see note below).

**Right column (configuration panel):**
- Size: displayed as a read-only chip (size cannot be changed post-creation in this MVP).
- Selected products list with quantity inputs (editable if status = ASSIGNED, read-only if ORDERED).
- Pricing summary (Total COGS, Profit, Retail Price) — auto-recalculated after each item edit response.
- "Generate Preview" button — always visible.
- "Mark as Ordered" button — visible only when status = ASSIGNED.

**Edit strategy:** Edits are saved per-item via `PATCH /admin/api/punch-boxes/:publicId/items/:itemId`. The page refreshes its local state from the returned `PunchBoxDetail` after each successful patch. Unsaved changes are tracked in local state and submitted when the user changes quantity and blurs the input (or presses Enter).

**Mark as Ordered flow:**
1. Admin clicks "Mark as Ordered".
2. Same confirmation dialog as AC5.2–AC5.3.
3. On confirm: POST to `/admin/api/punch-boxes/:publicId/order`.
4. On success: navigate to `/admin/bundles` with a success snackbar.

**Error handling:** 404 from the detail API → display "Punch box not found" message with a link back to `/admin/bundles`.

### 7.5 AdminFuturePartiesPage Changes

**New column value:** `linkedPunchBoxId` and `linkedPunchBoxPublicId` added to the `AdminFutureParty` type in `src/api/admin.ts`.

**Actions column logic (updated):**

```
Bundle actions (unchanged):
  if linkedBundlePublicId !== null:
    → show View Bundle + Send/Resend

Punch box actions (independent of bundle state):
  if linkedPunchBoxId === null:
    → show Generate Punch Box (Inventory2Icon or GridViewIcon)
  else:
    → show View Punch Box (VisibilityIcon, navigates to /admin/punch-box/<linkedPunchBoxPublicId>)
```

The Generate Punch Box and View Punch Box controls are shown regardless of whether a bundle is linked. A future party may have both a bundle and a punch box linked.

**Future parties admin endpoint change:** `GET /admin/api/future-parties` response must include `linkedPunchBoxId` and `linkedPunchBoxPublicId` fields (see section 10).

### 7.6 AdminBundlesPage Changes

The Bundles page must merge bundles and punch boxes into one list. Two architectural approaches:

**Option A — Two separate fetches merged client-side:** Fetch `GET /admin/api/bundles` and `GET /admin/api/punch-boxes` in parallel, merge the results in the component, sort by `createdAt` desc.

**Option B — New unified backend endpoint:** A single endpoint returns a merged list.

**Recommendation: Option A** for simplicity — the page already fetches bundles separately, and adding a parallel fetch for punch boxes avoids backend complexity. The merge/sort is trivial client-side.

**Unified row type:**

```ts
type BundlesPageRow =
  | { rowType: 'bundle'; data: AdminBundleListItem }
  | { rowType: 'punch-box'; data: PunchBoxListItem }
```

**New "Type" column** is first after the expand toggle.

**Status change control:**
- Bundle rows: no "Mark as Ordered" button (bundles show the existing expand/detail row with status chip).
- Punch box rows with ASSIGNED status: show "Mark as Ordered" button (IconButton or small Button).
- Punch box rows with ORDERED status: show read-only status chip only.

**View icon for punch box rows:** Each punch box row SHALL have a "View" icon button that navigates to `/admin/punch-box/<publicId>`.

**Confirmation dialog for "Mark as Ordered":**
```
Title: "Mark Punch Box as Ordered?"
Body: "This action is irreversible. It will deduct inventory for each product in this punch box by its quantity. Do you want to continue?"
Actions: [Cancel] [Confirm — Mark as Ordered]
```

On confirm: POST to `/admin/api/punch-boxes/:publicId/order`. On success: update the row's status in local state to ORDERED.

**Punch box expanded detail:**

Punch box rows are not expandable with a slot-swap panel. Instead, clicking the row expands a simple inline detail showing: public ID, slot count, total COGS, profit, retail price, created date, linked future party email (if any), and an items list (product name, SKU, quantity).

### 7.7 AdminOrdersPage Changes

The Orders page must include ORDERED punch boxes.

**Architecture:** Parallel fetch of `GET /admin/api/orders` and `GET /admin/api/punch-boxes?status=ORDERED`, merged client-side, sorted by `createdAt` desc.

**New "Type" column** — shows "Order" or "Punch Box".

**New "Slot Count" column** — shows slot count for punch boxes, "—" for orders.

**Status filter behavior:**
- "ORDERED" filter: show ORDERED orders + ORDERED punch boxes.
- Any other status filter: hide punch box rows (punch boxes only have ORDERED status).
- No filter: show all orders + all ORDERED punch boxes.

**Punch box row columns:**
- ID: `publicId` (monospace)
- Type: "Punch Box"
- Status: "ORDERED" (non-editable — no Select dropdown for punch box rows)
- Total: `retailPrice` formatted as USD
- Slot Count: `slotCount`
- Created: formatted date
- Customer Email: "—" (not applicable)
- Items: "—" (not applicable)

**Row click:** No navigation in MVP (AC7.7).

---

## 8. API Type Additions (`src/api/admin.ts`)

```ts
// New type for punch box list items
export interface AdminPunchBoxListItem {
  publicId: string;
  slotCount: 30 | 50 | 70;
  totalCogsUsd: number;
  retailPrice: number;
  profitUsd: number;
  status: 'ASSIGNED' | 'ORDERED';
  createdAt: string;
  futurePartyId: number | null;
}

export interface AdminPunchBoxDetail extends AdminPunchBoxListItem {
  items: {
    itemId: number;
    productId: number | null;
    productNameSnapshot: string;
    skuSnapshot: string;
    costSnapshotRmb: number;
    quantity: number;
    displayOrder: number;
  }[];
}

// AdminFutureParty type additions
// Add to existing AdminFutureParty:
//   linkedPunchBoxId: number | null;
//   linkedPunchBoxPublicId: string | null;

// New API helpers
createPunchBox(authHeader: string, body: CreatePunchBoxRequest): Promise<AdminPunchBoxDetail>
listPunchBoxes(authHeader: string): Promise<AdminPunchBoxListItem[]>
getPunchBoxDetail(authHeader: string, publicId: string): Promise<AdminPunchBoxDetail>
patchPunchBoxItem(authHeader: string, publicId: string, itemId: number, patch: { quantity?: number; productId?: number }): Promise<AdminPunchBoxDetail>
orderPunchBox(authHeader: string, publicId: string): Promise<{ publicId: string; status: string }>
```

---

## 9. HTML Preview Generation (`src/utils/punchBoxHtml.ts`)

The preview is generated entirely client-side — no backend endpoint is involved.

**Function signature:**

```ts
export interface PunchBoxHtmlData {
  publicId: string | null;   // null for unsaved drafts
  slotCount: number | null;
  items: { productName: string; quantity: number }[];
  totalCogsUsd: number;
  profitUsd: number;
  retailPrice: number;
}

export function generatePunchBoxHtml(data: PunchBoxHtmlData): string {
  // Returns a complete HTML string
}
```

**Generated HTML structure:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Punch Box Summary</title>
  <style>/* inline CSS — no external dependencies */</style>
</head>
<body>
  <h1>[Company Name] — Punch Box Summary</h1>
  <p>ID: pb_xxxx (or "Draft")</p>
  <p>Size: 30 slots</p>
  <table>
    <thead><tr><th>Product</th><th>Quantity</th></tr></thead>
    <tbody><!-- one row per item --></tbody>
  </table>
  <section>
    <p>Total COGS: $X.XX</p>
    <p>Profit: $X.XX</p>
    <p>Retail Price: $X.XX</p>
  </section>
</body>
</html>
```

**Download mechanism:**

```ts
export function downloadPunchBoxHtml(data: PunchBoxHtmlData): void {
  const html = generatePunchBoxHtml(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'punch-box-preview.html';
  a.click();
  URL.revokeObjectURL(url);
}
```

Both `AdminPunchBoxBuilderPage` and `AdminPunchBoxEditPage` import and call `downloadPunchBoxHtml` when "Generate Preview" is clicked. No backend round-trip.

---

## 10. Entity Type Additions (`src/types/entities.ts`)

```ts
export interface PunchBoxRow {
  id: number;
  public_id: string;
  future_party_id: number | null;
  slot_count: number;
  total_cogs_usd: string;   // NUMERIC → string from postgres.js
  retail_price: string;     // NUMERIC → string from postgres.js
  profit_usd: string;       // NUMERIC → string from postgres.js
  status: string;
  created_at: Date;
}

export interface PunchBoxItemRow {
  id: number;
  punch_box_id: number;
  product_id: number | null;
  product_name_snapshot: string;
  sku_snapshot: string;
  cost_snapshot: string;    // NUMERIC → string from postgres.js
  quantity: number;
  display_order: number;
}
```

---

## 11. Future Parties Backend Changes

### 11.1 Admin Future Parties List Query

The existing query in `src/repositories/futureParties.ts` (or the admin route handler) that returns the list of future parties must be updated to LEFT JOIN `punch_box` and include `punch_box.id AS linked_punch_box_id` and `punch_box.public_id AS linked_punch_box_public_id`.

```sql
SELECT fp.*,
       pb.id         AS linked_punch_box_id,
       pb.public_id  AS linked_punch_box_public_id
FROM future_parties fp
LEFT JOIN punch_box pb ON pb.id = fp.linked_punch_box_id
ORDER BY fp.submitted_at DESC
```

### 11.2 DTO Additions

The `AdminFuturePartyDto` (in `src/types/dtos.ts` or the route handler) must add:
```ts
linkedPunchBoxId: number | null;
linkedPunchBoxPublicId: string | null;
```

---

## 12. Migration Plan

**File:** `backend-node/migrations/012_punch_box.ts`

```ts
export async function up(pgm: MigrationBuilder): Promise<void> {
  // 1. Create punch_box table
  pgm.createTable('punch_box', { ... });

  // 2. Create punch_box_item table
  pgm.createTable('punch_box_item', { ... });

  // 3. Add linked_punch_box_id to future_parties
  pgm.addColumn('future_parties', {
    linked_punch_box_id: {
      type: 'bigint',
      references: '"punch_box"',
      onDelete: 'SET NULL',
      notNull: false,
    }
  });

  // 4. Indexes
  pgm.addIndex('punch_box', 'future_party_id');
  pgm.addIndex('punch_box', 'created_at', { order: { created_at: 'DESC' } });
  pgm.addIndex('punch_box', 'status');
  pgm.addIndex('punch_box_item', 'punch_box_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('future_parties', 'linked_punch_box_id');
  pgm.dropTable('punch_box_item');
  pgm.dropTable('punch_box');
}
```

---

## 13. Data Flow Diagrams

### 13.1 Punch Box Creation

```
Admin Browser → POST /admin/api/punch-boxes
                  ↓
              Validate body (Zod)
                  ↓
              Load product rows (by productId)
                  ↓
              Compute total_cogs_usd server-side
                  ↓
              Begin transaction:
                INSERT punch_box
                INSERT punch_box_item × N
                UPDATE future_parties (if futurePartyId supplied)
              Commit
                  ↓
              Return 201 PunchBoxDetail DTO
```

### 13.2 Punch Box Item Edit

```
Admin Browser → PATCH /admin/api/punch-boxes/:publicId/items/:itemId
                  ↓
              Fetch punch_box (404 if missing; 409 if ORDERED)
                  ↓
              Fetch punch_box_item (404 if missing)
                  ↓
              Apply patch (quantity / product swap)
                  ↓
              Recompute total_cogs_usd + profit_usd on punch_box
                  ↓
              Return 200 PunchBoxDetail DTO (full aggregate)
```

### 13.3 Mark as Ordered

```
Admin Browser → POST /admin/api/punch-boxes/:publicId/order
                  ↓
              Load punch box (404 if not found)
                  ↓
              Check status ≠ ORDERED (409 if already ordered)
                  ↓
              Begin transaction:
                UPDATE product.inventory_quantity -= quantity (per item)
                UPDATE punch_box SET status = 'ORDERED'
              Commit
                  ↓
              Return 200 { publicId, status: 'ORDERED' }
```

### 13.4 Bundles Page Load

```
Admin Browser
  → GET /admin/api/bundles         (existing)
  → GET /admin/api/punch-boxes     (new, parallel)
         ↓ merge + sort by createdAt DESC
         ↓ render unified list with Type column
```

### 13.5 Orders Page Load

```
Admin Browser
  → GET /admin/api/orders          (existing)
  → GET /admin/api/punch-boxes     (new, ?status=ORDERED implied by filter logic)
         ↓ merge + sort by createdAt DESC
         ↓ render unified list with Type + Slot Count columns
```

### 13.6 HTML Preview (client-side only)

```
Admin Browser clicks "Generate Preview"
  → generatePunchBoxHtml(currentFormData)   [pure JS, no HTTP]
  → Blob + URL.createObjectURL
  → programmatic <a download> click
  → Browser saves file
```

---

## 14. Conformance Notes

- **postgres.js tagged templates only** — no string concatenation in SQL. `NUMERIC` columns will be returned as strings; use `parseFloat()` for arithmetic.
- **`prepare: false`** — all queries use the module-level `sql` singleton from `src/db.ts`, which already has `prepare: false`.
- **Admin auth** — `adminPunchBoxesRouter.use(basicAuth)` is the first line of the router, matching the pattern of all other admin routers.
- **RFC 7807 errors** — all error responses use `{ type, title, status, detail, instance }`.
- **No customer-facing routes** — punch boxes are entirely admin-side.
- **Snapshot pattern** — `punch_box_item` stores `product_name_snapshot`, `sku_snapshot`, and `cost_snapshot` at creation time, consistent with `generated_bundle_item` (tech-overview §8.6).
- **Server-side COGS** — `total_cogs_usd` is always recomputed on the server from current product rows at creation time; client-submitted COGS is ignored (tech-overview §18, point 5). On PATCH item, COGS is also recomputed server-side.
- **Independent punch box + bundle links** — `future_parties` will have both `linked_bundle_public_id` and `linked_punch_box_id`; these are independent nullable columns.

---

## 15. Out of Scope

- Pagination on the punch box list (up to 200 rows is sufficient for MVP)
- Deleting a punch box
- Customer-facing punch box pages or cart integration
- Email notification for punch boxes
- Multiple punch boxes per future party
- Changing punch box size (slot count) post-creation
