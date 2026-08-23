---
name: Phase 1 Foundation — what was built
description: Summary of Phase 1 backend scaffold: Spring Boot 4.1.0, PostgreSQL, Flyway, CORS, exception handling
type: project
---

Phase 1 baseline implemented 2026-08-10. Backend is a Spring Boot 4.1.0 + Spring MVC + JPA + Flyway + PostgreSQL app.

**Files created/modified:**
- `pom.xml` — fixed test deps for Spring Boot 4.x; added `testcontainers.version=2.0.5` property and `testcontainers-bom` import
- `application.yaml` — datasource (goodiebag DB), Flyway enabled, CORS origin configurable via `CORS_ALLOWED_ORIGIN` env var
- `db/migration/V1__baseline.sql` — placeholder `SELECT 1` so Flyway has at least one migration
- `web/HealthController.java` — `GET /api/health` returns `{"status":"UP"}`
- `config/WebConfig.java` — CORS for `/api/**`, reads `app.cors.allowed-origin`
- `web/GlobalExceptionHandler.java` — `@RestControllerAdvice` returning `ProblemDetail` for validation and generic errors

**Tests (all passing, 3/3):**
- `BackendApplicationTests` — full context load with real PostgreSQL via Testcontainers
- `HealthControllerTest` — `@WebMvcTest` slice (no DB)
- `HealthControllerIntegrationTest` — full context + MockMvc with Testcontainers PostgreSQL

**Why:** Project "SmallGiftCompany" / goodiebag app. Phase 1 is infrastructure only; no domain tables yet.

**How to apply:** Future phases add Flyway migrations starting at V2; domain code goes under `org.example.backend`.
