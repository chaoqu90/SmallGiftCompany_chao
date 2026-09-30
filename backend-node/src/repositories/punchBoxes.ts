/**
 * Punch Box repository.
 *
 * All DB queries use the singleton postgres.js tagged-template client.
 * NUMERIC columns come back as strings from postgres.js — cast with
 * parseFloat() in the service/route layer when building DTOs.
 *
 * Requirements: AC4.3, AC4.4, AC4.6, AC5.4, AC5.5, ACPV.3, R8 (AC8.5)
 * Design: specs/punch-box/design.md §6, §10
 */
import { randomBytes } from 'crypto';
import { sql } from '../db.js';
import type { PunchBoxRow, PunchBoxItemRow, ProductRow } from '../types/entities.js';

// ─── Snapshot types ───────────────────────────────────────────────────────────

export interface PunchBoxItemSnapshot {
  productId:           number;
  productNameSnapshot: string;
  skuSnapshot:         string;
  costSnapshot:        number;    // product.cost in RMB
  quantity:            number;
  displayOrder:        number;
}

export interface PunchBoxSnapshot {
  futurePartyId?: number | null;
  slotCount:      number;
  retailPrice:    number;
  totalCogsUsd:   number;
  profitUsd:      number;
  items:          PunchBoxItemSnapshot[];
}

export interface PunchBoxItemPatch {
  quantity?:           number;
  productId?:          number;
  productNameSnapshot?: string;
  skuSnapshot?:        string;
  costSnapshot?:       number;
}

export interface PunchBoxAggregate {
  punchBox: PunchBoxRow;
  items:    PunchBoxItemRow[];
}

// ─── savePunchBox ─────────────────────────────────────────────────────────────

/**
 * Inserts a punch_box + all punch_box_item rows + optionally updates
 * future_parties.linked_punch_box_id, all in a single transaction.
 * Generates public_id = pb_<12-char-hex> server-side (AC4.6).
 * Requirements: AC4.3, AC4.4
 */
export async function savePunchBox(snapshot: PunchBoxSnapshot): Promise<PunchBoxRow> {
  const publicId = `pb_${randomBytes(6).toString('hex')}`;

  return await sql.begin(async (tx) => {
    // 1. Insert punch_box
    const boxes = await tx<PunchBoxRow[]>`
      INSERT INTO punch_box (
        public_id,
        future_party_id,
        slot_count,
        total_cogs_usd,
        retail_price,
        profit_usd,
        status,
        created_at
      ) VALUES (
        ${publicId},
        ${snapshot.futurePartyId ?? null},
        ${snapshot.slotCount},
        ${snapshot.totalCogsUsd},
        ${snapshot.retailPrice},
        ${snapshot.profitUsd},
        'ASSIGNED',
        now()
      )
      RETURNING *
    `;
    const box = boxes[0];

    // 2. Insert all punch_box_item rows
    if (snapshot.items.length > 0) {
      const itemRows = snapshot.items.map(item => ({
        punch_box_id:          box.id,
        product_id:            item.productId,
        product_name_snapshot: item.productNameSnapshot,
        sku_snapshot:          item.skuSnapshot,
        cost_snapshot:         item.costSnapshot,
        quantity:              item.quantity,
        display_order:         item.displayOrder,
      }));
      await tx`INSERT INTO punch_box_item ${tx(itemRows)}`;
    }

    // 3. Optionally link to future party
    if (snapshot.futurePartyId) {
      await tx`
        UPDATE future_parties
        SET linked_punch_box_id = ${box.id}
        WHERE id = ${snapshot.futurePartyId}
      `;
    }

    return box;
  });
}

// ─── listPunchBoxes ───────────────────────────────────────────────────────────

/**
 * Returns up to `limit` punch boxes, newest first.
 * Default limit is 200 (no pagination needed for MVP).
 * Design: specs/punch-box/design.md §5.5
 */
