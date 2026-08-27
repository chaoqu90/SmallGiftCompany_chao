# Backend Design Document

## 1. Tech Stack and Frameworks

| Technology | Version | Purpose |
|---|---|---|
| Java | 21 (LTS) | Application language |
| Spring Boot | 4.1.0 | Application framework (parent POM) |
| Spring Web MVC | (via starter) | REST API layer |
| Spring Data JPA | (via starter) | ORM / repository abstraction over PostgreSQL |
| Spring Security | (via starter) | Authentication and authorization (HTTP Basic for admin) |
| Spring Boot Actuator | (via starter) | Health endpoint (`/actuator/health`) |
| Bean Validation (Hibernate Validator) | (via starter) | Request DTO validation annotations |
| Flyway | (via starter + `flyway-database-postgresql`) | Versioned database migrations (V1 through V23) |
| PostgreSQL | Runtime driver | Relational database |
| Testcontainers | 2.0.5 (BOM) | Ephemeral PostgreSQL containers for integration tests |
| Spring Boot Test | (via starter) | Test harness including `@SpringBootTest` |
| Spring Security Test | (via dependency) | Security-context helpers for tests |
| Spring Boot WebMvc Test | (via starter) | `@WebMvcTest` / `MockMvc` slice tests |
| JUnit 5 | (via Spring Boot Test) | Unit and integration test framework |
| Maven | Wrapper included (`mvnw`) | Build tool |

### Notable Configuration

- `spring.jpa.hibernate.ddl-auto=validate` -- Hibernate validates the schema against entities but never modifies it; all schema changes go through Flyway.
- `spring.jpa.open-in-view=false` -- Disables the Open Session In View anti-pattern; lazy-loading must happen inside explicit `@Transactional` boundaries.
- Server port: 8080.
- All configuration values externalized via environment variables with sensible local defaults.

---

## 2. Package Structure

