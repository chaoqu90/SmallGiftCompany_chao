/**
 * Migration 002 — Seed reference data.
 *
 * Seeds: budget_tier, bundle_template, bundle_template_slot,
 *        bundle_template_slot_role, gift_bag_option.
 *
 * Equivalent to Flyway V7 + V9 (V7 = initial seed, V9 = recalibrated budget tiers
 * and template deactivation for real product data). Also incorporates V8 real product
 * data but WITHOUT the product rows themselves — products are loaded through the admin
 * API or a future product seed migration.
 *
 * NOTE: READING_PUZZLE_4_ITEM template is set active = false (per V9) because the
 * current product catalog has no products with the PUZZLE role. The BundleTemplateSelector
 * falls back to GENERAL_4_ITEM when the template is inactive.
 */
import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── Budget Tiers (V7 values recalibrated by V9) ────────────────────────────
  pgm.sql(`
    INSERT INTO budget_tier (code, retail_min, retail_max, max_item_cogs, target_retail_price, active)
    VALUES
      ('LOW',  15.00, 25.00,  5.50, 20.00, true),
      ('MID',  28.00, 45.00,  9.00, 36.00, true),
      ('HIGH', 50.00, 75.00, 15.00, 60.00, true)
  `);

  // ── Bundle Templates ───────────────────────────────────────────────────────
  pgm.sql(`
    INSERT INTO bundle_template (code, name, min_age, max_age, active)
    VALUES
      ('GENERAL_4_ITEM',        'General 4-Item Bundle',              6, 12, true),
      ('PRESCHOOL_4_ITEM',      'Preschool 4-Item Bundle',            3,  5, true),
      ('READING_PUZZLE_4_ITEM', 'Reading & Puzzle 4-Item Bundle',     6, 12, false)
  `);

  // ── GENERAL_4_ITEM slots ───────────────────────────────────────────────────
  pgm.sql(`
    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'UTILITY',              1, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';

    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'ACTIVITY',             2, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';

    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'PLAY_WEARABLE_TACTILE', 3, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';

    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'NOVELTY_COLLECTIBLE',  4, true FROM bundle_template WHERE code = 'GENERAL_4_ITEM';
  `);

  pgm.sql(`
    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'UTILITY'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'UTILITY';

    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'ACTIVITY'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'ACTIVITY';

    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, r
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    CROSS JOIN (VALUES ('PLAY'), ('WEARABLE'), ('TACTILE')) AS roles(r)
    WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'PLAY_WEARABLE_TACTILE';

    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, r
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    CROSS JOIN (VALUES ('NOVELTY'), ('COLLECTIBLE')) AS roles(r)
    WHERE t.code = 'GENERAL_4_ITEM' AND s.slot_code = 'NOVELTY_COLLECTIBLE';
  `);

  // ── PRESCHOOL_4_ITEM slots ─────────────────────────────────────────────────
  pgm.sql(`
    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'ACTIVITY',   1, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';

    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'TACTILE',    2, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';

    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'SIMPLE_TOY', 3, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';

    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'NOVELTY',    4, true FROM bundle_template WHERE code = 'PRESCHOOL_4_ITEM';
  `);

  pgm.sql(`
    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'ACTIVITY'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'ACTIVITY';

    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'TACTILE'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'TACTILE';

    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'SIMPLE_TOY'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'SIMPLE_TOY';

    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'NOVELTY'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'PRESCHOOL_4_ITEM' AND s.slot_code = 'NOVELTY';
  `);

  // ── READING_PUZZLE_4_ITEM slots (inactive template, created for future use) ─
  pgm.sql(`
    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'READING', 1, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';

    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'PUZZLE',  2, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';

    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'UTILITY', 3, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';

    INSERT INTO bundle_template_slot (bundle_template_id, slot_code, display_order, required)
    SELECT id, 'NOVELTY', 4, true FROM bundle_template WHERE code = 'READING_PUZZLE_4_ITEM';
  `);

  pgm.sql(`
    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'READING'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'READING';

    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'PUZZLE'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'PUZZLE';

    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'UTILITY'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'UTILITY';

    INSERT INTO bundle_template_slot_role (slot_id, role)
    SELECT s.id, 'NOVELTY'
    FROM bundle_template_slot s
    JOIN bundle_template t ON s.bundle_template_id = t.id
    WHERE t.code = 'READING_PUZZLE_4_ITEM' AND s.slot_code = 'NOVELTY';
  `);

  // ── Gift Bag Options ───────────────────────────────────────────────────────
  pgm.sql(`
    INSERT INTO gift_bag_option (code, name, description, cost, retail_price_adjustment, active, is_default)
    VALUES
      ('CLASSIC_BAG', 'Classic Gift Bag', 'Standard gift bag with tissue paper', 0.50, 0.00, true, true)
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DELETE FROM gift_bag_option`);
  pgm.sql(`DELETE FROM bundle_template_slot_role`);
  pgm.sql(`DELETE FROM bundle_template_slot`);
  pgm.sql(`DELETE FROM bundle_template`);
  pgm.sql(`DELETE FROM budget_tier`);
}
