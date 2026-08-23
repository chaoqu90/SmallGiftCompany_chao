# Phase 7 — Admin + Funnel Analytics

_Re-baselined 2026-08-20 against the current implementation. The original spec predated Phases 3–6 and assumed infrastructure that does not yet exist. This file is now the authoritative spec._

---

## Scope Split

Phase 7 is split into two tracks aligned with phase readiness.

### Track A — No external dependencies (implement now)

| Item | Description |
|---|---|
| Admin auth | HTTP Basic, credentials from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars |
| `/admin/products` | List all products; edit inventory quantity; activate/deactivate |
| `/admin/bundles` | List generated bundles; inspect full bundle snapshot |
| Analytics event table | Capture `FINDER_COMPLETED` and `BUNDLE_VIEWED` |
| Admin dashboard | Counts for Finder completions and bundle views |

### Track B — Blocked (defer to the named phase)

| Item | Blocked by |
|---|---|
| `/admin/orders` | Phase 6 (checkout/payment) |
| `/admin/leads`, `/admin/campaigns` | Phase 4 (campaign/leads/passes) |
| `CAMPAIGN_PAGE_VIEW`, `LEAD_*`, `PASS_*` analytics events | Phase 4–5 |
| `CHECKOUT_STARTED`, `ORDER_PAID` analytics events | Phase 6 |
| Campaign dashboard metrics (unique leads, passes issued, revenue) | Phase 4–6 |

---

## Admin Pages (Track A)

### `/admin/products`

Minimum functionality:
- List all products with: SKU, name, active status, inventory quantity, retail price, upgrade tier
- Edit inventory quantity inline
- Toggle active / inactive
- Read-only: cost, cog fields, age range, category

### `/admin/bundles`

Minimum functionality:
- List generated bundles: public ID, requested age, interest, party type, template, base retail price, created at, status
- Drill into a bundle to inspect the full item snapshot (slot code, product name, SKU, form factor)

### `/admin/dashboard`

Minimum viable metrics (Track A):
- Gift Finder completions (count of `FINDER_COMPLETED` events)
- Bundle views (count of `BUNDLE_VIEWED` events)

Full metrics deferred to Track B completion:
- QR/landing visits, unique leads, passes issued/redeemed, add-to-cart, checkout starts, paid orders, revenue

---

## Admin Auth

- Mechanism: HTTP Basic auth
- Credentials from environment variables `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- Local dev defaults: `admin` / `changeme` (never use in production)
- All `/admin/api/**` endpoints require authentication; `/api/**` remains public
- No persistent session — stateless per request

---

## Analytics Events

### Event table schema

```sql
analytics_event (
  id           BIGSERIAL PRIMARY KEY,
  event_type   VARCHAR(50) NOT NULL,
  session_id   VARCHAR(100),
  bundle_id    VARCHAR(30),        -- nullable; public_id of generated_bundle
  metadata_json TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

`bundle_id` is a VARCHAR reference (not FK) so events survive bundle deletion and are insertable without a bundle context.

### Track A events

| Event type | When fired | Who fires |
|---|---|---|
| `FINDER_COMPLETED` | After `generateBundle()` resolves successfully in `GiftFinder` | Frontend |
| `BUNDLE_VIEWED` | When `BundleCustomizationPage` mounts with a valid bundle | Frontend |

### Track B events (deferred)

| Event type | Trigger | Phase |
|---|---|---|
| `CAMPAIGN_PAGE_VIEW` | Campaign landing page load | Phase 4 |
| `LEAD_CREATED` | Lead form submitted | Phase 4 |
| `PASS_CREATED` | Pass issued | Phase 4 |
| `PASS_REDEEMED` | Pass redeemed on iPad | Phase 5 |
| `CHECKOUT_STARTED` | Checkout flow entered | Phase 6 |
| `ORDER_PAID` | Payment confirmed | Phase 6 |

### Capture endpoint

```
POST /api/analytics/events
```

Public — no auth required (browser fires from anonymous sessions).

Request body:
```json
{
  "eventType": "FINDER_COMPLETED",
  "bundleId":  "gb_abc123",
  "sessionId": "session-xyz",
  "metadataJson": null
}
```

Response: `201 Created`. Fire-and-forget from the frontend — errors are swallowed silently so analytics never blocks the user experience.

---

## Acceptance Criteria

### Track A (testable now)

- [ ] Unauthenticated request to `/admin/api/**` returns `401`
- [ ] Authenticated request with valid credentials returns data
- [ ] Inventory quantity update persists and is reflected in subsequent GET
- [ ] Deactivating a product excludes it from bundle generation
- [ ] `FINDER_COMPLETED` event is stored when GiftFinder successfully generates a bundle
- [ ] `BUNDLE_VIEWED` event is stored when BundleCustomizationPage loads a bundle
- [ ] Dashboard counts match the number of stored events
- [ ] Analytics endpoint accepts unknown event types without erroring (forward-compatible)
- [ ] Refreshing BundleCustomizationPage fires only one `BUNDLE_VIEWED` (useEffect with correct deps)

### Track B (deferred — check when each phase ships)

- [ ] Public customer cannot access admin APIs (preserved from Track A)
- [ ] Order detail displays final item selections
- [ ] Leads do not expose more data than needed
- [ ] Campaign totals reconcile with raw event rows
- [ ] Revenue is calculated from paid orders, not from client events

---

## How to Check Track A

1. Start backend, run `POST /api/generated-bundles` — confirm `FINDER_COMPLETED` appears in `analytics_event`
2. Load `/bundleCustomization/{id}` — confirm `BUNDLE_VIEWED` appears in `analytics_event`
3. Hit `/admin/api/dashboard` without credentials — confirm `401`
4. Hit `/admin/api/dashboard` with `admin:changeme` — confirm counts match DB rows
5. Update inventory via `PATCH /admin/api/products/{id}/inventory` — confirm DB row updated
6. Deactivate a product — generate a bundle — confirm deactivated product is not in any slot
7. Reload `/bundleCustomization/{id}` multiple times — confirm only one `BUNDLE_VIEWED` per session load

---

## Common AI Mistakes to Catch

- Admin protected only by hiding navigation links, not by server-side auth
- Analytics events containing full request bodies or PII in `metadataJson`
- Revenue calculated from client events rather than authoritative order records
- Double-counting page refreshes as conversions (check useEffect dependency array)
- CORS misconfiguration that blocks analytics events from the browser

---

## AI Can Write (Track A)

- CRUD admin API endpoints (products, bundles, dashboard)
- Spring Security HTTP Basic config
- Analytics event entity, repository, service, capture endpoint
- Admin React pages (login, products, bundles, dashboard) using MUI Table
- Frontend event capture calls (fire-and-forget)
- Integration tests for admin auth, inventory update, event capture

## Human Must Do

- Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in production environment (never use defaults)
- Decide who receives admin access
- Inspect whether event counts match business reality
- Review access control before exposing admin to any non-developer
- Verify analytics events do not contain sensitive personal data
