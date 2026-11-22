# Schema blueprint

The Django models and migrations are the real schema. This file is the human-readable map of it
plus the approved-but-unbuilt designs. Decisions behind each rule: see `plans/decisions/decision-log.md`.

Conventions for every table: `uuid` ids, `timestamptz` (UTC) timestamps, money as `bigint` minor
units (built: 2 decimals; designed: 3 decimals stored for every user, shown with 2 or 3 by a setting, D-149; no currency, D-033), CHECK constraints for every fixed list, RLS on with no
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
Designed rules (no new column): see "Changes to `months`" below.

### `month_incomes`
`id`, `user_id`, `month_id`, `name` (optional, 1-30), `amount_minor` bigint >= 0,
`hours_per_day` numeric 0-24 (default 8), `days_per_week` smallint 1-7 (default 5),
`work_hours_override` int 1-744 (optional, manual monthly hours), `hourly_rate_manual_minor`
bigint > 0 (optional), timestamps. Working time stays in hours (D-122); changes are designed below. Computed, not stored: monthly hours = override, else
`hours_per_day x days_per_week x 4`; hourly rate = manual rate, else `amount / monthly hours`.

### `items`
`id`, `user_id`, `name` (1-40, no leading/trailing/double spaces; letters, digits and single spaces only, checked in Python, D-104), `name_key` (normalized for
comparison: case, Arabic spelling variants, digits; computed by Django in `apps/finance/naming.py`, D-103), `type` `burn|tax|saving` (never changes, D-047),
`target_minor` bigint > 0 (optional, saving only, database CHECK), timestamps. Unique `(user_id, name_key, type)`. Designed, not built: `unit` (D-140), below.

### `month_items` (the cards)
`id`, `user_id`, `month_id`, `item_id`, `importance` `want|must|emergency|gift` (default
`want`), `amount_minor` >= 0, `quantity` int >= 1 (both change, see "Designed, not built"), `unit_price_minor` (NULL = the +1 / +N
buttons are locked, D-065), `quantity_needs_review` boolean, `is_ignored` boolean, timestamps.
Unique `(month_id, item_id, importance)`. A "group" (same item, several importances) is computed,
not a table (D-075).

### `item_merge_dismissals`
`id`, `user_id`, `item_a_id`, `item_b_id`, `created_at`. Unique on the pair (D-053); `item_a_id < item_b_id` (D-106).

## Designed, not built (approved designs; no migration yet)

Same conventions as above. Current truth only: replaced designs are not kept here, their history is in the
decision log (D-172). The short list of every final table is `final-table-list.md` next to this file. Each piece
is built with the code that uses it; nothing is applied to Supabase without the user's explicit approval (D-084).
Money: every amount is stored with 3 decimals for every user (integer thousandths); `user_settings.decimal_places`
only changes the display (D-149). "Rounded" below means to the nearest thousandth, halves up.

### Changes to `month_incomes` (D-122, D-124, D-125, D-126, D-129; approved)
| Column | Type | Rule |
|---|---|---|
| `frequency` | text | `monthly` or `yearly` (CHECK); default `monthly` |
| `due_month` | smallint, null | 1 to 12; required for `yearly`, empty for `monthly` (CHECK) |
| `hours_per_day` | numeric(4,2), null | 0 to 24 when set; no default (was NOT NULL, default 8) |
| `days_per_week` | smallint, null | 1 to 7 when set; no default (was NOT NULL, default 5) |
| `work_hours_override` | numeric(5,2), null | 1 to 744 (was integer) |

One CHECK: `hours_per_day` and `days_per_week` are both empty or both set. Lines copy to the next month automatically
(D-124). A month's income = its monthly lines + its yearly lines whose `due_month` is that month (D-109 point 5).
Calculated: monthly hours = override, else `hours_per_day x days_per_week x 4`, else none; hourly rate = manual rate,
else `amount / monthly hours`, else none (the app never invents working time, D-032).

### Changes to `items` (D-140; approved)
| Column | Type | Rule |
|---|---|---|
| `unit` | text | `piece`, `g` or `kg` (CHECK); default `piece`; fixed when the item is created |

