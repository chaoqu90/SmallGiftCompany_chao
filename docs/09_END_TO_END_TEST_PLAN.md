# Phase 9 — End-to-End Test Plan

## Purpose

This file is the human launch gate. Unit tests passing is NOT enough.

## Test Environments

Have at least:
- local development;
- staging / production-like environment;
- Stripe test mode.

Test on:
- iPhone Safari;
- iPad Safari;
- at least one desktop browser.

## Scenario A — Booth Happy Path

1. Open campaign QR.
2. Enter new parent email.
3. Leave marketing checkbox unchecked.
4. Submit.
5. Confirm pass appears immediately.
6. Confirm QR and 4-character code both appear.
7. Confirm email arrives.
8. Open Kid Helper on iPad.
9. Scan pass.
10. Verify green "LET'S PLAY".
11. Press NEXT PLAYER.
12. Scan same pass again.
13. Verify "ALREADY PLAYED".

PASS only if all steps work.

## Scenario B — Marketing Consent

Repeat with marketing checkbox checked.

Verify:
- consent true;
- consent timestamp populated;
- source/campaign stored.

Repeat unchecked:
- consent false;
- no false consent timestamp.

## Scenario C — Duplicate Lead

Submit:
- `Parent@Example.com`
- `parent@example.com`

Verify:
- one normalized Lead;
- campaign claim behavior follows chosen one-pass rule.

## Scenario D — Gift Finder

Test multiple age/interest/budget combinations.

Verify:
- expected bundles;
- edit filters;
- no-results path;
- direct page refresh.

## Scenario E — Customization Abuse

Try:
- fixed-item replacement;
- unlisted replacement;
- inactive product;
- frontend price edit;
- negative quantity.

Verify backend rejects/recalculates.

## Scenario F — Inventory

Create known stock:
- Product A: 10
- Product B: 30
- Bundle consumes A×1, B×2

Check:
- 10 bags are allowed;
- 11 bags are blocked;
- replacement stock changes availability correctly.

## Scenario G — Payment

Stripe test mode:
- successful card;
- declined card;
- abandon flow;
- repeat webhook;
- refresh during checkout.

Verify:
- exactly one paid order;
- exactly one effective inventory deduction;
- confirmation email sent as expected.

## Scenario H — Order Snapshot

1. Complete paid order.
2. Change bundle product name/price/replacement.
3. Re-open historical order.

Verify historical order still displays the originally purchased configuration and price.

## Scenario I — Field Stress Test

Simulate 10–20 customers in sequence.

Measure informally:
- time from email submit to pass;
- time from QR presentation to green screen;
- ease of NEXT PLAYER;
- queue confusion;
- child-helper questions.

Test:
- bad Wi-Fi;
- camera denied;
- screen brightness;
- repeated QR;
- manual code;
- two scanners attempting same pass.

## Scenario J — Recovery

Verify you know what to do if:
- Stripe works but confirmation email fails;
- SES works slowly;
- iPad camera fails;
- internet becomes unreliable;
- backend is unhealthy;
- inventory was entered incorrectly.

## Automated Test Expectations

Backend:
- domain/service unit tests;
- repository integration tests;
- controller validation tests;
- atomic redemption test;
- webhook idempotency test;
- inventory concurrency/conditional-update tests.

Frontend:
- critical component tests;
- route tests;
- cart-state tests;
- helper-state tests.

Optional after core stability:
- Playwright/Cypress for customer happy path.

## Launch Gate

Do not launch solely because AI says "all done."

Human owner must confirm:
- automated tests pass;
- clean build passes;
- real devices pass;
- email passes;
- Stripe test passes;
- admin workflow passes;
- child helper can use redemption flow.
