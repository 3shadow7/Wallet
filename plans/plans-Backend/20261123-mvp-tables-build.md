---
title: "Build the MVP tables in Django, in stages"
author: "Claude"
date: "2026-11-23"
status: "approved"
---

# Build the MVP tables in Django

## TL;DR
The owner approved the pre-build review on 2026-11-23 (22:58) and said the design is done (D-205). The tables the MVP
needs (D-200) are now built in Django in small stages, the same way as the built tables: models, migrations, tests,
ruff and mypy clean. Each stage is one patch. Nothing is applied to Supabase without his explicit approval (D-084).
`waitlist_entries` is not built here: it is redesigned in the n8n talk (D-205). After each stage, the table moves from
[designed] to [built] in `schema-blueprint.md` and `final-table-list.md` in the same commit (D-172).

## Steps
1. [x] **Stage 1: money in thousandths (D-149).** Migration `finance 0004` multiplies the built money columns by 10
   (`month_incomes.amount_minor`, `month_incomes.hourly_rate_manual_minor`, `items.target_minor`,
   `month_items.amount_minor`, `month_items.unit_price_minor`). No real data exists anywhere, so in practice it
   converts nothing; it is written correctly anyway. Going back refuses when an amount uses the third decimal, so no
   thousandth is ever lost. The calculation layer and the shared vectors say thousandths. Patch 0058.
2. [x] **Stage 2: `app_config` and `user_consents`.** `app_config` lives in a new app `apps/system` (no owner, the same
   for everyone; D-179), filled with its 24 keys by a migration (D-206 to D-208) and edited in the Django admin page,
   the only table that page shows (D-209); `user_consents` joins `apps/accounts` (D-202), with the check against the
   current terms and privacy versions. Patch 0059.
3. [ ] **Stage 3: `devices` and the sync columns.** `devices` (D-176, D-185, D-187, D-191) and `deleted_at`,
   `deleted_by_device_id`, `version`, `updated_by_device_id` on every synced table (D-176, D-180).
4. [ ] **Stage 4: the funds and the alerts.** `fund_entries` (the MVP kinds), `notifications` (D-121) and
   `month_items.reduction_minor` (D-117).
5. Not in this plan: `waitlist_entries` (the n8n talk, D-205) and every table marked "later" in the pre-build review.

A note for the frontend plan (outside `Qeeva-Backend`): the Angular app keeps cents in its local storage; when it starts
saving to the server it must send thousandths (cents x 10). That change belongs to the frontend alignment plan.

## Relevant files
- `plans/plans-Backend/20261123-pre-build-table-review.md` (what each table and column is for, the MVP mark)
- `Qeeva-Backend/docs/database/schema-blueprint.md`, `Qeeva-Backend/docs/database/final-table-list.md`
- `Qeeva-Backend/apps/finance/migrations/`, `Qeeva-Backend/apps/finance/calculations.py`

## Verification
- Each stage: `python -m pytest` with PostgreSQL, `ruff check .`, `ruff format --check .`, `mypy .` all clean, and the
  patch chain applied with `git am` on a clean copy before delivery.
- Stage 1: a test runs the real migration forward and back on a test database.

## Decisions
D-080, D-084, D-117, D-121, D-149, D-172, D-176, D-179, D-180, D-200, D-202, D-205 to D-209.
