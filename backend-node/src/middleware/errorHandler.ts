/**
 * Express RFC 7807 error handler.
 *
 * Must be registered LAST in the middleware chain (after all routers).
 * All route handlers must call next(err) to propagate errors here.
 *
 * Handles:
 *   - ZodError     → 400 about:validation-error (AC4.3, AC11.2)
 *   - BundleGenerationError → 422 about:bundle-generation-error + failureCode (AC4.11, AC11.3)
 *   - Everything else       → 500 about:internal-error (AC11.4)
 *
 * The instance field is always the request path (AC11.5).
 * Stack traces are NEVER included in responses (AC11.4).
 *
 * Mirrors Spring Boot GlobalExceptionHandler exactly.
 */
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { BundleGenerationError } from '../types/errors.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const detail = err.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('; ');

    res.status(400).json({
      type: 'about:validation-error',
      title: 'Validation Failed',
      status: 400,
      detail,
      instance: req.path,
    });
    return;
  }

  if (err instanceof BundleGenerationError) {
    res.status(422).json({
      type: 'about:bundle-generation-error',
      title: 'Bundle Generation Failed',
      status: 422,
      detail: err.message,
      instance: req.path,
      failureCode: err.failureCode,
    });
    return;
  }

  // Unhandled error — log internally but never expose details (AC11.4)
  console.error('[unhandled error]', err);

  res.status(500).json({
    type: 'about:internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred.',
    instance: req.path,
  });
}
