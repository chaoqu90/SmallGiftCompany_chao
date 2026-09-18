/**
 * Admin analytics routes — HTTP Basic auth required (applied at router level).
 *
 * GET /admin/api/analytics/online?dateFrom=&dateTo= — online shopping analytics
 * GET /admin/api/analytics/inventory               — inventory insights
 *
 * Note: there is already a public /api/analytics router for event capture.
 * This router is mounted at /admin/api/analytics — no collision.
 *
 * Design: specs/analytics/design.md §B, §C.4, §C.5
 * Requirements: FEAT-006 R-AO-1 through R-AO-4, R-AI-1 through R-AI-3
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { basicAuth } from '../../middleware/auth.js';
import { getOnlineAnalytics, getInventoryInsights, getCombinedOverviewAnalytics } from '../../repositories/adminAnalytics.js';

export const adminAnalyticsRouter = Router();

// Apply Basic auth to every route
adminAnalyticsRouter.use(basicAuth);

// ─── GET /online ─────────────────────────────────────────────────────────────

/**
 * Online shopping analytics for a given date range.
 *
 * Query parameters (both required):
 *   dateFrom: YYYY-MM-DD — inclusive start date (applied as 00:00:00 UTC)
 *   dateTo:   YYYY-MM-DD — inclusive end date (applied as 23:59:59 UTC)
 *
 * HTTP 400 when:
 *   - dateFrom or dateTo is missing
 *   - either is not a valid YYYY-MM-DD date
 *   - dateFrom > dateTo
 *
 * Requirements: R-AO-1, R-AO-2, R-AO-3, R-AO-4
 * Design: §C.4
 */
adminAnalyticsRouter.get(
  '/online',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };

      // Validate presence
      if (!dateFrom || !dateTo) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: 'dateFrom and dateTo query parameters are required.',
          instance: req.path,
        });
        return;
      }

      // Validate format
      const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      if (!ISO_DATE_RE.test(dateFrom) || isNaN(Date.parse(dateFrom))) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: 'dateFrom must be a valid ISO date (YYYY-MM-DD).',
          instance: req.path,
        });
        return;
      }

      if (!ISO_DATE_RE.test(dateTo) || isNaN(Date.parse(dateTo))) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: 'dateTo must be a valid ISO date (YYYY-MM-DD).',
          instance: req.path,
        });
        return;
      }

      // Validate range
      if (dateFrom > dateTo) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: 'dateFrom must not be after dateTo.',
          instance: req.path,
        });
        return;
      }

      const result = await getOnlineAnalytics(dateFrom, dateTo);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /overview ────────────────────────────────────────────────────────────

adminAnalyticsRouter.get(
  '/overview',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
      if (!dateFrom || !dateTo) {
        res.status(400).json({ detail: 'dateFrom and dateTo are required.' }); return;
      }
      const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      if (!ISO_DATE_RE.test(dateFrom) || isNaN(Date.parse(dateFrom)) ||
          !ISO_DATE_RE.test(dateTo)   || isNaN(Date.parse(dateTo))) {
        res.status(400).json({ detail: 'Dates must be valid ISO dates (YYYY-MM-DD).' }); return;
      }
      if (dateFrom > dateTo) {
        res.status(400).json({ detail: 'dateFrom must not be after dateTo.' }); return;
      }
      const result = await getCombinedOverviewAnalytics(dateFrom, dateTo);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /inventory ───────────────────────────────────────────────────────────

/**
 * Inventory insights: low-stock products + fast-moving products.
 *
 * No query parameters. All filtering is server-side with fixed thresholds:
 *   lowStockThreshold = 10 units
 *   fastMovingWindowDays = 30 days (combined online + offline channels)
 *
 * Requirements: R-AI-1, R-AI-2, R-AI-3
 * Design: §C.5
 */
adminAnalyticsRouter.get(
  '/inventory',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await getInventoryInsights();
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
