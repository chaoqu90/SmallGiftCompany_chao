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
}

export interface InsertFuturePartyData {
  email:     string;
  partyDate: string;  // YYYY-MM-DD
  kidGender: string;  // BOY | GIRL | MIXED
  kidAge:    number;
}

// ─── insertFutureParty ────────────────────────────────────────────────────────

/**
 * Insert a new future party lead and return the persisted row.
 * Requirements: AC3.1
 */
export async function insertFutureParty(data: InsertFuturePartyData): Promise<FuturePartyRow> {
  const rows = await sql<FuturePartyRow[]>`
    INSERT INTO future_parties (email, party_date, kid_gender, kid_age)
    VALUES (${data.email}, ${data.partyDate}, ${data.kidGender}, ${data.kidAge})
    RETURNING *
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
