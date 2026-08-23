# Reusable Coding-AI Prompts

Use these prompts one phase at a time. Do not ask the agent to build the whole product in one shot.

---

## Prompt A — Start a Phase

```text
Read 00_MASTER_PLAN.md and <CURRENT_PHASE>.md before writing code.

Inspect the current repository and tell me:
1. what already exists that satisfies this phase;
2. what files you propose to add/change;
3. any conflicts between the spec and current implementation.

Then implement only this phase with the smallest coherent changes.

Requirements:
- preserve existing behavior;
- do not add future-phase architecture unless required;
- add tests for business rules, not just happy-path mocks;
- run the relevant test/build commands;
- finish with:
  a) files changed,
  b) tests run/results,
  c) manual checks I still need to perform,
  d) known risks or incomplete items.

Do not invent production secrets or claim external AWS/Stripe configuration succeeded.
```

---

## Prompt B — Review AI Code Before I Merge

```text
Act as a senior reviewer. Review the current diff against:
- 00_MASTER_PLAN.md
- <CURRENT_PHASE>.md

Do not rewrite everything.

Find:
1. correctness bugs;
2. security issues;
3. concurrency/idempotency problems;
4. places where frontend data is incorrectly trusted;
5. missing edge cases;
6. missing or weak tests;
7. unnecessary over-engineering;
8. scope creep.

Rank findings P0/P1/P2/P3.

For every P0/P1 finding, give:
- why it matters;
- exact file/location;
- minimal fix;
- regression test that should be added.
```

---

## Prompt C — Make Tests More Adversarial

```text
Read the current phase spec and tests.

Assume a buggy or malicious browser can send arbitrary JSON.

Add high-value tests for:
- malformed inputs;
- boundary values;
- duplicate requests;
- retries;
- race conditions where relevant;
- inactive/deleted records;
- authorization failures;
- server-authoritative pricing and state.

Avoid low-value tests that simply mirror implementation details.
```

---

## Prompt D — End-of-Phase Acceptance Review

```text
Do not write code yet.

Read <CURRENT_PHASE>.md and inspect the repo.

Create a checklist mapping every Acceptance Criterion in the spec to:
- implementation file(s);
- automated test(s);
- manual validation still required.

Mark each:
PASS / FAIL / MANUAL / UNKNOWN.

Do not call something PASS merely because the code appears plausible.
```

---

## Prompt E — Fix a Bug Safely

```text
Here is the bug:
<BUG DESCRIPTION>

Before editing:
1. reproduce or identify the failing path;
2. add a regression test that fails for the bug when practical;
3. explain the minimal root cause.

Then make the smallest fix.
Run relevant tests.
Do not refactor unrelated code.
```

---

## Prompt F — Pre-Launch Audit

```text
Read:
- 00_MASTER_PLAN.md
- 08_DEPLOYMENT_SECURITY.md
- 09_END_TO_END_TEST_PLAN.md
- 10_LAUNCH_RUNBOOK.md

Inspect the repository for launch blockers.

Focus on:
- secrets;
- production CORS;
- admin protection;
- staff redemption protection;
- Stripe webhook verification/idempotency;
- atomic redemption;
- inventory consistency;
- order snapshots;
- logs;
- error leakage;
- database migration safety;
- environment separation.

Return a launch-blocker list only.
Do not declare the system production-ready; identify what a human must verify externally.
```
