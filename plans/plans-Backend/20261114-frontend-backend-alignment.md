---
title: "Frontend and backend alignment (after the backend work)"
author: "Claude"
date: "2026-11-14"
status: "draft"
---

# Frontend and backend alignment

## TL;DR

The Angular app stores everything in the browser and was built before the database design. The backend
and database are now designed differently in several places (decisions D-020 to D-097). After the
backend tables and calculation layer are finished, both sides must be brought together without
breaking the working frontend and without a long delay to production (D-096).

Recommended approach: **the database and backend are the source of truth; the frontend keeps working
and gets a thin mapping layer** (adapters) between its current local shapes and the API. Neither side is
rewritten. Guest mode stays fully local and never calls the backend.

## Differences found so far (verified in the code on 2026-11-14)

| Topic | Angular today | Backend design | Resolution to decide |
|---|---|---|---|
| Money | plain decimal `number`, rounded in `FinancialCalculatorService.round`; the word "cents" appears nowhere in `src/` (the 20260807 plan says cents) | `bigint` minor units, 2 decimals | adapter converts at the boundary |
| Item type | `'Burn' \| 'Tax' \| 'Saving'` | `burn`, `tax`, `saving` | adapter |
| Importance | `priority: 'Must' \| 'Want' \| 'Emergency' \| 'Gift'` | `importance` lowercase | adapter |
| Item id | string `item-<name>-<type>-<time>-<random>` | uuid | adapter keeps a map during import |
| Month | `'YYYY-MM'` string | `month_start` date (day 1) | adapter |
| Excluded month | `excludedFromTotals?: boolean` (unset = derive) | `totals_mode` `auto`, `included`, `excluded` | unset = `auto`, true = `excluded`, false = `included` |
| Income | one `incomeConfig` per month plus `sources` | `month_incomes` lines with hours fields | adapter splits and merges |
| Long-term target | `targetTotal` on the card | `items.target_minor` on the item | decide which card wins when several cards of one item differ (the frontend keeps the existing one and flags a conflict) |
| Name comparison | `normalizeName` = trim + lowercase only | D-056/D-057: Arabic spelling variants equal, single spaces, no symbols | the backend computes `name_key`; the frontend must show the same suggestions, so share the rule |
| Same item, other importance | `mergeItems` keeps one priority and adds amounts | D-075: two cards in one group | frontend change needed (newer decision wins) |
| Undo timer | 6 seconds in the old plan | D-077: 5 seconds | frontend setting |
| `isReducible`, `category` | carried in data, no logic | not stored (D-094, D-097) | adapter drops them (or keeps local only) |
| Manual savings | one number per month (`manualSavingsLog`, `manualAdded`) | separate list, design postponed (D-083, D-093) | decide with debit/credit |
| Calculations | `FinancialCalculatorService` in TypeScript | Python implementation with tests | both must give identical numbers for the same input |
| Login and API calls | `@SERVICES/auth/auth.service.ts` calls `http://localhost:8000/api/auth`, `@API/pages/dashboard/dashboard.service.ts` calls `/api/finance`, `@SERVICES/sync/backup.service.ts` calls `/api` (the deleted SimpleJWT and `core_finance` API) | Supabase Auth issues the token; Django only verifies it; today only `/api/health/` and `/api/me/` exist | frontend change: replace those three services behind the adapters; guest mode stays local and is not affected |

## Steps

1. [ ] Finish the finance tables and a Python calculation layer. Write shared test vectors (inputs and
   expected outputs for every formula and edge case) in a neutral file, and run the **same vectors** against
   the Python code and the Angular `FinancialCalculatorService`. Disagreements show up before any UI work.
2. [ ] With the user's approval of the scope (Master Context section 6), design the API contract first
   (OpenAPI), generated from Django. Adding `drf-spectacular` needs a dependency check and approval.
3. [ ] Build the Angular adapters and the sync flow behind the existing "Sync Now" and `offline_sync_queue_v1`;
   keep every current screen working.
4. [ ] One-time import of an existing local account's data into the database (with a dry run and a report).
5. [ ] Update `swagger-local/openapi.json` (or replace it with the generated contract), with the user's approval.
6. [ ] Change the frontend only where a newer decision differs (rows marked "frontend change"), each as its own small plan in `plans/plans-Frontend/`.

## Relevant files

- `Qeeva-Frontend/src/app/@TYPES/models.ts`
- `Qeeva-Frontend/src/app/@SERVICES/financial-calculator.service.ts`
- `Qeeva-Frontend/src/app/@SERVICES/state/budget-state.service.ts`
- `Qeeva-Frontend/src/app/@SERVICES/storage/engine/saving-goal-storage.utils.ts`
- `Qeeva-Frontend/src/app/@SERVICES/sync/backup.service.ts`
- `Qeeva-Backend/docs/database/schema-blueprint.md`, `plans/decisions/decision-log.md`
- `plans/project-idea/idea-v2.md`, `swagger-local/openapi.json`

## Verification

- The shared test vectors pass on both the Python and the TypeScript calculators.
- A round trip (local data, then API, then local data) returns the same numbers for a set of sample months.
- Guest mode works with the backend switched off.

## Decisions

D-096 (this phase), D-085 (Django owns the schema), D-001 and Master Context section 6 (no endpoints before the
scope changes). `plans/project-idea/idea-v2.md` ("an endpoint for everything in localStorage") is older and
is replaced by the approach above.
