/**
 * Admin analytics repository — online shopping analytics and inventory insights.
 *
 * getOnlineAnalytics: live aggregate queries across customer_order,
 *   order_line_item, and generated_bundle_item for a given date range.
 *   Only includes orders with status IN ('CONFIRMED','SHIPPED','FULFILLED','COMPLETED').
 *
 * getInventoryInsights: low-stock list and fast-moving products (last 30 days,
 *   combining online and offline channels).
 *
 * All queries use sql tagged templates (postgres.js). No ORM.
 *
 * Design: specs/analytics/design.md §B, §C.4, §C.5
 * Requirements: FEAT-006 R-AO-1 through R-AO-4, R-AI-1 through R-AI-3
 */
import { sql } from '../db.js';
import type {
  OnlineAnalyticsDto,
  OnlineTopByUnitsItem,
  OnlineTopByProfitItem,
  InventoryInsightsDto,
  LowStockProductDto,
  FastMovingProductDto,
  InventoryUrgency,
} from '../types/dtos.js';

// Fixed business constants — not configurable from UI (design.md §C.5)
const QUALIFYING_STATUSES = ['CONFIRMED', 'SHIPPED', 'FULFILLED', 'COMPLETED'];
const LOW_STOCK_THRESHOLD = 10;
const FAST_MOVING_WINDOW_DAYS = 30;

// ─── getOnlineAnalytics ───────────────────────────────────────────────────────

/**
 * Compute online shopping analytics for the given inclusive date range.
 *
 * dateFrom: YYYY-MM-DD — applied as 00:00:00 UTC (start of day)
 * dateTo:   YYYY-MM-DD — applied as 23:59:59 UTC (end of day)
 *
 * Requirements: R-AO-2, R-AO-3, R-AO-4
 * Design: §C.4
 */
