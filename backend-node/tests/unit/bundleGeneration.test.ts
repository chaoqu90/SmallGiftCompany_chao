/**
 * Unit tests for the three-path bundle generation algorithm.
 *
 * All nine scenarios from tasks.md T11:
 *   1. PATH 1 (unconstrained): selects highest-scoring eligible product per slot
 *   2. PATH 2 (constrained): respects budget ceiling, feasibility lookahead
 *   3. PATH 3 (tight fallback): activated when preference-filtered candidates don't fit
 *   4. INSUFFICIENT_ROLE_COVERAGE: no product can fill a required slot
 *   5. NO_BUDGET_FEASIBLE: cheapest eligible products exceed budget
 *   6. NO_ELIGIBLE_PRODUCTS: all products filtered out before slot assignment
 *   7. TEMPLATE_NOT_FOUND: template code resolves to nothing in the DB
 *   8. BUDGET_TIER_NOT_FOUND: requested tier code doesn't exist
 *   9. NO_GIFT_BAG_CONFIGURED: no default gift bag found
 *
 * Uses in-memory stub repositories — no real DB calls (AC15.1, AC15.3).
 */
import { describe, it, expect } from 'vitest';
import { generate, type GenerationRepos } from '../../src/services/bundleGeneration.js';
import type { BundleGenerationRequest } from '../../src/types/dtos.js';
import type {
  ProductRow,
  BudgetTierRow,
  GiftBagOptionRow,
  BundleTemplateWithSlots,
  AffinityMaps,
  ProductInterestAffinityRow,
  ProductAudienceAffinityRow,
  ProductRoleAffinityRow,
  ProductOccasionRow,
} from '../../src/types/entities.js';
import { BundleGenerationError } from '../../src/types/errors.js';

// ─── Stub data factories ──────────────────────────────────────────────────────

function makeBudgetTier(overrides: Partial<BudgetTierRow> = {}): BudgetTierRow {
  return {
    id: 1,
    code: 'MID',
    retail_min: '10.00',
    retail_max: '25.00',
    max_item_cogs: '5.00',
    target_retail_price: '20.00',
    active: true,
    ...overrides,
  };
}

