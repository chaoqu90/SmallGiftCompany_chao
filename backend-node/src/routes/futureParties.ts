/**
 * Public future parties route — NO auth required.
 *
 * POST /api/future-parties — submit a future party registration.
 *
 * Requirements: AC3.1, AC3.2, AC3.3, AC3.5, AC7.1
 * Design: specs/future-party/design.md §3.4
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { FuturePartyRequestSchema } from '../types/dtos.js';
import {
  insertFutureParty,
  type FuturePartyRow,
} from '../repositories/futureParties.js';
import { sendSignupPromotionEmail } from '../lib/email.js';

export const futurePartiesRouter = Router();

// ─── DTO mapper ───────────────────────────────────────────────────────────────

export function toFuturePartyDto(row: FuturePartyRow) {
  return {
    id:                   row.id,
    email:                row.email,
    partyDate:            row.party_date,
    kidGender:            row.kid_gender,
    kidAge:               row.kid_age,
    submittedAt:          row.submitted_at,
    linkedBundlePublicId: row.linked_bundle_public_id,
    bundleSentAt:         row.bundle_sent_at,
    source:               row.source,         // FEAT-005 AC4.2
    redemptionCode:       row.redemption_code,
    redeemedAt:           row.redeemed_at,
  };
}

// ─── POST / ───────────────────────────────────────────────────────────────────

futurePartiesRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Zod validation — Zod errors propagate to errorHandler via next(err)
      const parsed = FuturePartyRequestSchema.parse(req.body);

      // 2. Server-side future-date check (AC3.2, AC2.3)
      const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
      if (parsed.partyDate <= today) {
        res.status(400).json({
          type:     'about:validation-error',
          title:    'Validation Error',
          status:   400,
          detail:   'partyDate must be in the future.',
          instance: req.path,
        });
        return;
      }

      // 3. Persist (pass source through to the repository — FEAT-005 design.md §3.2)
      const row = await insertFutureParty({
        email:     parsed.email,
        partyDate: parsed.partyDate,
        kidGender: parsed.kidGender,
        kidAge:    parsed.kidAge,
        source:    parsed.source ?? null,
      });

      // 4. Signup-promotion email — fire-and-forget (FEAT-005 AC4.1, AC4.6)
      // Intentionally NOT awaited — the 201 response is returned immediately.
      // sendSignupPromotionEmail swallows SES errors internally with console.warn.
      if (parsed.source === 'signup-promotion') {
        sendSignupPromotionEmail({
          toEmail:        parsed.email,
          redemptionCode: row.redemption_code ?? '',
        }).catch(() => {
          // Already logged inside sendSignupPromotionEmail (AC4.6)
        });
      }

      // 5. Respond
      res.status(201).json(toFuturePartyDto(row));
    } catch (err) {
      next(err);
    }
  },
);
