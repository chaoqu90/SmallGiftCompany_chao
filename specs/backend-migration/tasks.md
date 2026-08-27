# FEAT-001 Backend Migration — Implementation Tasks

> Statuses: `[ ]` pending · `[-]` in progress · `[x]` completed · `[!]` blocked
>
> Requirements reference: `specs/backend-migration/requirements.md`
> Design reference: `specs/backend-migration/design.md`
> Tech reference: `specs/tech-overview.md`

---

## Phase A — Project Scaffold (no dependencies)

### T01 — Initialize backend-node/ package
**Status:** `[x]` completed
**Requirements:** R1 (AC1.1, AC1.2, AC1.3, AC1.4, AC1.8)
**Depends on:** nothing

Set up `backend-node/` as an ESM TypeScript project:
- `package.json` with `"type": "module"`, scripts: `dev` (tsx watch), `build` (esbuild), `lint` (eslint), `test` (vitest unit), `test:integration` (vitest integration).
- `tsconfig.json` with `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"target": "ES2022"`, `strict: true`.
- `esbuild.config.js` producing a single ESM bundle to `dist/lambda.js`.
- `vitest.config.ts` with separate projects for `unit` (no DB) and `integration` (with DB).
- `.env.example` listing all required environment variables.
- Install dependencies: `express`, `cors`, `zod`, `postgres`, `serverless-http`.
- Install dev dependencies: `typescript`, `tsx`, `esbuild`, `vitest`, `supertest`, `@types/express`, `@types/cors`, `@types/node`, `eslint`, `@typescript-eslint/eslint-plugin`.

**Deliverable:** `npm ci && npm run build` succeeds and produces `dist/lambda.js`.

---

### T02 — Define types: enums, entities, DTOs, errors
**Status:** `[x]` completed
**Requirements:** R4 (AC4.2), R6 (AC6.2), R11 (AC11.3)
**Depends on:** T01

Create all TypeScript type definitions:
- `src/types/enums.ts` — string union types for all Java enums: `ProductCategory`, `FormFactor`, `UpgradeTier`, `Interest`, `PartyType`, `AudiencePreference`, `AudienceAffinity`, `BundleRole`.
- `src/types/entities.ts` — DB row types with snake_case fields matching every column defined in design.md §2.10 (ProductRow, BudgetTierRow, BundleTemplateRow, BundleTemplateSlotRow, GeneratedBundleRow, GeneratedBundleItemRow, GeneratedBundleUpgradeRow, GeneratedBundleGiftBagRow, GiftBagOptionRow, AnalyticsEventRow, affinity row types).
- `src/types/dtos.ts` — request/response types with camelCase fields: `BundleGenerationRequest`, `GeneratedBundleResponse`, `GeneratedBundleItemDto`, `GeneratedBundleUpgradeDto`, `GeneratedBundleGiftBagDto`, `EventCaptureRequest`, plus Zod schemas for all request types.
- `src/types/errors.ts` — `FailureCode` union type and `BundleGenerationError` class (design.md §2.6).

**Deliverable:** TypeScript compiles with zero errors across all type files.

---

### T03 — Database client and migrations
**Status:** `[x]` completed
**Requirements:** R2 (AC2.1–AC2.6)
**Depends on:** T01

1. Create `src/db.ts` with module-scope postgres.js singleton (design.md §2.1):
   - `prepare: false`, `max: 5`, `idle_timeout: 20`.
   - Fail fast if `DATABASE_URL` is not set.

