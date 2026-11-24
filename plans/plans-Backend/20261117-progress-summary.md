---
title: "Progress summary: what we have done so far"
author: "Claude"
date: "2026-11-17"
status: "draft"
---

# Progress summary: what we have done so far

## TL;DR

The backend has a tested foundation, the accounts tables, the five finance tables and a pure-Python month
calculation layer (536 tests with PostgreSQL, no finance endpoint). Since 2026-11-15 the work is **Path A**: design the
data of every feature, one area at a time, before building more. Since 2026-11-23 (22:58) the design is complete (D-205) and
the MVP tables are being built in stages. Nothing has been applied to Supabase. This file is a snapshot; the decision
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
- [x] Area 6, credits and debits (closed 2026-11-21; the reconcile reading of D-158 confirmed): gifts to the funds with a name (D-155), one add card with two tabs (D-156, to confirm), debts with partial repayments as moves of the funds (D-157); 14:06: tabs confirmed, Reconcile Balance (D-158), debt dates and three reminders (D-159), a gift he gives is a burn item (D-160), debts in Zakat (D-161, proposal, from NZF and zakat.org).
- [x] 2026-11-19 (14:06): his `git log` shows patches 0025 to 0035 applied and pushed.
- [x] 2026-11-21: Zakat redesigned by the user (D-162 to D-166): silver nisab of 595 g, black-market rate, daily lunar-year counter stored in `zakat_cycles`, year end checked as if paid, debts by due date. D-161 superseded. 03:19: one Zakat item per year inside the group card, unpaid Zakat deducted (D-167); Zakat on money only, gold/silver/holdings/animals to version 2 (D-168). 03:34: Zakat off hides and keeps the data, a once-per-user button deletes old Zakat items (D-169). 03:51: the check keeps running while off (D-170); the button deletes every Zakat row (D-171).
- [x] 2026-11-21: the schema blueprint was cleaned to the current truth only, and `Qeeva-Backend/docs/database/final-table-list.md` lists every final table and column (D-172).
- [x] 2026-11-19: he ran the 360 backend tests on his own machine (Windows, Python 3.14.3, pytest 9.2.0): all passed.
- [x] Area 7, pending list (2026-11-23): one table `pending_entries` for every source (D-173), confirmed and dismissed rows stay, linked to the card (D-174), a confirmed entry goes into the month of its own date (D-175).
- [x] Area 8, sync and devices: deleted rows kept 45 days with the device (D-176, table `devices`), guest data moves into the account (D-177), sign-in prompt after a number of cards set in `app_config` (D-178, D-179), conflicts kept in `sync_conflicts` with a calm notice (D-180), restore from the item card and links from the deleted-items page (D-181); automatic sync, the button only in Settings (D-182); several devices and bank linking are paid (D-183); read-only sharing with trusted people, table `data_shares` (D-184), first viewer free (D-186); free plan one device (D-185); main device keeps working when the plan ends (D-187); viewer access by invite code, per-area switches, `for_user` unchanged (D-189); last visit in Advanced only (D-190). Area 8 closed.
- [x] Area 9: the "My plan" place (D-188) with a stored history `plan_events` (D-192); invitations in the app and by email, sharing usable by the owner himself, invite code 7 days (D-191); the number of plans not decided yet.
- [x] Before building the tables in Django: review every table for values that belong in `app_config` (D-193); approved 2026-11-23 (22:58), nine more keys (D-206).
- [ ] NEXT TARGET after the database design (his words, 2026-11-23): the waitlist and marketing with n8n, even before the app is finished; market everything built; collect feedback from comments and feature ideas; a talk about how n8n works first (D-194).
- [x] 2026-11-23 (02:34): the owner's read-only device uses a viewer slot (D-191); `waitlist_entries` first draft (D-194); account deletion grace 30 days (D-195).
- [x] 2026-11-23 (02:50): audit log of sensitive actions, table `audit_logs` (D-196); nothing deleted from the pending list (D-197).
- [x] 2026-11-23 (03:00): export = one Excel file, can be hidden (D-198); growth control proposal for an MVP with Supabase Free limits checked (D-199, proposal).
- [x] 2026-11-23 (22:34): bank imports start on the link day, offline entries wait (D-204); the pre-build table review is written: `20261123-pre-build-table-review.md` (D-193).
- [x] 2026-11-23 (11:38): consents in `user_consents` (D-202); Community to version 2 (D-026); remembered pending ids erased after 90 days with an import window of the same days (D-203). PATH A COMPLETE except the number of plans, Telegram, Arabic and bank linking.
- [x] 2026-11-23 (11:20): pending entries are deleted on confirm or dismiss; `pending_seen_ids` remembers bank and card ids (D-201); the simpler MVP gate and the MVP scope are confirmed (D-199, D-200).
- [x] 2026-11-23 (03:20): MVP FIRST, behind the waitlist, less complex (D-199 simpler gate, D-200 scope); export hidden by default (D-198); the pending text stays only in the pending row (D-197).
- [x] The calculation layer's shape is approved as a whole (D-109, 2026-11-23 22:58, D-205). D-107 and D-125 were approved on 2026-11-17.
- [x] 2026-11-23 (22:58): THE DESIGN IS COMPLETE (D-205): review approved, 7-day bank overlap confirmed, nine more `app_config` keys (D-206); `waitlist_entries` is redesigned in the n8n talk. The MVP tables are built in stages by `20261123-mvp-tables-build.md`.
- [x] Build stage 1 (patch 0058): money stored in thousandths for every user, migration `finance 0004` (D-149).
- [x] Build stage 2 (patch 0059): `app_config` with its 24 keys and the Django admin page for it, `user_consents` (D-207 to D-209).
- [x] Build stage 3 (patch 0060): `devices`, the sync columns (D-213), Django's own tables locked (D-210); portability rule (D-211); notifications erase rule (D-212).
- [x] Build stage 4 (patch 0061): `fund_entries` (one opening per user, D-215), `notifications`, `reduction_minor`, the daily cleanup command (D-214). EVERY MVP TABLE IS BUILT.
- [ ] Next target: the waitlist and marketing with n8n (redesign `waitlist_entries`, a feedback/ideas table; D-194).

Not touched yet: Supabase (read-only, nothing applied), the JWT key check, running the shared vectors in Angular, any API endpoint.

## Relevant files

- `plans/decisions/decision-log.md`, `plans/plans-Backend/20261115-feature-data-map.md`, `plans/plans-Backend/20261117-ideas-list.md`
- `Qeeva-Backend/AGENTS.md` (sections 8 to 10), `Qeeva-Backend/docs/database/schema-blueprint.md`
- `Qeeva-Backend/apps/finance/` (models, calculations, tests)

## Verification

`pytest -q` with a PostgreSQL URL in `QEEVA_TEST_DATABASE_URL`: 536 passed (since 0061); `ruff check` and `mypy` clean. The patches 0001 to 0021 were each applied with `git am` on a clean copy before delivery.

## Decisions

D-084, D-087, D-093, D-097, D-101 to D-215 (the ones this period produced); the earlier ones are in the decision log.
