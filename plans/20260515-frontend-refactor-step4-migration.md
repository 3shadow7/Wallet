# Step 4 - Migration Layer (Legacy -> New Stores)

Purpose: migrate existing localStorage data to the new store structure and remove legacy keys.

## Added files

- src/app/core/storage/migration/storage-migration.service.ts

## Migration behavior

- Detects if any of the new store keys already exist; if so, migration is skipped.
- Reads legacy keys:
  - life_value_finance_data
  - savingsStorage
  - monthlyHistory
  - manualSavingsLog
- Maps legacy data into:
  - lvf_income_store
  - lvf_history_store
  - lvf_items_store
- Deletes legacy keys after successful migration.

## Next step

Proceed to Step 5: refactor state services to use the new stores.
