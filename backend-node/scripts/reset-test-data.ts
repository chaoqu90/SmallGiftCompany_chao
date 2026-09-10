/**
 * reset-test-data.ts
 *
 * Removes all test/demo data from the database in the correct dependency order:
 *   1. All customer_order rows            → cascades to order_line_item
 *   2. All generated_bundle rows          → cascades to generated_bundle_item,
 *                                           generated_bundle_upgrade,
 *                                           generated_bundle_gift_bag, cart_item
 *   3. All product rows where active = false
 *
 * Dry-run by default — pass --force to actually delete.
 *
 * Usage:
 *   # Dry run (safe — shows counts, changes nothing)
 *   npm run reset-test-data
 *
 *   # Actually delete
 *   npm run reset-test-data:force
 */

import postgres from 'postgres';

// ── Parse CLI flags ────────────────────────────────────────────────────────────

const force = process.argv.includes('--force');

// ── Connect ────────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.');
  console.error('Run with: node --env-file=.env ./node_modules/.bin/tsx scripts/reset-test-data.ts');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nReset test data — mode: ${force ? 'DELETE' : 'DRY RUN'}\n`);

  // ── Preview counts ──────────────────────────────────────────────────────────

  const [{ count: orderCount }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count FROM customer_order
  `;

  const [{ count: bundleCount }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count FROM generated_bundle
  `;

  const [{ count: inactiveProductCount }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count FROM product WHERE active = false
  `;

  console.log(`  Orders to delete:            ${orderCount}`);
  console.log(`  Generated bundles to delete: ${bundleCount}`);
  console.log(`  Inactive products to delete: ${inactiveProductCount}`);
  console.log('');

  if (orderCount === '0' && bundleCount === '0' && inactiveProductCount === '0') {
    console.log('Nothing to delete. Exiting.');
    await sql.end();
    return;
  }

  if (!force) {
    console.log('Dry run — no changes made.');
    console.log('To delete, re-run with --force:\n');
    console.log('  npm run reset-test-data:force\n');
    await sql.end();
    return;
  }

  // ── 1. Delete all orders (cascades to order_line_item) ──────────────────────

  const deletedOrders = await sql<{ id: number }[]>`
    DELETE FROM customer_order RETURNING id
  `;
  console.log(`Deleted ${deletedOrders.length} order(s) (+ their line items).`);

  // ── 2. Delete all generated bundles ─────────────────────────────────────────
  //    Cascades to: generated_bundle_item, generated_bundle_upgrade,
  //                 generated_bundle_gift_bag, cart_item

  const deletedBundles = await sql<{ id: number }[]>`
    DELETE FROM generated_bundle RETURNING id
  `;
  console.log(`Deleted ${deletedBundles.length} generated bundle(s) (+ items, upgrades, gift bags, cart rows).`);

  // ── 3. Delete inactive products ──────────────────────────────────────────────

  const deletedProducts = await sql<{ id: number; sku: string; name: string }[]>`
    DELETE FROM product WHERE active = false RETURNING id, sku, name
  `;
  if (deletedProducts.length > 0) {
    console.log(`Deleted ${deletedProducts.length} inactive product(s):`);
    for (const p of deletedProducts) {
      console.log(`  [${p.sku}] ${p.name}`);
    }
  } else {
    console.log('No inactive products found.');
  }

  console.log('\nDone.');
  await sql.end();
}

main().catch(err => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
