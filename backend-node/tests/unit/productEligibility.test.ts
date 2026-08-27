/**
 * Unit tests for product eligibility hard filters.
 * Tests each filter in isolation and in combination.
 * No DB required — pure functions.
 */
import { describe, it, expect } from 'vitest';
import {
  isEligible,
  isAgeEligible,
  isOccasionEligible,
  isAudienceCompatible,
  filterEligibleProducts,
} from '../../src/services/productEligibility.js';
import type { ProductRow, AffinityMaps } from '../../src/types/entities.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    inventory_quantity: 10,
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

// ─── isAgeEligible ────────────────────────────────────────────────────────────

describe('isAgeEligible', () => {
  it('returns true when age is within range', () => {
    const p = makeProduct({ min_age: 3, max_age: 12 });
    expect(isAgeEligible(p, 7)).toBe(true);
  });

  it('returns true at min_age boundary', () => {
    const p = makeProduct({ min_age: 5, max_age: 10 });
    expect(isAgeEligible(p, 5)).toBe(true);
  });

  it('returns true at max_age boundary', () => {
    const p = makeProduct({ min_age: 5, max_age: 10 });
    expect(isAgeEligible(p, 10)).toBe(true);
  });

  it('returns false when age is below min_age', () => {
    const p = makeProduct({ min_age: 6, max_age: 12 });
    expect(isAgeEligible(p, 4)).toBe(false);
  });

  it('returns false when age is above max_age', () => {
    const p = makeProduct({ min_age: 3, max_age: 5 });
    expect(isAgeEligible(p, 7)).toBe(false);
  });
});

// ─── isOccasionEligible ───────────────────────────────────────────────────────

describe('isOccasionEligible', () => {
  it('returns true when product has the requested occasion', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ occasion: new Set(['1:CELEBRATION']) });
    expect(isOccasionEligible(p, 'CELEBRATION', maps)).toBe(true);
  });

  it('returns false when product does not have the occasion', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ occasion: new Set(['1:HALLOWEEN']) });
    expect(isOccasionEligible(p, 'CELEBRATION', maps)).toBe(false);
  });

  it('returns false when occasion set is empty', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ occasion: new Set() });
    expect(isOccasionEligible(p, 'CELEBRATION', maps)).toBe(false);
  });

  it('returns true for HALLOWEEN-specific product with HALLOWEEN request', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ occasion: new Set(['1:HALLOWEEN']) });
    expect(isOccasionEligible(p, 'HALLOWEEN', maps)).toBe(true);
  });
});

// ─── isAudienceCompatible ─────────────────────────────────────────────────────

describe('isAudienceCompatible', () => {
  // NO_PREFERENCE
  it('NO_PREFERENCE: accepts UNIVERSAL product', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ audience: new Map([['1:UNIVERSAL', 80]]) });
    expect(isAudienceCompatible(p, 'NO_PREFERENCE', maps)).toBe(true);
  });

  it('NO_PREFERENCE: accepts product with no affinity', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps();
    expect(isAudienceCompatible(p, 'NO_PREFERENCE', maps)).toBe(true);
  });

  it('NO_PREFERENCE: rejects FEMININE-only product', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ audience: new Map([['1:FEMININE', 80]]) });
    expect(isAudienceCompatible(p, 'NO_PREFERENCE', maps)).toBe(false);
  });

  it('NO_PREFERENCE: rejects MASCULINE-only product', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ audience: new Map([['1:MASCULINE', 70]]) });
    expect(isAudienceCompatible(p, 'NO_PREFERENCE', maps)).toBe(false);
  });

  // FEMININE
  it('FEMININE: accepts FEMININE product', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ audience: new Map([['1:FEMININE', 80]]) });
    expect(isAudienceCompatible(p, 'FEMININE', maps)).toBe(true);
  });

  it('FEMININE: accepts UNIVERSAL product', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ audience: new Map([['1:UNIVERSAL', 80]]) });
    expect(isAudienceCompatible(p, 'FEMININE', maps)).toBe(true);
  });

  it('FEMININE: rejects MASCULINE-only product', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ audience: new Map([['1:MASCULINE', 70]]) });
    expect(isAudienceCompatible(p, 'FEMININE', maps)).toBe(false);
  });

  it('FEMININE: accepts product with no affinity', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps();
    expect(isAudienceCompatible(p, 'FEMININE', maps)).toBe(true);
  });

  // MASCULINE
  it('MASCULINE: accepts MASCULINE product', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ audience: new Map([['1:MASCULINE', 70]]) });
    expect(isAudienceCompatible(p, 'MASCULINE', maps)).toBe(true);
  });

  it('MASCULINE: rejects FEMININE-only product', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ audience: new Map([['1:FEMININE', 80]]) });
    expect(isAudienceCompatible(p, 'MASCULINE', maps)).toBe(false);
  });

  it('MASCULINE: accepts UNIVERSAL product', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ audience: new Map([['1:UNIVERSAL', 80]]) });
    expect(isAudienceCompatible(p, 'MASCULINE', maps)).toBe(true);
  });
});

// ─── isEligible (combined) ────────────────────────────────────────────────────

describe('isEligible', () => {
  it('returns true for a fully eligible product', () => {
    const p = makeProduct({ id: 1, active: true, inventory_quantity: 10, min_age: 3, max_age: 12 });
    const maps = makeAffinityMaps({ occasion: new Set(['1:CELEBRATION']) });
    expect(isEligible(p, 7, 'CELEBRATION', maps)).toBe(true);
  });

  it('returns false for inactive product', () => {
    const p = makeProduct({ id: 1, active: false });
    const maps = makeAffinityMaps({ occasion: new Set(['1:CELEBRATION']) });
    expect(isEligible(p, 7, 'CELEBRATION', maps)).toBe(false);
  });

  it('returns false for out-of-stock product', () => {
    const p = makeProduct({ id: 1, inventory_quantity: 0 });
    const maps = makeAffinityMaps({ occasion: new Set(['1:CELEBRATION']) });
    expect(isEligible(p, 7, 'CELEBRATION', maps)).toBe(false);
  });

  it('returns false for age mismatch', () => {
    const p = makeProduct({ id: 1, min_age: 8, max_age: 12 });
    const maps = makeAffinityMaps({ occasion: new Set(['1:CELEBRATION']) });
    expect(isEligible(p, 5, 'CELEBRATION', maps)).toBe(false);
  });

  it('returns false for occasion mismatch', () => {
    const p = makeProduct({ id: 1 });
    const maps = makeAffinityMaps({ occasion: new Set(['1:HALLOWEEN']) });
    expect(isEligible(p, 7, 'CELEBRATION', maps)).toBe(false);
  });
});

// ─── filterEligibleProducts ───────────────────────────────────────────────────

describe('filterEligibleProducts', () => {
  it('returns only eligible, audience-compatible products', () => {
    const p1 = makeProduct({ id: 1, active: true, inventory_quantity: 10, min_age: 3, max_age: 12 });
    const p2 = makeProduct({ id: 2, active: false, inventory_quantity: 10, min_age: 3, max_age: 12 });
    const p3 = makeProduct({ id: 3, active: true, inventory_quantity: 10, min_age: 3, max_age: 12 });

    const maps = makeAffinityMaps({
      occasion: new Set(['1:CELEBRATION', '3:CELEBRATION']),
      audience: new Map([['3:MASCULINE', 70]]), // p3 is MASCULINE-only
    });

    const result = filterEligibleProducts([p1, p2, p3], 7, 'CELEBRATION', 'FEMININE', maps);

    // p2 excluded: inactive; p3 excluded: MASCULINE-only with FEMININE request
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});