export async function getOnlineAnalytics(
  dateFrom: string,
  dateTo: string,
): Promise<OnlineAnalyticsDto> {

  // Summary metrics: totalUnitsSold, grossIncome, netIncome
  const [totals] = await sql<{
    total_units_sold: string;
    gross_income: string;
    net_income: string;
  }[]>`
    SELECT
      COALESCE(SUM(oli.quantity * gbi.quantity_per_bag), 0)::text             AS total_units_sold,
      COALESCE(SUM(oli.line_total), 0)::text                                  AS gross_income,
      (COALESCE(SUM(oli.line_total), 0)
        - COALESCE(SUM(
            gbi.cost_snapshot::numeric / 6.5 * oli.quantity * gbi.quantity_per_bag
          ), 0))::text                                                          AS net_income
    FROM customer_order co
    JOIN order_line_item oli ON oli.customer_order_id = co.id
    JOIN generated_bundle_item gbi ON gbi.generated_bundle_id = oli.generated_bundle_id
    WHERE co.status = ANY(${sql.array(QUALIFYING_STATUSES)})
      AND co.created_at >= (${dateFrom}::date)::timestamptz
      AND co.created_at <= ((${dateTo}::date) + INTERVAL '1 day' - INTERVAL '1 second')
  `;

  // Top 5 by units sold, grouped by product
  const topByUnitsRows = await sql<{
    sku_snapshot: string;
    product_name_snapshot: string;
    units_sold: string;
  }[]>`
    SELECT
      gbi.sku_snapshot,
      gbi.product_name_snapshot,
      SUM(oli.quantity * gbi.quantity_per_bag)::text AS units_sold
    FROM customer_order co
    JOIN order_line_item oli ON oli.customer_order_id = co.id
    JOIN generated_bundle_item gbi ON gbi.generated_bundle_id = oli.generated_bundle_id
    WHERE co.status = ANY(${sql.array(QUALIFYING_STATUSES)})
      AND co.created_at >= (${dateFrom}::date)::timestamptz
      AND co.created_at <= ((${dateTo}::date) + INTERVAL '1 day' - INTERVAL '1 second')
    GROUP BY gbi.product_id, gbi.sku_snapshot, gbi.product_name_snapshot
    ORDER BY SUM(oli.quantity * gbi.quantity_per_bag) DESC
    LIMIT 10
  `;

  // Top 5 by estimated profit per product.
  // Revenue per product slot = line_total / (number of distinct slots in that bundle).
  // This is an approximation per R-AO-4 — labeled estimatedProfit in the response.
  const topByProfitRows = await sql<{
    sku_snapshot: string;
    product_name_snapshot: string;
    estimated_profit: string;
  }[]>`
    WITH bundle_slot_counts AS (
      SELECT generated_bundle_id, COUNT(*) AS slot_count
      FROM generated_bundle_item
      GROUP BY generated_bundle_id
    ),
    qualifying_rows AS (
      SELECT
        gbi.product_id,
        gbi.sku_snapshot,
        gbi.product_name_snapshot,
        gbi.cost_snapshot::numeric / 6.5   AS cost_per_unit,
        gbi.quantity_per_bag,
        oli.quantity,
        oli.line_total::numeric           AS line_total,
        bsc.slot_count
      FROM customer_order co
      JOIN order_line_item oli ON oli.customer_order_id = co.id
      JOIN generated_bundle_item gbi ON gbi.generated_bundle_id = oli.generated_bundle_id
      JOIN bundle_slot_counts bsc ON bsc.generated_bundle_id = gbi.generated_bundle_id
      WHERE co.status = ANY(${sql.array(QUALIFYING_STATUSES)})
        AND co.created_at >= (${dateFrom}::date)::timestamptz
        AND co.created_at <= ((${dateTo}::date) + INTERVAL '1 day' - INTERVAL '1 second')
    )
    SELECT
      sku_snapshot,
      product_name_snapshot,
      SUM(
        (line_total / NULLIF(slot_count, 0))
        - (cost_per_unit * quantity * quantity_per_bag)
      )::text AS estimated_profit
    FROM qualifying_rows
    GROUP BY product_id, sku_snapshot, product_name_snapshot
    ORDER BY SUM(
      (line_total / NULLIF(slot_count, 0))
      - (cost_per_unit * quantity * quantity_per_bag)
    ) DESC
    LIMIT 10
  `;

  const topByUnits: OnlineTopByUnitsItem[] = topByUnitsRows.map(r => ({
    sku: r.sku_snapshot,
    productName: r.product_name_snapshot,
    unitsSold: Number(r.units_sold),
  }));

  const topByProfit: OnlineTopByProfitItem[] = topByProfitRows.map(r => ({
    sku: r.sku_snapshot,
    productName: r.product_name_snapshot,
    estimatedProfit: Number(r.estimated_profit),
  }));

  return {
    dateFrom,
    dateTo,
    totalUnitsSold: Number(totals.total_units_sold),
    grossIncome: Number(totals.gross_income),
    netIncome: Number(totals.net_income),
    topByUnits,
    topByProfit,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUrgency(qty: number): InventoryUrgency {
  if (qty === 0) return 'CRITICAL';
  if (qty <= 3)  return 'VERY_LOW';
  return 'LOW';
}

// ─── getInventoryInsights ─────────────────────────────────────────────────────

/**
 * Returns low-stock products (inventory_quantity <= 10) and fast-moving products
 * (combined online + offline units sold in the last 30 calendar days).
 *
 * Fast-moving logic (R-AI-2):
 *   Online:  qualifying orders with created_at >= now() - 30 days
 *   Offline: offline_fair_sale rows from fairs with fair_date >= today - 30 days
 *   Merged by product_id where available; product_id=NULL rows counted by sku_snapshot.
 *
 * Requirements: R-AI-1, R-AI-2, R-AI-3
 * Design: §C.5
 */
export async function getInventoryInsights(): Promise<InventoryInsightsDto> {

  // Low stock: active products with inventory_quantity <= threshold, ASC, up to 10.
  // Products with 0 units appear first (lowest inventory_quantity).
  const lowStockRows = await sql<{
    id: number;
    sku: string;
    name: string;
    inventory_quantity: number;
  }[]>`
    SELECT id, sku, name, inventory_quantity
    FROM product
    WHERE active = true
      AND inventory_quantity <= ${LOW_STOCK_THRESHOLD}
    ORDER BY inventory_quantity ASC, id ASC
    LIMIT 10
  `;

  const lowStock: LowStockProductDto[] = lowStockRows.map(r => ({
    productId: r.id,
    sku: r.sku,
    name: r.name,
    inventoryQuantity: r.inventory_quantity,
    urgency: toUrgency(r.inventory_quantity),
  }));

  // Fast-moving: union online + offline channels, merged by product_id
  const fastMovingRows = await sql<{
    product_id: string | null;
    sku: string;
    name: string;
    units_sold: string;
    inventory_quantity: number;
  }[]>`
    WITH online_units AS (
      SELECT
        gbi.product_id::text                          AS product_id,
        gbi.sku_snapshot                              AS sku,
        gbi.product_name_snapshot                     AS name,
        SUM(oli.quantity * gbi.quantity_per_bag)      AS units_sold
      FROM customer_order co
      JOIN order_line_item oli ON oli.customer_order_id = co.id
      JOIN generated_bundle_item gbi ON gbi.generated_bundle_id = oli.generated_bundle_id
      WHERE co.status = ANY(${sql.array(QUALIFYING_STATUSES)})
        AND co.created_at >= now() - (${FAST_MOVING_WINDOW_DAYS} * INTERVAL '1 day')
      GROUP BY gbi.product_id, gbi.sku_snapshot, gbi.product_name_snapshot
    ),
    offline_units AS (
      SELECT
        ofs.product_id::text                          AS product_id,
        ofs.sku_snapshot                              AS sku,
        ofs.product_name_snapshot                     AS name,
        SUM(ofs.quantity_sold)                        AS units_sold
      FROM offline_fair_sale ofs
      JOIN offline_fair f ON f.id = ofs.offline_fair_id
      WHERE f.fair_date >= CURRENT_DATE - (${FAST_MOVING_WINDOW_DAYS} * INTERVAL '1 day')
      GROUP BY ofs.product_id, ofs.sku_snapshot, ofs.product_name_snapshot
    ),
    combined AS (
      SELECT product_id, sku, name, units_sold FROM online_units
      UNION ALL
      SELECT product_id, sku, name, units_sold FROM offline_units
    ),
    merged AS (
      -- Group by product_id when available; treat NULL product_id as distinct sku groups
      SELECT
        product_id,
        sku,
        name,
        SUM(units_sold) AS total_units
      FROM combined
      GROUP BY product_id, sku, name
    )
    SELECT
      m.product_id,
      m.sku,
      m.name,
      m.total_units::text                    AS units_sold,
      COALESCE(p.inventory_quantity, 0)      AS inventory_quantity
    FROM merged m
    LEFT JOIN product p ON p.id::text = m.product_id
    ORDER BY m.total_units DESC
    LIMIT 10
  `;

  const fastMoving: FastMovingProductDto[] = fastMovingRows.map(r => ({
    productId: r.product_id != null ? Number(r.product_id) : 0,
    sku: r.sku,
    name: r.name,
    unitsSoldLast30Days: Number(r.units_sold),
    inventoryQuantity: r.inventory_quantity,
  }));

  return {
    lowStock,
    fastMoving,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    fastMovingWindowDays: FAST_MOVING_WINDOW_DAYS,
  };
}
