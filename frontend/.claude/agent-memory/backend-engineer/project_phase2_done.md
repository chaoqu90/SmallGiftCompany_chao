---
name: Phase 2 dynamic bundle generation done
description: Full dynamic bundle generation system implemented; V6+V7 migrations, all entities, services, controller, tests — 59/59 passing
type: project
---

Dynamic bundle generation engine is complete and all tests pass.

**What was built:**
- Migrations V6 (schema) and V7 (seed) applied to local dev DB
- 8 Java enums: Interest, AudiencePreference, AudienceAffinity, PartyType, BundleRole, FormFactor, UpgradeTier, ProductCategory
- 13 JPA entities with @IdClass composite PKs for affinity tables
- 9 Spring Data repositories
- 5 services: ProductEligibilityService, ProductScoringService, BundleTemplateSelector, UpgradeGenerationService, BundleGenerationService (greedy + feasibility check), GeneratedBundleService (facade)
- POST /api/generated-bundles → 201; GET /api/generated-bundles/{publicId} → 200/404
- BundleGenerationException → HTTP 422 registered in GlobalExceptionHandler
- Test resources: generation-test-seed.sql + generation-test-cleanup.sql
- 59 tests: 13 integration, 8 scoring unit, 9 eligibility unit, 7 generation service unit, existing health tests

**Key design decisions:**
- publicId = "gb_" + first 12 chars of UUID (no hyphens)
- GeneratedBundle persisted first to get PK, children cascade-saved on second save
- Feasibility check is optimistic (shared remaining budget across future slots)
- Upgrade always saved even if no PREMIUM product found (null product fields)
- GeneratedBundleGiftBag uses @MapsId to share PK with generated_bundle

**Why:** Owner asked to retire predefined-bundle model in favour of dynamic generation.
**How to apply:** All new bundle endpoints under /api/generated-bundles; never expose product.cost or budget.maxItemCogs to frontend.
