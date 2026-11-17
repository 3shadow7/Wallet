# Qeeva Backend — agent operating manual

Read this file first, in every new session. It replaces the old file that described the
legacy backend (SimpleJWT, `apps/authentication`, `apps/core_finance`); that code was deleted
in commit 1 and survives only in Git history.

Last updated: 2026-11-15 (see section 10 for where the work stopped). If you change how the project works, update this file in the same commit.

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
* **"Read all the `.md` files" means every one** (D-100): every `.md` and `.mdc` in the
  repository, including `.cursor/` (Cursor rules and skills) and `.github/` (legacy Copilot
  agents), plus the frontend docs. List them with `find`/`Glob`, read each, and say plainly which
  ones you had not read before. Never answer that you did not read them; if you did not, read
  them now. Some of those files are outdated (see section 9): read them anyway, and report what
  is stale instead of trusting it.

## 3. Source of truth and precedence

Highest precedence first:

1. `QEEVA_MASTER_CONTEXT_MD`, `ADDITIONAL_ENGINEERING_RULES`, `Collaborative_Discovery_Protocol`
   (the user's files; **not in Git**; ask him to upload them if a session does not have them).
   He gave them in chat **after** the `plans/` folder, so they win over it.
2. `plans/decisions/` (the decision log, D-098) and `docs/database/schema-blueprint.md` (what he
   approved later in chat). The decisions folder is inside `plans/` but ranks above the rest of
   `plans/`.
3. Older material, written for the earlier frontend-first project: `Foundation Build Plan.docx`,
   `description` (both in the claude.ai Project "Qeeva") and the rest of the **`plans/` folder at
   the repository root** (see section 3b).

On conflict, the higher item wins (D-001). The one deliberate override: **tests are required**
even though `description` and the root `AGENTS.md` say "no test files". When an older document
and a later decision disagree and the user may not know it, **ask him**; do not decide silently.

Chat history is never the only record: write decisions to `plans/decisions/decision-log.md` in
the same commit (how: `plans/decisions/README.md`). A guard test fails on a duplicated or lost
number. The old path `docs/database/decision-log.md` is only a pointer; never add rows there.

### 3b. The `plans/` folder (repo root)

`plans/README.md` is the map of the folder (its anatomy). Read the relevant plans at the start of
a session (they are short). Rules from `plans/rules/` that apply to the backend:

* Backend plans go in `plans/plans-Backend/`, named `YYYYMMDD-short-title.md`, with frontmatter
  (`title`, `author`, `date`, `status: draft|proposed|approved|done`) and the sections TL;DR,
  Steps, Relevant files, Verification, Decisions (`plans/rules/Template-of-plans.md`). The
  Decisions section lists D-numbers; it never copies their text.
* The user allowed the AI to add and update `.md` files there (2026-11-14). Prefer adding a new
  dated plan over rewriting an existing one that another tool wrote. Two older plans sit directly
  under `plans/`; new plans never go there.
* Frontend plans belong to `plans/plans-Frontend/`. Do not change frontend decisions without asking.
* Code rule from `plans/rules/general-rules.md`: **comments that explain every step** (he is
  learning the backend), and after code always say what it does, how it fits and how to test it.
* The `plans/` folder says "no test files", "SimpleJWT" and "build endpoints for everything in
  localStorage". Those are older than Master Context §6 (no API endpoints until he changes the
  scope) and D-001, so the Master Context wins. The frontend has a **guest mode** (local only,
  never calls the backend); our token check rejects Supabase anonymous users, which fits.

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
apps/finance/    months, month_incomes, items, month_items, item_merge_dismissals (+ naming.py)
conftest.py      test wiring (auth.users stand-in; skips DB tests without PostgreSQL)
docs/            schema blueprint, guide for the user (Arabic); decision-log.md is only a pointer
```

The decision log is **not** here: it is `../plans/decisions/decision-log.md` (D-098).

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

Run all of these before every commit, **from inside `Qeeva-Backend/`** (from the repository
root pytest finds no `pyproject.toml` and fails with "settings are not configured"); all must pass.

```bash
docker compose up -d --wait        # PostgreSQL 17 on 127.0.0.1:5433 (data lives in memory)
export QEEVA_TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:5433/postgres   # real env, not .env
python -m pytest                   # without the variable, DB tests are SKIPPED (never "passed")
ruff check . && ruff format --check .
mypy .
python manage.py makemigrations --check --dry-run --settings=core.settings_test
```

Always write the database host as `127.0.0.1`, never `localhost` (D-102): on Windows the name cost
about 15 s per connection. `parse_database_url` now reads `localhost` as `127.0.0.1` anyway.

`core/settings_test.py` assigns its values unconditionally so a developer's `.env` cannot change
test results. Run `pytest --reuse-db` to keep `test_postgres` for inspection in pgAdmin.

## 7. How work is delivered

The cloud sandbox cannot push to GitHub (the repository is not in the session's authorized
sources; do not work around the 403). Deliver numbered patches (`0001`..), each created with
`git format-patch`, verified with `git am` on a fresh clone that matches the user's state, then
tell him to run `git pull`, `git am <patch>`, `git push`. Commits use `noreply@anthropic.com`
and the attribution lines given by the session. Hooks that complain about unpushed commits
refer to this limitation; explain it, do not force a push.

## 8. Current state (2026-11-17)

Done and on GitHub (branch `build-django-as-what-db-schema-looks-like-cloude`):
commits 1-2 foundation, 0003 test-settings fix, 0004 accounts app, 0005 Docker test database,
0006 agent manual + decision log + schema blueprint + Arabic guide, 0007 GitHub Actions workflow,
0008-0009 plans alignment and decisions D-092..D-097.
Windows run before 0011: 145 passed in 393 s; after 0011: 164 passed in 2.53 s.
Patch 0010 moves the decision log to `plans/decisions/` and recovers D-018 and D-030; patch 0011
makes `localhost` in a database URL mean `127.0.0.1` (D-102); patch 0012 fixes the stale agent and
doc files (D-101); patch 0013 builds the five finance tables (models, migrations, 150 tests; D-103 to
D-107); patch 0014 adds the calculation layer (`apps/finance/calculations.py`, `summary.py`, shared
test vectors; D-108, D-109). No finance endpoint exists. Tests: 360 with PostgreSQL.
Patches 0015-0018 (docs only) hold decisions D-103 to D-120 and the feature-data map; patches 0019-0021 (docs only, delivered
2026-11-17) hold D-121 to D-123, the "Designed, not built" tables in the schema blueprint and the ideas list.
A one-page snapshot of everything done so far is `plans/plans-Backend/20261117-progress-summary.md`.

Next candidates (the user's current path is **Path A**, section 10; B and C wait). Each needs his go-ahead:
1. Finish the data design (Path A): Area 3 continues, then Areas 4-9 of the feature map.
2. After Path A, build what was designed, one area at a time with tests: `fund_entries`, `notifications`,
   `month_items.reduction_minor`, `user_settings.skip_item_delete_confirm`; then extend the calculation layer
   (deficit and old-month gap rules D-111 and D-119, goals) and run the same vectors in the Angular calculator
   (alignment plan, step 1; the frontend is outside `Qeeva-Backend`, so it needs the user's approval).
3. Account services: create profile on first login, change username (14-day wait, old name held
   30 days). Needs endpoints, so **scope approval first** (§4).
4. Paths B and C: check Supabase `qeeva-dev` (JWT keys, Data API off, apply migrations with approval) and the
   frontend/backend alignment.

## 9. Open items and known gaps

* **Path A is a design conversation first (D-116).** `plans/plans-Backend/20261115-feature-data-map.md`
  lists every feature, including waiting-list ones, and what data it needs. Discuss one area at a time,
  one to three questions per message (he asked on 2026-11-17 for two or more, to go faster), only about what the database must store. Decisions D-111 to D-123 hold the
  user's ideas and approvals of 2026-11-15 to 2026-11-17 (deficit rule, funds pool, notifications, month-delete popup,
  percentage tax, Zakat helper, tax goals, time input).

* **Item links (Item Explorer plan):** postponed, D-092 (D-060 stands). Do not build a link table.
* **Approved by the user on 2026-11-15 (D-093, D-097):** manual savings (D-083) were designed
  later together with debit/credit (update: D-118 puts hand-added savings in the funds ledger `fund_entries`; debit/credit stays Area 6); the per-card `is_reducible` flag is not added to
  `month_items` (the frontend only carries it, no logic uses it). The finance tables are built
  without them.
* **Stale agent and doc files outside `Qeeva-Backend/`: fixed in patch 0012 (D-101).** The
  backend agent files, the root `README.md`/`AGENTS.md` and the frontend path mentions now match
  reality. `.github/agents/frontend-senior.agent.md` still contains an aspirational `core/` folder
  tree ("prefer this structure"); it was left as a wish, not a description.
* **The frontend still calls the deleted legacy API** (checked 2026-11-14):
  `src/app/@SERVICES/auth/auth.service.ts` (`/api/auth`),
  `src/app/@API/pages/dashboard/dashboard.service.ts` (`/api/finance`) and
  `src/app/@SERVICES/sync/backup.service.ts` (`/api`). The new backend has only `/api/health/` and
  `/api/me/`, so a logged-in flow that uses them fails against it. Guest mode (local only) is not
  affected. This belongs to the alignment phase (D-096); do not patch it ad hoc.
* **`/admin/` is still routed** (the default Django scaffold; `django.contrib.admin` is
  installed) although admin features are deferred (D-080). Django creates no admin account by
  itself. Decide later whether to remove it or keep it closed in production. Not changed.
* **Frontend/backend alignment is a planned phase after the backend work** (D-096); read
  `plans/plans-Backend/20261114-frontend-backend-alignment.md` before writing any endpoint or
  adapter. Backend and database are the source of truth; the frontend gets a mapping layer.
* **Outside `Qeeva-Backend`:** the root `AGENTS.md` was updated once with the user's permission
  (D-095) and `.cursor/rules/00-monorepo.mdc` once (D-099, the plans anatomy). Neither is a
  standing permission. `swagger-local/openapi.json` (documents localStorage shapes, no API
  paths) is still untouched; update it only when endpoints exist and the user approves.

* **Slow tests on Windows: fixed (D-102).** `localhost` took 15 s per connection; `127.0.0.1`
  takes 19 ms. The user's run after patch 0011: 164 passed in 2.53 s.
* **Django's own tables** (`auth_user`, `django_session`, `django_migrations`, ...) live in
  `public` without RLS. Recommend the user turns **Data API off** in the Supabase dashboard
  (we never use it). Unverified for the project's current setting.
* **`qeeva-dev` JWT signing keys** must be asymmetric or JWKS verification returns nothing. Not
  yet checked.
* With the pinned django-stubs, `Model.objects` is typed `Any` (also for Django's own `User`), so
  mypy is weaker on ORM calls. Re-check after upgrading the stubs.
* Not yet decided: hosting, Django admin (deferred, D-080), per-request RLS (option B in D-087,
  can be added later through a migration), multi-income pool rules, sync, devices,
  plans/waitlist, consents, audit logs, export/delete flows, Community, Arabic UI.
* Planned, not now: Telegram voice bot, bank import (pending list, D-062/D-074), Advanced-mode
  features, `POST /api/sync/batch` (client contract in `Qeeva-Frontend/AGENT_ONBOARDING.md`).

## 10. Where we stopped (update this at the end of every work step, D-116)

Date: 2026-11-17. Patches 0001-0018 are applied and pushed. Patches 0019, 0020 and 0021 are docs only and delivered: 0019 (D-121 notifications table, D-122 working time stays in hours, first D-123 wording, the "Designed, not built" tables in `docs/database/schema-blueprint.md`), 0020 (D-123 rewritten to match the Angular month behavior, the Advanced switch `skip_item_delete_confirm`, the ideas list) and 0021 (D-123 open point decided, History table notes, two more ideas). On 2026-11-17 the user said he is applying 0019 and 0020, and that any change goes into 0021. Patch 0022 (docs: this progress snapshot and the AGENTS.md refresh) follows them.

**Path A (current):** finish the data design for every feature, then the calculation layer. Not built:
anything for Areas 1-9 of the map. The user's rule: the database is the only subject; he asked the AI
to ask two or more questions per message (changed 2026-11-17) and to keep the `.md` files updated.

**Done in the design:** Area 1 (D-117 approved). D-119 approved: the free funds can go negative after editing an old month; the next months' money fills that gap first (free leftover, then the planned saving through `reduction_minor`); Regular sees a notice, Advanced also gets a "fix" that lowers one saving item. Funds pool and start amounts (D-118 approved: total funds are one pool, a saving item holds a part of it, the start amount is a ledger entry "move to item", a move larger than the free funds is refused; the ledger table `fund_entries` also serves the manual savings list).

**Area 2 done in the design** (D-121: one generic `notifications` table; the rest is calculated or in the funds ledger).

**Area 3 started** (D-122, approved 2026-11-17): working time stays in hours as built (the user first chose minutes, then changed his mind); no migration. Next question in Area 3: Regular single income vs Advanced several income types (hourly rate summed into "Product Price"), the custom month boundary, and D-109 point 5 (income = sum of income lines).

**Funds-entry deletion** (D-123, approved 2026-11-17, rewritten after he pointed to Angular): months are a calendar, so deleting a month erases its data; the month is ignored first, then Delete opens a popup (delete everything, or keep the ticked funds entries, which stay in the SAME month). The database refuses to delete a month that still has entries. Deleting a saving item returns its money to the free funds (an Advanced user can switch the confirm message off, `user_settings.skip_item_delete_confirm`). DECIDED (his choice, as Angular): funds entries do not count while their month is ignored; one meaning of Ignore for every user mode. Small non-decision ideas live in `plans/plans-Backend/20261117-ideas-list.md`.

**Waiting for the user's answer:**
* Area 3, answered 2026-11-17: income lines copy automatically for both modes, no repeat column (D-124); a yearly line counts only in the month it arrives, with `frequency` and `due_month` columns, the user picks the arrival month (D-125, column design by the AI). Asked next (answers pending): (1) working hours on an income line: nullable hours (a Bonus line has none, recommended) or monthly lines only; (2) the custom month boundary for Advanced: one start-day number in `user_settings` (recommended), per-month dates, or later; (3) confirm that a month's income = its monthly lines + its yearly lines due that month (closes D-109 point 5).
* D-107 (small constraints; point 1, the optional saving target, is confirmed) and D-109 (point 5,
  income = sum of income lines, needs a longer talk in Area 3). Both stay "AI choice" until he agrees.
* Nothing is open in Areas 1 and 2 or in D-123. D-111 and D-119 are approved with one rule: the deficit and the old-month gap both lower the month's not-yet-completed saving cards, pro-rata by default, a tap overrides it (`reduction_minor`), nothing forced or deleted. D-120 (global undo) is a deferred idea.

**Ideas to keep in mind (deferred):** percentage tax, several taxes, tax goals, Zakat helper (D-112 to
D-114), time input format on screen (D-115; storage stays in hours, D-122), manual savings and debit/credit (D-093), item links (D-092), global
undo with soft-delete tombstones (D-120, matters for sync).

**Not touched yet:** Supabase (read-only so far, nothing applied; D-084), JWT key check, Angular
vectors run, any API endpoint. Month deletion rule is D-110 (for when the API exists).
