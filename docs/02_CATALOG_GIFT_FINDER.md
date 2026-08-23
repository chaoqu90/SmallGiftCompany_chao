# Phase 2 — Catalog + Gift Finder

## Goal

A visitor can answer 3–4 lightweight questions and receive filtered, browsable bundles.

## Core Entities

```text
Product
- id
- sku
- name
- description
- imageUrl
- unitCost (admin/internal)
- inventoryQuantity
- active

Bundle
- id
- name
- description
- basePrice
- imageUrl
- active

BundleItem
- id
- bundleId
- productId
- quantityPerBundle
- replaceable

BundleTag
- bundleId
- tag
```

Possible tags:
- AGE_3_5
- AGE_6_8
- AGE_9_12
- CREATIVE
- ANIMALS
- ADVENTURE
- MAGICAL
- ACTIVE
- BUDGET_UNDER_8
- BUDGET_8_12
- BUDGET_12_18

## Suggested APIs

```http
GET /api/bundles
GET /api/bundles/{bundleId}
```

Query filters may include:

```text
ageRange
interest
partyType
maxPrice
```

## AI Can Write

- Flyway migrations.
- JPA entities/repositories.
- service-layer filtering.
- public DTOs.
- seeded development data.
- Gift Finder React flow.
- Bundle Gallery.
- filter chips/dropdowns.
- empty/loading/error states.
- unit and integration tests.

## Human Must Do

- Decide actual filter taxonomy.
- Decide actual products and bundles.
- Supply/licence product photos.
- Decide real prices.
- Review age appropriateness and product safety claims.
- Verify wording is parent-facing and not collecting unnecessary child data.

## Important Product Rule

The Gift Finder does NOT "generate" a bundle in MVP.

It converts answers into filters and ranks/selects from preconfigured bundles.

## Acceptance Criteria

- user can skip login entirely;
- Gift Finder completes in under roughly 30 seconds in normal use;
- filters can be modified on gallery page;
- inactive bundles never appear;
- API does not expose internal cost;
- direct URL to a bundle works;
- no-results state offers a way to broaden filters.

## How I Should Check

### Manual
Test combinations:
- age 6–8 + creative;
- age 6–8 + animals;
- high budget;
- filters that yield no results;
- clear filters;
- browser refresh;
- direct bundle URL.

### Automated
Backend:
- filter inclusion/exclusion tests;
- inactive bundle test;
- price-boundary test.

Frontend:
- Gift Finder answer state;
- URL/query-state behavior if used;
- gallery rendering;
- error/empty state.

## Common AI Mistakes to Catch

- using gender as the only recommendation signal;
- building an AI recommender unnecessarily;
- exposing `unitCost`;
- hard-coding bundles only in React;
- filtering differently in frontend and backend.
