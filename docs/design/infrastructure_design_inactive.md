# AWS Infrastructure Design

## Overview

This document describes the AWS deployment architecture for the Goodie Bag MVP.

**Scale assumptions:** ~500 customers, ~200 products, low-to-moderate traffic.

---

## Architecture Diagram

```
Internet
  │
  ├─► CloudFront (yourdomain.com) ──► S3 (React static assets, private + OAC)
  │
  └─► ALB (api.yourdomain.com, HTTPS 443) ──► ECS Fargate (Spring Boot, private subnet)
                                                      │
                                                      ├─► RDS PostgreSQL db.t3.micro (private subnet)
                                                      ├─► S3 (product media bucket)
                                                      └─► SES (transactional email)

ECR ──────────────────────────────────► ECS pulls image on deploy
Secrets Manager ──────────────────────► ECS injects env vars at task startup
GitHub Actions ──► ECR push + ECS force-deploy + S3 sync + CloudFront invalidation
```

**Domain layout:**
| Subdomain | Points to |
|---|---|
| `yourdomain.com` | CloudFront (React app) |
| `www.yourdomain.com` | CloudFront (React app) |
| `api.yourdomain.com` | Application Load Balancer (Spring Boot) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, MUI 6 |
| Backend | Spring Boot 4.1.0, Java 21, Maven |
| Database | PostgreSQL 16 |
| Migrations | Flyway (runs automatically on startup) |
| Container registry | AWS ECR |
| Container runtime | AWS ECS Fargate |
| Load balancer | AWS ALB |
| Database hosting | AWS RDS PostgreSQL |
| Static hosting | AWS S3 + CloudFront |
| Secrets | AWS Secrets Manager |
| Email | AWS SES |
| DNS | GoDaddy → Route 53 (recommended) or GoDaddy CNAMEs |

---

## New Files to Create

| File | Purpose |
|---|---|
| `backend/Dockerfile` | Multi-stage Docker build for Spring Boot |
| `.github/workflows/deploy.yml` | CD pipeline: ECR push + ECS deploy + S3 sync + CF invalidation |

### `backend/Dockerfile`

```dockerfile
# Build stage
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -q
COPY src/ src/
RUN ./mvnw package -DskipTests -q

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### `.github/workflows/deploy.yml` (outline)

Triggers on push to `main` after CI passes. Two jobs:

**Job 1 — backend:**
1. Build Docker image
2. Push to ECR
3. `aws ecs update-service --force-new-deployment` → ECS pulls new image

**Job 2 — frontend:**
1. `npm run build` with `VITE_API_BASE_URL=https://api.yourdomain.com`
2. `aws s3 sync dist/ s3://<frontend-bucket> --delete`
3. `aws cloudfront create-invalidation --paths "/*"`

**GitHub secrets required:**
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
ECR_REPOSITORY          # e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/goodiebag/backend
ECS_CLUSTER
ECS_SERVICE
S3_BUCKET               # frontend bucket name
CF_DISTRIBUTION_ID
VITE_API_BASE_URL       # https://api.yourdomain.com
```

---

## AWS Setup Order (one-time, manual)

### Step 1 — Networking (VPC)

- Create a VPC with CIDR `10.0.0.0/16`
- 2 public subnets (e.g. `10.0.1.0/24`, `10.0.2.0/24`) across 2 AZs
- 2 private subnets (e.g. `10.0.3.0/24`, `10.0.4.0/24`) across 2 AZs
- Internet Gateway attached to the VPC
- 1 NAT Gateway in one public subnet (allows ECS/RDS in private subnets to reach the internet for ECR pulls, SES, etc.)
- Route tables: public subnets → IGW; private subnets → NAT Gateway

### Step 2 — ACM Certificates (TLS)

ACM certificates are free. You need **two**:

| Certificate | Region | Used by |
|---|---|---|
| `yourdomain.com` + `www.yourdomain.com` | **us-east-1** | CloudFront (CloudFront requires us-east-1) |
| `api.yourdomain.com` | **same region as ALB** | ALB |

Validation method: DNS validation (ACM gives you a CNAME record to add — see DNS section below).

### Step 3 — RDS PostgreSQL

- Engine: PostgreSQL 16
- Instance: `db.t3.micro` (upgrade to `db.t3.small` or Multi-AZ when ready for production)
- Place in **private subnets**, in a dedicated DB subnet group
- Security group: allow port 5432 **from ECS security group only** (not from internet)
- Enable automated backups (7-day retention minimum)
- Note the endpoint hostname, port (5432), username, password

### Step 4 — Secrets Manager

Create one secret named `goodiebag/prod` with this JSON:

```json
{
  "DATABASE_URL": "jdbc:postgresql://<rds-endpoint>:5432/goodiebag",
  "DATABASE_USERNAME": "...",
  "DATABASE_PASSWORD": "...",
  "CORS_ALLOWED_ORIGIN": "https://yourdomain.com",
  "ADMIN_USERNAME": "...",
  "ADMIN_PASSWORD": "...",
  "STRIPE_SECRET_KEY": "sk_live_...",
  "STRIPE_WEBHOOK_SECRET": "whsec_...",
  "SES_REGION": "us-east-1",
  "SES_FROM_EMAIL": "noreply@yourdomain.com"
}
```

### Step 5 — ECR

- Create repository: `goodiebag/backend`
- Note the full repository URI (e.g. `123456789.dkr.ecr.us-east-1.amazonaws.com/goodiebag/backend`)

### Step 6 — ECS Fargate

1. Create ECS cluster (Fargate launch type)
2. Create task definition:
   - Image: ECR repository URI (`:latest` or specific tag)
   - CPU: `512` (0.5 vCPU), Memory: `1024 MB`
   - Port mapping: `8080`
   - Environment variables: inject all keys from Secrets Manager (`valueFrom`)
   - Health check: `CMD-SHELL, curl -f http://localhost:8080/actuator/health || exit 1`
   - Task role: allow `secretsmanager:GetSecretValue` + `s3:PutObject`/`GetObject` (media bucket) + `ses:SendEmail`
