# Final table list

The target database, as decided so far: every table and every column in its FINAL form, nothing else. No history, no
replaced designs (those live in `plans/decisions/decision-log.md`). Rules and examples live in `schema-blueprint.md`.
This file is updated in the same commit as every decision that adds, changes or removes a table or a column (D-172).

Legend: **[built]** exists in Django today; **[designed]** approved, not built yet; *(new)* or *(changes)* = a column
that a design adds to, or changes in, a built table. Every table: `uuid` ids, `timestamptz` timestamps, RLS on with no
policies (D-087), CHECK for every fixed list. Money: `bigint`, 3 decimals stored for every user (D-149; the built tables too, since migration
`finance 0004`).

## Accounts
| Table | Status | Columns |
|---|---|---|
| `profiles` | [built] | `id` (= auth user id), `username`, `display_name`, `role` (user/admin), `status` (active/suspended/pending_deletion), `username_changed_at`, `created_at`, `updated_at`, `deleted_at` |
| `username_reservations` | [built] | `id`, `username`, `previous_owner_id`, `reserved_until` |
| `user_settings` | [built] + [designed] | `user_id`, `experience_mode` (regular/advanced), `timezone`, `language`, `skip_merge_confirm`, `created_at`, `updated_at`, `version`, `updated_by_device_id` (built, D-213); *(new)* `hourly_rate_mode` (combined/per_income), `skip_item_delete_confirm`, `decimal_places` (2/3, default 3), `default_weight_unit` (kg/g), `reconcile_every_months` (6/12), `last_reconciled_on`, `zakat_helper_enabled`, `zakat_rate_basis_points` (default 250), `zakat_currency_code`, `zakat_clear_count`, `show_deleted_info`, `show_deleted_countdown`, `show_viewer_last_visit` |

## Finance
| Table | Status | Columns |
|---|---|---|
| `months` | [built] | `id`, `user_id`, `month_start`, `totals_mode` (auto/included/excluded), `created_at`, `updated_at` |
| `month_incomes` | [built] + [designed] | `id`, `user_id`, `month_id`, `name`, `amount_minor`, `hourly_rate_manual_minor`, `created_at`, `updated_at`; *(changes)* `hours_per_day` and `days_per_week` nullable, `work_hours_override` numeric(5,2); *(new)* `frequency` (monthly/yearly), `due_month` |
| `items` | [built] + [designed] | `id`, `user_id`, `name`, `name_key`, `type` (burn/tax/saving), `target_minor`, `created_at`, `updated_at`; *(new)* `unit` (piece/g/kg) |
| `month_items` | [built] + [designed] | `id`, `user_id`, `month_id`, `item_id`, `importance` (want/must/emergency/gift), `unit_price_minor`, `quantity_needs_review`, `is_ignored`, `created_at`, `updated_at`; *(changes)* `amount_minor` nullable, `quantity` numeric(14,3); *(new)* `rate_basis_points`, `rate_base` (income/funds), `threshold_minor`, `frequency` (monthly/yearly), `due_month`; built since 0061: `reduction_minor` |
| `item_merge_dismissals` | [built] | `id`, `user_id`, `item_a_id`, `item_b_id`, `created_at` |
| `fund_entries` | [built] (MVP kinds) + [designed] (later kinds, `debt_id`, `title`, `counted_minor`) | `id`, `user_id`, `month_id`, `kind` (opening/add/withdraw/to_item/from_item/gift/lend/borrow/repay_in/repay_out), `amount_minor`, `item_id`, `debt_id`, `title`, `counted_minor`, `note`, `created_at`, `updated_at` |
| `debts` | [designed] | `id`, `user_id`, `direction` (lent/borrowed), `person_name`, `month_id`, `started_on`, `due_on`, `note`, `created_at`, `updated_at` |
| `notifications` | [built] | `id`, `user_id`, `kind`, `dedupe_key`, `payload`, `created_at`, `seen_at` |
| `pending_entries` | [designed] | `id`, `user_id`, `source` (bank/voice/camera/card), `external_id`, `occurred_on`, `direction` (out/in), `amount_minor`, `suggested_name`, `suggested_type`, `raw_text`, `created_at`, `updated_at` (only waiting entries, D-201) |
| `pending_seen_ids` | [designed] | `id`, `user_id`, `source` (bank/card), `external_id`, `outcome` (confirmed/dismissed), `month_item_id`, `decided_at` |

