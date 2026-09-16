# Analytics & Offline Fair Tracking — Technical Design

**Status:** Approved
**Date:** 2026-09-13
**Scope:** Design only. No migration files or application code.
**Next migration number:** 011
**Requirements:** `specs/analytics/requirements.md`

---

## 0. Context: Existing Schema Summary

The schema relevant to both features:

| Table | Purpose |
|---|---|
| `product` | Catalog items; `sku`, `retail_price`, `cost`, `cog_adjusted`, `inventory_quantity` |
| `generated_bundle` | Each curated gift bag offer; references `budget_tier`, `bundle_template` |
| `generated_bundle_item` | Individual products inside a bundle; stores `product_id`, price snapshots (`cost_snapshot`), `quantity_per_bag` |
| `customer_order` | Online orders; `status`, `subtotal`, `total`, `created_at` |
| `order_line_item` | One row per bundle in an order; stores `unit_price`, `line_total`, `quantity` |
| `analytics_event` | Free-form event log; `bundle_id` is VARCHAR (not FK) to survive bundle deletion |

Key design principles already established in the codebase:

- **Snapshot immutability** — price and name at time of transaction are frozen in snapshot columns; later product edits do not retroactively alter records.
- **Analytics decoupling** — analytics records must survive deletion of the entity they reference; use VARCHAR IDs or nullable FKs with SET NULL, not hard FKs.
- **No computed values stored unless explicitly needed** — `line_total = unit_price * quantity` is stored because it is needed for accounting. Pure derived aggregates belong in views or queries, not the live transaction tables.
- **Server-side COGS authority** — `product.cog_adjusted` (= cost + cog_overhead) is the canonical cost basis. For online orders, `generated_bundle_item.cost_snapshot` is the frozen COGS at order time. For offline fair analytics, live `product.cog_adjusted` is used (no snapshot was taken at fair time, because sales are entered post-event).

---

## A. Offline Fair Tracking

### A.1 Business Context

The business attends physical shopping fairs and sells directly to customers. These sales do not go through the online ordering system. Admin imports an Excel sheet after each fair containing remaining inventory counts. The system derives sold quantities from the difference between current inventory and remaining inventory, records the sales, and updates inventory.

### A.2 Design Decision: Two-Table Model

Two new tables:

1. **`offline_fair`** — one row per event
2. **`offline_fair_sale`** — one row per product sold at a given fair

This is preferable to a single flat table because:
- Fair metadata is written once and shared across all sale rows.
- Queries like "all sales at fair X" or "revenue per fair" are clean without duplication.

### A.3 Table: `offline_fair`

Migration: **011**

```
offline_fair
├── id              BIGSERIAL        PRIMARY KEY
├── name            VARCHAR(200)     NOT NULL          -- e.g. "Eastside Holiday Market 2026"
├── fair_date       DATE             NOT NULL          -- actual date; use start date if multi-day
├── location        VARCHAR(300)     NULL              -- free text; not set by import (future use)
├── notes           TEXT             NULL              -- internal notes; not set by import (future use)
├── created_at      TIMESTAMPTZ      NOT NULL  DEFAULT now()
└── updated_at      TIMESTAMPTZ      NOT NULL  DEFAULT now()
```

**Constraints:**
- No uniqueness constraint on `name` — the admin may legitimately import two events with the same series name in different years, or re-import a corrected version. `id` is the identity key.
- `fair_date` is `DATE` (not `TIMESTAMPTZ`) because an event is identified by its calendar day.
- `location` and `notes` are nullable — not surfaced in the import UI; reserved for future manual entry.

**Indexes:**
```
idx_offline_fair_fair_date  ON offline_fair(fair_date DESC)
```

**Trigger:** `set_updated_at()` on `updated_at` (same pattern as `customer_order`, `cart_item`).

### A.4 Table: `offline_fair_sale`

Migration: **011** (same migration as `offline_fair`)

