# Qeeva Backend — agent operating manual

Read this file first, in every new session. It replaces the old file that described the
legacy backend (SimpleJWT, `apps/authentication`, `apps/core_finance`); that code was deleted
in commit 1 and survives only in Git history.

Last updated: 2026-11-14. If you change how the project works, update this file in the same commit.

## 1. What Qeeva is (and is not)

Qeeva is a **personal money log with analytics** for ordinary people. The user writes down what
they spent, the taxes they pay and what they want to save, month by month, and the app shows
what that means (free money, overspend, saving shortfall, hours of life per item).

* It is a **log** (D-032): it never invents a value or changes one by itself.
* It does **not** move money, take payments, or hold funds. Bank access is a far-future,
  read-only idea. Do not describe or build it as a banking or payments product.
* It still stores private personal data, so one user must never see another user's rows, and the
  numbers it shows must be right. That is why isolation and formula tests exist, not because
  money moves through the system.

## 2. The person you work with

* The user is a **frontend developer and the product owner (CEO)**. He is **not** a backend
  developer. You own backend engineering quality; he owns scope and product decisions.
* **Reply format, every time** (Master Context §2): (1) his message rewritten as natural English,
  (2) his English mistakes explained in Arabic, (3) the answer in **simple Arabic**: short
  sentences, few English words, concrete examples, comparisons from the frontend world.
* He answers by choosing an option, yes/no, or explaining the idea. He does not write much.
* **One focused question at a time**, with 2-4 options and your recommendation. Say why the
  answer matters. Challenge his assumptions with reasons (he asked for this). Do not ask
  questions you can resolve yourself.
* When he says "you know better, pick": decide, explain why, and list the decisions you made so
  he can review them. Never present your own choice as his approval of something larger.
* Never claim you read a file, ran a command, ran a test or pushed code unless you did.

## 3. Source of truth and precedence

