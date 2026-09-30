# Punch Box — Implementation Tasks

**Feature ID:** FEAT-PB
**Spec date:** 2026-09-20
**Author:** Project Manager
**Status:** All tasks complete — 2026-09-20

Design source: `specs/punch-box/design.md`
Requirements source: `specs/punch-box/requirements.md`

---

## Task Status Key

- `[ ]` pending
- `[-]` in progress (agent noted)
- `[x]` completed
- `[!]` blocked (reason noted)

---

## Layer 1 — Database & Migration

### T1 — Migration 012: Create punch_box and punch_box_item tables; add linked_punch_box_id to future_parties

**Status:** `[x]`
**Agent:** backend-engineer
**Requirements:** AC4.1, AC4.2, AC4.5
**Design ref:** design.md §2, §12

Write `backend-node/migrations/012_punch_box.ts` using `node-pg-migrate` / `MigrationBuilder`. The migration must:
1. Create the `punch_box` table exactly as specified in design.md §2.1 (including all CHECK constraints, NOT NULL constraints, DEFAULT values, and indexes).
2. Create the `punch_box_item` table exactly as specified in design.md §2.2 (including ON DELETE CASCADE FK and index).
3. Add `linked_punch_box_id` nullable bigint FK column to `future_parties` as specified in design.md §2.3.
4. Implement a `down` function that drops the column and both tables in reverse dependency order.

Verify that no `012_*` file already exists before creating.

**Depends on:** nothing

---

## Layer 2 — Backend

### T2 — Repository: punch_box + punch_box_item CRUD

**Status:** `[x]`
**Agent:** backend-engineer
**Requirements:** AC4.3, AC4.4, AC4.6, AC5.4, ACPV.3
**Design ref:** design.md §6, §10

Create `src/repositories/punchBoxes.ts` implementing the following functions using `postgres.js` tagged template literals only (no string concatenation):

- `savePunchBox(snapshot)` — inserts `punch_box` + all `punch_box_item` rows + optional `future_parties` update in a single `sql.begin()` transaction; generates `public_id = pb_<12-char-hex>` (use `randomBytes(6).toString('hex')`).
- `listPunchBoxes(limit?)` — returns all punch boxes newest first, default limit 200.
- `findPunchBoxByPublicId(publicId)` — returns full aggregate (`punch_box` row + all `punch_box_item` rows); returns `null` if not found.
- `patchPunchBoxItem(punchBoxId, itemId, patch)` — updates quantity and/or product details on a single item row; recomputes and updates `total_cogs_usd` and `profit_usd` on the parent `punch_box` row; returns the full updated aggregate.
- `markPunchBoxOrdered(id, items)` — in a single `sql.begin()` transaction: deducts `quantity` from `product.inventory_quantity` per item (skip if `product_id` is null), then sets `punch_box.status = 'ORDERED'`.

Add `PunchBoxRow` and `PunchBoxItemRow` interfaces to `src/types/entities.ts` as specified in design.md §10.

**Depends on:** T1

---

### T3 — Routes: all punch box admin API endpoints

**Status:** `[x]`
**Agent:** backend-engineer
**Requirements:** AC9.1, AC9.2, R2 (create), R5 (order), ACPV.3 (patch item)
**Design ref:** design.md §5.3 – §5.8

Create `src/routes/admin/punchBoxes.ts` implementing all five routes in the route table (design.md §5.3). The router must:

1. Apply `basicAuth` middleware as the first line.
2. Implement `POST /` — create punch box (design.md §5.4): Zod validation, product row loading, server-side COGS computation, transaction insert, return 201 DTO.
3. Implement `GET /` — list (design.md §5.5): return up to 200 punch boxes newest first.
4. Implement `GET /:publicId` — detail (design.md §5.6): return full aggregate including `itemId` on each item; 404 if not found.
5. Implement `PATCH /:publicId/items/:itemId` — edit item (design.md §5.7): 409 if ORDERED, 404 if punch box or item not found; load new product if productId supplied; call `patchPunchBoxItem`; return updated full DTO.
6. Implement `POST /:publicId/order` — mark ordered (design.md §5.8): 409 if already ORDERED; call `markPunchBoxOrdered`; return `{ publicId, status: 'ORDERED' }`.

All error responses use RFC 7807 format.

**Depends on:** T2

---

### T4 — Future parties route: add punch box fields to DTO + link-punch-box route

**Status:** `[x]`
**Agent:** backend-engineer
**Requirements:** AC1.1, AC1.3, AC4.4
**Design ref:** design.md §11

1. Update the admin future parties list query (`src/repositories/futureParties.ts` or the route handler) to LEFT JOIN `punch_box` and include `linked_punch_box_id` and `linked_punch_box_public_id` in the result set (design.md §11.1).
2. Update `AdminFuturePartyDto` to include `linkedPunchBoxId: number | null` and `linkedPunchBoxPublicId: string | null` (design.md §11.2).

