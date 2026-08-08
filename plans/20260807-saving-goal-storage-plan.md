# Saving-Goal Storage & Merge Plan

Date: 2026-08-07

Goal
- Implement a canonical, versioned localStorage schema and merge-aware write path for expense items so items across months are deduplicated by `name+type` (id per-item would be helpfull to do logically things like this , so add id key for the items also dont forget the script of mirge data backup from old versions). Provide conflict handling for differing `targetTotal` values.

Key decisions (confirmed)
- Match rule: case-insensitive, trimmed name matching.
- Merge behavior: automatic merge on write when `name+type` match; if both items have different `targetTotal`, prompt user to resolve the target (keep existing, keep incoming, or enter custom).
- If names match but types differ → treat as separate items.
- Persist money in cents internally (integers); UI accepts floats and adapters convert.

Storage schema (high level)
- Top-level record (versioned):
  - version: number
  - updatedAt: ISO timestamp
  - canonicalItems: Record<itemKey, CanonicalItem>
  - monthlyIndex: Record<YYYY-MM, { items: Array<{ itemKey, amount, quantity, note? }> }>

Where `itemKey = normalizeName(name) + '|' + type`.

Planned implementation steps
1. Add helpers: `normalizeName(name)`, `itemKey(name,type)`, `mergeItems(existing,incoming)`.
2. Implement `StorageEngineService` under `src/app/core/storage/engine/`:
   - `getRoot()` / `saveRoot()` with versioning and migration hooks
   - `readMonth(month)` / `writeMonth(month, entries)` that update canonical items using merge logic
   - `mergeWriteItem(month, item)` that returns conflict info when target differs
   - `clearAll()` and `export/import` helpers
3. Add `ItemsStoreService` (or extend existing) to expose query APIs: `listAllItems()`, `getCanonical(itemKey)`, `searchItems(q, type?)`.
4. Update `BudgetStateService` flows:
   - On add/edit/remove: call `StorageEngineService` merge-aware paths instead of naive per-month writes
   - When merge returns a `targetTotal` conflict, surface the existing conflict modal (reuse) to resolve and then apply the chosen target
5. Add lightweight migration that consolidates current per-month arrays into canonical items and monthly indexes (preserve month-specific amounts)
6. Add a small UI stub (link) labeled "All Items (explorer)" with a placeholder — mark as TODO for next feature

Conflict UX (summary)
- When a write causes a merge and `existing.targetTotal !== incoming.targetTotal`:
  - Pause write and present modal: show "This item" vs "Existing item" target values plus option to enter custom number.
  - On choice, update canonical item `targetTotal` and finish the merge write (update monthly index as well).

Verification & QA
- Unit tests for helpers and `StorageEngineService` merge behavior (normalize, keying, mergeItems, conflict reporting).
- Manual QA scenarios:
  - Add `Saving` "Phone" goal 500 in month A; add `Saving` "phone" goal 400 in month B → expect canonical item key `phone|Saving`, amounts summed, prompt to resolve target.
  - Edit history item to rename to existing `name+type` → expect conflict flow.
  - Add items with same name but different `type` → remain separate.

Notes / Future
- Add an "All Items" explorer (filters, search, notifications for near-goals, convert goal → expense when purchased). This is recorded as a future feature and should be implemented after canonical storage is stable.
- Design storage keys to be stable for future server sync.

If this looks good I will implement `StorageEngineService` and the helper utilities next. If you want wording or behavior changes, tell me before I start coding.
