# Schema blueprint

The Django models and migrations are the real schema. This file is the human-readable map of it
plus the approved-but-unbuilt designs. Decisions behind each rule: see `plans/decisions/decision-log.md`.

Conventions for every table: `uuid` ids, `timestamptz` (UTC) timestamps, money as `bigint` minor
units (2 decimals, no currency, D-033), CHECK constraints for every fixed list, RLS on with no
policies (D-087), every model declares `OWNER_FIELD`.

## Built: `apps/accounts` (migrations 0001-0003)

### `profiles` (owner field: `id`)
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | same uuid as Supabase `auth.users.id`; FK `ON DELETE CASCADE` (SQL, migration 0002) |
| `username` | text | unique ignoring case (`lower(username)`); `^[A-Za-z0-9_]{3,20}\Z` |
| `display_name` | text, null | NULL or 1-30 characters (empty string forbidden) |
| `role` | text | `user` or `admin`, default `user` |
| `status` | text | `active`, `suspended`, `pending_deletion`, default `active` |
| `username_changed_at` | timestamptz, null | start of the 14-day wait |
| `created_at`, `updated_at` | timestamptz | default now |
| `deleted_at` | timestamptz, null | when deletion was requested |

### `username_reservations` (owner field: none, internal)
`id` uuid PK · `username` text (same format check) · `previous_owner_id` uuid null (FK to
`profiles`, `ON DELETE SET NULL` in SQL) · `reserved_until` timestamptz. Index on
`(lower(username), reserved_until)`. No unique constraint on the name (D-089).

### `user_settings` (owner field: `user_id`)
`user_id` uuid PK/FK to `profiles` (`ON DELETE CASCADE`) · `experience_mode` `regular|advanced`
(default `regular`) · `timezone` text (IANA name, checked in Python, not empty) · `language`
(`en`) · `skip_merge_confirm` boolean default false · `created_at`, `updated_at`.

## Built: `apps/finance` (migrations 0001-0003)

All have `user_id` (the owner) so isolation checks are simple; composite foreign keys
`(month_id, user_id)` / `(item_id, user_id)` make sure a card can never point at another user's
month or item (D-105). Delete rules: user -> everything goes; month -> its income lines and cards;
item -> its merge dismissals; an item that still has cards cannot be deleted. Migration 0002 holds
the foreign keys (SQL), 0003 closes the tables to the Data API.

### `months`
`id`, `user_id`, `month_start` date (day must be 1), `totals_mode` `auto|included|excluded`
(default `auto`, D-037), timestamps. Unique `(user_id, month_start)`.

### `month_incomes`
`id`, `user_id`, `month_id`, `name` (optional, 1-30), `amount_minor` bigint >= 0,
`hours_per_day` numeric 0-24 (default 8), `days_per_week` smallint 1-7 (default 5),
`work_hours_override` int 1-744 (optional, manual monthly hours; will become numeric(5,2) to accept parts of an hour, D-129), `hourly_rate_manual_minor`
bigint > 0 (optional), timestamps. Working time stays in hours (D-122); both hours columns will become optional, a line may have no working time (D-126, designed below). Income lines copy to the next month automatically, so there is no repeat column (D-124); yearly lines add two columns (D-125, below). Computed, not stored: monthly hours = override, else
`hours_per_day x days_per_week x 4`; hourly rate = manual rate, else `amount / monthly hours`.

### `items`
`id`, `user_id`, `name` (1-40, no leading/trailing/double spaces; letters, digits and single spaces only, checked in Python, D-104), `name_key` (normalized for
comparison: case, Arabic spelling variants, digits; computed by Django in `apps/finance/naming.py`, D-103), `type` `burn|tax|saving` (never changes, D-047),
`target_minor` bigint > 0 (optional, saving only, database CHECK), timestamps. Unique `(user_id, name_key, type)`.

### `month_items` (the cards)
`id`, `user_id`, `month_id`, `item_id`, `importance` `want|must|emergency|gift` (default
`want`), `amount_minor` >= 0 (will be empty on a percentage tax card, D-130), `quantity` int >= 1, `unit_price_minor` (NULL = the +1 / +N
buttons are locked, D-065), `quantity_needs_review` boolean, `is_ignored` boolean, timestamps.
Unique `(month_id, item_id, importance)`. A "group" (same item, several importances) is computed,
not a table (D-075).

### `item_merge_dismissals`
`id`, `user_id`, `item_a_id`, `item_b_id`, `created_at`. Unique on the pair (D-053); `item_a_id < item_b_id` (D-106).

