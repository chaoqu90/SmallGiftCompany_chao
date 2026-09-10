/**
 * import-products-xlsx.ts
 *
 * Imports products from 2026purchase.xlsx into the product table.
 *
 * Rules:
 *   - Reads the first sheet ("inventory_table")
 *   - Skips the header row and any row with a blank SKU or blank product name
 *   - Looks up each SKU in the DB; skips the row if a match is found
 *   - Inserts new rows with:
 *       sku              ← column "SKU"            (index 3)
 *       name             ← column "product name"   (index 4)  [English name]
 *       description      ← column "description"    (index 5)
 *       cost             ← column "cog_raw"        (index 6)  — 0 if not a number
 *       inventory_quantity ← column "received_qrt" (index 10) — 0 if not a number
 *       active           = false
 *       everything else  = safe defaults (0 / 'UNKNOWN' / 'STANDARD')
 *
 * Dry-run by default — pass --force to actually insert.
 *
 * Usage (from backend-node/):
 *   npm run import-products          # dry run
 *   npm run import-products:force    # insert
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx');
import postgres from 'postgres';

// ── Resolve paths ─────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Script lives in backend-node/scripts/ — xlsx is one level up (repo root)
const XLSX_PATH = path.resolve(__dirname, '../../2026purchase.xlsx');

// ── Parse CLI flags ────────────────────────────────────────────────────────────

const force = process.argv.includes('--force');

// ── DB connection ──────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

// ── Column indices in the spreadsheet ─────────────────────────────────────────

const COL_SKU         = 3;
const COL_NAME        = 4;
const COL_DESCRIPTION = 5;
const COL_COG_RAW     = 6;
const COL_RECEIVED    = 10;

// ── Helpers ────────────────────────────────────────────────────────────────────

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nImport products from xlsx — mode: ${force ? 'INSERT' : 'DRY RUN'}\n`);
  console.log(`Reading: ${XLSX_PATH}\n`);

  // ── Read xlsx ──────────────────────────────────────────────────────────────

  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  // Skip header row (index 0)
  const dataRows = rows.slice(1);

  // ── Fetch all existing SKUs from DB once ───────────────────────────────────

  const existingRows = await sql<{ sku: string }[]>`SELECT sku FROM product`;
  const existingSkus = new Set(existingRows.map(r => r.sku));

  console.log(`Existing SKUs in DB: ${existingSkus.size}`);
  console.log(`Rows in spreadsheet: ${dataRows.length}\n`);

  let skipped_no_sku  = 0;
  let skipped_no_name = 0;
  let skipped_exists  = 0;
  let to_insert       = 0;

  const inserts: {
    sku: string;
    name: string;
    description: string | null;
    cost: number;
    inventory_quantity: number;
    cog_raw_original: unknown;
    received_original: unknown;
  }[] = [];

  for (const row of dataRows) {
    const r = row as unknown[];

    const sku  = toString(r[COL_SKU]);
    const name = toString(r[COL_NAME]);

    if (!sku) {
      skipped_no_sku++;
      continue;
    }
    if (!name) {
      skipped_no_name++;
      continue;
    }
    if (existingSkus.has(sku)) {
      skipped_exists++;
      continue;
    }

    const cogRaw    = r[COL_COG_RAW];
    const receivedQ = r[COL_RECEIVED];
    const description = toString(r[COL_DESCRIPTION]) || null;

    inserts.push({
      sku,
      name,
      description,
      cost:               toNumber(cogRaw),
      inventory_quantity: toNumber(receivedQ),
      cog_raw_original:   cogRaw,
      received_original:  receivedQ,
    });

    to_insert++;
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log(`Skipped — no SKU:          ${skipped_no_sku}`);
  console.log(`Skipped — no product name: ${skipped_no_name}`);
  console.log(`Skipped — SKU exists in DB:${skipped_exists}`);
  console.log(`To insert:                 ${to_insert}\n`);

  if (to_insert === 0) {
    console.log('Nothing to insert.');
    await sql.end();
    return;
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  console.log('Products to insert:');
  for (const p of inserts) {
    const cogNote = Number.isFinite(Number(p.cog_raw_original)) ? '' : `  ⚠ cog_raw "${p.cog_raw_original}" → 0`;
    const qtyNote = Number.isFinite(Number(p.received_original)) ? '' : `  ⚠ received_qrt "${p.received_original}" → 0`;
    console.log(`  [${p.sku}] ${p.name}  cost=${p.cost}  qty=${p.inventory_quantity}${cogNote}${qtyNote}`);
  }
  console.log('');

  if (!force) {
    console.log('Dry run — no changes made.');
    console.log('To insert, re-run with --force:\n');
    console.log('  npm run import-products:force\n');
    await sql.end();
    return;
  }

  // ── Insert ─────────────────────────────────────────────────────────────────

  let inserted = 0;
  let failed   = 0;

  for (const p of inserts) {
    try {
      await sql`
        INSERT INTO product (
          sku, name, description,
          cost, cog_overhead, cog_adjusted, retail_price,
          inventory_quantity,
          active,
          min_age, max_age,
          category, form_factor, upgrade_tier
        ) VALUES (
          ${p.sku},
          ${p.name},
          ${p.description},
          ${p.cost},
          0, 0, 0,
          ${p.inventory_quantity},
          false,
          0, 0,
          'UNKNOWN', 'UNKNOWN', 'STANDARD'
        )
      `;
      inserted++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED [${p.sku}]: ${msg}`);
    }
  }

  console.log(`\nInserted: ${inserted}  Failed: ${failed}`);
  console.log('Done.');
  await sql.end();
}

main().catch(err => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
