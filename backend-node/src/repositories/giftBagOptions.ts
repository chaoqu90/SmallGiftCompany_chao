/**
 * Gift bag option repository.
 */
import { sql } from '../db.js';
import type { GiftBagOptionRow } from '../types/entities.js';

/**
 * Finds the default gift bag option.
 * Returns null if none configured (triggers NO_GIFT_BAG_CONFIGURED).
 */
export async function findDefaultGiftBag(): Promise<GiftBagOptionRow | null> {
  const rows = await sql<GiftBagOptionRow[]>`
    SELECT * FROM gift_bag_option
    WHERE is_default = true AND active = true
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Returns all active gift bag options.
 */
export async function listGiftBagOptions(): Promise<GiftBagOptionRow[]> {
  return sql<GiftBagOptionRow[]>`
    SELECT * FROM gift_bag_option
    WHERE active = true
    ORDER BY name ASC
  `;
}
