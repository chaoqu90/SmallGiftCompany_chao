# Analytics & Offline Fair Import — Requirements

**Feature ID:** FEAT-006 (analytics)
**Status:** Approved for implementation
**Date:** 2026-09-13
**Owner:** Product Manager

---

## Overview

This feature adds three capabilities to the admin panel:

1. **Offline Fair Import** — admin uploads an Excel sheet after a fair; the system records what was sold and updates product inventory.
2. **Analytics Dashboard** — two sections: Offline Fair analytics (per fair) and Online Shopping analytics (per date range).
3. **Inventory Insights** — always-visible panel showing low-stock products and fast-moving products.

All functionality is admin-only, protected by existing `basicAuth` middleware.

---

## R-AF — Offline Fair Import

### R-AF-1: Excel Upload UI

**User story:** As an admin, I want to upload an Excel file after a fair, enter the fair's name and date, so that the system records all sales from that event without manual data entry per product.

**Acceptance criteria:**

- WHEN the admin navigates to the "Offline Fairs" tab of the admin dashboard, THEN the system SHALL display an import form with three fields: Fair Name (text, required), Fair Date (date picker, required), and File Upload (accepts `.xlsx` only).
- WHEN the admin submits the form without filling all required fields, THEN the system SHALL display an inline validation error on each missing field and SHALL NOT submit the request.
- WHEN the admin selects a file with an extension other than `.xlsx`, THEN the system SHALL reject it immediately in the browser with the error "Only .xlsx files are accepted."
- WHEN the form is valid and submitted, THEN the system SHALL show a loading indicator while the import is processing.
- WHEN the import is accepted by the server, THEN the system SHALL display a success summary (see R-AF-5).
- WHEN the import is rejected by the server, THEN the system SHALL display the server's error message(s) without navigating away from the form, so the admin can correct and retry.

### R-AF-2: File Parsing and SKU Validation

**User story:** As an admin, I want the system to validate every row in my Excel file before committing anything, so that typos in SKUs are surfaced as actionable errors rather than silently creating bad data.

**Acceptance criteria:**

- WHEN the server receives the uploaded file, THEN the system SHALL parse the first sheet of the workbook.
- WHEN parsing the sheet, THEN the system SHALL expect a header row followed by data rows. The system SHALL locate a column named exactly `sku` (case-insensitive) and a column named exactly `remaining_inventory` (case-insensitive). Column order does not matter.
- WHEN either required column header is missing, THEN the system SHALL return HTTP 422 with the error "Required columns not found: [list of missing column names]." No records SHALL be committed.
- WHEN a data row has an empty `sku` cell, THEN the system SHALL return HTTP 422 with a row-level error identifying the row number (1-indexed, excluding the header row) and the message "SKU is empty."
- WHEN a data row has a non-numeric or negative `remaining_inventory` value, THEN the system SHALL return HTTP 422 with a row-level error identifying the row number and the message "remaining_inventory must be a non-negative integer."
- WHEN all rows parse without format errors, THEN the system SHALL look up every SKU against the `product` table. WHEN any SKU is not found, THEN the system SHALL return HTTP 422 with a row-level error for each unknown SKU: "SKU '{value}' not found in product catalog." No records SHALL be committed.
- WHEN all SKUs are valid, THEN the system SHALL proceed to sale computation (R-AF-3).
- WHEN the Excel file is empty (no data rows), THEN the system SHALL return HTTP 422 with the error "The uploaded file contains no data rows."

### R-AF-3: Sale Quantity Computation

**User story:** As an admin, I want the system to automatically compute how many units were sold at the fair based on before-and-after inventory counts, so I do not have to calculate sold quantities manually.

**Acceptance criteria:**

- FOR each SKU in the uploaded file, THEN the system SHALL compute: `sold_qty = product.inventory_quantity (current) - remaining_inventory (from file)`.
- WHEN `sold_qty` is greater than zero, THEN the system SHALL treat this as a normal sale and record it.
- WHEN `sold_qty` equals zero, THEN the system SHALL skip creating a sale row for that SKU (inventory did not change). The SKU SHALL still be included in the inventory update (R-AF-4).
- WHEN `sold_qty` is negative (the file shows more remaining inventory than the database holds — a data anomaly), THEN the system SHALL treat `sold_qty` as 0 and SHALL include a per-SKU warning in the response: "SKU '{value}': remaining_inventory ({file_value}) exceeds current inventory ({db_value}). Sold quantity set to 0; inventory not changed for this SKU."
- WHEN all SKUs produce `sold_qty = 0` (no sales to record), THEN the system SHALL still create the `offline_fair` row and SHALL return a success response with a note that no sale rows were created.

