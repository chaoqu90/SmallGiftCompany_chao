# Phase 3 — Bundle Customization + Cart

## Goal

The visitor can inspect a bundle, swap only allowed items, choose the number of bags, and add the exact configuration to a guest cart.

## Additional Entity

```text
ReplacementOption
- id
- bundleItemId
- replacementProductId
- priceAdjustment
- active
```

## Business Rules

- Some BundleItems are fixed.
- Only `replaceable=true` items can be changed.
- A replacement must appear in that BundleItem's allowed replacement list.
- A replacement may have a price adjustment.
- Customer selects quantity of complete goodie bags.
- Cart can live in localStorage in MVP.
- Backend is authoritative for valid configuration and price.

## Suggested Cart Representation

Frontend may store identifiers only:

```json
{
  "bundleId": 27,
  "quantity": 20,
  "selections": [
    {
      "bundleItemId": 72,
      "selectedProductId": 181
    }
  ]
}
```

## AI Can Write

- bundle-detail UI;
- replacement modal/drawer;
- quantity selector;
- localStorage cart hook/state;
- backend validation endpoint;
- price calculation service;
- configuration DTOs;
- tests for allowed/forbidden replacements.

## Human Must Do

- decide which items are replaceable;
- map replacement choices;
- confirm replacement price adjustments;
- physically confirm substituted items still fit packaging/brand expectations.

## Suggested Validation API

```http
POST /api/cart/validate
```

Backend should return:
- normalized configuration;
- authoritative unit price;
- subtotal;
- inventory availability;
- validation errors.

## Acceptance Criteria

- fixed item cannot be replaced by manipulating the browser request;
- unlisted replacement is rejected;
- price adjustment is calculated on server;
- cart survives refresh;
- quantity is validated;
- invalid/inactive product is rejected;
- UI clearly shows the final contents.

## How I Should Check

### Manual Abuse Tests
Using browser devtools/Postman:
1. Change a fixed product ID.
2. Send a replacement not in allowed list.
3. Send negative quantity.
4. Send huge quantity.
5. Change frontend-displayed price.
6. Disable a product and retry.

Expected: backend rejects or recalculates correctly.

### Automated
- replacement authorization tests;
- calculation tests;
- invalid quantity tests;
- inactive item tests;
- cart serialization tests.

## Common AI Mistakes to Catch

- trusting frontend `price`;
- storing only the final bundle ID without selections;
- allowing arbitrary catalog products as substitutions;
- mutable cart objects causing stale UI state.
