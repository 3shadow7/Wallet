---
title: "Excluded Months Map - Frontend"
author: "GitHub Copilot"
date: "2026-10-01"
status: "done"
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

Implemented in this pass:

- Missing legacy flags now derive from empty or all-ignored expenses.
- Historical archive, add, update, and remove flows now derive exclusion from effective emptiness.
- Charts have an explicit show/hide excluded-month control.
- Delete is exposed only when an excluded month has zero remaining items; all-ignored items must still be removed first.
- No dedicated automated tests were added, per repository rules; browser QA was completed against the live frontend instance.

## Steps

1. [x] Confirm the existing model and storage contract.
2. [x] Derive missing exclusion state from effective emptiness while preserving explicit choices.
3. [x] Apply the exclusion rule to archive, add, update, and remove flows.
4. [x] Keep savings totals and chart datasets aligned with exclusion state.
5. [x] Keep the dashboard toggle limited to empty past months.
6. [x] Add history chart visibility and guarded deletion controls.
7. [x] Run the frontend production build; lint remains blocked by pre-existing project-wide errors.
8. [x] Perform browser QA for reload, toggling, deletion, and chart appearance on the live frontend instance.

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
- Confirm delete appears only after every item, including ignored items, has been removed and the month is excluded.
- Confirm excluded chart data is hidden by default and visibly marked when shown.

## Decisions

- Keep this behavior in the existing Angular state and storage services.
- Preserve explicit user toggles; derive the default only when legacy data has no flag.
- Do not add a new component or storage abstraction unless the existing paths cannot support the final behavior.