```
org.example.backend
|
+-- BackendApplication.java          Main Spring Boot entry point
|
+-- config/
|   +-- SecurityConfig.java          Spring Security filter chain, CORS, in-memory admin user
|   +-- WebConfig.java               (Empty placeholder for future web-layer config)
|
+-- web/
|   +-- HealthController.java        GET /api/health -- liveness probe
|   +-- GlobalExceptionHandler.java  @RestControllerAdvice -- RFC 7807 ProblemDetail responses
|
+-- catalog/                         Core domain: products, bundles, generation engine
|   |
|   |-- Enums
|   |   +-- ProductCategory.java     STATIONERY, BOOK, PUZZLE, TOY, ACCESSORY, WEARABLE, ...
|   |   +-- FormFactor.java          BAR, FLAT_RECT, ROUND, CUBE, IRREGULAR_VOLUME, ...
|   |   +-- UpgradeTier.java         STANDARD, PREMIUM
|   |   +-- Interest.java            POP_MUSIC, TOYS_PLAY, CUTE_MAGICAL, SPORTS, READING_PUZZLE
|   |   +-- PartyType.java           CELEBRATION, HALLOWEEN
|   |   +-- AudiencePreference.java  FEMININE, MASCULINE, NO_PREFERENCE (request-side)
|   |   +-- AudienceAffinity.java    FEMININE, MASCULINE, UNIVERSAL (product-side)
|   |   +-- BundleRole.java          UTILITY, ACTIVITY, PLAY, TACTILE, WEARABLE, ... , PREMIUM
|   |
|   |-- Core Entities
|   |   +-- Product.java             Central catalog item (SKU, costs, pricing, inventory, age range)
|   |   +-- BudgetTier.java          Price band definition (code, retail min/max, target retail)
|   |   +-- BundleTemplate.java      Named template with ordered slots (PRESCHOOL_4_ITEM, etc.)
|   |   +-- BundleTemplateSlot.java  One slot in a template, with allowed roles
|   |   +-- GiftBagOption.java       Packaging option with cost and retail price adjustment
|   |
|   |-- Affinity / Tagging Entities (composite-key join tables)
|   |   +-- ProductInterestAffinity.java      (product_id, interest) -> weight
|   |   +-- ProductAudienceAffinity.java      (product_id, audience) -> weight
|   |   +-- ProductRoleAffinity.java          (product_id, role)     -> weight
|   |   +-- ProductOccasion.java              (product_id, occasion)
|   |   +-- ProductInterestAffinityId.java    Composite key class
|   |   +-- ProductAudienceAffinityId.java    Composite key class
|   |   +-- ProductRoleAffinityId.java        Composite key class
|   |   +-- ProductOccasionId.java            Composite key class
|   |
|   |-- Generated Bundle Entities (immutable snapshots)
|   |   +-- GeneratedBundle.java              Root snapshot entity with public ID
|   |   +-- GeneratedBundleItem.java          Snapshot of one product selected for a slot
|   |   +-- GeneratedBundleUpgrade.java       Standard + premium upgrade product snapshot
|   |   +-- GeneratedBundleGiftBag.java       Snapshot of the selected gift bag option
|   |
|   |-- DTOs (Java records)
|   |   +-- BundleGenerationRequest.java      Validated input: age, audience, interest, party, budget
|   |   +-- GeneratedBundleResponse.java      Full bundle output DTO (maps from entity)
|   |   +-- GeneratedBundleItemDto.java       Per-item output DTO
|   |   +-- GeneratedBundleUpgradeDto.java    Upgrade pair output DTO
|   |   +-- GeneratedBundleGiftBagDto.java    Gift bag output DTO
|   |
|   |-- Services
|   |   +-- BundleGenerationService.java      Core generation algorithm (3 selection paths)
|   |   +-- GeneratedBundleService.java       Thin orchestrator: delegates to generation, handles lookups
|   |   +-- ProductEligibilityService.java    Hard filters: age range, party type, inventory, audience
|   |   +-- ProductScoringService.java        Scoring formula: interest + audience + role weights
|   |   +-- BundleTemplateSelector.java       Template routing by age and interest
|   |   +-- UpgradeGenerationService.java     Standard/premium upgrade selection (3 variants)
|   |   +-- BundleSimulationService.java      Read-only simulation for analytics dashboard
|   |
|   |-- Exception
|   |   +-- BundleGenerationException.java    Domain exception with typed FailureCode enum
|   |
|   |-- Controller
|   |   +-- GeneratedBundleController.java    POST + GET /api/generated-bundles
|   |
|   |-- Repositories (Spring Data JPA)
|   |   +-- ProductRepository.java
|   |   +-- BudgetTierRepository.java
|   |   +-- BundleTemplateRepository.java
|   |   +-- GiftBagOptionRepository.java
|   |   +-- GeneratedBundleRepository.java
|   |   +-- ProductInterestAffinityRepository.java
|   |   +-- ProductAudienceAffinityRepository.java
|   |   +-- ProductRoleAffinityRepository.java
|   |   +-- ProductOccasionRepository.java
|
+-- admin/                           Admin-only controllers (protected by HTTP Basic)
|   +-- AdminProductController.java           CRUD + partial updates for products
|   +-- AdminProductAffinityController.java   GET/PUT affinities per product
|   +-- AdminBundleController.java            Read-only bundle listing and detail
|   +-- AdminDashboardController.java         Analytics counts + product coverage simulation
|
+-- analytics/                        Event tracking subsystem
    +-- AnalyticsEvent.java           Entity: event_type, session_id, bundle_id, metadata_json
    +-- AnalyticsEventRepository.java JpaRepository with countByEventType
    +-- AnalyticsEventService.java    Thin service: record and count
    +-- AnalyticsController.java      POST /api/analytics/events (public, unauthenticated)
```

---

## 3. Key Design Patterns and Architectural Decisions

### 3.1 Modular Monolith

The application is a single Spring Boot process with package-based module boundaries (`catalog`, `admin`, `analytics`, `web`, `config`). There are no microservices, message queues, or async event buses. This follows the master plan principle: "Modular monolith, not microservices."

