/**
 * Admin bundle routes — all protected by basicAuth.
 *
 * GET /admin/api/bundles/          — list recent bundles, newest first (AC9.1)
 * GET /admin/api/bundles/:publicId — full bundle aggregate (AC9.2–AC9.3)
 *
 * Both endpoints return the same GeneratedBundleResponse shape used by the
 * public endpoint, allowing the dashboard to reuse the same display component.
 *
 * The list endpoint returns up to 200 entries (design.md §2.11).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { basicAuth } from '../../middleware/auth.js';
import * as generatedBundleService from '../../services/generatedBundle.js';
import * as generatedBundlesRepo from '../../repositories/generatedBundles.js';

export const adminBundlesRouter = Router();

adminBundlesRouter.use(basicAuth);

/**
 * GET /admin/api/bundles
 *
 * Returns the 200 most recently generated bundles, newest first (AC9.1).
 * Each entry includes templateCode and budgetTierCode (joined from DB).
 */
adminBundlesRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bundles = await generatedBundlesRepo.listRecentBundles(200);
      res.json(bundles);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /admin/api/bundles/:publicId
 *
 * Returns the full bundle aggregate for the given public_id (AC9.2).
 * Returns 404 ProblemDetail if not found (AC9.3).
 */
adminBundlesRouter.get(
  '/:publicId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bundle = await generatedBundleService.getByPublicId(req.params.publicId);

      if (!bundle) {
        res.status(404).json({
          type: 'about:bundle-not-found',
          title: 'Bundle Not Found',
          status: 404,
          detail: `No bundle found with id: ${req.params.publicId}`,
          instance: req.path,
        });
        return;
      }

      res.json(bundle);
    } catch (err) {
      next(err);
    }
  },
);
