# FEAT-006 Analytics & Offline Fair Import — Tasks

**Status:** In Progress
**Date:** 2026-09-13
**Requirements:** `specs/analytics/requirements.md`
**Design:** `specs/analytics/design.md`

---

## Task Graph

```
T6 (deps install) ──► T1 (migration) ──► T2 (offline fair repo + routes)
                                    └──► T3 (online analytics + inventory routes)
                                              T2 + T3 ──► T4 (frontend: import UI)
                                              T2 + T3 ──► T5 (frontend: dashboard redesign)
```

---

## T6 — Backend: Install xlsx + multer dependencies

**Status:** [!] blocked — requires shell execution (npm install); run these commands manually:
```
cd /Users/chaoqu90/work/SmallGiftCompany_chao/backend-node
npm install --save xlsx
npm install --save multer
npm install --save-dev @types/multer
```
**Agent:** backend-engineer
**Requirements:** design.md §G
**Files to modify:** `backend-node/package.json`

Tasks:
- Move `xlsx` from `devDependencies` to `dependencies` (`npm install --save xlsx`)
- Install `multer` and `@types/multer` (`npm install --save multer && npm install --save-dev @types/multer`)
- Verify `npm run build` passes

---

## T1 — Backend: DB Migration 011

**Status:** [x] completed — file written; build verification pending T6 shell commands
**Agent:** backend-engineer
**Depends on:** T6
**Requirements:** R-AF-4, design.md §A.3, §A.4, §E.1
**Files to create:** `backend-node/migrations/011_offline_fair.ts`

Tasks:
- Create `offline_fair` table (id, name, fair_date, location, notes, created_at, updated_at)
- Create `offline_fair_sale` table (id, offline_fair_id FK RESTRICT, product_id FK SET NULL, sku_snapshot, product_name_snapshot, quantity_sold SMALLINT CHECK >0, unit_price, line_total, notes, created_at)
- Add CHECK constraints on `offline_fair_sale` (quantity_sold > 0, unit_price >= 0, line_total >= 0)
- Add `set_updated_at` trigger on `offline_fair.updated_at` (same pattern as existing tables)
- Add indexes: `idx_offline_fair_fair_date ON offline_fair(fair_date DESC)`, `idx_offline_fair_sale_fair_id ON offline_fair_sale(offline_fair_id)`, `idx_offline_fair_sale_product_id ON offline_fair_sale(product_id) WHERE product_id IS NOT NULL`
- Write `down()` function (drop tables in reverse order)
- Verify `npm run build` passes

---

## T2 — Backend: Offline Fair Repository + Routes

**Status:** [x] completed — files written; build verification pending T6 shell commands
**Agent:** backend-engineer
**Depends on:** T1
**Requirements:** R-AF-1 through R-AF-5, R-AD-1 through R-AD-3, design.md §A, §C.1, §C.2, §C.3, §F
**Files to create:**
- `backend-node/src/repositories/offlineFairs.ts`
- `backend-node/src/routes/admin/offline-fairs.ts`
**Files to modify:**
- `backend-node/src/types/entities.ts` (add OfflineFairRow, OfflineFairSaleRow)
- `backend-node/src/types/dtos.ts` (add analytics DTO types)
- `backend-node/src/app.ts` (register router)

Tasks:
- Add `OfflineFairRow` and `OfflineFairSaleRow` interfaces to `entities.ts`
- Add DTO types for offline fair analytics responses to `dtos.ts`
- Implement repository functions in `offlineFairs.ts`:
  - `insertFair(name, fairDate)` — INSERT into offline_fair, return row
  - `insertSaleRows(fairId, rows[])` — bulk INSERT into offline_fair_sale
  - `updateInventory(updates: { productId, newQty }[])` — bulk UPDATE product.inventory_quantity
  - `listFairs()` — SELECT all ordered by fair_date DESC
  - `findFairById(id)` — SELECT single fair, 404-safe
  - `getFairAnalytics(id)` — aggregate query: totalUnitsSold, grossIncome, netIncome (live cog_adjusted join), topByQuantity (top 5 by sku_snapshot), topByProfit (top 5)
  - `lookupSkus(skus: string[])` — SELECT products WHERE sku = ANY(...), return map of sku → product row
