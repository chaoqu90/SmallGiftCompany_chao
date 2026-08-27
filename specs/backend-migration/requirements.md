# FEAT-001 Backend Migration — Requirements

> Feature: Migrate the Goodie Bag backend from Java/Spring Boot to Node.js 22 / TypeScript / Express on AWS Lambda, backed by Supabase PostgreSQL, with full API parity and a GitHub Actions CI/CD pipeline.

---

## R1 — Project Scaffold and Local Development Environment

**User story:** As a developer, I want a Node.js/TypeScript project scaffold that I can run locally against a database, so that I can develop and test without needing a deployed Lambda.

### Acceptance Criteria

- AC1.1: WHEN a developer clones the repo and runs `npm ci` in `backend-node/`, THEN all dependencies install without errors.
- AC1.2: WHEN a developer runs `npm run dev`, THEN the Express server starts on port 8080 and responds to `GET /api/health` with `{"status": "UP"}`.
- AC1.3: WHEN `NODE_ENV=development`, THEN the server runs via `tsx` (no build step required) with hot reload on file changes.
- AC1.4: WHEN `NODE_ENV=production`, THEN the build produces a single ESM bundle in `dist/` via esbuild in under 10 seconds.
- AC1.5: WHEN the `DATABASE_URL` environment variable is set, THEN the postgres.js client connects to that URL; otherwise the app fails fast with a clear error at startup.
- AC1.6: The postgres.js client MUST be instantiated outside the Lambda handler function (module scope) so it is reused across warm invocations.
- AC1.7: The postgres.js client MUST be initialized with `prepare: false` (required for Supavisor transaction-mode pooler on port 6543).
- AC1.8: WHEN the project is scaffolded, THEN it includes `tsconfig.json` with `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"target": "ES2022"`, and strict mode enabled.

---

## R2 — Database Migrations

**User story:** As a developer/operator, I want the full database schema (equivalent to all 23 Flyway migrations V1–V23) expressed as node-pg-migrate migration files, so that I can set up a fresh Supabase PostgreSQL instance and reproduce the exact schema.

### Acceptance Criteria

- AC2.1: WHEN `npx node-pg-migrate up` is run against a blank PostgreSQL database, THEN it completes without errors and produces a schema that is structurally equivalent to the schema produced by running all 23 Flyway migrations.
- AC2.2: The migration files MUST cover all tables: `product`, `product_interest_affinity`, `product_audience_affinity`, `product_role_affinity`, `product_occasion`, `budget_tier`, `bundle_template`, `bundle_template_slot`, `bundle_template_slot_role`, `generated_bundle`, `generated_bundle_item`, `generated_bundle_upgrade`, `generated_bundle_gift_bag`, `gift_bag_option`, `analytics_event`.
- AC2.3: All columns, data types, constraints, indexes, and default values from the Spring Boot entity definitions MUST be represented in the migrations.
- AC2.4: WHEN `npx node-pg-migrate down` is run, THEN it rolls back cleanly (each migration has a down step).
- AC2.5: Migrations MUST NOT run on Lambda startup — they are run as a separate CI/CD step before Lambda deployment.
- AC2.6: Seed data for `budget_tier`, `bundle_template`, `bundle_template_slot`, `bundle_template_slot_role`, and `gift_bag_option` MUST be included as a separate seed migration (or script) equivalent to Flyway migrations V7–V9.

---

## R3 — Public API: Health Endpoint

**User story:** As a platform operator, I want a health check endpoint, so that infrastructure monitoring and load balancers can confirm the backend is running.

### Acceptance Criteria

- AC3.1: WHEN `GET /api/health` is called, THEN the response is `200 OK` with body `{"status": "UP"}` and `Content-Type: application/json`.
- AC3.2: The health endpoint requires no authentication.
- AC3.3: WHEN the Lambda cold-starts and receives `GET /api/health`, THEN the response is returned within 500 ms.

---

