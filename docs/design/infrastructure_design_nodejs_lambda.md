# AWS Infrastructure Design — Node.js + Lambda + Supabase (No VPC)

## Why this architecture

- **Node.js** cold starts on Lambda are 100–300ms — fast enough to be imperceptible
- **No VPC** — Lambda outside a VPC has full internet access; no NAT Gateway or VPC Endpoints needed
- **Supabase** replaces RDS + RDS Proxy: managed PostgreSQL with a built-in connection pooler,
  accessible over a public TLS endpoint, no VPC or network configuration required

---

## Architecture Diagram

```
Route 53
  ├─► yourdomain.com / www ──► CloudFront ──► S3 (React static assets, private + OAC)
  └─► api.yourdomain.com   ──► API Gateway HTTP API
                                      │
                                      ▼
                             Lambda (Node.js 22, NO VPC)
                                      │
                                      ├─► Supabase (Postgres + built-in pooler, public TLS)
                                      ├─► S3 (product media)     — native access via IAM
                                      ├─► SES (email)            — native access via IAM
                                      └─► Secrets Manager        — native access via IAM

GitHub Actions ──► zip deploy to Lambda + S3 sync + CF invalidation
```

**No VPC. No NAT Gateway. No VPC Endpoints. No RDS. No RDS Proxy. No private subnets.**

---

## Domain Layout

| Subdomain | Points to |
|---|---|
| `yourdomain.com` | CloudFront distribution |
| `www.yourdomain.com` | CloudFront distribution |
| `api.yourdomain.com` | API Gateway HTTP API custom domain |

---

## Why No VPC

Lambda without a VPC attachment has full outbound internet access and can reach all AWS
services (Secrets Manager, SES, S3) via their public endpoints using IAM-signed requests.

A VPC is only needed when Lambda must access resources in a **private subnet** — such as an
RDS instance with no public endpoint. Since Supabase is a public TLS endpoint, there is
nothing in a private network to reach. The VPC adds no security benefit for Lambda calling
AWS services; IAM is the primary security control in both cases.

**Important:** RDS publicly accessible is NOT a safe alternative to Supabase for no-VPC Lambda.
Lambda outside a VPC has dynamic, unpredictable egress IPs — you cannot create a stable
security group IP allowlist for RDS. Supabase solves this by authenticating at the application
layer (username + password over TLS), the same model used by all other cloud-hosted Postgres
providers.

---

## Supabase — What It Is and How to Integrate

Supabase is a managed PostgreSQL platform. For this architecture it serves as a drop-in
replacement for RDS + RDS Proxy. It is fully PostgreSQL-compatible — existing SQL migrations
and standard `pg` / `postgres.js` drivers work unchanged.

### What comes with Supabase (relevant to this project)

| Feature | Relevant? | Notes |
|---|---|---|
| **PostgreSQL database** | ✅ Yes | Full Postgres, direct access, standard SQL |
| **Built-in connection pooler (Supavisor)** | ✅ Yes | Replaces RDS Proxy at no extra cost |
| **Studio dashboard** | ✅ Yes | Web UI to view tables, run queries, manage migrations |
| **Auth (GoTrue)** | No | Master plan uses custom admin auth, not Supabase Auth |
| **Storage** | No | Using S3 for product media |
| **Realtime** | No | Not needed for MVP |
| **Edge Functions** | No | Using Lambda |

### Connection types

Supabase provides three connection modes. **Use Transaction Mode for Lambda.**

| Mode | Port | Use case |
|---|---|---|
| Direct connection | 5432 | Persistent servers (VMs, containers) — NOT for Lambda |
| Session mode (Supavisor) | 5432 | IPv4 alternative to direct |
| **Transaction mode (Supavisor)** | **6543** | **Serverless / Lambda — use this** |

Transaction mode is designed for serverless functions that open many short-lived connections.
The pooler multiplexes them onto a small set of real database connections.

**Connection string for Lambda (transaction mode):**
```
postgres://postgres.[project-ref]:[password]@aws-[region].pooler.supabase.com:6543/postgres
```