2. Create migration files in `backend-node/migrations/` using node-pg-migrate:
   - `001_baseline_schema.ts`: all tables from the Spring Boot entity model (see `docs/backend-design.md` §5 for full column list). Tables: `product`, `product_interest_affinity`, `product_audience_affinity`, `product_role_affinity`, `product_occasion`, `budget_tier`, `bundle_template`, `bundle_template_slot`, `bundle_template_slot_role`, `gift_bag_option`, `generated_bundle`, `generated_bundle_item`, `generated_bundle_upgrade`, `generated_bundle_gift_bag`. All columns, types, constraints, indexes, and defaults must match the Spring Boot entity definitions exactly.
   - `002_seed_reference_data.ts`: `budget_tier` rows, `bundle_template` rows, `bundle_template_slot` rows, `bundle_template_slot_role` rows, `gift_bag_option` rows — equivalent to Flyway V7–V9.
   - `003_analytics_event.ts`: `analytics_event` table (event_type, session_id, bundle_id VARCHAR, metadata_json TEXT, created_at; indexes on event_type and created_at).
   - Each migration must have a `down()` function.

3. Add `migrate` script to `package.json`: `"migrate": "node-pg-migrate up"`.

**Deliverable:** `npm run migrate` against a blank PostgreSQL database completes without errors and produces the correct schema (verifiable via `\dt` and spot-check of column definitions).

---

## Phase B — Core Infrastructure (depends on T01, T02)

### T04 — Express app factory, middleware, and server entry points
**Status:** `[x]` completed
**Requirements:** R3, R11, R12
**Depends on:** T01, T02

1. Create `src/middleware/cors.ts` — CORS options using `CORS_ALLOWED_ORIGIN` env var (design.md §2.2 + tech-overview.md §14).
2. Create `src/middleware/auth.ts` — HTTP Basic auth middleware with constant-time comparison (design.md §2.4).
3. Create `src/middleware/errorHandler.ts` — RFC 7807 error handler (design.md §2.5). Must handle `ZodError`, `BundleGenerationError`, and all other errors.
4. Create `src/app.ts` — `createApp()` factory (design.md §2.2). Mount all routers (stubs returning 501 are fine at this stage). Apply `cors`, `express.json()`, `errorHandler`.
5. Create `src/server.ts` — `createApp().listen(8080)` for local dev.
6. Create `src/lambda.ts` — `serverless-http` wrapper (design.md §2.3).

**Deliverable:** `npm run dev` starts server on port 8080. `GET /api/health` on a stub returns a response (even 501). Sending an invalid JSON body returns a 400 RFC 7807 response. `GET /api/health` in Lambda mode (via `handler`) returns a response.

---

## Phase C — Repository Layer (depends on T02, T03)

### T05 — Products repository
**Status:** `[x]` completed
**Requirements:** R7 (AC7.3–AC7.12), R4 (AC4.10)
**Depends on:** T02, T03

Create `src/repositories/products.ts` with raw SQL functions:
- `listProducts()` → sorted by name
- `getProductById(id)` → single row or null
- `createProduct(data)` → returns created row
- `updateProductInventory(id, quantity)` → returns updated row
- `updateProductActive(id, active)` → returns updated row
- `updateProductPricing(id, cost, cogOverhead)` → computes cogAdjusted + retailPrice, returns updated row
- `updateProductCategory(id, category)` → returns updated row
- `updateProductUpgradeTier(id, tier)` → returns updated row
- `updateProductAgeRange(id, minAge, maxAge)` → returns updated row
- `updateProductDetails(id, name, category, formFactor)` → returns updated row
- `deleteProduct(id)` → returns boolean (false if referenced by generated_bundle_item)
- `isBundleReferenced(id)` → boolean check before delete
- `findAllEligibleForGeneration(age, partyType)` → products active, in age range, inventory > 0, matching party occasion (joins product_occasion)

**Deliverable:** TypeScript compiles; functions are exported and have correct return types.

---

### T06 — Affinity repository
**Status:** `[x]` completed
**Requirements:** R4 (AC4.10), R8 (AC8.1, AC8.2)
**Depends on:** T02, T03

