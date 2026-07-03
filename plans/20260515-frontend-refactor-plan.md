# Frontend Structure + Storage Refactor Plan

Goal: Restructure the Angular frontend to a scalable, readable architecture that matches the project vision, and replace legacy localStorage usage with three versioned stores (income, history/analysis, items) AND THE MOST IMPORTANT that read my project idea and create a data structral that fits what project needs , and then fix project folders/files to fit the new structural . Execute step-by-step with QA gates after each step.

## Steps

### 1) Discovery + Alignment
- Inventory all direct localStorage usage, storage keys, and state flows.
- Confirm target folder layout and store key names.
- Output: a short map of current usage and the final agreed key list.

### 2) Define Target Architecture
- Document the final folder structure that fits the project idea and scales.
- Update TypeScript models to align with the Swagger vision.
- Specify new store keys and envelope shape `{ version, updatedAt, data }`.
- Output: updated docs and model definitions.

### 3) Build Storage Layer
- Add a storage engine service (read/write/remove with JSON parsing, versioning, updatedAt).
- Add store-specific services for income, history, items, plus auth/theme storage wrappers.
- Output: new storage services and usage examples.

### 4) Add Migration Service
- Read legacy keys (`life_value_finance_data`, `savingsStorage`, `monthlyHistory`, `manualSavingsLog`).
- Map them into the new stores and write new keys.
- Remove legacy keys after successful conversion.
- Run once at app start and after import.
- Output: migration service + tests via manual QA.

### 5) Refactor State
- Split or refactor `BudgetStateService` into IncomeState, ItemsState, HistoryState (or a facade that composes them).
- Ensure all calculations use the new stores only.
- Preserve existing behavior.
- Output: updated state services and wiring.

### 6) Update Features
- Update dashboard/history/settings/auth/theme to use new state/storage APIs.
- Remove direct localStorage usage in components/services.
- Output: feature updates with no functional regressions.

### 7) Backup / Import / Sync
- Export/import new store keys only; exclude tokens by default.
- Ensure import can trigger migration if old-format data is detected.
- Output: updated backup service and import flow.

### 8) Cleanup
- Delete legacy persistence/savings logic that is no longer used.
- Remove unused keys/constants and dead code.
- Update docs to match the new structure.
- Output: clean codebase with updated docs.

### 9) QA + Verification Gates
- After each step: run the app, check localStorage keys, validate core flows.
- Record QA results before proceeding to the next step.

## Relevant Files
- frontendDataVision.json (storage vision contract)
- swagger-local/openapi.json (Swagger source)
- life-value-finance/src/app/core/services/persistence.service.ts (legacy storage)
- life-value-finance/src/app/core/services/savings.service.ts
- life-value-finance/src/app/core/state/budget-state.service.ts
- life-value-finance/src/app/core/services/auth.service.ts
- life-value-finance/src/app/core/services/theme.service.ts
- life-value-finance/src/app/core/services/backup.service.ts
- life-value-finance/src/app/core/services/offline-sync.service.ts
- life-value-finance/src/app/features/dashboard/dashboard.component.ts
- life-value-finance/src/app/features/history/history.component.ts
- life-value-finance/src/app/features/settings/settings.component.ts
- life-value-finance/src/app/layout/header/header.component.ts

## Decisions (Current)
- New storage keys: `lvf_income_store`, `lvf_history_store`, `lvf_items_store`.
- Each store uses `{ version, updatedAt, data }`.
- Migration deletes legacy keys after success.
- Direct localStorage calls will be removed from components/services.

## QA Checklist (Repeat After Each Step)
1. App loads without errors (login/register, dashboard, history, settings).
2. localStorage shows only intended keys for that step.
3. Guest flow works; add expenses; reload preserves data.
4. History charts/grid render correctly.
5. Export/import (when updated) preserves data integrity.

## Next Action
Start with Step 1 and confirm results before moving to Step 2.
