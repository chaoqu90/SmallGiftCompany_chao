import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 007 — Payment & Shipping
 *
 * Adds shipping address columns to customer_order.
 * payment_intent_id and payment_status already exist as stubs from migration 005.
 *
 * Design: specs/payment/design.md §3
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE customer_order
      ADD COLUMN IF NOT EXISTS shipping_street  VARCHAR(200),
      ADD COLUMN IF NOT EXISTS shipping_city    VARCHAR(100),
      ADD COLUMN IF NOT EXISTS shipping_state   VARCHAR(100),
      ADD COLUMN IF NOT EXISTS shipping_zip     VARCHAR(20),
      ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(2) DEFAULT 'US';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE customer_order
      DROP COLUMN IF EXISTS shipping_street,
      DROP COLUMN IF EXISTS shipping_city,
      DROP COLUMN IF EXISTS shipping_state,
      DROP COLUMN IF EXISTS shipping_zip,
      DROP COLUMN IF EXISTS shipping_country;
  `);
}