## R4 — Public API: Bundle Generation

**User story:** As a customer using the Gift Finder, I want to submit my child's age, interests, audience, party type, and budget, so that the system generates a personalized goodie bag bundle for me.

### Acceptance Criteria

- AC4.1: WHEN `POST /api/generated-bundles` is called with a valid `BundleGenerationRequest` body, THEN the system returns `201 Created` with a `GeneratedBundleResponse` body matching the Spring Boot response shape exactly.
- AC4.2: The request body MUST be validated against these constraints: `age` is required and between 3 and 12 (inclusive); `audiencePreference` is required and one of `FEMININE`, `MASCULINE`, `NO_PREFERENCE`; `interest` is required and one of `POP_MUSIC`, `TOYS_PLAY`, `CUTE_MAGICAL`, `SPORTS`, `READING_PUZZLE`; `partyType` is required and one of `CELEBRATION`, `HALLOWEEN`; `budgetTierCode` is required and between 2 and 10 characters; `maxRetailPrice` is optional (nullable).
- AC4.3: WHEN any required field is missing or invalid, THEN the response is `400 Bad Request` with an RFC 7807 `ProblemDetail` body: `type: "about:validation-error"`, `status: 400`, and a `detail` field describing the violation.
- AC4.4: WHEN `maxRetailPrice` is `null`, THEN the three-path algorithm selects products using PATH 1 (unconstrained): highest-scoring eligible product per slot with no budget ceiling.
- AC4.5: WHEN `maxRetailPrice` is provided, THEN the algorithm uses PATH 2 (constrained): reserves budget for the standard upgrade, then greedily fills slots within remaining budget with feasibility lookahead. WHEN no preference-filtered candidate fits a slot, THEN PATH 3 (tight fallback) drops interest/role preference filters while keeping the audience filter.
- AC4.6: Template selection MUST follow these rules exactly: age <= 5 selects `PRESCHOOL_4_ITEM`; age > 5 AND interest = `READING_PUZZLE` selects `READING_PUZZLE_4_ITEM` (fallback to `GENERAL_4_ITEM` if template not found); otherwise `GENERAL_4_ITEM`.
- AC4.7: Product scoring MUST use the formula `total = interestScore + audienceAdjustment + roleScore` where: `interestScore` is the weight from `product_interest_affinity` (0 if no row); `audienceAdjustment` is +15 for matching gender, +8 for UNIVERSAL, -5 for mismatched gender (using `max()` to prevent double-counting); `roleScore` is the best matching role weight × 20 / 100 (scaled 0–20).
- AC4.8: Product eligibility hard filters MUST exclude: inactive products, products outside the child's age range, products with zero inventory, products not matching the party type/occasion, and products with an incompatible audience affinity.
- AC4.9: The `retailPrice` field MUST be computed server-side from `cogAdjusted` using the tiered formula: cogAdjusted < $1.00 → fixed $0.50; $1.00–$3.99 → cogAdjusted / 2; $4.00–$9.99 → cogAdjusted / 3 + 2/3; >= $10.00 → cogAdjusted × 0.4. Browser-supplied prices are never trusted.
- AC4.10: All product affinities MUST be batch-loaded (one query per affinity type) at generation time and indexed in memory to prevent N+1 query patterns.
- AC4.11: WHEN bundle generation fails due to a domain constraint (e.g., insufficient products), THEN the response is `422 Unprocessable Entity` with `type: "about:bundle-generation-error"` and a `failureCode` field from the set: `INSUFFICIENT_ROLE_COVERAGE`, `NO_BUDGET_FEASIBLE`, `NO_ELIGIBLE_PRODUCTS`, `TEMPLATE_NOT_FOUND`, `BUDGET_TIER_NOT_FOUND`, `NO_GIFT_BAG_CONFIGURED`.
- AC4.12: WHEN a bundle is generated successfully, THEN it is persisted to the database as an immutable snapshot. The snapshot captures product name, SKU, cost, description, and form factor at generation time and is never back-filled when the catalog changes later.
- AC4.13: The generated bundle's `public_id` MUST follow the format `gb_<12-char-hex>` (e.g., `gb_a1b2c3d4e5f6`).

