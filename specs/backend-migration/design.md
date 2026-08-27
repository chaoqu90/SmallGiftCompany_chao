# FEAT-001 Backend Migration — Technical Design

> This design conforms to `specs/tech-overview.md` (golden copy).
> References: `specs/backend-migration/requirements.md`, `docs/backend-design.md`.

---

## 1. Directory and Package Structure

```
backend-node/
  src/
    app.ts                  Express app factory — registers middleware and routers; no Lambda imports
    lambda.ts               Lambda entry point — wraps app with serverless-http; exports handler
    server.ts               Local dev entry point — calls listen(8080) on the app
    db.ts                   postgres.js singleton — module-scope client, prepare: false
    middleware/
      auth.ts               HTTP Basic auth middleware for /admin/api/** routes
      errorHandler.ts       Express error handler — emits RFC 7807 ProblemDetail
      cors.ts               CORS middleware configuration
    routes/
      health.ts             GET /api/health
      generatedBundles.ts   POST + GET /api/generated-bundles
      analytics.ts          POST /api/analytics/events
      admin/
        products.ts         All /admin/api/products/** routes
        bundles.ts          GET /admin/api/bundles/** routes
        dashboard.ts        GET /admin/api/dashboard/** routes
    services/
      bundleGeneration.ts   Three-path algorithm orchestrator
      productEligibility.ts Hard filter functions (pure, testable)
      productScoring.ts     Scoring formula (pure, testable)
      bundleTemplateSelector.ts  Template routing (pure, testable)
      upgradeGeneration.ts  Standard + premium upgrade selection
      bundleSimulation.ts   Read-only simulation (mirrors constrained generation, no DB writes)
      generatedBundle.ts    Bundle persistence + public retrieval
      analytics.ts          Event recording + count queries
      retailPricing.ts      Tiered retail price formula (pure, testable)
    repositories/
      products.ts           Raw SQL for product CRUD and affinity management
      budgetTiers.ts        Raw SQL for budget_tier lookups
      bundleTemplates.ts    Raw SQL for bundle_template + slot lookups
      giftBagOptions.ts     Raw SQL for gift_bag_option lookups
      generatedBundles.ts   Raw SQL for generated_bundle + item reads/writes
      affinities.ts         Raw SQL for batch affinity loads (interest, audience, role, occasion)
      analytics.ts          Raw SQL for analytics_event inserts and counts
    types/
      enums.ts              TypeScript const enums matching Java enums exactly
      entities.ts           Row types (DB layer — snake_case columns)
      dtos.ts               Request/response shapes (API layer — camelCase fields)
      errors.ts             BundleGenerationError class with failureCode
  migrations/
    001_baseline_schema.ts          Tables: product, affinity tables, budget_tier, bundle_template, etc.
    002_seed_reference_data.ts      budget_tier, bundle_template, slots, gift_bag_option seed rows
    003_analytics_event.ts          analytics_event table (mirrors Flyway V23)
    ... (additional migrations as needed)
  tests/
    unit/
      bundleGeneration.test.ts
      productEligibility.test.ts
      productScoring.test.ts
      bundleTemplateSelector.test.ts
      upgradeGeneration.test.ts
      retailPricing.test.ts
    integration/
      health.test.ts
      generatedBundles.test.ts
      analytics.test.ts
      admin.products.test.ts
      admin.bundles.test.ts
      admin.dashboard.test.ts
      helpers/
        db.ts                   Integration test DB client + seed/cleanup helpers
        app.ts                  Builds the Express app for supertest
  package.json
  tsconfig.json
  esbuild.config.js
  vitest.config.ts
  .env.example

infra/
  serverless.yml              Serverless Framework config
```

---

## 2. Key Module Designs

### 2.1 `db.ts` — postgres.js Singleton

```typescript
// Module-scope initialization (outside any handler) — critical for Lambda warm-reuse
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,        // Required: Supavisor transaction mode does not support prepared statements
  max: 5,                // Conservative pool size for Lambda concurrency
  idle_timeout: 20,      // Seconds before idle connections are closed
  connect_timeout: 10,
});
```

