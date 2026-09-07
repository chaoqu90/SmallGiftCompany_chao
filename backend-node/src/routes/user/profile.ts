/**
 * User profile routes — protected by Supabase JWT (jwtAuth middleware).
 *
 * GET  /api/user/profile  — returns the caller's profile DTO (null fields if no row).
 * PATCH /api/user/profile — validates body with Zod, upserts the profile, returns DTO.
 *
 * Requirements: R6 (AC6.4), R7 (AC7.1, AC7.5), R8 (AC8.1, AC8.2, AC8.3, AC8.4)
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { jwtAuth } from '../../middleware/jwtAuth.js';
import { getProfile, upsertProfile } from '../../repositories/userProfile.js';
import type { UserProfileRow } from '../../types/entities.js';

export const userProfileRouter = Router();

// Apply JWT auth to all routes in this router (AC7.1)
userProfileRouter.use(jwtAuth);

// ── Zod validation schema for PATCH body ──────────────────────────────────────

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).nullable().optional(),
  // E.164 phone: + followed by 1-9, then 6-14 more digits (total 8-16 chars incl. +)
  phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional(),
});

// ── DTO mapper ────────────────────────────────────────────────────────────────

function toProfileDto(
  row: UserProfileRow | null,
  userId: string,
  email: string,
) {
  return {
    userId,
    email,
    displayName: row?.display_name ?? null,
    phoneNumber: row?.phone_number ?? null,
    createdAt:   row?.created_at?.toISOString() ?? null,
  };
}

// ── GET /api/user/profile ─────────────────────────────────────────────────────

userProfileRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // req.user is guaranteed by jwtAuth above
      const { id, email } = req.user!;
      const row = await getProfile(id);
      res.status(200).json(toProfileDto(row, id, email));
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /api/user/profile ───────────────────────────────────────────────────

userProfileRouter.patch(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Zod parse — throws ZodError on invalid input, caught by errorHandler → 400
      const data = UpdateProfileSchema.parse(req.body);
      const { id, email } = req.user!;
      const row = await upsertProfile(id, {
        displayName: data.displayName,
        phoneNumber: data.phoneNumber,
      });
      res.status(200).json(toProfileDto(row, id, email));
    } catch (err) {
      next(err);
    }
  },
);