---

## R5 — Public API: Bundle Retrieval

**User story:** As a customer, I want to retrieve a previously generated bundle by its public ID, so that I can revisit or share my bundle.

### Acceptance Criteria

- AC5.1: WHEN `GET /api/generated-bundles/:publicId` is called with a valid `publicId`, THEN the response is `200 OK` with the same `GeneratedBundleResponse` shape as the generation response.
- AC5.2: WHEN the `publicId` does not exist, THEN the response is `404 Not Found` with an RFC 7807 `ProblemDetail` body.
- AC5.3: The retrieval endpoint requires no authentication.

---

## R6 — Public API: Analytics Event Capture

**User story:** As a business owner, I want to capture analytics events from the frontend (e.g., finder completed, bundle viewed), so that I can measure user engagement.

### Acceptance Criteria

- AC6.1: WHEN `POST /api/analytics/events` is called with a valid `EventCaptureRequest`, THEN the response is `201 Created` with no response body.
- AC6.2: The `eventType` field is required and must not be blank. `bundleId`, `sessionId`, and `metadataJson` are optional (nullable).
- AC6.3: Analytics events MUST be stored without a foreign key constraint to `generated_bundle` — the event's `bundle_id` is stored as a plain VARCHAR, not as a FK reference. This is intentional for survivability when bundles are deleted.
- AC6.4: WHEN `eventType` is missing or blank, THEN the response is `400 Bad Request` with an RFC 7807 `ProblemDetail` body.
- AC6.5: The analytics endpoint requires no authentication.

---

## R7 — Admin API: Product Management

**User story:** As a business owner, I want to manage my product catalog through the admin API (create, read, update, delete), so that I can keep the goodie bag offerings current.

### Acceptance Criteria

- AC7.1: All admin endpoints under `/admin/api/**` MUST require HTTP Basic authentication. Requests without a valid `Authorization: Basic <base64>` header matching `ADMIN_USERNAME` and `ADMIN_PASSWORD` MUST return `401 Unauthorized`.
- AC7.2: Credential comparison MUST use a constant-time string comparison to prevent timing attacks.
- AC7.3: WHEN `GET /admin/api/products/` is called with valid credentials, THEN the response is `200 OK` with an array of all products sorted by name.
- AC7.4: WHEN `GET /admin/api/products/meta` is called, THEN the response is `200 OK` with an object listing all valid enum values for `categories`, `upgradeTiers`, and `formFactors`.
- AC7.5: WHEN `POST /admin/api/products/` is called with a valid product payload, THEN the product is created with a server-computed `retailPrice` and the response is `201 Created` with the created product.
- AC7.6: WHEN `PATCH /admin/api/products/:id/inventory` is called with `{"inventoryQuantity": <int>}`, THEN the product's inventory is updated and `200 OK` is returned.
- AC7.7: WHEN `PATCH /admin/api/products/:id/active` is called with `{"active": <bool>}`, THEN the product's active flag is toggled and `200 OK` is returned.
- AC7.8: WHEN `PATCH /admin/api/products/:id/pricing` is called with `{"cost": <decimal>, "cogOverhead": <decimal>}`, THEN `cogAdjusted` and `retailPrice` are recomputed server-side and `200 OK` is returned.
- AC7.9: WHEN `PATCH /admin/api/products/:id/category`, `/upgrade-tier`, `/age-range`, or `/details` is called with valid data, THEN the respective fields are updated and `200 OK` is returned.
- AC7.10: WHEN `DELETE /admin/api/products/:id` is called for a product that is referenced by existing generated bundles, THEN the response is `409 Conflict`.
- AC7.11: WHEN `DELETE /admin/api/products/:id` is called for a product with no bundle references, THEN the product is deleted and `204 No Content` is returned.
- AC7.12: WHEN any admin product endpoint is called with an unknown product `id`, THEN the response is `404 Not Found`.