Create `src/repositories/affinities.ts`:
- `loadInterestAffinities(productIds: number[])` → `ProductInterestAffinityRow[]`
- `loadAudienceAffinities(productIds: number[])` → `ProductAudienceAffinityRow[]`
- `loadRoleAffinities(productIds: number[])` → `ProductRoleAffinityRow[]`
- `loadOccasionAffinities(productIds: number[])` → `ProductOccasionRow[]`
- `getAffinitiesForProduct(productId: number)` → all four affinity types for one product
- `replaceAffinities(productId: number, data: AffinityPayload)` → transactional delete-then-insert for all four affinity types (uses `sql.begin(...)`)

**Deliverable:** TypeScript compiles; batch-load functions accept an array of IDs and use `WHERE product_id = ANY(${sql.array(ids)})` pattern.

---

### T07 — Bundle template, budget tier, gift bag, generated bundle repositories
**Status:** `[x]` completed
**Requirements:** R4 (AC4.4–AC4.13), R5 (AC5.1, AC5.2), R9 (AC9.1–AC9.3)
**Depends on:** T02, T03

Create:
- `src/repositories/bundleTemplates.ts`:
  - `findTemplateByCode(code)` → template with slots and allowed roles
- `src/repositories/budgetTiers.ts`:
  - `findBudgetTierByCode(code)` → single row or null
- `src/repositories/giftBagOptions.ts`:
  - `findDefaultGiftBag()` → single row or null
  - `listGiftBagOptions()` → all rows
- `src/repositories/generatedBundles.ts`:
  - `saveBundle(snapshot)` → inserts generated_bundle + items + upgrade + gift_bag in a transaction; returns generated_bundle row with public_id
  - `findBundleByPublicId(publicId)` → full bundle with items, upgrade, gift_bag or null
  - `listRecentBundles(limit: 200)` → newest first
- `src/repositories/analytics.ts`:
  - `recordEvent(data)` → inserts analytics_event row
  - `countByEventType(eventType)` → count

**Deliverable:** TypeScript compiles; `saveBundle` wraps all inserts in a single transaction.

---

## Phase D — Service Layer (depends on T02, T05, T06, T07)

### T08 — Pure business logic services (unit-testable)
**Status:** `[x]` completed
**Requirements:** R4 (AC4.6, AC4.7, AC4.8, AC4.9)
**Depends on:** T02

Create pure functions with no DB dependencies (injectable via parameters):
- `src/services/retailPricing.ts` — `computeRetailPrice(cogAdjusted: number): number` (design.md §2.9).
- `src/services/productScoring.ts` — `scoreProduct(product, interest, audience, allowedRoles, affinityMaps): number` (design.md §2.10).
- `src/services/productEligibility.ts` — `filterEligibleProducts(products, request, affinityMaps): ProductRow[]` applying all hard filters (active, age range, inventory > 0, party type/occasion match, audience compatibility).
- `src/services/bundleTemplateSelector.ts` — `selectTemplate(age, interest): TemplateCode` implementing the three-condition routing (design.md §2.8 template section).

**Deliverable:** All four modules export named functions; TypeScript compiles; no DB imports.

---

### T09 — Unit tests for pure business logic
**Status:** `[x]` completed
**Requirements:** R15 (AC15.1, AC15.6)
**Depends on:** T08

Write Vitest unit tests (no DB) in `tests/unit/`:
- `retailPricing.test.ts` — test all four price tiers plus boundary values.
- `productScoring.test.ts` — test all audienceAdjustment branches (matching gender, universal, mismatched, NO_PREFERENCE), interestScore lookup, roleScore scaling.
- `productEligibility.test.ts` — test each hard filter in isolation and in combination.
- `bundleTemplateSelector.test.ts` — test all three routing rules including READING_PUZZLE fallback.

**Deliverable:** `npm run test` passes with zero failures and covers all branches listed above.

---

### T10 — Bundle generation service
**Status:** `[x]` completed
**Requirements:** R4 (AC4.4–AC4.12)
**Depends on:** T08, T05, T06, T07

