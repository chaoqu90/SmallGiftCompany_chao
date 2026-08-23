---
name: MUI Grid2 required for size prop
description: In MUI v6, the responsive size={{ xs, sm, md }} prop only works on Grid2, not the legacy Grid component
type: feedback
---

Use `Grid2` (imported from `@mui/material`) whenever using the `size={{ xs, sm, md }}` responsive API.

**Why:** The legacy `Grid` component in MUI v6 uses `item xs={12} sm={6}` prop syntax. The `size` prop is the Grid2 API and TypeScript will reject it on the old Grid with TS2769.

**How to apply:** Any time a design calls for a responsive grid layout, import `Grid2` from `@mui/material` rather than `Grid`.
