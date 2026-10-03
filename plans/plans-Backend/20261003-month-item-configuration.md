---
title: "Monthly Item Configuration and Saving Lifecycle - Backend"
author: "GitHub Copilot"
date: "2026-10-03"
status: "proposed"
---

# Monthly Item Configuration and Saving Lifecycle

## TL;DR

Extend the Django finance API so monthly items can store saving targets, expose progress-safe data, and record an explicit conversion from Saving to Burn with the priority selected by the user. Keep the API compatible with the Angular dashboard and preserve an audit trail for the later reports feature.

Item linking and shared targets are explicitly excluded. The backend must not add link tables, shared-target IDs, automatic name matching, or propagation rules in this phase.

## Scope

### In scope

- A versioned, documented API contract for monthly item configuration.
- Persisting an optional saving target for Saving items.
- Returning item lifecycle fields needed by the frontend to display progress and completion state.
- Validating month format, money precision, target constraints, type transitions, and priority values in serializers.
- An authenticated conversion operation that changes one completed Saving item to Burn with an explicit priority.
- An immutable conversion record or equivalent audit data containing the original type, target context, selected priority, user, and timestamp.
- Backward-compatible reads for existing expenses that have no target or lifecycle metadata.
- Swagger/OpenAPI updates and focused API tests.

### Explicitly out of scope

- Linking items or shared targets.
- Target propagation or group-level calculations.
- Automatic conversion when a target is reached.
- Reports and analytics endpoints. The API only stores the facts required by a later reporting feature.
- Destructive migrations or database resets.

## Proposed data contract

The exact field names must be finalized before implementation, but the contract should support:

- `target_total`: nullable decimal, required only for Saving items when a target is configured.
- `saving_status`: derived or stored lifecycle value such as `active`, `almost_complete`, `completed`, or `converted`.
- `converted_at`: nullable timestamp.
- `converted_from_type`: nullable value retained for audit when an item becomes Burn.
- `conversion_priority`: nullable priority selected during conversion.
- `month`: normalized `YYYY-MM` value.

The existing `Expense` fields (`name`, `amount`, `unit_price`, `quantity`, `type`, `priority`, `month`, and `is_ignored`) remain compatible. Existing values such as `Burning` and `Must Have` must continue to be accepted or normalized at the API boundary while the frontend uses its current `Burn`, `Tax`, `Saving` and priority vocabulary.

Progress should have one clear source of truth. If accumulated contributions cannot be derived safely from current `Expense` rows, introduce a small user-scoped monthly saving snapshot or lifecycle table rather than guessing from mutable current values.

## API shape

Prefer extending the existing authenticated finance routes:

- `GET /api/finance/expenses/?month=YYYY-MM`
- `PATCH /api/finance/expenses/{id}/`
- `POST /api/finance/expenses/{id}/convert-to-burn/`

The conversion endpoint must:

- reject non-Saving items;
- reject conversion when the server cannot confirm the target/completion rule;
- require the new priority;
- apply the operation atomically;
- return the updated item and conversion audit data;
- be idempotent for an already converted item, or return a clear conflict response according to the final contract.

Use serializer validation and a service/domain function for lifecycle rules. Do not place the conversion rules only in the view.

## Implementation steps

1. Confirm the progress accumulation rule and lifecycle field names with the frontend plan.
2. Inspect current expense views, permissions, URL prefixes, and compatibility normalization before changing models.
3. Add the minimum model fields or a dedicated lifecycle model; keep user ownership and month isolation enforced by the database/queryset.
4. Create and apply a non-destructive migration.
5. Extend serializers with validation for money, target, month, type, and priority.
6. Implement the conversion service and authenticated endpoint with transaction handling.
7. Update URL registration and `Swagger-local/openapi.json`.
8. Add focused tests for permissions, invalid transitions, month isolation, conversion audit data, repeated conversion, legacy rows, and decimal values.
9. Provide a small frontend-facing example payload in the API documentation.

## Relevant files

- `Qeeva-Backend/apps/core_finance/models.py`
- `Qeeva-Backend/apps/core_finance/serializers.py`
- `Qeeva-Backend/apps/core_finance/views.py`
- `Qeeva-Backend/apps/core_finance/urls.py`
- `Qeeva-Backend/apps/core_finance/migrations/`
- `Qeeva-Backend/apps/core_finance/tests.py`
- `Qeeva-Backend/core/urls.py`
- `Swagger-local/openapi.json`
- `Qeeva-Frontend/src/app/@SERVICES/sync/backup.service.ts`

## Verification

- `python manage.py makemigrations --check`
- `python manage.py migrate --plan`
- Run the focused Django finance tests, then the full backend test suite.
- Manually verify with an authenticated API client:
  - create/update a Saving item with a target;
  - read it for the selected month;
  - verify progress inputs and decimal values;
  - convert it to Burn with a selected priority;
  - verify the audit record and repeated-conversion behavior;
  - verify another user's item cannot be read or converted;
  - verify existing rows without new fields still serialize.
- Run `git diff --check` after implementation.

## Decisions

- No item links, shared target IDs, or group operations are part of this phase.
- Conversion is explicit, authenticated, atomic, and auditable.
- The server owns validation and transition rules; the frontend only presents the workflow.
- Existing API consumers must continue to work while legacy type and priority spellings are normalized.
- The reports feature will be planned separately after lifecycle data has been used successfully in the monthly configuration page.
- The final persistence choice for accumulated saving progress remains open until the team confirms whether progress is monthly, lifetime, or based on a separate savings transfer record.
