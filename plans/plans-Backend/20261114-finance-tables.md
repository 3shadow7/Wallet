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
(Master Context section 6). Reading the older plans and the Angular models surfaced questions that must be
answered first; the first one decides whether another table is needed.

## Questions to settle before building

1. **Item links (Item Explorer plan, `plans/20260807-saving-goal-storage-plan.md`).** The plan lets the
   user link differently named items so they share one target. D-060 postponed this. Not built in the
   frontend. Decide: build later (recommended; adding a link table later does not break the schema),
   build now, or never. The plan's monthly/yearly `targetConfig` differs from today's single long-term target.
2. **`is_reducible` on cards.** The frontend keeps `ExpenseItem.isReducible` (default true for Saving) and
   the rule "the user picks which saving items shrink, at least one must stay reducible" needs it, but the
   approved `month_items` has no such column. Proposal: `is_reducible boolean default true`, used for Saving cards only.
3. **Manual savings (D-083).** The frontend stores a total plus `MonthlyRecord.manualAdded` per month and
   charts it per month. Still open: does a hand-added amount belong to the month it was added (automatic) or
   to a month the user picks?
4. **`category`.** `ExpenseItem.category` is only passed through in the frontend; it looks like a leftover.
   Proposal: do not store it.
5. **Target conflict.** If the user enters a different long-term target for an existing item, the frontend
   (`mergeItems`) keeps the existing target and flags a conflict. Decide the rule when the API exists.
6. **Deleting a month.** The frontend allows it only for an excluded month with zero items. The server
   should enforce the same rule later.

## Steps

1. [ ] Settle questions 1 to 4 with the user (one at a time).
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

Approved designs: D-036 to D-081, D-083. Open: the six questions above.
