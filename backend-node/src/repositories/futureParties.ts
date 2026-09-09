/**
 * Future Parties repository.
 *
 * All DB queries use the singleton postgres.js tagged-template client.
 * No ORM — raw SQL only, matching the project-wide pattern.
 *
 * Requirements: AC3.1, AC4.3, AC5.5, AC6.3
 * Design: specs/future-party/design.md §3.1
 */
import { sql } from '../db.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw snake_case shape returned by postgres.js for the future_parties table. */
export interface FuturePartyRow {
  id:                     number;
  email:                  string;
  party_date:             string;   // DATE comes back as string from postgres.js
  kid_gender:             string;
  kid_age:                number;
  submitted_at:           string;
  linked_bundle_public_id: string | null;
  bundle_sent_at:         string | null;
  source:                 string | null;   // FEAT-005 — 'signup-promotion' or NULL
  redemption_code:        string | null;   // 6-digit code, only for signup-promotion rows
  redeemed_at:            string | null;   // timestamptz, set when code is scanned at booth
}

export interface InsertFuturePartyData {
  email:     string;
  partyDate: string;  // YYYY-MM-DD
  kidGender: string;  // BOY | GIRL | MIXED
  kidAge:    number;
  source:    string | null;  // FEAT-005 — 'signup-promotion' or null
}

// ─── generateRedemptionCode ───────────────────────────────────────────────────

/**
 * Generate a unique 6-digit numeric redemption code.
 * Retries up to 10 times to avoid collisions (extremely rare for 900 000-space).
 * Throws if all 10 attempts collide (should never happen in practice).
 */
async function generateRedemptionCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const rows = await sql`SELECT id FROM future_parties WHERE redemption_code = ${code}`;
    if (rows.length === 0) return code;
  }
  throw new Error('Failed to generate unique redemption code after 10 attempts');
}

// ─── insertFutureParty ────────────────────────────────────────────────────────

/**
 * Insert a new future party lead and return the persisted row.
 * For signup-promotion rows a unique 6-digit redemption_code is generated and
 * stored; all other rows get redemption_code = NULL.
 * Requirements: AC3.1
 */
export async function insertFutureParty(data: InsertFuturePartyData): Promise<FuturePartyRow> {
  const redemptionCode = data.source === 'signup-promotion'
    ? await generateRedemptionCode()
    : null;

  const rows = await sql<FuturePartyRow[]>`
    INSERT INTO future_parties (email, party_date, kid_gender, kid_age, source, redemption_code)
    VALUES (
      ${data.email},
      ${data.partyDate},
      ${data.kidGender},
      ${data.kidAge},
      ${data.source},
      ${redemptionCode}
    )
    RETURNING *
  `;
  return rows[0];
}

// ─── findSignupPromotionByEmail ───────────────────────────────────────────────

/**
 * Find an existing signup-promotion row by email.
 * Used to detect duplicates before inserting a new one.
 */
export async function findSignupPromotionByEmail(email: string): Promise<FuturePartyRow | undefined> {
  const rows = await sql<FuturePartyRow[]>`
    SELECT * FROM future_parties
    WHERE email = ${email}
      AND source = 'signup-promotion'
    LIMIT 1
  `;
  return rows[0];
}

// ─── listFutureParties ────────────────────────────────────────────────────────

/**
 * Return all future party rows, newest first.
 * Requirements: AC4.3
 */
export async function listFutureParties(): Promise<FuturePartyRow[]> {
  return sql<FuturePartyRow[]>`
    SELECT * FROM future_parties
    ORDER BY submitted_at DESC
  `;
}

// ─── findFuturePartyById ──────────────────────────────────────────────────────

/**
 * Find a single future party row by primary key.
 * Returns undefined if not found.
 * Requirements: AC5.5, AC6.3
 */
export async function findFuturePartyById(id: number): Promise<FuturePartyRow | undefined> {
  const rows = await sql<FuturePartyRow[]>`
    SELECT * FROM future_parties
    WHERE id = ${id}
  `;
  return rows[0];
}

// ─── findByRedemptionCode ─────────────────────────────────────────────────────

/**
 * Find a single future party row by its redemption code.
 * Returns undefined if no row matches (invalid or already-claimed codes both
 * surface as not-found; the caller distinguishes redeemed_at separately).
 */
export async function findByRedemptionCode(code: string): Promise<FuturePartyRow | undefined> {
  const rows = await sql<FuturePartyRow[]>`
    SELECT * FROM future_parties WHERE redemption_code = ${code}
  `;
  return rows[0];
}

// ─── markRedeemed ─────────────────────────────────────────────────────────────

/**
 * Stamp redeemed_at = now() on a future party row.
 * Returns the updated row, or undefined if the row no longer exists.
 */
export async function markRedeemed(id: number): Promise<FuturePartyRow | undefined> {
  // WHERE redeemed_at IS NULL ensures atomicity — if two requests race,
  // only the first UPDATE matches and gets a row back; the second gets undefined.
  const rows = await sql<FuturePartyRow[]>`
    UPDATE future_parties
    SET redeemed_at = now()
    WHERE id = ${id}
      AND redeemed_at IS NULL
    RETURNING *
  `;
  return rows[0];
}

// ─── linkBundle ───────────────────────────────────────────────────────────────

/**
 * Set linked_bundle_public_id on a future party row.
 * Returns the updated row, or undefined if the row no longer exists.
 * Requirements: AC5.5
 */
export async function linkBundle(
  id: number,
  bundlePublicId: string,
): Promise<FuturePartyRow | undefined> {
  const rows = await sql<FuturePartyRow[]>`
    UPDATE future_parties
    SET linked_bundle_public_id = ${bundlePublicId}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

// ─── recordSend ───────────────────────────────────────────────────────────────

/**
 * Stamp bundle_sent_at = now() after a successful email send.
 * Returns the updated row, or undefined if the row no longer exists.
 * Requirements: AC6.3
 */
export async function recordSend(id: number): Promise<FuturePartyRow | undefined> {
  const rows = await sql<FuturePartyRow[]>`
    UPDATE future_parties
    SET bundle_sent_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}
