# Punch Box — Feature Requirements

**Feature ID:** FEAT-PB
**Spec date:** 2026-09-20
**Last updated:** 2026-09-20 (rev 2 — user corrections applied)
**Author:** Project Manager
**Status:** Draft — awaiting user confirmation

---

## Overview

A "Punch Box" is a fixed multi-slot product package intended for class parties (30, 50, or 70 items). Unlike a generated bundle — which is personalised per child — a punch box is admin-assembled once, sold as a whole unit, and ordered as a block. It can optionally be linked to a Future Party submission. A future party may have both a bundle and a punch box linked simultaneously.

---

## R1 — Future Party Page: Generate Punch Box Entry Point

**User story:**
As an admin, I want "Generate Punch Box" and "View Punch Box" action buttons on the Future Party page, independent of whether a bundle is linked, so that I can start building or navigate to a punch box from any party submission.

### Acceptance Criteria

**AC1.1** WHEN the Future Party list is displayed, THEN each row that has no linked punch box (`linkedPunchBoxId` is null) SHALL display a "Generate Punch Box" icon button (tooltip: "Generate Punch Box") in the Actions column, adjacent to the existing bundle action buttons. This button SHALL appear regardless of whether a bundle is linked to the row.

**AC1.2** WHEN the admin clicks the "Generate Punch Box" button for a row, THEN the system SHALL navigate to `/admin/punch-box/new?futurePartyId=<id>` where `<id>` is the future party's numeric ID.

**AC1.3** WHEN a future party row has a linked punch box (`linkedPunchBoxId` is not null), THEN the row SHALL display a "View Punch Box" icon button (tooltip: "View Punch Box") in place of the "Generate Punch Box" button; clicking it SHALL navigate to `/admin/punch-box/<publicId>`.

**AC1.4** The "Generate Punch Box" and "View Punch Box" buttons are completely independent of the bundle state. A row with a linked bundle MAY still show "Generate Punch Box" (when no punch box is linked) or "View Punch Box" (when a punch box is linked).

**AC1.5** The "Generate Punch Box" button SHALL use a distinct icon (e.g., `Inventory2Icon` or `GridViewIcon`) so it is visually distinguishable from the "Generate Bundle" icon.

---

## R2 — Punch Box Builder Page

**User story:**
As an admin, I want a two-column builder page where I pick products and assign slot quantities and can download an HTML preview, so that I can compose a punch box interactively and share details with a customer before committing.

### Acceptance Criteria

**AC2.1** WHEN the admin navigates to `/admin/punch-box/new` (with or without `?futurePartyId=<id>`), THEN the system SHALL display the Punch Box Builder page with two columns:
- Left column: product table (filterable)
- Right column: configuration panel

**AC2.2** WHEN the builder page loads, THEN the left product table SHALL display only active products, with columns: checkbox (for selection), Name, Retail Price (in USD), and Inventory Quantity; no expandable detail card is required.

**AC2.3** WHEN the admin types in the search field above the product table, THEN the table SHALL filter products by name or SKU, case-insensitively, and update in real time without a network round-trip if products are pre-loaded.

**AC2.4** WHEN the admin uses the category filter (same filter chips as the existing admin products listing), THEN the product table SHALL be filtered to show only the selected categories; if no filter is selected all active products are shown.

**AC2.5** WHEN the admin selects a product checkbox in the left table, THEN that product SHALL appear in the right panel's selected-products list with an editable quantity input (default quantity: 1).

**AC2.6** WHEN the admin unchecks a product's checkbox in the left table, THEN that product SHALL be removed from the right panel's selected-products list.

**AC2.7** WHEN a product is in the selected list and the quantity field is changed, THEN the new value SHALL be reflected immediately in all pricing calculations.

**AC2.8** WHEN the admin attempts to set a quantity below 1, THEN the system SHALL prevent the value from going below 1 (enforce minimum 1 in the input).

