/**
 * Integration test database helpers.
 *
 * Provides seed and cleanup utilities shared across integration test suites.
 * Uses the same postgres.js singleton as the application so tests exercise
 * the real data path.
 *
 * Cleanup order respects FK constraints:
 *   generated_bundle_gift_bag → generated_bundle_upgrade → generated_bundle_item
 *   → generated_bundle → analytics_event → product affinities → product
 *
 * Product and reference data (budget_tier, bundle_template, gift_bag_option)
 * are seeded once per suite in beforeAll and cleaned up in afterAll.
 */
import { sql } from '../../../src/db.js';

/** Deletes all test-created generated bundles and analytics events. */
export async function cleanBundles(): Promise<void> {
  await sql`DELETE FROM generated_bundle_gift_bag`;
  await sql`DELETE FROM generated_bundle_upgrade`;
  await sql`DELETE FROM generated_bundle_item`;
  await sql`DELETE FROM generated_bundle`;
}

export async function cleanAnalyticsEvents(): Promise<void> {
  await sql`DELETE FROM analytics_event`;
}

/** Deletes test products and their affinities (FK cascade handles affinity rows via ON DELETE CASCADE).  */
export async function cleanProducts(skus: string[]): Promise<void> {
  if (skus.length === 0) return;
  await sql`DELETE FROM product WHERE sku = ANY(${sql.array(skus, 'text')})`;
}

/**
 * Seeds the minimum product set for bundle generation tests.
 * Returns the inserted product IDs keyed by SKU.
 */
export async function seedGenerationProducts(): Promise<Map<string, number>> {
  // Insert four STANDARD products, each filling one slot in GENERAL_4_ITEM template
  const rows = await sql<{ id: number; sku: string }[]>`
    INSERT INTO product (
      sku, name, description, image_url,
      cost, cog_overhead, cog_adjusted, retail_price,
      inventory_quantity, active, min_age, max_age,
      category, form_factor, upgrade_tier, theme_code,
      created_at, updated_at
    )
    VALUES
      ('TEST-UTIL-001', 'Test Utility Product', null, null,
       1.00, 0.00, 1.00, 2.00,
       100, true, 3, 12,
       'TOY', 'ROUND', 'STANDARD', null,
       now(), now()),
      ('TEST-ACTV-002', 'Test Activity Product', null, null,
       1.00, 0.00, 1.00, 2.00,
       100, true, 3, 12,
       'ACTIVITY', 'ROUND', 'STANDARD', null,
       now(), now()),
      ('TEST-PLAY-003', 'Test Play Product', null, null,
       1.00, 0.00, 1.00, 2.00,
       100, true, 3, 12,
       'TOY', 'ROUND', 'STANDARD', null,
       now(), now()),
      ('TEST-COLL-004', 'Test Collectible Product', null, null,
       1.00, 0.00, 1.00, 2.00,
       100, true, 3, 12,
       'COLLECTIBLE', 'ROUND', 'STANDARD', null,
       now(), now())
    RETURNING id, sku
  `;

  const idBySku = new Map(rows.map(r => [r.sku, r.id]));

  // Seed occasion affinities (required for findAllEligibleForGeneration)
  await sql`
    INSERT INTO product_occasion (product_id, occasion)
    VALUES
      (${idBySku.get('TEST-UTIL-001')}, 'CELEBRATION'),
      (${idBySku.get('TEST-ACTV-002')}, 'CELEBRATION'),
      (${idBySku.get('TEST-PLAY-003')}, 'CELEBRATION'),
      (${idBySku.get('TEST-COLL-004')}, 'CELEBRATION')
  `;

  // Seed role affinities so each product fills exactly one slot
  await sql`
    INSERT INTO product_role_affinity (product_id, role, weight)
    VALUES
      (${idBySku.get('TEST-UTIL-001')}, 'UTILITY',      90),
      (${idBySku.get('TEST-ACTV-002')}, 'ACTIVITY',     90),
      (${idBySku.get('TEST-PLAY-003')}, 'PLAY',         90),
      (${idBySku.get('TEST-COLL-004')}, 'COLLECTIBLE',  90)
  `;

  // Seed interest affinities
  for (const id of idBySku.values()) {
    await sql`
      INSERT INTO product_interest_affinity (product_id, interest, weight)
      VALUES (${id}, 'CUTE_MAGICAL', 70)
    `;
  }

  // Seed audience affinities
  for (const id of idBySku.values()) {
    await sql`
      INSERT INTO product_audience_affinity (product_id, audience, weight)
      VALUES (${id}, 'UNIVERSAL', 80)
    `;
  }

  return idBySku;
}

export const TEST_PRODUCT_SKUS = [
  'TEST-UTIL-001',
  'TEST-ACTV-002',
  'TEST-PLAY-003',
  'TEST-COLL-004',
];
