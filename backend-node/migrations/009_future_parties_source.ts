import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 009 — Future Parties Source
 *
 * Adds a nullable source column to future_parties so the admin can
 * distinguish signup-promotion leads (expecting a gift at the fair)
 * from Plan-For-Future leads (expecting a personalised bundle email).
 *
 * Existing rows will have source = NULL (correct — they were submitted
 * before this feature existed).
 *
 * Design: specs/signup-promotion/design.md §2.2
 * Requirements: FEAT-005 AC4.2
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('future_parties', {
    source: {
      type: 'varchar(50)',
      notNull: false,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('future_parties', 'source');
}