Create `src/services/bundleGeneration.ts` — the core three-path algorithm (design.md §2.8):
- `generate(request: BundleGenerationRequest): Promise<GeneratedBundleResponse>`
- Orchestrates: budget tier lookup → template selection → eligibility filter → batch affinity load → affinity indexing → slot selection (PATH 1 or PATH 2+3) → upgrade selection → gift bag selection → snapshot persistence → response mapping.
- `public_id` generated via `crypto.randomBytes(6).toString('hex')` prefixed with `gb_`.
- All failure paths throw `BundleGenerationError` with the correct `failureCode`.

Create `src/services/upgradeGeneration.ts` — selects standard and premium upgrade products from PREMIUM-tier products not already selected in main slots.

Create `src/services/generatedBundle.ts` — thin retrieval service: `getByPublicId(publicId)` wrapping the repository call.

**Deliverable:** TypeScript compiles. The service can be instantiated with mock repository functions for unit testing.

---

### T11 — Bundle generation unit tests (algorithm paths)
**Status:** `[x]` completed
**Requirements:** R15 (AC15.1, AC15.6)
**Depends on:** T10

Write Vitest unit tests in `tests/unit/bundleGeneration.test.ts`:
- PATH 1 (unconstrained): selects highest-scoring eligible product per slot.
- PATH 2 (constrained): respects budget ceiling, feasibility lookahead.
- PATH 3 (tight fallback): activated when preference-filtered candidates don't fit; drops interest/role filters.
- `INSUFFICIENT_ROLE_COVERAGE`: thrown when no product can fill a required slot.
- `NO_BUDGET_FEASIBLE`: thrown when even the cheapest eligible products exceed budget.
- `NO_ELIGIBLE_PRODUCTS`: thrown when all products are filtered out before slot assignment.
- `TEMPLATE_NOT_FOUND`: thrown when template code resolves to nothing in the DB.
- `BUDGET_TIER_NOT_FOUND`: thrown when the requested tier code doesn't exist.
- `NO_GIFT_BAG_CONFIGURED`: thrown when no default gift bag is found.

Use in-memory stub repositories — no real DB calls. All tests run under `npm run test`.

**Deliverable:** All nine scenarios above have passing tests.

---

### T12 — Bundle simulation service
**Status:** `[x]` completed
**Requirements:** R10 (AC10.2, AC10.3)
**Depends on:** T10

Create `src/services/bundleSimulation.ts` — read-only simulation for the dashboard product-coverage endpoint:
- Iterates all combinations of age midpoints (4, 7, 11), all `Interest` values, all `AudiencePreference` values, all `PartyType` values, and all active `budget_tier` rows.
- For each combination, runs the constrained bundle generation logic (PATH 2+3) in memory without persisting.
- Returns an array of product-appearance records: which products appeared, under which combination, and how many times.
- MUST NOT write to the database.

**Deliverable:** TypeScript compiles; function signature accepts no DB write operations.

---

### T13 — Analytics service
**Status:** `[x]` completed
**Requirements:** R6, R10 (AC10.1)
**Depends on:** T07

Create `src/services/analytics.ts`:
- `recordEvent(data: EventCaptureRequest): Promise<void>` — validates and inserts into analytics_event.
- `getDashboardCounts(): Promise<{ finderCompletions: number; bundleViews: number }>` — runs two count queries for `FINDER_COMPLETED` and `BUNDLE_VIEWED` event types.

**Deliverable:** TypeScript compiles; uses repository functions from T07.

---

## Phase E — Route Handlers (depends on Phase D)

### T14 — Public route handlers
**Status:** `[x]` completed
**Requirements:** R3, R4, R5, R6
**Depends on:** T04, T08, T10, T13

Implement Express routers for public endpoints:
- `src/routes/health.ts` — `GET /api/health` → `{ status: 'UP' }`.
- `src/routes/generatedBundles.ts`:
  - `POST /` — parse + validate `BundleGenerationRequest` with Zod, call `bundleGeneration.generate()`, return 201.
  - `GET /:publicId` — call `generatedBundle.getByPublicId()`, return 200 or 404 ProblemDetail.
