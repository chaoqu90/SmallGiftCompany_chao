---
name: Spring Boot 4.x Testcontainers and WebMvc test setup
description: Key differences in Spring Boot 4.1.0 for test dependencies and package names vs 3.x conventions
type: project
---

Spring Boot 4.1.0 uses Testcontainers 2.x (version 2.0.5) and reorganised test slice packages.

**Testcontainers 2.x artifact IDs (different from 1.x):**
- `org.testcontainers:testcontainers-junit-jupiter` (was `junit-jupiter`)
- `org.testcontainers:testcontainers-postgresql` (was `postgresql`)
- The `testcontainers-bom` must be explicitly imported in `<dependencyManagement>` with `<testcontainers.version>2.0.5</testcontainers.version>` declared in `<properties>` — Spring Boot parent BOM imports are resolved too late for Maven's validation phase.

**Spring Boot 4.x modular test slices (new, did not exist in 3.x):**
- `spring-boot-starter-webmvc-test` provides `@WebMvcTest` and `@AutoConfigureMockMvc`
- These annotations moved to package `org.springframework.boot.webmvc.test.autoconfigure` (was `org.springframework.boot.test.autoconfigure.web.servlet`)
- `spring-boot-starter-test` no longer includes the MVC slice — must add `spring-boot-starter-webmvc-test` explicitly

**`PostgreSQLContainer` class:** still importable from `org.testcontainers.containers.PostgreSQLContainer` (compatibility alias kept in 2.x jar); also available at `org.testcontainers.postgresql.PostgreSQLContainer`.

**Why:** Spring Boot 4.x modularised test infrastructure to match the modularised starter structure.

**How to apply:** Whenever adding test dependencies or writing test annotations for a Spring Boot 4.x project, use the above artifact IDs and package names. Do not follow Spring Boot 3.x docs.