### 3.2 Immutable Snapshot Pattern

Generated bundles are persisted as **complete point-in-time snapshots**. Each `GeneratedBundleItem` stores `productNameSnapshot`, `skuSnapshot`, `costSnapshot`, etc. -- copied from the `Product` entity at generation time. This means:

- A generated bundle remains valid even if the product catalog changes afterwards.
- Historical orders can reference the exact product data that existed at generation time.
- The `GeneratedBundleUpgrade` and `GeneratedBundleGiftBag` entities follow the same snapshot pattern.

### 3.3 Three-Path Bundle Generation Algorithm

`BundleGenerationService.generate()` implements three selection paths:

| Path | Trigger | Behavior |
|---|---|---|
| **PATH 1: Unconstrained** | `maxRetailPrice == null` | Picks highest-scoring eligible product per template slot with no budget ceiling. |
| **PATH 2: Constrained** | `maxRetailPrice != null` | Reserves budget for standard upgrade, then greedy slot selection within remaining budget. Uses feasibility lookahead to ensure remaining slots can still be filled. |
| **PATH 3: Tight (fallback)** | Per-slot within PATH 2 | When no preference-filtered candidate fits, falls back to all active STANDARD products (drops preference filters, keeps audience filter). |

All three paths use:
- **ProductEligibilityService** for hard filters (active, age range, inventory > 0, occasion/party type match, audience compatibility).
- **ProductScoringService** for soft ranking (`interestScore + audienceAdjustment + roleScore`).
- **UpgradeGenerationService** for selecting standard and premium upgrade products.

### 3.4 Multi-Dimensional Affinity Model

Products are tagged with weighted affinities across four dimensions stored in separate join tables:

| Dimension | Table | Key | Value |
|---|---|---|---|
| Interest | `product_interest_affinity` | (product_id, interest) | weight 0-100 |
| Audience | `product_audience_affinity` | (product_id, audience) | weight 0-100 |
| Role | `product_role_affinity` | (product_id, role) | weight 0-100 |
| Occasion | `product_occasion` | (product_id, occasion) | boolean presence |

These affinities drive both hard filtering (audience compatibility, occasion eligibility) and soft scoring (interest weight, audience adjustment, role score).

### 3.5 Template-Based Slot System

Bundle composition is driven by `BundleTemplate` entities, each defining an ordered list of `BundleTemplateSlot` entries. Each slot specifies which product roles (`BundleRole`) are allowed. The `BundleTemplateSelector` routes to the correct template based on child age and interest:

- Age <= 5: `PRESCHOOL_4_ITEM`
- Age > 5, Interest = READING_PUZZLE: `READING_PUZZLE_4_ITEM` (fallback to GENERAL)
- Otherwise: `GENERAL_4_ITEM`

### 3.6 Retail Price Computation (Server-Side Only)

The admin pricing endpoint (`AdminProductController.updatePricing`) and product creation compute `retailPrice` server-side from `cogAdjusted` (= `cost + cogOverhead`) using a tiered formula. The browser never supplies prices. This follows the master plan rule: "Do NOT trust prices supplied by the browser."

### 3.7 Error Handling: RFC 7807 ProblemDetail

`GlobalExceptionHandler` converts all exceptions into `ProblemDetail` (RFC 7807) responses:

| Exception Type | HTTP Status | `type` URI |
|---|---|---|
| `MethodArgumentNotValidException` | 400 | `about:validation-error` |
| `ConstraintViolationException` | 400 | `about:validation-error` |
| `BundleGenerationException` | 422 | `about:bundle-generation-error` |
| Unhandled `Exception` | 500 | `about:internal-error` |

`BundleGenerationException` carries a typed `FailureCode` enum (`INSUFFICIENT_ROLE_COVERAGE`, `NO_BUDGET_FEASIBLE`, `NO_ELIGIBLE_PRODUCTS`, `TEMPLATE_NOT_FOUND`, `BUDGET_TIER_NOT_FOUND`, `NO_GIFT_BAG_CONFIGURED`) which is included as a `failureCode` property in the response body.