### Changes to `month_items`, the cards (D-117, D-130, D-134, D-135, D-140; approved)
| Column | Type | Rule |
|---|---|---|
| `amount_minor` | bigint, null | >= 0 when set; empty on a percentage card (was NOT NULL) |
| `rate_basis_points` | integer, null | 1 to 10000 (10% = 1000); tax cards only (checked in Python) |
| `rate_base` | text, null | `income` or `funds` (CHECK); set exactly when `rate_basis_points` is set |
| `threshold_minor` | bigint, null | > 0; only on a percentage card; the amount is 0 while the base is below it (D-134) |
| `frequency` | text | `monthly` or `yearly` (CHECK); default `monthly`; tax cards only (checked in Python) |
| `due_month` | smallint, null | 1 to 12; required for `yearly`, empty for `monthly` (CHECK) |
| `reduction_minor` | bigint, null | NULL = not chosen (pro-rata); otherwise 0 up to `amount_minor` (CHECK); saving cards only (Python) |
| `quantity` | numeric(14,3) | > 0 (was integer >= 1); whole numbers only while the item's unit is `piece` (Python) |

One CHECK: a card is fixed (amount set, rate and base empty) or a percentage (rate and base set, amount empty).
Percentage amount = base x rate / 10,000, rounded, calculated; base `income` = the month's income, base `funds` = the
funds pool at the start of the month (D-131); several percentage cards add up (D-132). A yearly card is copied every
month (D-082) and counts only in its due month; `is_ignored` still works with it (D-135). `unit_price_minor` is the
price of ONE unit (piece, gram or kg); a weight in another unit is converted exactly (1 kg = 1,000 g). If the user
lowers a saving card below its `reduction_minor`, the pick goes back to NULL (D-119).

### Changes to `months` (D-150 to D-153; approved, no new column)
Months follow the calendar: every missing month up to the current one is created automatically with the usual
copies; the next month may be created by hand at most one month ahead (server check); a month before the first one,
added by hand, starts empty. The trace "changed after the month ended" is calculated from `updated_at` and shown only
in Advanced (D-152). A welcome for new users and a fast clear of fake data are a later idea (D-153).

### Changes to `user_settings` (approved; the columns are by the AI)
| Column | Type | Rule |
|---|---|---|
| `hourly_rate_mode` | text | `combined` or `per_income` (CHECK); default `combined`; Regular always sees combined (D-128) |
| `skip_item_delete_confirm` | boolean | default false; only Advanced sees the switch (D-123) |
| `decimal_places` | smallint | 2 or 3 (CHECK); default 3; Regular always 3; display only (D-149) |
| `default_weight_unit` | text | `kg` or `g` (CHECK); default `kg` (D-140) |
| `reconcile_every_months` | smallint | 6 or 12 (CHECK); default 6 (D-158) |
| `last_reconciled_on` | date, null | set by his reconcile, even when nothing differed (D-158) |
| `zakat_helper_enabled` | boolean | default false; a neutral feature switch; NOT a religion field (D-136) |
| `zakat_rate_basis_points` | smallint, null | 1 to 10000; pre-filled 250 (2.5%) (D-137) |
| `zakat_currency_code` | char(3), null | ISO 4217, three capital letters (CHECK); dropdown of all currencies with a short note; no country field (D-023, D-144) |
| `zakat_clear_count` | smallint | >= 0, default 0; how many times the "delete old Zakat" button was used; the limit (1) is a code constant (D-169) |

CHECK: `zakat_helper_enabled` cannot be true while `zakat_rate_basis_points` or `zakat_currency_code` is empty.
Combined hourly rate = sum of the counted amounts of the lines with monthly hours / sum of those hours (D-128).

### `fund_entries` (owner field: `user_id`) (D-118, D-155, D-157, D-158; approved)
The funds ledger: the total funds are one pool, a saving item holds a part of it. The pool total and its free part
are calculated from these rows plus the months.
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner; FK to `profiles` `ON DELETE CASCADE` |
| `month_id` | uuid | composite FK `(month_id, user_id)`; NO ACTION |
| `kind` | text | `opening`, `add`, `withdraw`, `to_item`, `from_item`, `gift`, `lend`, `borrow`, `repay_in`, `repay_out` (CHECK) |
| `amount_minor` | bigint | > 0 (the kind says the direction) |
| `item_id` | uuid, null | required for `to_item` and `from_item`, empty otherwise (CHECK); composite FK; CASCADE; saving items only (Python) |
| `debt_id` | uuid, null | required for `lend`, `borrow`, `repay_in`, `repay_out`, empty otherwise (CHECK); composite FK `(debt_id, user_id)`; CASCADE |
| `title` | text, null | 1-60; required for `gift` (who gave it) (D-155) |
| `counted_minor` | bigint, null | >= 0; the amount he counted; set on a Reconcile Balance row (`add` or `withdraw`) (D-158) |
| `note` | text, null | 1-60 |
| `created_at`, `updated_at` | timestamptz | default now |

