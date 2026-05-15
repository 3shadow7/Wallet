# Step 1 - Discovery and Alignment

Purpose: document current storage usage and state flows to safely migrate to the new scalable structure.

## Current localStorage keys (observed)

Auth:
- access_token (JWT access)
- refresh_token (JWT refresh)
- user (JSON string)
- is_guest (string "true")

Main app state:
- life_value_finance_data (JSON string, versioned)
- savingsStorage (string number)
- monthlyHistory (JSON string array)
- manualSavingsLog (string number)

Offline sync:
- offline_sync_queue_v1 (JSON string array)

Theme:
- app-theme-preference (string "light" or "dark")
- index.html bootstrap reads localStorage key "theme" (mismatch)

## Where keys are used

- core/services/persistence.service.ts
  - life_value_finance_data, savingsStorage, monthlyHistory
- core/services/savings.service.ts
  - savingsStorage, monthlyHistory via PersistenceService
- core/state/budget-state.service.ts
  - manualSavingsLog
- core/services/auth.service.ts
  - access_token, refresh_token, user, is_guest
- core/services/backup.service.ts
  - exports/imports all localStorage keys
- core/services/offline-sync.service.ts
  - offline_sync_queue_v1
- core/services/theme.service.ts
  - app-theme-preference
- index.html
  - reads localStorage key "theme" for early theme bootstrap

## Current state flow

- BudgetStateService owns incomeConfig, currentMonthExpenses, history, settings.
- PersistenceService saves/loads the main app state as one blob in life_value_finance_data.
- SavingsService keeps totalSavings + monthly history in separate keys (savingsStorage, monthlyHistory).
- manualSavingsLog is written directly from BudgetStateService.
- History view uses SavingsService and BudgetStateService data.

## Issues to address during refactor

- Storage split across multiple keys without consistent envelope format.
- Direct localStorage usage in services and components.
- Theme key mismatch (index.html reads "theme" but service writes "app-theme-preference").
- Backup/export includes auth tokens and raw localStorage contents.

## Proposed new store keys (for confirmation)

- lvf_income_store
- lvf_history_store
- lvf_items_store

Each store will use a versioned envelope:

{
  "version": 1,
  "updatedAt": "ISO-8601",
  "data": { ... }
}

## Next step

Confirm the new store keys and move to Step 2 (Define Target Architecture + models).