**Critical:** Transaction mode does not support PostgreSQL prepared statements.
Configure your Node.js Postgres library to disable prepared statements:

```typescript
// Using postgres.js (recommended for Lambda)
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,   // required for Supavisor transaction mode
})

// Using node-postgres (pg)
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // pg does not use prepared statements by default — no extra config needed
})
```

### Connection reuse across warm Lambda invocations

Declare your DB client outside the handler so it persists across warm invocations:

```typescript
import postgres from 'postgres'
import serverlessHttp from 'serverless-http'
import app from './app'

// Created once per Lambda execution environment, reused on warm invocations
const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

// Pass sql into your app/request context however your framework handles it
export const handler = serverlessHttp(app)
```

### Database migrations

Supabase is standard PostgreSQL — use any Node.js migration tool:

- `node-pg-migrate` (recommended, simple)
- `db-migrate`
- `Knex` migrations
- Raw SQL files applied with `psql`

Migrations run as a **separate step in the CD pipeline** before the Lambda function is updated:

```yaml
# In GitHub Actions deploy.yml — runs before Lambda update
- name: Run migrations
  run: npx node-pg-migrate up
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}  # transaction mode URL
```

---

## Supabase Pricing

| Plan | Monthly cost | DB size | Connections (pooler) | Notes |
|---|---|---|---|---|
| **Free** | $0 | 500 MB | 200 | Pauses after 1 week inactivity; 2 projects max |
| **Pro** | $25 | 8 GB included (+$0.125/GB) | 200 (Micro compute) | Daily backups, no pause |
| Pro + Small compute | $25 + $15 = $40 | 8 GB | 400 | More connections + RAM |

**Recommended for MVP:** Pro plan at **$25/month** — no pausing in production, daily backups,
8 GB is ample for 200 products and 500 customers. Micro compute (included) has 200 pooler
connections, well above what this workload will ever need.

---

## New Files to Create

| File | Purpose |
|---|---|
| `backend/src/lambda.ts` | Lambda handler wrapping your Express/Fastify/Hono app |
| `.github/workflows/deploy.yml` | CD: migrate → zip deploy to Lambda → S3 sync → CF invalidation |

### Lambda entry point (Express example)

```typescript
import serverlessHttp from 'serverless-http'
import app from './app'

export const handler = serverlessHttp(app)
```

For Fastify use `@fastify/aws-lambda`. Your existing route handlers are unchanged.

### `.github/workflows/deploy.yml` (outline)

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci && npm run build
        working-directory: backend
      - name: Run DB migrations
        run: npx node-pg-migrate up
        working-directory: backend
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - name: Package Lambda
        run: zip -r function.zip dist/ node_modules/
        working-directory: backend
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      - name: Deploy Lambda
        run: aws lambda update-function-code
          --function-name ${{ secrets.LAMBDA_FUNCTION_NAME }}
          --zip-file fileb://backend/function.zip

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci && npm run build
        working-directory: frontend
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      - run: aws s3 sync frontend/dist/ s3://${{ secrets.S3_BUCKET }} --delete
      - run: aws cloudfront create-invalidation
          --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }}
          --paths "/*"
```

### GitHub secrets required

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
LAMBDA_FUNCTION_NAME        # e.g. goodiebag-api
S3_BUCKET                   # frontend bucket name
CF_DISTRIBUTION_ID
VITE_API_BASE_URL           # https://api.yourdomain.com
DATABASE_URL                # Supabase transaction mode connection string
```

---

## AWS Setup Order (one-time, manual)

### Step 1 — Supabase Project

1. Sign up at supabase.com → create a new project
2. Choose the AWS region closest to your users (e.g. `us-east-1`)
3. Set a strong database password — save it in AWS Secrets Manager
4. Upgrade to **Pro plan** before going live (prevents auto-pause)
5. Go to Project Settings → Database → Connection string → select **Transaction mode**
6. Copy the connection string — this is your `DATABASE_URL`