### R-AF-4: Persistence

**User story:** As an admin, I want the import to atomically save the fair record, all sale lines, and updated inventory counts, so that the database is never left in a half-imported state.

**Acceptance criteria:**

- WHEN the system is ready to persist, THEN it SHALL execute the following in a single database transaction:
  1. INSERT one row into `offline_fair` with `name`, `fair_date` from the form fields. `location` and `notes` are not set by import (remain NULL).
  2. For each SKU where `sold_qty > 0`: INSERT one row into `offline_fair_sale` with:
     - `offline_fair_id` = the newly created fair's ID
     - `product_id` = the product's database ID
     - `sku_snapshot` = the product's current `sku`
     - `product_name_snapshot` = the product's current `name`
     - `unit_price` = the product's current `retail_price` (snapshot at import time)
     - `quantity_sold` = `sold_qty`
     - `line_total` = `unit_price * quantity_sold` (computed by the server, stored explicitly)
  3. For each SKU where `sold_qty >= 0` (i.e., no anomaly): UPDATE `product.inventory_quantity` to the `remaining_inventory` value from the file. For SKUs flagged with negative `sold_qty` (anomaly warning), do NOT update their inventory.
- WHEN any step in the transaction fails (database error), THEN the system SHALL roll back the entire transaction and return HTTP 500 with a generic error. No partial data SHALL be written.
- WHEN the transaction succeeds, THEN the system SHALL return HTTP 201 with the success summary (R-AF-5).

### R-AF-5: Success Summary and Idempotency

**User story:** As an admin, I want a clear confirmation after import so I know exactly what was recorded and whether any warnings need my attention.

**Acceptance criteria:**

- WHEN the import succeeds, THEN the system SHALL return a JSON summary containing:
  - `fairId`: the ID of the newly created `offline_fair` row
  - `fairName`: the name as submitted
  - `fairDate`: the date as submitted
  - `saleRowsCreated`: integer count of `offline_fair_sale` rows inserted
  - `skusProcessed`: integer count of SKUs in the file (excluding empty rows)
  - `inventoryUpdated`: integer count of products whose inventory was updated
  - `warnings`: array of per-SKU warning strings (empty array if none)
- WHEN the admin imports the same fair name and date a second time, THEN the system SHALL create a new `offline_fair` row (no uniqueness constraint on name + date). This is by design — the admin may correct a previous import by running a second one, or there may be two events with the same name on the same day.
- WHEN the success summary includes one or more warnings, THEN the frontend SHALL display the warnings in a collapsible section below the success message, so the admin is aware of anomalies but the import is not blocked.

---

## R-AD — Analytics Dashboard: Offline Fair Section

### R-AD-1: Fair Selector

**User story:** As an admin, I want to select a specific fair from a dropdown and see its analytics, so I can review each event's performance individually.

**Acceptance criteria:**

- WHEN the admin opens the "Offline Fair Analytics" section, THEN the system SHALL display a dropdown populated with all fairs from the `offline_fair` table, ordered by `fair_date` descending (most recent first).
- WHEN the list is empty (no fairs have been imported), THEN the system SHALL display the message "No fairs recorded yet. Import a fair to get started."
- WHEN the page loads and at least one fair exists, THEN the system SHALL auto-select the most recent fair and load its analytics without requiring an additional click.
- WHEN the dropdown entry label, THEN it SHALL show: `{fair_name} — {fair_date formatted as Month D, YYYY}`.
- WHEN the admin changes the selected fair, THEN the system SHALL reload the analytics data for the newly selected fair.

### R-AD-2: Offline Fair Metrics

**User story:** As an admin, I want to see total units sold, gross income, and net income for a selected fair, so I can evaluate the financial result of each event.

**Acceptance criteria:**

- WHEN a fair is selected, THEN the system SHALL display the following summary metrics:
  - **Total products sold** — `SUM(quantity_sold)` across all `offline_fair_sale` rows for the fair.
  - **Gross income** — `SUM(line_total)` across all `offline_fair_sale` rows for the fair.
  - **Net income** — `SUM(line_total) - SUM(product.cog_adjusted * quantity_sold)` for the fair. COGS is computed using the live `product.cog_adjusted` value joined via `product_id`. WHEN `product_id` is NULL (product deleted), THEN that row's COGS contribution SHALL be treated as 0 and SHALL NOT be subtracted from gross income.
