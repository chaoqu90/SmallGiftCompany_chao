# Phase 5 — iPad Kid Helper Redemption

## Goal

A child helper can redeem a Punch Pass with almost no judgment or troubleshooting.

The page is a responsive web app, NOT a native iPad app.

## Primary UI States

### Idle
```text
PUNCH & WIN

[ SCAN PASS ]

Enter code instead:
[____]

Adult Help
```

### Successful
```text
✅
LET'S PLAY!
ONE PUNCH

[NEXT PLAYER]
```

### Already Used
```text
⭐
ALREADY PLAYED
Ask a grown-up

[NEXT PLAYER]
```

### Invalid/Error
```text
🙂
CAN'T FIND THIS PASS
Ask a grown-up

[NEXT PLAYER]
```

## Critical Backend Rule: Atomic Redemption

Do NOT:

1. SELECT status.
2. If AVAILABLE, UPDATE.

Two devices could race.

Use a conditional atomic update conceptually like:

```sql
UPDATE redemption
SET status = 'REDEEMED',
    redeemed_at = NOW()
WHERE token = :token
  AND status = 'AVAILABLE';
```

Exactly one updated row means success.

The short-code fallback should ultimately invoke the same redemption service.

## Suggested APIs

```http
POST /api/redemptions/token/{token}/redeem
POST /api/redemptions/code/{shortCode}/redeem
```

Protect helper endpoints appropriately so random public clients cannot mass-redeem passes.

## AI Can Write

- scanner UI;
- browser-camera integration;
- manual-code fallback;
- redemption endpoints;
- atomic repository update;
- helper authentication/session;
- full-screen kid-friendly states;
- automatic reset or explicit NEXT PLAYER behavior;
- tests.

## Human Must Do

- test iPad camera permission;
- decide how helper page is authenticated at an event;
- physically test scan distance/lighting;
- decide where an adult stands for exceptions;
- test actual 7-year-old usability.

## Acceptance Criteria

- QR scan works on the target iPad/browser;
- manual 4-character fallback works;
- first redemption succeeds;
- second redemption fails as already used;
- two near-simultaneous redemption requests cannot both succeed;
- successful screen is obvious from several feet away;
- next customer can be processed quickly;
- child never sees customer email, database details, or technical errors.

## How I Should Check

### Manual Field Test
Use:
- parent phone;
- second phone;
- iPad.

Test:
1. normal scan;
2. repeat same QR;
3. manual fallback;
4. wrong code;
5. camera permission denied;
6. temporary network failure;
7. two devices scan same pass simultaneously;
8. 10–20 consecutive customers;
9. let the child helper operate after minimal instruction.

### Automated
Backend:
- atomic concurrency/integration test;
- redeemed/invalid response tests;
- authorization tests.

Frontend:
- UI state tests;
- scanner error fallback;
- reset behavior.

## Common AI Mistakes to Catch

- scanner page publicly able to redeem with no staff control;
- verbose technical error messages;
- showing personally identifying information to the child;
- no fallback when camera permission fails;
- non-atomic redemption.
