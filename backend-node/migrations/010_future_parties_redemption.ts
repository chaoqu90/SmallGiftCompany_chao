import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 010 — Future Parties Redemption Code
 *
 * Adds a unique 6-digit redemption_code column and a redeemed_at timestamp
 * to future_parties. Only signup-promotion rows receive a code at insert time;
 * all other rows (and existing rows) have redemption_code = NULL.
 *
 * Design: specs/signup-promotion/design.md §2.3
 * Requirements: FEAT-005 AC4.2
 */
export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('future_parties', {
    redemption_code: { type: 'varchar(6)', notNull: false, unique: true },
    redeemed_at:     { type: 'timestamptz', notNull: false },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn('future_parties', 'redeemed_at');
  pgm.dropColumn('future_parties', 'redemption_code');
}