**AC2.9** WHEN a product's checkbox is checked, THEN the corresponding table row in the left panel SHALL have a visual highlight to indicate it is selected.

**AC2.10** WHEN the builder page is displayed, THEN a "Generate Preview" button SHALL be visible in the configuration panel. WHEN the admin clicks "Generate Preview", THEN the system SHALL generate a static HTML file entirely in the browser (no server request) and trigger a download of that file via a standard browser anchor-download mechanism. The generated HTML SHALL contain:
- Punch box details: size (slot count), list of selected products with quantity per product
- Pricing summary: Total COGS, Profit, Retail Price
- Simple, clean formatting suitable for sharing with a customer

---

## R3 — Punch Box Configuration Panel

**User story:**
As an admin, I want a configuration panel on the right side of the builder showing size selection and real-time pricing, so that I can see the economics before committing.

### Acceptance Criteria

**AC3.1** WHEN the configuration panel is displayed, THEN it SHALL include:
- A "Punch Box Size" dropdown with options: 30, 50, 70 (number of slots)
- A list of selected products, each with a quantity input
- A "Calculate Retail Price" button (or automatic re-calculation trigger)
- A pricing equation display: `Total COGS + Profit = Retail Price`
- A "Generate Preview" button (see AC2.10)
- A "Generate Punch Box" submit button at the bottom

**AC3.2** WHEN the admin changes the punch box size, THEN the size value SHALL be stored in form state and submitted with the punch box.

**AC3.3** WHEN the admin clicks "Calculate Retail Price" (or when any relevant value changes if auto-calculation is implemented), THEN the system SHALL:
- Compute Total COGS = sum over all selected products of `(product.cost / 6.5) × quantity`
- Compute a default Profit using the same tiered retail-pricing rule used elsewhere (applied to the per-product `cog_adjusted` → compute per-product retail price, then sum; profit = total retail price − total COGS)
- Display Total COGS (read-only), Profit (editable), and Retail Price (editable)

**AC3.4** WHEN the admin edits the Profit field, THEN Retail Price SHALL be automatically recalculated as `Total COGS + Profit`, rounded to 2 decimal places.

**AC3.5** WHEN the admin edits the Retail Price field, THEN Profit SHALL be automatically recalculated as `Retail Price − Total COGS`, rounded to 2 decimal places.

**AC3.6** WHEN the admin clicks "Generate Punch Box", THEN the system SHALL validate:
- At least one product is selected (WHEN zero products are selected, THEN the system SHALL display an error: "Please select at least one product.")
- Punch box size is selected (WHEN no size is selected, THEN the system SHALL display an error: "Please select a punch box size.")
- Retail price is greater than 0 (WHEN retail price is 0 or negative, THEN the system SHALL display an error: "Retail price must be greater than zero.")

**AC3.7** WHEN all validations pass and the admin submits the punch box, THEN the system SHALL POST to the punch box creation API and on success navigate to the Bundles page (or the punch box detail view) with a success snackbar.

**AC3.8** WHEN the creation API returns an error, THEN the system SHALL display the error message to the admin without navigating away.

---

## R4 — Punch Box Data Storage

**User story:**
As the system, I need dedicated tables to store punch boxes and their items, so that punch boxes have a clean data model separate from generated bundles.

### Acceptance Criteria

**AC4.1** The system SHALL store punch boxes in a dedicated `punch_box` table (separate from `generated_bundle`) with the following columns:
- `id` — bigserial primary key
- `public_id` — varchar(30), unique, generated as `pb_<random>` (same hex pattern as `ord_`)
- `future_party_id` — bigint, nullable FK into `future_parties.id` (ON DELETE SET NULL)
- `slot_count` — smallint, CHECK IN (30, 50, 70)
- `total_cogs_usd` — NUMERIC(10,2) — total COGS in USD at time of creation
- `retail_price` — NUMERIC(10,2) — admin-set retail price
- `profit_usd` — NUMERIC(10,2) — retail_price − total_cogs_usd
- `status` — varchar(20), CHECK IN ('ASSIGNED', 'ORDERED'), default 'ASSIGNED'
- `created_at` — timestamptz, default now()

