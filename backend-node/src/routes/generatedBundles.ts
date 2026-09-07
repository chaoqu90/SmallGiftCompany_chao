/**
 * Public bundle routes.
 *
 * POST /api/generated-bundles      — generate a new bundle (AC4.1–AC4.13)
 * GET  /api/generated-bundles/:publicId — retrieve existing bundle (AC5.1–AC5.3)
 *
 * Zod validation errors are forwarded to next(err) so the RFC 7807
 * error handler formats them as 400 about:validation-error (AC11.2).
 *
 * BundleGenerationError is forwarded to next(err) and mapped to 422
 * about:bundle-generation-error (AC11.3).
 *
 * Uses real repository and service modules (not injected) — dependency
 * injection is only used in unit tests via bundleGeneration.generate(request, repos).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { BundleGenerationRequestSchema } from '../types/dtos.js';
import * as bundleGenerationService from '../services/bundleGeneration.js';
import { buildResponse } from '../services/bundleGeneration.js';
import * as generatedBundleService from '../services/generatedBundle.js';
import * as productsRepo from '../repositories/products.js';
import * as affinitiesRepo from '../repositories/affinities.js';
import * as bundleTemplatesRepo from '../repositories/bundleTemplates.js';
import * as budgetTiersRepo from '../repositories/budgetTiers.js';
import * as giftBagOptionsRepo from '../repositories/giftBagOptions.js';
import { getBundle, putBundle } from '../lib/bundleCache.js';
import { saveBundle } from '../repositories/generatedBundles.js';
import type { GenerationRepos } from '../services/bundleGeneration.js';

// Secret key for optional JWT extraction (same key used by jwtAuth middleware)
const jwtSecretKey = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null;

/**
 * Attempts to extract user UUID from Authorization: Bearer header.
 * Returns null if no header, invalid token, or secret not configured.
 * Never throws — failures are silently ignored so the route stays public.
 */
async function tryExtractUserId(req: Request): Promise<string | null> {
  if (!jwtSecretKey) return null;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey, { algorithms: ['HS256'] });
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export const generatedBundlesRouter = Router();

/**
 * Production repos wired to the real database.
 * Constructed once at module scope — safe for Lambda warm reuse.
 */
const productionRepos: GenerationRepos = {
  findBudgetTierByCode: budgetTiersRepo.findBudgetTierByCode,
  findTemplateByCode: bundleTemplatesRepo.findTemplateByCode,
  findAllEligibleForGeneration: productsRepo.findAllEligibleForGeneration,
  loadInterestAffinities: affinitiesRepo.loadInterestAffinities,
  loadAudienceAffinities: affinitiesRepo.loadAudienceAffinities,
  loadRoleAffinities: affinitiesRepo.loadRoleAffinities,
  loadOccasionAffinities: affinitiesRepo.loadOccasionAffinities,
  findDefaultGiftBag: giftBagOptionsRepo.findDefaultGiftBag,
};

/**
 * POST /api/generated-bundles
 *
 * Validates request body with Zod, runs three-path bundle generation,
 * persists the snapshot, and returns 201 with the GeneratedBundleResponse.
 *
 * AC4.1–AC4.13.
 */
generatedBundlesRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = BundleGenerationRequestSchema.parse(req.body);
      // Optionally associate the bundle with the authenticated user (design.md §5)
      // The endpoint remains public — userId is null for anonymous requests.
      const userId = await tryExtractUserId(req);
      const { response, snapshot, templateCode } = await bundleGenerationService.generate(parsed, productionRepos, userId);
      // Always persist to DB immediately — Lambda statelessness means the in-memory
      // cache is unreliable across invocations (checkout hits a different instance).
      // Also keep in-memory cache for fast same-instance retrieval (GET endpoint).
      await saveBundle(snapshot);
      putBundle(snapshot.publicId, snapshot, templateCode);
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/generated-bundles/:publicId
 *
 * Returns the bundle if found (200) or a 404 ProblemDetail if not (AC5.2).
 *
 * AC5.1–AC5.3.
 */
generatedBundlesRouter.get(
  '/:publicId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Check in-memory cache first (bundle generated but not yet added to cart)
      const cached = getBundle(req.params.publicId);
      if (cached) {
        res.status(200).json(buildResponse(cached.snapshot.publicId, cached.templateCode, cached.snapshot));
        return;
      }

      // 2. Fall back to DB (bundle already saved via cart-add)
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

      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  },
);
