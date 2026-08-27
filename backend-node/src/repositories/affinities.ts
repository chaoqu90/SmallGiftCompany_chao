/**
 * Affinity repository — batch-load and replace affinity data.
 *
 * All batch-load functions use WHERE product_id = ANY(${sql.array(ids)}) to
 * fetch all affinities for a set of products in a single query, preventing
 * N+1 patterns during bundle generation (AC4.10).
 *
 * replaceAffinities wraps all four affinity tables in a single transaction
 * (AC8.2, design.md §3.4).
 */
import { sql } from '../db.js';
import type {
  ProductInterestAffinityRow,
  ProductAudienceAffinityRow,
  ProductRoleAffinityRow,
  ProductOccasionRow,
} from '../types/entities.js';
import type { AffinityPayload } from '../types/dtos.js';

/**
 * Batch-loads interest affinities for a set of product IDs.
 * One query for all products — no N+1 (AC4.10).
 */
export async function loadInterestAffinities(
  productIds: number[],
): Promise<ProductInterestAffinityRow[]> {
  if (productIds.length === 0) return [];
  return sql<ProductInterestAffinityRow[]>`
    SELECT product_id, interest, weight
    FROM product_interest_affinity
    WHERE product_id = ANY(${sql.array(productIds, 'int8')})
  `;
}

/**
 * Batch-loads audience affinities for a set of product IDs.
 */
export async function loadAudienceAffinities(
  productIds: number[],
): Promise<ProductAudienceAffinityRow[]> {
  if (productIds.length === 0) return [];
  return sql<ProductAudienceAffinityRow[]>`
    SELECT product_id, audience, weight
    FROM product_audience_affinity
    WHERE product_id = ANY(${sql.array(productIds, 'int8')})
  `;
}

/**
 * Batch-loads role affinities for a set of product IDs.
 */
export async function loadRoleAffinities(
  productIds: number[],
): Promise<ProductRoleAffinityRow[]> {
  if (productIds.length === 0) return [];
  return sql<ProductRoleAffinityRow[]>`
    SELECT product_id, role, weight
    FROM product_role_affinity
    WHERE product_id = ANY(${sql.array(productIds, 'int8')})
  `;
}

/**
 * Batch-loads occasion (party type) tags for a set of product IDs.
 */
export async function loadOccasionAffinities(
  productIds: number[],
): Promise<ProductOccasionRow[]> {
  if (productIds.length === 0) return [];
  return sql<ProductOccasionRow[]>`
    SELECT product_id, occasion
    FROM product_occasion
    WHERE product_id = ANY(${sql.array(productIds, 'int8')})
  `;
}

/**
 * Returns all four affinity types for a single product (for the GET /affinities endpoint).
 */
export async function getAffinitiesForProduct(productId: number): Promise<{
  interests: ProductInterestAffinityRow[];
  audiences: ProductAudienceAffinityRow[];
  roles: ProductRoleAffinityRow[];
  occasions: ProductOccasionRow[];
}> {
  const [interests, audiences, roles, occasions] = await Promise.all([
    loadInterestAffinities([productId]),
    loadAudienceAffinities([productId]),
    loadRoleAffinities([productId]),
    loadOccasionAffinities([productId]),
  ]);
  return { interests, audiences, roles, occasions };
}

/**
 * Atomically replaces all affinities for a product (AC8.2, design.md §3.4).
 *
 * Performs delete-then-insert for all four affinity types within a single
 * postgres.js transaction. No partial state is visible to concurrent readers.
 */
export async function replaceAffinities(
  productId: number,
  data: AffinityPayload,
): Promise<void> {
  await sql.begin(async (tx) => {
    // Delete existing affinities
    await tx`DELETE FROM product_interest_affinity WHERE product_id = ${productId}`;
    await tx`DELETE FROM product_audience_affinity WHERE product_id = ${productId}`;
    await tx`DELETE FROM product_role_affinity     WHERE product_id = ${productId}`;
    await tx`DELETE FROM product_occasion          WHERE product_id = ${productId}`;

    // Insert new interest affinities
    if (data.interests.length > 0) {
      const interestRows = data.interests.map(i => ({
        product_id: productId,
        interest: i.interest,
        weight: i.weight,
      }));
      await tx`INSERT INTO product_interest_affinity ${tx(interestRows)}`;
    }

    // Insert new audience affinities
    if (data.audiences.length > 0) {
      const audienceRows = data.audiences.map(a => ({
        product_id: productId,
        audience: a.audience,
        weight: a.weight,
      }));
      await tx`INSERT INTO product_audience_affinity ${tx(audienceRows)}`;
    }

    // Insert new role affinities
    if (data.roles.length > 0) {
      const roleRows = data.roles.map(r => ({
        product_id: productId,
        role: r.role,
        weight: r.weight,
      }));
      await tx`INSERT INTO product_role_affinity ${tx(roleRows)}`;
    }

    // Insert new occasions
    if (data.occasions.length > 0) {
      const occasionRows = data.occasions.map(o => ({
        product_id: productId,
        occasion: o.occasion,
      }));
      await tx`INSERT INTO product_occasion ${tx(occasionRows)}`;
    }
  });
}
