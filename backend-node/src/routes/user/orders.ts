/**
 * User order routes.
 *
 * GET  /api/orders/search    — search by order number + email (no auth)
 * POST /api/orders          — create order from session cart (no auth required)
 * GET  /api/orders          — list user's orders (JWT required)
 * GET  /api/orders/:publicId — get order detail (no auth required)
 *
 * Requirements: AC5.6–AC5.9, AC6.1–AC6.10
 * Design: specs/cart-and-order/design.md §5; specs/payment/design.md §5
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { jwtVerify } from 'jose';
import { jwtAuth } from '../../middleware/jwtAuth.js';
import {
  createOrder,
  listUserOrders,
  findOrderByPublicId,
  searchOrder,
  type OrderWithLineItems,
} from '../../repositories/orders.js';

export const userOrdersRouter = Router();

// ─── JWT secret (same key as jwtAuth middleware) ──────────────────────────────

const secretKey = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET ?? '');

// ─── DTO mappers ──────────────────────────────────────────────────────────────

function toOrderDto(order: OrderWithLineItems) {
  return {
    publicId: order.public_id,
    status: order.status,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    currency: order.currency,
    customerEmail: order.customer_email,
    customerName: order.customer_name,
    itemCount: order.itemCount,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    lineItems: order.lineItems.map(li => ({
      id: li.id,
      bundlePublicId: li.bundle_public_id,
      interest: li.interest,
      requestedAge: li.requested_age,
      partyType: li.party_type,
      upgradeTier: li.upgrade_tier,
      giftBagName: li.gift_bag_name_snapshot,
      quantity: li.quantity,
      unitPrice: Number(li.unit_price),
      lineTotal: Number(li.line_total),
    })),
  };
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// No JWT required. Reads X-Session-Id header (required, 400 if missing).
// Optionally reads Authorization: Bearer header — if valid, stores userId on order.

const CreateOrderSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

userOrdersRouter.post(
  '/',
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

      // Validate body
      const parsed = CreateOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: parsed.error.issues.map(i => i.message).join('; '),
          instance: req.path,
        });
        return;
      }
      const { email, name } = parsed.data;

      // Optionally extract userId from JWT (fail silently if absent or invalid)
      let userId: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
          userId = (payload.sub as string) ?? null;
        } catch {
          // Invalid or missing JWT is acceptable — order is anonymous
        }
      }

      const order = await createOrder(sessionId.trim(), email, name ?? null, userId);
      res.status(201).json(toOrderDto(order));
    } catch (err) {
      if (err instanceof Error && err.message === 'CART_EMPTY') {
        res.status(400).json({
          type: 'about:cart-empty',
          title: 'Bad Request',
          status: 400,
          detail: 'Cannot create an order from an empty cart.',
          instance: req.path,
        });
        return;
      }
      next(err);
    }
  },
);

// ─── GET /api/orders ──────────────────────────────────────────────────────────
// JWT required — list is login-only (returns orders for the authenticated user).

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

userOrdersRouter.get(
  '/',
  jwtAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = PaginationSchema.parse(req.query);
      const userId = req.user!.id;

      const result = await listUserOrders(userId, page, limit);

      res.json({
        orders: result.orders.map(o => ({
          publicId: o.public_id,
          status: o.status,
          total: Number(o.total),
          currency: o.currency,
          itemCount: Number(o.item_count),
          createdAt: o.created_at,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/orders/search ───────────────────────────────────────────────────
// Public endpoint — no auth required.
// Both orderNumber and email are required query params.
// Design: specs/payment/design.md §5

const SearchQuerySchema = z.object({
  orderNumber: z.string().min(1),
  email:       z.string().email(),
});

userOrdersRouter.get(
  '/search',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = SearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          type: 'about:validation-error',
          title: 'Bad Request',
          status: 400,
          detail: 'Both orderNumber and email query parameters are required.',
          instance: req.path,
        });
        return;
      }
      const { orderNumber, email } = parsed.data;
      const order = await searchOrder(orderNumber, email);
      if (!order) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: 'No order found matching that order number and email.',
          instance: req.path,
        });
        return;
      }
      res.json(toOrderDto(order));
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/orders/:publicId ────────────────────────────────────────────────
// No auth required — publicId is the access key (12-char hex, unguessable).

userOrdersRouter.get(
  '/:publicId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await findOrderByPublicId(req.params.publicId);

      if (!order) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Order not found: ${req.params.publicId}`,
          instance: req.path,
        });
        return;
      }

      res.json(toOrderDto(order));
    } catch (err) {
      next(err);
    }
  },
);