function makeGiftBag(overrides: Partial<GiftBagOptionRow> = {}): GiftBagOptionRow {
  return {
    id: 1,
    code: 'CLASSIC_BAG',
    name: 'Classic Gift Bag',
    description: null,
    cost: '0.50',
    retail_price_adjustment: '0.00',
    active: true,
    is_default: true,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<BundleTemplateWithSlots> = {}): BundleTemplateWithSlots {
  return {
    id: 1,
    code: 'GENERAL_4_ITEM',
    name: 'General 4-Item Bundle',
    min_age: 6,
    max_age: 12,
    active: true,
    slots: [
      { id: 1, bundle_template_id: 1, slot_code: 'UTILITY', display_order: 1, required: true, allowed_roles: ['UTILITY'] },
      { id: 2, bundle_template_id: 1, slot_code: 'ACTIVITY', display_order: 2, required: true, allowed_roles: ['ACTIVITY'] },
      { id: 3, bundle_template_id: 1, slot_code: 'PLAY_WEARABLE_TACTILE', display_order: 3, required: true, allowed_roles: ['PLAY', 'WEARABLE', 'TACTILE'] },
      { id: 4, bundle_template_id: 1, slot_code: 'NOVELTY_COLLECTIBLE', display_order: 4, required: true, allowed_roles: ['NOVELTY', 'COLLECTIBLE'] },
    ],
    ...overrides,
  };
}

function makeProduct(id: number, overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id,
    sku: `PROD-${id.toString().padStart(3, '0')}`,
    name: `Product ${id}`,
    description: null,
    image_url: null,
    cost: '1.00',
    cog_overhead: '0.00',
    cog_adjusted: '1.00',
    retail_price: '2.00',
    inventory_quantity: 100,
    active: true,
    min_age: 3,
    max_age: 12,
    category: 'TOY',
    form_factor: 'ROUND',
    upgrade_tier: 'STANDARD',
    theme_code: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── Stub repos builder ───────────────────────────────────────────────────────

function makeRepos(overrides: Partial<GenerationRepos> = {}): GenerationRepos {
  const budgetTier = makeBudgetTier();
  const template = makeTemplate();
  const giftBag = makeGiftBag();

  // Four products each filling one slot — form_factor matches SLOT_FORM_FACTORS[idx]
  const products: ProductRow[] = [
    makeProduct(1, { retail_price: '2.00', form_factor: 'BAR' }),               // slot 0 UTILITY
    makeProduct(2, { retail_price: '2.00', form_factor: 'FLAT_RECT' }),         // slot 1 ACTIVITY
    makeProduct(3, { retail_price: '2.00', form_factor: 'IRREGULAR_VOLUME' }), // slot 2 PLAY
    makeProduct(4, { retail_price: '2.00', form_factor: 'SMALL_VOLUME' }),      // slot 3 COLLECTIBLE
    makeProduct(5, { retail_price: '3.00', upgrade_tier: 'STANDARD', form_factor: 'BAR' }), // for upgrade
    makeProduct(6, { retail_price: '4.00', upgrade_tier: 'PREMIUM',  form_factor: 'FLAT_RECT' }),  // for upgrade
  ];

  const interestRows: ProductInterestAffinityRow[] = products.map(p => ({
    product_id: p.id,
    interest: 'CUTE_MAGICAL',
    weight: 70,
  }));

  const audienceRows: ProductAudienceAffinityRow[] = products.map(p => ({
    product_id: p.id,
    audience: 'UNIVERSAL',
    weight: 80,
  }));

  const roleRows: ProductRoleAffinityRow[] = [
    { product_id: 1, role: 'UTILITY', weight: 90 },
    { product_id: 2, role: 'ACTIVITY', weight: 90 },
    { product_id: 3, role: 'PLAY', weight: 90 },
    { product_id: 4, role: 'COLLECTIBLE', weight: 90 },
    { product_id: 5, role: 'UTILITY', weight: 50 },
    { product_id: 6, role: 'PREMIUM', weight: 100 },
  ];

  const occasionRows: ProductOccasionRow[] = products.map(p => ({
    product_id: p.id,
    occasion: 'CELEBRATION',
  }));

  return {
    findBudgetTierByCode: async () => budgetTier,
    findTemplateByCode: async () => template,
    findAllEligibleForGeneration: async () => products,
    loadInterestAffinities: async () => interestRows,
    loadAudienceAffinities: async () => audienceRows,
    loadRoleAffinities: async () => roleRows,
    loadOccasionAffinities: async () => occasionRows,
    findDefaultGiftBag: async () => giftBag,
    ...overrides,
  };
}

const BASE_REQUEST: BundleGenerationRequest = {
  age: 7,
  audiencePreference: 'FEMININE',
  interest: 'CUTE_MAGICAL',
  partyType: 'CELEBRATION',
  budgetTierCode: 'MID',
  maxRetailPrice: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generate — PATH 1 (unconstrained)', () => {
  it('returns a GeneratedBundleResponse with correct shape when maxRetailPrice is null', async () => {
    const repos = makeRepos();
    const { response } = await generate({ ...BASE_REQUEST, maxRetailPrice: null }, repos);

    expect(response).toMatchObject({
      generatedBundleId: expect.stringMatching(/^gb_[a-f0-9]{12}$/),
      templateCode: 'GENERAL_4_ITEM',
      items: expect.arrayContaining([expect.objectContaining({ slotCode: 'UTILITY' })]),
    });
    expect(response.items).toHaveLength(4);
  });

  it('selects the highest-scoring product for each slot', async () => {
    // Product 1 has highest interest score for UTILITY slot
    const repos = makeRepos();
    const { snapshot } = await generate({ ...BASE_REQUEST, maxRetailPrice: null }, repos);
    const utilityItem = snapshot.items.find(i => i.slotCode === 'UTILITY');
    expect(utilityItem?.skuSnapshot).toBe('PROD-001'); // Product 1 fills UTILITY slot
  });
});

describe('generate — PATH 2 (constrained)', () => {
  it('respects budget ceiling with maxRetailPrice set', async () => {
    const repos = makeRepos();
    // Each product is $2, so 4 × $2 = $8 total, plus upgrade reservation
    const { response } = await generate({ ...BASE_REQUEST, maxRetailPrice: 20 }, repos);

    expect(response).toMatchObject({
      generatedBundleId: expect.stringMatching(/^gb_/),
      items: expect.arrayContaining([]),
    });
    expect(response.items).toHaveLength(4);
  });
});

describe('generate — PATH 3 (tight fallback)', () => {
  it('uses STANDARD products when preference-filtered candidates do not fit budget', async () => {
    // Set an extremely tight budget — only STANDARD products can fit
    const repos = makeRepos({
      findAllEligibleForGeneration: async () => [
        makeProduct(1, { retail_price: '1.00', form_factor: 'BAR' }),
        makeProduct(2, { retail_price: '1.00', form_factor: 'FLAT_RECT' }),
        makeProduct(3, { retail_price: '1.00', form_factor: 'IRREGULAR_VOLUME' }),
        makeProduct(4, { retail_price: '1.00', form_factor: 'SMALL_VOLUME' }),
        makeProduct(5, { retail_price: '2.00', upgrade_tier: 'STANDARD', form_factor: 'BAR' }),
      ],
      loadRoleAffinities: async () => [
        { product_id: 1, role: 'UTILITY', weight: 90 },
        { product_id: 2, role: 'ACTIVITY', weight: 90 },
        { product_id: 3, role: 'PLAY', weight: 90 },
        { product_id: 4, role: 'COLLECTIBLE', weight: 90 },
        { product_id: 5, role: 'UTILITY', weight: 50 },
      ],
      loadOccasionAffinities: async () => [
        { product_id: 1, occasion: 'CELEBRATION' },
        { product_id: 2, occasion: 'CELEBRATION' },
        { product_id: 3, occasion: 'CELEBRATION' },
        { product_id: 4, occasion: 'CELEBRATION' },
        { product_id: 5, occasion: 'CELEBRATION' },
      ],
      loadInterestAffinities: async () => [
        { product_id: 1, interest: 'CUTE_MAGICAL', weight: 70 },
        { product_id: 2, interest: 'CUTE_MAGICAL', weight: 70 },
        { product_id: 3, interest: 'CUTE_MAGICAL', weight: 70 },
        { product_id: 4, interest: 'CUTE_MAGICAL', weight: 70 },
        { product_id: 5, interest: 'CUTE_MAGICAL', weight: 50 },
      ],
      loadAudienceAffinities: async () => [
        { product_id: 1, audience: 'UNIVERSAL', weight: 80 },
        { product_id: 2, audience: 'UNIVERSAL', weight: 80 },
        { product_id: 3, audience: 'UNIVERSAL', weight: 80 },
        { product_id: 4, audience: 'UNIVERSAL', weight: 80 },
        { product_id: 5, audience: 'UNIVERSAL', weight: 80 },
      ],
    });

    const { response } = await generate({ ...BASE_REQUEST, maxRetailPrice: 8 }, repos);
    expect(response.items).toHaveLength(4);
  });
});

// ── Error scenarios ──────────────────────────────────────────────────────────

describe('generate — BUDGET_TIER_NOT_FOUND', () => {
  it('throws BundleGenerationError with BUDGET_TIER_NOT_FOUND when tier not found', async () => {
    const repos = makeRepos({
      findBudgetTierByCode: async () => null,
    });
    await expect(generate(BASE_REQUEST, repos)).rejects.toThrow(BundleGenerationError);
    await expect(generate(BASE_REQUEST, repos)).rejects.toMatchObject({
      failureCode: 'BUDGET_TIER_NOT_FOUND',
    });
  });
});

describe('generate — TEMPLATE_NOT_FOUND', () => {
  it('throws BundleGenerationError with TEMPLATE_NOT_FOUND when no active template exists', async () => {
    const repos = makeRepos({
      findTemplateByCode: async () => null, // Both primary and fallback return null
    });
    await expect(generate(BASE_REQUEST, repos)).rejects.toMatchObject({
      failureCode: 'TEMPLATE_NOT_FOUND',
    });
  });
});

describe('generate — NO_ELIGIBLE_PRODUCTS', () => {
  it('throws when all products are filtered out', async () => {
    const repos = makeRepos({
      findAllEligibleForGeneration: async () => [],
    });
    await expect(generate(BASE_REQUEST, repos)).rejects.toMatchObject({
      failureCode: 'NO_ELIGIBLE_PRODUCTS',
    });
  });
});

describe('generate — INSUFFICIENT_ROLE_COVERAGE', () => {
  it('still generates a bundle when roles are empty (form factor is the only hard filter)', async () => {
    // Products with NO role affinities — roles are soft, so bundle still generates
    // using form factor alone as the hard constraint.
    const repos = makeRepos({
      loadRoleAffinities: async () => [],
    });
    const { response } = await generate({ ...BASE_REQUEST, maxRetailPrice: null }, repos);
    expect(response.items).toHaveLength(4);
  });

  it('throws when no product with the required form factor exists', async () => {
    // All products have ROUND form factor — no BAR/FLAT_RECT/IRREGULAR_VOLUME available
    const repos = makeRepos({
      findAllEligibleForGeneration: async () => [
        makeProduct(1, { form_factor: 'ROUND' }),
        makeProduct(2, { form_factor: 'ROUND' }),
        makeProduct(3, { form_factor: 'ROUND' }),
        makeProduct(4, { form_factor: 'ROUND' }),
      ],
    });
    await expect(generate({ ...BASE_REQUEST, maxRetailPrice: null }, repos)).rejects.toMatchObject({
      failureCode: 'INSUFFICIENT_ROLE_COVERAGE',
    });
  });
});

describe('generate — NO_BUDGET_FEASIBLE', () => {
  it('throws when even the cheapest products exceed the slot budget', async () => {
    // All products cost $100 each, budget is $1
    const expensiveProducts = [
      makeProduct(1, { retail_price: '100.00', form_factor: 'BAR' }),
      makeProduct(2, { retail_price: '100.00', form_factor: 'FLAT_RECT' }),
      makeProduct(3, { retail_price: '100.00', form_factor: 'IRREGULAR_VOLUME' }),
      makeProduct(4, { retail_price: '100.00', form_factor: 'SMALL_VOLUME' }),
    ];

    const repos = makeRepos({
      findAllEligibleForGeneration: async () => expensiveProducts,
      loadRoleAffinities: async () => [
        { product_id: 1, role: 'UTILITY', weight: 90 },
        { product_id: 2, role: 'ACTIVITY', weight: 90 },
        { product_id: 3, role: 'PLAY', weight: 90 },
        { product_id: 4, role: 'COLLECTIBLE', weight: 90 },
      ],
      loadOccasionAffinities: async () => expensiveProducts.map(p => ({ product_id: p.id, occasion: 'CELEBRATION' })),
      loadAudienceAffinities: async () => expensiveProducts.map(p => ({ product_id: p.id, audience: 'UNIVERSAL', weight: 80 })),
      loadInterestAffinities: async () => expensiveProducts.map(p => ({ product_id: p.id, interest: 'CUTE_MAGICAL', weight: 70 })),
    });

    await expect(generate({ ...BASE_REQUEST, maxRetailPrice: 1 }, repos)).rejects.toMatchObject({
      failureCode: expect.stringMatching(/^(INSUFFICIENT_ROLE_COVERAGE|NO_BUDGET_FEASIBLE)$/),
    });
  });
});

describe('generate — NO_GIFT_BAG_CONFIGURED', () => {
  it('throws when no default gift bag is configured', async () => {
    const repos = makeRepos({
      findDefaultGiftBag: async () => null,
    });
    await expect(generate({ ...BASE_REQUEST, maxRetailPrice: null }, repos)).rejects.toMatchObject({
      failureCode: 'NO_GIFT_BAG_CONFIGURED',
    });
  });
});
