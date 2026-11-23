---
title: "Pre-build table review: every table and column with its purpose"
author: "Claude"
date: "2026-11-23"
status: "approved"
---

# Pre-build table review

## TL;DR
The owner asked (2026-11-23 22:34) to see every table we decided, and the changes to the tables that are already built,
with each column and what it is for, so he can change things before building. This is that review (D-193). Each table
has a **MVP** mark (D-200: what the first launch needs; the AI's proposal) and each column a short "what it is for".
Common columns are explained once at the top. After his review, the MVP tables are built in Django first, the same way
as the built tables (models, migrations, tests), and nothing goes to Supabase without his approval (D-084).

## Steps
1. [x] The owner reads this file and marks what to change (approved 2026-11-23 22:58, no change, D-205).
2. [x] The AI updates the designs (`schema-blueprint.md`, `final-table-list.md`, the decision log) in one patch (0057).
3. [ ] The AI builds the MVP tables in Django with tests, by `20261123-mvp-tables-build.md`, then the rest later.

## Columns every table has (explained once)
| Column | What it is for |
|---|---|
| `id` | The row's own unique code (a uuid). |
| `user_id` | Whose row it is. The server only lets the owner read or change it. |
| `created_at`, `updated_at` | When the row was made and last changed. |
| `deleted_at` | (synced tables) The row was deleted: hidden at once, erased for good after 45 days, so other devices learn about it (D-176). |
| `deleted_by_device_id` | (synced tables) Which device deleted it, shown in Settings when the owner turns it on (D-176). |
| `version` | (synced tables) A counter the server raises on every change, to spot two devices changing the same row (D-180). |
| `updated_by_device_id` | (synced tables) Which device made the last change (D-180). |

Money columns end in `_minor`: whole numbers of thousandths (3 decimals) for every user; the setting only changes how
many decimals are shown (D-149). Example: 12.345 is stored as 12345.

## 1. Account tables

### `profiles` (built) · MVP: yes · one row per person who signed up
| Column | What it is for |
|---|---|
| `id` | The same code as his Supabase sign-in account. |
| `username` | His public name, unique, 3 to 20 letters, digits or `_`. |
| `display_name` | An optional friendly name, up to 30 characters. |
| `role` | `user` or `admin`; only an admin can change `app_config`. |
| `status` | `active`, `suspended`, or `pending_deletion` (he asked to delete his account). |
| `username_changed_at` | When he last changed his username; a new change waits 14 days. |
| `deleted_at` | When he asked to delete his account; everything is erased after the grace period (30 days, D-195). |

### `username_reservations` (built) · MVP: yes
| Column | What it is for |
|---|---|
| `username` | An old username that nobody else may take for a while. |
| `previous_owner_id` | Who had it. |
| `reserved_until` | When it becomes free again. |

### `user_settings` (built + new columns) · MVP: the built part; new columns later unless marked
| Column | What it is for |
|---|---|
| `experience_mode` | `regular` or `advanced`. |
| `timezone` | His time zone; decides when a month or a day starts for him. |
| `language` | `en` now; `ar` later. |
| `skip_merge_confirm` | Advanced: skip the "merge these items?" question. |
| *(new)* `hourly_rate_mode` | Advanced: one combined hourly rate, or one per income (D-128). |
| *(new)* `skip_item_delete_confirm` | Advanced: skip the "delete this item?" question (D-123). |
| *(new)* `decimal_places` | 2 or 3 decimals shown; Regular always 3 (D-149). |
| *(new)* `default_weight_unit` | `kg` or `g` for new weight items (D-140). |
| *(new)* `reconcile_every_months` | How often the "count your money" reminder comes: 6 or 12 (D-158). |
| *(new)* `last_reconciled_on` | When he last counted his money (D-158). |
| *(new)* `zakat_helper_enabled` | The Zakat switch; NOT a religion field (D-136). |
| *(new)* `zakat_rate_basis_points` | The Zakat rate; 250 = 2.5% (D-137). |
| *(new)* `zakat_currency_code` | The currency used to price silver for Zakat (D-144). |
| *(new)* `zakat_clear_count` | How many times "delete old Zakat" was used (once allowed, D-169). |
| *(new)* `show_deleted_info` | Show who deleted a row and when (hidden by default, D-181). |
| *(new)* `show_deleted_countdown` | Show the days left before erase; empty = follow the switch above (D-181). |
| *(new)* `show_viewer_last_visit` | Advanced: show when each viewer last opened his data (D-190). |

### `user_consents` (designed) · MVP: yes (terms at sign-up)
| Column | What it is for |
|---|---|
| `kind` | `terms`, `privacy` or `marketing`. |
| `document_version` | Which version of the document he accepted, for example `2026-11`. |
| `action` | `accepted` or `withdrawn`; the newest row is the current answer (D-202). |

### `devices` (designed) · MVP: yes (one device, server save)
| Column | What it is for |
|---|---|
| `name` | A name he sees, for example "Elias's phone". |
| `platform` | `web`, `android` or `ios`. |
| `last_seen_at` | When this device last talked to the server. |
| `last_synced_at` | The last sync date shown in Settings next to "sync now" (D-182). |
| `is_primary` | His main device, which keeps working when a paid plan ends (D-187). |
| `access_mode` | `full`, or `read_only` for viewing his own data from another device (D-191). |

### `app_config` (designed, system, no owner) · MVP: yes
| Column | What it is for |
|---|---|
| `key` | The name of a value, for example `signup_open`. |
| `value` | The value (a number, text, or yes/no). |
| `updated_by` | Which admin changed it. |
Keys decided so far: `guest_signin_prompt_cards` (5), `guest_signin_prompt_message`, `device_limit_free` (1),
`device_limit_paid`, `free_data_viewers` (1), `max_data_viewers` (about 30), `invite_code_days` (7),
`account_deletion_grace_days` (30), `audit_log_days` (365), `feature_export_enabled` (false), `signup_open`,
`pending_seen_days` (90), `bank_sync_overlap_days` (7, D-204).

### `waitlist_entries` (designed, first draft) · MVP: redesigned in the n8n talk first (D-205)
| Column | What it is for |
|---|---|
| `email` | The person's email, once only. |
| `source` | Where he came from (the site, a post). |
| `marketing_consent` | He agreed to receive news. |
| `invited_at` | When we invited him; while sign-up is closed only invited emails can join (D-199). |
| `converted_profile_id` | His account, once he signs up. |
| `note` | A free note for the owner. |

### `plan_events` (designed) · MVP: later (no paid plan in the MVP)
| Column | What it is for |
|---|---|
| `kind` | What happened: subscribed, renewed, ended, a device or a viewer paused or back (D-192). |
| `occurred_at` | When. |
| `payload` | Small display data, for example the device name. |

### `audit_logs` (designed) · MVP: later (optional)
| Column | What it is for |
|---|---|
| `action` | A sensitive action: new device sign-in, share made or removed, deletion asked, export, plan change (D-196). |
| `device_id` | From which device. |
| `details` | Small display data; never money, passwords or codes. |

### `data_shares` (designed) · MVP: later
| Column | What it is for |
|---|---|
| `viewer_user_id` | The account of the person who may read his data. |
| `invited_email` | The email invited, when the invite goes by email. |
| `invite_code_hash` | A scrambled copy of the invite code (the real code is never stored). |
| `invite_expires_at` | When the code stops working (7 days). |
| `allowed_areas` | Which areas the viewer sees: income, expenses, taxes, savings and funds, debts, Zakat (D-189). |
| `last_viewed_at` | The viewer's last visit (D-190). |
| `status` | `pending`, `accepted` or `revoked`. |
| `accepted_at`, `revoked_at` | When. |

### `sync_conflicts` (designed) · MVP: later (one device has no conflicts)
| Column | What it is for |
|---|---|
| `table_name`, `row_id` | Which row was changed on two devices. |
| `losing_data` | The version that lost, kept so he can see or restore it (D-180). |
| `losing_device_id`, `kept_device_id` | Which devices. |
| `detected_at`, `resolved_at` | When it happened and when he answered the notice. |
| `resolution` | `kept` or `restored`. |

## 2. Money tables

### `months` (built) · MVP: yes · one row per calendar month he has
| Column | What it is for |
|---|---|
| `month_start` | The first day of the month. |
| `totals_mode` | `auto`, `included` or `excluded`: whether the month counts in totals and charts. |
Rules without columns: missing months are made automatically with copies; the next month by hand, one ahead at most (D-150).

### `month_incomes` (built + changes) · MVP: yes
| Column | What it is for |
|---|---|
| `name` | Optional name of the income, for example "Salary". |
| `amount_minor` | The amount. |
| `hours_per_day`, `days_per_week` | His working time, for the hourly rate. *(changes)* may be empty: a bonus has no working time (D-126). |
| `work_hours_override` | Monthly hours typed by hand. *(changes)* allows parts of an hour (D-129). |
| `hourly_rate_manual_minor` | An hourly rate typed by hand. |
| *(new)* `frequency` | `monthly` or `yearly` (later; D-125). |
| *(new)* `due_month` | For a yearly income, the month it arrives (later). |

### `items` (built + one new column) · MVP: yes
| Column | What it is for |
|---|---|
| `name` | The item's name, up to 40 characters. |
| `name_key` | The name made comparable (case, Arabic spellings), so "Bread" and "bread" are one item. |
| `type` | `burn` (spending), `tax` or `saving`; never changes. |
| `target_minor` | Saving items only: the long-term goal amount. |
| *(new)* `unit` | `piece`, `g` or `kg` (later; D-140). |

### `month_items` (built + changes), the cards · MVP: yes
| Column | What it is for |
|---|---|
| `month_id`, `item_id` | Which month and which item. |
| `importance` | `want`, `must`, `emergency` or `gift`, for sorting. |
| `amount_minor` | The amount. *(changes)* empty on a percentage tax card (later; D-130). |
| `quantity` | How many. *(changes)* allows weights like 2.500 kg (later; D-140). |
| `unit_price_minor` | Price of one unit; empty = the +1 / +N buttons are locked. |
| `quantity_needs_review` | A flag to check the quantity. |
| `is_ignored` | Ignored cards stay visible but count nowhere. |
| *(new)* `reduction_minor` | When income is short, how much this saving card gives up; empty = shared fairly (MVP: yes; D-117). |
| *(new)* `rate_basis_points`, `rate_base`, `threshold_minor` | A tax as a percentage of income or funds, with a minimum (later; D-130, D-134). |
| *(new)* `frequency`, `due_month` | A yearly tax that counts only in its month (later; D-135). |

### `item_merge_dismissals` (built) · MVP: yes
| Column | What it is for |
|---|---|
| `item_a_id`, `item_b_id` | Two items he said are NOT the same, so the app stops asking to merge them. |

### `fund_entries` (designed) · MVP: yes (the "Total Savings" add box exists in the app today)
| Column | What it is for |
|---|---|
| `month_id` | The month the money move belongs to. |
| `kind` | What moved: `opening` (first count), `add`, `withdraw`, `to_item` / `from_item` (into or out of a saving item); later `gift`, `lend`, `borrow`, `repay_in`, `repay_out`. |
| `amount_minor` | How much. |
| `item_id` | The saving item, for `to_item` / `from_item`. |
| `debt_id` | The debt, for loans and repayments (later). |
| `title` | Who gave a gift (later; D-155). |
| `counted_minor` | The amount he counted, on a "count your money" row (later; D-158). |
| `note` | A short note. |

### `notifications` (designed) · MVP: yes (saving-goal alerts exist today)
| Column | What it is for |
|---|---|
| `kind` | What the alert is about (goal progress, Zakat, prices, reminders...). |
| `dedupe_key` | Makes sure the same alert is never sent twice. |
| `payload` | Small display data. |
| `seen_at` | When he saw it; empty = new. |

### `debts` (designed) · MVP: later
| Column | What it is for |
|---|---|
| `direction` | `lent` (someone owes him) or `borrowed` (he owes someone). |
| `person_name` | Who. |
| `month_id`, `started_on` | The month in the log, and the exact day for display (D-159). |
| `due_on` | Optional due date, with three reminders (D-159). |
| `note` | A short note. |

### `pending_entries` (designed) · MVP: later · only entries still waiting
| Column | What it is for |
|---|---|
| `source` | `bank`, `voice`, `camera` or `card`. |
| `external_id` | The bank's or card's own id, so the same transaction never comes twice. |
| `occurred_on` | The day the money moved; decides the month (D-175). |
| `direction` | `out` or `in`. |
| `amount_minor` | The amount (may be empty from voice). |
| `suggested_name`, `suggested_type` | What the app suggests (empty name for bank entries). |
| `raw_text` | The voice text or receipt text, shown while it waits. |

### `pending_seen_ids` (designed) · MVP: later
| Column | What it is for |
|---|---|
| `source`, `external_id` | A bank or card id he already decided. |
| `outcome` | `confirmed` or `dismissed`. |
| `month_item_id` | The card it became, so the card can say "from bank". |
| `decided_at` | When; erased after 90 days (D-203). |

## 3. Zakat tables (kept separate) · MVP: later
### `metal_prices`
| Column | What it is for |
|---|---|
| `metal` | `silver` (gold in version 2). |
| `price_per_gram_minor` | Price of one gram in US dollars. |
| `fetched_at`, `source` | When, and whether from the free API or typed by him. |

### `exchange_rates`
| Column | What it is for |
|---|---|
| `currency_code` | His currency, for example `LYD`. |
| `units_per_usd` | The black-market rate, for example 10.65 (D-163). |
| `observed_at`, `source` | When, and typed or from an API. |

### `zakat_cycles`
| Column | What it is for |
|---|---|
| `started_on`, `ends_on` | The start of a Zakat year and its end one Hijri year later. |
| `stopped_on` | The day his wealth fell below the threshold, which breaks the year (D-147). |
| `status` | `running`, `stopped` or `completed`. |
| `wealth_at_end_minor`, `threshold_at_end_minor`, `zakat_minor` | The numbers of the end day, kept so history never changes. |

### `zakat_payments`
| Column | What it is for |
|---|---|
| `zakat_cycle_id` | Which Zakat year this payment is for (one payment per year). |
| `month_id` | The month he pressed "spent"; it counts in that month's taxes (D-145). |
| `amount_minor`, `paid_at` | How much and when. |

## 4. Values moved to `app_config` (D-193; all moved, D-206)
These were fixed numbers in the designs; on 2026-11-23 (22:58) he moved all of them to `app_config` keys he can change without a new version:
| Value (the default) | Where | Key |
|---|---|---|
| Deleted rows erased after 45 days; resolved conflicts too | D-176, D-180 | `deleted_rows_days` |
| Silver prices "old" after 30 days | D-142 | `prices_stale_days` |
| Automatic price update at most once a day | D-142 | `price_update_hours` |
| Debt reminder 7 days before | D-159 | `debt_reminder_days_before` |
| Next month allowed one month ahead | D-150 | `months_ahead_limit` |
| Username change waits 14 days | built | `username_change_days` |
| Zakat silver weight 595 g (a code constant by his choice) | D-162 | `zakat_silver_grams` |
| Zakat default rate 2.5% | D-137 | `zakat_default_rate_bp` |
| "Delete old Zakat" allowed once | D-169 | `zakat_clear_limit` |

## Relevant files
- `Qeeva-Backend/docs/database/final-table-list.md`, `Qeeva-Backend/docs/database/schema-blueprint.md`
- `plans/decisions/decision-log.md`

## Verification
- Every table and column of `final-table-list.md` appears here (checked by the AI when this file was written).
- After his review: the designs are updated in one patch, then the MVP tables are built with tests.

## Decisions
D-193, D-200, D-149, D-172, D-179, D-204, D-205, D-206.