- Implement `offline-fairs.ts` router:
  - `POST /import` with multer memory storage (5 MB limit), multipart fields: name, date, file
  - Parse xlsx first sheet, locate sku + remaining_inventory columns (case-insensitive)
  - Validate all rows (empty SKU, non-numeric/negative remaining_inventory)
  - Batch lookup all SKUs; collect unknown SKU errors
  - Return HTTP 422 with `{ type, title, status, errors: [{ row, message }] }` if any validation errors
  - Compute sold_qty per SKU; collect anomaly warnings (remaining > current → sold_qty = 0, no inventory update)
  - Execute sql.begin() transaction: INSERT offline_fair → INSERT offline_fair_sale rows (sold_qty > 0) → UPDATE product inventory (no anomalies)
  - Return HTTP 201 with summary: fairId, fairName, fairDate, saleRowsCreated, skusProcessed, inventoryUpdated, warnings[]
  - `GET /` — list fairs ordered by fair_date DESC
  - `GET /:id/analytics` — return analytics for fair; HTTP 404 if not found
- Apply `basicAuth` middleware at router level
- Register router in `app.ts` as `/admin/api/offline-fairs`
- Verify `npm run build` passes

---

## T3 — Backend: Online Analytics + Inventory Routes

**Status:** [x] completed — files written; build verification pending T6 shell commands
**Agent:** backend-engineer
**Depends on:** T1
**Requirements:** R-AO-1 through R-AO-4, R-AI-1 through R-AI-3, design.md §B, §C.4, §C.5, §F
**Files to create:**
- `backend-node/src/repositories/analytics.ts`
- `backend-node/src/routes/admin/analytics.ts`
**Files to modify:**
- `backend-node/src/types/dtos.ts` (add online analytics + inventory DTO types if not already done by T2)
- `backend-node/src/app.ts` (register router)

Tasks:
- Implement repository functions in `analytics.ts`:
  - `getOnlineAnalytics(dateFrom: string, dateTo: string)` — queries joining customer_order + order_line_item + generated_bundle_item; includes only orders with status IN ('CONFIRMED','SHIPPED','FULFILLED','COMPLETED'); date range applied to customer_order.created_at (dateFrom 00:00:00 UTC, dateTo 23:59:59 UTC); returns totalUnitsSold, grossIncome, netIncome, topByUnits (top 5 by product_id + sku_snapshot), topByProfit (estimated, prorated equally among bundle slots, label estimatedProfit)
  - `getInventoryInsights()` — returns: lowStock (active products with inventory_quantity <= 10, sorted ASC, up to 10, urgency CRITICAL/VERY_LOW/LOW), fastMoving (combined online + offline units sold last 30 days, top 10 by product_id)
- Implement `analytics.ts` router:
  - `GET /online?dateFrom=&dateTo=` — validate both params present and valid ISO dates, dateFrom <= dateTo (HTTP 400 if not); call repo; return DTO
  - `GET /inventory` — call repo; return DTO with lowStockThreshold: 10, fastMovingWindowDays: 30
- Apply `basicAuth` middleware at router level
- Register router in `app.ts` as `/admin/api/analytics`
- Note: there is already a public `/api/analytics` router registered; the new router is at `/admin/api/analytics` — no collision
- Verify `npm run build` passes

---

## T4 — Frontend: Offline Fair Import UI

**Status:** [x] completed — files written; build verification pending Recharts install
**Agent:** frontend-engineer
**Depends on:** T2, T3
**Requirements:** R-AF-1 through R-AF-5, design.md §D.2, §D.3
**Files to create:**
- `frontend/src/pages/admin/OfflineFairImportForm.tsx`
**Files to modify:**
- `frontend/src/api/admin.ts` (add importOfflineFair, listOfflineFairs, getOfflineFairAnalytics, getOnlineAnalytics, getInventoryInsights methods + DTO types)

Tasks:
- Add DTO interfaces to `admin.ts`:
  - `OfflineFairImportResult` (fairId, fairName, fairDate, saleRowsCreated, skusProcessed, inventoryUpdated, warnings)
  - `OfflineFairListItem` (id, name, fairDate, createdAt)
  - `OfflineFairAnalytics` (fairId, fairName, fairDate, totalUnitsSold, grossIncome, netIncome, topByQuantity[], topByProfit[])
  - `OnlineAnalytics` (dateFrom, dateTo, totalUnitsSold, grossIncome, netIncome, topByUnits[], topByProfit[])
  - `InventoryInsights` (lowStock[], fastMoving[], lowStockThreshold, fastMovingWindowDays)
- Add API methods to `adminApi`:
  - `importOfflineFair(auth, formData)` — uses native `fetch` (NOT adminRequest) with Authorization header, FormData body (browser sets multipart boundary); POST /admin/api/offline-fairs/import
  - `listOfflineFairs(auth)` — GET /admin/api/offline-fairs
  - `getOfflineFairAnalytics(auth, id)` — GET /admin/api/offline-fairs/:id/analytics
  - `getOnlineAnalytics(auth, dateFrom, dateTo)` — GET /admin/api/analytics/online?dateFrom=&dateTo=
  - `getInventoryInsights(auth)` — GET /admin/api/analytics/inventory