```
offline_fair_sale
├── id                     BIGSERIAL       PRIMARY KEY
├── offline_fair_id        BIGINT          NOT NULL   FK → offline_fair(id) ON DELETE RESTRICT
├── product_id             BIGINT          NULL       FK → product(id) ON DELETE SET NULL
├── sku_snapshot           VARCHAR(50)     NOT NULL   -- frozen at time of import
├── product_name_snapshot  VARCHAR(100)    NOT NULL   -- frozen at time of import
├── quantity_sold          SMALLINT        NOT NULL   -- CHECK > 0
├── unit_price             NUMERIC(10,2)   NOT NULL   -- product.retail_price at import time
├── line_total             NUMERIC(10,2)   NOT NULL   -- unit_price * quantity_sold (stored explicitly)
├── notes                  TEXT            NULL       -- reserved for future use
└── created_at             TIMESTAMPTZ     NOT NULL   DEFAULT now()
```

**Constraints:**
```sql
CHECK (quantity_sold > 0)
CHECK (unit_price >= 0)
CHECK (line_total >= 0)
```

**Foreign key reasoning:**
- `offline_fair_id → offline_fair(id) ON DELETE RESTRICT` — prevents deleting a fair that has sales; consistent with `order_line_item → customer_order`.
- `product_id → product(id) ON DELETE SET NULL` — sale records survive product deletion (snapshots keep the data intact).

**Why store `line_total` explicitly?** Established pattern from `order_line_item.line_total`. Prevents rounding drift in aggregation and makes the record self-contained.

**Indexes:**
```sql
idx_offline_fair_sale_fair_id    ON offline_fair_sale(offline_fair_id)
idx_offline_fair_sale_product_id ON offline_fair_sale(product_id) WHERE product_id IS NOT NULL
```

### A.5 Relationship to Existing Tables

```
offline_fair  1──* offline_fair_sale *──0..1 product
```

`offline_fair_sale` is entirely separate from `customer_order` and `order_line_item`. The two sales channels produce different record types. They are unified only at the analytics layer via API aggregation, not via database joins.

---

## B. Online Selling Analytics — Live Queries (No Snapshot Table)

### B.1 Design Decision: Real-Time Computed, No Snapshot Table

**Decision:** Online analytics are computed live from existing tables on every dashboard request. The `online_sales_snapshot` table proposed in the earlier draft is **not implemented**.

**Rationale:**
- The user's requirements specify a date-range picker (last 30 days, last 90 days, custom) rather than monthly period snapshots. Live queries naturally support arbitrary date ranges; a snapshot table with fixed periods would require interpolation logic.
- The current order volume is small. Live SQL aggregation across `customer_order`, `order_line_item`, and `generated_bundle_item` is fast enough at the current scale.
- Eliminating the snapshot table removes a periodic job, a deduplication challenge with nullable `product_id`, and a source of staleness confusion.
- **Revisit trigger:** If dashboard queries begin taking more than 2 seconds (measurable via server logs), add a `WHERE created_at >= now() - interval '1 year'` partial index on `customer_order` or switch to a materialized view. This is a future optimization, not an MVP concern.

**Order status filter (fixed business rule):**
- **Included:** `CONFIRMED`, `SHIPPED`, `FULFILLED`, `COMPLETED`
- **Excluded:** `PENDING`, `SUBMITTED`, `CANCELLED`, `REFUNDED`

---

## C. API Endpoints

All endpoints are admin-only, protected by existing `basicAuth` middleware. Path prefix: `/admin/api`.

### C.1 Offline Fair Import

```
POST /admin/api/offline-fairs/import
Content-Type: multipart/form-data
```

**Form fields:**
- `name` (string, required) — fair name
- `date` (string ISO 8601, required) — fair date e.g. `2026-09-01`
- `file` (binary, required) — `.xlsx` file

**Processing pipeline (server-side):**
1. Validate form fields (`name` non-empty, `date` valid ISO date).
2. Parse the first sheet of the workbook using the `xlsx` library (already in `devDependencies`; must be moved to `dependencies` — see Section G).
3. Locate `sku` and `remaining_inventory` column headers (case-insensitive).
4. Validate all data rows (format checks per R-AF-2).
5. Look up all SKUs against the `product` table in a single `WHERE sku = ANY(...)` query.
6. Compute `sold_qty` for each SKU (per R-AF-3).
7. Within a single database transaction: INSERT `offline_fair`, INSERT `offline_fair_sale` rows where `sold_qty > 0`, UPDATE `product.inventory_quantity` for SKUs with no anomaly.
8. Return 201 with success summary JSON (per R-AF-5) or 422 with error array.

