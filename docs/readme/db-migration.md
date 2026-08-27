# Database Migration Guide

This document explains how database migrations work in this project, and the exact process to follow for schema evolution in the future.

---

## How It Works: The Basics

This project uses **[node-pg-migrate](https://salsita.github.io/node-pg-migrate/)** — a TypeScript-native migration tool for PostgreSQL. It works on the same principle as Flyway (which the original Spring Boot backend used):

1. Every schema change is written as a **numbered migration file** in `backend-node/migrations/`
2. `node-pg-migrate` maintains a **tracking table** called `pgmigrations` in your database
3. On every run, it compares the migration files on disk against what's recorded in `pgmigrations`
4. It applies **only the new files**, in order, and records them — so runs are always safe to repeat

---

## Migration File Format

Migration files are **TypeScript files**, not SQL files. This is intentional — it gives you type safety, IDE autocomplete, and the ability to share code between migrations and the app.

Each file must export two functions:

```typescript
// backend-node/migrations/002_add_example_column.ts

import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

// Applied when migrating UP (forward)
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('product', {
    notes: { type: 'text' },
  });
}

// Applied when rolling BACK (reverse)
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('product', 'notes');
}
```

The `MigrationBuilder` (`pgm`) object provides methods for all DDL operations:
- `pgm.createTable()`, `pgm.dropTable()`
- `pgm.addColumn()`, `pgm.dropColumn()`, `pgm.alterColumn()`
- `pgm.createIndex()`, `pgm.dropIndex()`
- `pgm.addConstraint()`, `pgm.dropConstraint()`
- `pgm.sql('...')` — escape hatch for raw SQL when needed

Full API reference: https://salsita.github.io/node-pg-migrate/migrations

---

## Current Migration State

```
backend-node/migrations/
└── 001_baseline_schema.ts    ← all 14 tables from the original Spring Boot schema
```

The baseline migration (`001`) consolidates all 23 Flyway migrations from the original Spring Boot backend into a single clean-slate file for the new Node.js + Supabase deployment.

Tables created by `001`:
| Table | Purpose |
|---|---|
| `product` | Core product catalog |
| `product_interest_affinity` | Interest → product scoring weights |
| `product_audience_affinity` | Audience → product scoring weights |
| `product_role_affinity` | Role → product scoring weights |
| `product_occasion` | Occasion tags per product |
| `budget_tier` | Budget range definitions |
| `bundle_template` | Bundle layout templates |
| `bundle_template_slot` | Slot definitions within a template |
| `bundle_template_slot_role` | Which roles each slot targets |
| `gift_bag_option` | Gift bag add-on options |
| `generated_bundle` | Persisted generated bundle records |
| `generated_bundle_item` | Line items within a generated bundle |
| `generated_bundle_upgrade` | Upgrade options for a bundle |
| `generated_bundle_gift_bag` | Selected gift bag for a bundle |

---

## Running Migrations

### Environment variable required

All migration commands read `DATABASE_URL` from the environment:

```bash
export DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

For Supabase (when integrated), this will be the **transaction-mode pooler URL** (port 6543):
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Available commands

```bash
# Apply all pending migrations (forward)
cd backend-node
npm run migrate

# Roll back the most recent migration
npm run migrate:down

# See which migrations have been applied vs pending
npm run migrate:status
```

These map to (from `package.json`):
```json
"migrate":        "node-pg-migrate up",
"migrate:down":   "node-pg-migrate down",
"migrate:status": "node-pg-migrate status"
```

### Configuration (from `package.json`)

```json
"node-pg-migrate": {
  "migrationsTable": "pgmigrations",
  "dir": "migrations",
  "databaseUrlVar": "DATABASE_URL",
  "tsconfig": "tsconfig.json"
}
```

- **`migrationsTable`**: the tracking table created in your DB (`pgmigrations`)
- **`dir`**: where migration files live (`backend-node/migrations/`)
- **`databaseUrlVar`**: which env var to read the connection string from
- **`tsconfig`**: used so TypeScript migration files are compiled on the fly via `tsx`

---

## The `pgmigrations` Tracking Table

When you first run `npm run migrate`, node-pg-migrate creates this table in your database automatically:

```sql
CREATE TABLE pgmigrations (
  id         serial PRIMARY KEY,
  name       varchar(255) NOT NULL,
  run_on     timestamp    NOT NULL
);
```

Each applied migration gets a row:

| id | name | run_on |
|---|---|---|
| 1 | 001_baseline_schema | 2026-08-23 10:00:00 |
| 2 | 002_add_notes_column | 2026-08-24 09:30:00 |

On subsequent runs, already-applied migrations are **skipped**. This is why it is safe to run `npm run migrate` on every deployment.

---

## How Migrations Run in CI/CD

In the GitHub Actions `deploy.yml` workflow, migrations run **before** the new Lambda code is deployed:

```
push to main
    │
    ├─ ci.yml: lint → build → unit tests
    │
    └─ deploy.yml:
          1. npm run migrate   ← DB schema updated first
          2. npm run build     ← Lambda bundle compiled
          3. serverless deploy ← new code goes live
```

This ordering guarantees the DB schema is always ahead of or equal to the running code, preventing runtime errors from missing columns or tables.

---

## Schema Evolution: Step-by-Step Process

Follow these steps every time you need to change the database schema.

### Step 1 — Create a new migration file

Name the file with the next sequential number:

```
backend-node/migrations/002_your_description.ts
```

Rules:
- **Never edit an existing migration file** — once applied to any environment, it is frozen
- Use a descriptive name (snake_case): `002_add_product_notes.ts`, `003_create_campaign_table.ts`
- The number must be unique and higher than all existing files

### Step 2 — Write the `up` and `down` functions

Always implement both:

```typescript
import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Your schema change here
  pgm.addColumn('product', {
    notes: { type: 'text' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // The exact reverse of up()
  pgm.dropColumn('product', 'notes');
}
```

The `down` function is your rollback escape hatch — it must perfectly undo what `up` does.

### Step 3 — Test locally

```bash
cd backend-node

# Apply your new migration
npm run migrate

# Verify it applied
npm run migrate:status

# Test rollback works
npm run migrate:down

# Re-apply
npm run migrate
```

### Step 4 — Update application code

If the migration adds or removes columns, update the corresponding TypeScript types and SQL queries in `backend-node/src/`:

- Types: `src/types/` or inline in the relevant file
- Queries: the repository files (e.g., `src/catalog/productRepository.ts`)

### Step 5 — Commit and push

```bash
git add backend-node/migrations/002_your_description.ts
git add backend-node/src/...  # any updated types/queries
git commit -m "feat: add notes column to product"
git push origin main
```

The CI/CD pipeline automatically runs `npm run migrate` before deploying the new Lambda code.

---

## Common Schema Change Patterns

### Add a nullable column (safe, no downtime)

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('product', {
    notes: { type: 'text' },  // nullable by default — safe for existing rows
  });
}
```

### Add a NOT NULL column with a default (safe)

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('product', {
    is_featured: {
      type: 'boolean',
      notNull: true,
      default: false,  // existing rows get this value
    },
  });
}
```

### Rename a column (requires two migrations for zero-downtime)

Do NOT use `pgm.renameColumn()` in a single deployment — existing code still reads the old name. Instead:

1. **Migration A**: Add the new column, backfill data
2. **Deploy code** that reads both old and new column
3. **Migration B**: Drop the old column
4. **Deploy code** that reads only the new column

### Add an index (safe, runs concurrently in PostgreSQL)

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createIndex('product', 'notes', { concurrently: true });
}
```

### Create a new table

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('campaign', {
    id:         { type: 'bigserial', primaryKey: true },
    code:       { type: 'varchar(30)', notNull: true, unique: true },
    name:       { type: 'varchar(100)', notNull: true },
    active:     { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('campaign');
}
```

### Raw SQL (for anything not covered by the builder API)

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE product
    ADD CONSTRAINT chk_cost_positive CHECK (cost > 0);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE product DROP CONSTRAINT chk_cost_positive;
  `);
}
```

---

## Verifying Migrations in Supabase

Once connected to Supabase, you can verify migration state in two ways:

**Option 1 — CLI:**
```bash
DATABASE_URL="..." npm run migrate:status
```

**Option 2 — Supabase Dashboard:**
1. Open your Supabase project → **Table Editor**
2. Look for the `pgmigrations` table
3. Each row is an applied migration with its timestamp

---

## What NOT to Do

| Don't | Do instead |
|---|---|
| Edit an existing migration file | Create a new migration file |
| Delete a migration file that has been deployed | Create a `down` migration to reverse it |
| Use raw `ALTER TABLE` in the Lambda app code | Always use migration files |
| Skip the `down` function | Always implement rollback |
| Use the same number twice | Check existing files before numbering |
