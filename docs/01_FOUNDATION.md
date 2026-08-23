# Phase 1 — Foundation
2
## Goal

Create a clean local development environment and a deployable skeleton before business features are added.

## Recommended Stack

### Frontend
- React
- TypeScript
- Vite
- React Router
- MUI
- Vitest
- React Testing Library

### Backend
- Java 21 (or team-approved LTS)
- Spring Boot
- Spring Web
- Spring Data JPA
- Bean Validation
- PostgreSQL
- Flyway
- JUnit
- Spring Boot Test / Testcontainers where practical

### Repo
Recommended monorepo:

```text
/
  frontend/
  backend/
  docs/
  infra/
  .github/workflows/
```

## AI Can Write

- React/Vite/TypeScript project.
- Spring Boot project.
- Local `.env.example` files.
- Docker Compose for local PostgreSQL.
- Health endpoint.
- Global backend exception format.
- Frontend API client wrapper.
- Flyway baseline.
- CI workflow that runs frontend tests/build and backend tests/build.
- Root README with local startup instructions.

## Human Must Do

- Choose exact Java/Node versions.
- Install Java, Node, Docker, Git.
- Create GitHub repository.
- Decide naming conventions and package name.
- Review all dependency versions.
- Never commit real credentials.

## Required Environment Variables

Example only:

```text
DATABASE_URL=
DATABASE_USERNAME=
DATABASE_PASSWORD=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

SES_REGION=
SES_FROM_EMAIL=

APP_PUBLIC_URL=
ADMIN_USERNAME=
ADMIN_PASSWORD_HASH=
```

Do not put real values in Git.

## Acceptance Criteria

- `frontend` starts locally.
- `backend` starts locally.
- backend connects to PostgreSQL.
- `/api/health` returns 200.
- frontend can call backend health endpoint.
- database migrations run automatically.
- frontend test command passes.
- backend test command passes.
- CI passes on a clean push.

## How I Should Check

### Manual
1. Clone into a fresh directory.
2. Follow README only.
3. Start DB.
4. Start backend.
5. Start frontend.
6. Open browser.
7. Confirm no unexplained console/network errors.

### Automated
Backend:
- context-load test;
- health endpoint integration test;
- migration startup test.

Frontend:
- smoke render test;
- API failure-state test.

## Common AI Mistakes to Catch

- hard-coded localhost URLs;
- secrets committed to source;
- CORS set to `*` together with credentials;
- no database migrations;
- entities exposed directly as API response objects;
- tests that only mock everything and never test integration.