**AC4.2** The system SHALL store punch box line items in a dedicated `punch_box_item` table with the following columns:
- `id` — bigserial primary key
- `punch_box_id` — bigint NOT NULL, FK into `punch_box.id` (ON DELETE CASCADE)
- `product_id` — bigint, nullable (set NULL if product is deleted)
- `product_name_snapshot` — varchar(200)
- `sku_snapshot` — varchar(100)
- `cost_snapshot` — NUMERIC(10,2) — product.cost at time of creation (RMB)
- `quantity` — smallint NOT NULL, CHECK >= 1
- `display_order` — smallint NOT NULL

**AC4.3** WHEN a punch box is created, THEN the insert of `punch_box` and all `punch_box_item` rows SHALL occur within a single database transaction (atomic).

**AC4.4** WHEN a `future_party_id` is provided at creation, THEN the `future_parties` table SHALL be updated to set `linked_punch_box_id = punch_box.id` within the same transaction.

**AC4.5** The `future_parties` table SHALL have a new nullable column `linked_punch_box_id` (bigint, FK into `punch_box.id`, ON DELETE SET NULL) added via a migration.

**AC4.6** Public IDs SHALL follow the pattern `pb_<12-char-hex>` generated server-side (not client-supplied).

---

## R5 — Punch Box Status Lifecycle

**User story:**
As an admin, I want to manually advance a punch box from ASSIGNED to ORDERED, triggering inventory deduction, so that I can record when a punch box has been sold.

### Acceptance Criteria

**AC5.1** WHEN a punch box is created, THEN its status SHALL be 'ASSIGNED'.

**AC5.2** WHEN an admin attempts to change a punch box's status to ORDERED from the Bundles page, THEN the system SHALL display a confirmation dialog before proceeding.

**AC5.3** WHEN the confirmation dialog is displayed, THEN it SHALL include a warning stating: this action is irreversible and will deduct inventory for each product by its quantity.

**AC5.4** WHEN the admin confirms the status change to ORDERED, THEN the system SHALL atomically:
1. For each `punch_box_item`, deduct `quantity` from the corresponding `product.inventory_quantity`
2. Set `punch_box.status = 'ORDERED'`

**AC5.5** WHEN the inventory deduction would make any product's inventory negative, THEN the system SHALL still proceed (deduct to zero or negative is allowed; admin controls this workflow).

**AC5.6** WHEN the admin cancels the confirmation dialog, THEN no status change or inventory deduction SHALL occur.

**AC5.7** WHEN a punch box is already in ORDERED status, THEN the Bundles page SHALL NOT offer a status-change control for that row (the status is displayed as a read-only chip).

**AC5.8** The ORDERED status transition SHALL only be available for punch boxes, not for generated bundles. Generated bundles become ORDERED via the customer checkout flow.

---

## R6 — Bundles Page: Merged List with Type Column

**User story:**
As an admin, I want to see both bundles and punch boxes in the same list on the Bundles page, so that I have a single view for all packaged products.

### Acceptance Criteria

**AC6.1** WHEN the Bundles page loads, THEN the table SHALL display both generated bundles and punch boxes, merged and sorted by `created_at` descending.

**AC6.2** WHEN a row is a generated bundle, THEN the "Type" column SHALL display "Bundle".

**AC6.3** WHEN a row is a punch box, THEN the "Type" column SHALL display "Punch Box".

**AC6.4** WHEN the status filter is applied, THEN it SHALL filter both bundles and punch boxes by their respective status values.

**AC6.5** WHEN the admin searches by ID, THEN the search SHALL match against both bundle public IDs and punch box public IDs.

**AC6.6** WHEN a punch box row is displayed and its status is ASSIGNED, THEN a "Mark as Ordered" action (e.g., a button or select) SHALL be available in the row.

