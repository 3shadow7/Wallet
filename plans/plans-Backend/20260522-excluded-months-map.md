---
title: "Excluded Months Map - Backend"
author: "GitHub Copilot"
date: "2026-10-01"
status: "draft"
---

# Excluded Months Map - Backend

## TL;DR

No backend implementation for month-level exclusion was found. The current Django finance API stores expenses and income, including per-expense `is_ignored`, but it has no historical month record, month exclusion field, savings-history resource, or sync contract for this feature.

This plan is therefore a backend design and integration plan, not a record of completed backend work.

## Implementation status

Already present:

- `Expense` is scoped to a user and month.
- `Expense.is_ignored` is available for item-level exclusion.
- Authenticated expense and income endpoints exist.
- `UserBackup` provides a JSON backup envelope that could carry the frontend history data.

Not implemented:

- A month-level `excluded_from_totals` field or resource.
- Persistence for `BudgetHistory` and `MonthlyRecord` as first-class backend records.
- Backend savings recalculation that skips excluded months.
- API endpoints or serializers for updating, deleting, or querying excluded months.
- OpenAPI documentation and migrations for this feature.

## Steps

1. Decide the source of truth: either extend `UserBackup.data` as a versioned sync payload, or introduce first-class monthly history and savings models. Do not implement both without a migration strategy.
2. Align the backend contract with the frontend fields: month, income/configuration, expenses, summary, savings record, and `excludedFromTotals` (mapped to the project’s backend naming convention).
3. If first-class records are approved, add user-scoped monthly history and savings models, uniqueness by user/month, serializers, migrations, and authenticated endpoints.
4. Define server-side rules for empty and all-ignored months, explicit user toggles, deletion, and idempotent updates.
5. Update the backup/sync endpoint contract so exclusion state survives upload, download, and legacy payload normalization.
6. Update `Swagger-local/openapi.json` and add focused API tests for permissions, month isolation, toggling, deletion, and legacy data.
7. Run migrations, Django checks, and API smoke tests before wiring the Angular client to live backend data.

## Relevant files

- `Qeeva-Backend/apps/core_finance/models.py`
- `Qeeva-Backend/apps/core_finance/serializers.py`
- `Qeeva-Backend/apps/core_finance/views.py`
- `Qeeva-Backend/apps/core_finance/urls.py`
- `Qeeva-Backend/apps/core_finance/migrations/`
- `Qeeva-Backend/core/urls.py`
- `Qeeva-Frontend/AGENT_ONBOARDING.md`
- `Swagger-local/openapi.json`

## Verification

- `cd Qeeva-Backend`
- `python manage.py check`
- `python manage.py migrate`
- Exercise authenticated requests for two users and confirm month data cannot cross user boundaries.
- Verify an empty/all-ignored month is excluded by default, can be explicitly included, and can be deleted only under the agreed rule.
- Verify backup/sync round-trips preserve the exclusion flag.

## Decisions

- The backend must preserve the existing authenticated API behavior.
- Backend naming should follow Django conventions and be mapped explicitly to the Angular contract.
- Do not add migrations or API code until the source-of-truth decision is approved.
