# Tech Overview — Goodie Bag Backend Migration

> This document is the **golden copy** of all technical decisions for the backend migration.
> All feature designs must conform to this document. Changes require explicit user confirmation.

---

## 1. Runtime and Language

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5 | Type safety, IDE tooling, compatibility with the existing frontend team's skills |
| Module system | ESM (`"type": "module"` in package.json) | Required for optimal Lambda tree-shaking and cold-start performance |
| Node.js version | 22.x (LTS) | Matches the Lambda runtime `nodejs22.x`; native fetch, no polyfills needed |
| Build tool | `esbuild` (via `esbuild` CLI or `tsx` for local dev) | Sub-second TypeScript compilation; produces a single ESM bundle for Lambda |
| Package manager | `npm` | Consistent with the existing repo conventions |

---

## 2. HTTP Framework

**Choice: Express** (version 4.x)

Rationale:
- Familiar, well-understood framework; the team has existing Express experience.
- Excellent ecosystem for middleware, routing, and error handling.
- Works with `serverless-http` to wrap the Express app as a Lambda handler with zero code changes between local and Lambda environments.
- Mature, stable API — no surprise breaking changes between minor versions.
- Extensive community examples and StackOverflow coverage for onboarding new developers.

All route paths and HTTP methods must exactly match the existing Spring Boot contract (see Section 7).

---

## 3. Database

**Choice: Supabase PostgreSQL with `postgres.js` driver**

| Decision | Choice | Rationale |
|---|---|---|
| Database platform | Supabase PostgreSQL (Pro plan) | Managed Postgres, built-in connection pooler (Supavisor), no VPC required |
| Connection mode | Transaction mode (port 6543) | Required for serverless/Lambda; multiplexes short-lived connections |
| Driver | `postgres` (postgres.js) | Minimal overhead, ESM-native, explicit `prepare: false` for transaction mode |
| Migration tool | `node-pg-migrate` | Simple, SQL-first, CLI-driven; runs as a separate CD step before Lambda deploy |
| ORM/Query builder | None — raw SQL via postgres.js tagged templates | Avoids ORM overhead; keeps bundle size small; SQL is already well-understood from Flyway migrations |

**Critical constraints:**
- `prepare: false` MUST be set on the `postgres()` client — Supavisor transaction mode does not support prepared statements.
- The DB client MUST be initialized outside the Lambda handler so it is reused across warm invocations.
- Migrations run as a separate GitHub Actions step before the Lambda deploy step — they do NOT run on Lambda startup.

---

## 4. Validation

**Choice: Zod**

All request body validation uses Zod schemas that exactly replicate the Bean Validation constraints from the Spring Boot DTOs. Validation errors return HTTP 400 with the same RFC 7807 `ProblemDetail` shape as the Spring Boot `GlobalExceptionHandler`.

---

## 5. Authentication

HTTP Basic authentication is preserved for all `/admin/api/**` endpoints.

