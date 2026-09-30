/**
 * Admin punch-box routes — HTTP Basic auth required (applied at router level).
 *
 * POST   /admin/api/punch-boxes                              — create
 * GET    /admin/api/punch-boxes                              — list all
 * GET    /admin/api/punch-boxes/:publicId                    — get detail
 * PATCH  /admin/api/punch-boxes/:publicId/items/:itemId      — edit item
 * POST   /admin/api/punch-boxes/:publicId/order              — mark ORDERED
 *
 * Requirements: R4, R5, R8, R9 (AC9.1, AC9.2)
 * Design: specs/punch-box/design.md §5
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { basicAuth } from '../../middleware/auth.js';
import {
  savePunchBox,
  listPunchBoxes,
  findPunchBoxByPublicId,
  patchPunchBoxItem,
  markPunchBoxOrdered,
  loadProductsByIds,
  type PunchBoxAggregate,
} from '../../repositories/punchBoxes.js';
import type { PunchBoxRow, PunchBoxItemRow } from '../../types/entities.js';
import { sql } from '../../db.js';

export const adminPunchBoxesRouter = Router();

// Apply Basic auth to all routes on this router (AC9.1, AC9.2)
adminPunchBoxesRouter.use(basicAuth);

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const CreatePunchBoxSchema = z.object({
  futurePartyId: z.number().int().positive().optional(),
  slotCount: z.union([z.literal(30), z.literal(50), z.literal(70)]),
  retailPrice: z.number().positive(),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1),
    displayOrder: z.number().int().min(0),
  })).min(1),
});

const PatchPunchBoxItemSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  productId: z.number().int().positive().optional(),
}).refine(
  data => data.quantity !== undefined || data.productId !== undefined,
  { message: 'At least one of quantity or productId must be provided' },
);

// ─── DTO mappers ──────────────────────────────────────────────────────────────

function toPunchBoxListDto(box: PunchBoxRow) {
  return {
    publicId:     box.public_id,
    slotCount:    box.slot_count,
    totalCogsUsd: parseFloat(box.total_cogs_usd),
    retailPrice:  parseFloat(box.retail_price),
    profitUsd:    parseFloat(box.profit_usd),
    status:       box.status,
    createdAt:    box.created_at,
    futurePartyId: box.future_party_id,
  };
}

function toPunchBoxItemDto(item: PunchBoxItemRow) {
  return {
    itemId:              item.id,
    productId:           item.product_id,
    productNameSnapshot: item.product_name_snapshot,
    skuSnapshot:         item.sku_snapshot,
    costSnapshotRmb:     parseFloat(item.cost_snapshot),
    quantity:            item.quantity,
    displayOrder:        item.display_order,
  };
}

function toPunchBoxDetailDto(agg: PunchBoxAggregate) {
  return {
    ...toPunchBoxListDto(agg.punchBox),
    items: agg.items.map(toPunchBoxItemDto),
  };
}

// ─── POST / — Create punch box ────────────────────────────────────────────────

/**
 * Creates a punch box with items. Server recomputes total_cogs_usd from
 * current product rows; trusts client-submitted retailPrice (AC8.4, AC8.5).
 * Requirements: R4 (AC4.3, AC4.4), R8 (AC8.5)
 */
adminPunchBoxesRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Validate
      const body = CreatePunchBoxSchema.parse(req.body);

      // 2. Load product rows for all submitted product IDs
      const productIds = body.items.map(i => i.productId);
      const productMap = await loadProductsByIds(productIds);

      // Verify all products exist and are active
      for (const item of body.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          res.status(400).json({
            type:     'about:validation-error',
            title:    'Bad Request',
            status:   400,
            detail:   `Product not found: ${item.productId}`,
            instance: req.path,
          });
          return;
        }
        if (!product.active) {
          res.status(400).json({
            type:     'about:validation-error',
            title:    'Bad Request',
            status:   400,
            detail:   `Product is not active: ${item.productId}`,
            instance: req.path,
          });
          return;
        }
      }

      // 3. Verify futurePartyId exists if provided
      if (body.futurePartyId !== undefined) {
        const fpRows = await sql`
          SELECT id FROM future_parties WHERE id = ${body.futurePartyId}
        `;
        if (fpRows.length === 0) {
          res.status(400).json({
            type:     'about:validation-error',
            title:    'Bad Request',
            status:   400,
            detail:   `Future party not found: ${body.futurePartyId}`,
            instance: req.path,
          });
          return;
        }
      }

      // 4. Compute total_cogs_usd server-side (AC8.5)
      let totalCogsUsd = 0;
      for (const item of body.items) {
        const product = productMap.get(item.productId)!;
        totalCogsUsd += (parseFloat(product.cost) / 6.5) * item.quantity;
      }
      totalCogsUsd = Math.round(totalCogsUsd * 100) / 100;

      const profitUsd = Math.round((body.retailPrice - totalCogsUsd) * 100) / 100;

      // 5. Build item snapshots
      const itemSnapshots = body.items.map(item => {
        const product = productMap.get(item.productId)!;
        return {
          productId:           item.productId,
          productNameSnapshot: product.name,
          skuSnapshot:         product.sku,
          costSnapshot:        parseFloat(product.cost),
          quantity:            item.quantity,
          displayOrder:        item.displayOrder,
        };
      });

      // 6. Save atomically
      const box = await savePunchBox({
        futurePartyId: body.futurePartyId ?? null,
        slotCount:     body.slotCount,
        retailPrice:   body.retailPrice,
        totalCogsUsd,
        profitUsd,
        items:         itemSnapshots,
      });

      // 7. Fetch full aggregate to return
      const agg = await findPunchBoxByPublicId(box.public_id);
      res.status(201).json(toPunchBoxDetailDto(agg!));
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET / — List punch boxes ─────────────────────────────────────────────────

