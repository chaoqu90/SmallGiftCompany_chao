/**
 * Product eligibility service — pure functions, no DB dependencies.
 *
 * Applies hard filters to determine whether a product can participate in
 * bundle generation for a given request. All filters must pass for a product
 * to be considered a candidate.
 *
 * Hard filters (AC4.8):
 *   1. active = true
 *   2. inventory_quantity > 0
 *   3. age within [min_age, max_age]
 *   4. party type / occasion match (via product_occasion)
 *   5. audience compatibility (via product_audience_affinity)
 *
 * Mirrors ProductEligibilityService.java from the Spring Boot codebase.
 * Unit-tested in tests/unit/productEligibility.test.ts.
 */
import type { ProductRow, AffinityMaps } from '../types/entities.js';
import type { AudiencePreference } from '../types/enums.js';

/**
 * Returns true if the product passes ALL hard eligibility filters for the request.
 * NOTE: active and inventory checks are already applied at the SQL query level
 * in findAllEligibleForGeneration, so this function focuses on the in-memory checks.
 */
export function isEligible(
  product: ProductRow,
  age: number,
  partyType: string,
  affinityMaps: AffinityMaps,
): boolean {
  return (
    product.active &&
    product.inventory_quantity > 0 &&
    isAgeEligible(product, age) &&
    isOccasionEligible(product, partyType, affinityMaps)
  );
}

/**
 * Returns true if the product is within the age range of the request.
 */
export function isAgeEligible(product: ProductRow, age: number): boolean {
  return product.min_age <= age && product.max_age >= age;
}

/**
 * Returns true if the product is tagged for the requested party type.
 * Uses the pre-built occasion map from AffinityMaps.
 */
export function isOccasionEligible(
  product: ProductRow,
  partyType: string,
  affinityMaps: AffinityMaps,
): boolean {
  return affinityMaps.occasion.has(`${product.id}:${partyType}`);
}

/**
 * Returns true if the product is compatible with the requested audience preference.
 *
 * Hard filter rules:
 *   MASCULINE request:
 *     → Accept: MASCULINE, UNIVERSAL, or no affinity.
 *     → Reject: any product tagged FEMININE (even if also UNIVERSAL).
 *   FEMININE request:
 *     → Accept: FEMININE, UNIVERSAL, or no affinity.
 *     → Reject: any product tagged MASCULINE (even if also UNIVERSAL).
 *   NO_PREFERENCE request:
 *     → Accept: UNIVERSAL or no affinity.
 *     → Reject: any product tagged FEMININE or MASCULINE.
 */
export function isAudienceCompatible(
  product: ProductRow,
  audience: AudiencePreference,
  affinityMaps: AffinityMaps,
): boolean {
  const productId = product.id;
  const hasFeminine = affinityMaps.audience.has(`${productId}:FEMININE`);
  const hasMasculine = affinityMaps.audience.has(`${productId}:MASCULINE`);
  const hasUniversal = affinityMaps.audience.has(`${productId}:UNIVERSAL`);

  if (audience === 'MASCULINE') {
    // Reject anything tagged FEMININE
    if (hasFeminine) return false;
    return hasMasculine || hasUniversal || (!hasFeminine && !hasMasculine && !hasUniversal);
  }

  if (audience === 'FEMININE') {
    // Reject anything tagged MASCULINE
    if (hasMasculine) return false;
    return hasFeminine || hasUniversal || (!hasFeminine && !hasMasculine && !hasUniversal);
  }

  if (audience === 'NO_PREFERENCE') {
    // Reject anything gender-specific
    if (hasFeminine || hasMasculine) return false;
    return true;
  }

  return !hasFeminine && !hasMasculine;
}

/**
 * Filters a list of products to only those that are eligible and audience-compatible.
 * Convenience function used by the bundle generation service.
 */
export function filterEligibleProducts(
  products: ProductRow[],
  age: number,
  partyType: string,
  audience: AudiencePreference,
  affinityMaps: AffinityMaps,
): ProductRow[] {
  return products.filter(
    p =>
      isEligible(p, age, partyType, affinityMaps) &&
      isAudienceCompatible(p, audience, affinityMaps),
  );
}