Rules: each addition is its own row; entries do not count while their month is ignored; deleting a month follows the
D-123 popup (kept entries stay in the same month); deleting a saving item returns its money to the free funds.
Money received outside income (`gift`), lending, borrowing and repayments are moves of the funds, never income or
expense (D-155, D-157). A repayment larger than the open amount, or a move larger than the free funds, is refused at
entry. Reconcile Balance (D-158): on the reminder, the new income is subtracted from his count and the rest is compared
with the funds at the end of the last finished month; the difference is one `add` or `withdraw` row.

### `debts` (owner field: `user_id`) (D-157, D-159; approved)
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner; FK to `profiles` `ON DELETE CASCADE` |
| `direction` | text | `lent` or `borrowed` (CHECK) |
| `person_name` | text | 1-60, required |
| `month_id` | uuid | the month it started; composite FK `(month_id, user_id)` |
| `started_on` | date | the exact day, for display; inside that month (Python) |
| `due_on` | date, null | optional due date |
| `note` | text, null | 1-60 |
| `created_at`, `updated_at` | timestamptz | default now |

The open amount and the status (open, settled) are calculated from its `fund_entries`. Deleting a debt deletes its
entries. Reminders while open: a week before, on the 1st of the due month, on the due day; never two on the same day.
A gift he gives is an ordinary `burn` card with importance `gift` (D-160).

### `notifications` (owner field: `user_id`) (D-121; approved)
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner; FK to `profiles` `ON DELETE CASCADE` |
| `kind` | text | CHECK list: `goal_progress`, `goal_next_month`, `zakat_point`, `zakat_restarted`, `zakat_due`, `prices_stale`, `reconcile_due`, `debt_due_week`, `debt_due_month`, `debt_due_day`; each new feature adds its kind with its migration |
| `dedupe_key` | text | 1-200; unique `(user_id, dedupe_key)` |
| `payload` | jsonb, null | small display data only, no money rules |
| `created_at` | timestamptz | default now |
| `seen_at` | timestamptz, null | NULL = not seen |

Index on `(user_id, seen_at)`. A milestone lost and reached again after a history edit does not notify again.

### `pending_entries` (owner field: `user_id`) (D-062, D-074, D-173 to D-175; approved; columns by the AI)
Bank, voice, camera and card entries wait here until he confirms them; nothing counts in any total while pending.
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner; FK to `profiles` `ON DELETE CASCADE` |
| `source` | text | `bank`, `voice`, `camera`, `card` (CHECK) |
| `status` | text | `pending`, `confirmed`, `dismissed` (CHECK); default `pending` |
| `external_id` | text, null | the source's own id (a bank transaction id); unique `(user_id, source, external_id)` when set |
| `occurred_on` | date | the day the money moved; decides the month on confirm (D-175) |
| `direction` | text | `out` or `in` (CHECK) |
| `amount_minor` | bigint, null | >= 0; may be empty from voice until he gives it |
| `suggested_name` | text, null | 1-40; empty for bank entries, he types it (D-074) |
| `suggested_type` | text, null | `burn`, `tax`, `saving` (CHECK) |
| `raw_text` | text, null | up to 500 characters: the voice transcript or the receipt text, for display |
| `month_item_id` | uuid, null | the card it became; set on confirm; composite FK; ON DELETE SET NULL (the row stays `confirmed`, so a re-sync never brings it back) |
| `decided_at` | timestamptz, null | when he confirmed or dismissed it |
| `created_at`, `updated_at` | timestamptz | default now |

CHECK: `month_item_id` may be set only when `status` is `confirmed`. Confirm = one transaction: create or reuse the
month of `occurred_on` (D-150, D-151), create the card, set the link and the status. Receipt photos themselves are not
stored here (file storage is a later decision); the retention of `raw_text` and bank data is part of Area 9 (account,
privacy). An incoming bank entry may become income, a gift or a repayment: how it is classified is a later detail.

