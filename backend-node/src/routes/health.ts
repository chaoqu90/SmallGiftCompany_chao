/**
 * GET /api/health — liveness probe.
 *
 * AC3.1: Returns 200 with { status: 'UP' }.
 * AC3.2: No authentication required.
 * AC3.3: Must respond within 500 ms on cold start (met by lightweight handler).
 */
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'UP' });
});
