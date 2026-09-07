/**
 * Admin future parties routes — HTTP Basic auth required (applied at router level).
 *
 * GET  /admin/api/future-parties                       — list all submissions
 * PATCH /admin/api/future-parties/:id/link-bundle      — link a generated bundle
 * POST  /admin/api/future-parties/:id/send-link        — send bundle email to parent
 * POST  /admin/api/future-parties/redeem               — redeem a 6-digit code at the fair booth
 *
 * Requirements: AC4.3, AC5.5, AC6.3, AC6.4, AC6.5, AC7.2, AC7.3
 * Design: specs/future-party/design.md §3.5
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { basicAuth } from '../../middleware/auth.js';
import { LinkBundleRequestSchema } from '../../types/dtos.js';
import {
  listFutureParties,
  findFuturePartyById,
  findByRedemptionCode,
  markRedeemed,
  linkBundle,
  recordSend,
} from '../../repositories/futureParties.js';
import { toFuturePartyDto } from '../futureParties.js';
import { sendFuturePartyEmail } from '../../lib/email.js';

export const adminFuturePartiesRouter = Router();

// Apply Basic auth to every admin route (AC7.3)
adminFuturePartiesRouter.use(basicAuth);

// ─── GET / ────────────────────────────────────────────────────────────────────

/**
 * List all future party submissions, newest first.
 * Requirements: AC4.3
 */
adminFuturePartiesRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rows = await listFutureParties();
      res.json(rows.map(toFuturePartyDto));
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /redeem ─────────────────────────────────────────────────────────────

/**
 * Redeem a 6-digit code at the fair booth.
 *
 * Body: { code: string }
 *
 * 404 — code not found
 * 409 — code already redeemed
 * 200 — success; returns the full future party DTO with redeemedAt set
 */
adminFuturePartiesRouter.post(
  '/redeem',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = req.body as { code?: unknown };

      // Validate: must be a 6-digit numeric string
      if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Validation Error',
          status:   400,
          detail:   'code must be a 6-digit numeric string.',
          instance: req.path,
        });
        return;
      }

      const row = await findByRedemptionCode(code);
      if (!row) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   'Redemption code not found.',
          instance: req.path,
        });
        return;
      }

      if (row.redeemed_at !== null) {
        res.status(409).json({
          type:     'about:conflict',
          title:    'Conflict',
          status:   409,
          detail:   'This code has already been redeemed.',
          instance: req.path,
        });
        return;
      }

      const updated = await markRedeemed(row.id);
      // undefined means a concurrent request redeemed the code first (race guard)
      if (!updated) {
        res.status(409).json({
          type:     'about:conflict',
          title:    'Conflict',
          status:   409,
          detail:   'This code has already been redeemed.',
          instance: req.path,
        });
        return;
      }
      res.json(toFuturePartyDto(updated));
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /:id/link-bundle ───────────────────────────────────────────────────

/**
 * Link a generated bundle public ID to a future party submission.
 * Returns 400 if a bundle is already linked (idempotency guard — Key Constraint #4).
 * Requirements: AC5.5
 */
adminFuturePartiesRouter.patch(
  '/:id/link-bundle',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Validation Error',
          status:   400,
          detail:   'id must be an integer.',
          instance: req.path,
        });
        return;
      }

      const row = await findFuturePartyById(id);
      if (!row) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Future party submission not found: ${id}`,
          instance: req.path,
        });
        return;
      }

      // Reject overwrite — Key Constraint #4 (AC5.5)
      if (row.linked_bundle_public_id !== null) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Validation Error',
          status:   400,
          detail:   'This submission already has a linked bundle.',
          instance: req.path,
        });
        return;
      }

      const { bundlePublicId } = LinkBundleRequestSchema.parse(req.body);
      const updated = await linkBundle(id, bundlePublicId);

      res.json(toFuturePartyDto(updated!));
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /:id/send-link ──────────────────────────────────────────────────────

/**
 * Send (or re-send) the personalised bundle link email to the parent.
 *
 * SES errors are NOT swallowed — they propagate to errorHandler which returns
 * HTTP 500 so the admin knows the email was not sent (Key Constraint #2, AC6.5).
 *
 * Requirements: AC6.3, AC6.4, AC6.5
 */
adminFuturePartiesRouter.post(
  '/:id/send-link',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Validation Error',
          status:   400,
          detail:   'id must be an integer.',
          instance: req.path,
        });
        return;
      }

      const row = await findFuturePartyById(id);
      if (!row) {
        res.status(404).json({
          type:     'about:not-found',
          title:    'Not Found',
          status:   404,
          detail:   `Future party submission not found: ${id}`,
          instance: req.path,
        });
        return;
      }

      if (row.linked_bundle_public_id === null) {
        res.status(422).json({
          type:     'about:validation-error',
          title:    'Unprocessable Entity',
          status:   422,
          detail:   'No bundle linked to this submission.',
          instance: req.path,
        });
        return;
      }

      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      const bundleUrl   = `${frontendUrl}/bundleCustomization/${row.linked_bundle_public_id}`;

      // sendFuturePartyEmail throws on SES failure — do NOT catch here (AC6.5)
      await sendFuturePartyEmail({
        toEmail:   row.email,
        partyDate: row.party_date,
        kidGender: row.kid_gender as 'BOY' | 'GIRL' | 'MIXED',
        bundleUrl,
      });

      // Only stamp bundle_sent_at after a confirmed successful send
      const updated = await recordSend(id);

      res.json({ sentAt: updated!.bundle_sent_at });
    } catch (err) {
      next(err);
    }
  },
);
