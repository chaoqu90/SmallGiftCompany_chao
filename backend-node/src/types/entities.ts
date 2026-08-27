/**
 * Database row types — snake_case field names matching PostgreSQL column names exactly.
 *
 * These types are used in repository functions to type the raw SQL results.
 * They are NEVER sent directly to API clients — they are mapped to DTOs first.
 *
 * Numeric columns (NUMERIC/DECIMAL) are returned as strings by postgres.js;
 * cast to number where arithmetic is needed.
 */

// ─── product ────────────────────────────────────────────────────────────────

export interface ProductRow {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  image_url: string | null;
  cost: string;            // NUMERIC(10,2) — postgres.js returns as string
  cog_overhead: string;    // NUMERIC(10,2)
  cog_adjusted: string;    // NUMERIC(10,2) = cost + cog_overhead
  retail_price: string;    // NUMERIC(10,2) — server-computed, never from browser
  inventory_quantity: number;
  active: boolean;
  min_age: number;         // SMALLINT
  max_age: number;         // SMALLINT
  category: string;        // ProductCategory
  form_factor: string;     // FormFactor
  upgrade_tier: string;    // UpgradeTier
  theme_code: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─── product affinity tables ─────────────────────────────────────────────────

export interface ProductInterestAffinityRow {
  product_id: number;
  interest: string;   // Interest
  weight: number;     // SMALLINT, 0–100
}

export interface ProductAudienceAffinityRow {
  product_id: number;
  audience: string;   // AudienceAffinity
  weight: number;     // SMALLINT, 0–100
}

export interface ProductRoleAffinityRow {
  product_id: number;
  role: string;       // BundleRole
  weight: number;     // SMALLINT, 0–100
}

export interface ProductOccasionRow {
  product_id: number;
  occasion: string;   // PartyType value
}

// ─── budget_tier ─────────────────────────────────────────────────────────────

export interface BudgetTierRow {
  id: number;
  code: string;
  retail_min: string;          // NUMERIC(10,2)
  retail_max: string;          // NUMERIC(10,2)
  max_item_cogs: string;       // NUMERIC(10,2)
  target_retail_price: string; // NUMERIC(10,2)
  active: boolean;
}

// ─── bundle_template ─────────────────────────────────────────────────────────

export interface BundleTemplateRow {
  id: number;
  code: string;
  name: string;
  min_age: number;
  max_age: number;
  active: boolean;
}

export interface BundleTemplateSlotRow {
  id: number;
  bundle_template_id: number;
  slot_code: string;
  display_order: number;
  required: boolean;
}

export interface BundleTemplateSlotRoleRow {
  slot_id: number;
  role: string;  // BundleRole
}

/** Convenience type: slot with its allowed roles pre-populated */
export interface BundleTemplateSlotWithRoles extends BundleTemplateSlotRow {
  allowed_roles: string[];
}

/** Convenience type: template with slots pre-populated */
export interface BundleTemplateWithSlots extends BundleTemplateRow {
  slots: BundleTemplateSlotWithRoles[];
}

// ─── gift_bag_option ─────────────────────────────────────────────────────────

export interface GiftBagOptionRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  cost: string;                    // NUMERIC(10,2)
  retail_price_adjustment: string; // NUMERIC(10,2)
  active: boolean;
  is_default: boolean;
}

// ─── generated_bundle ────────────────────────────────────────────────────────

export interface GeneratedBundleRow {
  id: number;
  public_id: string;
  session_id: string | null;
  requested_age: number;
  audience_preference: string;     // AudiencePreference
  interest: string;                // Interest
  party_type: string;              // PartyType
  budget_tier_id: number;
  bundle_template_id: number;
  base_retail_price: string | null; // NUMERIC(10,2)
  standard_item_cogs_snapshot: string; // NUMERIC(10,2)
  status: string;
  created_at: Date;
  expires_at: Date | null;
}

export interface GeneratedBundleItemRow {
  id: number;
  generated_bundle_id: number;
  slot_code: string;
  product_id: number;
  product_name_snapshot: string;
  sku_snapshot: string;
  cost_snapshot: string;           // NUMERIC(10,2)
  description_snapshot: string | null;
  form_factor_snapshot: string;    // FormFactor
  quantity_per_bag: number;        // SMALLINT
  display_order: number;           // SMALLINT
}

export interface GeneratedBundleUpgradeRow {
  id: number;
  generated_bundle_id: number;
  // Standard product snapshot
  standard_product_id: number | null;
  standard_product_name_snapshot: string | null;
  standard_sku_snapshot: string | null;
  standard_cost_snapshot: string | null;            // NUMERIC(10,2)
  standard_retail_adjustment_snapshot: string | null; // NUMERIC(10,2)
  // Premium product snapshot
  product_id: number | null;
  product_name_snapshot: string | null;
  sku_snapshot: string | null;
  cost_snapshot: string | null;                    // NUMERIC(10,2)
  retail_price_adjustment_snapshot: string | null; // NUMERIC(10,2)
}

export interface GeneratedBundleGiftBagRow {
  generated_bundle_id: number;
  gift_bag_option_id: number;
  name_snapshot: string;
  cost_snapshot: string;                    // NUMERIC(10,2)
  retail_price_adjustment_snapshot: string; // NUMERIC(10,2)
  is_default: boolean;
  // Joined from gift_bag_option
  gift_bag_option_code?: string;
}

// ─── analytics_event ─────────────────────────────────────────────────────────

export interface AnalyticsEventRow {
  id: number;
  event_type: string;
  session_id: string | null;
  bundle_id: string | null;    // VARCHAR, NOT a FK — intentional for survivability
  metadata_json: string | null;
  created_at: Date;
}

// ─── Affinity maps (in-memory index built from batch-loaded rows) ────────────

/**
 * Maps used during bundle generation to avoid N+1 queries.
 * Keys follow the pattern `${productId}:${dimension}` for O(1) lookup.
 */
export interface AffinityMaps {
  /** Map<`${productId}:${Interest}`, weight> */
  interest: Map<string, number>;
  /** Map<`${productId}:${AudienceAffinity}`, weight> */
  audience: Map<string, number>;
  /** Map<`${productId}:${BundleRole}`, weight> */
  role: Map<string, number>;
  /** Set<`${productId}:${occasion}`> */
  occasion: Set<string>;
}
