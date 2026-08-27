/**
 * Bundle template selector — pure function, no DB dependencies.
 *
 * Routes a generation request to the correct template code based on age and interest.
 * The actual template DB lookup is performed by the generation service.
 *
 * Routing rules (tech-overview.md §8.2, design.md §2.8):
 *   age <= 5                          → 'PRESCHOOL_4_ITEM'
 *   age > 5 AND interest = READING_PUZZLE → 'READING_PUZZLE_4_ITEM'
 *   otherwise                          → 'GENERAL_4_ITEM'
 *
 * NOTE: If the resolved template is inactive in the DB (e.g., READING_PUZZLE_4_ITEM),
 * the generation service falls back to GENERAL_4_ITEM (mirrors BundleTemplateSelector.java).
 *
 * Mirrors BundleTemplateSelector.java from the Spring Boot codebase.
 * Unit-tested in tests/unit/bundleTemplateSelector.test.ts.
 */

export type TemplateCode =
  | 'PRESCHOOL_4_ITEM'
  | 'READING_PUZZLE_4_ITEM'
  | 'GENERAL_4_ITEM';

/**
 * Returns the template code for a given age and interest.
 *
 * The generation service will look up the template in the DB and fall back to
 * GENERAL_4_ITEM if the returned code is inactive.
 */
export function selectTemplateCode(age: number, interest: string): TemplateCode {
  if (age <= 5) {
    return 'PRESCHOOL_4_ITEM';
  }

  if (interest === 'READING_PUZZLE') {
    return 'READING_PUZZLE_4_ITEM';
  }

  return 'GENERAL_4_ITEM';
}

/** Fallback template when the primary selection is not found or inactive. */
export const FALLBACK_TEMPLATE_CODE: TemplateCode = 'GENERAL_4_ITEM';
