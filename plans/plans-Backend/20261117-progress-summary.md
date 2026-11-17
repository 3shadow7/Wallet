---
title: "Progress summary: what we have done so far"
author: "Claude"
date: "2026-11-17"
status: "draft"
---

# Progress summary: what we have done so far

## TL;DR

The backend has a tested foundation, the accounts tables, the five finance tables and a pure-Python month
calculation layer (360 tests with PostgreSQL, no finance endpoint). Since 2026-11-15 the work is **Path A**: design the
data of every feature, one area at a time, before building more. Areas 1 and 2 are designed, Area 3 is in progress,
and four pieces are designed but not built. Nothing has been applied to Supabase. This file is a snapshot; the decision
log, the feature-data map and `Qeeva-Backend/AGENTS.md` section 10 are the live sources.

## Steps

Built and tested (code):
- [x] Foundation: Django 5.2 LTS, DRF, environment settings, Supabase JWT verification, tooling (ruff, mypy strict, pytest). Patches 0001-0003.
- [x] Accounts: `profiles`, `username_reservations`, `user_settings`, closed to the public Data API (RLS on, no policies). Patch 0004.
- [x] Test database in Docker (PostgreSQL 17), agent manual, decision log, schema blueprint, GitHub Actions. Patches 0005-0009.
- [x] Decision log moved to `plans/decisions/`; `localhost` read as `127.0.0.1` (tests went from minutes to seconds); stale agent and doc files fixed. Patches 0010-0012.
- [x] Finance tables: `months`, `month_incomes`, `items`, `month_items`, `item_merge_dismissals`, with owner isolation and composite foreign keys. Patch 0013.
- [x] Calculation layer: `apps/finance/calculations.py` and `summary.py`, integer money, the approved dashboard formulas, shared test vectors. Patch 0014.

Designed and recorded (documents only, nothing built):
- [x] Area 1, deficit and funds: one rule for covering a deficit and an old-month gap, the user's pick stored in one column on the saving card, the funds pool and a funds ledger for start amounts and hand-added money. Patches 0015-0018.
- [x] Area 2, goals and notifications: accumulation, goal hit and ETA are calculated; one generic notifications table. Patch 0019.
- [x] Month deletion with funds: months are a calendar, the month is ignored first, a popup lets the user delete everything or keep ticked funds in the same month; ignored months' funds do not count (as in Angular); an Advanced switch for the delete-item confirm. Patches 0019-0021.
- [x] The tables designed but not built are drawn in `schema-blueprint.md`, section "Designed, not built": `month_items.reduction_minor`, `fund_entries`, `notifications`, `user_settings.skip_item_delete_confirm`.

In progress and waiting:
- [ ] Area 3, income and time: working time stays in hours (D-122); income lines copy to the next month automatically for both modes (D-124); a yearly line (a bonus) counts only in the month it arrives, with `frequency` and `due_month` columns (D-125). Decided later the same day: the hours columns may be empty for a line like a Bonus (D-126), the custom month boundary is deferred until users ask (D-127, waiting for his confirmation of how the AI read his answer), and a month's income is its monthly lines plus its yearly lines due that month (D-109 point 5). Still open: how the hourly rates of several lines combine into "Product Price", and whether the monthly-hours override accepts parts of an hour.
- [ ] Areas 4-9: tax (percentage, several, goals, Zakat helper), editing history, credits and debits, pending list, sync and devices, account.
- [ ] "AI choice" items wait for his agreement: the small constraints (D-107), the rest of the calculation layer's shape (D-109; its point 5 is approved) and the yearly-line column design (D-125).

Not touched yet: Supabase (read-only, nothing applied), the JWT key check, running the shared vectors in Angular, any API endpoint.

## Relevant files

- `plans/decisions/decision-log.md`, `plans/plans-Backend/20261115-feature-data-map.md`, `plans/plans-Backend/20261117-ideas-list.md`
- `Qeeva-Backend/AGENTS.md` (sections 8 to 10), `Qeeva-Backend/docs/database/schema-blueprint.md`
- `Qeeva-Backend/apps/finance/` (models, calculations, tests)

## Verification

`pytest -q` with a PostgreSQL URL in `QEEVA_TEST_DATABASE_URL`: 360 passed; `ruff check` and `mypy` clean. The patches 0001 to 0021 were each applied with `git am` on a clean copy before delivery.

## Decisions

D-084, D-087, D-093, D-097, D-101 to D-127 (the ones this period produced); the earlier ones are in the decision log.
