---
name: @testing-library/dom missing from project scaffold
description: The Vite scaffold does not include @testing-library/dom; it must be added explicitly even though @testing-library/react depends on it
type: feedback
---

Add `@testing-library/dom` to devDependencies whenever setting up `@testing-library/react` in this project.

**Why:** npm with --legacy-peer-deps does not auto-install peer deps. Without it, @testing-library/react throws "Cannot find module '@testing-library/dom'" at runtime even though the package resolves at install time.

**How to apply:** Whenever adding or verifying test infrastructure, confirm `@testing-library/dom` is in package.json devDependencies.
