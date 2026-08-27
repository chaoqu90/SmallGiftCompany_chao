/**
 * Generated bundle repository.
 *
 * saveBundle wraps all inserts (bundle + items + upgrade + gift_bag) in a single
 * postgres.js transaction to ensure atomicity (design.md §3.5, AC4.12).
 *
 * findBundleByPublicId returns the full bundle aggregate with items, upgrade,
 * and gift bag (AC5.1, AC9.2).
 */
import { sql } from '../db.js';
import type {
  GeneratedBundleRow,
  GeneratedBundleItemRow,
  GeneratedBundleUpgradeRow,
  GeneratedBundleGiftBagRow,
} from '../types/entities.js';

// ─── Snapshot types passed into saveBundle ────────────────────────────────────

export interface BundleItemSnapshot {
  slotCode: string;
  productId: number;
  productNameSnapshot: string;
  skuSnapshot: string;
  costSnapshot: number;
  descriptionSnapshot: string | null;
  formFactorSnapshot: string;
  quantityPerBag: number;
  displayOrder: number;
}

export interface BundleUpgradeSnapshot {
  standardProductId: number | null;
  standardProductNameSnapshot: string | null;
  standardSkuSnapshot: string | null;
  standardCostSnapshot: number | null;
  standardRetailAdjustmentSnapshot: number | null;
  premiumProductId: number | null;
  premiumProductNameSnapshot: string | null;
  premiumSkuSnapshot: string | null;
  premiumCostSnapshot: number | null;
  premiumRetailAdjustmentSnapshot: number | null;
}

export interface BundleGiftBagSnapshot {
  giftBagOptionId: number;
  nameSnapshot: string;
  costSnapshot: number;
  retailPriceAdjustmentSnapshot: number;
  isDefault: boolean;
  giftBagOptionCode: string;
}

export interface BundleSnapshot {
  publicId: string;
  requestedAge: number;
  audiencePreference: string;
  interest: string;
  partyType: string;
  budgetTierId: number;
  bundleTemplateId: number;
  baseRetailPrice: number;
  standardItemCogsSnapshot: number;
  items: BundleItemSnapshot[];
  upgrade: BundleUpgradeSnapshot | null;
  giftBag: BundleGiftBagSnapshot | null;
}

/**
 * Full bundle aggregate returned by find operations.
 */
export interface GeneratedBundleAggregate {
  bundle: GeneratedBundleRow;
  items: GeneratedBundleItemRow[];
  upgrade: GeneratedBundleUpgradeRow | null;
  giftBag: GeneratedBundleGiftBagRow | null;
  /** Template code (joined) */
  templateCode: string;
  /** Budget tier code (joined) */
  budgetTierCode: string;
}

/**
 * Saves a complete generated bundle snapshot atomically.
 * All inserts happen in a single transaction (design.md §3.5, AC4.12).
 * Returns the saved bundle row (with generated id and public_id).
 */