export async function listPunchBoxes(limit = 200): Promise<PunchBoxRow[]> {
  return sql<PunchBoxRow[]>`
    SELECT * FROM punch_box
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

// ─── findPunchBoxByPublicId ───────────────────────────────────────────────────

/**
 * Returns the full punch box aggregate (punch_box row + all item rows).
 * Returns null if no punch box with that public_id exists.
 * Design: specs/punch-box/design.md §5.6
 */
export async function findPunchBoxByPublicId(
  publicId: string,
): Promise<PunchBoxAggregate | null> {
  const boxes = await sql<PunchBoxRow[]>`
    SELECT * FROM punch_box WHERE public_id = ${publicId}
  `;
  if (boxes.length === 0) return null;

  const box = boxes[0];
  const items = await sql<PunchBoxItemRow[]>`
    SELECT * FROM punch_box_item
    WHERE punch_box_id = ${box.id}
    ORDER BY display_order ASC
  `;

  return { punchBox: box, items };
}

// ─── patchPunchBoxItem ────────────────────────────────────────────────────────

/**
 * Updates a single punch_box_item (quantity and/or product swap).
 * After the update, recomputes total_cogs_usd and profit_usd on the
 * parent punch_box row and saves them.
 * Returns the updated full aggregate.
 * Design: specs/punch-box/design.md §5.7
 */
export async function patchPunchBoxItem(
  punchBoxId: number,
  itemId: number,
  patch: PunchBoxItemPatch,
): Promise<PunchBoxAggregate> {
  // Build SET clauses conditionally
  if (
    patch.quantity !== undefined &&
    patch.productId === undefined
  ) {
    // Quantity-only update
    await sql`
      UPDATE punch_box_item
      SET quantity = ${patch.quantity}
      WHERE id = ${itemId} AND punch_box_id = ${punchBoxId}
    `;
  } else if (patch.productId !== undefined) {
    // Product swap — update product snapshot fields; optionally also update quantity
    if (patch.quantity !== undefined) {
      await sql`
        UPDATE punch_box_item
        SET
          product_id            = ${patch.productId},
          product_name_snapshot = ${patch.productNameSnapshot ?? ''},
          sku_snapshot          = ${patch.skuSnapshot ?? ''},
          cost_snapshot         = ${patch.costSnapshot ?? 0},
          quantity              = ${patch.quantity}
        WHERE id = ${itemId} AND punch_box_id = ${punchBoxId}
      `;
    } else {
      await sql`
        UPDATE punch_box_item
        SET
          product_id            = ${patch.productId},
          product_name_snapshot = ${patch.productNameSnapshot ?? ''},
          sku_snapshot          = ${patch.skuSnapshot ?? ''},
          cost_snapshot         = ${patch.costSnapshot ?? 0}
        WHERE id = ${itemId} AND punch_box_id = ${punchBoxId}
      `;
    }
  }

  // Recompute total_cogs_usd from all current items
  await sql`
    UPDATE punch_box pb
    SET
      total_cogs_usd = (
        SELECT COALESCE(SUM(pbi.cost_snapshot::numeric / 6.5 * pbi.quantity), 0)
        FROM punch_box_item pbi
        WHERE pbi.punch_box_id = pb.id
      ),
      profit_usd = pb.retail_price - (
        SELECT COALESCE(SUM(pbi.cost_snapshot::numeric / 6.5 * pbi.quantity), 0)
        FROM punch_box_item pbi
        WHERE pbi.punch_box_id = pb.id
      )
    WHERE pb.id = ${punchBoxId}
  `;

  // Return updated aggregate
  const boxes = await sql<PunchBoxRow[]>`
    SELECT * FROM punch_box WHERE id = ${punchBoxId}
  `;
  const items = await sql<PunchBoxItemRow[]>`
    SELECT * FROM punch_box_item
    WHERE punch_box_id = ${punchBoxId}
    ORDER BY display_order ASC
  `;

  return { punchBox: boxes[0], items };
}

// ─── markPunchBoxOrdered ──────────────────────────────────────────────────────

/**
 * Atomically deducts inventory per item and sets punch_box.status = 'ORDERED'.
 * Negative inventory is allowed (AC5.5).
 * Design: specs/punch-box/design.md §5.8
 */
export async function markPunchBoxOrdered(
  id: number,
  items: PunchBoxItemRow[],
): Promise<void> {
  await sql.begin(async (tx) => {
    // Deduct inventory for each item (skip if product_id is null)
    for (const item of items) {
      if (item.product_id !== null) {
        await tx`
          UPDATE product
          SET inventory_quantity = inventory_quantity - ${item.quantity}
          WHERE id = ${item.product_id}
        `;
      }
    }

    // Mark punch box as ORDERED
    await tx`
      UPDATE punch_box SET status = 'ORDERED' WHERE id = ${id}
    `;
  });
}

// ─── Helper: load product rows by IDs ────────────────────────────────────────

/**
 * Load product rows for a list of IDs. Returns them keyed by id for easy lookup.
 * Used by the route layer when computing server-side COGS.
 */
export async function loadProductsByIds(
  productIds: number[],
): Promise<Map<number, ProductRow>> {
  if (productIds.length === 0) return new Map();
  const rows = await sql<ProductRow[]>`
    SELECT * FROM product WHERE id = ANY(${sql(productIds)})
  `;
  const map = new Map<number, ProductRow>();
  for (const row of rows) map.set(Number(row.id), row);
  return map;
}
