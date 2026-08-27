/**
 * Bundle simulation service — read-only simulation for the dashboard product-coverage endpoint.
 *
 * Iterates all combinations of age midpoints, interests, audience preferences, party types,
 * and active budget tiers, runs the constrained bundle generation logic in memory, and
 * returns which products appeared and under which conditions.
 *
 * MUST NOT write to the database (AC10.2, AC10.3).
 * Mirrors BundleSimulationService.java from the Spring Boot codebase.
 */
import type { AffinityMaps, BudgetTierRow, ProductRow } from '../types/entities.js';
import type { AudiencePreference, Interest, PartyType } from '../types/enums.js';
import { ALL_INTERESTS, ALL_AUDIENCE_PREFERENCES, ALL_PARTY_TYPES } from '../types/enums.js';
import { filterEligibleProducts, isAudienceCompatible } from './productEligibility.js';
import { scoreProduct } from './productScoring.js';
import { selectTemplateCode, FALLBACK_TEMPLATE_CODE } from './bundleTemplateSelector.js';
import { selectUpgradesForCeilingPath as _selectUpgradesForCeilingPath } from './upgradeGeneration.js';

// Age midpoints representing the three age bands (3–5, 6–8, 9–12)
const AGE_MIDPOINTS = [4, 7, 11];

export interface ProductCoverageRecord {
  productId: number;
  productName: string;
  sku: string;
  interest: string;
  audiencePreference: string;
  partyType: string;
  budgetTierCode: string;
  age: number;
  slotCode: string;
}

export interface SimulationDeps {
  products: ProductRow[];
  activeBudgetTiers: BudgetTierRow[];
  affinityMaps: AffinityMaps;
  // Template lookup by code (in-memory)
  templatesByCode: Map<string, { slots: Array<{ slot_code: string; display_order: number; allowed_roles: string[] }> }>;
}

/**
 * Runs the coverage simulation across all combinations.
 * Returns one record per product appearance per combination.
 */
export function runSimulation(deps: SimulationDeps): ProductCoverageRecord[] {
  const results: ProductCoverageRecord[] = [];

  for (const age of AGE_MIDPOINTS) {
    for (const interest of ALL_INTERESTS) {
      for (const audience of ALL_AUDIENCE_PREFERENCES) {
        for (const partyType of ALL_PARTY_TYPES) {
          for (const tier of deps.activeBudgetTiers) {
            const records = simulateOneCombination(
              age,
              interest,
              audience,
              partyType,
              tier,
              deps,
            );
            results.push(...records);
          }
        }
      }
    }
  }

  return results;
}

function simulateOneCombination(
  age: number,
  interest: Interest,
  audience: AudiencePreference,
  partyType: PartyType,
  tier: BudgetTierRow,
  deps: SimulationDeps,
): ProductCoverageRecord[] {
  // Select template code
  const primaryCode = selectTemplateCode(age, interest);
  const template =
    deps.templatesByCode.get(primaryCode) ??
    deps.templatesByCode.get(FALLBACK_TEMPLATE_CODE);

  if (!template) return [];

  // Filter eligible products in-memory
  const eligible = filterEligibleProducts(
    deps.products,
    age,
    partyType,
    audience,
    deps.affinityMaps,
  );

  if (eligible.length === 0) return [];

  const audienceCompatiblePool = deps.products.filter(p =>
    isAudienceCompatible(p, audience, deps.affinityMaps),
  );

  const maxRetail = parseFloat(tier.target_retail_price);
  const selectedIds = new Set<number>();
  const slotSelections: Array<{ slot_code: string; product: ProductRow }> = [];

  // PATH 2 constrained (simulation always uses constrained path — AC10.3)
  const reserveStandard = eligible
    .filter(p => p.upgrade_tier === 'STANDARD')
    .reduce<ProductRow | null>((best, p) => {
      if (!best) return p;
      const scoreP = deps.affinityMaps.interest.get(`${p.id}:${interest}`) ?? 0;
      const scoreBest = deps.affinityMaps.interest.get(`${best.id}:${interest}`) ?? 0;
      if (scoreP > scoreBest) return p;
      if (scoreP === scoreBest) {
        return parseFloat(p.retail_price) > parseFloat(best.retail_price) ? p : best;
      }
      return best;
    }, null);

  const upgradeReserve = reserveStandard ? parseFloat(reserveStandard.retail_price) : 0;
  let slotBudget = maxRetail - upgradeReserve;
  if (slotBudget <= 0) slotBudget = maxRetail;

  let remainingBudget = slotBudget;

  for (const slot of template.slots) {
    const currentRemaining = remainingBudget;

    let candidates = eligible.filter(
      p =>
        !selectedIds.has(p.id) &&
        parseFloat(p.retail_price) <= currentRemaining &&
        slot.allowed_roles.some(r => deps.affinityMaps.role.has(`${p.id}:${r}`)),
    );

    if (candidates.length === 0) {
      // PATH 3 fallback
      candidates = audienceCompatiblePool.filter(
        p =>
          p.upgrade_tier === 'STANDARD' &&
          !selectedIds.has(p.id) &&
          parseFloat(p.retail_price) <= currentRemaining &&
          slot.allowed_roles.some(r => deps.affinityMaps.role.has(`${p.id}:${r}`)),
      );
    }

    if (candidates.length === 0) break; // Skip combination if infeasible

    const chosen = candidates.reduce((best, p) => {
      const scoreP = scoreProduct(p, interest, audience, slot.allowed_roles, deps.affinityMaps);
      const scoreBest = scoreProduct(best, interest, audience, slot.allowed_roles, deps.affinityMaps);
      return scoreP > scoreBest ? p : best;
    });

    slotSelections.push({ slot_code: slot.slot_code, product: chosen });
    selectedIds.add(chosen.id);
    remainingBudget -= parseFloat(chosen.retail_price);
  }

  return slotSelections.map(s => ({
    productId: s.product.id,
    productName: s.product.name,
    sku: s.product.sku,
    interest,
    audiencePreference: audience,
    partyType,
    budgetTierCode: tier.code,
    age,
    slotCode: s.slot_code,
  }));
}
