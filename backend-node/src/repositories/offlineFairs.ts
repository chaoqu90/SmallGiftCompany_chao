/**
 * Offline Fair repository.
 *
 * Covers all SQL operations for the offline_fair and offline_fair_sale tables:
 *   - importFair: atomic transaction — INSERT fair, INSERT sale rows, UPDATE inventory
 *   - listFairs: list all fairs ordered by fair_date DESC
 *   - findFairById: single fair lookup for analytics endpoint
 *   - getFairAnalytics: aggregate query for the analytics dashboard
 *   - lookupSkuProducts: batch SKU lookup for import validation
 *
 * Design: specs/analytics/design.md §A, §C.1–C.3
 * Requirements: FEAT-006 R-AF-2 through R-AF-5, R-AD-1 through R-AD-3
 */
import { sql } from '../db.js';
import type { OfflineFairRow, ProductRow } from '../types/entities.js';
import type {
  OfflineFairListItemDto,
  OfflineFairImportResultDto,
  OfflineFairAnalyticsDto,
  FairTopByQuantityItem,
  FairTopByProfitItem,
} from '../types/dtos.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportSaleInput {
  productId: number;
  skuSnapshot: string;
  productNameSnapshot: string;
  unitPrice: number;
  quantitySold: number;
  lineTotal: number;
}

export interface InventoryUpdate {
  productId: number;
  newQty: number;
}

// ─── lookupSkuProducts ────────────────────────────────────────────────────────

/**
 * Batch-loads product rows for an array of SKU strings.
 * Returns a Map keyed by sku (lowercased for comparison).
 * SKUs not in the map = unknown = validation error.
 *
 * Requirements: R-AF-2 (SKU validation)
 */
export async function lookupSkuProducts(skus: string[]): Promise<Map<string, ProductRow>> {
  if (skus.length === 0) return new Map();

  const rows = await sql<ProductRow[]>`
    SELECT id, sku, name, retail_price, inventory_quantity,
           cog_adjusted, active,
           cost, cog_overhead, description, image_url,
           min_age, max_age, category, form_factor, upgrade_tier,
           theme_code, created_at, updated_at
    FROM product
    WHERE sku = ANY(${skus})
  `;

  const map = new Map<string, ProductRow>();
  for (const row of rows) {
    map.set(row.sku, row);
  }
  return map;
}

// ─── importFair ───────────────────────────────────────────────────────────────

/**
 * Atomic import transaction:
 *   1. INSERT offline_fair row
 *   2. INSERT offline_fair_sale rows (only for sold_qty > 0)
 *   3. UPDATE product.inventory_quantity for SKUs with no anomaly
 *
 * Returns the import result summary.
 *
 * Requirements: R-AF-4 (atomicity), R-AF-5 (success summary)
 */
export async function importFair(
  name: string,
  fairDate: string,
  saleRows: ImportSaleInput[],
  inventoryUpdates: InventoryUpdate[],
  warnings: string[],
  skusProcessed: number,
): Promise<OfflineFairImportResultDto> {
  return sql.begin(async (tx) => {
    // Step 1: INSERT offline_fair
    const [fair] = await tx<OfflineFairRow[]>`
      INSERT INTO offline_fair (name, fair_date)
      VALUES (${name}, ${fairDate})
      RETURNING id, name, fair_date, created_at, updated_at, location, notes
    `;

    // Step 2: INSERT offline_fair_sale rows (sold_qty > 0 enforced by caller)
    let saleRowsCreated = 0;
    if (saleRows.length > 0) {
      const insertValues = saleRows.map(r => ({
        offline_fair_id: fair.id,
        product_id: r.productId,
        sku_snapshot: r.skuSnapshot,
        product_name_snapshot: r.productNameSnapshot,
        unit_price: r.unitPrice,
        quantity_sold: r.quantitySold,
        line_total: r.lineTotal,
      }));

      const inserted = await tx`
        INSERT INTO offline_fair_sale ${tx(insertValues)}
        RETURNING id
      `;
      saleRowsCreated = inserted.count;
    }

    // Step 3: UPDATE product.inventory_quantity
    let inventoryUpdated = 0;
    if (inventoryUpdates.length > 0) {
      for (const upd of inventoryUpdates) {
        await tx`
          UPDATE product
          SET inventory_quantity = ${upd.newQty}
          WHERE id = ${upd.productId}
        `;
        inventoryUpdated++;
      }
    }

    return {
      fairId: fair.id,
      fairName: fair.name,
      fairDate: fair.fair_date,
      saleRowsCreated,
      skusProcessed,
      inventoryUpdated,
      warnings,
    };
  });
}

// ─── listFairs ────────────────────────────────────────────────────────────────

/**
 * Returns all fairs ordered by fair_date DESC.
 * Used to populate the dropdown in the admin dashboard.
 *
 * Requirements: R-AD-1
 * Design: C.2
 */