export async function saveBundle(snapshot: BundleSnapshot): Promise<GeneratedBundleRow> {
  return await sql.begin(async (tx) => {
    // 1. Insert generated_bundle
    const bundles = await tx<GeneratedBundleRow[]>`
      INSERT INTO generated_bundle (
        public_id, requested_age, audience_preference, interest, party_type,
        budget_tier_id, bundle_template_id,
        base_retail_price, standard_item_cogs_snapshot,
        status, created_at
      ) VALUES (
        ${snapshot.publicId},
        ${snapshot.requestedAge},
        ${snapshot.audiencePreference},
        ${snapshot.interest},
        ${snapshot.partyType},
        ${snapshot.budgetTierId},
        ${snapshot.bundleTemplateId},
        ${snapshot.baseRetailPrice},
        ${snapshot.standardItemCogsSnapshot},
        'GENERATED',
        now()
      )
      RETURNING *
    `;
    const bundle = bundles[0];

    // 2. Insert generated_bundle_item rows
    if (snapshot.items.length > 0) {
      const itemRows = snapshot.items.map(item => ({
        generated_bundle_id: bundle.id,
        slot_code: item.slotCode,
        product_id: item.productId,
        product_name_snapshot: item.productNameSnapshot,
        sku_snapshot: item.skuSnapshot,
        cost_snapshot: item.costSnapshot,
        description_snapshot: item.descriptionSnapshot,
        form_factor_snapshot: item.formFactorSnapshot,
        quantity_per_bag: item.quantityPerBag,
        display_order: item.displayOrder,
      }));
      await tx`INSERT INTO generated_bundle_item ${tx(itemRows)}`;
    }

    // 3. Insert generated_bundle_upgrade
    if (snapshot.upgrade) {
      const u = snapshot.upgrade;
      await tx`
        INSERT INTO generated_bundle_upgrade (
          generated_bundle_id,
          standard_product_id, standard_product_name_snapshot,
          standard_sku_snapshot, standard_cost_snapshot,
          standard_retail_adjustment_snapshot,
          product_id, product_name_snapshot,
          sku_snapshot, cost_snapshot,
          retail_price_adjustment_snapshot
        ) VALUES (
          ${bundle.id},
          ${u.standardProductId}, ${u.standardProductNameSnapshot},
          ${u.standardSkuSnapshot}, ${u.standardCostSnapshot},
          ${u.standardRetailAdjustmentSnapshot ?? 0},
          ${u.premiumProductId}, ${u.premiumProductNameSnapshot},
          ${u.premiumSkuSnapshot}, ${u.premiumCostSnapshot},
          ${u.premiumRetailAdjustmentSnapshot ?? 0}
        )
      `;
    }

    // 4. Insert generated_bundle_gift_bag
    if (snapshot.giftBag) {
      const g = snapshot.giftBag;
      await tx`
        INSERT INTO generated_bundle_gift_bag (
          generated_bundle_id, gift_bag_option_id,
          name_snapshot, cost_snapshot,
          retail_price_adjustment_snapshot, is_default
        ) VALUES (
          ${bundle.id}, ${g.giftBagOptionId},
          ${g.nameSnapshot}, ${g.costSnapshot},
          ${g.retailPriceAdjustmentSnapshot}, ${g.isDefault}
        )
      `;
    }

    return bundle;
  });
}

/**
 * Finds a bundle by public_id with full aggregate (items, upgrade, gift bag).
 * Returns null if not found (AC5.2, AC9.3).
 */
export async function findBundleByPublicId(
  publicId: string,
): Promise<GeneratedBundleAggregate | null> {
  const bundles = await sql<(GeneratedBundleRow & {
    template_code: string;
    budget_tier_code: string;
  })[]>`
    SELECT gb.*,
           bt.code AS template_code,
           bud.code AS budget_tier_code
    FROM generated_bundle gb
    JOIN bundle_template bt ON bt.id = gb.bundle_template_id
    JOIN budget_tier bud ON bud.id = gb.budget_tier_id
    WHERE gb.public_id = ${publicId}
  `;

  if (bundles.length === 0) return null;

  const bundleRow = bundles[0];

  const [items, upgrades, giftBags] = await Promise.all([
    sql<GeneratedBundleItemRow[]>`
      SELECT * FROM generated_bundle_item
      WHERE generated_bundle_id = ${bundleRow.id}
      ORDER BY display_order ASC
    `,
    sql<GeneratedBundleUpgradeRow[]>`
      SELECT * FROM generated_bundle_upgrade
      WHERE generated_bundle_id = ${bundleRow.id}
    `,
    sql<(GeneratedBundleGiftBagRow & { gift_bag_option_code: string })[]>`
      SELECT gbg.*, gbo.code AS gift_bag_option_code
      FROM generated_bundle_gift_bag gbg
      JOIN gift_bag_option gbo ON gbo.id = gbg.gift_bag_option_id
      WHERE gbg.generated_bundle_id = ${bundleRow.id}
    `,
  ]);

  return {
    bundle: bundleRow,
    templateCode: bundleRow.template_code,
    budgetTierCode: bundleRow.budget_tier_code,
    items,
    upgrade: upgrades[0] ?? null,
    giftBag: giftBags[0]
      ? {
          ...giftBags[0],
          gift_bag_option_code: giftBags[0].gift_bag_option_code,
        }
      : null,
  };
}

/**
 * Returns up to `limit` most recently generated bundles, newest first (AC9.1).
 * Default limit is 200 as required by R9.
 */
export async function listRecentBundles(
  limit = 200,
): Promise<(GeneratedBundleRow & { template_code: string; budget_tier_code: string })[]> {
  return sql<(GeneratedBundleRow & { template_code: string; budget_tier_code: string })[]>`
    SELECT gb.*,
           bt.code AS template_code,
           bud.code AS budget_tier_code
    FROM generated_bundle gb
    JOIN bundle_template bt ON bt.id = gb.bundle_template_id
    JOIN budget_tier bud ON bud.id = gb.budget_tier_id
    ORDER BY gb.created_at DESC
    LIMIT ${limit}
  `;
}