**Why outside the handler:** Lambda reuses the execution environment across warm invocations. Instantiating the client at module scope means subsequent requests reuse the existing connection, reducing latency.

---

### 2.2 `app.ts` — Express App Factory

```typescript
import express from 'express';
import cors from 'cors';
import { corsOptions } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { generatedBundlesRouter } from './routes/generatedBundles.js';
import { analyticsRouter } from './routes/analytics.js';
import { adminProductsRouter } from './routes/admin/products.js';
import { adminBundlesRouter } from './routes/admin/bundles.js';
import { adminDashboardRouter } from './routes/admin/dashboard.js';

export function createApp() {
  const app = express();
  app.use(cors(corsOptions));
  app.use(express.json());

  // Public routes
  app.use('/api', healthRouter);
  app.use('/api/generated-bundles', generatedBundlesRouter);
  app.use('/api/analytics', analyticsRouter);

  // Admin routes (auth middleware applied inside each admin router)
  app.use('/admin/api/products', adminProductsRouter);
  app.use('/admin/api/bundles', adminBundlesRouter);
  app.use('/admin/api/dashboard', adminDashboardRouter);

  // Must be last — catches errors thrown by route handlers
  app.use(errorHandler);

  return app;
}
```

**Design principle:** `createApp()` returns a plain Express app with no Lambda-specific code. This makes local dev (`server.ts`) and Lambda (`lambda.ts`) identical in behavior.

---

### 2.3 `lambda.ts` — Lambda Entry Point

```typescript
import serverlessHttp from 'serverless-http';
import { createApp } from './app.js';

// Create once at module scope — reused across warm invocations
const app = createApp();
export const handler = serverlessHttp(app);
```

---

### 2.4 `middleware/auth.ts` — HTTP Basic Auth

```typescript
import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto'; // Node built-in — constant-time comparison

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Basic ')) {
    return res.status(401).json(problemDetail(401, 'Unauthorized', req.path));
  }

  const [username, password] = Buffer.from(authHeader.slice(6), 'base64')
    .toString()
    .split(':');

  const usernameMatch = timingSafeCompare(username, ADMIN_USERNAME);
  const passwordMatch = timingSafeCompare(password, ADMIN_PASSWORD);

  if (!usernameMatch || !passwordMatch) {
    return res.status(401).json(problemDetail(401, 'Unauthorized', req.path));
  }

  next();
}

function timingSafeCompare(a: string, b: string): boolean {
  // Pad both to same length before comparison to avoid length oracle
  const bufA = Buffer.alloc(256, 0);
  const bufB = Buffer.alloc(256, 0);
  bufA.write(a ?? '');
  bufB.write(b ?? '');
  return timingSafeEqual(bufA, bufB);
}
```

The `basicAuth` middleware is applied at the router level in each admin route file (not globally), keeping public routes clean.

---

### 2.5 `middleware/errorHandler.ts` — RFC 7807 Error Handler

```typescript
import { Request, Response, NextFunction } from 'express';
import { BundleGenerationError } from '../types/errors.js';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      type: 'about:validation-error',
      title: 'Validation Failed',
      status: 400,
      detail: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      instance: req.path,
    });
  }

  if (err instanceof BundleGenerationError) {
    return res.status(422).json({
      type: 'about:bundle-generation-error',
      title: 'Bundle Generation Failed',
      status: 422,
      detail: err.message,
      instance: req.path,
      failureCode: err.failureCode,
    });
  }

  console.error('[unhandled]', err);
  return res.status(500).json({
    type: 'about:internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred.',
    instance: req.path,
  });
}
```

---

### 2.6 `types/errors.ts` — Domain Error

```typescript
export type FailureCode =
  | 'INSUFFICIENT_ROLE_COVERAGE'
  | 'NO_BUDGET_FEASIBLE'
  | 'NO_ELIGIBLE_PRODUCTS'
  | 'TEMPLATE_NOT_FOUND'
  | 'BUDGET_TIER_NOT_FOUND'
  | 'NO_GIFT_BAG_CONFIGURED';

export class BundleGenerationError extends Error {
  constructor(
    public readonly failureCode: FailureCode,
    message: string
  ) {
    super(message);
    this.name = 'BundleGenerationError';
  }
}
```

