/**
 * Migration 005 — Cart and Order tables.
 *
 * Changes:
 *   1. Add nullable user_id UUID column to generated_bundle with FK → auth.users(id)
 *      ON DELETE SET NULL and partial index for non-null values.
 *
 *   2. Create cart_item table — one row per (user, bundle) combination.
 *      UNIQUE(user_id, generated_bundle_id) prevents duplicate-add bugs.
 *
 *   3. Create customer_order table — named customer_order to avoid SQL reserved
 *      word ORDER. Includes Stripe stub columns (nullable) for future payment
 *      integration without a migration.
 *
 *   4. Create order_line_item table — snapshot of cart_item at checkout time,
 *      prices locked server-side.
 *
 * Design references: specs/cart-and-order/design.md §2
 */
import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── 1. Add user_id to generated_bundle ──────────────────────────────────────
  pgm.addColumn('generated_bundle', {
    user_id: {
      type: 'uuid',
      notNull: false,
    },
  });

  // Cross-schema FK: generated_bundle.user_id → auth.users(id) ON DELETE SET NULL
  pgm.addConstraint(
    'generated_bundle',
    'fk_generated_bundle_user_id',
    'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL',
  );

  // Partial index — only index non-null user_id values (ownership lookups)
  pgm.sql(`
    CREATE INDEX idx_generated_bundle_user_id
      ON generated_bundle(user_id)
      WHERE user_id IS NOT NULL;
  `);

  // ── 2. Create cart_item ──────────────────────────────────────────────────────
  pgm.createTable('cart_item', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    user_id: {
      type: 'uuid',
      notNull: true,
    },
    generated_bundle_id: {
      type: 'bigint',
      notNull: true,
    },
    upgrade_tier: {
      type: 'varchar(20)',
      notNull: true,
      default: 'STANDARD',
    },
    gift_bag_option_id: {
      type: 'bigint',
      notNull: false,
    },
    quantity: {
      type: 'smallint',
      notNull: true,
      default: 1,
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

  // cart_item FKs — cross-schema user_id + same-schema bundle + gift bag
  pgm.addConstraint(
    'cart_item',
    'fk_cart_item_user_id',
    'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
  );
  pgm.addConstraint(
    'cart_item',
    'fk_cart_item_generated_bundle_id',
    'FOREIGN KEY (generated_bundle_id) REFERENCES generated_bundle(id) ON DELETE CASCADE',
  );
  pgm.addConstraint(
    'cart_item',
    'fk_cart_item_gift_bag_option_id',
    'FOREIGN KEY (gift_bag_option_id) REFERENCES gift_bag_option(id) ON DELETE SET NULL',
  );

  // Business constraints
  pgm.addConstraint(
    'cart_item',
    'uq_cart_item_user_bundle',
    'UNIQUE (user_id, generated_bundle_id)',
  );
  pgm.addConstraint(
    'cart_item',
    'chk_cart_item_upgrade_tier',
    "CHECK (upgrade_tier IN ('STANDARD', 'PREMIUM'))",
  );
  pgm.addConstraint(
    'cart_item',
    'chk_cart_item_quantity',
    'CHECK (quantity > 0)',
  );

  // Index for fast user cart lookups
  pgm.createIndex('cart_item', 'user_id', { name: 'idx_cart_item_user_id' });

  // updated_at trigger for cart_item
  pgm.sql(`
    CREATE TRIGGER cart_item_updated_at
      BEFORE UPDATE ON cart_item
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ── 3. Create customer_order ─────────────────────────────────────────────────
  pgm.createTable('customer_order', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    public_id: {
      type: 'varchar(30)',
      notNull: true,
      unique: true,
    },
    user_id: {
      type: 'uuid',
      notNull: true,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'PENDING',
    },
    subtotal: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    total: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    currency: {
      type: 'varchar(3)',
      notNull: true,
      default: 'USD',
    },
    customer_email: {
      type: 'varchar(254)',
      notNull: true,
    },
    customer_name: {
      type: 'varchar(200)',
      notNull: false,
    },
    // Stripe stubs — nullable until payment integration
    payment_intent_id: {
      type: 'varchar(100)',
      notNull: false,
    },
    payment_status: {
      type: 'varchar(20)',
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

  // customer_order FKs
  // ON DELETE RESTRICT: order records must survive for accounting/tax compliance
  pgm.addConstraint(
    'customer_order',
    'fk_customer_order_user_id',
    'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT',
  );

  // Indexes for common query patterns
  pgm.createIndex('customer_order', 'user_id',    { name: 'idx_customer_order_user_id' });
  pgm.createIndex('customer_order', 'created_at', { name: 'idx_customer_order_created_at' });
  pgm.createIndex('customer_order', 'status',     { name: 'idx_customer_order_status' });

  // updated_at trigger for customer_order
  pgm.sql(`
    CREATE TRIGGER customer_order_updated_at
      BEFORE UPDATE ON customer_order
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ── 4. Create order_line_item ────────────────────────────────────────────────
  pgm.createTable('order_line_item', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    customer_order_id: {
      type: 'bigint',
      notNull: true,
    },
    generated_bundle_id: {
      type: 'bigint',
      notNull: true,
    },
    upgrade_tier: {
      type: 'varchar(20)',
      notNull: true,
    },
    gift_bag_option_id: {
      type: 'bigint',
      notNull: false,
    },
    quantity: {
      type: 'smallint',
      notNull: true,
    },
    unit_price: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    line_total: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    // Snapshotted gift bag info at order time (self-contained for accounting)
    gift_bag_name_snapshot: {
      type: 'varchar(100)',
      notNull: false,
    },
    gift_bag_price_snapshot: {
      type: 'numeric(10,2)',
      notNull: false,
    },
  });

  // order_line_item FKs
  pgm.addConstraint(
    'order_line_item',
    'fk_order_line_item_customer_order_id',
    'FOREIGN KEY (customer_order_id) REFERENCES customer_order(id) ON DELETE CASCADE',
  );
  // ON DELETE RESTRICT: blocks bundle deletion if part of any order
  pgm.addConstraint(
    'order_line_item',
    'fk_order_line_item_generated_bundle_id',
    'FOREIGN KEY (generated_bundle_id) REFERENCES generated_bundle(id) ON DELETE RESTRICT',
  );
  pgm.addConstraint(
    'order_line_item',
    'fk_order_line_item_gift_bag_option_id',
    'FOREIGN KEY (gift_bag_option_id) REFERENCES gift_bag_option(id) ON DELETE SET NULL',
  );

  pgm.addConstraint(
    'order_line_item',
    'chk_order_line_item_quantity',
    'CHECK (quantity > 0)',
  );

  pgm.createIndex('order_line_item', 'customer_order_id', {
    name: 'idx_order_line_item_customer_order_id',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop in reverse dependency order
  pgm.sql('DROP TRIGGER IF EXISTS customer_order_updated_at ON customer_order;');
  pgm.sql('DROP TRIGGER IF EXISTS cart_item_updated_at ON cart_item;');

  pgm.dropTable('order_line_item');
  pgm.dropTable('customer_order');
  pgm.dropTable('cart_item');

  pgm.dropConstraint('generated_bundle', 'fk_generated_bundle_user_id');
  pgm.sql('DROP INDEX IF EXISTS idx_generated_bundle_user_id;');
  pgm.dropColumn('generated_bundle', 'user_id');
}
