/**
 * Admin order routes — Basic auth required.
 *
 * GET   /admin/api/orders                    — list all orders (filterable by status)
 * GET   /admin/api/orders/:publicId          — get order detail
 * PATCH /admin/api/orders/:publicId/status   — update order status
 *
 * Status validation enforces the lifecycle from design.md §3 (AC8.9, AC9.9).
 *
 * Requirements: AC8.1–AC8.10, AC9.9
 * Design: specs/cart-and-order/design.md §3, §5
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { basicAuth } from '../../middleware/auth.js';
import {
  listAllOrders,
  findOrderByPublicId,
  updateOrderStatus,
  type OrderWithLineItems,
} from '../../repositories/orders.js';

export const adminOrdersRouter = Router();

// Apply Basic auth to all routes
adminOrdersRouter.use(basicAuth);

// ─── Valid status values and lifecycle transitions ─────────────────────────────

const ALL_STATUSES = ['PENDING', 'CONFIRMED', 'FULFILLED', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const;
type OrderStatus = typeof ALL_STATUSES[number];

/** Valid forward transitions per design.md §3 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['FULFILLED', 'CANCELLED', 'REFUNDED'],
  FULFILLED:  ['COMPLETED', 'CANCELLED', 'REFUNDED'],
  COMPLETED:  [],
  CANCELLED:  [],
  REFUNDED:   [],
};

// ─── DTO mapper ───────────────────────────────────────────────────────────────

function toAdminOrderDto(order: OrderWithLineItems) {
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
    shippingStreet: order.shipping_street,
    shippingCity: order.shipping_city,
    shippingState: order.shipping_state,
    shippingZip: order.shipping_zip,
    shippingCountry: order.shipping_country,
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
      bundleItems: li.bundleItems.map(bi => ({
        slotCode: bi.slot_code,
        productName: bi.product_name_snapshot,
        sku: bi.sku_snapshot,
        formFactor: bi.form_factor_snapshot,
        quantityPerBag: bi.quantity_per_bag,
        displayOrder: bi.display_order,
        description: bi.description_snapshot,
      })),
    })),
  };
}

// ─── GET /admin/api/orders ────────────────────────────────────────────────────

const AdminListSchema = z.object({
  status: z.enum(ALL_STATUSES).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});

adminOrdersRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, page, limit } = AdminListSchema.parse(req.query);
      const result = await listAllOrders({ status, page, limit });

      res.json({
        orders: result.orders.map(o => ({
          publicId: o.public_id,
          customerEmail: o.customer_email,
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

// ─── GET /admin/api/orders/:publicId ──────────────────────────────────────────

adminOrdersRouter.get(
  '/:publicId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // No userId check for admin — they see all orders
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

      res.json(toAdminOrderDto(order));
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /admin/api/orders/:publicId/status ─────────────────────────────────

const UpdateStatusSchema = z.object({
  status: z.enum(ALL_STATUSES),
});

adminOrdersRouter.patch(
  '/:publicId/status',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status: newStatus } = UpdateStatusSchema.parse(req.body);

      // Fetch current order to validate transition
      const current = await findOrderByPublicId(req.params.publicId);
      if (!current) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Order not found: ${req.params.publicId}`,
          instance: req.path,
        });
        return;
      }

      const currentStatus = current.status as OrderStatus;
      const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

      if (!allowed.includes(newStatus as OrderStatus)) {
        res.status(422).json({
          type: 'about:validation-error',
          title: 'Unprocessable Entity',
          status: 422,
          detail: `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: [${allowed.join(', ')}]`,
          instance: req.path,
        });
        return;
      }

      const updated = await updateOrderStatus(req.params.publicId, newStatus);
      if (!updated) {
        res.status(404).json({
          type: 'about:not-found',
          title: 'Not Found',
          status: 404,
          detail: `Order not found: ${req.params.publicId}`,
          instance: req.path,
        });
        return;
      }

      res.json({
        publicId: updated.public_id,
        status: updated.status,
        updatedAt: updated.updated_at,
      });
    } catch (err) {
      next(err);
    }
  },
);