- Create `OfflineFairImportForm.tsx` component:
  - Three fields: Fair Name (text, required), Fair Date (date picker, required), File Upload (accept=".xlsx" only)
  - Client-side validation: all fields required; non-.xlsx file rejected immediately with "Only .xlsx files are accepted."
  - On submit: show loading indicator; call `adminApi.importOfflineFair`
  - On success: display summary (fair name, date, saleRowsCreated, skusProcessed, inventoryUpdated); if warnings[] non-empty show in collapsible section below success message
  - On server error: display error message(s) inline; do NOT navigate away — admin can retry
  - On HTTP 422: parse `errors` array and display each row-level error
- Verify `npm run build` in frontend directory passes

---

## T5 — Frontend: Admin Dashboard Redesign

**Status:** [x] completed — files written; build verification pending Recharts install
**Agent:** frontend-engineer
**Depends on:** T2, T3 (and T4 for OfflineFairImportForm component)
**Requirements:** R-AD-1 through R-AD-3, R-AO-1 through R-AO-4, R-AI-1 through R-AI-3, design.md §D
**Files to modify:**
- `frontend/src/pages/admin/AdminDashboardPage.tsx`
**Files to create:**
- `frontend/src/pages/admin/OfflineFairAnalyticsSection.tsx`
- `frontend/src/pages/admin/OnlineAnalyticsSection.tsx`
- `frontend/src/pages/admin/InventoryInsightsSection.tsx`

Tasks:
- Install Recharts: `npm install recharts` (and `npm install --save-dev @types/recharts` if needed)
- Restructure `AdminDashboardPage.tsx` into 4 tabs (MUI Tabs recommended):
  - Tab 1 "Overview" — preserve existing content (Finder Completions, Bundle Views, Product Coverage table)
  - Tab 2 "Offline Fair" — `OfflineFairImportForm` + `OfflineFairAnalyticsSection`
  - Tab 3 "Online" — `OnlineAnalyticsSection`
  - Tab 4 "Inventory" — `InventoryInsightsSection`
- Implement `OfflineFairAnalyticsSection.tsx`:
  - Dropdown (MUI Select) populated with all fairs from `listOfflineFairs`; label format: `{fair_name} — {Month D, YYYY}`
  - If no fairs: display "No fairs recorded yet. Import a fair to get started."
  - If fairs exist: auto-select most recent on load; fetch analytics on selection change
  - Display metrics cards: Total Products Sold, Gross Income ($X,XXX.XX), Net Income ($X,XXX.XX)
  - Display two top-5 ranked lists (tables): top by quantity sold, top by profit
  - If no sale rows: display "No sales recorded for this fair."
- Implement `OnlineAnalyticsSection.tsx`:
  - Date range control: presets (Last 30 days default, Last 90 days, Last 12 months) + Custom (two date pickers)
  - Custom validation: if dateFrom > dateTo show "Start date must be before end date"; do not submit
  - Auto-fetch on preset/valid custom date change
  - Display metrics cards: Total Units Sold, Gross Income, Net Income
  - Display two top-5 ranked lists: top by units sold, top by estimated profit (label "estimated profit" clearly)
  - If no qualifying orders: display "No orders in this period."
- Implement `InventoryInsightsSection.tsx`:
  - Auto-fetch on tab load
  - "Refresh" button to re-fetch on demand (no auto-timer)
  - Low Stock list: show up to 10 products with inventory_quantity <= 10; columns: name, SKU, qty, urgency badge (CRITICAL=red, VERY_LOW=orange, LOW=yellow); products with 0 units at top + red highlight
  - Fast Moving list: show up to 10 products; columns: name, SKU, units sold (last 30 days), current inventory qty
  - Empty states: "All products are well-stocked." / "No sales recorded in the last 30 days."
- Verify `npm run build` in frontend directory passes

---

## Completion Checklist

- [!] T6 — BLOCKED: run `npm install --save xlsx multer && npm install --save-dev @types/multer` in backend-node/
- [x] T1 — Migration 011 created (offline_fair + offline_fair_sale) — pending build after T6
- [x] T2 — Offline fair repo + routes + app.ts registration — pending build after T6
- [x] T3 — Online analytics + inventory repo + routes + app.ts registration — pending build after T6
- [x] T4 — Frontend import UI + API client extensions — pending build after Recharts install
- [x] T5 — Admin dashboard restructured with 4 tabs + 3 new sections — pending build after Recharts install