**Depends on:** T1

---

### T5 — Register new routers in app.ts; verify future_parties DTO export

**Status:** `[x]`
**Agent:** backend-engineer
**Requirements:** AC9.1
**Design ref:** design.md §5.2

Register `adminPunchBoxesRouter` in `src/app.ts` at `/admin/api/punch-boxes` (design.md §5.2). Confirm the future parties DTO changes from T4 are exported correctly for use by frontend consumers.

**Depends on:** T3, T4

---

## Layer 3 — Frontend API Layer

### T6 — Add types and adminApi methods for punch box endpoints

**Status:** `[x]`
**Agent:** frontend-engineer
**Requirements:** AC9.1, R2, R5, ACPV.1, ACPV.3
**Design ref:** design.md §8

In `src/api/admin.ts`:
1. Add `AdminPunchBoxListItem` and `AdminPunchBoxDetail` interfaces (design.md §8).
2. Add to `AdminFutureParty`: `linkedPunchBoxId: number | null`, `linkedPunchBoxPublicId: string | null`.
3. Add API helpers: `createPunchBox`, `listPunchBoxes`, `getPunchBoxDetail`, `patchPunchBoxItem`, `orderPunchBox` — with correct request shapes, paths, and auth header passing (design.md §8).

**Depends on:** T3, T4 (need the route shapes to be finalised first)

---

## Layer 4 — Frontend Pages

### T7 — AdminPunchBoxBuilderPage: two-column builder with Generate Preview

**Status:** `[x]`
**Agent:** frontend-engineer
**Requirements:** R2, R3, R8, ACHTML.1–ACHTML.5
**Design ref:** design.md §7.3, §9

Create `src/pages/admin/AdminPunchBoxBuilderPage.tsx`:
- Two-column layout matching the wireframe in design.md §7.3.
- Left column: active product table with search (by name/SKU) and category filter chips.
- Right column: size dropdown (30/50/70), selected products list with editable quantity inputs, pricing section (COGS / Profit / Retail Price with mutual recalculation), "Generate Preview" button, "Generate Punch Box" submit button.
- Pricing computation client-side using `computeRetailPrice` utility (mirrors `src/services/retailPricing.ts`).
- "Generate Preview" calls `downloadPunchBoxHtml` from T9 utility.
- "Generate Punch Box" triggers client-side validation (AC3.6), then calls `createPunchBox` from T6; on success navigates to `/admin/bundles` with success snackbar; on error shows inline error.
- Reads `?futurePartyId=` query param and passes it to the create call.

**Depends on:** T6, T9

---

### T8 — AdminPunchBoxEditPage: pre-populated view/edit page

**Status:** `[x]`
**Agent:** frontend-engineer
**Requirements:** R_PREVIEW (ACPV.1–ACPV.7), ACHTML.1–ACHTML.5
**Design ref:** design.md §7.4, §9

Create `src/pages/admin/AdminPunchBoxEditPage.tsx`:
- On mount: call `getPunchBoxDetail(publicId)` to load data; show loading spinner while fetching; show "Punch box not found" with link to `/admin/bundles` on 404.
- Same two-column layout as builder, pre-populated from fetched data.
- Size displayed as read-only chip (not editable post-creation).
- Quantity inputs and product selection: editable when status = ASSIGNED; read-only when ORDERED.
- On quantity change + blur (or Enter): call `patchPunchBoxItem`; update local state from returned aggregate.
- "Generate Preview" button: calls `downloadPunchBoxHtml` from T9.
- "Mark as Ordered" button (ASSIGNED only): shows confirmation dialog matching AC5.2–AC5.3; on confirm calls `orderPunchBox`; on success navigates to `/admin/bundles` with success snackbar.

**Depends on:** T6, T9

---

### T9 — HTML Preview generation utility

**Status:** `[x]`
**Agent:** frontend-engineer
**Requirements:** R_HTML (ACHTML.1–ACHTML.5)
**Design ref:** design.md §9

Create `src/utils/punchBoxHtml.ts`:
- Export `PunchBoxHtmlData` interface (design.md §9).
- Export `generatePunchBoxHtml(data: PunchBoxHtmlData): string` — returns a complete, self-contained HTML string with inline CSS (no external dependencies). The HTML must include: company name heading, public ID (or "Draft"), slot count, product table (name + quantity), pricing summary (Total COGS / Profit / Retail Price in USD).
- Export `downloadPunchBoxHtml(data: PunchBoxHtmlData): void` — creates a `Blob`, uses `URL.createObjectURL`, programmatically clicks an `<a download="punch-box-preview.html">` anchor, then revokes the URL.
- No HTTP calls in either function.

**Depends on:** nothing (pure utility, no API dependency)

---

### T10 — AdminFuturePartiesPage: punch box action buttons

**Status:** `[x]`
**Agent:** frontend-engineer
**Requirements:** R1 (AC1.1–AC1.5)
**Design ref:** design.md §7.5