### 3.8 Authentication Model

- **Public endpoints** (`/api/**`): No authentication required. Includes health, bundle generation, bundle lookup, and analytics event capture.
- **Admin endpoints** (`/admin/api/**`): Protected by HTTP Basic authentication. Single in-memory admin user with configurable username/password via environment variables.
- **Session management**: Stateless (`SessionCreationPolicy.STATELESS`).
- **CSRF**: Disabled (appropriate for a stateless API consumed by a SPA).

### 3.9 Batch Affinity Loading

`BundleGenerationService` loads all product affinities in a single batch query per affinity type (e.g., `findAllByProductIdIn(allProductIds)`), then builds in-memory lookup maps. This avoids N+1 query problems during the product scoring loop.

### 3.10 Simulation for Analytics

`BundleSimulationService` mirrors the constrained bundle generation logic but runs entirely in memory without database writes. The `AdminDashboardController.getProductCoverage()` endpoint iterates all combinations of age midpoints (3-5, 6-8, 9-12), interests, audience preferences, party types, and budget tiers to determine which products appear in generated bundles and under which conditions.

---

## 4. API Endpoints

### 4.1 Public Endpoints (no authentication)

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/health` | Health check | -- | `{"status": "UP"}` |
| `POST` | `/api/generated-bundles` | Generate a new bundle | `BundleGenerationRequest` (JSON) | `201 Created` + `GeneratedBundleResponse` |
| `GET` | `/api/generated-bundles/{publicId}` | Retrieve existing bundle by public ID | -- | `200 OK` + `GeneratedBundleResponse` |
| `POST` | `/api/analytics/events` | Capture analytics event | `EventCaptureRequest` (JSON) | `201 Created` (no body) |

#### BundleGenerationRequest

```json
{
  "age": 7,                          // @NotNull @Min(3) @Max(12)
  "audiencePreference": "FEMININE",  // @NotNull enum
  "interest": "CUTE_MAGICAL",       // @NotNull enum
  "partyType": "CELEBRATION",       // @NotNull enum
  "budgetTierCode": "SUB1",         // @NotNull @Size(min=2, max=10)
  "maxRetailPrice": 12.50           // nullable; null = unconstrained
}
```

#### GeneratedBundleResponse

```json
{
  "generatedBundleId": "gb_a1b2c3d4e5f6",
  "templateCode": "GENERAL_4_ITEM",
  "standardItemCogsSnapshot": 8.50,
  "bundleRetailPrice": 14.00,
  "items": [
    {
      "slotCode": "SLOT_1",
      "productName": "Rainbow Sticker Sheet",
      "sku": "STK-RAINBOW-01",
      "description": "...",
      "formFactor": "FLAT_RECT",
      "quantityPerBag": 1,
      "displayOrder": 1
    }
  ],
  "upgrade": {
    "standardProductName": "Sparkle Pen",
    "standardSku": "PEN-SPRK-01",
    "standardRetailAdjustment": 2.50,
    "upgradedProductName": "Deluxe Art Kit",
    "upgradedSku": "ART-DLX-01",
    "upgradedRetailAdjustment": 3.00
  },
  "giftBag": {
    "code": "BASIC_BAG",
    "name": "Standard Gift Bag",
    "retailPriceAdjustment": 0.00,
    "isDefault": true
  }
}
```

#### EventCaptureRequest

```json
{
  "eventType": "FINDER_COMPLETED",   // @NotBlank
  "bundleId": "gb_a1b2c3d4e5f6",    // nullable
  "sessionId": "sess_xyz",           // nullable
  "metadataJson": "{\"key\":\"val\"}" // nullable
}
```

### 4.2 Admin Endpoints (HTTP Basic required, role ADMIN)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/api/products/` | List all products (sorted by name) |
| `GET` | `/admin/api/products/meta` | Enum values: categories, upgrade tiers, form factors |
| `POST` | `/admin/api/products/` | Create a new product |
| `PATCH` | `/admin/api/products/{id}/inventory` | Update inventory quantity |
| `PATCH` | `/admin/api/products/{id}/active` | Activate/deactivate product |
| `PATCH` | `/admin/api/products/{id}/pricing` | Update cost and overhead (retail price auto-computed) |
| `PATCH` | `/admin/api/products/{id}/category` | Update product category |
| `PATCH` | `/admin/api/products/{id}/upgrade-tier` | Update upgrade tier |
| `PATCH` | `/admin/api/products/{id}/age-range` | Update min/max age |
| `PATCH` | `/admin/api/products/{id}/details` | Update name, category, form factor |
| `DELETE` | `/admin/api/products/{id}` | Delete product (409 if referenced by bundles) |
| `GET` | `/admin/api/products/{id}/affinities` | Get all affinities for a product |
| `PUT` | `/admin/api/products/{id}/affinities` | Replace all affinities for a product |
| `GET` | `/admin/api/bundles/` | List recent generated bundles (max 200, newest first) |
| `GET` | `/admin/api/bundles/{publicId}` | Bundle detail with items |
| `GET` | `/admin/api/dashboard/` | Dashboard: finder completions + bundle views counts |
| `GET` | `/admin/api/dashboard/product-coverage` | Full simulation: product appearance across all combinations |