**AC6.7** WHEN a punch box row is displayed and its status is ORDERED, THEN the status SHALL be displayed as a read-only chip with no status-change control.

**AC6.8** WHEN a bundle row is displayed, THEN no manual "Mark as Ordered" action SHALL be present (bundles show the existing expand/detail row with status chip; status is managed through checkout).

**AC6.9** WHEN a punch box row is displayed, THEN a "View" icon button SHALL be available; clicking it SHALL navigate to `/admin/punch-box/<publicId>` (the Punch Box Edit/View page).

**AC6.10** WHEN a punch box row is expanded (or clicked), THEN the detail view SHALL show: public ID, slot count, total COGS, profit, retail price, status, created_at, linked future party (if any), and the list of items (product name snapshot, SKU snapshot, quantity).

---

## R7 — Orders Page: Punch Boxes as Ordered Entries

**User story:**
As an admin, I want ORDERED punch boxes to appear on the Orders page, so that I have a consolidated view of all fulfilled items.

### Acceptance Criteria

**AC7.1** WHEN the Orders page loads, THEN it SHALL display both customer orders and ORDERED punch boxes in the same list, sorted by `created_at` descending.

**AC7.2** WHEN a row is a customer order, THEN the "Type" column SHALL display "Order".

**AC7.3** WHEN a row is a punch box, THEN the "Type" column SHALL display "Punch Box".

**AC7.4** WHEN a punch box row is displayed, THEN the following columns SHALL be populated:
- ID: punch box public ID (in monospace font)
- Type: "Punch Box"
- Status: "ORDERED"
- Total: retail price (formatted as currency)
- Slot Count: numeric slot count (e.g., 30)
- Created: formatted date

**AC7.5** WHEN a customer order row is displayed, THEN the "Slot Count" column SHALL display "—" (not applicable).

**AC7.6** WHEN the status filter is applied on the Orders page, THEN punch boxes (always "ORDERED") SHALL be shown when the filter is "ORDERED" or when no filter is applied; they SHALL be hidden when any other specific status filter is selected.

**AC7.7** WHEN the admin clicks on a punch box row in the Orders page, THEN no navigation to a detail page is required in this MVP (the row is informational only; future detail page is out of scope).

---

## R8 — Pricing Calculation Rule

**User story:**
As an admin, I want the pricing panel to use the system's established RMB→USD cost conversion and retail pricing formula as a starting default, so that punch box pricing is consistent with the rest of the product catalog.

### Acceptance Criteria

**AC8.1** WHEN computing Total COGS for a punch box, THEN the system SHALL use the formula: `sum((product.cost / 6.5) × quantity)` for all selected products, where `product.cost` is the cost stored in RMB.

**AC8.2** WHEN computing the default Retail Price, THEN the system SHALL use the same tiered `computeRetailPrice(cogAdjusted)` function already used for individual products, applied per product (`cog_adjusted = product.cog_adjusted`), summing the resulting per-product retail prices weighted by quantity, to obtain the suggested total retail price.

**AC8.3** WHEN the default Profit is displayed, THEN it SHALL equal `suggestedRetailPrice − totalCogsUsd`, rounded to 2 decimal places.

**AC8.4** WHEN the admin overrides Retail Price, THEN the system SHALL accept any positive numeric value and store it as-is; no server-side formula is re-applied to override the admin's choice.

**AC8.5** WHEN the punch box creation request is submitted, THEN the server SHALL recompute `total_cogs_usd` server-side (from product cost / 6.5 × quantity) and SHALL NOT trust the client-submitted COGS; `profit_usd` SHALL be stored as `retail_price − server_computed_total_cogs_usd`.

**AC8.6** WHEN the RMB→USD conversion is applied, THEN the divisor SHALL be exactly 6.5 (hardcoded; no configuration needed).

---

## R9 — Admin-Only Scope

**User story:**
As the product owner, I want punch boxes to be accessible only through the admin interface, so that they are not visible or purchasable by customers in this MVP.

### Acceptance Criteria