3. Create ECS service:
   - Launch type: Fargate
   - Desired count: 1
   - Place in **private subnets**
   - Attach to ALB target group (below)
   - Security group: allow port 8080 from ALB security group only

> Flyway runs automatically when the container starts — no manual migration step needed.

### Step 7 — ALB (Application Load Balancer)

- Type: public-facing, in **public subnets**
- Security group: allow inbound 80 and 443 from `0.0.0.0/0`; ECS SG allows 8080 from ALB SG only
- Target group: HTTP, port 8080, health check path `/actuator/health`
- Listeners:
  - HTTPS 443 → forward to ECS target group, attach ACM cert for `api.yourdomain.com`
  - HTTP 80 → redirect to HTTPS (301)
- Note the ALB DNS name (e.g. `my-alb-123456.us-east-1.elb.amazonaws.com`)

### Step 8 — S3 + CloudFront (Frontend)

**S3 bucket:**
- Name: `goodiebag-frontend-prod` (or similar)
- Block all public access (CloudFront accesses it via OAC, not public URLs)

**CloudFront distribution:**
- Origin: the S3 bucket, using Origin Access Control (OAC) — not legacy OAI
- Allowed HTTP methods: GET, HEAD
- Default root object: `index.html`
- Custom error response: HTTP 404 → `/index.html`, response code 200 (required for React Router)
- HTTPS only, minimum TLS 1.2
- Alternate domain names (CNAMEs): `yourdomain.com`, `www.yourdomain.com`
- ACM certificate: select the `us-east-1` cert covering both domains
- Note the CloudFront domain (e.g. `d1abc123.cloudfront.net`) and distribution ID

### Step 9 — IAM for GitHub Actions

