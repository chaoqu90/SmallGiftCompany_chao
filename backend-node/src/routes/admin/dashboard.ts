/**
 * Admin dashboard routes — all protected by basicAuth.
 *
 * GET /admin/api/dashboard/                 — analytics counts (AC10.1)
 * GET /admin/api/dashboard/product-coverage — product coverage simulation (AC10.2, AC10.3)
 *
 * The product-coverage endpoint runs the bundle simulation across all combinations
 * of age midpoints, interests, audience preferences, party types, and active budget tiers,
 * returning which products appear and under which conditions.
 *
 * MUST NOT write to the database (AC10.2). All simulation is done in-memory.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { basicAuth } from '../../middleware/auth.js';
import * as analyticsService from '../../services/analytics.js';
import { runSimulation } from '../../services/bundleSimulation.js';
import * as productsRepo from '../../repositories/products.js';
import * as affinitiesRepo from '../../repositories/affinities.js';
import * as budgetTiersRepo from '../../repositories/budgetTiers.js';
import * as bundleTemplatesRepo from '../../repositories/bundleTemplates.js';
import type { AffinityMaps } from '../../types/entities.js';

export const adminDashboardRouter = Router();

adminDashboardRouter.use(basicAuth);

/**
 * GET /admin/api/dashboard
 *
 * Returns analytics event counts for the dashboard (AC10.1):
 *   - finderCompletions: count of FINDER_COMPLETED events
 *   - bundleViews: count of BUNDLE_VIEWED events
 */
adminDashboardRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const counts = await analyticsService.getDashboardCounts();
      res.json(counts);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /admin/api/dashboard/product-coverage
 *
 * Runs the in-memory bundle simulation across all dimension combinations
 * and returns a flat list of ProductCoverageRecord objects.
 *
 * Steps:
 *   1. Load all active products (no age/partyType filter — simulation uses all)
 *   2. Batch-load all four affinity types for those products
 *   3. Load all active budget tiers
 *   4. Load all active templates into an in-memory Map<code, template>
 *   5. Run runSimulation(deps) — pure function, no DB writes
 *   6. Return the coverage records as JSON
 *
 * AC10.2 — read-only, no writes.
 * AC10.3 — uses constrained (PATH 2) simulation logic.
 */
adminDashboardRouter.get(
  '/product-coverage',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Step 1: Load all active products without age/partyType filter
      // We use listProducts() to get all products and simulate selectively
      const allProducts = await productsRepo.listProducts();
      const activeProducts = allProducts.filter(p => p.active && p.inventory_quantity > 0);

      if (activeProducts.length === 0) {
        res.json([]);
        return;
      }

      const productIds = activeProducts.map(p => p.id);

      // Step 2: Batch-load all four affinity types in parallel
      const [interestRows, audienceRows, roleRows, occasionRows] = await Promise.all([
        affinitiesRepo.loadInterestAffinities(productIds),
        affinitiesRepo.loadAudienceAffinities(productIds),
        affinitiesRepo.loadRoleAffinities(productIds),
        affinitiesRepo.loadOccasionAffinities(productIds),
      ]);

      const affinityMaps: AffinityMaps = {
        interest: new Map(interestRows.map(r => [`${r.product_id}:${r.interest}`, r.weight])),
        audience: new Map(audienceRows.map(r => [`${r.product_id}:${r.audience}`, r.weight])),
        role: new Map(roleRows.map(r => [`${r.product_id}:${r.role}`, r.weight])),
        occasion: new Set(occasionRows.map(r => `${r.product_id}:${r.occasion}`)),
      };

      // Step 3: Load all active budget tiers
      const activeBudgetTiers = await budgetTiersRepo.listActiveBudgetTiers();

      // Step 4: Load all active templates into a Map keyed by code
      const activeTemplates = await bundleTemplatesRepo.listAllActiveTemplates();
      const templatesByCode = new Map(
        activeTemplates.map(t => [
          t.code,
          {
            slots: t.slots.map(s => ({
              slot_code: s.slot_code,
              display_order: s.display_order,
              allowed_roles: s.allowed_roles,
            })),
          },
        ]),
      );

      // Step 5: Run pure simulation — no DB writes (AC10.2)
      const coverageRecords = runSimulation({
        products: activeProducts,
        activeBudgetTiers,
        affinityMaps,
        templatesByCode,
      });

      res.json(coverageRecords);
    } catch (err) {
      next(err);
    }
  },
);