- Credentials are read from environment variables `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- An Express middleware decodes the `Authorization: Basic <base64>` header and compares against env vars using a constant-time comparison.
- Public endpoints (`/api/**`) require no authentication.
- Session management is stateless (no cookies, no JWT).

---

## 6. Error Handling

All errors return RFC 7807 `ProblemDetail` JSON, matching the Spring Boot `GlobalExceptionHandler` format exactly:

```json
{
  "type": "about:validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "...",
  "instance": "/api/generated-bundles"
}
```

Error type URIs:
| Condition | HTTP Status | `type` |
|---|---|---|
| Request validation failure | 400 | `about:validation-error` |
| Bundle generation failure | 422 | `about:bundle-generation-error` (+ `failureCode` property) |
| Unhandled error | 500 | `about:internal-error` |

`BundleGenerationException` `failureCode` values (preserved from Java enum):
`INSUFFICIENT_ROLE_COVERAGE`, `NO_BUDGET_FEASIBLE`, `NO_ELIGIBLE_PRODUCTS`, `TEMPLATE_NOT_FOUND`, `BUDGET_TIER_NOT_FOUND`, `NO_GIFT_BAG_CONFIGURED`

---

## 7. API Contract (frozen — must not change)

### Public Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | None |
| POST | `/api/generated-bundles` | None |
| GET | `/api/generated-bundles/:publicId` | None |
| POST | `/api/analytics/events` | None |

### Admin Endpoints (HTTP Basic, role ADMIN)

| Method | Path |
|---|---|
| GET | `/admin/api/products/` |
| GET | `/admin/api/products/meta` |
| POST | `/admin/api/products/` |
| PATCH | `/admin/api/products/:id/inventory` |
| PATCH | `/admin/api/products/:id/active` |
| PATCH | `/admin/api/products/:id/pricing` |
| PATCH | `/admin/api/products/:id/category` |
| PATCH | `/admin/api/products/:id/upgrade-tier` |
| PATCH | `/admin/api/products/:id/age-range` |
| PATCH | `/admin/api/products/:id/details` |
| DELETE | `/admin/api/products/:id` |
| GET | `/admin/api/products/:id/affinities` |
| PUT | `/admin/api/products/:id/affinities` |
| GET | `/admin/api/bundles/` |
| GET | `/admin/api/bundles/:publicId` |
| GET | `/admin/api/dashboard/` |
| GET | `/admin/api/dashboard/product-coverage` |

---

## 8. Business Logic (preserved exactly from Spring Boot)

The following algorithms are ported exactly — no behavioral changes:

### 8.1 Bundle Generation (Three-Path Algorithm)
- **PATH 1 (Unconstrained):** `maxRetailPrice == null` → picks highest-scoring eligible product per template slot, no budget ceiling.
- **PATH 2 (Constrained):** `maxRetailPrice != null` → reserves budget for standard upgrade, greedy slot selection with feasibility lookahead.
- **PATH 3 (Tight fallback):** within PATH 2, when no preference-filtered candidate fits a slot, drops interest/role preference filters while keeping audience filter.

### 8.2 Template Selection
- Age <= 5 → `PRESCHOOL_4_ITEM`
- Age > 5 AND Interest = `READING_PUZZLE` → `READING_PUZZLE_4_ITEM` (fallback to `GENERAL_4_ITEM`)
- Otherwise → `GENERAL_4_ITEM`

### 8.3 Scoring Formula
```
total = interestScore + audienceAdjustment + roleScore
```
- `interestScore`: weight (0–100) from `product_interest_affinity` for requested interest; 0 if no row.
- `audienceAdjustment`: matching gender +15, UNIVERSAL +8, mismatched gender −5; `max()` prevents double-count.
- `roleScore`: best matching role weight × 20 / 100 (scaled 0–20).

### 8.4 Retail Price Formula (server-side only — never trust browser prices)
| cogAdjusted Range | Formula |
|---|---|
| < $1.00 | Fixed $0.50 |
| $1.00–$3.99 | cogAdjusted / 2 |
| $4.00–$9.99 | cogAdjusted / 3 + 2/3 |
| >= $10.00 | cogAdjusted × 0.4 |

### 8.5 Affinity Loading
All product affinities are loaded in batch (one query per affinity type) at generation time, then indexed in memory. This prevents N+1 query patterns on Lambda.

### 8.6 Immutable Snapshot Pattern
Generated bundles persist point-in-time snapshots of product data (name, SKU, cost, description, form factor) at generation time. Snapshots are never back-filled when the catalog changes.

---

## 9. Project Layout

```
/
  backend-node/              New Node.js backend (replaces backend/)
    src/
      app.ts                 Express app factory (no Lambda-specific imports)
      lambda.ts              Lambda handler entry point (wraps app via serverless-http)
      server.ts              Local dev server entry point
      db.ts                  postgres.js client (singleton, initialized outside handler)
      middleware/
        auth.ts              HTTP Basic auth middleware
        errorHandler.ts      RFC 7807 error response middleware
      routes/
        health.ts
        generatedBundles.ts
        analytics.ts
        admin/
          products.ts
          bundles.ts
          dashboard.ts
      services/
        bundleGeneration.ts
        productEligibility.ts
        productScoring.ts
        bundleTemplateSelector.ts
        upgradeGeneration.ts
        bundleSimulation.ts
        generatedBundle.ts
        analytics.ts
      repositories/          Raw SQL query functions per domain
        products.ts
        budgetTiers.ts
        bundleTemplates.ts
        giftBagOptions.ts
        generatedBundles.ts
        affinities.ts
      types/                 Shared TypeScript types and enums
        enums.ts
        entities.ts
        dtos.ts
    migrations/              node-pg-migrate SQL migration files
    tests/
      integration/
      unit/
    package.json
    tsconfig.json
    esbuild.config.js
  infra/
    serverless.yml           Serverless Framework config (Lambda + API Gateway HTTP API)
  .github/
    workflows/
      ci.yml                 Lint, test
      deploy.yml             Migrate, package, deploy to Lambda
  specs/                     (this directory)
```

---

## 10. Infrastructure as Code

**Choice: Serverless Framework** (v3.x)

Everything is declared in `infra/serverless.yml` — a single CloudFormation stack manages both backend and frontend infrastructure.

### Backend
- `provider: aws`, `runtime: nodejs22.x`, 512 MB memory, 30 s timeout, no VPC.
- Single function (`app`) with an `httpApi` event using a `$default` catch-all route (HTTP API, not REST API).
- Environment variables injected from GitHub Actions secrets at deploy time via `${env:*}`.
- CORS configured at the API Gateway HTTP API level: allowed origin = `CORS_ALLOWED_ORIGIN` env var.
- `serverless-http` wraps the Express app as the Lambda handler — zero code difference between local and Lambda.

### Frontend
- **S3 bucket** (private, all public access blocked) — stores the Vite build output.
- **CloudFront Origin Access Control (OAC)** — modern sigv4-based access from CloudFront to the private S3 bucket.
- **S3 Bucket Policy** — grants only the CloudFront distribution read access via OAC.
- **CloudFront Distribution** — HTTPS-only (HTTP redirects), SPA routing (403/404 → index.html/200), `PriceClass_100` (US/Canada/Europe).
  - `/index.html` → CachingDisabled policy (always fresh after deploy)
  - `/assets/*` → CachingOptimized policy (1-year browser cache; Vite content-hashes all asset filenames)
  - Custom domain `www.smallgift.shop` via `Aliases` + ACM certificate
  - `MinimumProtocolVersion: TLSv1.2_2021`, `SslSupportMethod: sni-only`

### Custom Domain
- **Domain**: `www.smallgift.shop` (registered on GoDaddy)
- **TLS certificate**: AWS ACM, issued in `us-east-1` (CloudFront requirement regardless of Lambda region), DNS-validated
- **DNS**: GoDaddy CNAME record `www` → CloudFront raw domain (e.g., `d1abc.cloudfront.net`)
- **CORS**: `CORS_ALLOWED_ORIGIN` = `https://www.smallgift.shop` (known upfront — no bootstrapping needed)
- **Configuration**: domain and certificate ARN passed as GitHub Actions **Variables** (not secrets — they are not sensitive):
  - `FRONTEND_DOMAIN` = `www.smallgift.shop`
  - `ACM_CERTIFICATE_ARN` = `arn:aws:acm:us-east-1:ACCOUNT:certificate/UUID`
  - Read in `serverless.yml` via `${env:FRONTEND_DOMAIN}` and `${env:ACM_CERTIFICATE_ARN}`

### CloudFormation Outputs (consumed by the deploy workflow)
| Output Key | Value |
|---|---|
| `ApiGatewayUrl` | The API Gateway HTTP API endpoint (used as `VITE_API_BASE_URL` at build time) |
| `FrontendBucketName` | S3 bucket name (used by `aws s3 sync`) |
| `CloudFrontDomainName` | CloudFront raw domain — use as CNAME target in GoDaddy DNS |
| `CloudFrontDistributionId` | Distribution ID (used by `aws cloudfront create-invalidation`) |

---

## 11. CI/CD Pipeline (GitHub Actions)

### ci.yml (on every push and PR)
1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. `npm run test` (unit tests only; no DB required)

### deploy.yml (on push to `main`, after ci passes)

**Job 1 — deploy-backend:**
1. `npm ci` (backend-node)
2. `npm run migrate` (node-pg-migrate up — runs against Supabase)
3. `npm run build` (esbuild → dist/lambda.js)
4. `serverless deploy` (Lambda + API Gateway + S3 bucket + CloudFront distribution)
5. Read CloudFormation outputs (API URL, bucket name, CF domain, CF distribution ID) → job outputs

**Job 2 — deploy-frontend** (runs after Job 1):
1. `npm ci` (frontend)
2. `VITE_API_BASE_URL=<api_url> npm run build` (Vite embeds the API URL at build time)
3. `aws s3 cp index.html` with `no-cache` header
4. `aws s3 sync assets/` with `max-age=31536000, immutable` header
5. `aws cloudfront create-invalidation --paths "/*"` (CDN cache bust)

---

## 12. Environment Variables

### GitHub Actions Secrets
| Secret | Purpose |
|---|---|
| `DATABASE_URL` | Supabase transaction mode connection string (port 6543) |
| `CORS_ALLOWED_ORIGIN` | `https://www.smallgift.shop` — single allowed CORS origin for API Gateway |
| `ADMIN_USERNAME` | HTTP Basic admin username |
| `ADMIN_PASSWORD` | HTTP Basic admin password (plaintext) |
| `AWS_ACCESS_KEY_ID` | IAM access key (Lambda, API GW, S3, CloudFront, CloudFormation) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |

### GitHub Actions Variables (non-sensitive, visible in logs)
| Variable | Purpose |
|---|---|
| `FRONTEND_DOMAIN` | `www.smallgift.shop` — CloudFront `Aliases` entry and custom domain |
| `ACM_CERTIFICATE_ARN` | ARN of the ACM certificate in `us-east-1` covering `www.smallgift.shop` |

### Lambda Environment (set by serverless.yml)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Injected from secret at deploy time |
| `CORS_ALLOWED_ORIGIN` | Injected from secret at deploy time |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Injected from secrets at deploy time |
| `NODE_ENV` | Hardcoded to `production` in serverless.yml |

---

## 13. Testing Strategy

| Test type | Tool | Scope |
|---|---|---|
| Unit tests | Vitest | Services and pure functions (scoring, eligibility, pricing formula, template selection) — no DB |
| Integration tests | Vitest + real PostgreSQL | Route handlers via `supertest` against a local/test PostgreSQL instance; covers all endpoints |
| No mocked DB in integration tests | — | DB mocks mask schema mismatches; always use a real PostgreSQL instance |

---

## 14. CORS Configuration

- Allowed origin: single configurable origin via `CORS_ALLOWED_ORIGIN` env var (not wildcard).
- Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS.
- Allowed headers: `*`.
- Credentials: `false`.
- Max age: 3600 seconds.

---

## 15. Key Constraints Summary

1. The `postgres.js` client must have `prepare: false` (Supavisor transaction mode requirement).
2. The DB client must be initialized outside the Lambda handler (cold-start reuse).
3. Migrations run in CI/CD, not on Lambda startup.
4. No prepared statements or session-mode PostgreSQL features.
5. All prices are computed server-side — browser-supplied prices are never trusted.
6. Admin endpoints are protected by HTTP Basic auth with constant-time credential comparison.
7. Bundle snapshot fields are copied at generation time and never mutated.
8. Analytics events have no foreign key to `generated_bundle` (intentional for survivability).
