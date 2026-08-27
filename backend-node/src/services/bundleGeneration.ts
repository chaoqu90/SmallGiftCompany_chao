/**
 * Bundle generation service — three-path algorithm.
 *
 * Orchestrates: budget tier lookup → template selection → eligibility filter →
 * batch affinity load → affinity indexing → slot selection (PATH 1 or PATH 2+3) →
 * upgrade selection → gift bag selection → snapshot persistence → response mapping.
 *
 * Direct TypeScript port of BundleGenerationService.java.
 * See design.md §2.8 for the algorithm specification.
 *
 * Dependencies are injected as function parameters to allow unit testing
 * with stub repositories (AC15.1, AC15.6).
 */
import { randomBytes } from 'crypto';
import type { BundleGenerationRequest, GeneratedBundleResponse } from '../types/dtos.js';
import type { ProductRow, AffinityMaps, BundleTemplateSlotWithRoles } from '../types/entities.js';
import { BundleGenerationError } from '../types/errors.js';
import { selectTemplateCode, FALLBACK_TEMPLATE_CODE } from './bundleTemplateSelector.js';
import { filterEligibleProducts, isAudienceCompatible } from './productEligibility.js';
import { scoreProduct } from './productScoring.js';
import { selectUpgrades, selectUpgradesForCeilingPath } from './upgradeGeneration.js';
import type { findBudgetTierByCode } from '../repositories/budgetTiers.js';
import type { findTemplateByCode } from '../repositories/bundleTemplates.js';
import type { findDefaultGiftBag } from '../repositories/giftBagOptions.js';
import type {
  saveBundle,
  findBundleByPublicId,
  BundleSnapshot,
} from '../repositories/generatedBundles.js';
import type { loadInterestAffinities, loadAudienceAffinities, loadRoleAffinities, loadOccasionAffinities } from '../repositories/affinities.js';
import type { findAllEligibleForGeneration } from '../repositories/products.js';

// ─── Repository interface (injected for testability) ─────────────────────────

export interface GenerationRepos {
  findBudgetTierByCode: typeof findBudgetTierByCode;
  findTemplateByCode: typeof findTemplateByCode;
  findAllEligibleForGeneration: typeof findAllEligibleForGeneration;
  loadInterestAffinities: typeof loadInterestAffinities;
  loadAudienceAffinities: typeof loadAudienceAffinities;
  loadRoleAffinities: typeof loadRoleAffinities;
  loadOccasionAffinities: typeof loadOccasionAffinities;
  findDefaultGiftBag: typeof findDefaultGiftBag;
  saveBundle: typeof saveBundle;
  findBundleByPublicId: typeof findBundleByPublicId;
}

/**
 * Generates a personalized bundle and persists it as an immutable snapshot.
 *
 * Returns a GeneratedBundleResponse matching the Spring Boot contract exactly.
 * Throws BundleGenerationError with the appropriate failureCode on all failure paths.
 */