## Designed, not built (approved designs; no migration yet)

Same conventions as above. Each piece is built with the code that uses it (decision D-084 also applies to
Supabase: nothing is applied without the user's explicit approval).

### New columns on `month_incomes`: yearly lines (D-125, approved)
| Column | Type | Rule |
|---|---|---|
| `frequency` | text | `monthly` or `yearly` (CHECK); default `monthly` |
| `due_month` | smallint, null | 1 to 12; required when `frequency` is `yearly`, empty when `monthly` (one CHECK for both) |

A yearly line is copied to every next month like all lines (D-124) and keeps its yearly amount, but it counts in a month's income only in its `due_month`;
a month's income = its monthly lines + its yearly lines whose `due_month` is that month (confirmed by the user on 2026-11-17, D-109 point 5). The user picks the month it arrives (for example his work anniversary), so the year can start
at the job start date and not in January. Other repeat types can be added later by changing the CHECK list.

### Change on `month_incomes`: working time may be empty (D-126) and manual monthly hours accept parts of an hour (D-129), approved; details by the AI
| Column | Built today | After the change |
|---|---|---|
| `hours_per_day` | numeric(4,2), NOT NULL, default 8, 0 to 24 | nullable, no default, 0 to 24 when set |
| `days_per_week` | smallint, NOT NULL, default 5, 1 to 7 | nullable, no default, 1 to 7 when set |
| `work_hours_override` | integer, null, 1 to 744 | numeric(5,2), null, 1 to 744 (a widening: every built value stays) |

One CHECK: both are empty or both are set. The existing range CHECKs stay (a NULL passes them). A line with no working time is a Bonus, rent or gift line.
Rules (calculated, never stored): monthly hours = `work_hours_override` if set, else `hours_per_day x days_per_week x 4` if both are set, else none; hourly rate = `hourly_rate_manual_minor` if set, else `amount / monthly hours` when monthly hours are more than 0, else none. A line with no hourly rate is left out when rates are combined (how several lines combine is still open). The defaults 8 and 5 are dropped so the database never invents working time (D-032); a screen may pre-fill them. Built rows keep their values.

### New columns on `month_items`: percentage tax (D-130, approved; columns and rounding by the AI)
| Column | Type | Rule |
|---|---|---|
| `rate_basis_points` | integer, null | 1 to 10000 (10% = 1000); only on tax cards (checked in Python) |
| `rate_base` | text, null | `income` or `funds` (CHECK); set exactly when `rate_basis_points` is set |
| `amount_minor` | bigint, now null | empty on a percentage card; >= 0 when set |

One CHECK: a card is EITHER fixed (amount set; rate and base empty) OR a percentage (rate and base set; amount empty). The amount of a percentage card = base x rate / 10,000, rounded to the nearest cent (halves up); it is calculated, never stored. Base `income` = the month's income; base `funds` = the funds pool at the start of the month (D-131). Several percentage cards each use the same base and the amounts are added (D-132). Example: income 3,000.00 with two cards, 10% and 5%: 300.00 + 150.00 = 450.00.

### New column on `month_items`: the user's pick of which saving item gives money (D-117 and D-111, approved)
| Column | Type | Rule |
|---|---|---|
| `reduction_minor` | bigint, null | NULL = not chosen (the app splits pro-rata by default); otherwise 0 up to the card's `amount_minor` (CHECK in the database); saving cards only (checked in Python, because the card does not store the item's type) |

How much the card really saved this month is calculated from the month's totals and this pick (D-119). Build-time rule: if the user lowers the card's amount below the pick, the pick goes back to NULL.

### `fund_entries` (owner field: `user_id`) (D-118, approved)
The funds ledger: the user's total funds are one pool, a saving item holds a part of it. The pool total and
the free part are calculated from these rows plus the months (never stored). It also covers the old "manual
savings" idea (D-083, D-093).
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner; FK to `profiles` `ON DELETE CASCADE` |
| `month_id` | uuid | the month the entry belongs to; composite FK `(month_id, user_id)` so it cannot join another user's month |
| `kind` | text | `opening`, `add`, `withdraw`, `to_item`, `from_item` (CHECK) |
| `amount_minor` | bigint | > 0 (the kind says the direction) |
| `item_id` | uuid, null | required for `to_item` and `from_item`, must be NULL for the other kinds (CHECK); composite FK `(item_id, user_id)`; saving items only (checked in Python) |
| `note` | text, null | optional, 1-60 characters |
| `created_at`, `updated_at` | timestamptz | default now |

