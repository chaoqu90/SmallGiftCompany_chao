# Project Overview — Goodie Bag Backend Migration

## 1. Project Summary

**SmallGiftCompany** operates a children's goodie-bag e-commerce platform. The existing backend is a fully-implemented Spring Boot 4 / Java 21 modular monolith backed by a local PostgreSQL database. The business goal of this migration is to reduce hosting cost from ~$86/month to ~$29/month while retaining full functional parity and preparing the system for future growth.

The migration converts:
- **Runtime:** Java/Spring Boot → Node.js 22 (ESM, TypeScript)
- **Hosting model:** Always-on JVM process → AWS Lambda (serverless, pay-per-invocation)
- **Database:** Self-managed local PostgreSQL → Supabase PostgreSQL (managed, built-in connection pooling via Supavisor in transaction mode)
- **HTTP routing:** Spring API Gateway HTTP API proxy → Lambda function URL via API Gateway HTTP API

Frontend clients (React/Vite SPA) must require **zero changes** — all existing API endpoint paths, HTTP methods, request shapes, response shapes, and error formats are preserved exactly.

## 2. Goals

- Full functional parity with the existing Spring Boot backend across all public and admin endpoints.
- Node.js ESM runtime on AWS Lambda with cold-start time under 500 ms (target: 100–300 ms).
- Supabase PostgreSQL as the database, using transaction-mode pooler (port 6543) for Lambda compatibility.
- Infrastructure-as-code (AWS SAM or Serverless Framework) covering the Lambda function and API Gateway HTTP API.
- GitHub Actions CI/CD pipeline: lint → test → migrate → deploy to Lambda.
- Local development parity: developers can run the Node.js backend locally against a local or Supabase dev database.

## 3. Target Users

- **End customers:** Visitors who use the Gift Finder, browse bundles, and (in future phases) check out. Their experience is delivered by the React frontend; the backend must respond within acceptable latency limits under API Gateway + Lambda.
- **Business owner / admin:** Uses the `/admin/api` endpoints to manage products, view bundles, and monitor the analytics dashboard.
- **Developers:** The team building and maintaining the codebase. They need clear local dev setup, reproducible tests, and a reliable CI/CD pipeline.

## 4. Non-Goals (for this migration)

- No new business features — this is a pure platform migration.
- No changes to the frontend React application.
- No introduction of new authentication schemes (HTTP Basic admin auth is preserved as-is).
- No Stripe, SES, or Punch Pass features — those belong to later phases of the master plan and are not part of this backend's current scope.
- No GraphQL — REST API is preserved unchanged.
- No MongoDB — Supabase PostgreSQL is the target database.

## 5. Prioritized MVPs

### MVP 1 — Node.js App Core + Public API Parity (highest priority)
Scaffold the Node.js/TypeScript application with ESM modules, implement all four public endpoints (`GET /api/health`, `POST /api/generated-bundles`, `GET /api/generated-bundles/:publicId`, `POST /api/analytics/events`) with full business logic (bundle generation algorithm, product eligibility, scoring, upgrade selection, gift bag selection), and connect to Supabase PostgreSQL. All existing public API contracts are preserved. The app runs locally and passes integration tests against a real Supabase (or local PostgreSQL) database.

### MVP 2 — Admin API Parity
Implement all admin endpoints under `/admin/api` (product CRUD, affinity management, bundle listing, dashboard analytics, product coverage simulation) with HTTP Basic authentication. Admin operations are functionally equivalent to the Spring Boot implementation. Integration tests cover all admin endpoints.

### MVP 3 — Database Migration Script
Translate all 23 Flyway SQL migrations (V1–V23) into an equivalent Node.js migration tool script (node-pg-migrate or equivalent) that can be run against Supabase PostgreSQL. The migration history is clean and idempotent. The final schema is byte-for-byte equivalent to what the Flyway migrations produce.

### MVP 4 — Lambda Packaging + Infrastructure as Code
Package the Node.js application as an AWS Lambda function (Node.js 22.x runtime, 512 MB memory, 30 s timeout, no VPC). Provide infrastructure-as-code (AWS SAM template or Serverless Framework config) that defines the Lambda function and API Gateway HTTP API with a `$default` catch-all route. Cold start time is validated to be under 500 ms.

### MVP 5 — CI/CD Pipeline
GitHub Actions workflow that on push to `main`: installs dependencies, runs linting and tests, runs database migrations against Supabase, packages the Lambda zip, and deploys via `aws lambda update-function-code`. Secrets are injected from GitHub Actions secrets. Deployment is gated on passing tests and a successful migration run.
