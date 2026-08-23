# Goodie Bag MVP — AI-Assisted Build Master Plan

## 1. Product Goal

Build a production-usable MVP for a children's goodie-bag business with two connected customer journeys:

### Commerce journey
1. Visitor opens the site without signing in.
2. Visitor answers a short Gift Finder.
3. Visitor sees filtered goodie-bag bundles.
4. Visitor opens a bundle and sees included party favors.
5. Visitor may replace only items explicitly marked as replaceable.
6. Visitor chooses number of bags.
7. Backend validates inventory and pricing.
8. Visitor checks out as a guest.
9. Visitor pays by Apple Pay or card through Stripe.
10. Order is saved and confirmation email is sent.

### Booth / field-marketing journey
1. Parent scans a campaign QR code.
2. Parent enters email.
3. System creates or finds a Lead.
4. System creates a one-time Punch Pass.
5. Parent immediately sees a QR pass plus a 4-character fallback code.
6. A branded email containing the pass is sent.
7. A Kid Helper uses an iPad web page to scan the QR or enter the code.
8. Redemption is atomically marked as used.
9. Green screen = "LET'S PLAY"; all other states escalate to an adult.

## 2. MVP Principles

- One React frontend.
- One Spring Boot backend.
- One PostgreSQL database.
- Modular monolith, not microservices.
- Guest checkout first; no customer account in MVP.
- Admin authentication only.
- PostgreSQL, not MongoDB.
- Stripe handles card/Apple Pay data.
- Transactional email through Amazon SES or another approved provider.
- QR redemption contains a long unguessable token; 4-character code is fallback only.
- No child name, birthday, school, class, or unnecessary child personal information.
- "Parent email" is the lead identity for MVP.
- Marketing consent is separate from receiving the one-time Punch Pass.
- Shipping-label automation is optional after the core MVP works.

## 3. How the Coding AI Should Work

The coding AI MUST work phase by phase.

Before changing code:
1. Read this file.
2. Read the current phase Markdown file.
3. Inspect the existing repository.
4. State which files will be added or changed.
5. Make the smallest coherent implementation.
6. Add/update tests.
7. Run tests and build.
8. Report remaining manual checks.

Do NOT implement future-phase features early unless they are necessary interfaces/stubs.

Do NOT:
- create microservices;
- introduce Kafka, Redis, Kubernetes, Elasticsearch, GraphQL, or AI recommendation systems;
- store raw credit-card information;
- trust prices supplied by the browser;
- let a redemption be redeemed with a non-atomic read-then-write sequence;
- make email marketing consent implicit;
- add customer login unless explicitly requested.

## 4. Human vs AI Responsibility

### AI is well suited for
- project scaffolding;
- DTOs, controllers, services, repositories;
- React pages/components;
- forms and validation;
- Flyway migrations;
- unit/integration tests;
- Stripe/SES client integration code;
- QR generation and scanner page code;
- CI workflows;
- Docker files;
- README/runbooks;
- repetitive admin CRUD.

### Human owner MUST decide or perform
- AWS/Stripe accounts and legal ownership;
- domain and DNS;
- production secrets;
- Stripe/Apple Pay domain verification;
- SES identity/domain verification and production-access requests if needed;
- actual pricing, taxes, inventory counts, fulfillment rules;
- campaign copy and marketing consent wording;
- privacy policy / terms / refund / shipping policies;
- real-device testing;
- real payment tests;
- booth workflow testing with the child helper;
- go/no-go launch decision.

AI may propose these values but must not invent production credentials or pretend external configuration succeeded.

## 5. Phase Order

1. `01_FOUNDATION.md`
2. `02_CATALOG_GIFT_FINDER.md`
3. `03_BUNDLE_CUSTOMIZATION_CART.md`
4. `04_CAMPAIGN_LEADS_PUNCH_PASS.md`
5. `05_IPAD_REDEMPTION.md`
6. `06_CHECKOUT_PAYMENT_INVENTORY.md`
7. `07_ADMIN_ANALYTICS.md`
8. `08_DEPLOYMENT_SECURITY.md`
9. `09_END_TO_END_TEST_PLAN.md`
10. `10_LAUNCH_RUNBOOK.md`

## 6. Definition of MVP Done

The MVP is done only when all of the following work on production-like infrastructure:

- Campaign QR opens the correct landing page.
- Parent can submit email.
- Lead is stored without duplicate lead rows for the same normalized email.
- One-time pass is created.
- Pass is displayed immediately.
- Pass email arrives.
- iPad scanner can redeem it.
- Duplicate redemption is rejected.
- Gift Finder returns appropriate bundles.
- Bundle can be customized only through allowed replacements.
- Quantity affects required inventory.
- Server validates price and stock.
- Card payment succeeds in Stripe test mode.
- Apple Pay works on an eligible real device/browser in the configured environment.
- Stripe webhook transitions order to paid exactly once.
- Historical order stores a product/price snapshot.
- Confirmation email arrives.
- Admin can view/update inventory and see orders/leads.
- Logs are available.
- Database has backups.
- Core flow is tested on iPhone and iPad.