## Sync
The synced tables also get `deleted_at`, `deleted_by_device_id`, `version` and `updated_by_device_id` (D-176, D-180, D-213):
BUILT on `months`, `month_incomes`, `items`, `month_items`, `item_merge_dismissals`, `fund_entries`, `notifications`; `user_settings` gets only `version` and `updated_by_device_id`. Seen notifications are
erased after `app_config.notifications_keep_days` (7, D-212).
| Table | Status | Columns |
|---|---|---|
| `devices` | [built] | `id`, `user_id`, `name`, `platform` (web/android/ios), `last_seen_at`, `last_synced_at`, `is_primary`, `access_mode` (full/read_only), `created_at`, `updated_at` |
| `data_shares` | [designed] | `id`, `user_id`, `viewer_user_id`, `invited_email`, `invite_code_hash`, `invite_expires_at`, `allowed_areas`, `last_viewed_at`, `status` (pending/accepted/revoked), `created_at`, `accepted_at`, `revoked_at` |
| `sync_conflicts` | [designed] | `id`, `user_id`, `table_name`, `row_id`, `losing_data`, `losing_device_id`, `kept_device_id`, `detected_at`, `resolved_at`, `resolution` (kept/restored) |

## System (no owner, the same for everyone)
| Table | Status | Columns |
|---|---|---|
| `app_config` | [built] | `key`, `value`, `updated_at`, `updated_by` (the Django admin account, D-209); 25 keys, listed in `schema-blueprint.md` (D-179, D-206, D-208, D-212) |

## Account
| Table | Status | Columns |
|---|---|---|
| `plan_events` | [designed] | `id`, `user_id`, `kind`, `occurred_at`, `payload`, `created_at` |
| `audit_logs` | [designed] | `id`, `user_id`, `action`, `device_id`, `details`, `created_at` |
| `user_consents` | [built] | `id`, `user_id`, `kind` (terms/privacy/marketing), `document_version`, `action` (accepted/withdrawn), `created_at` |
| `waitlist_entries` | [first draft; redesigned in the n8n talk, not built with the MVP, D-205] | `id`, `email`, `source`, `marketing_consent`, `invited_at`, `converted_profile_id`, `note`, `created_at` |

## Zakat (kept separate; may be opened again)
| Table | Status | Columns |
|---|---|---|
| `metal_prices` | [designed] | `id`, `user_id`, `metal` (silver), `price_per_gram_minor` (USD), `fetched_at`, `source` (api/typed), `created_at`, `updated_at` |
| `exchange_rates` | [designed] | `id`, `user_id`, `currency_code`, `units_per_usd`, `observed_at`, `source` (typed/api), `created_at`, `updated_at` |
| `zakat_cycles` | [designed] | `id`, `user_id`, `started_on`, `ends_on`, `stopped_on`, `status` (running/stopped/completed), `wealth_at_end_minor`, `threshold_at_end_minor`, `zakat_minor`, `created_at`, `updated_at` |
| `zakat_payments` | [designed] | `id`, `user_id`, `zakat_cycle_id`, `month_id`, `amount_minor`, `paid_at`, `created_at`, `updated_at` |

## Not tables (calculated, never stored)
Month results and every dashboard formula, hourly rates, percentage tax amounts, the funds pool and its free part,
goal progress, debt open amounts, the daily Zakat threshold and wealth, the Zakat group total, Hijri dates.

## Version 2, maybe (not in the list above)
`holdings`, `item_classes`, `item_class_aliases`, `items.item_class_id`, gold prices, animals (D-168); item groups
under one title (D-092); Community (D-026).

## Still open
The number of plans (not decided by the user), the Telegram bot (when he asks), Arabic texts (later), bank linking with
its provider, and the redesign of `waitlist_entries` in the n8n talk. The design is otherwise complete (D-205): the MVP
tables are built in stages by `plans/plans-Backend/20261123-mvp-tables-build.md`.
