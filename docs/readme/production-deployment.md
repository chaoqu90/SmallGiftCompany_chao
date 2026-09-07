# SmallGiftCompany -- Goodie Bag Platform

Children's goodie-bag e-commerce platform with dynamic bundle generation. Parents use a Gift Finder to specify age, interests, and budget; the backend generates a curated goodie bag from the product catalog using a three-path scoring algorithm.

| Component | Stack | Deployment Target |
|-----------|-------|-------------------|
| **Frontend** | React 19, Vite 8, MUI 6, TypeScript | AWS S3 + CloudFront (managed by Serverless Framework) |
| **Backend** | Node.js 22, Express 4, TypeScript (ESM) | AWS Lambda via Serverless Framework v4 |
| **Database** | PostgreSQL (Supabase, transaction-mode pooler) | Supabase managed instance |
| **CI/CD** | GitHub Actions | Automated on push to `main` |

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [Prerequisites](#2-prerequisites)
3. [Environment Variables Setup](#3-environment-variables-setup)
4. [Backend Deployment (AWS Lambda via Serverless Framework)](#4-backend-deployment-aws-lambda-via-serverless-framework)
5. [serverless.yml Explained](#5-serverlessyml-explained)
6. [Frontend Deployment](#6-frontend-deployment)
7. [Database Migration (Supabase PostgreSQL)](#7-database-migration-supabase-postgresql)
8. [Troubleshooting](#8-troubleshooting)
9. [Stripe & Email Setup (Production)](#9-stripe--email-setup-production)

---

## 1. Repository Structure

```
SmallGiftCompany/
  backend-node/            Node.js backend (TypeScript/ESM, Express on Lambda)
    src/
      app.ts               Express app factory (no Lambda-specific code)
      lambda.ts            Lambda handler entry point (wraps app via serverless-http)
      server.ts            Local dev server (listens on port 8080)
      db.ts                postgres.js singleton client (prepare: false for Supavisor)
      middleware/           Auth, CORS, error handler (RFC 7807)
      routes/              Express routers for public and admin endpoints
      services/            Business logic (bundle generation, scoring, pricing)
      repositories/        Raw SQL query functions (postgres.js tagged templates)
      types/               TypeScript types, enums, DTOs, error classes
    migrations/            node-pg-migrate SQL migration files
    tests/                 Unit and integration tests (Vitest)
    package.json           Scripts: dev, build, lint, test, migrate
    esbuild.config.js      Bundles src/ into dist/lambda.js for Lambda
  backend/                 Legacy Spring Boot backend (Java 21) -- being replaced
  frontend/                React SPA (Vite, MUI, React Router)
    src/                   Components, pages, API clients, theme
    dist/                  Production build output (vite build)
    vite.config.ts         Dev server proxies /api/* to localhost:8080
  infra/
    serverless.yml         Serverless Framework config (Lambda + API Gateway HTTP API)
  .github/
    workflows/
      ci.yml               Lint, build, unit test (on push and PR)
      deploy.yml           Migrate DB, build, deploy to Lambda (on push to main)
  docs/                    Architecture docs and design plans
  specs/                   Tech overview, feature requirements, designs, task plans
```

---

## 2. Prerequisites

Install the following tools before working with this project.

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22.x LTS | `brew install node@22` or [nodejs.org](https://nodejs.org/) |
| npm | Bundled with Node.js | Comes with Node.js |
| AWS CLI v2 | Latest | `brew install awscli` or [AWS docs](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| Serverless Framework | 4.x | `npm install -g serverless@4` |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) (for local PostgreSQL) |
| Git | Latest | `brew install git` |

Verify installations:

```bash
node --version    # v22.x.x
npm --version     # 10.x+
aws --version     # aws-cli/2.x.x
serverless --version  # Framework Core: 4.x.x
docker --version  # Docker version 2x.x.x
```

---

## 3. Environment Variables Setup

### 3.1 Full Variable Reference

| Variable | Description | Where to Set | Example Value |
|----------|-------------|--------------|---------------|
| `ADMIN_PASSWORD` | HTTP Basic auth password for `/admin/api/**` endpoints. | GitHub Secret | (strong password) |
| `ADMIN_USERNAME` | HTTP Basic auth username for `/admin/api/**` endpoints. | GitHub Secret | `admin` |
| `AWS_ACCESS_KEY_ID` | IAM user access key with Lambda, API Gateway, CloudFormation, S3, CloudFront, and CloudWatch Logs permissions. | GitHub Secret | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key. | GitHub Secret | (secret) |
| `CORS_ALLOWED_ORIGIN` | CloudFront domain for the frontend (e.g. `https://d1abc.cloudfront.net`). No wildcard. On first deploy, use a placeholder — see §4.1.1. | GitHub Secret | `https://d1abc123xyz.cloudfront.net` |
| `DATABASE_URL` | Supabase PostgreSQL connection string. Must use transaction-mode pooler (port 6543). | GitHub Secret | `postgres://postgres.abcdef:pw@aws-us-east-1.pooler.supabase.com:6543/postgres` |
| `EMAIL_FROM` | Verified sender address used in confirmation emails. Must be verified in AWS SES Identities. | GitHub Secret | `orders@smallgift.shop` |
| `FRONTEND_URL` | The public frontend URL, included in email confirmation links. | GitHub Secret | `https://www.smallgift.shop` |
| `SERVERLESS_ACCESS_KEY` | Serverless Framework access key from the Serverless Dashboard, used to authenticate `serverless deploy`. | GitHub Secret | (from Serverless Dashboard) |
| `STRIPE_SECRET_KEY` | Stripe secret API key. Use `sk_live_...` in production, `sk_test_...` for staging. | GitHub Secret | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for verifying Stripe webhook payloads. Get from Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret. | GitHub Secret | `whsec_...` |
| `SUPABASE_JWT_SECRET` | JWT secret for verifying Supabase Auth tokens. Found in: Supabase dashboard → Project Settings → API → JWT Secret. | GitHub Secret | (long random string) |
| `ACM_CERTIFICATE_ARN` | ARN of the ACM TLS certificate covering `www.smallgift.shop`. Must be issued in `us-east-1`. Not sensitive. | GitHub Variable | `arn:aws:acm:us-east-1:...` |
| `FRONTEND_DOMAIN` | The custom domain for the frontend. Passed to `serverless.yml` as the CloudFront `Aliases` entry. Not sensitive. | GitHub Variable | `www.smallgift.shop` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key, embedded into the frontend bundle at build time. Use `pk_live_...` in production. | GitHub Variable | `pk_live_...` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key, embedded into the frontend bundle at build time. Safe to expose in browser JS. | GitHub Variable | (from Supabase dashboard → Project Settings → API) |
| `VITE_SUPABASE_URL` | Supabase project URL, embedded into the frontend bundle at build time. | GitHub Variable | `https://xyzabc.supabase.co` |
| `VITE_API_BASE_URL` | The API Gateway URL, embedded into the frontend bundle at build time. Set automatically during CI/CD from CloudFormation outputs — do not set this as a GitHub Secret or Variable. | CI/CD only (auto from CloudFormation) | `https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com` |
| `PRODUCT_IMAGES_BUCKET` | S3 bucket name for product images. Injected automatically via `!Ref ProductImagesBucket` in `serverless.yml` — **do not set this manually**. | `serverless.yml` (automatic) | (CloudFormation-generated) |
| `NODE_ENV` | Runtime environment. Set automatically by `serverless.yml` to `production` for Lambda. | `serverless.yml` (automatic) | `production` |

### 3.2 GitHub Actions Secrets Setup

All secrets must be configured in the GitHub repository for the deploy pipeline to work.

1. Navigate to your repository on GitHub.
2. Click **Settings** (top menu bar).
3. In the left sidebar, click **Secrets and variables** then **Actions**.
4. Click **New repository secret**.
5. Add each of these secrets one at a time:

**Secrets** (Settings → Secrets and variables → Actions → **Secrets** tab):

| Secret Name | Value |
|-------------|-------|
| `ADMIN_PASSWORD` | Admin password for HTTP Basic auth |
| `ADMIN_USERNAME` | Admin username for HTTP Basic auth |
| `AWS_ACCESS_KEY_ID` | IAM access key ID |
| `AWS_SECRET_ACCESS_KEY` | IAM secret access key |
| `CORS_ALLOWED_ORIGIN` | `https://www.smallgift.shop` |
| `DATABASE_URL` | Supabase transaction-mode connection string (port 6543) |
| `EMAIL_FROM` | Verified sender address in AWS SES (e.g. `orders@smallgift.shop`) — see §9.5 |
| `FRONTEND_URL` | `https://www.smallgift.shop` |
| `SERVERLESS_ACCESS_KEY` | Serverless Framework access key (from Serverless Dashboard) |
| `STRIPE_SECRET_KEY` | Stripe live secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) — see §9.3 |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase dashboard → Project Settings → API → JWT Secret |

**Variables** (Settings → Secrets and variables → Actions → **Variables** tab — not sensitive, visible in workflow logs):

| Variable Name | Value |
|---------------|-------|
| `ACM_CERTIFICATE_ARN` | `arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERT_UUID` |
| `FRONTEND_DOMAIN` | `www.smallgift.shop` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe live publishable key (`pk_live_...`) — embedded in the frontend build |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (safe to embed in browser JS) |
| `VITE_SUPABASE_URL` | Supabase project URL (e.g. `https://xyzabc.supabase.co`) |

> **Note:** `VITE_API_BASE_URL` does **not** need to be set here. The deploy pipeline reads the API Gateway URL directly from CloudFormation outputs and passes it to the frontend build step automatically.

The deploy workflow references secrets via `${{ secrets.NAME }}` and variables via `${{ vars.NAME }}`.

---

## 4. Backend Deployment (AWS Lambda via Serverless Framework)

### 4.1 How CI/CD Works

Two GitHub Actions workflows handle continuous integration and deployment:

**`ci.yml`** -- triggers on every push and pull request to `main`:
1. Checks out code
2. Sets up Node.js 22
3. Runs `npm ci` + `npm run lint` + `npm run build` + `npm test` in `backend-node/`
4. Runs the same steps in `frontend/` in parallel

**`deploy.yml`** -- triggers on push to `main` only, two sequential jobs:

**Job 1 — deploy-backend:**
1. `npm ci` in `backend-node/`
2. `npm run migrate` — runs `node-pg-migrate up` against Supabase (`DATABASE_URL` secret)
3. `npm run build` — produces `dist/lambda.js`
4. `serverless deploy` from `infra/` — creates/updates Lambda, API Gateway, **S3 bucket, and CloudFront distribution**
5. Reads CloudFormation outputs (API URL, bucket name, CloudFront domain + distribution ID) and passes them to Job 2

**Job 2 — deploy-frontend** (runs after Job 1 succeeds):
1. `npm ci` + `VITE_API_BASE_URL=<api_url> npm run build` in `frontend/`
2. Uploads `index.html` to S3 with `no-cache` header
3. Syncs `assets/` to S3 with `max-age=31536000, immutable` (content-hashed by Vite)
4. Runs `aws cloudfront create-invalidation --paths "/*"` to bust the CDN cache

The migration step always runs before the Lambda deploy. If migrations fail, the entire pipeline stops.


### 4.2 Manual Deployment (from your local machine)

If you need to deploy without pushing to `main`:

```bash
# 1. Export required environment variables
export DATABASE_URL="postgres://postgres.yourproject:password@aws-us-east-1.pooler.supabase.com:6543/postgres"
export CORS_ALLOWED_ORIGIN="https://yourdomain.com"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your-password"

# 2. Configure AWS credentials
aws configure
# Enter your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY when prompted
# Set region to us-east-1

# 3. Install dependencies and build
cd backend-node
npm ci
npm run build

# 4. Run database migrations
npm run migrate

# 5. Deploy to Lambda
cd ../infra
serverless deploy --verbose
```

### 4.3 Verifying Deployment

After a successful deploy, the Serverless Framework prints the API Gateway endpoint URL. Use it to verify:

```bash
# 1. Health check
curl https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/api/health
# Expected: {"status":"UP"}

# 2. Admin endpoint (should return 401 without credentials)
curl https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/admin/api/products/
# Expected: 401 Unauthorized

# 3. Admin endpoint (with credentials)
curl -u admin:your-password https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/admin/api/products/
# Expected: 200 with JSON array

# 4. Check cold-start time in CloudWatch
# AWS Console -> CloudWatch -> Log groups -> /aws/lambda/goodiebag-backend-prod-app
# Look for "Init Duration" in the REPORT line of the first invocation
```

---

## 5. serverless.yml Explained

The file at `infra/serverless.yml` is the Serverless Framework configuration that defines all AWS resources for the backend.

### 5.1 What It Does

When you run `serverless deploy`, this file tells the Serverless Framework to:
1. Create (or update) a CloudFormation stack in AWS
2. Package the Lambda code (from `backend-node/dist/lambda.js`)
3. Upload it to an S3 deployment bucket
4. Create/update the Lambda function and API Gateway HTTP API

### 5.2 Section-by-Section Breakdown

**`service: goodiebag-backend`**
The service name. Becomes part of the CloudFormation stack name and Lambda function name (e.g., `goodiebag-backend-prod-app`).

**`frameworkVersion: '4'`**
Locks to Serverless Framework major version 4 to prevent breaking changes from v3 or future v5.

**`provider`**
Defines the cloud provider and runtime configuration:

| Setting | Value | Purpose |
|---------|-------|---------|
| `name` | `aws` | Deploy to AWS |
| `runtime` | `nodejs22.x` | Lambda Node.js 22 runtime |
| `region` | `us-east-1` | AWS region for all resources |
| `memorySize` | `512` | 512 MB RAM allocated to the Lambda function |
| `timeout` | `30` | Maximum execution time in seconds per request |

**`provider.httpApi.cors`**
Configures CORS at the API Gateway level (not in Express):

- `allowedOrigins`: reads from the `CORS_ALLOWED_ORIGIN` environment variable at deploy time
- `allowedMethods`: GET, POST, PUT, PATCH, DELETE, OPTIONS
- `allowedHeaders`: `*` (all headers)
- `allowCredentials`: `false`
- `maxAge`: `3600` seconds (1 hour browser cache for preflight)

**`provider.environment`**
Environment variables injected into the Lambda function. Each `${env:VAR_NAME}` reads from the shell environment at deploy time (set by GitHub Actions secrets or your local exports):

- `DATABASE_URL` — Supabase connection string
- `CORS_ALLOWED_ORIGIN` — allowed CORS origin
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — HTTP Basic auth credentials
- `SUPABASE_JWT_SECRET` — JWT signing secret for Supabase Auth verification
- `STRIPE_SECRET_KEY` — Stripe secret key (server-side only)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `EMAIL_FROM` — verified sender address in AWS SES
- `FRONTEND_URL` — public frontend URL for links in confirmation emails
- `NODE_ENV` — hardcoded to `production`

**`functions.app`**
Defines the single Lambda function:

- `handler: ../backend-node/dist/lambda.handler` -- points to the esbuild output; the `handler` export from `lambda.ts` wraps the Express app via `serverless-http`
- Two `httpApi` events create a catch-all route: `/{proxy+}` matches all paths with segments, and `/` matches the root. Together they forward every HTTP request to the Lambda function.

### 5.3 AWS Components Created

| AWS Resource | Console Location | Purpose |
|-------------|-----------------|---------|
| Lambda Function | Lambda > Functions > `goodiebag-backend-prod-app` | Runs the Express app |
| API Gateway HTTP API | API Gateway > APIs > `prod-goodiebag-backend` | Routes HTTP requests to Lambda |
| IAM Role | IAM > Roles > `goodiebag-backend-prod-...` | Execution role granting Lambda permission to write CloudWatch logs, send SES email, and sign presigned S3 URLs |
| CloudWatch Log Group | CloudWatch > Log groups > `/aws/lambda/goodiebag-backend-prod-app` | Lambda execution logs |
| S3 Deployment Bucket | S3 > `goodiebag-backend-prod-serverlessdeploymentbucket-...` | Stores deployment artifacts (Lambda zip files) — managed by Serverless Framework |
| **S3 Product Images Bucket** | **S3 > (CloudFormation-generated name)** | **Stores product images uploaded by admin. Publicly readable; CORS-enabled for direct browser PUT.** |
| **S3 Frontend Bucket** | **S3 > (CloudFormation-generated name)** | **Stores the React SPA static files** |
| **CloudFront OAC** | **CloudFront > Origin access > Controls** | **Allows CloudFront to securely read the private S3 bucket** |
| **CloudFront Distribution** | **CloudFront > Distributions** | **CDN serving the frontend globally over HTTPS** |
| CloudFormation Stack | CloudFormation > Stacks > `goodiebag-backend-prod` | Manages all the above as infrastructure-as-code |

### 5.4 Verifying Each Component in AWS Console

1. **Lambda Function**: AWS Console > Lambda > Functions. Search for `goodiebag-backend`. Check the Configuration tab for environment variables, memory, timeout.
2. **API Gateway**: AWS Console > API Gateway. Find `prod-goodiebag-backend`. Click Routes to see the catch-all. Click Stages to find the invoke URL.
3. **IAM Role**: AWS Console > IAM > Roles. Search for `goodiebag-backend`. Verify it has `AWSLambdaBasicExecutionRole`.
4. **CloudWatch Logs**: AWS Console > CloudWatch > Log groups > `/aws/lambda/goodiebag-backend-prod-app`. Look for `Init Duration` in REPORT lines for cold-start timing.
5. **Frontend S3 Bucket**: AWS Console > S3. Find the bucket named in the CloudFormation stack outputs (CloudFormation > Stacks > `goodiebag-backend-prod` > Outputs > `FrontendBucketName`). Confirm `index.html` and `assets/` are present after a frontend deploy.
6. **CloudFront Distribution**: AWS Console > CloudFront > Distributions. Find the distribution (Status: `Deployed`). The Domain Name column shows your frontend URL. Click into it and check the Origins tab (should point to the S3 bucket) and Behaviors tab (index.html → CachingDisabled, default → CachingOptimized).
7. **Product Images S3 Bucket**: AWS Console > S3. Find the bucket named in the CloudFormation stack outputs (`ProductImagesBucketName`). Confirm public read is enabled and CORS is configured. Product images uploaded via the admin panel will appear here under the `product-images/` prefix.
8. **CloudFormation Stack**: AWS Console > CloudFormation > Stacks > `goodiebag-backend-prod`. Check Outputs tab for all five exported values (ApiGatewayUrl, FrontendBucketName, CloudFrontDomainName, CloudFrontDistributionId, ProductImagesBucketName).

---

## 6. Frontend Deployment (S3 + CloudFront + www.smallgift.shop)

The frontend is deployed as a static React SPA to a private S3 bucket served through CloudFront at `https://www.smallgift.shop`. The S3 bucket, CloudFront distribution, and custom domain wiring are all managed by `infra/serverless.yml`.

### 6.1 How It Works

```
User browser
    │ HTTPS (www.smallgift.shop)
    ▼
CloudFront Distribution  (custom domain + ACM TLS cert)
    │ sigv4 (OAC)
    ▼
Private S3 Bucket  (frontend/dist/ contents)
```

- All HTTP traffic redirects to HTTPS at the CloudFront edge.
- S3 is never directly accessible — only CloudFront reads it via OAC.
- SPA routing: 403/404 responses from S3 are rewritten to `index.html` / HTTP 200 so React Router handles client-side routes.
- `index.html` is served with `no-cache` — users always get the latest version after a deploy.
- `assets/` files are served with `max-age=31536000, immutable` — safe because Vite content-hashes all asset filenames.

### 6.2 One-Time Setup: ACM Certificate + GoDaddy DNS

This must be done **once before the first deploy**. After this, all future deploys are fully automated.

#### Step 1 — Request an ACM certificate (AWS Console)

> ACM certificates for CloudFront **must** be in `us-east-1`, regardless of where your Lambda runs.

1. Open AWS Console → **Certificate Manager** → switch region to **US East (N. Virginia)** (`us-east-1`).
2. Click **Request a certificate** → **Request a public certificate** → Next.
3. Enter `www.smallgift.shop` in the domain name field.
4. Select **DNS validation** → click **Request**.
5. On the certificate detail page, expand the domain and copy the **CNAME name** and **CNAME value** shown under "Domains". You will need these in Step 2.
6. Wait for the certificate status to change to **Issued** (after adding the DNS record in Step 2). This usually takes 2–5 minutes.
7. Copy the **Certificate ARN** (shown at the top of the certificate detail page). It looks like:
   ```
   arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

#### Step 2 — Add DNS records in GoDaddy

You need to add **two CNAME records** in GoDaddy:

1. Log in to [GoDaddy](https://www.godaddy.com) → **My Products** → find `smallgift.shop` → **DNS**.
2. Click **Add New Record** and add the **ACM validation CNAME** (from Step 1):

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | CNAME | `_acme-challenge.www` (use the exact Name from ACM — strip `.smallgift.shop.` from the end) | The CNAME value from ACM | 600 |

3. After the first deploy completes (Step 4), add the **CloudFront routing CNAME**:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | CNAME | `www` | The `CloudFrontDomainName` output (e.g., `d1abc123xyz.cloudfront.net`) | 600 |

   > The CloudFront domain is printed in the deploy pipeline logs under "Read CloudFormation stack outputs", or you can find it in AWS Console → CloudFront → Distributions → your distribution → Domain name.

#### Step 3 — Set GitHub Variables

In your GitHub repo → **Settings → Secrets and variables → Actions → Variables** tab:

| Variable | Value |
|----------|-------|
| `FRONTEND_DOMAIN` | `www.smallgift.shop` |
| `ACM_CERTIFICATE_ARN` | The ARN from Step 1 |

#### Step 4 — Deploy

Push to `main` (or re-run the deploy workflow). The pipeline:
1. Creates/updates the CloudFront distribution with your domain and certificate
2. Builds and uploads the React SPA to S3
3. Invalidates the CDN cache

After the pipeline completes, `https://www.smallgift.shop` is live.

### 6.3 Automated Deployment (CI/CD)

All subsequent deploys are fully automated on every push to `main`. See Section 4.1 for the full pipeline description.

### 6.4 Manual Deployment

If you need to deploy the frontend without pushing to `main`:

```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export FRONTEND_DOMAIN="www.smallgift.shop"
export ACM_CERTIFICATE_ARN="arn:aws:acm:us-east-1:..."

# Get the API Gateway URL, bucket name, and distribution ID from CloudFormation
STACK_OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name goodiebag-backend-prod \
  --query 'Stacks[0].Outputs' --output json)

API_URL=$(echo "$STACK_OUTPUTS" | jq -r '.[] | select(.OutputKey=="ApiGatewayUrl") | .OutputValue')
BUCKET=$(echo "$STACK_OUTPUTS"  | jq -r '.[] | select(.OutputKey=="FrontendBucketName") | .OutputValue')
CF_ID=$(echo "$STACK_OUTPUTS"   | jq -r '.[] | select(.OutputKey=="CloudFrontDistributionId") | .OutputValue')

# Build
cd frontend
npm ci
VITE_API_BASE_URL="$API_URL" npm run build

# Upload
aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"
aws s3 sync dist/ s3://$BUCKET/ \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

# Invalidate CDN
aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*"
```

### 6.5 Verifying the Deployment

```bash
# App loads over custom domain
curl -I https://www.smallgift.shop
# Expected: HTTP/2 200

# SPA routing works (deep links don't 404)
curl -I https://www.smallgift.shop/some/deep/route
# Expected: HTTP/2 200
```

---

## 7. Database Migration (Supabase PostgreSQL)

**Note:** Supabase integration is not yet complete. This section is the setup guide for when it is connected. The migration files exist in `backend-node/migrations/` and the CI/CD pipeline is configured, but no Supabase project has been provisioned yet.

### 7.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New Project**.
3. Choose an organization, set a project name (e.g., `goodiebag-prod`), set a strong database password, and select the **US East (N. Virginia)** region to match the Lambda region (`us-east-1`).
4. Click **Create new project** and wait for provisioning (about 1 minute).

### 7.2 Get the DATABASE_URL Connection String

1. In the Supabase dashboard, go to **Settings** (gear icon) > **Database**.
2. Scroll to **Connection string** section.
3. Select the **URI** tab.
4. Copy the **Transaction** mode connection string (port `6543`). It looks like:

```
postgres://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Important:** You must use port `6543` (transaction mode), not `5432` (session mode). The `postgres.js` driver is configured with `prepare: false`, which is required for Supavisor transaction-mode pooling. Session mode (port 5432) will also work but does not pool connections, which is problematic for Lambda's concurrent execution model.

### 7.3 Configure the Connection String

**GitHub Secret:**

Follow the steps in [Section 3.2](#32-github-actions-secrets-setup) to add `DATABASE_URL` as a repository secret.

### 7.4 Run Migrations Manually

```bash
cd backend-node

# Ensure DATABASE_URL is set in your environment
export DATABASE_URL="postgres://postgres.yourprojectref:yourpassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Roll back the last migration (if needed)
npm run migrate:down
```

`node-pg-migrate` reads `DATABASE_URL` from the environment. It uses the `pg` driver (not `postgres.js`) and tracks applied migrations in a `pgmigrations` table.

### 7.5 Migrations in CI/CD

In the deploy pipeline (`.github/workflows/deploy.yml`), migrations run automatically before the Lambda deploy:

```
Step 4: npm run migrate   (node-pg-migrate up, using DATABASE_URL from GitHub Secrets)
Step 5: npm run build
Step 6-8: serverless deploy
```

If a migration fails, the pipeline stops and the Lambda is not updated. This ensures the database schema and application code stay in sync.

### 7.6 Verify the Schema

After running migrations:

1. Open the Supabase dashboard for your project.
2. Click **Table Editor** in the left sidebar.
3. You should see these tables: `product`, `product_interest_affinity`, `product_audience_affinity`, `product_role_affinity`, `product_occasion`, `budget_tier`, `bundle_template`, `bundle_template_slot`, `bundle_template_slot_role`, `gift_bag_option`, `generated_bundle`, `generated_bundle_item`, `generated_bundle_upgrade`, `generated_bundle_gift_bag`, `analytics_event`, `pgmigrations`.
4. Click **budget_tier** and **bundle_template** to verify that seed data was inserted by the `002_seed_reference_data` migration.

Alternatively, use the Supabase SQL Editor:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

### 7.7 Migration Files

| File | Purpose |
|------|---------|
| `001_baseline_schema.ts` | Creates all application tables (product, affinities, templates, bundles, etc.) |
| `002_seed_reference_data.ts` | Inserts budget tiers, bundle templates, template slots, slot roles, gift bag options |
| `003_analytics_event.ts` | Creates the analytics_event table with indexes |

---

## 8. Troubleshooting

### Lambda Cold Start is Slow

- Check the `Init Duration` in CloudWatch logs (`/aws/lambda/goodiebag-backend-prod-app`). Target is under 500 ms.
- The esbuild single-file bundle (`dist/lambda.js`) minimizes module loading time. If cold starts exceed 500 ms, check if `node_modules` are being packaged (they should not be -- esbuild bundles everything).
- Consider using Lambda Provisioned Concurrency if cold starts are unacceptable for your use case (adds cost).

### CORS Errors in the Browser

- Verify `CORS_ALLOWED_ORIGIN` is set correctly in the Lambda environment variables. It must exactly match the origin the browser sends (including protocol and port, no trailing slash).
- Check the API Gateway CORS configuration: AWS Console > API Gateway > your API > CORS.

### Missing Environment Variables

- **In Lambda:** AWS Console > Lambda > your function > Configuration > Environment variables. All five variables (`DATABASE_URL`, `CORS_ALLOWED_ORIGIN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NODE_ENV`) must be present.
- **In GitHub Actions:** Repository Settings > Secrets and variables > Actions. All six secrets must be set (the five above plus `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`).

### Database Migration Failures

- **"relation already exists"**: The migration has already been applied. Run `npm run migrate:status` to check which migrations have run.
- **Connection refused**: Verify `DATABASE_URL` is correct and uses port `6543` (transaction mode) for Supabase.
- **"prepared statement does not exist"**: You are connecting to Supavisor transaction mode but using a client without `prepare: false`. The `node-pg-migrate` tool uses the `pg` driver which does not have this issue, but if you connect with another tool, ensure prepared statements are disabled.
- **Rollback a failed migration**: Run `npm run migrate:down` to reverse the last applied migration, fix the issue, then run `npm run migrate` again.

### Deploy Fails in GitHub Actions

- Check the Actions tab in GitHub for the failed run. Click into the failed step for logs.
- **"ServerlessError: ... credentials"**: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets are missing or incorrect.
- **"Unable to resolve ... DATABASE_URL"**: The `DATABASE_URL` secret is not set in GitHub repository secrets.
- **Migration step fails**: The database may be unreachable from GitHub Actions runners. Ensure your Supabase project allows connections from any IP (Supabase allows this by default on the pooler endpoint).

### Admin Endpoints Return 401

- Admin endpoints require HTTP Basic auth. Pass credentials with `-u username:password` in curl or set the `Authorization: Basic <base64>` header.
- Verify `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set correctly in the Lambda environment variables.

### Frontend Build Fails

- Run `npm ci` to ensure dependencies are installed with the exact lockfile versions.
- The frontend requires Node.js 22. Check with `node --version`.
- TypeScript errors: Run `npx tsc --noEmit` to see type errors without building.

### Stripe webhook returns 400 in production

- The webhook endpoint must receive the **raw** request body (not JSON-parsed). This is handled correctly in `app.ts` — the `/api/webhooks/stripe` route is mounted with `express.raw()` before `express.json()`. Do not reorder these middleware registrations.
- Verify `STRIPE_WEBHOOK_SECRET` in the Lambda environment matches the signing secret shown in Stripe Dashboard → Developers → Webhooks → your endpoint. Rotating the secret in Stripe requires updating the Lambda env var and redeploying.

### Stripe payment succeeds but no order created

- Check CloudWatch logs for `[webhook]` entries. A missing or incorrect `STRIPE_WEBHOOK_SECRET` causes 400 responses and Stripe retries for 72 hours.
- Confirm the webhook endpoint URL is registered in Stripe Dashboard and listens for `payment_intent.succeeded`.
- Check for `CART_EMPTY` errors — if the cart session was already cleared (duplicate webhook delivery), `confirmOrder` returns null and no order is re-created (this is correct behaviour).

### Confirmation email not sent

- Confirm `EMAIL_FROM` is a verified identity in AWS SES (SES → Verified identities).
- Confirm SES is out of sandbox mode (SES → Account dashboard) — sandbox only allows sending to verified addresses.
- Confirm the Lambda execution role has `ses:SendEmail` in its IAM policy (`infra/serverless.yml`).
- Check CloudWatch logs for `[email] Failed to send` entries. Email errors are logged but do not cause the webhook to return 5xx (Stripe would retry indefinitely otherwise).

---

## 9. Stripe & Email Setup (Production)

This section covers all manual one-time steps required to enable live payments and order confirmation emails.

---

### 9.1 Create and Configure a Stripe Account

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) and sign up or log in.
2. Complete your **business profile**: Settings → Business details. Fill in your legal name, address, and business type. Stripe requires this before activating live mode.
3. Add a **bank account** for payouts: Settings → Payouts → Add bank account.
4. Once your account is activated, toggle from **Test mode** to **Live mode** using the switch in the top-left of the dashboard.

### 9.2 Get Live API Keys

Stripe Dashboard (live mode) → **Developers → API keys**:

| Key | Where to use | GitHub Secret name |
|-----|--------------|--------------------|
| **Publishable key** (`pk_live_...`) | Frontend build (`VITE_STRIPE_PUBLISHABLE_KEY`) | `VITE_STRIPE_PUBLISHABLE_KEY` |
| **Secret key** (`sk_live_...`) | Lambda backend (`STRIPE_SECRET_KEY`) | `STRIPE_SECRET_KEY` |

> Never commit these keys to git. Never expose the secret key in the frontend.

### 9.3 Register the Production Webhook Endpoint

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Set the **Endpoint URL**:
   ```
   https://YOUR-API-GATEWAY-ID.execute-api.us-east-1.amazonaws.com/api/webhooks/stripe
   ```
   Or, if using a custom domain wired to API Gateway:
   ```
   https://api.smallgift.shop/api/webhooks/stripe
   ```
3. Under **Events to send**, select:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Click **Add endpoint**.
5. On the endpoint detail page, click **Reveal** under **Signing secret**.
6. Copy the `whsec_...` value → add to GitHub as the `STRIPE_WEBHOOK_SECRET` secret.

> After adding the secret to GitHub, trigger a new deploy (or manually update the Lambda environment variable in AWS Console → Lambda → your function → Configuration → Environment variables) so the backend picks it up.

### 9.4 Apple Pay Domain Verification

Apple Pay on the web requires that your domain is registered with Apple through Stripe. This is a one-time setup per domain.

**Step 1 — Register the domain in Stripe**

1. Stripe Dashboard → **Settings → Payment methods → Apple Pay**.
2. Click **Add new domain**.
3. Enter `www.smallgift.shop` and click **Add**.
4. Stripe generates a verification file for you to host at a well-known URL.

**Step 2 — Download and host the verification file**

1. Download the file from the Stripe dashboard (it has no extension).
2. Rename it to `apple-developer-merchantid-domain-association` (no extension).
3. Place it in: `backend-node/public/.well-known/apple-developer-merchantid-domain-association`
4. Commit and push — the backend serves this path via `express.static('public/.well-known')` (registered in `app.ts`).
5. Verify it is accessible at:
   ```
   https://www.smallgift.shop/.well-known/apple-developer-merchantid-domain-association
   ```

**Step 3 — Complete verification in Stripe**

Click **Verify domain** in the Stripe dashboard after hosting the file. The button may take a minute to show as verified.

> Apple Pay only appears in Safari on macOS and iOS when the device has a card on file in Apple Wallet. The Stripe Payment Element handles this automatically — no additional frontend code is needed.

### 9.5 Configure AWS SES for Confirmation Emails

The backend uses AWS SES (Simple Email Service) via the Lambda execution role — no separate API key or vendor account is needed.

**Step 1 — Exit the SES sandbox**

New AWS accounts start in SES sandbox mode, which only allows sending to verified addresses. Submit a one-time production access request:

1. AWS Console → **SES** → **Account dashboard** → **Request production access**.
2. Fill in your use case (transactional order confirmation emails, estimated volume).
3. AWS reviews and approves within a few hours to one business day.

**Step 2 — Verify your sender identity**

Emails fail silently unless the `EMAIL_FROM` address is verified in SES.

- Option A — **Email address verification** (quick, for testing):
  1. SES → **Verified identities** → **Create identity** → select **Email address**.
  2. Enter your `EMAIL_FROM` address (e.g. `orders@smallgift.shop`).
  3. Click the verification link sent to that address.

- Option B — **Domain verification** (recommended for production, improves deliverability):
  1. SES → **Verified identities** → **Create identity** → select **Domain**.
  2. Enter your domain (`smallgift.shop`).
  3. SES generates DNS records (CNAME entries for DKIM).
  4. Add those records in GoDaddy: **DNS → Add New Record** for each CNAME.
  5. Verification completes automatically after DNS propagation (usually minutes, up to 48 hours).

**Step 3 — Grant the Lambda role `ses:SendEmail`**

Add the following to the IAM role policy in `infra/serverless.yml` under `provider.iam.role.statements`:

```yaml
- Effect: Allow
  Action:
    - ses:SendEmail
  Resource: "*"
```

This allows the Lambda function to send email via SES without any additional credentials.

### 9.6 Product Image Storage (S3)

Product images are uploaded by the admin directly from the browser to a dedicated S3 bucket (`ProductImagesBucket`) using presigned PUT URLs. No extra setup is needed beyond deploying the stack — the bucket, its CORS policy, and the Lambda IAM permissions are all created automatically by `infra/serverless.yml`.

**How it works in production:**

1. Admin opens **Add Product** in the admin panel and selects an image file.
2. The browser calls `GET /admin/api/products/upload-image/presign` — the Lambda generates a 5-minute presigned S3 PUT URL and returns it with the final public image URL.
3. The browser PUTs the image directly to S3 (the file never passes through Lambda).
4. On successful upload, the image URL is embedded in the `POST /admin/api/products/` request as `imageUrl`.

**Verifying in production:**

```bash
# Check the bucket name from CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name goodiebag-backend-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`ProductImagesBucketName`].OutputValue' \
  --output text

# List uploaded images
aws s3 ls s3://<bucket-name>/product-images/

# Verify a specific image is publicly accessible
curl -I https://<bucket-name>.s3.amazonaws.com/product-images/<uuid>.jpg
# Expected: HTTP/1.1 200 OK
```

**IAM permissions (already in `serverless.yml`):**

```yaml
- Effect: Allow
  Action:
    - s3:PutObject
    - s3:PutObjectAcl
  Resource: !Sub 'arn:aws:s3:::${ProductImagesBucket}/*'
```

No additional AWS Console configuration is needed.

### 9.7 Test Live Payments End-to-End

After deploying with all secrets set:

1. **Create a test order** using a real (low-value) card. Stripe charges in live mode — use a small cart total.
2. **Verify in Stripe Dashboard** → Payments — the payment should appear as "Succeeded".
3. **Verify in CloudWatch** → Log groups → `/aws/lambda/goodiebag-backend-prod-app` — look for `[webhook] Order confirmed for payment intent: pi_xxx`.
4. **Verify the order** was created: use the order search at `https://www.smallgift.shop/orders/search` with the email address used at checkout.
5. **Verify the confirmation email** arrived in the inbox with the correct order number and line items.
6. **Verify in Stripe Dashboard** → Developers → Webhooks → your endpoint → Recent deliveries — the `payment_intent.succeeded` event should show **200** as the response code.

### 9.8 Switching from Test to Live (checklist)

Before going live, ensure:

- [ ] Stripe account fully activated (business details + bank account completed)
- [ ] Stripe live mode API keys in GitHub Secrets (`STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`)
- [ ] Stripe production webhook endpoint registered and `STRIPE_WEBHOOK_SECRET` updated
- [ ] Apple Pay domain verified (§9.4)
- [ ] SES production access granted (sandbox exited) — §9.5
- [ ] SES sender identity verified for `EMAIL_FROM` address/domain — §9.5
- [ ] `ses:SendEmail` added to Lambda IAM role policy — §9.5
- [ ] `EMAIL_FROM` set in GitHub Secrets to the verified sender address
- [ ] `FRONTEND_URL` set to `https://www.smallgift.shop`
- [ ] A successful end-to-end test order placed (§9.6)
- [ ] `CORS_ALLOWED_ORIGIN` set to `https://www.smallgift.shop` (no trailing slash)
