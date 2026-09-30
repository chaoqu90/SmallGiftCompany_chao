import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 012 — Punch Box
 *
 * Creates the punch_box and punch_box_item tables, and adds
 * linked_punch_box_id to future_parties.
 *
 * Design: specs/punch-box/design.md §2, §12
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // 1. Create punch_box table
  pgm.sql(`
    CREATE TABLE punch_box (
      id              BIGSERIAL       PRIMARY KEY,
      public_id       VARCHAR(30)     NOT NULL UNIQUE,
      future_party_id BIGINT          REFERENCES future_parties(id) ON DELETE SET NULL,
      slot_count      SMALLINT        NOT NULL CHECK (slot_count IN (30, 50, 70)),
      total_cogs_usd  NUMERIC(10,2)   NOT NULL,
      retail_price    NUMERIC(10,2)   NOT NULL,
      profit_usd      NUMERIC(10,2)   NOT NULL,
      status          VARCHAR(20)     NOT NULL DEFAULT 'ASSIGNED'
                        CHECK (status IN ('ASSIGNED', 'ORDERED')),
      created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
    );
  `);

  // 2. Create punch_box_item table
  pgm.sql(`
    CREATE TABLE punch_box_item (
      id                    BIGSERIAL     PRIMARY KEY,
      punch_box_id          BIGINT        NOT NULL REFERENCES punch_box(id) ON DELETE CASCADE,
      product_id            BIGINT        REFERENCES product(id) ON DELETE SET NULL,
      product_name_snapshot VARCHAR(200)  NOT NULL,
      sku_snapshot          VARCHAR(100)  NOT NULL,
      cost_snapshot         NUMERIC(10,2) NOT NULL,
      quantity              SMALLINT      NOT NULL CHECK (quantity >= 1),
      display_order         SMALLINT      NOT NULL
    );
  `);

  // 3. Add linked_punch_box_id to future_parties
  pgm.sql(`
    ALTER TABLE future_parties
      ADD COLUMN linked_punch_box_id BIGINT REFERENCES punch_box(id) ON DELETE SET NULL;
  `);

  // 4. Indexes
  pgm.sql(`
    CREATE INDEX idx_punch_box_future_party_id ON punch_box(future_party_id);
    CREATE INDEX idx_punch_box_created_at ON punch_box(created_at DESC);
    CREATE INDEX idx_punch_box_status ON punch_box(status);
    CREATE INDEX idx_punch_box_item_punch_box_id ON punch_box_item(punch_box_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE future_parties DROP COLUMN IF EXISTS linked_punch_box_id;`);
  pgm.sql(`DROP TABLE IF EXISTS punch_box_item;`);
  pgm.sql(`DROP TABLE IF EXISTS punch_box;`);
}
