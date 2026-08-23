# Phase 8 — Deployment + Security + Production Hardening

## Goal

Deploy a small, understandable production system with secure configuration and enough observability to support an event.

## Target Architecture

One reasonable AWS-oriented target:

```text
React static assets
  → S3 + CloudFront

Spring Boot container
  → ECS Fargate (behind HTTPS-capable routing/load balancer)

PostgreSQL
  → RDS PostgreSQL

Product images
  → S3

Transactional email
  → SES

Payments
  → Stripe

Logs/metrics
  → CloudWatch
```

Alternative simpler hosting is acceptable if chosen deliberately. Do not migrate hosting platforms during the final week without a strong reason.

## AI Can Write

- Dockerfile;
- CI/CD workflows;
- infrastructure templates/scripts where appropriate;
- environment configuration classes;
- health/readiness checks;
- structured logging;
- security headers/config;
- CORS config;
- basic rate limiting design/code;
- deployment README.

## Human Must Do

External configuration cannot be "completed" by source code alone:

- create AWS account/resources;
- set budgets/alerts;
- create RDS credentials;
- store secrets securely;
- configure domain and DNS;
- configure TLS/HTTPS;
- verify SES identities/domain and sending setup;
- create/configure Stripe webhook;
- configure Apple Pay/domain requirements;
- configure production CORS origin;
- enable backups;
- inspect CloudWatch logs;
- perform production smoke test.

## Minimum Security Checklist

- HTTPS only in production.
- No secrets committed.
- DB not publicly exposed unless explicitly justified.
- Admin endpoints authenticated.
- Staff redemption endpoint authenticated or otherwise event-restricted.
- Stripe webhook signature verified.
- Input validated.
- Error responses do not expose stack traces.
- Logs do not contain secrets/card data.
- Reasonable claim/redeem rate limiting.
- Secure random redemption token.
- Database backups enabled.
- Dependency vulnerability scan reviewed.
- CORS restricted to intended origins.

## Acceptance Criteria

- fresh deployment succeeds from documented process;
- health endpoint is observable;
- logs show request/error context without secrets;
- production database backup policy exists;
- frontend calls only production API;
- Stripe webhook reaches production backend;
- SES email reaches real inbox;
- iPad camera works over HTTPS;
- admin is not publicly usable without authentication.

## How I Should Check

### Pre-production
- run dependency audit;
- search repo for likely secrets;
- test bad CORS origin;
- test unauthenticated admin;
- test unauthenticated redemption/staff endpoint;
- test malformed payloads.

### Production smoke test
Create one test campaign and one test pass, redeem it, browse, add cart, run Stripe test-mode checkout if production environment is still configured for testing, inspect logs and DB.

## Common AI Mistakes to Catch

- assuming `.env` means secrets are safe;
- creating publicly accessible RDS;
- wildcard production CORS;
- no distinction between staging and production;
- deployment steps existing only in chat, not in README.