export async function generate(
  request: BundleGenerationRequest,
  repos: GenerationRepos,
): Promise<GeneratedBundleResponse> {
  // ── Step 1: Load and validate BudgetTier ────────────────────────────────
  const budgetTier = await repos.findBudgetTierByCode(request.budgetTierCode);
  if (!budgetTier) {
    throw new BundleGenerationError(
      'BUDGET_TIER_NOT_FOUND',
      `Budget tier not found or inactive: ${request.budgetTierCode}`,
    );
  }

  // ── Step 2: Select template ──────────────────────────────────────────────
  const primaryCode = selectTemplateCode(request.age, request.interest);
  let template = await repos.findTemplateByCode(primaryCode);

  // Fallback: if primary template is inactive (e.g., READING_PUZZLE_4_ITEM without PUZZLE products)
  if (!template && primaryCode !== FALLBACK_TEMPLATE_CODE) {
    template = await repos.findTemplateByCode(FALLBACK_TEMPLATE_CODE);
  }

  if (!template) {
    throw new BundleGenerationError(
      'TEMPLATE_NOT_FOUND',
      `No active template found for code: ${primaryCode}`,
    );
  }

  const slots = template.slots;

  // ── Step 3: Load eligible products (SQL-level filter: active, inventory, age, occasion) ──
  const eligibleFromDb = await repos.findAllEligibleForGeneration(request.age, request.partyType);
  const allProductIds = eligibleFromDb.map(p => p.id);

  // ── Step 4: Batch-load affinities ──────────────────────────────────────
  const [interestRows, audienceRows, roleRows, occasionRows] = await Promise.all([
    repos.loadInterestAffinities(allProductIds),
    repos.loadAudienceAffinities(allProductIds),
    repos.loadRoleAffinities(allProductIds),
    repos.loadOccasionAffinities(allProductIds),
  ]);

  // ── Step 5: Build affinity maps for O(1) lookup ──────────────────────────
  const affinityMaps: AffinityMaps = {
    interest: new Map(interestRows.map(r => [`${r.product_id}:${r.interest}`, r.weight])),
    audience: new Map(audienceRows.map(r => [`${r.product_id}:${r.audience}`, r.weight])),
    role: new Map(roleRows.map(r => [`${r.product_id}:${r.role}`, r.weight])),
    occasion: new Set(occasionRows.map(r => `${r.product_id}:${r.occasion}`)),
  };

  // ── Step 6a: Apply audience + eligibility hard filters ───────────────────
  const eligible = filterEligibleProducts(
    eligibleFromDb,
    request.age,
    request.partyType,
    request.audiencePreference,
    affinityMaps,
  );

  // allActiveAudienceCompatible: used by PATH 3 fallback (no age/occasion filter)
  // We need all products for the fallback, not just those matching age/partyType
  // Since we only loaded eligible products, we use eligible as the fallback pool
  // (matching the Java implementation which uses allActive filtered by audience)
  const audienceCompatiblePool = eligibleFromDb.filter(p =>
    isAudienceCompatible(p, request.audiencePreference, affinityMaps),
  );

  if (eligible.length === 0) {
    throw new BundleGenerationError(
      'NO_ELIGIBLE_PRODUCTS',
      'No eligible products found for this request',
    );
  }

  // ── Step 6b: Slot selection ──────────────────────────────────────────────
  const selectedIds = new Set<number>();
  const slotSelections: Array<{ slot: BundleTemplateSlotWithRoles; product: ProductRow }> = [];

  const isConstrained = request.maxRetailPrice != null;

  if (!isConstrained) {
    // PATH 1 — Unconstrained: highest-scoring eligible product per slot
    for (const slot of slots) {
      const candidates = eligible.filter(
        p => !selectedIds.has(p.id) && hasAnyRole(p.id, slot.allowed_roles, affinityMaps),
      );

      if (candidates.length === 0) {
        throw new BundleGenerationError(
          'INSUFFICIENT_ROLE_COVERAGE',
          `No candidates for slot: ${slot.slot_code}`,
        );
      }

      const chosen = candidates.reduce((best, p) => {
        const scoreP = scoreProduct(p, request.interest, request.audiencePreference, slot.allowed_roles, affinityMaps);
        const scoreBest = scoreProduct(best, request.interest, request.audiencePreference, slot.allowed_roles, affinityMaps);
        if (scoreP > scoreBest) return p;
        if (scoreP === scoreBest) {
          // Tiebreak: lower cogAdjusted wins
          return parseFloat(p.cog_adjusted) < parseFloat(best.cog_adjusted) ? p : best;
        }
        return best;
      });

      slotSelections.push({ slot, product: chosen });
      selectedIds.add(chosen.id);
    }
  } else {
    // PATH 2 — Constrained: reserve upgrade budget, then greedy slot selection
    const maxRetail = request.maxRetailPrice!;

    // Phase A: reserve standard upgrade budget
    const reserveStandard = eligible
      .filter(p => p.upgrade_tier === 'STANDARD')
      .reduce<ProductRow | null>((best, p) => {
        if (!best) return p;
        const scoreP = affinityMaps.interest.get(`${p.id}:${request.interest}`) ?? 0;
        const scoreBest = affinityMaps.interest.get(`${best.id}:${request.interest}`) ?? 0;
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

    for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
      const slot = slots[slotIdx];
      const currentRemaining = remainingBudget;
      const remainingSlots = slots.slice(slotIdx + 1);

      // Preference-filtered candidates within remaining budget
      let candidates = eligible.filter(
        p =>
          !selectedIds.has(p.id) &&
          parseFloat(p.retail_price) <= currentRemaining &&
          hasAnyRole(p.id, slot.allowed_roles, affinityMaps),
      );

      // PATH 3 per-slot fallback: drop preference filters, use STANDARD from audienceCompatiblePool
      let usedFallback = false;
      if (candidates.length === 0) {
        candidates = audienceCompatiblePool.filter(
          p =>
            p.upgrade_tier === 'STANDARD' &&
            !selectedIds.has(p.id) &&
            parseFloat(p.retail_price) <= currentRemaining &&
            hasAnyRole(p.id, slot.allowed_roles, affinityMaps),
        );
        usedFallback = true;
      }

      if (candidates.length === 0) {
        throw new BundleGenerationError(
          'INSUFFICIENT_ROLE_COVERAGE',
          `No candidates for slot: ${slot.slot_code}`,
        );
      }

      // Score descending
      const scored = [...candidates].sort((a, b) => {
        const scoreA = scoreProduct(a, request.interest, request.audiencePreference, slot.allowed_roles, affinityMaps);
        const scoreB = scoreProduct(b, request.interest, request.audiencePreference, slot.allowed_roles, affinityMaps);
        return scoreB - scoreA;
      });

      const feasibilityPool = usedFallback
        ? audienceCompatiblePool.filter(p => p.upgrade_tier === 'STANDARD')
        : eligible;

      // Find first feasible choice
      let chosen: ProductRow | null = null;
      for (const candidate of scored) {
        const costAfter = currentRemaining - parseFloat(candidate.retail_price);
        if (isFeasible(costAfter, remainingSlots, feasibilityPool, selectedIds, candidate.id, affinityMaps)) {
          chosen = candidate;
          break;
        }
      }

      if (!chosen) {
        throw new BundleGenerationError(
          'NO_BUDGET_FEASIBLE',
          `Cannot satisfy budget constraint for slot: ${slot.slot_code}`,
        );
      }

      slotSelections.push({ slot, product: chosen });
      selectedIds.add(chosen.id);
      remainingBudget -= parseFloat(chosen.retail_price);
    }
  }

  // ── Step 7: Compute totals ───────────────────────────────────────────────
  const standardItemCogsSnapshot = slotSelections.reduce(
    (sum, s) => sum + parseFloat(s.product.cost),
    0,
  );
  const baseRetailPrice = slotSelections.reduce(
    (sum, s) => sum + parseFloat(s.product.retail_price),
    0,
  );

  // ── Step 8: Select upgrades ──────────────────────────────────────────────
  const upgradeSelection = isConstrained
    ? selectUpgradesForCeilingPath(
        eligible,
        selectedIds,
        request.maxRetailPrice! - baseRetailPrice,
        request.interest,
        affinityMaps,
      )
    : selectUpgrades(eligible, selectedIds, request.interest, affinityMaps);

  // ── Step 9: Select gift bag ──────────────────────────────────────────────
  const giftBag = await repos.findDefaultGiftBag();
  if (!giftBag) {
    throw new BundleGenerationError(
      'NO_GIFT_BAG_CONFIGURED',
      'No default gift bag option configured',
    );
  }

  // ── Step 10: Persist snapshot ────────────────────────────────────────────
  const publicId = `gb_${randomBytes(6).toString('hex')}`; // gb_<12-char-hex>

  // Compute upgrade snapshot
  let upgradeSnapshot: BundleSnapshot['upgrade'] = null;
  const std = upgradeSelection.standardProduct;
  const prem = upgradeSelection.premiumProduct;

  if (std || prem) {
    const stdRetailPrice = std ? parseFloat(std.retail_price) : null;
    const premRetailAdj = prem && std ? parseFloat(prem.retail_price) - parseFloat(std.retail_price) : prem ? 0 : null;

    upgradeSnapshot = {
      standardProductId: std?.id ?? null,
      standardProductNameSnapshot: std?.name ?? null,
      standardSkuSnapshot: std?.sku ?? null,
      standardCostSnapshot: std ? parseFloat(std.cost) : null,
      standardRetailAdjustmentSnapshot: stdRetailPrice,
      premiumProductId: prem?.id ?? null,
      premiumProductNameSnapshot: prem?.name ?? null,
      premiumSkuSnapshot: prem?.sku ?? null,
      premiumCostSnapshot: prem ? parseFloat(prem.cost) : null,
      premiumRetailAdjustmentSnapshot: premRetailAdj,
    };
  }

  const snapshot: BundleSnapshot = {
    publicId,
    requestedAge: request.age,
    audiencePreference: request.audiencePreference,
    interest: request.interest,
    partyType: request.partyType,
    budgetTierId: budgetTier.id,
    bundleTemplateId: template.id,
    baseRetailPrice: Math.round(baseRetailPrice * 100) / 100,
    standardItemCogsSnapshot: Math.round(standardItemCogsSnapshot * 100) / 100,
    items: slotSelections.map((s, idx) => ({
      slotCode: s.slot.slot_code,
      productId: s.product.id,
      productNameSnapshot: s.product.name,
      skuSnapshot: s.product.sku,
      costSnapshot: parseFloat(s.product.cost),
      descriptionSnapshot: s.product.description,
      formFactorSnapshot: s.product.form_factor,
      quantityPerBag: 1,
      displayOrder: s.slot.display_order,
    })),
    upgrade: upgradeSnapshot,
    giftBag: {
      giftBagOptionId: giftBag.id,
      giftBagOptionCode: giftBag.code,
      nameSnapshot: giftBag.name,
      costSnapshot: parseFloat(giftBag.cost),
      retailPriceAdjustmentSnapshot: parseFloat(giftBag.retail_price_adjustment),
      isDefault: giftBag.is_default,
    },
  };

  await repos.saveBundle(snapshot);

  // ── Step 11: Return response ─────────────────────────────────────────────
  return buildResponse(publicId, template.code, snapshot);
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function hasAnyRole(
  productId: number,
  allowedRoles: string[],
  affinityMaps: AffinityMaps,
): boolean {
  return allowedRoles.some(role => affinityMaps.role.has(`${productId}:${role}`));
}

function isFeasible(
  remainingAfterChoice: number,
  remainingSlots: BundleTemplateSlotWithRoles[],
  pool: ProductRow[],
  currentSelectedIds: Set<number>,
  candidateId: number,
  affinityMaps: AffinityMaps,
): boolean {
  const projectedSelected = new Set([...currentSelectedIds, candidateId]);

  for (const slot of remainingSlots) {
    const anyFit = pool.some(
      p =>
        !projectedSelected.has(p.id) &&
        parseFloat(p.retail_price) <= remainingAfterChoice &&
        hasAnyRole(p.id, slot.allowed_roles, affinityMaps),
    );
    if (!anyFit) return false;
  }

  return true;
}

function buildResponse(
  publicId: string,
  templateCode: string,
  snapshot: BundleSnapshot,
): GeneratedBundleResponse {
  return {
    generatedBundleId: publicId,
    templateCode,
    standardItemCogsSnapshot: snapshot.standardItemCogsSnapshot,
    bundleRetailPrice: snapshot.baseRetailPrice,
    items: snapshot.items.map(item => ({
      slotCode: item.slotCode,
      productName: item.productNameSnapshot,
      sku: item.skuSnapshot,
      description: item.descriptionSnapshot,
      formFactor: item.formFactorSnapshot,
      quantityPerBag: item.quantityPerBag,
      displayOrder: item.displayOrder,
    })),
    upgrade: snapshot.upgrade
      ? {
          standardProductName: snapshot.upgrade.standardProductNameSnapshot,
          standardSku: snapshot.upgrade.standardSkuSnapshot,
          standardRetailAdjustment: snapshot.upgrade.standardRetailAdjustmentSnapshot,
          upgradedProductName: snapshot.upgrade.premiumProductNameSnapshot,
          upgradedSku: snapshot.upgrade.premiumSkuSnapshot,
          upgradedRetailAdjustment: snapshot.upgrade.premiumRetailAdjustmentSnapshot,
        }
      : null,
    giftBag: snapshot.giftBag
      ? {
          code: snapshot.giftBag.giftBagOptionCode,
          name: snapshot.giftBag.nameSnapshot,
          retailPriceAdjustment: snapshot.giftBag.retailPriceAdjustmentSnapshot,
          isDefault: snapshot.giftBag.isDefault,
        }
      : null,
  };
}
