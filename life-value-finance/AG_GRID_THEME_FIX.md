# Engineering Audit: AG Grid Theming API Fix
**Date:** 2026-02-17
**Status:** Resolved
**Issue:**  `AG Grid: error #239 Theming API and CSS File Themes are both used in the same page.`

## Resolution
Added `theme: 'legacy'` to the `gridOptions` configuration in `BudgetTableComponent`. This explicitly tells AG Grid to use the v32-style CSS themes (which are already configured via `ag-theme-quartz` class and CSS imports) instead of defaulting to the new Theming API (which conflicts with the manual CSS imports).

## Verification
- `ng build` completes successfully.
- No TypeScript errors regarding the `theme` property.
- Styles should render correctly using the existing quartz theme.
