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
8. [Local Development](#8-local-development)
9. [Troubleshooting](#9-troubleshooting)

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
| `DATABASE_URL` | Supabase PostgreSQL connection string. Must use transaction-mode pooler (port 6543). | GitHub Secret + local `.env` | `postgres://postgres.abcdef:pw@aws-us-east-1.pooler.supabase.com:6543/postgres` |
| `CORS_ALLOWED_ORIGIN` | CloudFront domain for the frontend (e.g. `https://d1abc.cloudfront.net`). No wildcard. On first deploy, use a placeholder — see §4.1.1. | GitHub Secret + local `.env` | `https://d1abc123xyz.cloudfront.net` |
| `ADMIN_USERNAME` | HTTP Basic auth username for `/admin/api/**` endpoints. | GitHub Secret + local `.env` | `admin` |
| `ADMIN_PASSWORD` | HTTP Basic auth password for `/admin/api/**` endpoints. | GitHub Secret + local `.env` | (strong password) |
| `VITE_API_BASE_URL` | The API Gateway URL, embedded into the frontend bundle at build time by Vite. In CI/CD this is read automatically from CloudFormation outputs — **you do not need to set this as a GitHub Secret or Variable**. For local dev, set it in `frontend/.env` (already configured to `http://localhost:8080`). | Local `frontend/.env` only | `http://localhost:8080` (local) |
| `FRONTEND_DOMAIN` | The custom domain for the frontend. Passed to `serverless.yml` as the CloudFront `Aliases` entry. Not sensitive. | GitHub **Variable** (not secret) | `www.smallgift.shop` |
| `ACM_CERTIFICATE_ARN` | ARN of the ACM TLS certificate covering `www.smallgift.shop`. Must be issued in `us-east-1`. Not sensitive. | GitHub **Variable** (not secret) | `arn:aws:acm:us-east-1:...` |
| `NODE_ENV` | Runtime environment. Set automatically by serverless.yml for Lambda. | `serverless.yml` (prod), local `.env` (dev) | `production` or `development` |
| `AWS_ACCESS_KEY_ID` | IAM user access key with Lambda, API Gateway, CloudFormation, S3, CloudFront, and CloudWatch Logs permissions. | GitHub Secret only | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key. | GitHub Secret only | (secret) |

### 3.2 Local Setup

```bash
cd backend-node
cp .env.example .env
# Edit .env with your values (see table above)
```

### 3.3 GitHub Actions Secrets Setup

All secrets must be configured in the GitHub repository for the deploy pipeline to work.

1. Navigate to your repository on GitHub.
2. Click **Settings** (top menu bar).
3. In the left sidebar, click **Secrets and variables** then **Actions**.
4. Click **New repository secret**.
5. Add each of these secrets one at a time:

**Secrets** (Settings → Secrets and variables → Actions → **Secrets** tab):

| Secret Name | Value |
|-------------|-------|
| `DATABASE_URL` | Your Supabase transaction-mode connection string (port 6543) |
| `CORS_ALLOWED_ORIGIN` | `https://www.smallgift.shop` |
| `ADMIN_USERNAME` | Admin username for HTTP Basic auth |
| `ADMIN_PASSWORD` | Admin password for HTTP Basic auth |
| `AWS_ACCESS_KEY_ID` | IAM access key ID |
| `AWS_SECRET_ACCESS_KEY` | IAM secret access key |

**Variables** (Settings → Secrets and variables → Actions → **Variables** tab — these are not sensitive and are visible in workflow logs):

| Variable Name | Value |
|---------------|-------|
| `FRONTEND_DOMAIN` | `www.smallgift.shop` |
| `ACM_CERTIFICATE_ARN` | `arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERT_UUID` |

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

- `DATABASE_URL` -- Supabase connection string
- `CORS_ALLOWED_ORIGIN` -- allowed CORS origin
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` -- HTTP Basic auth credentials
- `NODE_ENV` -- hardcoded to `production`

**`functions.app`**
Defines the single Lambda function:

- `handler: ../backend-node/dist/lambda.handler` -- points to the esbuild output; the `handler` export from `lambda.ts` wraps the Express app via `serverless-http`
- Two `httpApi` events create a catch-all route: `/{proxy+}` matches all paths with segments, and `/` matches the root. Together they forward every HTTP request to the Lambda function.

### 5.3 AWS Components Created

| AWS Resource | Console Location | Purpose |
|-------------|-----------------|---------|
| Lambda Function | Lambda > Functions > `goodiebag-backend-prod-app` | Runs the Express app |
| API Gateway HTTP API | API Gateway > APIs > `prod-goodiebag-backend` | Routes HTTP requests to Lambda |
| IAM Role | IAM > Roles > `goodiebag-backend-prod-...` | Execution role granting Lambda permission to write CloudWatch logs |
| CloudWatch Log Group | CloudWatch > Log groups > `/aws/lambda/goodiebag-backend-prod-app` | Lambda execution logs |
| S3 Deployment Bucket | S3 > `goodiebag-backend-prod-serverlessdeploymentbucket-...` | Stores deployment artifacts (Lambda zip files) — managed by Serverless Framework |
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
7. **CloudFormation Stack**: AWS Console > CloudFormation > Stacks > `goodiebag-backend-prod`. Check Outputs tab for all four exported values (ApiGatewayUrl, FrontendBucketName, CloudFrontDomainName, CloudFrontDistributionId).

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

### 6.6 Local Development

Vite proxies `/api/*` to `http://localhost:8080` — no environment variables needed locally.

```bash
cd frontend
npm ci
npm run dev     # http://localhost:5173
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

**Local `.env` file:**

```bash
cd backend-node
# Edit .env and set DATABASE_URL to your Supabase transaction-mode URL
DATABASE_URL=postgres://postgres.yourprojectref:yourpassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**GitHub Secret:**

Follow the steps in [Section 3.3](#33-github-actions-secrets-setup) to add `DATABASE_URL` as a repository secret.

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

## 8. Local Development

### 8.1 Start a Local PostgreSQL Database

**Option A: Docker (recommended for local dev)**

```bash
# From the repository root
docker compose up -d
# Starts PostgreSQL on localhost:5432
```

Then set `DATABASE_URL` in `backend-node/.env`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/goodiebag
```

**Option B: Supabase dev project**

Create a separate Supabase project for development and use its transaction-mode connection string.

### 8.2 Run Migrations

```bash
cd backend-node
npm run migrate
```

### 8.3 Start the Backend

```bash
cd backend-node
npm ci          # first time only
npm run dev     # starts Express on http://localhost:8080 with hot reload (tsx watch)
```

Verify:

```bash
curl http://localhost:8080/api/health
# {"status":"UP"}
```

### 8.4 Start the Frontend

```bash
cd frontend
npm ci          # first time only
npm run dev     # starts Vite dev server on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `http://localhost:8080` (configured in `vite.config.ts`), so the frontend and backend work together without CORS issues during local development.

### 8.5 Run Tests

```bash
# Backend unit tests (no DB required)
cd backend-node
npm test

# Backend integration tests (requires DATABASE_URL)
cd backend-node
npm run test:integration

# All backend tests
cd backend-node
npm run test:all

# Frontend tests
cd frontend
npm test
```

---

## 9. Troubleshooting

### Lambda Cold Start is Slow

- Check the `Init Duration` in CloudWatch logs (`/aws/lambda/goodiebag-backend-prod-app`). Target is under 500 ms.
- The esbuild single-file bundle (`dist/lambda.js`) minimizes module loading time. If cold starts exceed 500 ms, check if `node_modules` are being packaged (they should not be -- esbuild bundles everything).
- Consider using Lambda Provisioned Concurrency if cold starts are unacceptable for your use case (adds cost).

### CORS Errors in the Browser

- Verify `CORS_ALLOWED_ORIGIN` is set correctly in the Lambda environment variables. It must exactly match the origin the browser sends (including protocol and port, no trailing slash).
- Check the API Gateway CORS configuration: AWS Console > API Gateway > your API > CORS.
- During local development, Vite's proxy handles CORS. If you see CORS errors locally, make sure you are accessing the app through `http://localhost:5173`, not directly hitting port 8080 from a browser page served on a different origin.

### Missing Environment Variables

- **Locally:** Verify `backend-node/.env` exists and has all variables from `.env.example`.
- **In Lambda:** AWS Console > Lambda > your function > Configuration > Environment variables. All five variables (`DATABASE_URL`, `CORS_ALLOWED_ORIGIN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NODE_ENV`) must be present.
- **In GitHub Actions:** Repository Settings > Secrets and variables > Actions. All six secrets must be set (the five above plus `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`).

### Database Migration Failures

- **"relation already exists"**: The migration has already been applied. Run `npm run migrate:status` to check which migrations have run.
- **Connection refused**: Verify `DATABASE_URL` is correct and uses port `6543` (transaction mode) for Supabase. If using local Docker, make sure the container is running (`docker compose ps`).
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
