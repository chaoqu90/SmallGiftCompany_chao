/**
 * Product scoring service — pure function, no DB dependencies.
 *
 * Implements the three-component scoring formula:
 *   total = interestScore + audienceAdjustment + roleScore
 *
 * Mirrors ProductScoringService.java score() method exactly.
 * Documented in tech-overview.md §8.3 and docs/backend-design.md §9.
 *
 * Unit-tested in tests/unit/productScoring.test.ts.
 */
import type { ProductRow, AffinityMaps } from '../types/entities.js';
import type { AudiencePreference } from '../types/enums.js';

/**
 * Computes a numeric score for a product in the context of a specific slot request.
 *
 * @param product        The candidate product row.
 * @param interest       The interest requested by the customer (e.g. 'CUTE_MAGICAL').
 * @param audience       The audience preference (e.g. 'FEMININE').
 * @param allowedRoles   The roles permitted by the current template slot.
 * @param affinityMaps   Pre-built in-memory maps from batch-loaded affinity rows.
 * @returns              Integer score (higher = better match).
 */
export function scoreProduct(
  product: ProductRow,
  interest: string,
  audience: AudiencePreference,
  allowedRoles: string[],
  affinityMaps: AffinityMaps,
): number {
  const interestScore = getInterestScore(product.id, interest, affinityMaps);
  const audienceAdjustment = computeAudienceAdjustment(product.id, audience, affinityMaps);
  const roleScore = computeRoleScore(product.id, allowedRoles, affinityMaps);

  return interestScore + audienceAdjustment + roleScore;
}

/**
 * Returns the interest affinity weight for the product (0 if no row).
 */
function getInterestScore(
  productId: number,
  interest: string,
  affinityMaps: AffinityMaps,
): number {
  return affinityMaps.interest.get(`${productId}:${interest}`) ?? 0;
}

/**
 * Computes the audience adjustment score.
 *
 * Rules (from docs/backend-design.md §9 and tech-overview.md §8.3):
 *   - Matching gender (FEMININE+FEMININE or MASCULINE+MASCULINE): +15
 *   - UNIVERSAL affinity on product: +8
 *   - Mismatched gender (FEMININE req + MASCULINE product, or vice versa): -5
 *   - NO_PREFERENCE request: only UNIVERSAL bonus applies
 *   - max() prevents double-counting when both specific and universal rows exist
 *
 * Implementation mirrors ProductScoringService.java computeAudienceAdjustment().
 */
function computeAudienceAdjustment(
  productId: number,
  audience: AudiencePreference,
  affinityMaps: AffinityMaps,
): number {
  const universalWeight = affinityMaps.audience.get(`${productId}:UNIVERSAL`);
  const feminineWeight = affinityMaps.audience.get(`${productId}:FEMININE`);
  const masculineWeight = affinityMaps.audience.get(`${productId}:MASCULINE`);

  const hasUniversal = universalWeight !== undefined;
  const hasFeminine = feminineWeight !== undefined;
  const hasMasculine = masculineWeight !== undefined;

  if (audience === 'NO_PREFERENCE') {
    // Only universal bonus applies; gender-specific tags have no effect
    return hasUniversal ? 8 : 0;
  }

  if (audience === 'FEMININE') {
    if (hasFeminine && hasUniversal) {
      return Math.max(15, 8); // +15 wins (max prevents double-count)
    }
    if (hasFeminine) return 15;
    if (hasUniversal) return 8;
    if (hasMasculine) return -5; // mismatched
    return 0;
  }

  if (audience === 'MASCULINE') {
    if (hasMasculine && hasUniversal) {
      return Math.max(15, 8); // +15 wins
    }
    if (hasMasculine) return 15;
    if (hasUniversal) return 8;
    if (hasFeminine) return -5; // mismatched
    return 0;
  }

  return 0;
}

/**
 * Computes the role score.
 *
 * roleScore = best matching role weight × 20 / 100 (scaled 0–20).
 * Only roles in allowedRoles contribute. 0 if no role match.
 */
function computeRoleScore(
  productId: number,
  allowedRoles: string[],
  affinityMaps: AffinityMaps,
): number {
  let bestWeight = 0;

  for (const role of allowedRoles) {
    const weight = affinityMaps.role.get(`${productId}:${role}`) ?? 0;
    if (weight > bestWeight) {
      bestWeight = weight;
    }
  }

  return (bestWeight * 20) / 100;
}