---

## R8 — Admin API: Product Affinity Management

**User story:** As a business owner, I want to view and replace the interest, audience, and role affinities for each product, so that the bundle generation algorithm scores products accurately.

### Acceptance Criteria

- AC8.1: WHEN `GET /admin/api/products/:id/affinities` is called, THEN the response is `200 OK` with all interest, audience, role affinities, and occasion tags for the product.
- AC8.2: WHEN `PUT /admin/api/products/:id/affinities` is called with a complete affinity payload, THEN all existing affinities for that product are replaced atomically (delete-then-insert within a transaction) and `200 OK` is returned.
- AC8.3: WHEN an affinity weight is outside the 0–100 range, THEN the response is `400 Bad Request`.

---

## R9 — Admin API: Bundle Listing and Detail

**User story:** As a business owner, I want to browse recently generated bundles, so that I can monitor what customers are creating.

### Acceptance Criteria

- AC9.1: WHEN `GET /admin/api/bundles/` is called, THEN the response is `200 OK` with an array of up to 200 most recent generated bundles, newest first.
- AC9.2: WHEN `GET /admin/api/bundles/:publicId` is called with a valid `publicId`, THEN the response is `200 OK` with the full bundle including items, upgrade, and gift bag snapshot.
- AC9.3: WHEN the `publicId` does not exist, THEN the response is `404 Not Found`.

---

## R10 — Admin API: Dashboard and Product Coverage Simulation

**User story:** As a business owner, I want a dashboard that shows key analytics counts and a product coverage simulation, so that I can see which products appear in bundles and how often.

### Acceptance Criteria

- AC10.1: WHEN `GET /admin/api/dashboard/` is called, THEN the response is `200 OK` with `finderCompletions` count (count of `FINDER_COMPLETED` analytics events) and `bundleViews` count (count of `BUNDLE_VIEWED` analytics events).
- AC10.2: WHEN `GET /admin/api/dashboard/product-coverage` is called, THEN the system runs a read-only simulation — iterating all combinations of age midpoints (3–5, 6–8, 9–12), interests, audience preferences, party types, and active budget tiers — without writing any data to the database, and returns which products appear in generated bundles and under which conditions.
- AC10.3: The product coverage simulation MUST mirror the constrained bundle generation logic exactly (same eligibility, scoring, and path selection) but perform no database writes.

---

## R11 — Error Handling

**User story:** As a frontend developer, I want all errors to use the same RFC 7807 `ProblemDetail` format as the Spring Boot backend, so that I can use the same error-handling code without changes.

### Acceptance Criteria

- AC11.1: ALL error responses MUST conform to the RFC 7807 `ProblemDetail` shape: `{ "type": string, "title": string, "status": number, "detail": string, "instance": string }`.
- AC11.2: Validation failures MUST return `400` with `type: "about:validation-error"`.
- AC11.3: Bundle generation failures MUST return `422` with `type: "about:bundle-generation-error"` and an additional `failureCode` property.
- AC11.4: All unhandled errors MUST return `500` with `type: "about:internal-error"`. Internal error details (stack traces) MUST NOT be included in the response body.
- AC11.5: The `instance` field MUST be set to the request path.

---

## R12 — CORS

**User story:** As a frontend developer, I want the backend to return correct CORS headers, so that the React SPA can call the API from a different origin without browser errors.

### Acceptance Criteria

- AC12.1: WHEN the API receives a CORS preflight (`OPTIONS`) request, THEN it responds with `200 OK` and the correct `Access-Control-*` headers.
- AC12.2: The `Access-Control-Allow-Origin` header MUST be set to the value of the `CORS_ALLOWED_ORIGIN` environment variable (not wildcard `*`).
- AC12.3: Allowed methods MUST include: GET, POST, PUT, PATCH, DELETE, OPTIONS.
- AC12.4: Allowed headers MUST be `*`.
- AC12.5: `Access-Control-Allow-Credentials` MUST be `false`.
- AC12.6: `Access-Control-Max-Age` MUST be `3600`.

