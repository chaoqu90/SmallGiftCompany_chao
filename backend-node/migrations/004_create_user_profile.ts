/**
 * Migration 004 — Create user_profile table.
 *
 * Creates a user_profile table that stores optional display name and phone
 * number for authenticated Supabase users. The user_id column references
 * auth.users(id) via a cross-schema FK — ON DELETE CASCADE ensures the
 * profile row is automatically removed when the Supabase Auth user is deleted.
 *
 * Also creates a set_updated_at trigger function (CREATE OR REPLACE, safe to
 * run even if the function already exists from a future migration) and binds
 * it to the user_profile table so updated_at is always kept current.
 */
import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── user_profile ────────────────────────────────────────────────────────────
  pgm.createTable('user_profile', {
    user_id: {
      type: 'uuid',
      primaryKey: true,
      // Cross-schema FK to auth.users cannot use node-pg-migrate's `references`
      // shorthand — added via pgm.addConstraint below.
    },
    display_name: {
      type: 'varchar(100)',
    },
    phone_number: {
      type: 'varchar(20)',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Cross-schema FK: user_profile.user_id → auth.users(id) ON DELETE CASCADE
  // Must use raw SQL via pgm.addConstraint because the references shorthand
  // does not support cross-schema references.
  pgm.addConstraint(
    'user_profile',
    'fk_user_profile_user_id',
    'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
  );

  // ── set_updated_at trigger function ─────────────────────────────────────────
  // CREATE OR REPLACE so re-running the migration (e.g. in a fresh test DB)
  // is idempotent even if the function was created by another migration.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
  `);

  // ── Bind the trigger to user_profile ────────────────────────────────────────
  pgm.sql(`
    CREATE TRIGGER user_profile_updated_at
      BEFORE UPDATE ON user_profile
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TRIGGER IF EXISTS user_profile_updated_at ON user_profile;');
  pgm.dropTable('user_profile');
  // Do NOT drop set_updated_at function — it may be shared with other tables
  // in future migrations.
}
