/**
 * Admin bundle routes — all protected by basicAuth.
 *
 * GET /admin/api/bundles/          — list recent bundles, newest first (AC9.1)
 * GET /admin/api/bundles/:publicId — full bundle aggregate with associations (AC9.2–AC9.3)
 *
 * The list endpoint returns up to 200 entries (design.md §2.11).
 * The detail endpoint extends GeneratedBundleResponse with associated future parties
 * and orders so the admin can see where a bundle has been used.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { basicAuth } from '../../middleware/auth.js';
import * as generatedBundleService from '../../services/generatedBundle.js';
import * as generatedBundlesRepo from '../../repositories/generatedBundles.js';
import { sql } from '../../db.js';

export const adminBundlesRouter = Router();

adminBundlesRouter.use(basicAuth);

interface AssociatedFutureParty {
  id: number;
  email: string;
  partyDate: string;
  kidGender: string;
  kidAge: number;
  submittedAt: string;
}

interface AssociatedOrder {
  publicId: string;
  customerEmail: string;
  status: string;
  total: string;
  createdAt: string;
}

/**
 * GET /admin/api/bundles
 *
 * Returns the 200 most recently generated bundles, newest first (AC9.1).
 * Each entry includes templateCode and budgetTierCode (joined from DB).
 */
adminBundlesRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bundles = await generatedBundlesRepo.listRecentBundles(200);
      res.json(bundles.map(b => ({
        id:                 b.id,
        publicId:           b.public_id,
        requestedAge:       b.requested_age,
        audiencePreference: b.audience_preference,
        interest:           b.interest,
        partyType:          b.party_type,
        templateCode:       b.template_code,
        baseRetailPrice:    b.base_retail_price != null ? parseFloat(b.base_retail_price) : null,
        status:             b.status,
        createdAt:          b.created_at,
      })));
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /admin/api/bundles/generated
 *
 * Deletes all bundles in GENERATED status (idle — not linked to any future party
 * or order). Child rows (items, upgrade, gift_bag, cart_item) cascade automatically.
 * Returns the count of deleted bundles.
 */
adminBundlesRouter.delete(
  '/generated',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rows = await sql<{ id: number }[]>`
        DELETE FROM generated_bundle
        WHERE status = 'GENERATED'
        RETURNING id
      `;
      res.json({ deleted: rows.length });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /admin/api/bundles/:publicId
 *
 * Returns the full bundle aggregate for the given public_id (AC9.2), plus:
 * - futureParties: future_parties rows linked to this bundle
 * - orders: customer_order rows that contain this bundle as a line item
 *
 * Returns 404 ProblemDetail if not found (AC9.3).
 */
adminBundlesRouter.get(
  '/:publicId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { publicId } = req.params;

      const bundle = await generatedBundleService.getByPublicId(publicId);

      if (!bundle) {
        res.status(404).json({
          type: 'about:bundle-not-found',
          title: 'Bundle Not Found',
          status: 404,
          detail: `No bundle found with id: ${publicId}`,
          instance: req.path,
        });
        return;
      }

      // Fetch associated future parties (linked via linked_bundle_public_id)
      const futurePartyRows = await sql<{
        id: number;
        email: string;
        party_date: string;
        kid_gender: string;
        kid_age: number;
        submitted_at: string;
      }[]>`
        SELECT id, email, party_date, kid_gender, kid_age, submitted_at
        FROM future_parties
        WHERE linked_bundle_public_id = ${publicId}
        ORDER BY submitted_at DESC
      `;

      const futureParties: AssociatedFutureParty[] = futurePartyRows.map(r => ({
        id: r.id,
        email: r.email,
        partyDate: r.party_date,
        kidGender: r.kid_gender,
        kidAge: r.kid_age,
        submittedAt: r.submitted_at,
      }));

      // Fetch associated orders (via order_line_item → generated_bundle)
      const orderRows = await sql<{
        public_id: string;
        customer_email: string;
        status: string;
        total: string;
        created_at: string;
      }[]>`
        SELECT DISTINCT co.public_id, co.customer_email, co.status, co.total, co.created_at
        FROM customer_order co
        JOIN order_line_item oli ON oli.customer_order_id = co.id
        JOIN generated_bundle gb ON gb.id = oli.generated_bundle_id
        WHERE gb.public_id = ${publicId}
        ORDER BY co.created_at DESC
      `;

      const orders: AssociatedOrder[] = orderRows.map(r => ({
        publicId: r.public_id,
        customerEmail: r.customer_email,
        status: r.status,
        total: r.total,
        createdAt: r.created_at,
      }));

      res.json({ ...bundle, futureParties, orders });
    } catch (err) {
      next(err);
    }
  },
);
