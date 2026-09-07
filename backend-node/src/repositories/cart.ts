/**
 * Cart repository.
 *
 * All functions are session-isolated — every write operation includes
 * WHERE session_id = $sessionId to prevent cross-session data access.
 *
 * Design references: specs/cart-and-order/design.md §2.2, §5
 * Requirements: AC4.1–AC4.7
 */
import { sql } from '../db.js';
import type { CartItemRow } from '../types/entities.js';

// ─── Detailed cart item (joined with bundle and gift bag data) ────────────────

export interface CartItemDetail {
  // cart_item fields
  id: number;
  session_id: string;
  generated_bundle_id: number;
  upgrade_tier: string;
  gift_bag_option_id: number | null;
  quantity: number;
  created_at: Date;
  updated_at: Date;
  // from generated_bundle
  bundle_public_id: string;
  interest: string;
  requested_age: number;
  party_type: string;
  base_retail_price: string;   // NUMERIC(10,2) as string
  // from generated_bundle_upgrade (may be null if no upgrade configured)
  standard_retail_adj: string | null;   // NUMERIC(10,2) as string
  premium_retail_adj: string | null;    // NUMERIC(10,2) as string
  // from gift_bag_option (may be null)
  gift_bag_name: string | null;
  gift_bag_price_adj: string | null;    // NUMERIC(10,2) as string
}

/**
 * Fetches all cart items for a session with joined bundle and gift bag data.
 * Requirements: AC3.2, AC3.6, AC4.6
 */
export async function getCartWithDetails(sessionId: string): Promise<CartItemDetail[]> {
  return sql<CartItemDetail[]>`
    SELECT
      ci.id,
      ci.session_id,
      ci.generated_bundle_id,
      ci.upgrade_tier,
      ci.gift_bag_option_id,
      ci.quantity,
      ci.created_at,
      ci.updated_at,
      gb.public_id  AS bundle_public_id,
      gb.interest,
      gb.requested_age,
      gb.party_type,
      gb.base_retail_price,
      gbu.standard_retail_adjustment_snapshot AS standard_retail_adj,
      gbu.retail_price_adjustment_snapshot    AS premium_retail_adj,
      gbo.name                                AS gift_bag_name,
      gbo.retail_price_adjustment             AS gift_bag_price_adj
    FROM cart_item ci
    JOIN generated_bundle gb ON gb.id = ci.generated_bundle_id
    LEFT JOIN generated_bundle_upgrade gbu ON gbu.generated_bundle_id = gb.id
    LEFT JOIN gift_bag_option gbo ON gbo.id = ci.gift_bag_option_id
    WHERE ci.session_id = ${sessionId}
    ORDER BY ci.created_at ASC
  `;
}

/**
 * Upserts a cart item on the UNIQUE(session_id, generated_bundle_id) constraint.
 * If a row already exists, updates upgrade_tier, gift_bag_option_id, and
 * increments quantity by the requested amount (AC4.2).
 * Returns the resulting cart item row.
 */
export async function addOrUpdateCartItem(
  sessionId: string,
  generatedBundleId: number,
  upgradeTier: string,
  giftBagOptionId: number | null,
  quantity: number,
): Promise<CartItemRow> {
  const rows = await sql<CartItemRow[]>`
    INSERT INTO cart_item (session_id, generated_bundle_id, upgrade_tier, gift_bag_option_id, quantity)
    VALUES (${sessionId}, ${generatedBundleId}, ${upgradeTier}, ${giftBagOptionId}, ${quantity})
    ON CONFLICT (session_id, generated_bundle_id) DO UPDATE
      SET upgrade_tier       = EXCLUDED.upgrade_tier,
          gift_bag_option_id = EXCLUDED.gift_bag_option_id,
          quantity           = cart_item.quantity + EXCLUDED.quantity,
          updated_at         = now()
    RETURNING *
  `;
  return rows[0];
}

