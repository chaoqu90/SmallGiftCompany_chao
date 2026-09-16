import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

/**
 * Migration 011 — Offline Fair Tracking
 *
 * Creates two new tables for recording physical fair sales:
 *   - offline_fair: one row per event (name, date, optional location/notes)
 *   - offline_fair_sale: one row per product sold at a given fair
 *
 * Design principles followed:
 *   - Snapshot immutability: sku_snapshot, product_name_snapshot, unit_price, line_total
 *     are frozen at import time so product edits do not alter historical records.
 *   - Analytics decoupling: product_id FK uses ON DELETE SET NULL so sale records
 *     survive product deletion (same pattern as generated_bundle_item).
 *   - offline_fair_id uses ON DELETE RESTRICT to prevent deleting a fair with sales
 *     (same pattern as customer_order → order_line_item).
 *
 * Both tables are additive — no existing tables are altered.
 *
 * Design: specs/analytics/design.md §A.3, §A.4, §E.1
 * Requirements: FEAT-006 R-AF-4
 */

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {

  // ── 1. Create offline_fair ────────────────────────────────────────────────────

  pgm.createTable('offline_fair', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    name: {
      type: 'varchar(200)',
      notNull: true,
    },
    fair_date: {
      type: 'date',
      notNull: true,
    },
    location: {
      type: 'varchar(300)',
      notNull: false,
    },
    notes: {
      type: 'text',
      notNull: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Index: most recent fairs first (used by list endpoint and dropdown)
  pgm.sql(`
    CREATE INDEX idx_offline_fair_fair_date ON offline_fair(fair_date DESC);
  `);

  // Trigger: keep updated_at current on every UPDATE
  // set_updated_at() function was created in migration 004 (CREATE OR REPLACE).
  pgm.sql(`
    CREATE TRIGGER offline_fair_updated_at
      BEFORE UPDATE ON offline_fair
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ── 2. Create offline_fair_sale ───────────────────────────────────────────────

  pgm.createTable('offline_fair_sale', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    offline_fair_id: {
      type: 'bigint',
      notNull: true,
      references: '"offline_fair"',
      onDelete: 'RESTRICT',
    },
    // Nullable FK — sale record survives product deletion (snapshots keep the data).
    product_id: {
      type: 'bigint',
      notNull: false,
      references: '"product"',
      onDelete: 'SET NULL',
    },
    // Snapshots frozen at import time
    sku_snapshot: {
      type: 'varchar(50)',
      notNull: true,
    },
    product_name_snapshot: {
      type: 'varchar(100)',
      notNull: true,
    },
    // quantity_sold > 0 enforced by CHECK below
    quantity_sold: {
      type: 'smallint',
      notNull: true,
    },
    // unit_price = product.retail_price at import time
    unit_price: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    // line_total = unit_price * quantity_sold, stored explicitly (same pattern as order_line_item)
    line_total: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    notes: {
      type: 'text',
      notNull: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // CHECK constraints
  pgm.sql(`
    ALTER TABLE offline_fair_sale
      ADD CONSTRAINT chk_offline_fair_sale_quantity_sold CHECK (quantity_sold > 0),
      ADD CONSTRAINT chk_offline_fair_sale_unit_price    CHECK (unit_price >= 0),
      ADD CONSTRAINT chk_offline_fair_sale_line_total    CHECK (line_total >= 0);
  `);

  // Indexes
  pgm.sql(`
    CREATE INDEX idx_offline_fair_sale_fair_id
      ON offline_fair_sale(offline_fair_id);
  `);

  pgm.sql(`
    CREATE INDEX idx_offline_fair_sale_product_id
      ON offline_fair_sale(product_id)
      WHERE product_id IS NOT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop trigger before table
  pgm.sql('DROP TRIGGER IF EXISTS offline_fair_updated_at ON offline_fair;');
  // Drop child table first (FK dependency)
  pgm.dropTable('offline_fair_sale');
  pgm.dropTable('offline_fair');
}
