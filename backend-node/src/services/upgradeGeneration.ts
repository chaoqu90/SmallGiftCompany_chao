/**
 * Upgrade generation service — selects standard and premium upgrade products.
 *
 * Mirrors UpgradeGenerationService.java from the Spring Boot codebase.
 * Three variants matching the Java implementation:
 *   - selectUpgrades:             PATH 1 (unconstrained)
 *   - selectUpgradesWithinBudget: budget-aware for PATH 2
 *   - selectUpgradesForCeilingPath: full ceiling-optimization for PATH 2/3
 */
import type { ProductRow, AffinityMaps } from '../types/entities.js';

export interface UpgradeSelection {
  standardProduct: ProductRow | null;
  premiumProduct: ProductRow | null;
}

/**
 * Helper: returns the interest affinity weight for a product (0 if no row).
 */
function getInterestScore(
  productId: number,
  interest: string,
  affinityMaps: AffinityMaps,
): number {
  return affinityMaps.interest.get(`${productId}:${interest}`) ?? 0;
}

/**
 * PATH 1 (unconstrained) upgrade selection.
 *
 * Premium: filter PREMIUM tier, not in selected IDs, pick highest interest score.
 * Standard: filter STANDARD tier, not in selected IDs, not premium ID, pick highest interest score.
 */
export function selectUpgrades(
  eligible: ProductRow[],
  selectedIds: Set<number>,
  interest: string,
  affinityMaps: AffinityMaps,
): UpgradeSelection {
  const premiumCandidates = eligible.filter(
    p => p.upgrade_tier === 'PREMIUM' && !selectedIds.has(p.id),
  );

  const premiumProduct = premiumCandidates.reduce<ProductRow | null>((best, p) => {
    if (!best) return p;
    return getInterestScore(p.id, interest, affinityMaps) >
      getInterestScore(best.id, interest, affinityMaps)
      ? p
      : best;
  }, null);

  const premiumId = premiumProduct?.id ?? null;

  const standardCandidates = eligible.filter(
    p =>
      p.upgrade_tier === 'STANDARD' &&
      !selectedIds.has(p.id) &&
      (premiumId === null || p.id !== premiumId),
  );

  const standardProduct = standardCandidates.reduce<ProductRow | null>((best, p) => {
    if (!best) return p;
    return getInterestScore(p.id, interest, affinityMaps) >
      getInterestScore(best.id, interest, affinityMaps)
      ? p
      : best;
  }, null);

  return { standardProduct, premiumProduct };
}

/**
 * Ceiling-optimization variant for PATH 2/3.
 *
 * Standard:
 *   - STANDARD tier, not selected, retail ≤ remaining budget
 *   - Picked by highest interest score, then most expensive (closest to ceiling)
 *
 * Premium:
 *   - PREMIUM tier, not selected
 *   - Must be more expensive than standard (positive delta)
 *   - retail ≤ remaining budget
 *   - Picked by most expensive (maximizes ceiling usage)
 */
export function selectUpgradesForCeilingPath(
  eligible: ProductRow[],
  selectedIds: Set<number>,
  remaining: number,
  interest: string,
  affinityMaps: AffinityMaps,
): UpgradeSelection {
  const standardCandidates = eligible.filter(
    p =>
      p.upgrade_tier === 'STANDARD' &&
      !selectedIds.has(p.id) &&
      parseFloat(p.retail_price) <= remaining,
  );

  // Pick highest interest score, then most expensive as tiebreaker
  const standardProduct = standardCandidates.reduce<ProductRow | null>((best, p) => {
    if (!best) return p;
    const scoreP = getInterestScore(p.id, interest, affinityMaps);
    const scoreBest = getInterestScore(best.id, interest, affinityMaps);
    if (scoreP > scoreBest) return p;
    if (scoreP === scoreBest) {
      return parseFloat(p.retail_price) > parseFloat(best.retail_price) ? p : best;
    }
    return best;
  }, null);

  const standardId = standardProduct?.id ?? null;
  const standardPrice = standardProduct ? parseFloat(standardProduct.retail_price) : null;

  const premiumCandidates = eligible.filter(p => {
    if (p.upgrade_tier !== 'PREMIUM') return false;
    if (selectedIds.has(p.id)) return false;
    if (standardId !== null && p.id === standardId) return false;
    // Premium must be strictly more expensive than standard
    if (standardPrice !== null && parseFloat(p.retail_price) <= standardPrice) return false;
    // Must fit within remaining budget
    if (parseFloat(p.retail_price) > remaining) return false;
    return true;
  });

  // Pick most expensive premium (maximizes ceiling usage)
  const premiumProduct = premiumCandidates.reduce<ProductRow | null>((best, p) => {
    if (!best) return p;
    return parseFloat(p.retail_price) > parseFloat(best.retail_price) ? p : best;
  }, null);

  return { standardProduct, premiumProduct };
}
