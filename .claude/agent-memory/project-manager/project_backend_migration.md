---
name: Project — backend-migration
description: Backend migration from Spring Boot/Java/local Postgres to Node.js/Lambda/Supabase; execution complete T01-T19 as of 2026-08-23; only T20 (smoke test on live Lambda) remains
type: project
---

Kickoff phase completed 2026-08-23. Feature spec phase (Phase 2) completed 2026-08-23. Execution phase (Phase 3) substantially complete 2026-08-23; T01-T19 all done.

**Why:** Reduce hosting cost from ~$86/month (Spring Boot + ECS + RDS) to ~$29/month (Node.js Lambda + Supabase). Frontend must require zero changes.

**How to apply:** Only T20 (cold-start and smoke test on deployed Lambda) remains — it is a human step requiring a live deploy. Prompt user to run `serverless deploy` from infra/ and execute the smoke test steps in tasks.md T20.

Key decisions confirmed by user (2026-08-23):
- Express 4.x HTTP framework (NOT Hono — user explicitly chose Express)
- Serverless Framework v4 for IaC (NOT AWS SAM — user explicitly chose Serverless Framework)
- postgres.js driver with prepare: false
- serverless-http to wrap Express for Lambda (no Lambda-specific code in app.ts)
- Zod validation
- node-pg-migrate for DB migrations
- Vitest for tests (unit via vitest, integration via vitest + supertest)
- ESM + esbuild bundle
- node-pg-migrate migrations in backend-node/migrations/ (3 files: baseline schema, seed data, analytics_event)

Spec files:
- specs/backend-migration/requirements.md — 15 requirements (R1–R15)
- specs/backend-migration/design.md — full technical design
- specs/backend-migration/tasks.md — 20 tasks (T01–T20); T01–T19 all [x] completed

Feature ID: FEAT-001
Agents used: backend-engineer (all implementation tasks)
Deviations from plan: none — all design.md decisions followed exactly

Key implementation notes for follow-up conversations:
- listAllActiveTemplates() was added to bundleTemplates repo (not in original design.md) — needed by dashboard simulation endpoint
- Integration test db helper at backend-node/tests/integration/helpers/db.ts provides seedGenerationProducts() and clean* utilities
- ADMIN-TEST-DELETE-001 SKU used in product delete test (not in TEST_PRODUCT_SKUS array — needs manual cleanup or add to cleanProducts call if test fails mid-run)

Open issues / T20 steps required by user:
1. Set GitHub Actions secrets: DATABASE_URL, CORS_ALLOWED_ORIGIN, ADMIN_USERNAME, ADMIN_PASSWORD, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
2. Run: cd infra && serverless deploy
3. Smoke test: GET /api/health, POST /api/generated-bundles, admin auth test, check CloudWatch Init Duration < 500ms
4. Document results in docs/deployment-validation.md