Rules (D-123, approved):
- Each addition is its own row (the user adds 28, then 22, then 10 = three rows), so the user can keep or delete each one.
- Months are a calendar; "delete a month" erases its data. The month must be ignored first, then Delete opens a popup with the cards and the
  entries, the total funds before and after, and the choice: delete everything, or delete the cards and income lines and keep the ticked entries.
  **Kept entries stay in the same month** (nothing moves). If nothing is kept the month row is deleted, otherwise it stays and holds only those entries.
- `month_id` delete rule is NO ACTION: a month that still has entries cannot be deleted by the database (safety net); the popup works in one transaction.
- `item_id` delete rule is CASCADE: deleting a saving item deletes its move entries and the money goes back to the free funds (confirm message; an Advanced user can switch it off, see `user_settings` below).
- Entries do not count in the funds pool while their month is ignored (decided, as Angular does today); no column is needed for this, it is a calculation rule. The History table's "Direct Additions" column of a month = that month's `opening` + `add` - `withdraw` entries (item moves do not change the total).

### New column on `user_settings`: how the hourly rate is shown (D-128, approved; the formula is by the AI)
| Column | Type | Rule |
|---|---|---|
| `hourly_rate_mode` | text | `combined` or `per_income` (CHECK); default `combined` |

Regular always sees one field (combined), whatever is stored; an Advanced user may choose `per_income` in settings (one field for each income line that has an hourly rate). Both are calculated, nothing about the rate is stored. Combined rate = the sum of the amounts that count in the month of the lines that have monthly hours, divided by the sum of their monthly hours (a line with no working time does not change it; a line that has only a manual rate takes part with hours = amount / manual rate). Example: Salary 800.00 for 160 h and Freelance 600.00 for 40 h: combined = 1400 / 200 = 7.00 per hour; per income = 5.00 and 15.00.

### New column on `user_settings`: switch off the delete-item confirm (D-123, approved)
| Column | Type | Rule |
|---|---|---|
| `skip_item_delete_confirm` (working name) | boolean | default false; same pattern as `skip_merge_confirm`; only Advanced users see the switch (a screen rule, like D-079) |

### `notifications` (owner field: `user_id`) (D-121, approved; details by the AI)
One generic table for every kind of message (goal progress now; tax goals, Zakat, Telegram later). A row is
created the first time the app finds that something is newly true.
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner; FK to `profiles` `ON DELETE CASCADE` |
| `kind` | text | fixed list (CHECK), first values `goal_progress` (25, 50, 75, 100 percent) and `goal_next_month` (D-072); each new feature adds its kind with its migration |
| `dedupe_key` | text | 1-200 characters; unique per user `(user_id, dedupe_key)`, for example `goal:<item id>:50`, so the same message is never created twice |
| `payload` | jsonb, null | small extra data for the message (item name, percent, month); no money rules live here |
| `created_at` | timestamptz | default now |
| `seen_at` | timestamptz, null | NULL = not seen yet |

Index on `(user_id, seen_at)` for the unread count. Default for the open question: a milestone that is lost and
reached again after a history edit does **not** notify again (the unique key blocks it); the user can change this later.
Channels (in-app, Telegram), settings and push are Area 9.

## Not computed into storage (by design)
Item groups, monthly working time, hourly rate, the amount of a percentage tax card, each month's result, the savings total, the funds pool and its free part, a funds gap (D-119) and a goal's accumulated amount are all calculated.

## Formulas (from `description`; ignored items excluded everywhere)
```
planned_outflow = burn + tax + saving_target
free_money      = income - planned_outflow          (may be negative)
real_expense    = burn + tax
savings_balance = income - real_expense             (may be negative)
actual_saved    = max(0, savings_balance)
overspend       = max(0, real_expense - income)
saving_shortfall = max(0, saving_target - actual_saved)
```
If `burn + tax` exceeds income, saving items save nothing that month. When `actual_saved` is
below the target, the user picks which saving items shrink; at least one must stay reducible.
Never change a formula without the user's approval.

## Still to design
Pending list (D-062/D-074), goals shared between items, sync/devices, plans and waitlist, consents, audit logs,
data export and account deletion flow, Community, debit/credit, the Zakat helper (Area 4: yearly period on a tax card, holdings such as gold, the threshold, suggest vs auto). The custom month boundary is deferred (D-127).
