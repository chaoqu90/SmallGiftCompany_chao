# Phase 10 — Event Launch Runbook

## Day Before Event

### Product / Business
- confirm active bundles;
- confirm real prices;
- confirm inventory counts;
- confirm campaign dates;
- confirm offer/reward rules;
- confirm privacy/marketing copy.

### Technical
- production health green;
- database backup confirmed;
- CloudWatch/logging available;
- SES sending works;
- Stripe status/config checked;
- campaign QR tested from printed material;
- iPad helper login tested;
- iPad charger/power bank packed;
- fallback manual short-code redemption works.

## Event Morning

Run one full synthetic customer:

```text
QR
→ email
→ Punch Pass
→ pass email
→ iPad redemption
→ Gift Finder
→ bundle
→ cart
→ checkout test path if appropriate
```

## Kid Helper Rule

Child helper only needs:

```text
SCAN
↓
GREEN = ONE PUNCH
↓
NEXT PLAYER
```

Anything else:

```text
ASK A GROWN-UP
```

The child should not:
- search customers;
- inspect emails;
- handle payment issues;
- decide fraud;
- debug network problems;
- enter admin screens.

## Adult Fallback

Keep an adult-accessible fallback page or process for:
- wrong code;
- already used dispute;
- parent typed wrong email;
- camera problem;
- no network;
- accidental refresh.

Do not block the line trying to debug one customer.

## Post-Event Review

Record:

```text
landing visits
unique leads
passes created
passes redeemed
Gift Finder completions
bundle views
add-to-cart
checkout starts
paid orders
revenue
```

Also write qualitative notes:
- What confused parents?
- What confused the child helper?
- Which bundles got attention?
- Which offer wording worked?
- Did people hesitate at email capture?
- Did the booth line move quickly?

## AI Can Help Afterward

Give the AI:
- anonymized funnel counts;
- bug list;
- user-feedback notes;
- screenshots without sensitive data.

Ask it to:
- cluster issues;
- identify highest-impact fixes;
- write regression tests before fixes;
- propose next sprint.

## Human Must Decide

- whether the acquisition funnel is working;
- whether prize cost is justified;
- whether products/pricing are attractive;
- whether to add SMS later;
- whether to invest in shipping automation/customer accounts.
