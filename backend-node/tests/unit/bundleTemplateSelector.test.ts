/**
 * Unit tests for bundle template selector.
 * Tests all three routing rules including the READING_PUZZLE fallback.
 * No DB required — pure function.
 */
import { describe, it, expect } from 'vitest';
import { selectTemplateCode, FALLBACK_TEMPLATE_CODE } from '../../src/services/bundleTemplateSelector.js';

describe('selectTemplateCode', () => {
  // ── Rule 1: age <= 5 → PRESCHOOL_4_ITEM ──────────────────────────────────
  it('selects PRESCHOOL_4_ITEM for age 3', () => {
    expect(selectTemplateCode(3, 'TOYS_PLAY')).toBe('PRESCHOOL_4_ITEM');
  });

  it('selects PRESCHOOL_4_ITEM for age 5 (boundary)', () => {
    expect(selectTemplateCode(5, 'CUTE_MAGICAL')).toBe('PRESCHOOL_4_ITEM');
  });

  it('selects PRESCHOOL_4_ITEM for age 5 even with READING_PUZZLE interest', () => {
    // Age rule takes precedence over interest rule
    expect(selectTemplateCode(5, 'READING_PUZZLE')).toBe('PRESCHOOL_4_ITEM');
  });

  // ── Rule 2: age > 5 + READING_PUZZLE → READING_PUZZLE_4_ITEM ─────────────
  it('selects READING_PUZZLE_4_ITEM for age 6 with READING_PUZZLE interest', () => {
    expect(selectTemplateCode(6, 'READING_PUZZLE')).toBe('READING_PUZZLE_4_ITEM');
  });

  it('selects READING_PUZZLE_4_ITEM for age 12 with READING_PUZZLE interest', () => {
    expect(selectTemplateCode(12, 'READING_PUZZLE')).toBe('READING_PUZZLE_4_ITEM');
  });

  // ── Rule 3: otherwise → GENERAL_4_ITEM ───────────────────────────────────
  it('selects GENERAL_4_ITEM for age 6 with CUTE_MAGICAL interest', () => {
    expect(selectTemplateCode(6, 'CUTE_MAGICAL')).toBe('GENERAL_4_ITEM');
  });

  it('selects GENERAL_4_ITEM for age 10 with SPORTS interest', () => {
    expect(selectTemplateCode(10, 'SPORTS')).toBe('GENERAL_4_ITEM');
  });

  it('selects GENERAL_4_ITEM for age 9 with POP_MUSIC interest', () => {
    expect(selectTemplateCode(9, 'POP_MUSIC')).toBe('GENERAL_4_ITEM');
  });

  it('selects GENERAL_4_ITEM for age 7 with TOYS_PLAY interest', () => {
    expect(selectTemplateCode(7, 'TOYS_PLAY')).toBe('GENERAL_4_ITEM');
  });

  // ── READING_PUZZLE fallback template constant ─────────────────────────────
  it('FALLBACK_TEMPLATE_CODE is GENERAL_4_ITEM', () => {
    // The generation service falls back to this when READING_PUZZLE_4_ITEM is inactive
    expect(FALLBACK_TEMPLATE_CODE).toBe('GENERAL_4_ITEM');
  });
});
