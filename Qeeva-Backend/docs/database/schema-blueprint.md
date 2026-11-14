# Schema blueprint

The Django models and migrations are the real schema. This file is the human-readable map of it
plus the approved-but-unbuilt tables. Decisions behind each rule: see `plans/decisions/decision-log.md`.

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

## Approved, not built: `apps/finance`

All have `user_id` (the owner) so isolation checks are simple; composite constraints make sure a
card can never point at another user's month or item.

### `months`
`id`, `user_id`, `month_start` date (day must be 1), `totals_mode` `auto|included|excluded`
(default `auto`, D-037), timestamps. Unique `(user_id, month_start)`.

### `month_incomes`
`id`, `user_id`, `month_id`, `name` (optional, 1-30), `amount_minor` bigint >= 0,
`hours_per_day` numeric 0-24 (default 8), `days_per_week` smallint 1-7 (default 5),
`work_hours_override` int 1-744 (optional, manual monthly hours), `hourly_rate_manual_minor`
bigint > 0 (optional), timestamps. Computed, not stored: monthly hours = override, else
`hours_per_day x days_per_week x 4`; hourly rate = manual rate, else `amount / monthly hours`.

### `items`
`id`, `user_id`, `name` (1-40, no leading/trailing/double spaces), `name_key` (normalized for
comparison, computed by Django), `type` `burn|tax|saving` (never changes, D-047),
`target_minor` bigint > 0 (optional, saving only), timestamps. Unique `(user_id, name_key, type)`.

### `month_items` (the cards)
`id`, `user_id`, `month_id`, `item_id`, `importance` `want|must|emergency|gift` (default
`want`), `amount_minor` >= 0, `quantity` int >= 1, `unit_price_minor` (NULL = the +1 / +N
buttons are locked, D-065), `quantity_needs_review` boolean, `is_ignored` boolean, timestamps.
Unique `(month_id, item_id, importance)`. A "group" (same item, several importances) is computed,
not a table (D-075).

### `item_merge_dismissals`
`id`, `user_id`, `item_a_id`, `item_b_id`, `created_at`. Unique on the pair (D-053).

## Not computed into storage (by design)
Item groups, monthly hours, hourly rate, each month's result and the savings total are calculated.

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
Manual savings list (D-083, month question open), pending list (D-062/D-074), notifications
(D-072), goals and shared targets, sync/devices, plans and waitlist, consents, audit logs, data
export and account deletion flow, Community, debit/credit, multi-income pool rules.
