---
name: Redemption code system for signup-promotion
description: 6-digit unique redemption codes added to future_parties for fair booth scanning
type: project
---

Redemption codes are a 6-digit numeric varchar(6) column on future_parties, generated only for rows where source = 'signup-promotion'. All other rows have redemption_code = NULL.

**Why:** Loudoun Children's Business Fair booth (Saturday, September 12, 2026, 11 AM–3 PM). Admin staff scan / type the code at the booth to mark a gift as redeemed.

**How to apply:** The admin redeem endpoint is POST /admin/api/future-parties/redeem with body { code: string }. It must be registered BEFORE the parameterised /:id/... routes in Express so "redeem" is not mistaken for an integer id. The redeemed_at timestamptz column is set by markRedeemed() in the repository.