---

### 2.7 `types/enums.ts` — TypeScript Enums

All Java enums are translated to TypeScript string union types (not `enum` keyword, to avoid transpilation issues with ESM):

```typescript
export type ProductCategory =
  | 'STATIONERY' | 'BOOK' | 'PUZZLE' | 'TOY' | 'ACCESSORY' | 'WEARABLE';

export type FormFactor =
  | 'BAR' | 'FLAT_RECT' | 'ROUND' | 'CUBE' | 'IRREGULAR_VOLUME';

export type UpgradeTier = 'STANDARD' | 'PREMIUM';

export type Interest =
  | 'POP_MUSIC' | 'TOYS_PLAY' | 'CUTE_MAGICAL' | 'SPORTS' | 'READING_PUZZLE';

export type PartyType = 'CELEBRATION' | 'HALLOWEEN';

export type AudiencePreference = 'FEMININE' | 'MASCULINE' | 'NO_PREFERENCE';

export type AudienceAffinity = 'FEMININE' | 'MASCULINE' | 'UNIVERSAL';

export type BundleRole =
  | 'UTILITY' | 'ACTIVITY' | 'PLAY' | 'TACTILE' | 'WEARABLE' | 'PREMIUM';
```

---

### 2.8 `services/bundleGeneration.ts` — Three-Path Algorithm

The algorithm is a direct TypeScript port of `BundleGenerationService.java`. Key structure:

```
generate(request)
  1. Validate and load budgetTier by code             → throws BUDGET_TIER_NOT_FOUND
  2. Select template by age + interest                → throws TEMPLATE_NOT_FOUND
  3. Load all eligible products (batch eligibility)
  4. Load all affinities in batch                     → prevents N+1
  5. Index affinities in Maps for O(1) lookup
  6. If maxRetailPrice == null  → PATH 1
     Else                       → PATH 2 (with PATH 3 per-slot fallback)
  7. Select upgrade (standard + premium)
  8. Select gift bag                                  → throws NO_GIFT_BAG_CONFIGURED
  9. Persist snapshot to DB
  10. Return GeneratedBundleResponse
```

**PATH 1 (Unconstrained):**
- For each template slot, score all eligible products filtered by slot's allowed roles.
- Pick the highest-scoring product. If tie, pick by lowest `cog_adjusted`.
- If no product can fill the slot → throw `INSUFFICIENT_ROLE_COVERAGE`.

**PATH 2 (Constrained):**
- Reserve standard upgrade cost from `maxRetailPrice`.
- For each slot in order:
  - Score products filtered by roles, preference (interest + audience), within remaining budget.
  - Feasibility lookahead: ensure remaining slots can still be filled with remaining budget.
  - If no preference-filtered candidate fits → PATH 3 fallback for this slot.
- If still no fit → throw `NO_BUDGET_FEASIBLE`.

**PATH 3 (Tight Fallback — per-slot within PATH 2):**
- Drop interest/role preference filters.
- Keep audience filter and budget constraint.
- Pick cheapest eligible product for the slot.

---

### 2.9 `services/retailPricing.ts` — Retail Price Formula

```typescript
export function computeRetailPrice(cogAdjusted: number): number {
  if (cogAdjusted < 1.00) return 0.50;
  if (cogAdjusted < 4.00) return cogAdjusted / 2;
  if (cogAdjusted < 10.00) return cogAdjusted / 3 + 2 / 3;
  return cogAdjusted * 0.4;
}
```

This pure function is unit-tested in isolation. It is called by the admin product create and pricing-update routes.

---

### 2.10 `services/productScoring.ts` — Scoring Formula

```typescript
export function scoreProduct(
  product: ProductRow,
  interest: Interest,
  audience: AudiencePreference,
  allowedRoles: BundleRole[],
  affinityMaps: AffinityMaps
): number {
  const interestScore = affinityMaps.interest.get(`${product.id}:${interest}`) ?? 0;

  const audienceAdjustment = computeAudienceAdjustment(product, audience, affinityMaps);

  const roleScore = Math.max(
    0,
    ...allowedRoles.map(role => {
      const weight = affinityMaps.role.get(`${product.id}:${role}`) ?? 0;
      return weight * 20 / 100;
    })
  );

  return interestScore + audienceAdjustment + roleScore;
}
```