### Step 2 — ACM Certificates (free)

| Certificate | Region | Used by |
|---|---|---|
| `yourdomain.com` + `www.yourdomain.com` | **us-east-1** | CloudFront (must be us-east-1) |
| `api.yourdomain.com` | your deployment region | API Gateway custom domain |

Validation: DNS CNAME (ACM gives you the records to add — see DNS section).

### Step 3 — Secrets Manager

Store one secret `goodiebag/prod`:

```json
{
  "DATABASE_URL": "postgres://postgres.[ref]:[password]@aws-[region].pooler.supabase.com:6543/postgres",
  "CORS_ALLOWED_ORIGIN": "https://yourdomain.com",
  "ADMIN_USERNAME": "...",
  "ADMIN_PASSWORD": "...",
  "STRIPE_SECRET_KEY": "sk_live_...",
  "STRIPE_WEBHOOK_SECRET": "whsec_...",
  "SES_REGION": "us-east-1",
  "SES_FROM_EMAIL": "noreply@yourdomain.com"
}
```

### Step 4 — Lambda Function

- Runtime: Node.js 22.x
- Memory: 512 MB
- Timeout: 30 seconds
- **VPC: None** (leave blank — this is intentional)
- Environment variables: inject from Secrets Manager at cold start
- Function name: `goodiebag-api`

Lambda without VPC can reach Supabase, S3, SES, and Secrets Manager natively over HTTPS.

### Step 5 — API Gateway HTTP API

- Type: HTTP API (not REST API — cheaper and lower latency)
- Integration: Lambda proxy → `goodiebag-api`
- Routes: `$default` (catches all paths + methods, passes to Express/Fastify router)
- Custom domain: `api.yourdomain.com` with ACM cert
- CORS: set allowed origins to `https://yourdomain.com`
- Stripe webhooks: configure Stripe to POST to `https://api.yourdomain.com/api/webhooks/stripe`

### Step 6 — S3 + CloudFront (Frontend)

- S3 bucket: block all public access; CloudFront accesses via Origin Access Control (OAC)
- CloudFront:
  - Origin: S3 bucket with OAC
  - Alternate domains: `yourdomain.com`, `www.yourdomain.com`
  - ACM cert: the `us-east-1` cert covering both domains
  - Default root object: `index.html`
  - Custom error response: 404 → `/index.html`, status 200 (required for React Router)
  - HTTPS only, TLS 1.2+

### Step 7 — S3 Media Bucket

Separate bucket for product images:
- Lambda writes to it via IAM role (no public access needed unless images are served publicly)
- Optionally add as a second CloudFront origin at path `/media/*`

### Step 8 — IAM

**Lambda execution role** — allow:
- `secretsmanager:GetSecretValue` on `goodiebag/prod`
- `s3:PutObject`, `s3:GetObject` on the media bucket
- `ses:SendEmail` from your verified sender domain

