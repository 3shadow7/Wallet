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


## Overall assessment
This plan fits your project direction well, and it is already aligned with the core goals of being offline-first, simple, and modular. The main improvements I would make are about implementation scope, architecture alignment, and keeping the first version focused on the basic user experience.

## What should stay in the plan
- A dedicated item-management route for exploration and linking
- A canonical, versioned storage model with stable item ids
- Shared-target behavior for explicit links only
- Lightweight month entries that reference canonical items instead of duplicating full item payloads
- Cents-based money storage internally

## What should be enhanced
### 1. Align the feature with the existing Angular structure
The current app already has a clear domain structure under the Angular app. The new feature should fit that structure instead of feeling like a standalone addition.

Recommended placement:
- feature route under the finance area, for example: features/finance/item-explorer/
- state and storage logic should stay in core services and storage services rather than living in the component only

This keeps the solution consistent with the existing frontend agent instructions and avoids unnecessary abstraction.

### 2. Prefer extending existing services over creating a new parallel architecture
The project already has:
- StorageEngineService
- ItemsStoreService
- BudgetStateService

The plan should make it explicit that the new feature should extend these services first, rather than introducing a completely separate storage or state path.

Suggested wording:
- Extend StorageEngineService for canonical item storage and link-group persistence
- Extend ItemsStoreService for search and retrieval APIs
- Integrate BudgetStateService so month entries and current-month behavior continue to work

### 3. Keep the first version intentionally simple
The plan should clearly say that this first step is not a full financial graph or analytics engine. It should focus on three things:
- search
- explicit linking
- shared target editing

That keeps the experience easy for a normal user and avoids overengineering before the base feature is proven.

### 4. Make the UX goal explicit for the basic user
The plan should reflect that the feature is meant to make monthly budgeting easier, not to overwhelm the user with too many options.

Recommended UX principles:
- search first
- small action panel for linking and target editing
- clear visual indication when items are linked
- purchased items should be visually muted and removed from active focus by default
- no advanced charts or complex rules in this first step

### 5. Clarify the business rule around shared targets
The plan is strong, but it should be more explicit that shared-target behavior is only about target configuration and not about item identity itself.

Recommended rule:
- linked items share target values
- linked items remain distinct items with their own name, state, and history
- different names should remain different items unless the user explicitly links them

## Refined implementation plan
1. Create the new feature route as a simple page shell
   - Keep the first screen focused on search, selection, linking, and shared target editing.

2. Extend the storage layer
   - Add helpers for item id creation and name normalization.
   - Add shared-target resolution helpers.
   - Update StorageEngineService to support:
     - versioned root read/write
     - month read/write using lightweight references
     - canonical item upsert
     - link-group creation and update
     - shared target propagation

3. Extend the item store layer
   - Add or expand query methods such as:
     - listAllItems()
     - getItem(itemId)
     - searchItems(query, type?)
     - getLinkedItems(itemId)

4. Integrate with the existing budget flow
   - When an item is added or edited, write to the canonical item model and the month entry.
   - When a linked target is edited, propagate it to the linked partners automatically.
   - Keep month entries lightweight and avoid duplicating full item objects.

5. Build the explorer UI
   - Search by name and type
   - Select multiple items and create a shared-target link group
   - Show a clear note that linked items share target logic
   - Allow editing the shared target from one place
   - Allow marking an item as purchased/fulfilled and remove it from active focus

## Suggested acceptance criteria
- A user can create several items with different names and link them into one shared-target group.
- Editing the target on one linked item updates the others automatically.
- Removing the link stops the shared-target behavior.
- Searching the explorer finds the expected items and related linked partners.
- Marking an item as purchased removes it from the active focus list.
- The existing dashboard and monthly budget flow still work after the change.
- Reloading the app preserves the data.

## Advice for the agent
- Work incrementally and preserve the current behavior first.
- Keep the first version small and focused on the basic user journey.
- Avoid introducing advanced analytics, backend sync, or extra rules before the shared-target feature is working well.
- Prefer small, readable changes over large rewrites.
- Verify the app build after each major step.
