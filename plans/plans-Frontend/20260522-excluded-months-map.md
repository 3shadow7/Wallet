---
title: "Excluded Months Map - Frontend"
author: "GitHub Copilot"
date: "2026-10-01"
status: "proposed"
---

# Excluded Months Map - Frontend

## TL;DR

The excluded-month behavior is mostly implemented in the Angular app. This plan records what is already present and the remaining frontend work needed to make empty and all-ignored historical months reliable.

## Implementation status

Already present:

- `BudgetHistory.excludedFromTotals` and `MonthlyRecord.excludedFromTotals` in `src/app/@TYPES/models.ts`.
- Historical month toggling, deletion, and emptiness checks in `src/app/@SERVICES/state/budget-state.service.ts`.
- Savings recalculation that skips excluded months.
- Dashboard toggle support for empty past months in the budget table.
- History-row ignored styling and month toggle support.
- Charts filtered to excluded months by default, with the existing history display path available for showing them.
- Storage and backup normalization carry the exclusion field.

Partially complete or requiring verification:

- `normalizeHistory` currently falls back to `false` when the flag is missing, while the requirement says an effectively empty month should default to excluded.
- Add/update/remove and ignore flows must be checked together for the all-items-ignored case.
- The chart show-excluded interaction and delete visibility need a focused manual pass.
- No dedicated automated tests were added, per repository rules.

## Steps

1. Confirm the existing model and storage contract.
2. Change history normalization so missing exclusion state is derived from whether the month has no effective expenses, while preserving an explicit user choice.
3. Audit add, update, ignore, remove, archive, and restore flows so an empty or all-ignored historical month is excluded and a month with an active item is included.
4. Verify savings totals, last-month transfer, average savings rate, and chart datasets all use the same exclusion rule.
5. Verify the dashboard toggle is available only for an empty past month and persists after refresh/reload.
6. Verify history styling, delete visibility, deletion, and chart show-excluded behavior.
7. Run the frontend build and lint, then perform the QA checklist below.

## Relevant files

- `Qeeva-Frontend/src/app/@TYPES/models.ts`
- `Qeeva-Frontend/src/app/@SERVICES/state/budget-state.service.ts`
- `Qeeva-Frontend/src/app/@SERVICES/savings.service.ts`
- `Qeeva-Frontend/src/app/@SERVICES/sync/backup.service.ts`
- `Qeeva-Frontend/src/app/@COMPONENTS/pages/dashboard/budget-table/`
- `Qeeva-Frontend/src/app/@COMPONENTS/pages/history/`
- `Qeeva-Frontend/src/app/@SERVICES/storage/`

## Verification

- `cd Qeeva-Frontend`
- `npm run build`
- `npm run lint`
- Manually create a past month, remove or ignore every item, reload, and confirm it is excluded.
- Toggle the month back into totals and confirm savings and charts update.
- Confirm delete appears only for an empty excluded month.
- Confirm excluded chart data is hidden by default and visibly marked when shown.

## Decisions

- Keep this behavior in the existing Angular state and storage services.
- Preserve explicit user toggles; derive the default only when legacy data has no flag.
- Do not add a new component or storage abstraction unless the existing paths cannot support the final behavior.
