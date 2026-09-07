# Signup Promotion — Task Plan

> **Feature ID:** FEAT-005
> **Created:** 2026-09-07
> **Requirements:** `specs/signup-promotion/requirements.md`
> **Design:** `specs/signup-promotion/design.md`

---

## Task List

### Backend tasks

| ID | Title | Owner | Depends on | Status |
|----|-------|-------|------------|--------|
| B1 | Add migration `009_future_parties_source.ts` — nullable `source` column | backend-engineer | — | [x] completed |
| B2 | Update `FuturePartyRow`, `InsertFuturePartyData`, `insertFutureParty` in repository | backend-engineer | B1 | [x] completed |
| B3 | Extend `FuturePartyRequestSchema` in `dtos.ts` with optional `source` field | backend-engineer | — | [x] completed |
| B4 | Add `sendSignupPromotionEmail` to `src/lib/email.ts` | backend-engineer | — | [x] completed |
| B5 | Update `futureParties.ts` route: pass `source` to insert + fire-and-forget email | backend-engineer | B2, B3, B4 | [x] completed |

### Frontend tasks

| ID | Title | Owner | Depends on | Status |
|----|-------|-------|------------|--------|
| F1 | Add optional `source` field to `FuturePartySubmission` in `src/api/futureParties.ts` | frontend-engineer | — | [x] completed |
| F2 | Create `SignupPromotionModal.tsx` component | frontend-engineer | F1 | [x] completed |
| F3 | Update `HomePage.tsx`: add `promotionOpen` state, auto-open `useEffect`, render `<SignupPromotionModal>` | frontend-engineer | F2 | [x] completed |
| F4 | Update `App.tsx`: add `/build` route pointing to `<HomePage />` | frontend-engineer | — | [x] completed |

---

## Dependency graph

```
B1 → B2 ─┐
B3 ───────┼→ B5
B4 ───────┘

F1 → F2 → F3
F4 (independent)
```

B1, B3, B4, F1, F4 are all independent and run in parallel (first wave).
B2 depends on B1 being applied (schema must exist before INSERT changes).
B5 depends on B2 + B3 + B4.
F2 depends on F1.
F3 depends on F2.

---

## Status legend

- `[ ]` pending
- `[-]` in progress
- `[x]` completed
- `[!]` blocked
