/**
 * Admin product routes — all protected by basicAuth.
 *
 * GET    /admin/api/products/                  — list all products (AC7.3)
 * GET    /admin/api/products/meta              — enum metadata (AC7.4)
 * POST   /admin/api/products/                  — create product (AC7.5)
 * PATCH  /admin/api/products/:id/inventory     — update inventory (AC7.6)
 * PATCH  /admin/api/products/:id/active        — toggle active flag (AC7.7)
 * PATCH  /admin/api/products/:id/pricing       — update cost/overhead (AC7.8)
 * PATCH  /admin/api/products/:id/category      — update category (AC7.9)
 * PATCH  /admin/api/products/:id/upgrade-tier  — update upgrade tier (AC7.9)
 * PATCH  /admin/api/products/:id/age-range     — update age range (AC7.9)
 * PATCH  /admin/api/products/:id/details       — update name/category/formFactor (AC7.9)
 * DELETE /admin/api/products/:id               — delete product (AC7.10–AC7.11)
 * GET    /admin/api/products/:id/affinities    — get affinities (AC8.1)
 * PUT    /admin/api/products/:id/affinities    — replace affinities (AC8.2)
 *
 * Numeric IDs are validated and returned as 400 if non-integer.
 * 404 returned when the product does not exist.
 * 409 returned when deleting a product referenced by a bundle item (AC7.10).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { basicAuth } from '../../middleware/auth.js';
import { CreateProductRequestSchema, AffinityPayloadSchema } from '../../types/dtos.js';
import * as productsRepo from '../../repositories/products.js';
import * as affinitiesRepo from '../../repositories/affinities.js';
import {
  ALL_PRODUCT_CATEGORIES,
  ALL_FORM_FACTORS,
  ALL_UPGRADE_TIERS,
  ALL_INTERESTS,
  ALL_PARTY_TYPES,
  ALL_AUDIENCE_AFFINITIES,
  ALL_BUNDLE_ROLES,
} from '../../types/enums.js';

export const adminProductsRouter = Router();

// Apply auth to all routes in this router
adminProductsRouter.use(basicAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses :id param as a positive integer.
 * Calls next() with a 400 error if invalid.
 */
function parseId(idStr: string, res: Response, _next: NextFunction): number | null {
  const id = parseInt(idStr, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== idStr) {
    res.status(400).json({
      type: 'about:validation-error',
      title: 'Bad Request',
      status: 400,
      detail: `Invalid product id: ${idStr}`,
      instance: '',
    });
    return null;
  }
  return id;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /admin/api/products
 *
 * Returns all products sorted by name (AC7.3).
 */
adminProductsRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await productsRepo.listProducts();
      res.json(products);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /admin/api/products/meta
 *
 * Returns enum metadata: categories, formFactors, upgradeTiers, interests,
 * partyTypes, audienceAffinities, bundleRoles (AC7.4).
 *
 * IMPORTANT: this route must be registered BEFORE /:id routes so Express
 * does not treat "meta" as a numeric id.
 */
adminProductsRouter.get(
  '/meta',
  (_req: Request, res: Response): void => {
    res.json({
      categories: ALL_PRODUCT_CATEGORIES,
      formFactors: ALL_FORM_FACTORS,
      upgradeTiers: ALL_UPGRADE_TIERS,
      interests: ALL_INTERESTS,
      partyTypes: ALL_PARTY_TYPES,
      audienceAffinities: ALL_AUDIENCE_AFFINITIES,
      bundleRoles: ALL_BUNDLE_ROLES,
    });
  },
);

/**
 * POST /admin/api/products
 *
 * Creates a product. cogAdjusted and retailPrice are computed server-side;
 * the request must NOT include them (AC7.5, AC4.9).
 */
adminProductsRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = CreateProductRequestSchema.parse(req.body);
      const product = await productsRepo.createProduct(data);
      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /admin/api/products/:id/inventory
 *
 * Updates inventory_quantity (AC7.6).
 */
adminProductsRouter.patch(
  '/:id/inventory',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      const schema = z.object({ inventoryQuantity: z.number().int().min(0) });
      const { inventoryQuantity } = schema.parse(req.body);

      const product = await productsRepo.updateProductInventory(id, inventoryQuantity);
      if (!product) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${id}`,
          instance: req.path,
        });
        return;
      }
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /admin/api/products/:id/active
 *
 * Toggles the active flag (AC7.7).
 */
adminProductsRouter.patch(
  '/:id/active',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      const schema = z.object({ active: z.boolean() });
      const { active } = schema.parse(req.body);

      const product = await productsRepo.updateProductActive(id, active);
      if (!product) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${id}`,
          instance: req.path,
        });
        return;
      }
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /admin/api/products/:id/pricing
 *
 * Updates cost and cogOverhead; server recomputes cogAdjusted and retailPrice (AC7.8).
 */
