---
title: "Feature and data map (finish the tables)"
author: "Claude"
date: "2026-11-15"
status: "draft"
---

# Feature and data map

## TL;DR

The user wants every table the project will ever need designed up front, including features that wait
on the list, so a later feature adds tables or columns and never forces a rewrite. This document is
the living map: for every feature, what data it needs, what is stored and what is calculated, what the
database already has, and what is still open. We discuss one area at a time (since 2026-11-17 two or more
questions per message, at his request) and write the answer here and in the decision log. No table is built before its area is approved.

## Steps

1. [x] Area 1 (data design): D-117 approved (one nullable `reduction_minor` column on the saving card for the pick). D-111 approved: the deficit (and the editing-an-old-month gap, D-119) lowers the month's not-yet-completed saving cards; the default is pro-rata, a tap overrides it, nothing is forced or deleted. D-120 (global undo) deferred.
2. [x] Area 2 (data design): accumulation, goal hit, stop-repeating and ETA are calculated (no table); notification state is one generic `notifications` table (D-121); an amount saved before Qeeva is a funds-ledger entry (D-118).
3. [x] Area 3: income and working time (Regular vs Advanced, D-109 point 5, D-115). Started: working time stays in hours (D-122, approved 2026-11-17; the minutes idea was dropped by the user). Decided: income lines copy to the next month automatically for both modes, no repeat column (D-124, option A). Yearly lines (a bonus once a year) count only in the month they arrive, with `frequency` and `due_month` columns (D-125). Answered later on 2026-11-17: the two hours columns may be empty for a line like a Bonus (D-126); the custom month boundary is deferred, confirmed (D-127; it was already in his project description); a month's income = its monthly lines + its yearly lines due that month (D-109 point 5, approved); the hourly rate: Regular one field, Advanced a setting `hourly_rate_mode` with the default combined (D-128); the manual monthly hours accept parts of an hour (D-129, from his D-115 rule). Area 3 is done in the design; the D-125 columns and D-107 wait for his approval (shown with an example on 2026-11-17).
4. [ ] Area 4: tax (D-112, D-113, D-114). Decided 2026-11-17: a percentage tax is calculated live, the card stores the rate and its base (D-130); "total funds" = the funds pool at the start of the month (D-131); several percentage taxes use the same base and add up (D-132); a tax goal follows D-071. Still open: the Zakat helper (yearly period on a tax card, holdings such as gold, the threshold, suggest vs auto).
5. [ ] Area 5: editing history and recalculating charts.
6. [ ] Area 6: credits and debits (gifts, emergency, debts), manual savings (D-083, D-093), item links (D-092).
7. [ ] Area 7: pending list (bank, voice, camera; D-062, D-074).
8. [ ] Area 8: sync and devices (offline first).
9. [ ] Area 9: account: plans, consents, audit, export/delete, notifications, Telegram bot, Community, Arabic, Advanced switch.

## Map

| Area | What the feature needs | In the database today | Open |
|---|---|---|---|
| 1 Deficit and saved amount | When free money is below 0: lower this month's saving cards (the user picks which when there are several), then take the rest from earlier savings ("storage"), with a pick. A note on the card: planned 300, saved 200, why. | Card `amount_minor` (the plan) only. No place for "reduced by" or "taken from storage". `is_reducible` not built (D-097). | Default while the user has not picked (Angular splits pro-rata today); one column on the card or a separate table for the pick; the storage total should be derived from months plus a list of manual adjustments, not a stored number (Angular keeps `totalSavings` as a stored number, which drifts when history is edited). |
| 2 Goals | Accumulated saved amount per saving item across months; ignored months add 0; alert at the target; ETA from this month's saved amount; notifications at 25/50/75/100%. | `items.target_minor` (saving only). Accumulation is calculated, but it needs Area 1's saved amounts. | Where notification state (seen, sent) lives. |
| 3 Income and time | Regular: one income, time in h:mm. Advanced: several income types, hourly rate summed into "Product Price", custom month boundary, time as h:mm or decimal. | `month_incomes` (amount, hours_per_day numeric, days_per_week, override, manual rate). `months.month_start` is the 1st. | Hours stay as built: DECIDED, D-122; the hours columns may be empty: DECIDED, D-126. Income of a month: DECIDED (D-109 point 5, D-125). Month boundary for Advanced: DEFERRED, D-127. Hourly rate of several lines: DECIDED, D-128. Manual monthly hours accept parts of an hour: DECIDED, D-129. |
| 4 Tax | Fixed amount (built). Percentage of income or of total funds. Several taxes. Goal for a tax. Zakat helper with thresholds for money, gold, livestock; opt-in; may add or remove a tax item. | Tax item with a fixed amount card (a percentage card is designed, D-130). Target is saving-only (CHECK, D-107). | Percentage live, total funds, combining: DECIDED (D-130 to D-132). Open: Zakat yearly period, holdings (gold grams; livestock later), threshold, suggest vs auto (D-032). |
| 5 History edits | Editing a past month recomputes charts. | Nothing is stored derived, so recalculation is free. | Charts' cache, if any, later. |
| 6 Credits, manual savings, links | Gifts, emergency, debts with a card and logic; manual savings list; linked items; the funds ledger of D-118 (opening funds, manual add/withdraw, move into or out of a saving item). | Not built (D-092, D-093). | All open; design together. The ledger is the leading idea for the manual savings list. |
| 7 Pending list | Bank, voice and camera items wait for a name and confirmation before joining the log. | Not built; the items table needs no change (D-013). | Table shape. |
| 8 Sync and devices | Offline first; push/pull when asked; device list; conflicts. | Nothing yet. | Conflict rule, ids from the client, tombstones for deletes. |
| 9 Account | Plans/waitlist, consents, audit log, export/delete, notifications, Telegram bot token and linking, Community, language, Advanced switch. | `profiles`, `username_reservations`, `user_settings`. | Each is its own small design. |

