# Excluded Months Change Map (2026-05-22)

## Problem Summary
- When an old month becomes empty (no items or all items ignored), the month still affects totals, charts, and total savings.
- You want a toggle on the dashboard (not history) to include/exclude that month from totals.
- History should show excluded months as ignored and not affect totals, with charts hidden by default.
- Charts can optionally show excluded months with a grey/ignored style.
- Delete button should appear only for empty + excluded months, inside the history table.

## Solution Overview
- Add an excludedFromTotals flag to history records and savings records.
- Default exclude empty months from totals.
- Recalculate totals/savings by skipping excluded months.
- Dashboard toggle controls excludedFromTotals for the viewed month.
- History rows show ignored style; charts filter excluded months by default with a toggle to show them.
- Delete button only for empty + excluded months.

---

## Step Map (confirm after each step)

### Step 1: Data model flags
- Add excludedFromTotals?: boolean to BudgetHistory.
- Add excludedFromTotals?: boolean to MonthlyRecord.
- Default empty months to excludedFromTotals = true when normalizing history.

Confirm after Step 1:
- Does the model definition look correct and clear for your use?

### Step 2: State logic for empty months
- When adding/updating/removing items in a past month, set excludedFromTotals based on:
  - empty items, or
  - all items ignored.
- Add helpers:
  - setHistoryMonthExcluded(month, excluded)
  - deleteHistoryMonth(month)
  - isHistoryMonthEmpty(month)
- Recalculate savings and totals by skipping excluded months.

Confirm after Step 2:
- When a month becomes empty, should it be excluded by default?

### Step 3: Savings calculations
- Filter excluded months out of:
  - last month profit/transfer
  - average savings rate

Confirm after Step 3:
- Do totals and savings now behave as if excluded months do not exist?

### Step 4: Dashboard toggle (history view only)
- Add toggle button in the dashboard header when viewing a past month.
- Only show the toggle when the month is empty.
- Toggle flips excludedFromTotals.

Confirm after Step 4:
- Is the toggle location and behavior correct for you?

### Step 5: History UI row styling + delete
- History table rows for excluded months show ignored styling.
- Delete button appears only for empty + excluded months.
- Deleting removes the month fully.

Confirm after Step 5:
- Does the table show the correct ignored state and delete behavior?

### Step 6: Chart filtering + ignored styling
- Default charts hide excluded months.
- Add a toggle in history to show excluded months.
- When shown, use a grey/ignored label or shading to indicate non-effective data.

Confirm after Step 6:
- Do the charts match your expectations (hidden by default, optional grey display)?

---

## Quick QA Checklist
1) Create an old empty month, add item, then delete/ignore all items -> month becomes excluded.
2) Totals and savings update as if the month does not exist.
3) Dashboard toggle can include the month back into totals.
4) History row shows ignored styling and delete appears only for empty + excluded.
5) Charts hide excluded months by default and show greyed months when toggle is enabled.