Create an IAM user `github-actions-deploy` with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["ecr:GetAuthorizationToken"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["ecr:BatchCheckLayerAvailability", "ecr:PutImage",
      "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload"],
      "Resource": "arn:aws:ecr:*:*:repository/goodiebag/backend" },
    { "Effect": "Allow", "Action": ["ecs:UpdateService", "ecs:DescribeServices"],
      "Resource": "*" },
    { "Effect": "Allow", "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::goodiebag-frontend-prod",
                   "arn:aws:s3:::goodiebag-frontend-prod/*"] },
    { "Effect": "Allow", "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "*" }
  ]
}
```

---

## DNS — Connecting GoDaddy Domain to AWS

You have two options. **Option A (recommended)** uses Route 53 as your DNS, which is more reliable and supports apex domain aliases. **Option B** keeps GoDaddy as DNS and uses CNAMEs only.

---

### Option A — Delegate DNS to Route 53 (Recommended)

Route 53 supports **ALIAS records** which allow you to point your root/apex domain (`yourdomain.com`) directly at CloudFront — something GoDaddy CNAMEs cannot do for the root domain.

**Step A1 — Create a Route 53 Hosted Zone:**
1. Go to Route 53 → Hosted zones → Create hosted zone
2. Domain name: `yourdomain.com`, type: Public
3. AWS will give you 4 nameserver (NS) records, e.g.:
   ```
   ns-123.awsdns-12.com
   ns-456.awsdns-34.net
   ns-789.awsdns-56.org
   ns-012.awsdns-78.co.uk
   ```

**Step A2 — Point GoDaddy to Route 53 nameservers:**
1. Log in to GoDaddy → My Products → DNS → Manage
2. Find the Nameservers section → click "Change"
3. Select "Enter my own nameservers (advanced)"
4. Enter all 4 Route 53 NS values from Step A1
5. Save — DNS propagation takes up to 48 hours (usually under 1 hour)

**Step A3 — Add records in Route 53:**

| Record | Type | Value |
|---|---|---|
| `yourdomain.com` | A (ALIAS) | CloudFront distribution |
| `www.yourdomain.com` | A (ALIAS) | CloudFront distribution |
| `api.yourdomain.com` | CNAME | ALB DNS name (e.g. `my-alb-123.us-east-1.elb.amazonaws.com`) |
| ACM validation records | CNAME | Provided by ACM during cert request |

> For ALIAS records in Route 53: choose record type A → enable "Alias" toggle → select "Alias to CloudFront distribution" from the dropdown.

---

### Option B — Keep GoDaddy DNS (CNAMEs only)

This works but has one limitation: **you cannot point the root domain (`yourdomain.com`) to CloudFront via CNAME** — DNS spec forbids CNAME on apex domains. You would have to use `www` as your primary domain.

**Add these records in GoDaddy DNS:**

| Name | Type | Value | TTL |
|---|---|---|---|
| `www` | CNAME | `d1abc123.cloudfront.net` | 1 hour |
| `api` | CNAME | `my-alb-123.us-east-1.elb.amazonaws.com` | 1 hour |
| `_acm-validation-xxx` (for each cert) | CNAME | Value from ACM | 1 hour |

> The ACM CNAME validation records are provided by AWS when you request a certificate. Add them in GoDaddy exactly as shown — ACM will automatically detect them and issue the cert.

**Limitation:** `yourdomain.com` (root) cannot CNAME to CloudFront. You would either:
- Redirect `yourdomain.com` → `www.yourdomain.com` using GoDaddy's built-in forwarding feature
- Or use Option A (Route 53) to avoid this restriction entirely

---

## Key Configuration Notes

- **`VITE_API_BASE_URL`** — set to `https://api.yourdomain.com` at build time (GitHub Actions secret). All frontend API calls are prefixed with this.
- **`CORS_ALLOWED_ORIGIN`** — set to `https://yourdomain.com` in Secrets Manager. Already consumed by `app.cors.allowed-origin` in `application.yaml`.
- **React Router** — the CloudFront custom error response (404 → `index.html`) is essential so that direct URL access (e.g. `/bundle/123`) doesn't return a 404 from S3.
- **Flyway** — runs automatically on ECS container startup. First deploy creates all tables from the 23 existing migrations.
- **Stripe webhooks** — configure the Stripe dashboard to send webhooks to `https://api.yourdomain.com/api/webhooks/stripe`.

---

## Estimated Monthly Cost

| Service | Config | Est./month |
|---|---|---|
| RDS PostgreSQL | db.t3.micro, single-AZ | ~$15 |
| ECS Fargate | 0.5 vCPU / 1 GB, 1 task | ~$15 |
| ALB | low traffic | ~$18 |
| CloudFront + S3 | low traffic | ~$2 |
| NAT Gateway | 1 AZ | ~$35 |
| Route 53 hosted zone | 1 zone | ~$0.50 |
| SES | first 62k emails free | ~$0 |
| Secrets Manager | 1 secret | ~$0.40 |
| **Total** | | **~$86/month** |

> The NAT Gateway (~$35) is the largest cost item. It is required for ECS tasks in private subnets to pull images from ECR and reach SES/Secrets Manager. Alternatively, use VPC Endpoints for ECR/S3/Secrets Manager to eliminate the NAT Gateway cost, but that adds setup complexity.

---

## Verification Checklist

- [ ] `curl https://api.yourdomain.com/actuator/health` → `{"status":"UP"}`
- [ ] Open `https://yourdomain.com` → React app loads, no console errors
- [ ] Gift Finder flow completes → bundle page renders with real data
- [ ] Admin login works at `https://yourdomain.com/admin`
- [ ] RDS: confirm all 23 Flyway migrations ran (`select * from flyway_schema_history order by installed_rank`)
- [ ] GitHub Actions deploy workflow runs green on push to `main`
- [ ] HTTPS certificate valid (no browser warnings) on both `yourdomain.com` and `api.yourdomain.com`
- [ ] HTTP → HTTPS redirect works on both domains
