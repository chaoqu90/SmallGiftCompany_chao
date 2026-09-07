/**
 * Checkout routes.
 *
 * POST /api/checkout/intent — creates a Stripe PaymentIntent for the session's cart.
 *   - Requires X-Session-Id header
 *   - Body: { email, name?, shippingStreet, shippingCity, shippingState, shippingZip, shippingCountry? }
 *   - Returns: { clientSecret, totalCents }
 *
 * No DB order is created here. Order is created by the Stripe webhook
 * (POST /api/webhooks/stripe) after payment succeeds.
 *
 * Design: specs/payment/design.md §4.1
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { jwtVerify } from 'jose';
import { stripe } from '../lib/stripe.js';
import { getCartWithDetails, upsertCartItemExact, findBundleIdByPublicId } from '../repositories/cart.js';

export const checkoutRouter = Router();

const secretKey = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET ?? '');

// ─── Zod schema ───────────────────────────────────────────────────────────────

const CartItemInputSchema = z.object({
  bundlePublicId: z.string().min(1),
  upgradeTier:    z.enum(['STANDARD', 'PREMIUM']).default('STANDARD'),
  giftBagOptionId: z.number().int().positive().nullable().optional(),
  quantity:       z.number().int().min(1).default(1),
});

const IntentSchema = z.object({
  email:           z.string().email(),
  name:            z.string().optional(),
  shippingStreet:  z.string().min(1),
  shippingCity:    z.string().min(1),
  shippingState:   z.string().min(1),
  shippingZip:     z.string().min(1),
  shippingCountry: z.string().length(2).optional().default('US'),
  items:           z.array(CartItemInputSchema).min(1),
});

// ─── POST /api/checkout/intent ────────────────────────────────────────────────

checkoutRouter.post(
  '/intent',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Require X-Session-Id header
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
      const sid = sessionId.trim();

      // Validate body
      const parsed = IntentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
          instance: req.path,
        });
        return;
      }
      const { email, name, shippingStreet, shippingCity, shippingState, shippingZip, shippingCountry, items } = parsed.data;

      // Bundles are always saved to DB at generation time, so a simple lookup
      // by public_id is sufficient. No in-memory cache dependency here.
      for (const item of items) {
        const bundleDbId = await findBundleIdByPublicId(item.bundlePublicId);
        if (!bundleDbId) {
          res.status(422).json({
            type: 'about:validation-error',
            title: 'Bundle not found',
            status: 422,
            detail: `Bundle ${item.bundlePublicId} not found. Please generate a new bundle.`,
            instance: req.path,
          });
          return;
        }

        // Use exact-quantity upsert (not additive) — checkout retries must not
        // double-count quantity the way the cart API upsert does.
        await upsertCartItemExact(
          sid,
          bundleDbId,
          item.upgradeTier,
          item.giftBagOptionId ?? null,
          item.quantity,
        );
      }

      // Fetch cart items with price data (now persisted above)
      const cartItems = await getCartWithDetails(sid);
      if (cartItems.length === 0) {
        res.status(400).json({
          type: 'about:cart-empty',
          title: 'Bad Request',
          status: 400,
          detail: 'Cannot initiate payment for an empty cart.',
          instance: req.path,
        });
        return;
      }

      // Compute total (same logic as confirmOrder / createOrder in orders.ts)
      let totalCents = 0;
      for (const item of cartItems) {
        const base = Number(item.base_retail_price ?? 0);
        let upgradeAdj = 0;
        if (item.upgrade_tier === 'PREMIUM' && item.premium_retail_adj != null && item.standard_retail_adj != null) {
          upgradeAdj = Number(item.premium_retail_adj) - Number(item.standard_retail_adj);
        } else if (item.upgrade_tier === 'STANDARD' && item.standard_retail_adj != null) {
          upgradeAdj = Number(item.standard_retail_adj);
        }
        const giftBagAdj = item.gift_bag_price_adj ? Number(item.gift_bag_price_adj) : 0;
        const unitPrice = Math.round((base + upgradeAdj + giftBagAdj) * 100) / 100;
        const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
        totalCents += Math.round(lineTotal * 100);
      }

      // Optionally extract userId from JWT (stored in PI metadata for order attribution)
      let userId: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const { payload } = await jwtVerify(authHeader.slice(7), secretKey, { algorithms: ['HS256'] });
          userId = (payload.sub as string) ?? null;
        } catch {
          // Invalid JWT is acceptable — checkout proceeds anonymously
        }
      }

      // Create Stripe PaymentIntent
      // Metadata carries all the data needed by the webhook to create the DB order
      const pi = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          sessionId: sid,
          email,
          name:            name            ?? '',
          userId:          userId           ?? '',
          shippingStreet,
          shippingCity,
          shippingState,
          shippingZip,
          shippingCountry,
        },
      });

      res.json({ clientSecret: pi.client_secret, totalCents });
    } catch (err) {
      next(err);
    }
  },
);
