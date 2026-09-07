/**
 * Cart routes — session-based, no JWT auth required.
 *
 * All routes require the X-Session-Id header (UUID generated client-side,
 * stored in localStorage). Returns 400 ProblemDetail if header is missing.
 *
 * GET    /api/cart             — fetch cart with details, computed prices
 * POST   /api/cart/items       — add or upsert bundle into cart
 * PATCH  /api/cart/items/:id   — update upgrade tier, gift bag, or quantity
 * DELETE /api/cart/items/:id   — remove a single item
 * DELETE /api/cart             — clear entire cart
 *
 * Requirements: R3 (AC3.1–AC3.12), R4 (AC4.1–AC4.7), R9 (AC9.2–AC9.6)
 * Design: specs/cart-and-order/design.md §5
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  getCartWithDetails,
  addOrUpdateCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  findBundleIdByPublicId,
  type CartItemDetail,
} from '../../repositories/cart.js';
import { saveBundle } from '../../repositories/generatedBundles.js';
import { getBundle, evictBundle } from '../../lib/bundleCache.js';

export const userCartRouter = Router();

// ─── Session ID extractor middleware ──────────────────────────────────────────

/**
 * Reads the X-Session-Id header and attaches it to the request.
 * Returns 400 ProblemDetail if the header is missing or empty.
 */
function requireSessionId(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    res.status(400).json({
      type: 'about:bad-request',
      title: 'Bad Request',
      status: 400,
      detail: 'X-Session-Id header is required',
      instance: req.path,
    });
    return;
  }
  (req as Request & { sessionId: string }).sessionId = sessionId.trim();
  next();
}

userCartRouter.use(requireSessionId);

// ─── DTO helpers ──────────────────────────────────────────────────────────────

/**
 * Computes the server-side unit price for a cart item.
 * base_retail_price + upgrade_adjustment + gift_bag_adjustment
 *
 * postgres.js returns NUMERIC as strings — always Number() cast before arithmetic.
 */
function computeUnitPrice(item: CartItemDetail): number {
  const base = Number(item.base_retail_price ?? 0);

  // Upgrade adjustment: if PREMIUM, add (premium_adj - standard_adj)
  let upgradeAdj = 0;
  if (item.upgrade_tier === 'PREMIUM' && item.premium_retail_adj != null && item.standard_retail_adj != null) {
    upgradeAdj = Number(item.premium_retail_adj) - Number(item.standard_retail_adj);
  } else if (item.upgrade_tier === 'STANDARD' && item.standard_retail_adj != null) {
    upgradeAdj = Number(item.standard_retail_adj);
  }

  const giftBagAdj = item.gift_bag_option_id != null && item.gift_bag_price_adj != null
    ? Number(item.gift_bag_price_adj)
    : 0;

  return Math.round((base + upgradeAdj + giftBagAdj) * 100) / 100;
}

function toCartItemDto(item: CartItemDetail) {
  const unitPrice = computeUnitPrice(item);
  return {
    id: item.id,
    generatedBundleId: item.bundle_public_id,
    interest: item.interest,
    requestedAge: item.requested_age,
    partyType: item.party_type,
    upgradeTier: item.upgrade_tier,
    giftBagOptionId: item.gift_bag_option_id,
    giftBagName: item.gift_bag_name,
    quantity: item.quantity,
    unitPrice,
    lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function buildCartDto(items: CartItemDetail[]) {
  const itemDtos = items.map(toCartItemDto);
  const subtotal = Math.round(itemDtos.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  return {
    items: itemDtos,
    subtotal,
    total: subtotal,  // equal to subtotal in this phase — no tax/shipping
    itemCount: itemDtos.reduce((s, i) => s + i.quantity, 0),
  };
}

// ─── GET /api/cart ─────────────────────────────────────────────────────────────

userCartRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = (req as Request & { sessionId: string }).sessionId;
      const items = await getCartWithDetails(sessionId);
      res.json(buildCartDto(items));
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/cart/items ──────────────────────────────────────────────────────

const AddToCartSchema = z.object({
  bundlePublicId: z.string().min(1),
  upgradeTier: z.enum(['STANDARD', 'PREMIUM']).default('STANDARD'),
  giftBagOptionId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
});

userCartRouter.post(
  '/items',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = AddToCartSchema.parse(req.body);
      const sessionId = (req as Request & { sessionId: string }).sessionId;

      // Resolve bundlePublicId to internal DB id.
      // Try in-memory cache first (bundle generated in this Lambda instance but not yet
      // persisted). On cache miss, fall back to DB (already persisted or Lambda restart).
      let bundleId: number | null;
      const cached = getBundle(data.bundlePublicId);
      if (cached) {
        const savedRow = await saveBundle(cached.snapshot);
        evictBundle(data.bundlePublicId);
        bundleId = savedRow.id;
      } else {
        bundleId = await findBundleIdByPublicId(data.bundlePublicId);
      }

      if (bundleId === null) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Bundle not found: ${data.bundlePublicId}`,
          instance: req.path,
        });
        return;
      }

      const cartItem = await addOrUpdateCartItem(
        sessionId,
        bundleId,
        data.upgradeTier,
        data.giftBagOptionId ?? null,
        data.quantity,
      );

      // Re-fetch full cart details to return the enriched DTO
      const items = await getCartWithDetails(sessionId);
      const itemDetail = items.find(i => i.id === cartItem.id);

      if (!itemDetail) {
        // Should not happen, but guard
        res.status(201).json(cartItem);
        return;
      }

      // Return 201 for new items; 200 for upserted items
      // The upsert doesn't distinguish, so we use 201 as the spec says (AC4.1)
      res.status(201).json(toCartItemDto(itemDetail));
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /api/cart/items/:id ─────────────────────────────────────────────────

const UpdateCartItemSchema = z.object({
  upgradeTier: z.enum(['STANDARD', 'PREMIUM']).optional(),
  giftBagOptionId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1).optional(),
});

userCartRouter.patch(
  '/items/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: `Invalid cart item id: ${req.params.id}`,
          instance: req.path,
        });
        return;
      }

      const data = UpdateCartItemSchema.parse(req.body);
      const sessionId = (req as Request & { sessionId: string }).sessionId;

      const updated = await updateCartItem(id, sessionId, {
        upgradeTier: data.upgradeTier,
        giftBagOptionId: data.giftBagOptionId,
        quantity: data.quantity,
      });

      if (!updated) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Cart item not found: ${id}`,
          instance: req.path,
        });
        return;
      }

      // Re-fetch to return enriched DTO
      const items = await getCartWithDetails(sessionId);
      const itemDetail = items.find(i => i.id === id);

      if (!itemDetail) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Cart item not found: ${id}`,
          instance: req.path,
        });
        return;
      }

      res.json(toCartItemDto(itemDetail));
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /api/cart/items/:id ────────────────────────────────────────────────

userCartRouter.delete(
  '/items/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: `Invalid cart item id: ${req.params.id}`,
          instance: req.path,
        });
        return;
      }

      const sessionId = (req as Request & { sessionId: string }).sessionId;
      const deleted = await removeCartItem(id, sessionId);

      if (!deleted) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Cart item not found: ${id}`,
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

// ─── DELETE /api/cart ──────────────────────────────────────────────────────────

userCartRouter.delete(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = (req as Request & { sessionId: string }).sessionId;
      await clearCart(sessionId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
