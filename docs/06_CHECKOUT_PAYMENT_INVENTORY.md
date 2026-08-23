# Phase 6 — Checkout + Stripe + Inventory

## Goal

A guest can pay for a validated customized bundle order, and inventory/order state remains consistent.

## Core Principle

The server is authoritative for:
- bundle validity;
- replacement validity;
- price;
- tax inputs handled by chosen tax strategy;
- inventory;
- order status.

Never trust a total posted by React.

## Order Model

```text
Order
- id
- publicOrderNumber
- email
- status: PENDING_PAYMENT | PAID | CANCELLED | ...
- subtotal
- shipping
- tax
- total
- stripePaymentIntentId
- createdAt
- paidAt

OrderItem
- id
- orderId
- bundleId
- bundleNameSnapshot
- quantity
- unitPriceSnapshot

OrderItemSelection
- id
- orderItemId
- bundleItemId
- selectedProductId
- productNameSnapshot
- skuSnapshot
- quantityPerBundleSnapshot
- priceAdjustmentSnapshot
```

Historical orders MUST use snapshots so future catalog changes do not alter old orders.

## Inventory Calculation

For each selected Product:

```text
required units =
quantity of bags × quantityPerBundle
```

If a replacement changes the selected product, inventory requirement follows the selected product.

## Payment Flow

```text
React cart
  ↓
POST checkout/create
  ↓
server revalidates configuration + price + stock
  ↓
create PENDING_PAYMENT order
  ↓
create Stripe PaymentIntent
  ↓
React Stripe UI
  ↓
card / Apple Pay
  ↓
Stripe webhook
  ↓
verify webhook signature
  ↓
idempotently mark order PAID
  ↓
apply inventory action
  ↓
send confirmation email
```

## Inventory Strategy for MVP

Choose and document ONE clear strategy.

Possible simple strategy:
- validate stock at checkout creation;
- on confirmed payment, atomically decrement if sufficient;
- handle rare failure explicitly.

A stronger strategy:
- create short-lived reservation before payment;
- release expired reservations.

Do not let AI invent a half-reservation system. Keep it coherent.

## AI Can Write

- checkout DTO/controller/service;
- authoritative calculation;
- Stripe PaymentIntent integration;
- Stripe webhook endpoint;
- webhook signature verification;
- event idempotency table;
- order snapshot persistence;
- inventory conditional update;
- confirmation email trigger;
- tests using Stripe test-mode assumptions/mocks where appropriate.

## Human Must Do

- create Stripe account;
- configure keys;
- configure webhook endpoint;
- verify Apple Pay/domain requirements;
- decide tax approach;
- decide shipping-charge approach;
- conduct real test-mode payments;
- confirm refund/cancellation business rules;
- reconcile test orders in Stripe dashboard.

## Acceptance Criteria

- frontend price manipulation does not change charge;
- invalid replacement cannot be purchased;
- insufficient stock blocks checkout or payment finalization according to chosen strategy;
- successful webhook changes order exactly once;
- replayed webhook is harmless;
- failed payment does not mark order paid;
- no raw card number is stored or logged;
- historical order remains unchanged if catalog later changes;
- confirmation email is sent once.

## How I Should Check

### Stripe Test Cases
- successful card;
- declined card;
- abandoned payment;
- reload during payment;
- double-click checkout;
- webhook replay;
- delayed webhook;
- Apple Pay on eligible device/domain.

### Inventory Cases
- exact available quantity;
- one more than available;
- two customers competing;
- replacement with low stock;
- bundle containing 2 of same item per bag.

### Automated
- price calculation unit tests;
- order snapshot test;
- webhook idempotency integration test;
- stock conditional-update tests;
- controller validation tests.

## Common AI Mistakes to Catch

- using frontend total;
- marking PAID from browser success callback;
- no webhook signature verification;
- decrementing stock twice on webhook retry;
- not snapshotting item names/prices;
- logging Stripe secrets or sensitive payment details.
