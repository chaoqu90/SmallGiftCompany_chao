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

- No changes to the frontend React application for the core migration.
- No introduction of new authentication schemes (HTTP Basic admin auth is preserved as-is for admin endpoints).
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

---

## 6. Post-Migration Features

After the core platform migration was complete, the following business features were added on top of the Node.js backend.

### Feature 1 — Cart & Order Management
Adds a full shopping cart and order lifecycle on top of the existing bundle generation engine.

**Key decisions:**
- **No login required to shop** — cart is session-based, keyed by a `session_id` UUID (stored in `localStorage`, sent via `X-Session-Id` header on every cart request). No Supabase Auth session needed.
- **Deferred bundle persistence** — `generated_bundle` rows are only written to the DB when the user adds a bundle to the cart, not at generation time. Unsaved bundles are held in a server-side in-memory TTL cache (30 min). This eliminates orphan rows from users who generate but never buy.
- **Authenticated users get order history** — if a valid JWT is present at checkout, `user_id` is stored on the order and used to power the `/orders` history page. Anonymous users use a public order-search endpoint.
- **Immutable snapshot pattern preserved** — `generated_bundle` remains a pure recommendation engine output. Cart and order are separate lifecycle concerns with their own tables (`cart_item`, `customer_order`, `order_line_item`).
- **Gift bag choice at cart time** — users can select any active gift bag option when adding to cart, overriding the default pre-selected at generation time.

### Feature 2 — Stripe Payment & Order Confirmation
Adds end-to-end payment processing to convert cart items into confirmed orders.

**Key decisions:**
- **Two-phase Stripe flow** — `POST /api/checkout/intent` creates a Stripe Payment Intent and returns a `clientSecret`; the frontend confirms payment client-side via Stripe.js (`stripe.confirmPayment()`). The DB order is only created by the webhook after payment succeeds — never before.
- **Webhook-driven order creation** — `POST /api/webhooks/stripe` verifies the Stripe signature, reads checkout metadata from the Payment Intent, and atomically creates `customer_order` + `order_line_item` rows with status `CONFIRMED`. Idempotent: duplicate webhook delivery is safe.
- **All checkout metadata in Stripe** — `sessionId`, `email`, `name`, shipping address, and `userId` are stored as Payment Intent metadata so the webhook can create the order without any additional DB lookups or re-submission from the frontend.
- **Webhook requires raw body** — the Stripe webhook route is mounted before `express.json()` using `express.raw({ type: 'application/json' })` to preserve the raw body for signature verification.
- **SendGrid confirmation email** — sent after the webhook creates the order (outside the transaction); fails silently if `SENDGRID_API_KEY` is not set.
- **Public order search** — `GET /api/orders/search?orderNumber=&email=` requires both order public ID and email to return an order (no login required). The combination acts as proof of ownership.
- **Supabase Auth for optional login** — users can optionally sign in via Supabase (email magic link or password). Authenticated sessions attach `user_id` to bundles and orders. Auth is handled by Supabase; the backend only validates the JWT.

### Feature 3 — Product Image Upload (Admin)
Adds the ability for admins to attach a product image when creating a new product.

**Key decisions:**
- **Presigned S3 PUT URL pattern** — the browser uploads images directly to S3 without routing the file through Lambda. The admin calls `GET /admin/api/products/upload-image/presign?filename=&contentType=` to receive a short-lived (5-minute) presigned URL and the final public S3 URL. The browser then PUTs the file directly to S3 using the presigned URL, then passes `imageUrl` to `POST /admin/api/products/` as a regular JSON field.
- **Dedicated public S3 bucket** — a separate `ProductImagesBucket` (distinct from the private frontend `FrontendBucket`) is created with public `s3:GetObject` access and CORS configured for direct browser uploads (`PUT` from any origin). Images are served directly from `https://<bucket>.s3.amazonaws.com/<key>`.
- **UUID-keyed objects** — each uploaded image is stored at `product-images/<uuid>.<ext>`, preventing collisions and making filenames unpredictable.
- **`image_url` already existed in schema** — the `product` table already had an `image_url VARCHAR` column (from migration 001); no new migration is needed.
- **Upload is non-blocking** — image upload happens immediately when the admin selects a file (before clicking "Add Product"). If the upload fails, the product can still be saved without an image. The "Add Product" button is never blocked by image upload state.
- **Admin-only** — only the admin `AddProductDialog` exposes image upload. Customer-facing pages display images if present but no customer-side upload is needed.