- WHEN a fair has zero sale rows (all sold quantities were 0), THEN all three metrics SHALL display as 0.
- WHEN metrics are displayed, THEN currency values SHALL be shown formatted to two decimal places with a dollar sign (e.g., `$1,234.56`).

### R-AD-3: Offline Fair Top Products Charts

**User story:** As an admin, I want to see which products sold best at each fair by both quantity and profit, so I can make stocking and pricing decisions for future events.

**Acceptance criteria:**

- WHEN a fair is selected, THEN the system SHALL display two ranked lists, each showing up to 5 products:
  1. **Top products by quantity sold** — ordered by `SUM(quantity_sold)` DESC per product (grouped by `sku_snapshot`). Columns: product name, SKU, quantity sold.
  2. **Top products by profit** — ordered by `SUM(line_total) - SUM(cog_adjusted * quantity_sold)` DESC per product. Columns: product name, SKU, profit. WHEN `product_id` is NULL, THEN profit for that row SHALL be computed using COGS = 0.
- WHEN fewer than 5 distinct products were sold, THEN the list SHALL show only as many rows as exist.
- WHEN a fair has no sale rows, THEN both lists SHALL display "No sales recorded for this fair."

---

## R-AO — Analytics Dashboard: Online Shopping Section

### R-AO-1: Date Range Selector

**User story:** As an admin, I want to filter online order analytics by date range using presets or a custom range, so I can quickly review common periods without always entering custom dates.

**Acceptance criteria:**

- WHEN the admin opens the "Online Shopping Analytics" section, THEN the system SHALL display a date range control with three preset options and one custom option:
  - Last 30 days (default on page load)
  - Last 90 days
  - Last 12 months
  - Custom (reveals two date pickers: Start Date and End Date)
- WHEN "Last 30 days" is selected, THEN `date_from` SHALL be computed as today minus 30 calendar days and `date_to` SHALL be today's date (inclusive).
- WHEN "Last 90 days" is selected, THEN `date_from` SHALL be today minus 90 calendar days.
- WHEN "Last 12 months" is selected, THEN `date_from` SHALL be today minus 365 calendar days.
- WHEN "Custom" is selected and the admin sets `date_from` later than `date_to`, THEN the system SHALL display an inline validation error "Start date must be before end date" and SHALL NOT submit the query.
- WHEN the date range changes (preset or valid custom), THEN the system SHALL reload the analytics data automatically.

### R-AO-2: Online Order Status Filter

**User story:** As an admin, I want analytics to only count orders that represent real completed sales, excluding cancelled and refunded orders, so that the metrics reflect actual revenue.

**Acceptance criteria:**

- WHEN computing online analytics, THEN the system SHALL include only `customer_order` rows where `status` is one of: `CONFIRMED`, `SHIPPED`, `FULFILLED`, or `COMPLETED`.
- WHEN computing online analytics, THEN the system SHALL exclude orders with status `PENDING`, `SUBMITTED`, `CANCELLED`, or `REFUNDED`.
- The status filter SHALL be applied server-side and is not configurable from the admin UI (it is a fixed business rule).

### R-AO-3: Online Metrics

**User story:** As an admin, I want to see total units sold, gross income, and net income for online orders in the selected period, so I can evaluate the health of the online channel.

**Acceptance criteria:**

- WHEN a date range is selected, THEN the system SHALL display the following summary metrics derived from qualifying orders (R-AO-2) whose `customer_order.created_at` falls within [`date_from` 00:00:00 UTC, `date_to` 23:59:59 UTC]:
  - **Total units sold** — computed as `SUM(order_line_item.quantity * generated_bundle_item.quantity_per_bag)` across all qualifying orders. This counts the total number of individual product units that left the warehouse.
  - **Gross income** — `SUM(order_line_item.line_total)` across all qualifying orders.
  - **Net income** — `SUM(order_line_item.line_total) - SUM(generated_bundle_item.cost_snapshot * order_line_item.quantity * generated_bundle_item.quantity_per_bag)` across all qualifying orders. The `cost_snapshot` stored in `generated_bundle_item` at order time is the authoritative COGS for online orders (snapshot immutability principle).
- WHEN there are no qualifying orders, THEN all three metrics SHALL display as 0.
- WHEN metrics are displayed, THEN currency values SHALL be formatted to two decimal places with a dollar sign.

### R-AO-4: Online Top Products Charts

**User story:** As an admin, I want to see which products drove the most units and profit in the online channel, so I can identify bestsellers.

**Acceptance criteria:**

