---
title: "Monthly Item Configuration and Saving Lifecycle - Frontend"
author: "GitHub Copilot"
date: "2026-10-03"
status: "in progress"
---

# Monthly Item Configuration and Saving Lifecycle

## TL;DR

Rebuild the item configuration page in the same dashboard-card visual language the project already uses: shared header, month navigation buttons, summary cards, and action cards with the same styling tokens and patterns as the dashboard instead of a custom one-off layout. The page must stay aligned with the existing budget, storage, and design-system services without inventing a parallel state path.

Current rebuild direction: restore the page as a polished dashboard-style control room with a title/subtitle header, exact month switcher behavior, action cards, and smaller item cards that follow the same card treatment as the rest of the app. No route work is included in this pass. Dark mode and button polish are being tightened to match the app’s existing contrast rhythm, and item actions are kept functional within the page itself.

Explicit item merging is part of this phase, but automatic merging is not. Every item keeps a permanent identity until the user confirms a merge.

## Scope

### In scope

- A lazy-loaded authenticated route for monthly item configuration.
- Month selection with the existing `YYYY-MM` month format.
- A focused list/table of the selected month's items.
- Search across all canonical items, even when an item is not present in the selected month.
- Dashboard-style control cards for saving goals, attention items, and duplicate candidates.
- Per-item configuration for amount, quantity, type, priority, and saving target.
- Explicit duplicate review and merge with a confirmation step.
- Clear progress states for Saving items: not started, in progress, almost complete, and completed.
- A detail/edit interaction that follows the current dashboard controls and responsive mobile patterns.
- A confirmed conversion flow from completed Saving to Burn:
  - show the current target and completion state;
  - let the user choose the Burn priority;
  - preserve the item identity and relevant history;
  - record the conversion so future reports can distinguish planned saving from later spending.
- Empty, loading, invalid-month, and save-error states.
- Offline-first persistence through the existing storage abstraction, with API synchronization when the backend contract is available.

### Explicitly out of scope

- Automatic merging by name, type, priority, or target.
- General-purpose item linking and shared-target groups. Those remain a later feature.
- Automatic merging by item name, category, or type.
- Reports and analytics screens. This page only prepares reliable lifecycle data for a later reports feature.
- Replacing the existing dashboard or history pages.

## User flow

1. User opens the item configuration page and selects a month.
2. The page shows item name, type, amount, target, progress, priority, and lifecycle state.
3. User opens one item and edits its monthly values or Saving target.
4. The page saves through `BudgetStateService` and `StorageEngineService` and keeps the dashboard behavior consistent.
5. When a Saving item reaches its target, the user explicitly confirms conversion.
6. The user selects the new Burn priority, confirms, and sees the item move to Burn while the conversion event remains available for later reporting.

### Merge flow

1. Search or duplicate review identifies two or more possible duplicate items.
2. The user opens a comparison and explicitly chooses Merge.
3. The confirmation screen states that the older item always survives.
4. All historical and current-month records are reassigned to the surviving item's ID and name.
5. The user chooses the target that applies to the current month; the selected target is not silently copied from either item.
6. The merge applies to every month, including the current month and all feature months already stored.
7. An auditable merge event stores the source ID, surviving ID, affected months, previous names, and target decision.

Completion must not silently convert an item. A user must be able to leave a completed Saving item unchanged.

## Progress rules

- Target values must be positive when present.
- Progress must be bounded to 0-100% in the UI.
- The calculation must use the stored saving contribution/history defined by the shared frontend-backend contract, not only the current display amount.
- The threshold for `almost complete` must be a named domain rule, not a magic number in the component.
- Items without a target do not display misleading progress.
- Burn and Tax items do not display Saving progress controls.
- A possible duplicate is only a review candidate; it is never merged without confirmation.

## Implementation steps

1. Confirm the item lifecycle and merge contract with the backend plan before changing public types.
2. Add the page under the existing `@COMPONENTS/pages/` structure and register a lazy route in `app.routes.ts`.
3. Extend existing item/state services for month reads, item updates, target progress, conversion events, duplicate review, and all-month merge operations.
4. Extend the canonical storage envelope and migration handling only as required by the agreed contract; do not write directly to `localStorage` from the page.
5. Build the responsive UI using existing theme tokens, typography, controls, status colors, and mobile bottom-sheet patterns.
6. Add conversion confirmation and priority selection using the existing shared select/dialog patterns.
7. Keep dashboard and history adapters backward-compatible with existing `Burn`, `Tax`, `Saving`, and priority values.
8. Add the API adapter and sync mapping after the backend endpoint shape is approved.

## Relevant files

- `Qeeva-Frontend/src/app/app.routes.ts`
- `Qeeva-Frontend/src/app/@TYPES/models.ts`
- `Qeeva-Frontend/src/app/@SERVICES/state/budget-state.service.ts`
- `Qeeva-Frontend/src/app/@SERVICES/storage/engine/storage-engine.service.ts`
- `Qeeva-Frontend/src/app/@SERVICES/storage/stores/items-store.service.ts`
- `Qeeva-Frontend/src/app/@COMPONENTS/pages/dashboard/budget-table/`
- `Qeeva-Frontend/src/app/@COMPONENTS/pages/history/`
- `Qeeva-Frontend/src/app/@DESIGN-SYSTEM/`

## Verification

- `npm run lint`
- `npm run build`
- Manual QA on desktop and mobile routes:
  - select another month and return without losing edits;
  - edit a target and reload the app;
  - verify progress states at below, near, and equal-to-target values;
  - convert a completed Saving item to Burn and verify the selected priority;
  - cancel conversion and verify no mutation occurred;
  - verify dashboard and history still render the item correctly;
  - verify no link or shared-target control appears.
- Run `git diff --check` after the plan implementation work.

## Decisions

- This phase is item-by-item; there is no `linkId`, shared target, or propagation behavior.
- Every item has a stable ID independent of its name and type.
- The older item always survives an explicit merge.
- A merge reassigns all months to the surviving ID and name, including the current month.
- The current-month target is selected by the user during confirmation; it is not automatically combined or copied.
- Merge history is retained as an immutable event so reports can explain the change.
- The existing `PriorityLevel` values remain the frontend vocabulary unless the backend contract requires an explicit compatibility adapter.
- Conversion is user-confirmed and auditable, not an automatic type mutation at the moment a target is reached.
- The later reports page will consume lifecycle events and monthly snapshots rather than reconstructing history from UI state.
- Any unresolved rule about how contributions accumulate across months must be decided before implementation, because it controls progress and report accuracy.