---

## 5. Data Models / Entities

### 5.1 Entity-Relationship Summary

```
product ----< product_interest_affinity
product ----< product_audience_affinity
product ----< product_role_affinity
product ----< product_occasion

budget_tier
bundle_template ----< bundle_template_slot ----< bundle_template_slot_role

generated_bundle >---- budget_tier
generated_bundle >---- bundle_template
generated_bundle ----< generated_bundle_item >---- product (FK, but snapshot fields copied)
generated_bundle ----| generated_bundle_upgrade
generated_bundle ----| generated_bundle_gift_bag >---- gift_bag_option

analytics_event (standalone, no FK to generated_bundle -- intentional for survivability)
```

### 5.2 Product Entity

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | BIGSERIAL | PK | Auto-generated |
| `sku` | VARCHAR(50) | NOT NULL, UNIQUE | Stock keeping unit |
| `name` | VARCHAR(100) | NOT NULL | Display name |
| `description` | TEXT | nullable | Long description |
| `image_url` | VARCHAR(500) | nullable | Product image URL |
| `cost` | NUMERIC(10,2) | NOT NULL | Raw product cost |
| `cog_overhead` | NUMERIC(10,2) | NOT NULL | Overhead per unit |
| `cog_adjusted` | NUMERIC(10,2) | NOT NULL | cost + cog_overhead |
| `retail_price` | NUMERIC(10,2) | NOT NULL | Computed from cog_adjusted via tiered formula |
| `inventory_quantity` | INTEGER | NOT NULL | Current stock level |
| `active` | BOOLEAN | NOT NULL, default true | Soft delete flag |
| `min_age` | SMALLINT | NOT NULL | Minimum child age |
| `max_age` | SMALLINT | NOT NULL | Maximum child age |
| `category` | VARCHAR(30) | NOT NULL | Enum: ProductCategory |
| `form_factor` | VARCHAR(30) | NOT NULL | Enum: FormFactor |
| `upgrade_tier` | VARCHAR(20) | NOT NULL | Enum: STANDARD or PREMIUM |
| `theme_code` | VARCHAR(50) | nullable | Optional theme grouping |
| `created_at` | TIMESTAMPTZ | NOT NULL | Set by @PrePersist |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Set by @PrePersist / @PreUpdate |

### 5.3 Budget Tier

| Column | Type | Description |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `code` | VARCHAR(10) | Unique tier code (e.g., "SUB1", "MID") |
| `retail_min` | NUMERIC(10,2) | Minimum retail price for this tier |
| `retail_max` | NUMERIC(10,2) | Maximum retail price for this tier |
| `max_item_cogs` | NUMERIC(10,2) | Max COGS per item in this tier |
| `target_retail_price` | NUMERIC(10,2) | Default ceiling used in simulation |
| `active` | BOOLEAN | Whether this tier is available for generation |

