---
name: Goodie Bag Platform — Project State
description: Core facts about the SmallGiftCompany_chao project: stack, repo layout, active features, and key decisions
type: project
---

**Project:** SmallGiftCompany_chao — Goodie Bag (children's party goodie-bag e-commerce platform)
**Production URL:** https://www.smallgift.shop

**Why:** E-commerce platform for parents/party planners to configure and order customized goodie bags for children's birthday parties.

**Stack:**
- Backend: Node.js 22 / TypeScript 5 / Express 4 / ESM / esbuild → AWS Lambda via Serverless Framework v3
- Frontend: React SPA (Vite + MUI + React Router) → S3 + CloudFront
- Database: Supabase PostgreSQL (transaction mode pooler, port 6543, `prepare: false` required)
- Auth (existing): HTTP Basic on `/admin/api/**`; no end-user auth yet
- Migrations: node-pg-migrate, runs in CI/CD before Lambda deploy

**Key repo paths:**
- Backend: `/Users/chaoqu90/work/SmallGiftCompany_chao/backend-node`
- Frontend: `/Users/chaoqu90/work/SmallGiftCompany_chao/frontend`
- Specs: `/Users/chaoqu90/work/SmallGiftCompany_chao/specs`
- Infra: `/Users/chaoqu90/work/SmallGiftCompany_chao/infra/serverless.yml`

**Golden copy specs:**
- `specs/tech-overview.md` — architecture decisions (frozen; changes require user confirmation)
- `specs/db-entities.md` — 15-table DB schema ER diagram

**Auth (FEAT-001 — user-management): EXECUTED 2026-08-31 — tests deferred**
- All implementation tasks T1–T9b completed. T10, T11, T12 deferred.
- Key new env vars required in GitHub before deploy:
  - Secret: `SUPABASE_JWT_SECRET`
  - Variable: `VITE_SUPABASE_URL`
  - Variable: `VITE_SUPABASE_ANON_KEY`
- Migration format: TypeScript `.ts` files using node-pg-migrate `MigrationBuilder` API.
- jose library added to backend for JWT verification (ESM-native).
- @supabase/supabase-js added to frontend.
- Open: T10 (JWT middleware tests), T11 (profile endpoint tests), T12 (smoke test) — need live Supabase env.

**How to apply:** When the user asks about feature status, FEAT-001 feature code is complete; tests remain to be written. Verify tasks.md for current status.
