/**
 * Products repository — raw SQL functions for product CRUD and affinity management.
 *
 * All queries use postgres.js tagged-template literals (never string concatenation).
 * Imports sql from db.ts (module-scope singleton — safe for Lambda warm reuse).
 *
 * Functions correspond to AC7.3–AC7.12 and R7/R8.
 */
import { sql } from '../db.js';
import type { ProductRow } from '../types/entities.js';
import { computeRetailPrice } from '../services/retailPricing.js';

/**
 * Returns all products sorted by name (AC7.3).
 */
export async function listProducts(): Promise<ProductRow[]> {
  return sql<ProductRow[]>`
    SELECT * FROM product ORDER BY name ASC
  `;
}

/**
 * Returns a single product by ID, or null if not found (AC7.12).
 */
export async function getProductById(id: number): Promise<ProductRow | null> {
  const rows = await sql<ProductRow[]>`
    SELECT * FROM product WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

/**
 * Creates a product with server-computed cogAdjusted and retailPrice (AC7.5, AC4.9).
 * Browser-supplied prices are ignored — computeRetailPrice() is authoritative.
 */
export async function createProduct(data: {
  sku: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  cost: number;
  cogOverhead: number;
  inventoryQuantity: number;
  minAge: number;
  maxAge: number;
  category: string;
  formFactor: string;
  upgradeTier: string;
  themeCode?: string | null;
}): Promise<ProductRow> {
  const cogAdjusted = data.cost + data.cogOverhead;
  const retailPrice = computeRetailPrice(cogAdjusted);
  const now = new Date();

  const rows = await sql<ProductRow[]>`
    INSERT INTO product (
      sku, name, description, image_url,
      cost, cog_overhead, cog_adjusted, retail_price,
      inventory_quantity, active,
      min_age, max_age,
      category, form_factor, upgrade_tier, theme_code,
      created_at, updated_at
    ) VALUES (
      ${data.sku}, ${data.name}, ${data.description ?? null}, ${data.imageUrl ?? null},
      ${data.cost}, ${data.cogOverhead}, ${cogAdjusted}, ${retailPrice},
      ${data.inventoryQuantity}, true,
      ${data.minAge}, ${data.maxAge},
      ${data.category}, ${data.formFactor}, ${data.upgradeTier}, ${data.themeCode ?? null},
      ${now}, ${now}
    )
    RETURNING *
  `;
  return rows[0];
}

/**
 * Updates inventory quantity (AC7.6).
 */
export async function updateProductInventory(
  id: number,
  inventoryQuantity: number,
): Promise<ProductRow | null> {
  const rows = await sql<ProductRow[]>`
    UPDATE product
    SET inventory_quantity = ${inventoryQuantity},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Toggles the active flag (AC7.7).
 */
export async function updateProductActive(
  id: number,
  active: boolean,
): Promise<ProductRow | null> {
  const rows = await sql<ProductRow[]>`
    UPDATE product
    SET active = ${active},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Updates cost and cogOverhead, recomputes cogAdjusted and retailPrice
 * server-side (AC7.8, AC4.9). Browser-supplied prices are never trusted.
 */
export async function updateProductPricing(
  id: number,
  cost: number,
  cogOverhead: number,
): Promise<ProductRow | null> {
  const cogAdjusted = cost + cogOverhead;
  const retailPrice = computeRetailPrice(cogAdjusted);

  const rows = await sql<ProductRow[]>`
    UPDATE product
    SET cost = ${cost},
        cog_overhead = ${cogOverhead},
        cog_adjusted = ${cogAdjusted},
        retail_price = ${retailPrice},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Updates the product category (AC7.9).
 */
export async function updateProductCategory(
  id: number,
  category: string,
): Promise<ProductRow | null> {
  const rows = await sql<ProductRow[]>`
    UPDATE product
    SET category = ${category},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Updates the upgrade tier (AC7.9).
 */
export async function updateProductUpgradeTier(
  id: number,
  upgradeTier: string,
): Promise<ProductRow | null> {
  const rows = await sql<ProductRow[]>`
    UPDATE product
    SET upgrade_tier = ${upgradeTier},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Updates the age range (AC7.9).
 */
export async function updateProductAgeRange(
  id: number,
  minAge: number,
  maxAge: number,
): Promise<ProductRow | null> {
  const rows = await sql<ProductRow[]>`
    UPDATE product
    SET min_age = ${minAge},
        max_age = ${maxAge},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Updates name, category, and form factor (AC7.9).
 */
export async function updateProductDetails(
  id: number,
  name: string,
  category: string,
  formFactor: string,
): Promise<ProductRow | null> {
  const rows = await sql<ProductRow[]>`
    UPDATE product
    SET name = ${name},
        category = ${category},
        form_factor = ${formFactor},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Checks whether any generated_bundle_item references this product (AC7.10).
 * Returns true if referenced (delete should return 409).
 */
export async function isBundleReferenced(id: number): Promise<boolean> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM generated_bundle_item
    WHERE product_id = ${id}
  `;
  return parseInt(rows[0].count, 10) > 0;
}

/**
 * Deletes a product. Returns false if the product is referenced by bundle items (AC7.10).
 * Returns true on successful deletion (AC7.11).
 */
export async function deleteProduct(id: number): Promise<boolean> {
  const referenced = await isBundleReferenced(id);
  if (referenced) return false;

  await sql`DELETE FROM product WHERE id = ${id}`;
  return true;
}

/**
 * Finds all products eligible for bundle generation:
 *   - active = true
 *   - inventory_quantity > 0
 *   - age within [minAge, maxAge]
 *   - occasion matches partyType (join product_occasion)
 *
 * Results used as the base pool for affinity batch-loading (AC4.8, AC4.10).
 */
export async function findAllEligibleForGeneration(
  age: number,
  partyType: string,
): Promise<ProductRow[]> {
  return sql<ProductRow[]>`
    SELECT DISTINCT p.*
    FROM product p
    JOIN product_occasion po ON po.product_id = p.id
    WHERE p.active = true
      AND p.inventory_quantity > 0
      AND p.min_age <= ${age}
      AND p.max_age >= ${age}
      AND po.occasion = ${partyType}
    ORDER BY p.name ASC
  `;
}