Update `src/pages/admin/AdminFuturePartiesPage.tsx` (or its sub-components):
- Update `AdminFutureParty` type usage to include `linkedPunchBoxId` and `linkedPunchBoxPublicId` (from T6).
- Actions column logic: if `linkedPunchBoxId === null`, show "Generate Punch Box" icon button (distinct icon, tooltip "Generate Punch Box", navigates to `/admin/punch-box/new?futurePartyId=<id>`). If `linkedPunchBoxId !== null`, show "View Punch Box" icon button (VisibilityIcon or similar, tooltip "View Punch Box", navigates to `/admin/punch-box/<linkedPunchBoxPublicId>`).
- These punch box action buttons appear regardless of whether a bundle is linked. Bundle action buttons remain unchanged.

**Depends on:** T6, T13

---

### T11 — AdminBundlesPage: merge punch boxes, add Type column, View icon, Mark as Ordered

**Status:** `[x]`
**Agent:** frontend-engineer
**Requirements:** R6 (AC6.1–AC6.10), R5 (AC5.2–AC5.8)
**Design ref:** design.md §7.6

Update `src/pages/admin/AdminBundlesPage.tsx`:
- Parallel-fetch `GET /admin/api/bundles` and `GET /admin/api/punch-boxes` on mount; merge and sort by `createdAt` desc into a unified `BundlesPageRow[]` (design.md §7.6).
- Add "Type" column: "Bundle" or "Punch Box".
- Punch box rows: show "View" icon button navigating to `/admin/punch-box/<publicId>`; show "Mark as Ordered" button if status = ASSIGNED; show read-only status chip if ORDERED.
- "Mark as Ordered" triggers confirmation dialog (design.md §7.6); on confirm calls `orderPunchBox`; on success updates local state row to ORDERED.
- Expanded inline detail for punch box rows: public ID, slot count, COGS, profit, retail price, created date, linked future party email if any, items list (name, SKU, quantity).
- Bundle rows: unchanged behaviour.

**Depends on:** T6, T13

---

### T12 — AdminOrdersPage: merge ORDERED punch boxes, add Type + Slot Count columns

**Status:** `[x]`
**Agent:** frontend-engineer
**Requirements:** R7 (AC7.1–AC7.7)
**Design ref:** design.md §7.7

Update `src/pages/admin/AdminOrdersPage.tsx`:
- Parallel-fetch `GET /admin/api/orders` and `GET /admin/api/punch-boxes` on mount; filter punch boxes to ORDERED client-side; merge and sort by `createdAt` desc.
- Add "Type" column: "Order" or "Punch Box".
- Add "Slot Count" column: slot count for punch boxes, "—" for orders.
- Status filter: "ORDERED" shows both; other specific status filters hide punch boxes; no filter shows all.
- Punch box rows: non-interactive (no expand, no status change, AC7.7).

**Depends on:** T6

---

## Layer 5 — Routing

### T13 — Add punch box routes to App.tsx; add nav link if appropriate

**Status:** `[x]`
**Agent:** frontend-engineer
**Requirements:** R2, R_PREVIEW
**Design ref:** design.md §7.1

In `src/App.tsx`:
- Add `<Route path="/admin/punch-box/new" element={<AdminPunchBoxBuilderPage />} />` inside the admin guard.
- Add `<Route path="/admin/punch-box/:publicId" element={<AdminPunchBoxEditPage />} />` inside the admin guard.
- Ensure `/admin/punch-box/new` is declared before `/admin/punch-box/:publicId` to prevent "new" from being matched as a publicId.
- If `AdminNav.tsx` has a nav link for "Bundles", consider whether a separate "Punch Boxes" nav entry is needed (builder is accessed from the Future Parties page, not as a top-level nav item — so a separate nav link is likely not needed; confirm with design intent).

**Depends on:** T7, T8

---

## Dependency Graph Summary

```
T1  (migration)
 ├─→ T2  (repository)
 │    └─→ T3  (routes)
 │         └─→ T5  (register in app.ts)
 └─→ T4  (future parties DTO)
      └─→ T5

T3, T4 → T6  (frontend API layer)
T9         (no deps — pure utility)

T6, T9  → T7  (builder page)
T6, T9  → T8  (edit page)
T6      → T10 (future parties page) — also needs T13
T6      → T11 (bundles page) — also needs T13
T6      → T12 (orders page)
T7, T8  → T13 (routing)
T13     → T10, T11 (pages that navigate to punch box routes)
```

### Parallelism notes

- T2 and T4 can run in parallel after T1.
- T3 and T4 feed into T5 — T5 runs after both.
- T9 can start immediately (no dependencies).
- T7 and T8 can run in parallel after T6 and T9.
- T10, T11, T12 can run in parallel after T6 (T10 and T11 also need T13 for navigation links; implement routing stubs in T13 early if needed).
