/**
 * Public gift bag options route — no auth required.
 *
 * GET /api/gift-bag-options — returns all active gift bag options
 *
 * Used by the cart page to populate the gift bag selector dropdown (AC3.4).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { listGiftBagOptions } from '../repositories/giftBagOptions.js';

export const giftBagOptionsRouter = Router();

giftBagOptionsRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const options = await listGiftBagOptions();
      res.json(
        options.map(opt => ({
          id: opt.id,
          code: opt.code,
          name: opt.name,
          description: opt.description,
          retailPriceAdjustment: Number(opt.retail_price_adjustment),
          isDefault: opt.is_default,
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);
