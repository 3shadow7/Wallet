---
title: "Finance tables (months, incomes, items, cards, merge dismissals)"
author: "Claude"
date: "2026-11-14"
status: "proposed"
---

# Finance tables

## TL;DR

Build `apps/finance` from the design the user already approved (D-036 to D-081; columns in
`Qeeva-Backend/docs/database/schema-blueprint.md`): `months`, `month_incomes`, `items`,
`month_items`, `item_merge_dismissals`. Models and migrations only, with tests. No API endpoints
(Master Context section 6). Reading the older plans and the Angular models surfaced questions; none of them blocks the
approved tables (status below).

## Questions (status on 2026-11-14)

1. **Item links (Item Explorer plan).** Closed by D-092: postponed, no link table now.
2. **`is_reducible` on cards.** Proposal D-097 (waiting for the user's yes): do not add now. The frontend
   carries `ExpenseItem.isReducible` but no logic uses it yet, and the rule for choosing which saving items
   shrink is still open (Master Context section 15 #13). A later migration can add it.
3. **Manual savings (D-083).** Proposal D-093 (waiting for the user's yes): design later together with
   debit/credit. Today the frontend adds a manual amount to the savings total at once and keeps one number
   per month (`manualSavingsLog`, then `MonthlyRecord.manualAdded` when the month is archived). Detail for later:
   an excluded month's manual amount is skipped in the running total.
4. **`category`.** Closed by D-094: not stored.
5. **Target conflict.** If the user enters a different long-term target for an existing item, the frontend
   (`mergeItems`) keeps the existing target and flags a conflict. Decide the rule when goals are designed.
6. **Deleting a month.** The frontend allows it only for an excluded month with zero items. The server
   should enforce the same rule when the API exists.

None of the open questions blocks the five approved tables.

## Steps

1. [ ] Get the user's yes on D-093 and D-097 (postpone both), then start.
2. [ ] Models with CHECK constraints and composite foreign keys, so a card can never point at another user's month or item.
3. [ ] Migrations; `lock_down_table` for every table; `OWNER_FIELD` on every model.
4. [ ] Tests: every constraint, cross-user isolation, name-key uniqueness, cascade rules, RLS guard.
5. [ ] Update `schema-blueprint.md` and `decision-log.md` in the same commit.
6. [ ] Deliver as a numbered patch with a completion report.

## Relevant files

- `Qeeva-Backend/apps/finance/` (new)
- `Qeeva-Backend/docs/database/schema-blueprint.md`
- `Qeeva-Frontend/src/app/@TYPES/models.ts`
- `Qeeva-Frontend/src/app/@SERVICES/storage/engine/saving-goal-storage.utils.ts`
- `Qeeva-Frontend/src/app/@SERVICES/state/budget-state.service.ts`
- `plans/20260807-saving-goal-storage-plan.md`, `plans/plans-Backend/20260522-excluded-months-map.md`

## Verification

- With the Docker database running: `python -m pytest`, `ruff check .`, `mypy .`, `python manage.py makemigrations --check --dry-run --settings=core.settings_test`.
- Manual: inspect the new tables in pgAdmin on the `test_postgres` database (`pytest --reuse-db`).
- Nothing is applied to Supabase without the user's explicit approval (D-084).

## Decisions

Approved designs: D-036 to D-081. Closed: D-092, D-094. Waiting for a yes: D-093, D-097.