- `src/routes/analytics.ts` — `POST /events` — parse + validate `EventCaptureRequest` with Zod, call `analytics.recordEvent()`, return 201.

All routes call `next(err)` on errors so the error handler formats them correctly.

**Deliverable:** Manual curl / Insomnia test against `npm run dev` produces correct responses for all three route files.

---

### T15 — Admin route handlers
**Status:** `[x]` completed
**Requirements:** R7, R8, R9, R10
**Depends on:** T04, T05, T06, T07, T12, T13

Implement Express routers for admin endpoints (all protected by `basicAuth` middleware applied at router level):
- `src/routes/admin/products.ts` — all 12 product endpoints listed in requirements R7 and R8 (GET list, GET meta, POST create, PATCH inventory/active/pricing/category/upgrade-tier/age-range/details, DELETE, GET affinities, PUT affinities).
- `src/routes/admin/bundles.ts` — `GET /` and `GET /:publicId`.
- `src/routes/admin/dashboard.ts` — `GET /` (analytics counts) and `GET /product-coverage` (simulation).

The `GET /admin/api/products/meta` endpoint returns all valid enum values for categories, upgradeTiers, and formFactors (read from `types/enums.ts` — no DB query needed).

**Deliverable:** All admin endpoints tested manually with HTTP Basic credentials via curl; unauthorized requests return 401.

---

## Phase F — Integration Tests (depends on Phase E)

### T16 — Integration tests: public endpoints
**Status:** `[x]` completed
**Requirements:** R15 (AC15.2–AC15.5), R3, R4, R5, R6
**Depends on:** T14, T03

Write Vitest integration tests in `tests/integration/` using supertest against `createApp()`:
- `health.test.ts` — GET /api/health returns 200 with correct body.
- `generatedBundles.test.ts`:
  - POST with valid request returns 201 with correct response shape.
  - POST with missing fields returns 400 ProblemDetail.
  - POST with invalid enum returns 400 ProblemDetail.
  - POST triggering `BUDGET_TIER_NOT_FOUND` returns 422 with correct failureCode.
  - GET /:publicId with valid ID returns 200.
  - GET /:publicId with unknown ID returns 404.
- `analytics.test.ts`:
  - POST with valid body returns 201 with no body.
  - POST with missing eventType returns 400.

Tests must seed their own data in `beforeAll` and clean up in `afterAll`. No production data dependency.

**Deliverable:** `npm run test:integration` passes with a valid `DATABASE_URL`.

---

### T17 — Integration tests: admin endpoints
**Status:** `[x]` completed
**Requirements:** R15 (AC15.2–AC15.5), R7, R8, R9, R10
**Depends on:** T15, T03

Write Vitest integration tests for all admin endpoints:
- `admin.products.test.ts`:
  - Without auth → 401.
  - GET list → 200 with array.
  - POST create → 201 with server-computed retailPrice.
  - PATCH inventory, active, pricing, category, upgrade-tier, age-range, details → 200 each.
  - DELETE product with no bundle refs → 204.
  - DELETE product referenced by a bundle → 409.
  - GET/PUT affinities round-trip → correct data returned.
- `admin.bundles.test.ts`:
  - GET list → 200 with array (max 200, newest first).
  - GET by publicId (valid) → 200 with full detail.
  - GET by publicId (unknown) → 404.
- `admin.dashboard.test.ts`:
  - GET / → 200 with finderCompletions and bundleViews counts.
  - GET /product-coverage → 200 with simulation results (no DB writes occur).

**Deliverable:** `npm run test:integration` passes for all admin tests.

---

## Phase G — Infrastructure and CI/CD

### T18 — Serverless Framework config
**Status:** `[x]` completed
**Requirements:** R13 (AC13.1–AC13.5)
**Depends on:** T04

