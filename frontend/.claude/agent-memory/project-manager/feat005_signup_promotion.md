---
name: FEAT-005 Signup Promotion — execution summary
description: Completed 2026-09-07; all 9 tasks done; signup promo modal auto-opens on /build, email is fire-and-forget
type: project
---

Feature completed 2026-09-07. All 9 tasks delivered in 3 parallelised waves.

**Why:** Lead-capture at the Loudoun Children's Business Fair (Sept 12, 2026). Visitors landing on /build see a gift-offer modal and get a confirmation email immediately on submit.

**How to apply:** Reference this for any follow-on work touching the future_parties table source column, SignupPromotionModal, or the /build route.

## Tasks delivered

| ID | File(s) | Status |
|----|---------|--------|
| B1 | `backend-node/migrations/009_future_parties_source.ts` | done |
| B2 | `backend-node/src/repositories/futureParties.ts` (source field in FuturePartyRow, InsertFuturePartyData, INSERT) | done |
| B3 | `backend-node/src/types/dtos.ts` (source: z.literal('signup-promotion').optional() added to FuturePartyRequestSchema) | done |
| B4 | `backend-node/src/lib/email.ts` (sendSignupPromotionEmail + builders appended) | done |
| B5 | `backend-node/src/routes/futureParties.ts` (source passed to insert, fire-and-forget email, source in toFuturePartyDto) | done |
| F1 | `frontend/src/api/futureParties.ts` (source? added to FuturePartySubmission and FuturePartyResponse) | done |
| F2 | `frontend/src/components/SignupPromotionModal.tsx` (new standalone component) | done |
| F3 | `frontend/src/pages/HomePage.tsx` (promotionOpen state, useEffect on pathname, SignupPromotionModal rendered) | done |
| F4 | `frontend/src/App.tsx` (/build route added inside RootLayout) | done |

## Key constraints enforced

1. `sendSignupPromotionEmail` has `try/catch` with `console.warn` — SES errors are swallowed silently (opposite of sendFuturePartyEmail which re-throws).
2. Route handler: email call uses `.catch(() => {})` and is NOT awaited — 201 response is returned immediately after DB insert.
3. `source` column in migration 009 is nullable — existing rows unaffected.
4. `POST /api/future-parties` remains public — no basicAuth added.
5. `FuturePartyModal` was NOT modified; SignupPromotionModal is a fully standalone component.
6. useEffect dependency array in HomePage is `[pathname]` — not `[]` and not no-dep.

## Open issues / follow-ups

- No automated tests written; QA/e2e coverage for FEAT-005 is pending.
- Migration 009 must be run via `npm run migrate` before deploying the updated Lambda.
- The /build route is not registered in any server-side redirects (nginx/CloudFront) — confirm CDN is configured to pass /build to the SPA.
