---
title: "Backend foundation and account tables"
author: "Claude"
date: "2026-11-14"
status: "done"
---

# Backend foundation and account tables

## TL;DR

The legacy backend (SQLite, SimpleJWT, `core_finance`) was removed and replaced by a fresh Django 5.2
project that verifies Supabase tokens and owns the PostgreSQL schema through migrations. The first
three tables (`profiles`, `username_reservations`, `user_settings`) are built, closed to Supabase's
public Data API, and covered by tests. No finance table and no API endpoint beyond `/api/health/`
and `/api/me/` exist yet.

## Steps

1. [x] Remove the legacy backend; start a fresh Django project (commit 1).
2. [x] Environment-driven settings, Supabase JWT verification (ES256/RS256, JWKS), API closed by default, tests (commit 2).
3. [x] Make test settings ignore a local `.env` (patch 0003).
4. [x] `apps/accounts`: three tables, constraints, database foreign keys, RLS lock-down, `for_user` ownership helper, 80 tests (patch 0004).
5. [x] Docker PostgreSQL 17 for the database tests (patch 0005).
6. [x] Agent manual, decision log, schema blueprint, Arabic guide (patch 0006); GitHub Actions workflow (patch 0007).
   The decision log later moved to `plans/decisions/` (patch 0010, D-098).
7. [ ] Verify the `qeeva-dev` JWT signing keys are asymmetric (Supabase dashboard, JWT Signing Keys).
8. [ ] Turn the Supabase Data API off for `qeeva-dev` (Django's own tables live in `public` without RLS).
9. [ ] Apply migrations to `qeeva-dev` (only after the user's explicit approval, D-084).

## Relevant files

- `Qeeva-Backend/core/`, `Qeeva-Backend/common/`, `Qeeva-Backend/apps/accounts/`
- `plans/decisions/decision-log.md`, `Qeeva-Backend/docs/database/schema-blueprint.md`
- `Qeeva-Backend/AGENTS.md`, `Qeeva-Backend/docker-compose.yml`, `.github/workflows/backend-ci.yml`

## Verification

- `cd Qeeva-Backend`, `docker compose up -d --wait`, set `QEEVA_TEST_DATABASE_URL` (see `README.md`), then `python -m pytest`.
- Result on the user's Windows machine (Python 3.14, PostgreSQL 17 in Docker): 145 passed (393 s; the slowness was `localhost`, found and fixed in patch 0011, D-102).
- `ruff check .`, `ruff format --check .`, `mypy .`, `python manage.py makemigrations --check --dry-run --settings=core.settings_test`.
- Not yet verified: a real Supabase token against `/api/me/`; the migrations on a real Supabase database.

## Decisions

D-001, D-020 to D-028, D-033, D-034, D-084, D-085, D-087, D-088, D-089, D-090, D-091. See `plans/decisions/decision-log.md`.
The older `20260522-excluded-months-map.md` backend plan asked for a source-of-truth decision: it is now
first-class tables (`months.totals_mode`, D-037/D-040), not a JSON backup envelope.
