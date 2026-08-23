---
name: Generated Bundles API migration
description: Old /api/bundles endpoints removed; all bundle logic now goes through POST/GET /api/generated-bundles
type: project
---

The old GET /api/bundles and GET /api/bundles/:id endpoints no longer exist. All bundle functionality is served by:
- POST /api/generated-bundles (body: BundleGenerationRequest) → 201 GeneratedBundleResponse
- GET /api/generated-bundles/{publicId} → 200 GeneratedBundleResponse

Public IDs are strings with a "gb_" prefix (e.g. "gb_abc123456789"), not numeric.

**Why:** Backend was redesigned around AI-generated bundle recommendations keyed by audience/interest/partyType/budget rather than pre-seeded catalog rows.

**How to apply:** Never reference /api/bundles or the old BundleDto/BundleDetailDto types. Use src/api/generatedBundles.ts for all bundle fetching/generation. The standardItemCogsSnapshot field on GeneratedBundleResponse is internal COGS — never display it to users.