## Notes logged on 2026-11-15 (the user's words, cleaned)

- A saving item may have a target; it is optional (D-107 point 1 confirmed).
- Overspend: taken from this month's saving items if they hold enough, the user picking which one when there are several; the rest from the total funds in storage. The card says "planned 300, saved 200 because of this month's overspend" (D-111). The Angular app has the single-item case; the pick between several saving items is not built yet and must be.
- Tax can be a fixed number (30 each month for a service) or a percentage of income or of total funds (D-112). Percentages are not built and must not be forgotten.
- Advanced: Zakat on money, gold and livestock when thresholds are hit, adding and removing the tax automatically; not every user is Muslim, so there is a way to offer it (D-113).
- Several tax items: allowed; percentage taxes use the same base and add up (D-132).
- Zakat (2026-11-17): the user described it as "when he has gold and the year ends, he gives Zakat from his total funds" and asked to add it; D-113 holds the AI's reading and the open pieces.
- A tax can have a target with notifications, for example a monthly car tax (D-114).
- Time: Regular time format only; Advanced time or decimal; where to switch is open (D-115).
- History table check (2026-11-17, read from `history.component.ts` and `.html`): columns are Count/Ignore toggle, delete button, Month, Income, Planned Outflow, Target Savings, Free Money & Savings Impact, From Budget, Direct Additions, Total Savings Balance. Ignored months stay in the table (grey) but are left out of the totals, the best-month tile and the charts; the charts have a "Show excluded months" button (off by default). Ignore/Include has a 6-second undo, Delete an 8-second undo, Delete shows only for an ignored month with no items. Angular's `MonthlyIncome` type already has `isRecurring` and `frequency` per income line (kept in storage and backup, not used on a screen yet): useful for the Area 3 question about which income lines repeat.
- Time storage: hours stay (D-122; the user first picked minutes on 2026-11-16 and changed his mind on 2026-11-17). The tables designed so far (`reduction_minor`, `fund_entries`, `notifications`) are drawn in `schema-blueprint.md`, section "Designed, not built".
- Deleting a month that has funds entries (2026-11-17, his popup idea, D-123, rewritten after he pointed to the Angular behavior): months are a calendar, so "delete" erases the month's data; the month is ignored first, then Delete opens a popup (cards and each entry listed; delete everything, or keep the ticked entries). Kept entries stay in the SAME month. The database refuses to delete a month that still has entries (safety net). Deleting a saving item returns its money to the free funds; an Advanced user can switch that confirm off (`user_settings.skip_item_delete_confirm`). DECIDED the same day (his choice, as Angular): funds entries do not count while their month is ignored; one meaning of Ignore for every user mode. Small screen ideas that are not decisions go to `plans/plans-Backend/20261117-ideas-list.md`.

## Relevant files

- `Qeeva-Backend/docs/database/schema-blueprint.md`, `Qeeva-Backend/apps/finance/models.py`
- `plans/plans-Backend/20261117-progress-summary.md` (what is done so far), `plans/plans-Backend/20261117-ideas-list.md`
- `Qeeva-Backend/apps/finance/calculations.py`
- `plans/decisions/decision-log.md`
- `Qeeva-Frontend/src/app/@SERVICES/state/budget-state.service.ts` (how the single saving item case works today)

## Verification

- Each area ends with the user's approval written in the decision log, then a plan, then code with tests.
- The decision-log guard test (`core/tests/test_decision_log.py`) keeps the numbering honest.

## Decisions

D-111 to D-123 (approved decisions and deferred ideas, 2026-11-15 to 2026-11-17). Earlier: D-016, D-018, D-032, D-071 to D-073, D-083, D-092, D-093, D-097.
