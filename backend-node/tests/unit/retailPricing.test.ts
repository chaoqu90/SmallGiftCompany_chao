/**
 * Unit tests for the retail price formula.
 * Tests all four price tiers and boundary values.
 * No DB required — pure function.
 */
import { describe, it, expect } from 'vitest';
import { computeRetailPrice } from '../../src/services/retailPricing.js';

describe('computeRetailPrice', () => {
  // ── Tier 1: cogAdjusted < $1.00 → fixed $0.50 ────────────────────────────
  it('returns $0.50 for cogAdjusted = 0.00', () => {
    expect(computeRetailPrice(0.00)).toBe(0.50);
  });

  it('returns $0.50 for cogAdjusted = 0.80', () => {
    expect(computeRetailPrice(0.80)).toBe(0.50);
  });

  it('returns $0.50 for cogAdjusted = 0.99 (just below tier boundary)', () => {
    expect(computeRetailPrice(0.99)).toBe(0.50);
  });

  // ── Tier 2: $1.00–$3.99 → cogAdjusted / 2 ───────────────────────────────
  it('returns $0.50 for cogAdjusted = 1.00 (lower boundary)', () => {
    expect(computeRetailPrice(1.00)).toBe(0.50);
  });

  it('returns $1.00 for cogAdjusted = 2.00', () => {
    expect(computeRetailPrice(2.00)).toBe(1.00);
  });

  it('returns $1.50 for cogAdjusted = 3.00', () => {
    expect(computeRetailPrice(3.00)).toBe(1.50);
  });

  it('returns $1.995 rounded to $2.00 for cogAdjusted = 3.99 (upper boundary)', () => {
    expect(computeRetailPrice(3.99)).toBe(2.00);
  });

  // ── Tier 3: $4.00–$9.99 → cogAdjusted / 3 + 2/3 ─────────────────────────
  it('returns $2.00 for cogAdjusted = 4.00 (lower boundary)', () => {
    // 4/3 + 2/3 = 6/3 = 2.00
    expect(computeRetailPrice(4.00)).toBe(2.00);
  });

  it('returns $2.67 for cogAdjusted = 6.00', () => {
    // 6/3 + 2/3 = 2 + 0.667 = 2.667 → rounded $2.67
    expect(computeRetailPrice(6.00)).toBe(2.67);
  });

  it('returns $4.00 for cogAdjusted = 10.00 — boundary goes to tier 4', () => {
    // 10 * 0.4 = 4.00
    expect(computeRetailPrice(10.00)).toBe(4.00);
  });

  it('returns correct value for cogAdjusted = 9.99 (just below tier 4)', () => {
    // 9.99/3 + 2/3 = 3.33 + 0.667 = 3.997 → rounded $4.00
    expect(computeRetailPrice(9.99)).toBe(4.00);
  });

  // ── Tier 4: >= $10.00 → cogAdjusted × 0.4 ────────────────────────────────
  it('returns $4.00 for cogAdjusted = 10.00', () => {
    expect(computeRetailPrice(10.00)).toBe(4.00);
  });

  it('returns $6.00 for cogAdjusted = 15.00', () => {
    expect(computeRetailPrice(15.00)).toBe(6.00);
  });

  it('returns $8.00 for cogAdjusted = 20.00', () => {
    expect(computeRetailPrice(20.00)).toBe(8.00);
  });

  // ── Rounding ──────────────────────────────────────────────────────────────
  it('rounds to 2 decimal places', () => {
    // 5/3 + 2/3 = 7/3 = 2.333... → $2.33
    const result = computeRetailPrice(5.00);
    expect(result).toBe(2.33);
  });
});
