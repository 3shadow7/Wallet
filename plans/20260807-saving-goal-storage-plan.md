# Item Explorer & Shared-Target Plan

Date: 2026-08-09

## First implementation step
This feature should be implemented as a new feature route under the Angular features folder, with the goal of giving the user a dedicated place to manage all financial items, search them, link them, and manage shared targets.

The route should be treated as the first step for the broader item-management system and should be implemented before deeper reports or analytics.

## Goal
- Implement a canonical, versioned localStorage schema for all financial items so every item has a stable `id` and can be used across months, search, goals, taxes, and future sync.
- Add a new feature route for item management and exploration.
- Let the user search items, link multiple items together without renaming them, and share one target across the linked group.
- Keep storage lean by avoiding duplicate full item payloads in every month.

## Feature route purpose
The new route should be the user’s main control center for item management.

It should allow the user to:
- search for items by name or type
- see all items with their current target state
- select multiple items and link them into one shared-target group
- edit the shared target from one place
- resolve target conflicts clearly
- mark an item as purchased/fulfilled and remove it from active target focus

## Suggested folder structure
- features/item-explorer/
  - item-explorer.component.ts
  - item-explorer.component.html
  - item-explorer.component.scss
  - item-explorer.routes.ts
  - services/item-explorer-state.service.ts

## Key decisions (confirmed)
- Every item must have a stable `id`.
- Different names are different items by default.
- Users can manually link any number of items from the explorer without renaming any of them.
- Linked items share the same target configuration (for example, the same saving target or yearly target).
- If one item in a linked group changes its target, the other linked items should reflect the same target value.
- A link can include more than two items.
- Persist money in cents internally (integers); UI accepts floats and adapters convert.

## Storage schema (high level)
- Top-level record (versioned):
  - version: number
  - updatedAt: ISO timestamp
  - items: Record<itemId, CanonicalItem>
  - months: Record<YYYY-MM, { entries: Array<{ itemId, amount, quantity, note?, isIgnored? }> }>
  - links: Record<linkId, { itemIds: string[], relation: 'shared-target' | 'manual-link', createdAt }> 

Where each `CanonicalItem` contains:
- id: string
- name: string
- type: 'Burn' | 'Tax' | 'Saving'
- kind: 'expense' | 'tax' | 'saving-goal' | 'custom'
- targetConfig: { monthly?: number; yearly?: number; sharedTargetId?: string }
- linkedItemIds: string[]
- isActive: boolean
- isPurchased: boolean
- createdAt: string
- updatedAt: string

## Planned implementation steps
1. Create the new feature route and basic page shell under the features folder.
2. Add helpers:
   - `createItemId()`
   - `normalizeName(name)`
   - `buildTargetKey(item)` or a similar helper for shared target resolution
   - `mergeTargetConfig(existing, incoming)` for shared-target consistency
3. Implement `StorageEngineService` under `src/app/core/storage/engine/`:
   - `getRoot()` / `saveRoot()` with versioning and migration hooks
   - `readMonth(month)` / `writeMonth(month, entries)` that write lightweight month entries referencing canonical items by `itemId`
   - `upsertItem(item)` to create/update canonical item records
   - `linkItems(itemIds, relation)` to create a manual link across a group of items
   - `updateSharedTarget(linkId, targetConfig)` to keep linked items sharing target values
   - `clearAll()` and `export/import` helpers
4. Add `ItemsStoreService` (or extend existing) to expose query APIs:
   - `listAllItems()`
   - `getItem(itemId)`
   - `searchItems(query, type?)`
   - `getLinkedItems(itemId)`
5. Update `BudgetStateService` flows:
   - On add/edit/remove: write to canonical items and lightweight month entries
   - When a linked item target is edited, propagate the target to its linked partners
   - Keep month entries referencing the canonical `itemId` rather than duplicating the whole item payload
6. Add the explorer UI with:
   - search by name/type
   - ability to select multiple items and link them without renaming them
   - ability to set a shared target for a linked group
   - a clear visual note that linked items share target logic
   - ability to mark an item as purchased/fulfilled and remove it from the active target focus list

## Target-sharing behavior
- If items are linked with a shared-target relationship:
  - all linked items should reference the same target configuration
  - editing target on one should update the rest automatically
  - the same target should be used for planning, charts, and goal progress calculations
- This should work even if the linked items have different names, because the link is explicit and user-controlled.

## Conflict handling
- If a user edits a linked item target and another item in the same linked group has a different value, the app should resolve it by keeping the shared target value for the whole linked group.
- There should be no automatic merge by name similarity; only explicit links create shared target behavior.

## Verification & QA
- Manual QA scenarios:
  - Create three items with different names and link them as a shared-target group.
  - Set a target on one; verify the other linked items receive the same target.
  - Edit the target again; verify the whole group stays in sync.
  - Remove the link; verify target behavior is no longer shared.
  - Search the explorer for one item and confirm the linked partners appear as related.
  - Mark one item as purchased/fulfilled and confirm it is removed from the active target focus list.

## Notes / Future
- This structure is lean, scalable, and ready for future sync and richer analytics.
- The linked-item model can later support more advanced relationships such as categories, aliases, or dependency-based financial rules.