**AC9.1** All punch box API routes SHALL be mounted under `/admin/api/punch-boxes` and protected by the `basicAuth` middleware.

**AC9.2** WHEN a request reaches any punch box API route without valid Basic Auth credentials, THEN the system SHALL return HTTP 401.

**AC9.3** There SHALL be no customer-facing page, cart integration, or public API for punch boxes in this feature.

---

## R_PREVIEW — Punch Box Preview/Edit Page

**User story:**
As an admin, I want a dedicated page to view and edit a saved punch box (quantities, product swaps) and download an HTML preview, so that I can adjust the box after creation and share a formatted summary with a customer.

### Acceptance Criteria

**ACPV.1** WHEN the admin navigates to `/admin/punch-box/:publicId`, THEN the system SHALL load the punch box from the API using `GET /admin/api/punch-boxes/:publicId` and display a two-column layout identical in structure to the Builder page, pre-populated with the punch box's saved data (size, selected products, quantities, pricing).

**ACPV.2** WHEN the punch box has status ASSIGNED, THEN the admin SHALL be able to:
- Change the quantity of any item via an editable quantity input
- Swap a product by deselecting it and selecting a replacement

**ACPV.3** WHEN the admin makes a quantity or product change and submits the edit, THEN the system SHALL send a `PATCH /admin/api/punch-boxes/:publicId/items/:itemId` request and update the displayed pricing accordingly on success.

**ACPV.4** WHEN the punch box has status ORDERED, THEN all quantity inputs and product selection checkboxes SHALL be read-only (no edits permitted).

**ACPV.5** WHEN the admin is on the Preview/Edit page, THEN a "Generate Preview" button SHALL be visible. WHEN clicked, THEN the system SHALL generate a static HTML file client-side (no server request) and trigger a browser download of that file (see R_HTML for content specification).

**ACPV.6** WHEN the punch box has status ASSIGNED, THEN a "Mark as Ordered" button SHALL be displayed; clicking it SHALL trigger the same confirmation dialog described in AC5.2–AC5.6 and on confirmation navigate back to the Bundles page with a success snackbar.

**ACPV.7** WHEN the detail API returns 404, THEN the system SHALL display a "Punch box not found" message and provide a link back to the Bundles page.

---

## R_HTML — HTML Preview Generation

**User story:**
As an admin, I want to download a formatted HTML file summarising a punch box's contents and pricing, so that I can share a clean customer-facing summary without exposing the admin interface.

### Acceptance Criteria

**ACHTML.1** WHEN the admin clicks "Generate Preview" on either the Builder page or the Preview/Edit page, THEN the HTML file SHALL be generated entirely in the browser using JavaScript — no HTTP request to the backend is made.

**ACHTML.2** WHEN the HTML file is generated, THEN it SHALL contain:
- A heading identifying the company name and document type ("Punch Box Summary")
- Punch box identifier (public ID if saved, or "Draft" if not yet saved)
- Punch box size (slot count)
- A product table listing: product name, quantity per product
- Pricing summary section: Total COGS (in USD), Profit (in USD), Retail Price (in USD)
- Formatting that is clean and legible when opened in a browser (basic inline CSS; no external dependencies)

**ACHTML.3** WHEN the download is triggered, THEN the system SHALL use the `Blob` API and a programmatic anchor `<a download="punch-box-preview.html">` click to initiate the browser's native file download.

**ACHTML.4** WHEN the punch box has not yet been saved (builder page, before "Generate Punch Box" is clicked), THEN the HTML SHOULD still be downloadable with the current draft data; the public ID field in the HTML SHALL read "Draft".

**ACHTML.5** WHEN the generated HTML is opened in a browser, THEN no JavaScript execution SHALL be required to display the content (pure static HTML with inline styles).

---

## Out of Scope (for this MVP)

- Customer-facing punch box purchase or checkout flow
- Email notification for punch boxes
- Punch box detail page accessible by public URL
- Deleting a punch box
- Multiple punch boxes per future party
