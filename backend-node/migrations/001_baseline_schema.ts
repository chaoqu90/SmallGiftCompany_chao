/**
 * Migration 001 — Baseline schema.
 *
 * Creates all tables from the Spring Boot entity model, consolidated from
 * Flyway migrations V2–V6, V13, V19–V22. This is a clean-slate migration for
 * the Node.js + Supabase deployment — it does NOT run on the existing Spring Boot
 * database; it targets a fresh PostgreSQL instance.
 *
 * Tables created:
 *   product, product_interest_affinity, product_audience_affinity,
 *   product_role_affinity, product_occasion, budget_tier, bundle_template,
 *   bundle_template_slot, bundle_template_slot_role, gift_bag_option,
 *   generated_bundle, generated_bundle_item, generated_bundle_upgrade,
 *   generated_bundle_gift_bag
 *
 * All column definitions match the Spring Boot JPA entity definitions exactly
 * (see backend/src/main/java/org/example/backend/catalog/*.java).
 */
import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── product ────────────────────────────────────────────────────────────────
  pgm.createTable('product', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    sku: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    image_url: {
      type: 'varchar(500)',
    },
    cost: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    cog_overhead: {
      type: 'numeric(10,2)',
      notNull: true,
      default: 0,
    },
    cog_adjusted: {
      type: 'numeric(10,2)',
      notNull: true,
      default: 0,
    },
    retail_price: {
      type: 'numeric(10,2)',
      notNull: true,
      default: 0,
    },
    inventory_quantity: {
      type: 'integer',
      notNull: true,
    },
    active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    min_age: {
      type: 'smallint',
      notNull: true,
    },
    max_age: {
      type: 'smallint',
      notNull: true,
    },
    category: {
      type: 'varchar(30)',
      notNull: true,
    },
    form_factor: {
      type: 'varchar(30)',
      notNull: true,
    },
    upgrade_tier: {
      type: 'varchar(20)',
      notNull: true,
      default: "'STANDARD'",
    },
    theme_code: {
      type: 'varchar(50)',
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

  pgm.createIndex('product', 'name');
  pgm.createIndex('product', 'active');
  pgm.createIndex('product', 'upgrade_tier');

  // ── product_interest_affinity ──────────────────────────────────────────────
  pgm.createTable('product_interest_affinity', {
    product_id: {
      type: 'bigint',
      notNull: true,
      references: '"product"',
      onDelete: 'CASCADE',
    },
    interest: {
      type: 'varchar(30)',
      notNull: true,
    },
    weight: {
      type: 'smallint',
      notNull: true,
    },
  });
  pgm.addConstraint('product_interest_affinity', 'pk_product_interest_affinity', 'PRIMARY KEY (product_id, interest)');
  pgm.addConstraint('product_interest_affinity', 'chk_interest_weight', 'CHECK (weight >= 0 AND weight <= 100)');

  // ── product_audience_affinity ──────────────────────────────────────────────
  pgm.createTable('product_audience_affinity', {
    product_id: {
      type: 'bigint',
      notNull: true,
      references: '"product"',
      onDelete: 'CASCADE',
    },
    audience: {
      type: 'varchar(20)',
      notNull: true,
    },
    weight: {
      type: 'smallint',
      notNull: true,
    },
  });
  pgm.addConstraint('product_audience_affinity', 'pk_product_audience_affinity', 'PRIMARY KEY (product_id, audience)');
  pgm.addConstraint('product_audience_affinity', 'chk_audience_weight', 'CHECK (weight >= 0 AND weight <= 100)');

  // ── product_role_affinity ──────────────────────────────────────────────────
  pgm.createTable('product_role_affinity', {
    product_id: {
      type: 'bigint',
      notNull: true,
      references: '"product"',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'varchar(20)',
      notNull: true,
    },
    weight: {
      type: 'smallint',
      notNull: true,
    },
  });
  pgm.addConstraint('product_role_affinity', 'pk_product_role_affinity', 'PRIMARY KEY (product_id, role)');
  pgm.addConstraint('product_role_affinity', 'chk_role_weight', 'CHECK (weight >= 0 AND weight <= 100)');

  // ── product_occasion ──────────────────────────────────────────────────────
  pgm.createTable('product_occasion', {
    product_id: {
      type: 'bigint',
      notNull: true,
      references: '"product"',
      onDelete: 'CASCADE',
    },
    occasion: {
      type: 'varchar(20)',
      notNull: true,
    },
  });
  pgm.addConstraint('product_occasion', 'pk_product_occasion', 'PRIMARY KEY (product_id, occasion)');

  // ── budget_tier ────────────────────────────────────────────────────────────
  pgm.createTable('budget_tier', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    code: {
      type: 'varchar(10)',
      notNull: true,
      unique: true,
    },
    retail_min: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    retail_max: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    max_item_cogs: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    target_retail_price: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
  });

  // ── bundle_template ────────────────────────────────────────────────────────
  pgm.createTable('bundle_template', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    code: {
      type: 'varchar(30)',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    min_age: {
      type: 'smallint',
      notNull: true,
    },
    max_age: {
      type: 'smallint',
      notNull: true,
    },
    active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
  });

  // ── bundle_template_slot ───────────────────────────────────────────────────
  pgm.createTable('bundle_template_slot', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    bundle_template_id: {
      type: 'bigint',
      notNull: true,
      references: '"bundle_template"',
      onDelete: 'CASCADE',
    },
    slot_code: {
      type: 'varchar(30)',
      notNull: true,
    },
    display_order: {
      type: 'smallint',
      notNull: true,
    },
    required: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
  });

  pgm.createIndex('bundle_template_slot', 'bundle_template_id');

  // ── bundle_template_slot_role ──────────────────────────────────────────────
  pgm.createTable('bundle_template_slot_role', {
    slot_id: {
      type: 'bigint',
      notNull: true,
      references: '"bundle_template_slot"',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'varchar(20)',
      notNull: true,
    },
  });
  pgm.addConstraint('bundle_template_slot_role', 'pk_bundle_template_slot_role', 'PRIMARY KEY (slot_id, role)');

  // ── gift_bag_option ────────────────────────────────────────────────────────
  pgm.createTable('gift_bag_option', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    code: {
      type: 'varchar(30)',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    cost: {
      type: 'numeric(10,2)',
      notNull: true,
      default: 0,
    },
    retail_price_adjustment: {
      type: 'numeric(10,2)',
      notNull: true,
      default: 0,
    },
    active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    is_default: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });

  // ── generated_bundle ───────────────────────────────────────────────────────
  pgm.createTable('generated_bundle', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    public_id: {
      type: 'varchar(30)',
      notNull: true,
      unique: true,
    },
    session_id: {
      type: 'varchar(100)',
    },
    requested_age: {
      type: 'smallint',
      notNull: true,
    },
    audience_preference: {
      type: 'varchar(20)',
      notNull: true,
    },
    interest: {
      type: 'varchar(30)',
      notNull: true,
    },
    party_type: {
      type: 'varchar(20)',
      notNull: true,
    },
    budget_tier_id: {
      type: 'bigint',
      notNull: true,
      references: '"budget_tier"',
    },
    bundle_template_id: {
      type: 'bigint',
      notNull: true,
      references: '"bundle_template"',
    },
    base_retail_price: {
      type: 'numeric(10,2)',
    },
    standard_item_cogs_snapshot: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: "'GENERATED'",
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    expires_at: {
      type: 'timestamptz',
    },
  });

  pgm.createIndex('generated_bundle', 'created_at');
  pgm.createIndex('generated_bundle', 'public_id');

  // ── generated_bundle_item ──────────────────────────────────────────────────
  pgm.createTable('generated_bundle_item', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    generated_bundle_id: {
      type: 'bigint',
      notNull: true,
      references: '"generated_bundle"',
      onDelete: 'CASCADE',
    },
    slot_code: {
      type: 'varchar(30)',
      notNull: true,
    },
    product_id: {
      type: 'bigint',
      notNull: true,
      references: '"product"',
    },
    product_name_snapshot: {
      type: 'varchar(100)',
      notNull: true,
    },
    sku_snapshot: {
      type: 'varchar(50)',
      notNull: true,
    },
    cost_snapshot: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    description_snapshot: {
      type: 'text',
    },
    form_factor_snapshot: {
      type: 'varchar(30)',
      notNull: true,
    },
    quantity_per_bag: {
      type: 'smallint',
      notNull: true,
      default: 1,
    },
    display_order: {
      type: 'smallint',
      notNull: true,
    },
  });

  pgm.createIndex('generated_bundle_item', 'generated_bundle_id');
  pgm.createIndex('generated_bundle_item', 'product_id');

  // ── generated_bundle_upgrade ───────────────────────────────────────────────
  pgm.createTable('generated_bundle_upgrade', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    generated_bundle_id: {
      type: 'bigint',
      notNull: true,
      unique: true,
      references: '"generated_bundle"',
      onDelete: 'CASCADE',
    },
    // Standard product fields (added in Flyway V13)
    standard_product_id: {
      type: 'bigint',
      references: '"product"',
    },
    standard_product_name_snapshot: {
      type: 'varchar(100)',
    },
    standard_sku_snapshot: {
      type: 'varchar(50)',
    },
    standard_cost_snapshot: {
      type: 'numeric(10,2)',
    },
    standard_retail_adjustment_snapshot: {
      type: 'numeric(10,2)',
      default: 0,
    },
    // Premium product fields
    product_id: {
      type: 'bigint',
      references: '"product"',
    },
    product_name_snapshot: {
      type: 'varchar(100)',
    },
    sku_snapshot: {
      type: 'varchar(50)',
    },
    cost_snapshot: {
      type: 'numeric(10,2)',
    },
    retail_price_adjustment_snapshot: {
      type: 'numeric(10,2)',
      default: 0,
    },
  });

  // ── generated_bundle_gift_bag ──────────────────────────────────────────────
  pgm.createTable('generated_bundle_gift_bag', {
    generated_bundle_id: {
      type: 'bigint',
      primaryKey: true,
      references: '"generated_bundle"',
      onDelete: 'CASCADE',
    },
    gift_bag_option_id: {
      type: 'bigint',
      notNull: true,
      references: '"gift_bag_option"',
    },
    name_snapshot: {
      type: 'varchar(100)',
      notNull: true,
    },
    cost_snapshot: {
      type: 'numeric(10,2)',
      notNull: true,
    },
    retail_price_adjustment_snapshot: {
      type: 'numeric(10,2)',
      notNull: true,
      default: 0,
    },
    is_default: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop in reverse dependency order
  pgm.dropTable('generated_bundle_gift_bag');
  pgm.dropTable('generated_bundle_upgrade');
  pgm.dropTable('generated_bundle_item');
  pgm.dropTable('generated_bundle');
  pgm.dropTable('gift_bag_option');
  pgm.dropTable('bundle_template_slot_role');
  pgm.dropTable('bundle_template_slot');
  pgm.dropTable('bundle_template');
  pgm.dropTable('budget_tier');
  pgm.dropTable('product_occasion');
  pgm.dropTable('product_role_affinity');
  pgm.dropTable('product_audience_affinity');
  pgm.dropTable('product_interest_affinity');
  pgm.dropTable('product');
}
