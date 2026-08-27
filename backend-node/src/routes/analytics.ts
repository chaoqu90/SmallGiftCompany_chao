/**
 * Public analytics routes.
 *
 * POST /api/analytics/events — capture an analytics event (AC6.1–AC6.5)
 *
 * Returns 201 with an empty body on success (AC6.5).
 * Zod validation failures are forwarded to next(err) → 400 ProblemDetail.
 *
 * bundle_id is stored as-is (no FK — survivability requirement AC6.3).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { EventCaptureRequestSchema } from '../types/dtos.js';
import * as analyticsService from '../services/analytics.js';

export const analyticsRouter = Router();

/**
 * POST /api/analytics/events
 *
 * Validates request body with Zod then records the event.
 * Always returns 201 with no body (AC6.5).
 *
 * AC6.1–AC6.5.
 */
analyticsRouter.post(
  '/events',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = EventCaptureRequestSchema.parse(req.body);
      await analyticsService.recordEvent(parsed);
      res.status(201).end();
    } catch (err) {
      next(err);
    }
  },
);