### 5.4 Bundle Template and Slots

**bundle_template**: Defines a named template (code, name, age range, active flag) with a list of ordered slots.

**bundle_template_slot**: Each slot has a `slot_code`, `display_order`, `required` flag, and a set of allowed roles stored in the `bundle_template_slot_role` join table (ElementCollection).

### 5.5 Generated Bundle (Snapshot Aggregate)

**generated_bundle**: Root entity capturing the full context of a generation request (age, audience, interest, party type, budget tier, template, computed base retail price, total COGS snapshot, status, timestamps). Identified externally by `public_id` (format: `gb_<12-char-hex>`).

**generated_bundle_item**: One per template slot filled. Stores product snapshots (name, SKU, cost, description, form factor) plus slot metadata.

**generated_bundle_upgrade**: Zero or one per bundle. Contains optional standard product snapshot and optional premium product snapshot with their respective retail price adjustments.

**generated_bundle_gift_bag**: Zero or one per bundle. Snapshots the selected gift bag option (name, cost, retail price adjustment, default flag).

### 5.6 Analytics Event

Standalone table with no foreign keys to other entities. Fields: `event_type`, `session_id`, `bundle_id` (as VARCHAR, not FK), `metadata_json` (freeform TEXT), `created_at`. Indexed on `event_type` and `created_at`.

---

## 6. Configuration and Environment Setup

### 6.1 Application Configuration (`application.yaml`)

```yaml
spring:
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/goodiebag}
    username: ${DATABASE_USERNAME:goodiebag}
    password: ${DATABASE_PASSWORD:goodiebag}
  jpa:
    hibernate.ddl-auto: validate
    open-in-view: false
  flyway.enabled: true

server.port: 8080

app:
  cors.allowed-origin: ${CORS_ALLOWED_ORIGIN:http://localhost:5173}
  admin.username: ${ADMIN_USERNAME:admin}
  admin.password: ${ADMIN_PASSWORD:changeme}

management:
  endpoints.web.exposure.include: health
  endpoint.health.show-details: never
```

### 6.2 Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/goodiebag` | JDBC connection URL |
| `DATABASE_USERNAME` | `goodiebag` | Database user |
| `DATABASE_PASSWORD` | `goodiebag` | Database password |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (Vite dev server) |
| `ADMIN_USERNAME` | `admin` | HTTP Basic admin username |
| `ADMIN_PASSWORD` | `changeme` | HTTP Basic admin password (plaintext, `{noop}` prefix) |

### 6.3 CORS Configuration

- Allowed origins: Single configurable origin (not wildcard).
- Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS.
- Allowed headers: `*`.
- Credentials: `false` (no cookies/auth headers sent cross-origin from browser -- admin uses explicit Authorization header).
- Max age: 3600 seconds.

### 6.4 Database Migrations

23 Flyway migrations (V1 through V23) covering:

| Range | Purpose |
|---|---|
| V1 | Baseline (no-op) |
| V2-V5 | Original catalog schema (product, bundle, bundle_item, bundle_tag) with party tag taxonomy |
| V6 | Major schema pivot: drops old bundle tables, expands product, adds dynamic generation tables (affinity tables, budget_tier, bundle_template, generated_bundle, gift_bag_option) |
| V7-V9 | Catalog seed data and fixes for budget tiers and templates |
| V10-V18 | Product data batches (adding products incrementally) |
| V19-V22 | Add retail_price, cog_overhead, cog_adjusted columns; fix pricing formulas |
| V23 | Analytics event table |

### 6.5 Testing Infrastructure

- **Testcontainers**: Integration tests use `spring-boot-testcontainers` with a PostgreSQL container. Tests annotated with `@Testcontainers` and `@SpringBootTest` get an ephemeral database.
- **WebMvc slice tests**: `@WebMvcTest` with `MockMvc` for controller-level unit tests.
- **Test data**: SQL scripts under `src/test/resources/` (`catalog-test-seed.sql`, `catalog-test-cleanup.sql`, `generation-test-seed.sql`, `generation-test-cleanup.sql`) loaded via `@Sql` annotations.