`AffinityMaps` is a plain object holding four `Map<string, number>` instances built from batch-loaded DB rows.

---

### 2.11 `repositories/` — Raw SQL Pattern

All repository functions accept the `sql` postgres.js tagged-template client as a parameter (dependency injection for testability) and return typed row objects. Example:

```typescript
// repositories/products.ts
import { sql } from '../db.js';
import type { ProductRow } from '../types/entities.js';

export async function getProductById(id: number): Promise<ProductRow | null> {
  const rows = await sql<ProductRow[]>`
    SELECT * FROM product WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function listProducts(): Promise<ProductRow[]> {
  return sql<ProductRow[]>`SELECT * FROM product ORDER BY name`;
}
```

All queries use tagged-template literals — no string concatenation, no SQL injection risk.

---

### 2.12 `migrations/` — node-pg-migrate Files

Migrations are TypeScript files using the node-pg-migrate API. They replicate the schema from Flyway migrations V1–V23 in consolidated form:

| Migration file | Covers |
|---|---|
| `001_baseline_schema.ts` | product, product_interest_affinity, product_audience_affinity, product_role_affinity, product_occasion, budget_tier, bundle_template, bundle_template_slot, bundle_template_slot_role, gift_bag_option, generated_bundle, generated_bundle_item, generated_bundle_upgrade, generated_bundle_gift_bag |
| `002_seed_reference_data.ts` | budget_tier rows, bundle_template rows, slot rows, slot_role rows, gift_bag_option rows (from Flyway V7–V9) |
| `003_analytics_event.ts` | analytics_event table (from Flyway V23) |

All `up()` functions have corresponding `down()` functions for rollback.

---

### 2.13 `infra/serverless.yml` — Serverless Framework Config

```yaml
service: goodiebag-backend

provider:
  name: aws
  runtime: nodejs22.x
  region: us-east-1
  memorySize: 512
  timeout: 30
  httpApi:
    cors:
      allowedOrigins:
        - ${env:CORS_ALLOWED_ORIGIN}
      allowedMethods:
        - GET
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS
      allowedHeaders:
        - '*'
      allowCredentials: false
      maxAge: 3600
  environment:
    DATABASE_URL: ${env:DATABASE_URL}
    CORS_ALLOWED_ORIGIN: ${env:CORS_ALLOWED_ORIGIN}
    ADMIN_USERNAME: ${env:ADMIN_USERNAME}
    ADMIN_PASSWORD: ${env:ADMIN_PASSWORD}
    NODE_ENV: production

functions:
  app:
    handler: ../backend-node/dist/lambda.handler
    events:
      - httpApi:
          method: '*'
          path: '/{proxy+}'
      - httpApi:
          method: '*'
          path: '/'