**Multipart upload note:** The existing `adminRequest` helper in `frontend/src/api/admin.ts` sets `Content-Type: application/json` when a `body` is present. File uploads MUST NOT use `adminRequest` directly — the frontend should use native `fetch` with a `FormData` body (browser sets `Content-Type: multipart/form-data` with the correct boundary automatically). The backend uses `multer` (or equivalent) middleware to handle the multipart stream. **`multer` is a new dependency** (see Section G).

**Error response shape (HTTP 422):**
```json
{
  "type": "about:validation-error",
  "title": "Import Validation Failed",
  "status": 422,
  "errors": [
    { "row": 3, "message": "SKU 'XYZ-999' not found in product catalog." },
    { "row": 7, "message": "remaining_inventory must be a non-negative integer." }
  ]
}
```

**Success response shape (HTTP 201):**
```json
{
  "fairId": 5,
  "fairName": "Eastside Holiday Market 2026",
  "fairDate": "2026-09-01",
  "saleRowsCreated": 12,
  "skusProcessed": 15,
  "inventoryUpdated": 14,
  "warnings": [
    "SKU 'ABC-001': remaining_inventory (50) exceeds current inventory (45). Sold quantity set to 0; inventory not changed for this SKU."
  ]
}
```

### C.2 List Offline Fairs

```
GET /admin/api/offline-fairs
```

**Response (HTTP 200):**
```json
[
  {
    "id": 5,
    "name": "Eastside Holiday Market 2026",
    "fairDate": "2026-09-01",
    "createdAt": "2026-09-02T10:00:00Z"
  }
]
```

Ordered by `fair_date DESC`. Used to populate the dropdown in the admin dashboard.

### C.3 Offline Fair Analytics

```
GET /admin/api/offline-fairs/:id/analytics
```

**Response (HTTP 200):**
```json
{
  "fairId": 5,
  "fairName": "Eastside Holiday Market 2026",
  "fairDate": "2026-09-01",
  "totalUnitsSold": 85,
  "grossIncome": 1250.00,
  "netIncome": 610.00,
  "topByQuantity": [
    { "sku": "SKU-003", "productName": "Slime Kit", "quantitySold": 18 }
  ],
  "topByProfit": [
    { "sku": "SKU-001", "productName": "Glitter Art Kit", "profit": 112.50 }
  ]
}
```

- `netIncome` = `SUM(line_total) - SUM(p.cog_adjusted * ofs.quantity_sold)` joined via `product_id`. Rows where `product_id IS NULL` contribute 0 COGS.
- `topByQuantity` — up to 5 entries, ordered by `quantity_sold` DESC, grouped by `sku_snapshot`.
- `topByProfit` — up to 5 entries, ordered by `(line_total - cog_adjusted * quantity_sold)` DESC, grouped by `sku_snapshot`. COGS = 0 when `product_id IS NULL`.
- HTTP 404 when `id` does not correspond to a known fair.

### C.4 Online Shopping Analytics

```
GET /admin/api/analytics/online?dateFrom=2026-08-01&dateTo=2026-09-01
```

**Query parameters:**
- `dateFrom` (ISO date string, required) — inclusive start date, UTC midnight
- `dateTo` (ISO date string, required) — inclusive end date, UTC 23:59:59

**Response (HTTP 200):**
```json
{
  "dateFrom": "2026-08-01",
  "dateTo": "2026-09-01",
  "totalUnitsSold": 320,
  "grossIncome": 4800.00,
  "netIncome": 2240.00,
  "topByUnits": [
    { "sku": "SKU-001", "productName": "Glitter Art Kit", "unitsSold": 58 }
  ],
  "topByProfit": [
    { "sku": "SKU-001", "productName": "Glitter Art Kit", "estimatedProfit": 290.00 }
  ]
}
```

