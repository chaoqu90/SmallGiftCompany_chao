# Backend Scripts

Utility scripts for database and asset management. All scripts run against the live database and AWS — always do a **dry run first** before using `--force`.

---

## Setup

All scripts require a `.env` file at `backend-node/.env` with the following variables set:

```env
DATABASE_URL=postgresql://...            # Supabase transaction-mode URL (port 6543)
AWS_ACCESS_KEY_ID=AKIA...               # IAM user with S3 PutObject permission
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
PRODUCT_IMAGES_BUCKET=goodiebag-backend-dev-productimagesbucket-uhxvujzun15a
```

Run all scripts from the `backend-node/` directory.

---

## Scripts

### 1. `reset-test-data.ts` — Wipe orders, bundles, and inactive products

Deletes all customer orders, all generated bundles, and all products marked `active = false`. Runs in the correct FK dependency order.

**What gets deleted:**
- All `customer_order` rows → cascades to `order_line_item`
- All `generated_bundle` rows → cascades to items, upgrades, gift bags, cart rows
- All `product` rows where `active = false`

```bash
npm run reset-test-data          # dry run — shows counts, no changes
npm run reset-test-data:force    # actually delete
```

---

### 2. `import-products-xlsx.ts` — Import products from Excel

Reads `2026purchase.xlsx` from the repo root and inserts new products into the `product` table.

**Rules:**
- Matches rows by SKU — skips any SKU already in the DB
- Maps: `SKU` → `sku`, English product name → `name`, `description` → `description`, `cog_raw` → `cost`, `received_qrt` → `inventory_quantity`
- Non-numeric `cog_raw` or `received_qrt` values are stored as `0`
- All imported products are set to `active = false`
- All other fields (category, age range, affinities, etc.) are left as defaults — fill them in via the admin UI afterward

```bash
npm run import-products          # dry run — shows what would be inserted
npm run import-products:force    # actually insert
```

---

### 3. `upload-product-images.ts` — Upload images to S3 and save URLs

Reads image files from `product_image/` at the repo root, uploads each one to S3, and saves the public URL to `product.image_url` in the DB.

**Rules:**
- Matches image filename (without extension) to a product SKU — case-insensitive
- Supported extensions: `jpg`, `jpeg`, `png`, `gif`, `webp`
- Skips products that already have an `image_url` set
- S3 key format: `product-images/<SKU>.<ext>`

**To add new images:** drop the file named `<SKU>.png` (or `.jpg`) into `product_image/` and re-run the script — already-uploaded products are skipped automatically.

```bash
npm run upload-images            # dry run — shows what would be uploaded
npm run upload-images:force      # actually upload and update DB
```

---

### 4. `cleanup-old-bundles.ts` — Delete stale generated bundles

Deletes generated bundles that are older than N days and have no associated order. Safe to run on a schedule to keep the DB lean.

**What gets deleted:**
- `generated_bundle` rows older than the threshold with no `order_line_item` reference
- Cascades to: `generated_bundle_item`, `generated_bundle_upgrade`, `generated_bundle_gift_bag`, `cart_item`

```bash
npm run cleanup-bundles                      # dry run, default 30-day threshold
npm run cleanup-bundles:force                # delete bundles older than 30 days
node --env-file=.env ./node_modules/.bin/tsx scripts/cleanup-old-bundles.ts --days=60 --force
#                                            # custom threshold (e.g. 60 days)
```