### Zakat (D-136, D-162 to D-171; approved; may be opened again, so these tables stay separate)
Money only for now (D-168). Rules:
- Threshold (nisab) = 595 g x silver price per gram in USD x his black-market rate, every day; 595 is a code constant (D-162, D-163).
- Wealth = total funds + free money of the current month + lent money due inside the running year - borrowed money due by the year end - Zakat of earlier years not paid yet (D-164, D-166, D-167).
- One check per day, the first time the app is opened that day; missed days are treated as unchanged. The check keeps running while Zakat is switched off (hidden), so years that finish while it is off show up when it is turned on again (D-170).
- Above the threshold a Hijri year (Umm al-Qura) starts; below it the year stops; above again a new year starts (D-147, D-148, D-164). The first crossing shows one popup (D-136).
- Year end: wealth >= threshold: the year is `completed`, Zakat = wealth x rate, one Zakat item appears in that month (a year end on the 1st or 2nd goes to the month before, D-154); then, as if paid, wealth - Zakat >= threshold starts a new year the same day (D-165).
- The Zakat group card is the Zakat money: total of the unpaid items, one item per completed year, no edit, no delete; "spent" writes a payment counted in that month's tax total (D-145, D-167).
- Zakat off hides everything and keeps the rows (D-169). The "delete old Zakat" button (once per user for now) deletes EVERY Zakat row of the user, years and payments, for a fresh start; the tax totals of the months that held payments go down by those amounts (D-171).

`metal_prices` (owner field: `user_id`)
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner |
| `metal` | text | `silver` (CHECK; `gold` comes back in version 2) |
| `price_per_gram_minor` | bigint | >= 0, in US dollars (D-163) |
| `fetched_at` | timestamptz | |
| `source` | text | `api` or `typed` (CHECK) |
| `created_at`, `updated_at` | timestamptz | default now |

Unique `(user_id, metal, fetched_at)`. Price of a day = newest row not after that day; none = no threshold (D-032).
Notification `prices_stale` after 30 days without an `api` price (D-142).

`exchange_rates` (owner field: `user_id`)
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner |
| `currency_code` | char(3) | ISO 4217 |
| `units_per_usd` | numeric(18,6) | > 0; the black-market rate (example 10.650000 LYD); typed now, a free source later (D-163) |
| `observed_at` | timestamptz | |
| `source` | text | `typed` or `api` (CHECK) |
| `created_at`, `updated_at` | timestamptz | default now |

Unique `(user_id, currency_code, observed_at)`.

`zakat_cycles` (owner field: `user_id`): the stored lunar-year counter (a past day cannot be rebuilt)
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner |
| `started_on` | date | the day the wealth got above the threshold |
| `ends_on` | date | started_on + one Hijri year |
| `stopped_on` | date, null | the day the wealth fell below the threshold |
| `status` | text | `running`, `stopped`, `completed` (CHECK); at most one `running` per user (partial unique index) |
| `wealth_at_end_minor`, `threshold_at_end_minor`, `zakat_minor` | bigint, null | kept on the end day |
| `created_at`, `updated_at` | timestamptz | default now |

`zakat_payments` (owner field: `user_id`)
| Column | Type | Rule |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | owner |
| `zakat_cycle_id` | uuid | composite FK `(zakat_cycle_id, user_id)`; unique: one payment per completed year |
| `month_id` | uuid | the month he marked it spent; composite FK; CASCADE (deleting the month makes the item unpaid again) |
| `amount_minor` | bigint | > 0 |
| `paid_at` | timestamptz | |
| `created_at`, `updated_at` | timestamptz | default now |

Toggling "spent" back deletes the row. Payments do not count while their month is ignored.

### Version 2, maybe (deferred, not designed further)
Zakat on gold, silver and animals (D-133 `holdings`, D-139 `item_classes`, `item_class_aliases`, `items.item_class_id`,
D-143; D-168), gold prices, grouping other items under one title (D-092). Their earlier drafts are in the decision log.

## Not computed into storage (by design)
Item groups, monthly working time, hourly rate, the amount of a percentage tax card, the daily Zakat threshold and the wealth of the daily check (D-162, D-164), the Zakat group total (D-167), the open amount and status of a debt (D-157), each month's result, the savings total, the funds pool and its free part, a funds gap (D-119) and a goal's accumulated amount are all calculated.

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
Approved additions (not formula changes): `tax` of a month also counts the Zakat payments logged in that month (D-145, D-165); a gift he gives is a `burn` item (D-160); money received outside income, lending, borrowing and repayments are moves of the funds, never income or expense (D-155, D-157).

## Still to design
Sync/devices, plans and waitlist, consents, audit logs,
data export and account deletion flow, Community. Version 2, maybe: Zakat on gold, silver and animals (D-168), grouping other items under one title (D-092). Debit/credit is designed (D-155 to D-160). The custom month boundary is deferred (D-127).