- `totalUnitsSold` = `SUM(oli.quantity * gbi.quantity_per_bag)` across qualifying orders.
- `grossIncome` = `SUM(oli.line_total)` across qualifying orders.
- `netIncome` = `SUM(oli.line_total) - SUM(gbi.cost_snapshot * oli.quantity * gbi.quantity_per_bag)`.
- `topByUnits` — up to 5, grouped by `gbi.product_id` + `gbi.sku_snapshot`.
- `topByProfit` — up to 5, estimated as described in R-AO-4 (per-product revenue prorated equally among bundle slots). Label as `estimatedProfit` in the response to be honest about the approximation.
- HTTP 400 when `dateFrom` or `dateTo` is missing, not a valid date, or `dateFrom > dateTo`.

### C.5 Inventory Insights

```
GET /admin/api/analytics/inventory
```

**Response (HTTP 200):**
```json
{
  "lowStock": [
    {
      "productId": 12,
      "sku": "SKU-007",
      "name": "Craft Bead Set",
      "inventoryQuantity": 2,
      "urgency": "VERY_LOW"
    }
  ],
  "fastMoving": [
    {
      "productId": 3,
      "sku": "SKU-001",
      "name": "Glitter Art Kit",
      "unitsSoldLast30Days": 72,
      "inventoryQuantity": 15
    }
  ],
  "lowStockThreshold": 10,
  "fastMovingWindowDays": 30
}
```

- `lowStock` — active products with `inventory_quantity <= 10`, sorted ASC, up to 10.
  - `urgency`: `CRITICAL` (0), `VERY_LOW` (1–3), `LOW` (4–10).
- `fastMoving` — up to 10 products with the highest combined units sold (online + offline) in the last 30 days. Merged by `product_id` where available; by `sku_snapshot` for deleted products.
- `lowStockThreshold` and `fastMovingWindowDays` are returned in the response so the frontend can display them without hardcoding.

---

## D. Admin Dashboard — Frontend Restructure

### D.1 Page Layout

`AdminDashboardPage.tsx` is restructured from its current minimal layout (Finder Completions + Bundle Views + Product Coverage) into a tabbed or accordion layout with four sections:

```
[Tab 1: Overview]     — existing content (Finder Completions, Bundle Views, Product Coverage simulation)
[Tab 2: Offline Fair] — fair selector dropdown + metrics + top products charts
[Tab 3: Online]       — date range picker + metrics + top products charts
[Tab 4: Inventory]    — low stock list + fast-moving list
```

Alternatively, Tabs 2–4 may be implemented as accordion sections on a single scrollable page. The choice is left to the frontend engineer; tabs are recommended for screen real estate management.

### D.2 Key Frontend Components

| Component | Responsibility |
|---|---|
| `OfflineFairImportForm` | Fair name, date, file picker, submit, display warnings/errors |
| `OfflineFairAnalytics` | Dropdown selector + metrics cards + top-5 lists |
| `OnlineAnalytics` | Date range picker + metrics cards + top-5 lists |
| `InventoryInsights` | Low stock list + fast-moving list + refresh button |

### D.3 Admin API Client Extensions

New methods to add to `adminApi` in `frontend/src/api/admin.ts`:

```typescript
// POST /admin/api/offline-fairs/import — multipart upload
importOfflineFair: (auth: string, formData: FormData) => Promise<OfflineFairImportResult>
// Uses native fetch (not adminRequest) to avoid Content-Type override

// GET /admin/api/offline-fairs
listOfflineFairs: (auth: string) => Promise<OfflineFairListItem[]>

// GET /admin/api/offline-fairs/:id/analytics
getOfflineFairAnalytics: (auth: string, id: number) => Promise<OfflineFairAnalytics>

// GET /admin/api/analytics/online?dateFrom=&dateTo=
getOnlineAnalytics: (auth: string, dateFrom: string, dateTo: string) => Promise<OnlineAnalytics>

// GET /admin/api/analytics/inventory
getInventoryInsights: (auth: string) => Promise<InventoryInsights>
```

