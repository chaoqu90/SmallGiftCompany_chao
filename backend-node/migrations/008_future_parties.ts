import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 008 — Future Parties
 *
 * Creates the future_parties table for lead-capture of parents planning
 * a party in advance. Admin can later link a generated bundle and send
 * a personalised bundle URL by email.
 *
 * Design: specs/future-party/design.md §2
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('future_parties', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    email: {
      type: 'varchar(254)',
      notNull: true,
    },
    party_date: {
      type: 'date',
      notNull: true,
    },
    kid_gender: {
      type: 'varchar(10)',
      notNull: true,
    },
    kid_age: {
      type: 'smallint',
      notNull: true,
    },
    submitted_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    // Plain varchar — no FK constraint (bundle may be deleted/expire later).
    // Matches the pattern of analytics_event.bundle_id.
    linked_bundle_public_id: {
      type: 'varchar(30)',
      notNull: false,
    },
    bundle_sent_at: {
      type: 'timestamptz',
      notNull: false,
    },
  });

  pgm.sql(`
    ALTER TABLE future_parties
      ADD CONSTRAINT chk_future_parties_kid_gender
        CHECK (kid_gender IN ('BOY', 'GIRL', 'MIXED'));
  `);

  pgm.sql(`
    ALTER TABLE future_parties
      ADD CONSTRAINT chk_future_parties_kid_age
        CHECK (kid_age BETWEEN 1 AND 12);
  `);

  pgm.sql(`
    CREATE INDEX idx_future_parties_submitted_at ON future_parties(submitted_at DESC);
  `);

  pgm.sql(`
    CREATE INDEX idx_future_parties_email ON future_parties(email);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('future_parties');
}