---

## R13 — Lambda Packaging and Infrastructure as Code

**User story:** As an operator, I want the Node.js application packaged as an AWS Lambda function with Serverless Framework IaC, so that I can deploy and manage the backend without manual AWS console steps.

### Acceptance Criteria

- AC13.1: WHEN `serverless deploy` is run from `infra/`, THEN it creates or updates the Lambda function (`nodejs22.x`, 512 MB memory, 30 s timeout, no VPC) and an API Gateway HTTP API with a `$default` catch-all route.
- AC13.2: `serverless-http` MUST wrap the Express `app` as the Lambda handler in `lambda.ts`. The `app.ts` Express factory MUST have no Lambda-specific imports.
- AC13.3: All environment variables (`DATABASE_URL`, `CORS_ALLOWED_ORIGIN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NODE_ENV`) MUST be injected into the Lambda via the Serverless Framework config (sourced from environment or GitHub Actions secrets at deploy time).
- AC13.4: WHEN `GET /api/health` is called on the deployed Lambda immediately after a cold start, THEN the response arrives within 500 ms (cold-start target: 100–300 ms).
- AC13.5: The `serverless.yml` MUST be located in `infra/` and reference the built bundle in `backend-node/dist/`.

---

## R14 — CI/CD Pipeline

**User story:** As a developer, I want a GitHub Actions pipeline that automatically lints, tests, migrates, and deploys the backend on every push to `main`, so that the deployment process is reliable and requires no manual steps.

### Acceptance Criteria

- AC14.1: WHEN a pull request is opened or updated, THEN the `ci.yml` workflow runs: `npm ci`, `npm run lint`, `npm run build`, `npm run test` (unit tests only). The workflow MUST pass before merging.
- AC14.2: WHEN a commit is pushed to `main` and `ci.yml` passes, THEN the `deploy.yml` workflow runs: `npm ci`, `npm run build`, `npx node-pg-migrate up` (using the `DATABASE_URL` secret), `npx serverless deploy` (using `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets).
- AC14.3: WHEN the migration step fails, THEN the deploy step MUST NOT run.
- AC14.4: WHEN the build or test step fails, THEN neither migration nor deploy runs.
- AC14.5: All secrets (`DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CORS_ALLOWED_ORIGIN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) MUST be sourced from GitHub Actions repository secrets and MUST NOT be hardcoded in workflow files.

---

## R15 — Testing

**User story:** As a developer, I want a test suite covering services (unit) and all API endpoints (integration), so that I can confidently refactor and deploy without regressions.

### Acceptance Criteria

- AC15.1: Unit tests (Vitest) MUST cover all service and pure-function logic without a database: bundle generation paths (PATH 1, 2, 3), product eligibility filters, product scoring formula, retail price formula, template selection logic, upgrade selection logic.
- AC15.2: Integration tests (Vitest + supertest) MUST cover all public and admin endpoints against a real PostgreSQL instance (local or Supabase dev). Database mocks are prohibited.
- AC15.3: WHEN `npm run test` is run, THEN unit tests execute without any database dependency (no `DATABASE_URL` required).
- AC15.4: WHEN `npm run test:integration` is run with a valid `DATABASE_URL`, THEN all integration tests pass.
- AC15.5: Integration tests MUST use isolated seed data (inserted at test setup, cleaned up at teardown) and MUST NOT depend on production data.
- AC15.6: Test coverage of the three-path bundle generation algorithm MUST include: unconstrained path (PATH 1), constrained path within budget (PATH 2), constrained path triggering tight fallback (PATH 3), each `failureCode` scenario.
