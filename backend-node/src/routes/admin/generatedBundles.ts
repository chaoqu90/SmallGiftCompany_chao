/**
 * Admin generated-bundles routes — HTTP Basic auth required (applied at router level).
 *
 * GET   /admin/api/generated-bundles/:bundlePublicId/items/:slotCode/alternatives
 *   — list eligible alternative products for a slot swap
 *
 * PATCH /admin/api/generated-bundles/:bundlePublicId/items/:slotCode
 *   — swap the product in a bundle slot and return the updated bundle
 *
 * Requirements: AC-FP-C.3, AC-FP-C.5, AC-FP-C.6, AC-FP-C.8, AC-FP-C.9, AC7.2, AC7.3
 * Design: specs/future-party/design.md §3.8
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { basicAuth } from '../../middleware/auth.js';
import { PatchBundleItemRequestSchema } from '../../types/dtos.js';
import * as generatedBundleService from '../../services/generatedBundle.js';
import * as generatedBundlesRepo from '../../repositories/generatedBundles.js';
import { patchBundleUpgrade, patchBundleGiftBag } from '../../repositories/generatedBundles.js';
import * as productsRepo from '../../repositories/products.js';
import * as giftBagOptionsRepo from '../../repositories/giftBagOptions.js';
import { sql } from '../../db.js';

export const adminGeneratedBundlesRouter = Router();

// Apply Basic auth to all routes on this router (AC7.3)
adminGeneratedBundlesRouter.use(basicAuth);

// ─── GET /:bundlePublicId/items/:slotCode/alternatives ────────────────────────

/**
 * Returns all products eligible to replace the current product in a given slot.
 * Eligibility: same form factor, active, inventory > 0, not already in the bundle.
 * Age/audience/occasion filters are intentionally omitted (admin override — AC-FP-C.3).
 */
adminGeneratedBundlesRouter.get(
  '/:bundlePublicId/items/:slotCode/alternatives',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bundlePublicId, slotCode } = req.params;

      // 1. Fetch bundle via service (returns DTO); 404 if not found
      const bundle = await generatedBundleService.getByPublicId(bundlePublicId);
      if (!bundle) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Bundle not found: ${bundlePublicId}`,
          instance: req.path,
        });
        return;
      }

      // 2. Find the slot within the bundle; 404 if slot does not exist
      const item = bundle.items.find(i => i.slotCode === slotCode);
      if (!item) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Slot not found in bundle: ${slotCode}`,
          instance: req.path,
        });
        return;
      }

      // 3. Get DB aggregate to obtain currently-selected product IDs for exclusion
      const agg = await generatedBundlesRepo.findBundleByPublicId(bundlePublicId);
      const excludeProductIds: number[] = agg ? agg.items.map(i => i.product_id) : [];

      // 4. Query eligible alternatives
      const alternatives = await productsRepo.findEligibleAlternativesForSlot(
        item.formFactor,
        excludeProductIds,
      );

      // 5. Map to AlternativeProductDto and return 200
      res.json(alternatives.map(p => ({
        id:                p.id,
        name:              p.name,
        sku:               p.sku,
        formFactor:        p.form_factor,
        retailPrice:       p.retail_price,
        cost:              p.cost,
        imageUrl:          p.image_url,
        inventoryQuantity: p.inventory_quantity,
      })));
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /:bundlePublicId/items/:slotCode ───────────────────────────────────

/**
 * Replaces the product in a bundle slot.
 * Validates form factor compatibility, active status, and inventory before updating.
 * Returns the full updated bundle (same shape as GET /api/generated-bundles/:publicId).
 * Requirements: AC-FP-C.5, AC-FP-C.6
 */
