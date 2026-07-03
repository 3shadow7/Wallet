# Step 5 - State Services Refactor

Purpose: move runtime state management to the new stores and remove direct localStorage usage from state services.

## Updated files

- src/app/core/state/budget-state.service.ts
- src/app/core/services/savings.service.ts
- src/app/core/domain/storage.models.ts
- src/app/core/storage/stores/items-store.service.ts
- src/app/core/storage/engine/storage-engine.service.ts
- src/app/core/storage/migration/storage-migration.service.ts

## Changes summary

- BudgetStateService now loads from Income/Items/History stores and syncs state back into those stores.
- SavingsService now reads/writes savings history and totals from HistoryStore.
- ItemsData now includes app settings (timezone, lastActiveMonth) so settings live in the new store structure.
- Storage engine now supports clearAll for factory reset.
- Migration now carries legacy settings into the new items store.

## Notes

- Backup/import still uses the legacy persistence service and will be updated in Step 6.
- Direct localStorage usage in state services has been removed.

## Next step

Proceed to Step 6: update backup/import/sync flows to use the new stores.