1. `QEEVA_MASTER_CONTEXT_MD`, `ADDITIONAL_ENGINEERING_RULES`, `Collaborative_Discovery_Protocol`
   (the user's files; **not in Git**; ask him to upload them if a session does not have them).
2. `Foundation Build Plan.docx`, then `description` (in the claude.ai Project "Qeeva").
3. `docs/database/decision-log.md` (decisions with IDs) and `docs/database/schema-blueprint.md`.

On conflict, the higher item wins (D-001). The one deliberate override: **tests are required**
even though `description` says "without testing files".

Chat history is never the only record: write decisions to the decision log in the same commit.

## 4. Hard rules

* **Django owns the schema** (D-085). Tables, constraints, RLS and triggers all come from Django
  models and migrations (`RunSQL` for PostgreSQL-specific parts). No schema changes through the
  Supabase dashboard or CLI.
* **Implement only what the user approved**, exactly. If the work needs a significant design
  change, stop and explain first. Design discussion is not approval.
* **No API endpoints beyond `/api/health/` and `/api/me/`** until he explicitly changes scope
  (Master Context §6). Ask before adding any.
* **Supabase:** change nothing without his explicit final approval for that change (D-084), and
  only on `qeeva-dev` (id `yifxtufzjtokrjbfessq`, PostgreSQL 17, eu-central-1) first. Never touch
  `qeeva-prod` or any other project. Read-only inspection is fine.
* **Stay inside `Qeeva-Backend/`.** He allowed edits to any `.md` file in this folder. Anything
  outside needs his approval. Approved exception: `.github/workflows/backend-ci.yml` (D-088).
* **Money:** integer minor units (`bigint`), always 2 decimals, no currency in the database
  (D-033). Never floats. Never put authoritative formulas only in Angular.
* **Never** commit `.env` or secrets, never log tokens or financial records.
* Add a dependency only after checking maintenance, licence, security and need. Pin exact
  versions that are at least 14 days old.
* Report after each task in this shape (Engineering Rules §33): objective, files changed,
  database changes, decisions, tests written, tests executed (real results), manual QA,
  limitations, documentation updated, next step.

## 5. Stack and layout

Django 5.2 LTS, Django REST Framework, PostgreSQL 17 on Supabase, Supabase Auth (Django only
verifies tokens and never creates users). pytest, ruff, mypy strict. Exact pins are in
`requirements*.txt`.

```
core/            settings (all from environment), urls
common/          auth.py (Supabase JWT), ownership.py (for_user), db.py (lock_down_table), views
apps/accounts/   profiles, username_reservations, user_settings
apps/finance/    NOT BUILT YET (months, month_incomes, items, month_items, item_merge_dismissals)
conftest.py      test wiring (auth.users stand-in; skips DB tests without PostgreSQL)
docs/            decision log, schema blueprint, guide for the user (Arabic)
```

### Security model (decision D-087)

* The API is closed by default: `IsAuthenticated` + `SupabaseJWTAuthentication` (ES256/RS256 via
  the project's JWKS only; HS256 and `none` are rejected).
* Django connects with the table-owner role, so PostgreSQL RLS cannot protect one user from
  another. **Our code must.** Read user data only through `Model.objects.for_user(principal)`;
  pass the verified `SupabasePrincipal`, never an id from a URL or body.
* Every model in `apps/` declares `OWNER_FIELD` (a field name, or `None` for internal tables).
  A test fails when one forgets.
* Every table is closed to Supabase's public Data API with `common.db.lock_down_table` in its
  migration (RLS on, **no policies**, privileges of `anon`/`authenticated` revoked). A test fails
  when one forgets.
* Foreign keys whose delete rule matters when Supabase deletes a user live in raw SQL in the
  migration (Django 5.2 cannot express database-level `ON DELETE`); the FK fields use
  `db_constraint=False`.

## 6. Commands

Run all of these before every commit; all must pass.

```bash
docker compose up -d --wait        # PostgreSQL 17 on 127.0.0.1:5433 (data lives in memory)
export QEEVA_TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:5433/postgres   # real env, not .env
python -m pytest                   # without the variable, DB tests are SKIPPED (never "passed")
ruff check . && ruff format --check .
mypy .
python manage.py makemigrations --check --dry-run --settings=core.settings_test
```

`core/settings_test.py` assigns its values unconditionally so a developer's `.env` cannot change
test results. Run `pytest --reuse-db` to keep `test_postgres` for inspection in pgAdmin.

## 7. How work is delivered

The cloud sandbox cannot push to GitHub (the repository is not in the session's authorized
sources; do not work around the 403). Deliver numbered patches (`0001`..), each created with
`git format-patch`, verified with `git am` on a fresh clone that matches the user's state, then
tell him to run `git pull`, `git am <patch>`, `git push`. Commits use `noreply@anthropic.com`
and the attribution lines given by the session. Hooks that complain about unpushed commits
refer to this limitation; explain it, do not force a push.

## 8. Current state (2026-11-14)

Done and on GitHub (branch `build-django-as-what-db-schema-looks-like-cloude`):
commits 1-2 foundation, 0003 test-settings fix, 0004 accounts app, 0005 Docker test database.
Windows run: 145 tests passed against PostgreSQL 17 (took 393 s; see open items).

Next candidates, in this order, each needing his go-ahead:
1. Account services: create profile on first login, change username (14-day wait, old name held
   30 days). Needs endpoints, so **scope approval first** (§4).
2. Finance tables (see `docs/database/schema-blueprint.md`), then the calculation layer with
   formula tests.
3. Manual savings list (D-083): unanswered question: does a hand-added saving go to the time it
   was added automatically (A) or to a month the user picks (B)?

## 9. Open items and known gaps

* **Slow tests on Windows** (393 s vs ~1 s on Linux). Cause not yet found. Diagnose with
  `--durations` and a query-latency check before guessing.
* **Django's own tables** (`auth_user`, `django_session`, `django_migrations`, ...) live in
  `public` without RLS. Recommend the user turns **Data API off** in the Supabase dashboard
  (we never use it). Unverified for the project's current setting.
* **`qeeva-dev` JWT signing keys** must be asymmetric or JWKS verification returns nothing. Not
  yet checked.
* With the pinned django-stubs, `Model.objects` is typed `Any` (also for Django's own `User`), so
  mypy is weaker on ORM calls. Re-check after upgrading the stubs.
* Not yet decided: hosting, Django admin (deferred, D-080), per-request RLS (option B in D-087,
  can be added later through a migration), multi-income pool rules, sync, devices, notifications,
  plans/waitlist, consents, audit logs, export/delete flows, Community, Arabic UI.
* Planned, not now: Telegram voice bot, bank import (pending list, D-062/D-074), Advanced-mode
  features, `POST /api/sync/batch` (client contract in `Qeeva-Frontend/AGENT_ONBOARDING.md`).