Create `infra/serverless.yml` matching design.md §2.13:
- Provider: aws, nodejs22.x, 512 MB, 30 s timeout, no VPC.
- HTTP API with `$default` catch-all and CORS config.
- Environment variables from `${env:*}` references.
- Function handler pointing to `../backend-node/dist/lambda.handler`.

Install `serverless` and `serverless-http` as appropriate packages.

**Deliverable:** `serverless print` (dry-run validation) completes without errors.

---

### T19 — GitHub Actions workflows
**Status:** `[x]` completed
**Requirements:** R14 (AC14.1–AC14.5)
**Depends on:** T01, T18

Create:
- `.github/workflows/ci.yml` — triggered on push and PR; runs `npm ci`, `npm run lint`, `npm run build`, `npm run test` in `backend-node/`. No secrets required.
- `.github/workflows/deploy.yml` — triggered on push to `main` after CI passes; runs build, `node-pg-migrate up`, `serverless deploy`. All secrets from GitHub Actions secrets (DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, CORS_ALLOWED_ORIGIN, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY). Migration step is a prerequisite for deploy step via `needs:`.

**Deliverable:** Both workflow files are syntactically valid YAML. A push to a branch triggers `ci.yml` and it passes.

---

## Phase H — End-to-End Validation

### T20 — Cold-start and smoke test on deployed Lambda
**Status:** `[ ]`
**Requirements:** R13 (AC13.4), R3 (AC3.3)
**Depends on:** T18, T19

After the first successful `serverless deploy`:
1. Invoke `GET /api/health` on the live API Gateway URL and confirm response within 500 ms (measure with `curl -w "%{time_total}"` or CloudWatch logs).
2. Invoke `POST /api/generated-bundles` with a known-good payload and confirm 201 response with correct shape.
3. Invoke an admin endpoint without credentials and confirm 401.
4. Invoke an admin endpoint with correct credentials and confirm 200.
5. Record actual cold-start time from CloudWatch Lambda logs (Init Duration) and confirm < 500 ms.

**Deliverable:** Written smoke-test results (pass/fail per step) documented in a comment on the relevant PR or in a `docs/deployment-validation.md` file.

---

## Dependency Graph Summary

```
T01 (scaffold)
 ├─ T02 (types)          ─────────────────────────────┐
 └─ T03 (DB + migrations)                             │
                                                      │
T02 + T03 → T04 (app factory + middleware)            │
T02 + T03 → T05 (products repo)                       │
T02 + T03 → T06 (affinities repo)                     │
T02 + T03 → T07 (other repos)                         │
                                                      │
T02 (only) → T08 (pure services)                      │
T08        → T09 (unit tests for pure services) ◄─────┘

T08 + T05 + T06 + T07 → T10 (bundle generation service)
T10                    → T11 (bundle generation unit tests)
T10                    → T12 (simulation service)
T07                    → T13 (analytics service)

T04 + T08 + T10 + T13 → T14 (public routes)
T04 + T05 + T06 + T07 + T12 + T13 → T15 (admin routes)

T14 + T03 → T16 (integration tests: public)
T15 + T03 → T17 (integration tests: admin)

T04       → T18 (serverless.yml)
T01 + T18 → T19 (GitHub Actions)
T18 + T19 → T20 (smoke test)
```

## Parallelism Opportunities

The following task groups can be executed in parallel once their dependencies are met:

| Parallel group | Tasks | Unblocked after |
|---|---|---|
| Group 1 | T02 + T03 | T01 |
| Group 2 | T04, T05, T06, T07 | T02 + T03 |
| Group 3 | T08 | T02 (can start before T03) |
| Group 4 | T09, T12, T13 | T08 / T10 / T07 respectively |
| Group 5 | T11 | T10 |
| Group 6 | T14, T15 | T04 + services |
| Group 7 | T16, T17 | T14/T15 + T03 |
| Group 8 | T18, T19 | T04 / T01+T18 |