---

## 7. Dependencies and Their Purposes

### 7.1 Runtime Dependencies

| Dependency | Artifact | Purpose |
|---|---|---|
| Spring Boot Starter Web MVC | `spring-boot-starter-webmvc` | Embedded Tomcat, Spring MVC, JSON serialization (Jackson) |
| Spring Boot Starter Data JPA | `spring-boot-starter-data-jpa` | JPA/Hibernate ORM, Spring Data repositories |
| Spring Boot Starter Validation | `spring-boot-starter-validation` | `@Valid`, `@NotNull`, `@Min`, `@Max`, `@Size`, `@DecimalMin` annotations |
| Spring Boot Starter Security | `spring-boot-starter-security` | HTTP Basic auth, security filter chain |
| Spring Boot Starter Actuator | `spring-boot-starter-actuator` | `/actuator/health` endpoint |
| Spring Boot Starter Flyway | `spring-boot-starter-flyway` | Auto-run Flyway migrations on startup |
| Flyway PostgreSQL | `flyway-database-postgresql` | PostgreSQL dialect for Flyway |
| PostgreSQL Driver | `postgresql` (runtime scope) | JDBC driver |

### 7.2 Test Dependencies

| Dependency | Artifact | Purpose |
|---|---|---|
| Spring Boot Starter Test | `spring-boot-starter-test` | JUnit 5, Mockito, AssertJ, `@SpringBootTest` |
| Spring Security Test | `spring-security-test` | `@WithMockUser`, security test utilities |
| Spring Boot Testcontainers | `spring-boot-testcontainers` | Auto-configured Testcontainers support |
| Testcontainers JUnit Jupiter | `testcontainers-junit-jupiter` | `@Testcontainers` lifecycle management |
| Testcontainers PostgreSQL | `testcontainers-postgresql` | PostgreSQL container module |
| Spring Boot WebMvc Test | `spring-boot-starter-webmvc-test` | `@WebMvcTest`, `MockMvc` |

### 7.3 Build Plugins

| Plugin | Purpose |
|---|---|
| `spring-boot-maven-plugin` | Package executable JAR, run the app via `mvn spring-boot:run` |

---

## 8. Retail Price Formula

The server-side retail price is computed from `cogAdjusted` (= cost + cogOverhead) using a piecewise formula in `AdminProductController.computeRetailPrice()`:

| cogAdjusted Range | Formula | Example |
|---|---|---|
| < $1.00 | Fixed $0.50 | cogAdjusted = $0.80 -> retail = $0.50 |
| $1.00 - $3.99 | cogAdjusted / 2 | cogAdjusted = $2.00 -> retail = $1.00 |
| $4.00 - $9.99 | cogAdjusted / 3 + 2/3 | cogAdjusted = $6.00 -> retail = $2.67 |
| >= $10.00 | cogAdjusted * 0.4 | cogAdjusted = $15.00 -> retail = $6.00 |

---

## 9. Scoring Formula

`ProductScoringService.score()` computes a total score per product per slot:

```
total = interestScore + audienceAdjustment + roleScore
```

- **interestScore**: Weight (0-100) from `product_interest_affinity` for the requested interest. 0 if no affinity row exists.
- **audienceAdjustment**:
  - Matching gender affinity (FEMININE request + FEMININE product, or MASCULINE + MASCULINE): +15
  - UNIVERSAL affinity: +8
  - Mismatched gender (e.g., FEMININE request + MASCULINE-only product): -5
  - NO_PREFERENCE: only universal bonus applies
  - Uses `max()` to avoid double-counting when both specific and universal affinities exist
- **roleScore**: Best matching role weight from `product_role_affinity` for the slot's allowed roles, scaled to 0-20 range (weight * 20 / 100).
