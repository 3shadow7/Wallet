# Step 3 - Storage Engine + Store Services

Purpose: add a centralized storage engine and store-specific services that read/write the new versioned stores.

## Added files

- src/app/core/storage/engine/storage-keys.ts
- src/app/core/storage/engine/storage-engine.service.ts
- src/app/core/storage/stores/income-store.service.ts
- src/app/core/storage/stores/history-store.service.ts
- src/app/core/storage/stores/items-store.service.ts
- src/app/core/storage/stores/auth-storage.service.ts
- src/app/core/storage/stores/theme-storage.service.ts

## Notes

- All stores use a versioned envelope and write an updatedAt timestamp.
- Store defaults are safe and minimal to avoid breaking existing flows.
- Auth and theme storage are now centralized but not yet wired into features.

## Next step

Proceed to Step 4: migration from legacy keys to new stores.
