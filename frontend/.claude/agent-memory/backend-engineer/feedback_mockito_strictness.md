---
name: Mockito strictness in service unit tests
description: Use @MockitoSettings(strictness = Strictness.LENIENT) when test class has shared stub-helper methods used across multiple tests
type: feedback
---

Use `@MockitoSettings(strictness = Strictness.LENIENT)` on service unit test classes that share a `stubCommonMocks(...)` helper method.

**Why:** Mockito's default STRICT_STUBS mode rejects stubs that are set up but never invoked in a specific test. When a shared setup helper stubs more things than any single test needs, each test fails with UnnecessaryStubbingException even though the stubs are legitimate.

**How to apply:** Add the annotation at class level; do not loosen strictness for integration tests or tests where each test sets up its own stubs independently.
