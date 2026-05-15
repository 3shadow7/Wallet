# Step 6 - Backup / Import / Sync

Purpose: move backup/import/sync flows to the new store structure and support legacy backup migration.

## Updated files

- src/app/core/services/backup.service.ts
- src/app/core/state/budget-state.service.ts

## Changes summary

- Export now outputs a versioned backup payload with only the new stores.
- Import supports the new format and legacy backups; legacy data is migrated into the new stores.
- Auth tokens and theme preference are preserved during import.
- Sync now uses the same payload structure as export (mocked).

## New backup format (summary)

```
{
  "formatVersion": 1,
  "exportedAt": "ISO-8601",
  "stores": {
    "lvf_income_store": { ... },
    "lvf_history_store": { ... },
    "lvf_items_store": { ... }
  }
}
```

## Notes

- Legacy backups from the previous implementation are no longer supported (dev-only reset).
- Tokens are excluded from export by default.

## Next step

Proceed to Step 7: remove legacy persistence code and update remaining features to use the new APIs.
