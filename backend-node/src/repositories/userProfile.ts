/**
 * User profile repository.
 *
 * Provides two functions:
 *   getProfile   — SELECT by user_id; returns null if no row exists.
 *   upsertProfile — INSERT … ON CONFLICT DO UPDATE; always returns the row.
 *
 * Uses the postgres.js `sql` tagged-template singleton from db.ts.
 * `prepare: false` is already set on the client — no changes needed here.
 *
 * Requirements: R8 (AC8.1, AC8.2, AC8.4)
 */
import { sql } from '../db.js';
import type { UserProfileRow } from '../types/entities.js';

/**
 * Fetches the profile row for the given user.
 * Returns null when no profile row exists yet (new user, first visit).
 */
export async function getProfile(userId: string): Promise<UserProfileRow | null> {
  const rows = await sql<UserProfileRow[]>`
    SELECT user_id, display_name, phone_number, created_at
    FROM user_profile
    WHERE user_id = ${userId}
  `;
  return rows[0] ?? null;
}

/**
 * Upserts the profile row for the given user.
 * On conflict (same user_id) updates display_name, phone_number, and updated_at.
 * Always returns the persisted row.
 */
export async function upsertProfile(
  userId: string,
  data: { displayName?: string | null; phoneNumber?: string | null },
): Promise<UserProfileRow> {
  const rows = await sql<UserProfileRow[]>`
    INSERT INTO user_profile (user_id, display_name, phone_number)
    VALUES (
      ${userId},
      ${data.displayName ?? null},
      ${data.phoneNumber ?? null}
    )
    ON CONFLICT (user_id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          phone_number = EXCLUDED.phone_number,
          updated_at   = now()
    RETURNING user_id, display_name, phone_number, created_at
  `;
  return rows[0];
}
