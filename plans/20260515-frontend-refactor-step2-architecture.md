# Step 2 - Target Architecture + Data Structure

Purpose: define the scalable folder structure and the new storage contracts that align with the project vision (income, history/analysis, items).

## Target folder structure (future state)

```
src/app/
  core/
    auth/
    guards/
    interceptors/
    storage/
      engine/
      stores/
      migration/
    state/
    domain/
    services/
    sync/
  features/
    auth/
    finance/
      dashboard/
      income/
      items/
      history/
      analysis/
    settings/
  shared/
    ui/
    directives/
    pipes/
    utils/
  layout/
  pages/
```

Notes:
- Finance features are grouped under `features/finance` to keep domain growth manageable.
- Storage is centralized in `core/storage` with separate engine, stores, and migration.
- Domain models live in `core/domain` and should be reused by state and features.

## New storage keys

- lvf_income_store
- lvf_history_store
- lvf_items_store

Each store uses the envelope:

```
{
  "version": 1,
  "updatedAt": "ISO-8601",
  "data": { ... }
}
```

## Store contracts (summary)

Income Store
- incomeConfig
- sources (income sources)
- taxProfile
- savingsGoal
- calculation

History Store
- budgetHistory
- savingsHistory
- savingsSummary
- analysis

Items Store
- currentMonth
- months (keyed by YYYY-MM)

## TypeScript models

New store models defined in:
- src/app/core/domain/storage.models.ts

Monthly savings history model moved into:
- src/app/core/domain/models.ts

## Next step

Proceed to Step 3: add the storage engine and store services.