/**
 * Upsert a cart item with exact quantity — used by the checkout intent path.
 * Unlike addOrUpdateCartItem, the ON CONFLICT branch sets quantity = EXCLUDED.quantity
 * (not additive) so checkout retries don't double-count.
 */
export async function upsertCartItemExact(
  sessionId: string,
  generatedBundleId: number,
  upgradeTier: string,
  giftBagOptionId: number | null,
  quantity: number,
): Promise<CartItemRow> {
  const rows = await sql<CartItemRow[]>`
    INSERT INTO cart_item (session_id, generated_bundle_id, upgrade_tier, gift_bag_option_id, quantity)
    VALUES (${sessionId}, ${generatedBundleId}, ${upgradeTier}, ${giftBagOptionId}, ${quantity})
    ON CONFLICT (session_id, generated_bundle_id) DO UPDATE
      SET upgrade_tier       = EXCLUDED.upgrade_tier,
          gift_bag_option_id = EXCLUDED.gift_bag_option_id,
          quantity           = EXCLUDED.quantity,
          updated_at         = now()
    RETURNING *
  `;
  return rows[0];
}

/**
 * Updates upgrade_tier, gift_bag_option_id, or quantity on an existing cart item.
 * WHERE session_id = sessionId enforces session isolation.
 * Returns the updated row or null if not found / not owned by this session.
 * Requirements: AC4.3
 */
export async function updateCartItem(
  id: number,
  sessionId: string,
  data: { upgradeTier?: string; giftBagOptionId?: number | null; quantity?: number },
): Promise<CartItemRow | null> {
  // Fetch the current row first so we can merge partial updates.
  // This avoids fragile CASE/COALESCE SQL when gift_bag_option_id can legitimately be NULL.
  const current = await sql<CartItemRow[]>`
    SELECT * FROM cart_item WHERE id = ${id} AND session_id = ${sessionId}
  `;
  if (current.length === 0) return null;
  const row = current[0];

  const newUpgradeTier      = data.upgradeTier !== undefined       ? data.upgradeTier               : row.upgrade_tier;
  const newGiftBagOptionId  = data.giftBagOptionId !== undefined   ? data.giftBagOptionId            : row.gift_bag_option_id;
  const newQuantity         = data.quantity !== undefined          ? data.quantity                   : row.quantity;

  const rows = await sql<CartItemRow[]>`
    UPDATE cart_item
    SET
      upgrade_tier       = ${newUpgradeTier},
      gift_bag_option_id = ${newGiftBagOptionId},
      quantity           = ${newQuantity},
      updated_at         = now()
    WHERE id = ${id}
      AND session_id = ${sessionId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Deletes a cart item by id, enforcing session ownership.
 * Returns true if a row was deleted, false if not found or not owned.
 * Requirements: AC4.4
 */
export async function removeCartItem(id: number, sessionId: string): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    DELETE FROM cart_item
    WHERE id = ${id}
      AND session_id = ${sessionId}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Deletes all cart items for a session.
 * Used after successful order creation (checkout transaction does this atomically).
 * Requirements: design.md §4 step 5
 */
export async function clearCart(sessionId: string): Promise<void> {
  await sql`
    DELETE FROM cart_item
    WHERE session_id = ${sessionId}
  `;
}

/**
 * Returns the total number of distinct items in the session's cart (sum of quantity).
 * Used by the NavBar badge (AC2.4, AC2.5).
 */
export async function getCartItemCount(sessionId: string): Promise<number> {
  const rows = await sql<{ total: string }[]>`
    SELECT COALESCE(SUM(quantity), 0) AS total
    FROM cart_item
    WHERE session_id = ${sessionId}
  `;
  return Number(rows[0]?.total ?? 0);
}

/**
 * Looks up a generated_bundle by its public_id and returns the internal id.
 * Returns null if not found.
 * Used by the POST /api/cart/items route to resolve bundlePublicId (AC4.1).
 */
export async function findBundleIdByPublicId(publicId: string): Promise<number | null> {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM generated_bundle WHERE public_id = ${publicId}
  `;
  return rows[0]?.id ?? null;
}