**GitHub Actions IAM user** — allow:
- `lambda:UpdateFunctionCode`, `lambda:InvokeFunction` on `goodiebag-*`
- `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the frontend bucket
- `cloudfront:CreateInvalidation`

---

## DNS — Connecting GoDaddy Domain to AWS

### Option A — Delegate to Route 53 (Recommended)

Supports ALIAS records so your root domain (`yourdomain.com`) can point directly to CloudFront.

1. Route 53 → Hosted zones → Create hosted zone → `yourdomain.com`
2. AWS gives you 4 NS records
3. GoDaddy → DNS → Nameservers → Change → Enter my own → paste all 4 NS values
4. Propagation: up to 48 hours (usually under 1 hour)
5. Add records in Route 53:

| Record | Type | Value |
|---|---|---|
| `yourdomain.com` | A — ALIAS | CloudFront distribution |
| `www.yourdomain.com` | A — ALIAS | CloudFront distribution |
| `api.yourdomain.com` | A — ALIAS | API Gateway custom domain |
| ACM validation CNAMEs | CNAME | Provided by ACM during cert request |

### Option B — Keep GoDaddy DNS

| Name | Type | Value |
|---|---|---|
| `www` | CNAME | CloudFront domain (e.g. `d1abc.cloudfront.net`) |
| `api` | CNAME | API Gateway domain |
| ACM validation records | CNAME | Provided by ACM |

Limitation: cannot CNAME the root domain (`yourdomain.com`) — use GoDaddy URL forwarding
to redirect root → `www`, or use Option A (Route 53) to avoid this entirely.

---

## Key Configuration Notes

- **`VITE_API_BASE_URL`** — set to `https://api.yourdomain.com` at frontend build time
- **`CORS_ALLOWED_ORIGIN`** — set to `https://yourdomain.com` in Secrets Manager
- **Prepared statements** — must be disabled in your Postgres client (see connection section above)
- **Migrations** — run via GitHub Actions before Lambda deploy; Supabase Studio lets you verify
- **Stripe webhooks** — atomic idempotency required: store Stripe event ID with a unique DB
  constraint; check before processing to prevent double order transitions
- **Punch Pass redemption** — use DB-level atomic update:
  `UPDATE punch_pass SET used = true WHERE token = $1 AND used = false RETURNING id`
  This prevents double-redemption regardless of Lambda concurrency

---

## Cost Summary

| Service | Config | Est./month |
|---|---|---|
| Supabase Pro | 8 GB DB, daily backups | $25 |
| Lambda compute | 512 MB, 50k req/mo | ~$0 (free tier) |
| API Gateway HTTP API | 50k req/mo | ~$0 (free tier) |
| S3 + CloudFront (frontend) | low traffic | ~$2 |
| S3 (media bucket) | low traffic | ~$1 |
| SES | first 62k emails free | ~$0 |
| Secrets Manager | 1 secret | ~$0.40 |
| Route 53 | 1 hosted zone | ~$0.50 |
| ACM certificates | — | $0 |
| **Total** | | **~$29/month** |

### Comparison across all architectures

| Architecture | Monthly cost |
|---|---|
| Spring Boot + ECS Fargate + RDS | ~$86 |
| Node.js + Lambda + RDS (VPC + NAT Gateway) | ~$65 |
| Node.js + Lambda + RDS (VPC + Endpoints) | ~$51 |
| **Node.js + Lambda + Supabase (no VPC)** | **~$29** |

---

## Trade-offs

| Topic | Detail |
|---|---|
| **Cold starts** | 100–300ms on first request after idle; invisible at this scale. Add Provisioned Concurrency (~$3/mo) to eliminate entirely. |
| **Migrations** | Must run as a separate CD step before Lambda deploy (not automatic on startup like Flyway). Supabase Studio provides a web UI to verify. |
| **Prepared statements** | Must be disabled in your Postgres client for transaction mode pooler. |
| **Vendor dependency** | Supabase is a third-party service. Data lives on their hosted Postgres, not directly in your AWS account. Consider data export and backup policies. |
| **Atomic concurrency** | Punch Pass redemption and Stripe webhook idempotency must use DB-level atomic patterns — same requirement as any serverless architecture. |
| **Backend rewrite** | Switching from Spring Boot to Node.js means rewriting all existing backend code. This is the largest effort in this architecture change. |

---

## Verification Checklist

- [ ] Supabase project created, Pro plan active, migration history table populated
- [ ] `curl https://api.yourdomain.com/api/health` → `{"status":"UP"}`
- [ ] Open `https://yourdomain.com` → React app loads, no console errors
- [ ] Gift Finder flow completes → bundle renders with real data
- [ ] Admin login works at `https://yourdomain.com/admin`
- [ ] GitHub Actions deploy runs green on push to `main`
- [ ] HTTPS valid on `yourdomain.com` and `api.yourdomain.com`
- [ ] Confirmation email arrives via SES
- [ ] Stripe webhook received and idempotently processed
- [ ] Punch Pass double-scan rejected correctly