The `importOfflineFair` function MUST use `fetch` directly (not the `adminRequest` wrapper) to allow the browser to set `Content-Type: multipart/form-data` with the correct boundary. It should still include the `Authorization` header from `authHeader`.

---

## E. Migration Plan

| Migration | Number | Tables Created | Notes |
|---|---|---|---|
| Offline Fair Tracking | **011** | `offline_fair`, `offline_fair_sale` | Additive only |

The `online_sales_snapshot` table (migration 012 in the earlier draft) is **not created**. Online analytics are computed live.

Both offline fair tables are additive — no existing tables are altered.

### E.1 Migration 011 — `offline_fair` and `offline_fair_sale`

The migration should:
1. Create `offline_fair` with all columns, indexes, and the `set_updated_at` trigger.
2. Create `offline_fair_sale` with all columns, constraints, and indexes.
3. Use `ON DELETE RESTRICT` for the `offline_fair_id` FK and `ON DELETE SET NULL` for the `product_id` FK.

---

## F. Backend File Structure

New files to create under `backend-node/src/`:

```
src/
  routes/admin/
    offline-fairs.ts     — POST /import, GET /, GET /:id/analytics
    analytics.ts         — GET /online, GET /inventory
  repositories/
    offlineFairs.ts      — SQL for fair CRUD and analytics queries
    analytics.ts         — SQL for online analytics and inventory insights
  types/
    entities.ts          — add OfflineFairRow, OfflineFairSaleRow (extend existing file)
    dtos.ts              — add request/response DTO types for analytics
```

The new routers are mounted in `src/app.ts` (or equivalent entry point) under `/admin/api/offline-fairs` and `/admin/api/analytics`, protected by `basicAuth`.

---

## G. Dependencies

### `xlsx` — Move from devDependencies to dependencies

`xlsx` (version `^0.18.5`) is currently in `devDependencies` in `backend-node/package.json`. It is used at runtime in `scripts/import-products-xlsx.ts` (a CLI script run locally, not in Lambda). For the new import endpoint, `xlsx` must be available in the Lambda bundle — it must be moved to `dependencies`.

**Action required:** `npm install --save xlsx` (moves the package from devDependencies to dependencies, no version change needed).

### `multer` — New dependency

`multer` is a standard Express middleware for handling `multipart/form-data`. It is not currently in `package.json`.

**Action required:** `npm install --save multer && npm install --save-dev @types/multer`

`multer` should be configured to use memory storage (file buffered in RAM, not written to disk), as Lambda instances have no persistent disk and the files are small (Excel sheets with ~100 rows).

```
multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
```
5 MB file size limit is sufficient for a typical fair inventory sheet.

---

## H. Open Questions (Resolved)

The following questions from the earlier draft have been resolved:

1. **Snapshot trigger** — Resolved: no snapshot table. Online analytics computed live.
2. **Revenue apportionment** — Resolved: per-product revenue is prorated equally among bundle slots. Labeled `estimatedProfit` in the API and UI. See R-AO-4.
3. **Order status filter** — Resolved: CONFIRMED, SHIPPED, FULFILLED, COMPLETED are included. PENDING, SUBMITTED, CANCELLED, REFUNDED are excluded.
4. **Fair entry workflow** — Resolved: Excel import only (no live point-of-sale UI).
5. **Multi-day fairs** — Resolved: `fair_date` remains a single `DATE`. The admin uses the start date for multi-day events. Column can be extended to `fair_end_date` in a future migration if needed.
6. **Unique index on snapshot** — Resolved: snapshot table is not created, so this question is moot.

---

## I. Decisions Not Made Here (Frontend Engineer's Discretion)

- Whether to implement dashboard sections as tabs or accordions.
- Specific MUI component choices (charts library: the project has no existing chart dependency; the engineer may use MUI X Charts, Recharts, or a simple ranked-list table without a chart).
- Exact color coding for the urgency indicators in the low-stock list (CRITICAL / VERY_LOW / LOW).
- Whether to auto-select the most recent fair or leave the dropdown empty on first load (requirements say auto-select if fairs exist).
