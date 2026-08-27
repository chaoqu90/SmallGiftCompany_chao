/**
 * Domain error types for bundle generation failures.
 *
 * Maps to Java: BundleGenerationException and BundleGenerationException.FailureCode.
 * The failureCode is included in the RFC 7807 ProblemDetail response body (HTTP 422).
 */

/**
 * Typed failure codes preserved from the Java FailureCode enum.
 * Each code maps to a specific bundle generation failure scenario.
 */
export type FailureCode =
  | 'INSUFFICIENT_ROLE_COVERAGE'  // No product can fill a required template slot
  | 'NO_BUDGET_FEASIBLE'          // Even the cheapest eligible products exceed the budget
  | 'NO_ELIGIBLE_PRODUCTS'        // All products filtered out before slot assignment
  | 'TEMPLATE_NOT_FOUND'          // Template code resolves to nothing in the DB
  | 'BUDGET_TIER_NOT_FOUND'       // Requested budget tier code doesn't exist or is inactive
  | 'NO_GIFT_BAG_CONFIGURED';     // No default gift bag option is configured in the DB

/**
 * Domain exception thrown by the bundle generation service.
 * Caught by the Express error handler and returned as HTTP 422 ProblemDetail.
 */
export class BundleGenerationError extends Error {
  public readonly failureCode: FailureCode;

  constructor(failureCode: FailureCode, message: string) {
    super(message);
    this.name = 'BundleGenerationError';
    this.failureCode = failureCode;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BundleGenerationError);
    }
  }
}