- WHEN a date range is selected, THEN the system SHALL display two ranked lists, each showing up to 5 products:
  1. **Top products by units sold** — `SUM(order_line_item.quantity * generated_bundle_item.quantity_per_bag)` per product (`generated_bundle_item.product_id`), ordered DESC. Columns: product name (from `generated_bundle_item.product_name_snapshot`), SKU (from `sku_snapshot`), units sold.
  2. **Top products by profit** — `SUM((order_line_item.line_total / bundle_item_count_in_bundle) - generated_bundle_item.cost_snapshot * order_line_item.quantity * generated_bundle_item.quantity_per_bag)` per product, ordered DESC. Columns: product name, SKU, profit.
     - **Revenue apportionment:** Because `order_line_item.line_total` covers an entire bundle, per-product revenue is prorated by dividing the line total equally among the number of distinct `generated_bundle_item` slots in that bundle. This is an approximation and should be labeled in the UI as "estimated profit."
- WHEN fewer than 5 distinct products appear in the qualifying orders, THEN the list SHALL show only as many rows as exist.
- WHEN there are no qualifying orders, THEN both lists SHALL display "No orders in this period."

---

## R-AI — Inventory Insights Section

### R-AI-1: Low Inventory Products

**User story:** As an admin, I want to see which products are running low on stock, so I can proactively reorder before items run out.

**Acceptance criteria:**

- WHEN the Inventory Insights section is loaded, THEN the system SHALL display a list of up to 10 active products (`product.active = true`) with the lowest `inventory_quantity`, filtered to only those where `inventory_quantity <= 10` (the low-stock threshold).
- WHEN no active products are at or below the threshold, THEN the system SHALL display "All products are well-stocked."
- WHEN displaying each product in the low-inventory list, THEN the system SHALL show: product name, SKU, current inventory quantity, and an urgency indicator: "Critical" (0 units), "Very Low" (1–3 units), "Low" (4–10 units).
- WHEN `inventory_quantity` is 0, THEN the product SHALL be shown at the top of the list (most urgent first), and its row SHALL be visually highlighted (e.g., red background or badge).
- The low-stock threshold of 10 units is a fixed server-side constant for the initial implementation. It is not configurable from the UI in this version.

### R-AI-2: Fast-Moving Products

**User story:** As an admin, I want to see which products sold the most units in the last 30 days across both channels, so I can anticipate restock needs for popular items.

**Acceptance criteria:**

- WHEN the Inventory Insights section is loaded, THEN the system SHALL display a list of up to 10 products ranked by total units sold in the last 30 calendar days (relative to the current server date at time of request).
- WHEN computing fast-moving products, THEN the system SHALL combine units from both channels:
  - **Online:** `SUM(order_line_item.quantity * generated_bundle_item.quantity_per_bag)` from qualifying orders (status: CONFIRMED, SHIPPED, FULFILLED, COMPLETED) with `customer_order.created_at >= now() - 30 days`.
  - **Offline:** `SUM(offline_fair_sale.quantity_sold)` from fairs with `offline_fair.fair_date >= today - 30 days`.
  - Units are summed per product (matched by `product_id` where available; by `sku_snapshot` where `product_id` is NULL).
- WHEN displaying each product in the fast-moving list, THEN the system SHALL show: product name, SKU, total units sold (last 30 days), and current inventory quantity.
- WHEN no products have sold any units in the last 30 days (across either channel), THEN the system SHALL display "No sales recorded in the last 30 days."
- The 30-day window is fixed and is not configurable from the UI in this version.

### R-AI-3: Inventory Insights Refresh Behavior

**Acceptance criteria:**

- WHEN the admin dashboard page loads, THEN the Inventory Insights section SHALL load its data automatically alongside the other sections.
- WHEN the admin is viewing the dashboard and wants fresh data, THEN the system SHALL provide a "Refresh" button in the Inventory Insights section that re-fetches the data from the server on demand.
- The Inventory Insights section SHALL NOT auto-refresh on a timer (manual refresh only).

---

## Non-Goals (out of scope for this feature)

- Manual per-product data entry for fair sales (only Excel import is supported)
- Editing or deleting `offline_fair` or `offline_fair_sale` records from the UI
- Exporting analytics data to CSV or PDF
- Cross-channel combined analytics (online + offline) on a single chart — each channel is shown separately; only the Inventory Insights fast-moving section combines both channels
- Scheduled snapshot generation for online analytics — all online queries are computed live from existing tables
- Fair location or notes fields (schema supports them, but the import UI and analytics do not surface them in this version)