export async function listFairs(): Promise<OfflineFairListItemDto[]> {
  const rows = await sql<OfflineFairRow[]>`
    SELECT id, name, fair_date, created_at
    FROM offline_fair
    ORDER BY fair_date DESC, id DESC
  `;

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    fairDate: r.fair_date,
    createdAt: r.created_at,
  }));
}

// ─── findFairById ─────────────────────────────────────────────────────────────

/**
 * Looks up a single fair by ID.
 * Returns null when not found (caller returns HTTP 404).
 */
export async function findFairById(id: number): Promise<OfflineFairRow | null> {
  const rows = await sql<OfflineFairRow[]>`
    SELECT id, name, fair_date, location, notes, created_at, updated_at
    FROM offline_fair
    WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

// ─── getFairAnalytics ─────────────────────────────────────────────────────────

/**
 * Aggregate query for a single fair's analytics.
 *
 * netIncome uses live product.cog_adjusted joined via product_id.
 * cog_adjusted is stored in RMB; divide by 6.5 to convert to USD before subtracting from USD revenue.
 * Rows where product_id IS NULL contribute 0 COGS (product was deleted).
 *
 * topByQuantity and topByProfit each return up to 5 entries, grouped by sku_snapshot.
 *
 * Requirements: R-AD-2, R-AD-3
 * Design: §C.3
 */
export async function getFairAnalytics(fairId: number): Promise<OfflineFairAnalyticsDto | null> {
  // Confirm fair exists
  const fair = await findFairById(fairId);
  if (!fair) return null;

  // Aggregate totals
  const [totals] = await sql<{
    total_units_sold: string;
    gross_income: string;
    net_income: string;
  }[]>`
    SELECT
      COALESCE(SUM(ofs.quantity_sold), 0)                                        AS total_units_sold,
      COALESCE(SUM(ofs.line_total), 0)                                           AS gross_income,
      COALESCE(SUM(ofs.line_total), 0)
        - COALESCE(SUM(
            CASE WHEN ofs.product_id IS NOT NULL
                 THEN COALESCE(p.cog_adjusted, 0) / 6.5 * ofs.quantity_sold
                 ELSE 0
            END
          ), 0)                                                                    AS net_income
    FROM offline_fair_sale ofs
    LEFT JOIN product p ON p.id = ofs.product_id
    WHERE ofs.offline_fair_id = ${fairId}
  `;

  // Top by quantity
  const topByQuantityRows = await sql<{
    sku_snapshot: string;
    product_name_snapshot: string;
    quantity_sold: string;
  }[]>`
    SELECT
      sku_snapshot,
      product_name_snapshot,
      SUM(quantity_sold)::text AS quantity_sold
    FROM offline_fair_sale
    WHERE offline_fair_id = ${fairId}
    GROUP BY sku_snapshot, product_name_snapshot
    ORDER BY SUM(quantity_sold) DESC
    LIMIT 10
  `;

  // Top by profit
  const topByProfitRows = await sql<{
    sku_snapshot: string;
    product_name_snapshot: string;
    profit: string;
  }[]>`
    SELECT
      ofs.sku_snapshot,
      ofs.product_name_snapshot,
      (SUM(ofs.line_total)
        - SUM(
            CASE WHEN ofs.product_id IS NOT NULL
                 THEN COALESCE(p.cog_adjusted, 0) / 6.5 * ofs.quantity_sold
                 ELSE 0
            END
          ))::text AS profit
    FROM offline_fair_sale ofs
    LEFT JOIN product p ON p.id = ofs.product_id
    WHERE ofs.offline_fair_id = ${fairId}
    GROUP BY ofs.sku_snapshot, ofs.product_name_snapshot
    ORDER BY (SUM(ofs.line_total)
      - SUM(
          CASE WHEN ofs.product_id IS NOT NULL
               THEN COALESCE(p.cog_adjusted, 0) / 6.5 * ofs.quantity_sold
               ELSE 0
          END
        )) DESC
    LIMIT 10
  `;

  const topByQuantity: FairTopByQuantityItem[] = topByQuantityRows.map(r => ({
    sku: r.sku_snapshot,
    productName: r.product_name_snapshot,
    quantitySold: Number(r.quantity_sold),
  }));

  const topByProfit: FairTopByProfitItem[] = topByProfitRows.map(r => ({
    sku: r.sku_snapshot,
    productName: r.product_name_snapshot,
    profit: Number(r.profit),
  }));

  return {
    fairId: fair.id,
    fairName: fair.name,
    fairDate: fair.fair_date,
    totalUnitsSold: Number(totals.total_units_sold),
    grossIncome: Number(totals.gross_income),
    netIncome: Number(totals.net_income),
    topByQuantity,
    topByProfit,
  };
}
