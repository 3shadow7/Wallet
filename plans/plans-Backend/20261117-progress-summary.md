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
data of every feature, one area at a time, before building more. Areas 1 to 5 are designed, Area 6 is in progress,
and several pieces are designed but not built. Nothing has been applied to Supabase. This file is a snapshot; the decision
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
- [x] The tables designed but not built are drawn in `schema-blueprint.md`, section "Designed, not built": `month_items.reduction_minor`, `fund_entries`, `notifications`, `user_settings.skip_item_delete_confirm`, `user_settings.hourly_rate_mode`, the yearly columns, nullable working hours and the numeric manual monthly hours the percentage-tax columns and the threshold on `month_items`, the `holdings` table, the yearly period on a tax card, the Zakat settings columns, the system tables `item_classes` and `item_class_aliases` with `items.item_class_id`, `items.unit` with weight quantities, `zakat_payments`, `metal_prices` and the Zakat settings columns and `default_weight_unit` (D-125, D-126, D-128, D-129, D-130, D-133 to D-146).

In progress and waiting:
- [x] Area 3, income and time: working time stays in hours (D-122); income lines copy to the next month automatically for both modes (D-124); a yearly line (a bonus) counts only in the month it arrives, with `frequency` and `due_month` columns (D-125). Decided later the same day: the hours columns may be empty for a line like a Bonus (D-126), the custom month boundary is deferred and confirmed (D-127), a month's income is its monthly lines plus its yearly lines due that month (D-109 point 5), the hourly rate is one field for Regular and a setting with default combined for Advanced (D-128), and the manual monthly hours accept parts of an hour (D-129). Waiting only for his approval of the D-125 columns and D-107.
- [x] Area 4, tax (designed, nothing pending): a percentage tax is calculated live (D-130), total funds = the funds pool at the start of the month (D-131), several percentage taxes add up from the same base (D-132); the Zakat helper was added to D-113; gold and silver holdings are typed snapshots (D-133) and the threshold is typed (D-134); decided on 2026-11-17 (evening): the yearly period with Ignore (D-135), the Zakat switch and one-time popup (D-136), the card made once from a template (D-137), live wealth (D-138), hidden gold/silver/animal classes (D-139), weight items (D-140); also the Zakat group card with paid toggles (D-141) and online prices (D-142); also D-143 (animals are in scope, design waits), D-144 (currency dropdown, no country), D-145 (paying moves the money; Zakat is driven by settings); D-146 (the first payment is due one year after the point is first reached; checked against zakat.org and the National Zakat Foundation UK); a payment is part of the tax total (D-145); two decimals kept (D-144). General item grouping stays postponed, maybe version 2 (D-092).
- [x] Area 5, history edits (2026-11-19): months follow the calendar, missing months are created with copies, the next month at most one month ahead (D-150); a past month added by hand starts empty (D-151); the edit trace in Advanced only (D-152). Also: the Zakat year restarts after a dip (D-147), Hijri year and display-only calendar (D-148), decimals as a setting with 3 decimals stored (D-149).
- [x] Also 2026-11-19 (13:16): storage of 3 decimals confirmed (D-149), month reading confirmed (D-150), Umm al-Qura with the 1st/2nd-day rule (D-154), welcome and fast-clear ideas deferred (D-153).
- [ ] Area 6, credits and debits (in progress): gifts to the funds with a name (D-155), one add card with two tabs (D-156, to confirm), debts with partial repayments as moves of the funds (D-157); 14:06: tabs confirmed, Reconcile Balance (D-158), debt dates and three reminders (D-159), a gift he gives is a burn item (D-160), debts in Zakat (D-161, proposal, from NZF and zakat.org).
- [x] 2026-11-19 (14:06): his `git log` shows patches 0025 to 0035 applied and pushed.
- [x] 2026-11-21: Zakat redesigned by the user (D-162 to D-166): silver nisab of 595 g, black-market rate, daily lunar-year counter stored in `zakat_cycles`, year end checked as if paid, debts by due date. D-161 superseded. 03:19: one Zakat item per year inside the group card, unpaid Zakat deducted (D-167); Zakat on money only, gold/silver/holdings/animals to version 2 (D-168).
- [x] 2026-11-19: he ran the 360 backend tests on his own machine (Windows, Python 3.14.3, pytest 9.2.0): all passed.
- [ ] Areas 7-9: pending list, sync and devices, account.
- [ ] "AI choice" items wait for his agreement: the rest of the calculation layer's shape (D-109; its point 5 is approved) and the columns and rounding of D-130. D-107 and D-125 were approved on 2026-11-17.

Not touched yet: Supabase (read-only, nothing applied), the JWT key check, running the shared vectors in Angular, any API endpoint.

## Relevant files

- `plans/decisions/decision-log.md`, `plans/plans-Backend/20261115-feature-data-map.md`, `plans/plans-Backend/20261117-ideas-list.md`
- `Qeeva-Backend/AGENTS.md` (sections 8 to 10), `Qeeva-Backend/docs/database/schema-blueprint.md`
- `Qeeva-Backend/apps/finance/` (models, calculations, tests)

## Verification

`pytest -q` with a PostgreSQL URL in `QEEVA_TEST_DATABASE_URL`: 360 passed; `ruff check` and `mypy` clean. The patches 0001 to 0021 were each applied with `git am` on a clean copy before delivery.

## Decisions

D-084, D-087, D-093, D-097, D-101 to D-168 (the ones this period produced); the earlier ones are in the decision log.