adminProductsRouter.patch(
  '/:id/pricing',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      const schema = z.object({
        cost: z.number().positive(),
        cogOverhead: z.number().min(0),
      });
      const { cost, cogOverhead } = schema.parse(req.body);

      const product = await productsRepo.updateProductPricing(id, cost, cogOverhead);
      if (!product) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${id}`,
          instance: req.path,
        });
        return;
      }
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /admin/api/products/:id/category
 *
 * Updates the product category (AC7.9).
 */
adminProductsRouter.patch(
  '/:id/category',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      const schema = z.object({ category: z.string().min(1).max(30) });
      const { category } = schema.parse(req.body);

      const product = await productsRepo.updateProductCategory(id, category);
      if (!product) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${id}`,
          instance: req.path,
        });
        return;
      }
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /admin/api/products/:id/upgrade-tier
 *
 * Updates the upgrade tier (AC7.9).
 */
adminProductsRouter.patch(
  '/:id/upgrade-tier',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      const schema = z.object({ upgradeTier: z.enum(['STANDARD', 'PREMIUM']) });
      const { upgradeTier } = schema.parse(req.body);

      const product = await productsRepo.updateProductUpgradeTier(id, upgradeTier);
      if (!product) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${id}`,
          instance: req.path,
        });
        return;
      }
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /admin/api/products/:id/age-range
 *
 * Updates the age range (AC7.9).
 */
adminProductsRouter.patch(
  '/:id/age-range',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      const schema = z.object({
        minAge: z.number().int().min(0).max(18),
        maxAge: z.number().int().min(0).max(18),
      });
      const { minAge, maxAge } = schema.parse(req.body);

      const product = await productsRepo.updateProductAgeRange(id, minAge, maxAge);
      if (!product) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${id}`,
          instance: req.path,
        });
        return;
      }
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /admin/api/products/:id/details
 *
 * Updates name, category, and form factor (AC7.9).
 */
adminProductsRouter.patch(
  '/:id/details',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      const schema = z.object({
        name: z.string().min(1).max(100),
        category: z.string().min(1).max(30),
        formFactor: z.string().min(1).max(30),
      });
      const { name, category, formFactor } = schema.parse(req.body);

      const product = await productsRepo.updateProductDetails(id, name, category, formFactor);
      if (!product) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${id}`,
          instance: req.path,
        });
        return;
      }
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /admin/api/products/:id
 *
 * Returns 204 on success, 409 if referenced by a bundle item (AC7.10–AC7.11).
 */
adminProductsRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      const deleted = await productsRepo.deleteProduct(id);

      if (!deleted) {
        // deleteProduct returns false when the product is referenced by bundle items
        res.status(409).json({
          type: 'about:conflict',
          title: 'Conflict',
          status: 409,
          detail: `Product ${id} is referenced by one or more bundle items and cannot be deleted.`,
          instance: req.path,
        });
        return;
      }

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /admin/api/products/:id/affinities
 *
 * Returns all four affinity types for a product (AC8.1).
 */
adminProductsRouter.get(
  '/:id/affinities',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      // Verify product exists
      const product = await productsRepo.getProductById(id);
      if (!product) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${id}`,
          instance: req.path,
        });
        return;
      }

      const affinities = await affinitiesRepo.getAffinitiesForProduct(id);
      res.json(affinities);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /admin/api/products/:id/affinities
 *
 * Atomically replaces all four affinity types for a product (AC8.2).
 * The replace is done in a single transaction: delete-then-insert for all four tables.
 */
adminProductsRouter.put(
  '/:id/affinities',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id, res, next);
      if (id === null) return;

      // Verify product exists
      const product = await productsRepo.getProductById(id);
      if (!product) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Product not found: ${id}`,
          instance: req.path,
        });
        return;
      }

      const data = AffinityPayloadSchema.parse(req.body);
      await affinitiesRepo.replaceAffinities(id, data);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
