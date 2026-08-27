/**
 * Retail price formula — pure function, no DB dependencies.
 *
 * Computes the server-side retail price from cogAdjusted (= cost + cogOverhead).
 * Browser-supplied prices are NEVER trusted (tech-overview.md §15, AC4.9).
 *
 * Mirrors AdminProductController.computeRetailPrice() from the Spring Boot codebase
 * (docs/backend-design.md §8).
 *
 * Tiered formula:
 *   cogAdjusted < $1.00  → fixed $0.50
 *   $1.00–$3.99          → cogAdjusted / 2
 *   $4.00–$9.99          → cogAdjusted / 3 + 2/3
 *   >= $10.00            → cogAdjusted × 0.4
 *
 * Unit-tested in tests/unit/retailPricing.test.ts.
 */

/**
 * Computes the retail price from the COG-adjusted cost using a tiered formula.
 * Returns a number rounded to 2 decimal places.
 */
export function computeRetailPrice(cogAdjusted: number): number {
  let price: number;

  if (cogAdjusted < 1.00) {
    price = 0.50;
  } else if (cogAdjusted < 4.00) {
    price = cogAdjusted / 2;
  } else if (cogAdjusted < 10.00) {
    price = cogAdjusted / 3 + 2 / 3;
  } else {
    price = cogAdjusted * 0.4;
  }

  return Math.round(price * 100) / 100;
}
