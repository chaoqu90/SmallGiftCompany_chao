---
name: FEAT-004 Future Party — execution summary
description: Completed 2026-09-06; all 14 tasks done; key deviations and constraints enforced noted
type: project
---

Feature completed 2026-09-06. All 14 tasks delivered in 4 parallelised waves.

**Why:** Lead-capture for parents planning a party weeks/months ahead. Admin generates a personalised bundle and emails a ready-to-buy link.

**How to apply:** Reference this for follow-on features that touch future_parties table or future-party email flow.

## Tasks delivered

| ID | File(s) | Status |
|----|---------|--------|
| T1 | `backend-node/migrations/008_future_parties.ts` | done |
| T2 | `backend-node/src/types/dtos.ts` (FuturePartyRequestSchema, LinkBundleRequestSchema) | done |
| T3 | `backend-node/src/repositories/futureParties.ts` | done |
| T4 | `backend-node/src/lib/email.ts` (sendFuturePartyEmail) | done |
| T5 | `backend-node/src/routes/futureParties.ts` | done |
| T6 | `backend-node/src/routes/admin/futureParties.ts` | done |
| T7 | `backend-node/src/app.ts` | done |
| T8 | `frontend/src/api/futureParties.ts` | done |
| T9 | `frontend/src/components/FuturePartyModal.tsx` | done |
| T10 | `frontend/src/pages/HomePage.tsx` | done |
| T11 | `frontend/src/api/admin.ts` (AdminFutureParty + 3 methods) | done |
| T12 | `frontend/src/pages/admin/AdminNav.tsx` | done |
| T13 | `frontend/src/pages/admin/CreateBundleForFuturePartyDialog.tsx` | done |
| T14 | `frontend/src/pages/admin/AdminFuturePartiesPage.tsx` + `frontend/src/App.tsx` | done |

## Key constraints enforced

1. `POST /api/future-parties` has NO basicAuth — confirmed zero basicAuth references in that router file.
2. `sendFuturePartyEmail` has NO try/catch — SES errors propagate; `bundle_sent_at` is only stamped after confirmed send.
3. `linked_bundle_public_id` is plain varchar — zero FOREIGN KEY / REFERENCES in migration 008.
4. `PATCH /:id/link-bundle` returns 400 with "already has a linked bundle" if overwrite attempted.
5. `POST /api/generated-bundles` call in dialog uses no admin auth — fetches via plain `fetch`, no Authorization header.
6. Migration numbered 008 — prior latest was 007.

## Open issues / follow-ups

- No automated tests were written; QA/e2e coverage for this feature is pending.
- Admin pagination of future-parties list is explicitly a non-goal for this MVP.
- Re-send semantics (AC6.2): the endpoint always updates `bundle_sent_at` to now() on every send — there is no send history, only the most recent send timestamp.