adminGeneratedBundlesRouter.patch(
  '/:bundlePublicId/items/:slotCode',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bundlePublicId, slotCode } = req.params;

      // 1. Parse and validate request body
      const { productId } = PatchBundleItemRequestSchema.parse(req.body);

      // 2. Fetch bundle; 404 if not found
      const bundle = await generatedBundleService.getByPublicId(bundlePublicId);
      if (!bundle) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Bundle not found: ${bundlePublicId}`,
          instance: req.path,
        });
        return;
      }

      // 3. Find slot within bundle; 404 if slot does not exist
      const item = bundle.items.find(i => i.slotCode === slotCode);
      if (!item) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Slot not found in bundle: ${slotCode}`,
          instance: req.path,
        });
        return;
      }

      // 4. Fetch product; 400 if not found, inactive, or out of stock
      const product = await productsRepo.getProductById(productId);
      if (!product) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Bad Request',
          status:   400,
          detail:   `Product not found: ${productId}`,
          instance: req.path,
        });
        return;
      }
      if (!product.active) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Bad Request',
          status:   400,
          detail:   'Product is not active.',
          instance: req.path,
        });
        return;
      }
      if (product.inventory_quantity < 1) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Bad Request',
          status:   400,
          detail:   'Product has no available inventory.',
          instance: req.path,
        });
        return;
      }

      // 5. Validate form factor compatibility
      if (product.form_factor !== item.formFactor) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Bad Request',
          status:   400,
          detail:   'Product form factor does not match slot.',
          instance: req.path,
        });
        return;
      }

      // 6. Persist the swap
      await generatedBundlesRepo.patchBundleItem(bundlePublicId, slotCode, product);

      // 7. Re-fetch and return the full updated bundle (AC-FP-C.6)
      const updated = await generatedBundleService.getByPublicId(bundlePublicId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /:bundlePublicId/upgrade/alternatives ────────────────────────────────

/**
 * Returns eligible alternative products for the standard or upgraded upgrade slot.
 * Query param: ?tier=standard|upgraded
 */
adminGeneratedBundlesRouter.get(
  '/:bundlePublicId/upgrade/alternatives',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bundlePublicId } = req.params;
      const tier = req.query.tier as string;

      if (tier !== 'standard' && tier !== 'upgraded') {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: "Query param 'tier' must be 'standard' or 'upgraded'.",
          instance: req.path,
        });
        return;
      }

      const bundle = await generatedBundleService.getByPublicId(bundlePublicId);
      if (!bundle) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Bundle not found: ${bundlePublicId}`,
          instance: req.path,
        });
        return;
      }

      if (!bundle.upgrade) {
        res.json([]);
        return;
      }

      const sku = tier === 'standard' ? bundle.upgrade.standardSku : bundle.upgrade.upgradedSku;
      if (!sku) {
        res.json([]);
        return;
      }

      // Look up the form_factor of the upgrade product by SKU
      const productRows = await sql<{ form_factor: string }[]>`
        SELECT form_factor FROM product WHERE sku = ${sku} LIMIT 1
      `;
      if (productRows.length === 0) {
        res.json([]);
        return;
      }
      const formFactor = productRows[0].form_factor;

      // Exclude only the item product IDs (not the other upgrade product)
      const agg = await generatedBundlesRepo.findBundleByPublicId(bundlePublicId);
      const excludeProductIds: number[] = agg ? agg.items.map(i => i.product_id) : [];

      const alternatives = await productsRepo.findEligibleAlternativesForSlot(formFactor, excludeProductIds);

      res.json(alternatives.map(p => ({
        id:                p.id,
        name:              p.name,
        sku:               p.sku,
        formFactor:        p.form_factor,
        retailPrice:       p.retail_price,
        cost:              p.cost,
        imageUrl:          p.image_url,
        inventoryQuantity: p.inventory_quantity,
      })));
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /:bundlePublicId/upgrade ───────────────────────────────────────────

/**
 * Replaces the standard or upgraded product in the bundle's upgrade row.
 * Body: { tier: 'standard'|'upgraded', productId: number }
 */
adminGeneratedBundlesRouter.patch(
  '/:bundlePublicId/upgrade',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bundlePublicId } = req.params;
      const { tier, productId } = req.body as { tier: unknown; productId: unknown };

      if (tier !== 'standard' && tier !== 'upgraded') {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: "Body field 'tier' must be 'standard' or 'upgraded'.",
          instance: req.path,
        });
        return;
      }
      if (typeof productId !== 'number') {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: "Body field 'productId' must be a number.",
          instance: req.path,
        });
        return;
      }

      const bundle = await generatedBundleService.getByPublicId(bundlePublicId);
      if (!bundle) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Bundle not found: ${bundlePublicId}`,
          instance: req.path,
        });
        return;
      }
      if (!bundle.upgrade) {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: 'Bundle has no upgrade.',
          instance: req.path,
        });
        return;
      }

      const product = await productsRepo.getProductById(productId);
      if (!product) {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: `Product not found: ${productId}`,
          instance: req.path,
        });
        return;
      }
      if (!product.active) {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: 'Product is not active.',
          instance: req.path,
        });
        return;
      }
      if (product.inventory_quantity < 1) {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: 'Product has no available inventory.',
          instance: req.path,
        });
        return;
      }

      await patchBundleUpgrade(bundlePublicId, tier, product);

      const updated = await generatedBundleService.getByPublicId(bundlePublicId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /:bundlePublicId/giftbag/alternatives ────────────────────────────────

/**
 * Returns all active gift bag options except the one currently set on the bundle.
 */
adminGeneratedBundlesRouter.get(
  '/:bundlePublicId/giftbag/alternatives',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bundlePublicId } = req.params;

      const bundle = await generatedBundleService.getByPublicId(bundlePublicId);
      if (!bundle) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Bundle not found: ${bundlePublicId}`,
          instance: req.path,
        });
        return;
      }

      if (!bundle.giftBag) {
        res.json([]);
        return;
      }

      // Get current gift_bag_option_id from the DB aggregate
      const agg = await generatedBundlesRepo.findBundleByPublicId(bundlePublicId);
      const currentGiftBagOptionId = agg?.giftBag?.gift_bag_option_id ?? null;

      const allOptions = await giftBagOptionsRepo.listGiftBagOptions();
      const alternatives = currentGiftBagOptionId !== null
        ? allOptions.filter(o => o.id !== currentGiftBagOptionId)
        : allOptions;

      res.json(alternatives.map(o => ({
        id:                    o.id,
        name:                  o.name,
        cost:                  o.cost,
        retailPriceAdjustment: o.retail_price_adjustment,
      })));
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /:bundlePublicId/giftbag ───────────────────────────────────────────

/**
 * Replaces the gift bag option in a bundle.
 * Body: { giftBagOptionId: number }
 */
adminGeneratedBundlesRouter.patch(
  '/:bundlePublicId/giftbag',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bundlePublicId } = req.params;
      const { giftBagOptionId } = req.body as { giftBagOptionId: unknown };

      if (typeof giftBagOptionId !== 'number') {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: "Body field 'giftBagOptionId' must be a number.",
          instance: req.path,
        });
        return;
      }

      const bundle = await generatedBundleService.getByPublicId(bundlePublicId);
      if (!bundle) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Bundle not found: ${bundlePublicId}`,
          instance: req.path,
        });
        return;
      }
      if (!bundle.giftBag) {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: 'Bundle has no gift bag.',
          instance: req.path,
        });
        return;
      }

      const allOptions = await giftBagOptionsRepo.listGiftBagOptions();
      const giftBagOption = allOptions.find(o => o.id === giftBagOptionId);
      if (!giftBagOption || !giftBagOption.active) {
        res.status(400).json({
          type:   'about:validation-error',
          title:  'Bad Request',
          status: 400,
          detail: `Gift bag option not found or not active: ${giftBagOptionId}`,
          instance: req.path,
        });
        return;
      }

      await patchBundleGiftBag(bundlePublicId, giftBagOption);

      const updated = await generatedBundleService.getByPublicId(bundlePublicId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);