/**
 * Returns up to 200 punch boxes, newest first.
 * Design: specs/punch-box/design.md §5.5
 */
adminPunchBoxesRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const boxes = await listPunchBoxes();
      res.json(boxes.map(toPunchBoxListDto));
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /:publicId — Get punch box detail ────────────────────────────────────

/**
 * Returns full punch box aggregate with items.
 * 404 if not found.
 * Design: specs/punch-box/design.md §5.6
 */
adminPunchBoxesRouter.get(
  '/:publicId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { publicId } = req.params;
      const agg = await findPunchBoxByPublicId(publicId);
      if (!agg) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Punch box not found: ${publicId}`,
          instance: req.path,
        });
        return;
      }
      res.json(toPunchBoxDetailDto(agg));
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /:publicId/items/:itemId — Edit item ───────────────────────────────

/**
 * Updates quantity and/or swaps the product on a single punch box item.
 * Only permitted when punch box status is ASSIGNED.
 * Design: specs/punch-box/design.md §5.7
 */
adminPunchBoxesRouter.patch(
  '/:publicId/items/:itemId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { publicId } = req.params;
      const itemId = parseInt(req.params.itemId, 10);

      if (isNaN(itemId)) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Bad Request',
          status:   400,
          detail:   'itemId must be an integer.',
          instance: req.path,
        });
        return;
      }

      // 1. Fetch punch box
      const agg = await findPunchBoxByPublicId(publicId);
      if (!agg) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Punch box not found: ${publicId}`,
          instance: req.path,
        });
        return;
      }

      // 2. Check status
      if (agg.punchBox.status === 'ORDERED') {
        res.status(409).json({
          type:     'about:conflict',
          title:    'Conflict',
          status:   409,
          detail:   'Cannot edit an ordered punch box.',
          instance: req.path,
        });
        return;
      }

      // 3. Verify item belongs to this punch box
      const item = agg.items.find(i => i.id === itemId);
      if (!item) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Item not found: ${itemId}`,
          instance: req.path,
        });
        return;
      }

      // 4. Validate body
      const patch = PatchPunchBoxItemSchema.parse(req.body);

      // 5. If swapping product, load new product row
      let productPatch: { productId?: number; productNameSnapshot?: string; skuSnapshot?: string; costSnapshot?: number } = {};
      if (patch.productId !== undefined) {
        const productMap = await loadProductsByIds([patch.productId]);
        const product = productMap.get(patch.productId);
        if (!product) {
          res.status(400).json({
            type:     'about:validation-error',
            title:    'Bad Request',
            status:   400,
            detail:   `Product not found: ${patch.productId}`,
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
        productPatch = {
          productId:           product.id,
          productNameSnapshot: product.name,
          skuSnapshot:         product.sku,
          costSnapshot:        parseFloat(product.cost),
        };
      }

      // 6. Apply patch
      const updated = await patchPunchBoxItem(agg.punchBox.id, itemId, {
        quantity: patch.quantity,
        ...productPatch,
      });

      res.json(toPunchBoxDetailDto(updated));
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /:publicId/order — Mark as ORDERED ──────────────────────────────────

/**
 * Atomically deducts inventory for each item and sets status = ORDERED.
 * 404 if not found; 409 if already ORDERED.
 * Design: specs/punch-box/design.md §5.8
 */
adminPunchBoxesRouter.post(
  '/:publicId/order',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { publicId } = req.params;

      const agg = await findPunchBoxByPublicId(publicId);
      if (!agg) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Punch box not found: ${publicId}`,
          instance: req.path,
        });
        return;
      }

      if (agg.punchBox.status === 'ORDERED') {
        res.status(409).json({
          type:     'about:conflict',
          title:    'Conflict',
          status:   409,
          detail:   'Punch box is already ordered.',
          instance: req.path,
        });
        return;
      }

      await markPunchBoxOrdered(agg.punchBox.id, agg.items);

      res.json({ publicId, status: 'ORDERED' });
    } catch (err) {
      next(err);
    }
  },
);
