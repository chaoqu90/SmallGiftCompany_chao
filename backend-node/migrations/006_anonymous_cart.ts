/**
 * Migration 006 — Anonymous cart: replace user_id with session_id.
 *
 * Changes:
 *   1. Drop FK + unique constraint + index on cart_item.user_id
 *   2. Drop cart_item.user_id column
 *   3. Add cart_item.session_id VARCHAR(100) NOT NULL
 *   4. Add UNIQUE(session_id, generated_bundle_id) + index
 *   5. Make customer_order.user_id nullable (drop NOT NULL + old FK + add new nullable FK)
 *   6. Add customer_order.session_id VARCHAR(100) NOT NULL
 *   7. Add indexes on customer_order(customer_email) and customer_order(session_id)
 *
 * Design references: specs/cart-and-order/design.md §2.2, §2.3
 */
import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── 1. cart_item: drop old user_id FK, unique constraint, and index ──────────
  pgm.sql('ALTER TABLE cart_item DROP CONSTRAINT IF EXISTS fk_cart_item_user_id;');
  pgm.sql('ALTER TABLE cart_item DROP CONSTRAINT IF EXISTS uq_cart_item_user_bundle;');
  pgm.sql('DROP INDEX IF EXISTS idx_cart_item_user_id;');

  // ── 2. cart_item: drop user_id column ────────────────────────────────────────
  pgm.sql('ALTER TABLE cart_item DROP COLUMN IF EXISTS user_id;');

  // ── 3. cart_item: add session_id (add with default, then drop default) ───────
  pgm.sql("ALTER TABLE cart_item ADD COLUMN session_id VARCHAR(100) NOT NULL DEFAULT '';");
  pgm.sql('ALTER TABLE cart_item ALTER COLUMN session_id DROP DEFAULT;');

  // ── 4. cart_item: add new unique constraint and index ────────────────────────
  pgm.sql('ALTER TABLE cart_item ADD CONSTRAINT cart_item_session_bundle_unique UNIQUE(session_id, generated_bundle_id);');
  pgm.sql('CREATE INDEX idx_cart_item_session_id ON cart_item(session_id);');

  // ── 5. customer_order: make user_id nullable ──────────────────────────────────
  // Drop the old NOT NULL FK, make column nullable, re-add FK with ON DELETE SET NULL
  pgm.sql('ALTER TABLE customer_order DROP CONSTRAINT IF EXISTS fk_customer_order_user_id;');
  pgm.sql('ALTER TABLE customer_order ALTER COLUMN user_id DROP NOT NULL;');
  pgm.sql('ALTER TABLE customer_order ADD FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;');

  // ── 6. customer_order: add session_id column ─────────────────────────────────
  pgm.sql("ALTER TABLE customer_order ADD COLUMN IF NOT EXISTS session_id VARCHAR(100) NOT NULL DEFAULT '';");
  pgm.sql('ALTER TABLE customer_order ALTER COLUMN session_id DROP DEFAULT;');

  // ── 7. customer_order: add indexes ───────────────────────────────────────────
  pgm.sql('CREATE INDEX idx_customer_order_email ON customer_order(customer_email);');
  pgm.sql('CREATE INDEX idx_customer_order_session ON customer_order(session_id) WHERE session_id IS NOT NULL;');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Reverse in opposite order
  pgm.sql('DROP INDEX IF EXISTS idx_customer_order_session;');
  pgm.sql('DROP INDEX IF EXISTS idx_customer_order_email;');
  pgm.sql('ALTER TABLE customer_order DROP COLUMN IF EXISTS session_id;');
  pgm.sql('ALTER TABLE customer_order ALTER COLUMN user_id SET NOT NULL;');

  pgm.sql('DROP INDEX IF EXISTS idx_cart_item_session_id;');
  pgm.sql('ALTER TABLE cart_item DROP CONSTRAINT IF EXISTS cart_item_session_bundle_unique;');
  pgm.sql('ALTER TABLE cart_item DROP COLUMN IF EXISTS session_id;');
  pgm.sql("ALTER TABLE cart_item ADD COLUMN user_id UUID NOT NULL DEFAULT gen_random_uuid();");
  pgm.sql('ALTER TABLE cart_item ALTER COLUMN user_id DROP DEFAULT;');
}
