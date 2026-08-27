/**
 * Unit tests for the product scoring formula.
 * Tests all audienceAdjustment branches, interestScore lookup, and roleScore scaling.
 * No DB required — pure function.
 */
import { describe, it, expect } from 'vitest';
import { scoreProduct } from '../../src/services/productScoring.js';
import type { ProductRow, AffinityMaps } from '../../src/types/entities.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 1,
    sku: 'TEST-001',
    name: 'Test Product',
    description: null,
    image_url: null,
    cost: '1.00',
    cog_overhead: '0.00',
    cog_adjusted: '1.00',
    retail_price: '0.50',
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

function makeAffinityMaps(overrides: Partial<AffinityMaps> = {}): AffinityMaps {
  return {
    interest: new Map(),
    audience: new Map(),
    role: new Map(),
    occasion: new Set(),
    ...overrides,
  };
}

// ─── interestScore ────────────────────────────────────────────────────────────

describe('scoreProduct — interestScore', () => {
  it('returns 0 when no interest affinity row exists', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps();
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'NO_PREFERENCE', [], maps);
    expect(score).toBe(0);
  });

  it('returns the weight from the interest map', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      interest: new Map([['1:CUTE_MAGICAL', 80]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'NO_PREFERENCE', [], maps);
    expect(score).toBe(80);
  });

  it('does not cross-count interests — only uses the requested interest', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      interest: new Map([['1:CUTE_MAGICAL', 80], ['1:SPORTS', 50]]),
    });
    const score = scoreProduct(product, 'SPORTS', 'NO_PREFERENCE', [], maps);
    expect(score).toBe(50); // Only SPORTS counts
  });
});

// ─── audienceAdjustment — NO_PREFERENCE ──────────────────────────────────────

describe('scoreProduct — audienceAdjustment (NO_PREFERENCE)', () => {
  it('returns 0 when product has no audience affinity and request is NO_PREFERENCE', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps();
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'NO_PREFERENCE', [], maps);
    expect(score).toBe(0);
  });

  it('returns +8 when product has UNIVERSAL affinity and request is NO_PREFERENCE', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      audience: new Map([['1:UNIVERSAL', 80]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'NO_PREFERENCE', [], maps);
    expect(score).toBe(8);
  });

  it('returns 0 (not +8) when product has FEMININE but not UNIVERSAL with NO_PREFERENCE', () => {
    // FEMININE-only product with NO_PREFERENCE request → gender tag has no effect
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      audience: new Map([['1:FEMININE', 80]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'NO_PREFERENCE', [], maps);
    expect(score).toBe(0);
  });
});

// ─── audienceAdjustment — FEMININE ───────────────────────────────────────────

describe('scoreProduct — audienceAdjustment (FEMININE)', () => {
  it('returns +15 for FEMININE product with FEMININE request', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      audience: new Map([['1:FEMININE', 80]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'FEMININE', [], maps);
    expect(score).toBe(15);
  });

  it('returns +8 for UNIVERSAL product with FEMININE request', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      audience: new Map([['1:UNIVERSAL', 80]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'FEMININE', [], maps);
    expect(score).toBe(8);
  });

  it('returns -5 for MASCULINE-only product with FEMININE request', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      audience: new Map([['1:MASCULINE', 70]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'FEMININE', [], maps);
    expect(score).toBe(-5);
  });

  it('returns +15 when product has BOTH FEMININE and UNIVERSAL (max prevents double-count)', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      audience: new Map([['1:FEMININE', 80], ['1:UNIVERSAL', 30]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'FEMININE', [], maps);
    expect(score).toBe(15); // max(15, 8) = 15
  });

  it('returns 0 for product with no audience affinity and FEMININE request', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps();
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'FEMININE', [], maps);
    expect(score).toBe(0);
  });
});

// ─── audienceAdjustment — MASCULINE ──────────────────────────────────────────

describe('scoreProduct — audienceAdjustment (MASCULINE)', () => {
  it('returns +15 for MASCULINE product with MASCULINE request', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      audience: new Map([['1:MASCULINE', 70]]),
    });
    const score = scoreProduct(product, 'SPORTS', 'MASCULINE', [], maps);
    expect(score).toBe(15);
  });

  it('returns -5 for FEMININE-only product with MASCULINE request', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      audience: new Map([['1:FEMININE', 80]]),
    });
    const score = scoreProduct(product, 'SPORTS', 'MASCULINE', [], maps);
    expect(score).toBe(-5);
  });

  it('returns +8 for UNIVERSAL product with MASCULINE request', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      audience: new Map([['1:UNIVERSAL', 80]]),
    });
    const score = scoreProduct(product, 'SPORTS', 'MASCULINE', [], maps);
    expect(score).toBe(8);
  });
});

// ─── roleScore ────────────────────────────────────────────────────────────────

describe('scoreProduct — roleScore', () => {
  it('returns 0 when product has no matching role', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps();
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'NO_PREFERENCE', ['UTILITY'], maps);
    expect(score).toBe(0);
  });

  it('scales weight 100 to roleScore 20', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      role: new Map([['1:UTILITY', 100]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'NO_PREFERENCE', ['UTILITY'], maps);
    expect(score).toBe(20); // 100 * 20 / 100
  });

  it('scales weight 50 to roleScore 10', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      role: new Map([['1:UTILITY', 50]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'NO_PREFERENCE', ['UTILITY'], maps);
    expect(score).toBe(10);
  });

  it('picks the best matching role when multiple allowed roles exist', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      role: new Map([['1:PLAY', 40], ['1:WEARABLE', 90], ['1:TACTILE', 60]]),
    });
    const score = scoreProduct(
      product,
      'CUTE_MAGICAL',
      'NO_PREFERENCE',
      ['PLAY', 'WEARABLE', 'TACTILE'],
      maps,
    );
    expect(score).toBe(18); // best: 90 * 20 / 100 = 18
  });

  it('ignores roles not in the allowed list', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      role: new Map([['1:PREMIUM', 100], ['1:UTILITY', 50]]),
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'NO_PREFERENCE', ['UTILITY'], maps);
    expect(score).toBe(10); // Only UTILITY counts (50 * 20 / 100 = 10)
  });
});

// ─── Combined scoring ─────────────────────────────────────────────────────────

describe('scoreProduct — combined scoring', () => {
  it('sums all three components correctly', () => {
    const product = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({
      interest: new Map([['1:CUTE_MAGICAL', 80]]),     // +80
      audience: new Map([['1:FEMININE', 75]]),          // +15 (FEMININE match)
      role: new Map([['1:UTILITY', 100]]),              // +20
    });
    const score = scoreProduct(product, 'CUTE_MAGICAL', 'FEMININE', ['UTILITY'], maps);
    expect(score).toBe(115); // 80 + 15 + 20
  });
});
