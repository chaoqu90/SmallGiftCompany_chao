/**
 * Migration 003 — Analytics event table.
 *
 * Creates the analytics_event table. Equivalent to Flyway V23.
 *
 * IMPORTANT: bundle_id is VARCHAR (NOT a FK to generated_bundle).
 * This is intentional — analytics events must survive bundle deletion.
 * See: requirements.md AC6.3, design.md §3.5.
 */
import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('analytics_event', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    event_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    session_id: {
      type: 'varchar(100)',
    },
    // Intentionally VARCHAR, NOT FK — events must survive bundle deletion (AC6.3)
    bundle_id: {
      type: 'varchar(30)',
    },
    metadata_json: {
      type: 'text',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('analytics_event', 'event_type', { name: 'idx_analytics_event_type' });
  pgm.createIndex('analytics_event', 'created_at', { name: 'idx_analytics_event_created_at' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('analytics_event');
}
