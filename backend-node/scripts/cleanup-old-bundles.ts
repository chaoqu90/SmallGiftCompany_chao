/**
 * cleanup-old-bundles.ts
 *
 * Deletes generated bundles that:
 *   1. Were created more than 30 days ago, AND
 *   2. Have no associated order (i.e. not referenced in order_line_item)
 *
 * Child rows (generated_bundle_item, generated_bundle_upgrade,
 * generated_bundle_gift_bag, cart_item) are removed automatically
 * via ON DELETE CASCADE.
 *
 * Usage:
 *   # Dry run — shows what would be deleted, changes nothing (default)
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/cleanup-old-bundles.ts
 *
 *   # Actually delete
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/cleanup-old-bundles.ts --force
 *
 *   # Change the age threshold (days)
 *   node --env-file=.env ./node_modules/.bin/tsx scripts/cleanup-old-bundles.ts --days=60 --force
 */

import postgres from 'postgres';

// ── Parse CLI flags ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const force = args.includes('--force');
const daysArg = args.find(a => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30;

if (isNaN(days) || days < 1) {
  console.error('--days must be a positive integer');
  process.exit(1);
}

// ── Connect ────────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.');
  console.error('Run with: node --env-file=.env ./node_modules/.bin/tsx scripts/cleanup-old-bundles.ts');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nBundle cleanup — threshold: ${days} days | mode: ${force ? 'DELETE' : 'DRY RUN'}\n`);

  // Count and preview bundles that qualify for deletion
  const candidates = await sql<{ id: number; public_id: string; created_at: Date }[]>`
    SELECT id, public_id, created_at
    FROM generated_bundle
    WHERE created_at < NOW() - (${days} || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM order_line_item WHERE order_line_item.generated_bundle_id = generated_bundle.id
      )
    ORDER BY created_at ASC
  `;

  if (candidates.length === 0) {
    console.log(`No bundles older than ${days} days without an order. Nothing to do.`);
    await sql.end();
    return;
  }

  console.log(`Found ${candidates.length} bundle(s) to delete:\n`);
  for (const b of candidates) {
    const age = Math.floor((Date.now() - b.created_at.getTime()) / 86_400_000);
    console.log(`  ${b.public_id}  (${age} days old, created ${b.created_at.toISOString().slice(0, 10)})`);
  }
  console.log('');

  if (!force) {
    console.log('Dry run — no changes made.');
    console.log(`To delete, re-run with --force:\n`);
    console.log(`  node --env-file=.env ./node_modules/.bin/tsx scripts/cleanup-old-bundles.ts --force\n`);
    await sql.end();
    return;
  }

  // Delete — child rows removed by ON DELETE CASCADE
  const ids = candidates.map(b => b.id);
  const deleted = await sql<{ id: number }[]>`
    DELETE FROM generated_bundle
    WHERE id = ANY(${sql.array(ids)})
    RETURNING id
  `;

  console.log(`Deleted ${deleted.length} bundle(s) and their associated items, upgrades, gift bags, and cart rows.`);
  await sql.end();
}

main().catch(err => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