```

---

### 2.14 GitHub Actions Workflows

**`.github/workflows/ci.yml`** (triggers on push to any branch and PR):
```
1. actions/checkout
2. actions/setup-node (node 22)
3. npm ci (in backend-node/)
4. npm run lint
5. npm run build
6. npm run test   (unit tests; no DATABASE_URL needed)
```

**`.github/workflows/deploy.yml`** (triggers on push to main, after ci passes):
```
1. actions/checkout
2. actions/setup-node (node 22)
3. npm ci (in backend-node/)
4. npm run build
5. npx node-pg-migrate up  (DATABASE_URL from GitHub secret)
6. npm install -g serverless
7. npx serverless deploy   (AWS creds + all env vars from GitHub secrets)
```

Migration step is ordered before deploy step via `needs:` dependency in the workflow.

---

## 3. Design Decisions and Rationale

### 3.1 ESM with esbuild

The project uses `"type": "module"` in `package.json`. All imports use `.js` extensions (TypeScript ESM convention). esbuild bundles everything to a single ESM file for Lambda, minimizing cold-start time by reducing I/O operations during module loading.

### 3.2 Zod for Request Validation

Zod schemas are defined in `types/dtos.ts` adjacent to the TypeScript request/response types. A `validate<T>(schema, body)` helper parses and throws a `ZodError` on failure — the error handler catches it and emits the RFC 7807 400 response. This avoids decorators and keeps validation logic explicit and testable.

### 3.3 No ORM

All database access is via postgres.js tagged-template literals. This keeps the bundle small (postgres.js is ~35 KB vs. Prisma/TypeORM at 2–5 MB), avoids ORM abstraction bugs, and makes SQL queries directly auditable. All queries are in repository files — business logic in services never touches the `sql` client directly.

### 3.4 Atomic Affinity Replace

`PUT /admin/api/products/:id/affinities` wraps the delete-then-insert in a postgres.js transaction (`sql.begin(...)`), ensuring no partial state is visible to concurrent readers.

### 3.5 Snapshot Persistence

When a bundle is generated, the `generated_bundle_item` rows store denormalized product fields (name, SKU, cost, description, form factor) copied from the `product` row at generation time. The service layer performs this copy explicitly — there is no trigger or DB-level mechanism.

### 3.6 Public ID Generation

The `public_id` for generated bundles is generated in the service layer using Node's `crypto.randomBytes(6).toString('hex')` prefixed with `gb_`, matching the `gb_<12-char-hex>` format from the Spring Boot implementation.

### 3.7 Separation of `app.ts` and `lambda.ts`

`app.ts` has no Lambda-specific imports. `server.ts` calls `createApp().listen(8080)` for local dev. `lambda.ts` wraps `createApp()` with `serverless-http`. This means integration tests can `import { createApp } from '../src/app.js'` and use supertest directly without any Lambda adapter.

### 3.8 Test Isolation Strategy

Integration tests connect to a real PostgreSQL database (local Docker or Supabase dev project) using `DATABASE_URL` from the environment. Each test file runs setup SQL (seed a minimal product catalog, budget tiers, templates) in a `beforeAll` block and teardown SQL in an `afterAll` block. Tests within a file may run sequentially to avoid setup/teardown conflicts. No mocked DB — per tech-overview.md constraint.

---

## 4. Data Flow: Bundle Generation (end-to-end)

```
POST /api/generated-bundles
  → Express router → Zod parse(BundleGenerationRequestSchema, req.body)
  → generatedBundleService.generate(request)
      → budgetTiersRepo.findByCode(budgetTierCode)
      → bundleTemplatesRepo.findByCode(templateCode)
      → productsRepo.findAllEligible(age, partyType)   // one query
      → affinitiesRepo.loadAllForProducts(productIds)  // 4 queries (interest, audience, role, occasion)
      → productEligibilityService.filter(products, request, affinityMaps)
      → bundleGenerationService.selectSlots(filteredProducts, slots, request, affinityMaps, budget)
          [PATH 1 or PATH 2+3 as described in §2.8]
      → upgradeGenerationService.select(products, request, affinityMaps, budget)
      → giftBagOptionsRepo.findDefault()
      → generatedBundlesRepo.save(snapshot)            // single INSERT with items + upgrade + giftbag
  → build GeneratedBundleResponse from saved snapshot
  → res.status(201).json(response)
```

---

## 5. Conformance Checklist Against tech-overview.md

| Constraint | How this design satisfies it |
|---|---|
| `prepare: false` on postgres.js | Enforced in `db.ts` |
| DB client outside handler | Module-scope in `db.ts`, imported by `lambda.ts` at module scope |
| Migrations run in CI/CD, not Lambda startup | Separate `node-pg-migrate up` step in `deploy.yml` before `serverless deploy` |
| No prepared statements / session-mode features | `prepare: false` + transaction-mode Supavisor URL (port 6543) |
| Prices computed server-side | `computeRetailPrice()` in service layer; route handlers never read prices from request body |
| HTTP Basic constant-time comparison | `timingSafeEqual` from Node `crypto` module in `auth.ts` |
| Bundle snapshot fields copied at generation time | Explicit field copy in `generatedBundleService.save()` |
| Analytics events — no FK to generated_bundle | `bundle_id` column is VARCHAR in migration, no FK constraint |
