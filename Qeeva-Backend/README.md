# Qeeva Backend

Django 5.2 LTS + Django REST Framework. It verifies the access token that **Supabase Auth**
issues (Django never creates users) and will own the database schema through Django
migrations (decision D-085). The financial tables are added in the next commits.

## One-time setup

```bash
cd Qeeva-Backend
python -m venv .venv
# Windows:  .venv\Scripts\activate        macOS/Linux:  source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # then fill in the values (the .env file is ignored by Git)
```

Python 3.10 or newer is required (Django 5.2 supports 3.10 to 3.14).

## Run

```bash
python manage.py runserver
```

`runserver` checks for unapplied database migrations when it starts, so `DATABASE_URL` must
point to a reachable PostgreSQL database.

* `GET /api/health/` is public and answers `{"status": "ok"}`.
* `GET /api/me/` needs `Authorization: Bearer <Supabase access token>` and answers with the
  verified Supabase user id. Use it to test a real login from the Angular app.

## Checks (run all of them before every commit)

Run them from **inside `Qeeva-Backend/`**, not from the repository root: pytest looks for
`pyproject.toml` in the folder you are in, and from the root it fails with "settings are not
configured".

```bash
python -m pytest        # tests (see "Database tests" below: without PostgreSQL the database tests are skipped)
ruff check .            # lint
ruff format --check .   # formatting
mypy .                  # strict type checking
```

## Documentation

* `AGENTS.md`: operating manual for the AI that works on this project.
* `docs/BACKEND_GUIDE.ar.md`: guide for the product owner (Arabic).
* `docs/database/`: schema blueprint.
* `../plans/decisions/`: the decision log (every D-number) and how decisions are written.

## Database tests

Most of the safety rules live in the database (constraints, foreign keys, Row Level Security),
so they are tested against a **real PostgreSQL**. `docker-compose.yml` starts one that matches
Supabase (PostgreSQL 17) and keeps nothing on your disk. Django creates and drops its own
`test_...` database inside it.

```powershell
docker compose up -d --wait
$env:QEEVA_TEST_DATABASE_URL = "postgresql://postgres:test@127.0.0.1:5433/postgres"   # PowerShell
# macOS/Linux:  export QEEVA_TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:5433/postgres
python -m pytest
docker compose down
```

Write the host as `127.0.0.1`, not `localhost`. On Windows, connecting through the name
`localhost` took about 15 seconds per connection (the 145 tests needed 393 s instead of a few
seconds; measured, D-102). The code now reads `localhost` as `127.0.0.1` by itself, but other
tools (pgAdmin, DBeaver, `psql`) do not, so keep the habit.

Set the variable in the **real environment**, not in `.env`. Without it the database tests are
reported as **skipped** (with the reason), never as passed. Do not point it at your Supabase
project. The tests create a tiny stand-in for Supabase's `auth.users` table inside the throwaway
test database only.

To look at the tables, run `python -m pytest --reuse-db`, then open `test_postgres` on
`127.0.0.1:5433` (user `postgres`, password `test`) in pgAdmin or DBeaver.

## Admin page (`app_config` only)

The owner changes the values of `app_config` (limits, texts, switches) in Django's admin page (D-209). No other
table is shown there.

```bash
python manage.py createsuperuser   # once: a Django admin account, separate from your Supabase account
python manage.py runserver
```

Open `http://127.0.0.1:8000/admin/`, sign in, then **System > App config values**. Type the value as plain
text (`3`, `true`, a sentence); a wrong value is refused with the reason. Keys cannot be added or deleted.
Before going live: a secret address instead of `/admin/`, a long password, HTTPS only.

## Account tables (`apps/accounts`)

`profiles`, `username_reservations` and `user_settings`. Migration `0002` ties
`profiles.id` to Supabase's `auth.users` with a real foreign key, so **migrating needs the
Supabase `auth` schema** (it exists in every Supabase project). Migration `0003` turns Row
Level Security on for all three tables with **no policies** and revokes the browser-facing
roles' privileges, so Supabase's public Data API can read nothing; only Django (the table
owner role) can. Every future table must do the same with `common.db.lock_down_table`, and a
test fails if one forgets. Read user data only through `Model.objects.for_user(principal)`.

## Configuration

Everything comes from environment variables. See `.env.example` for the full list.
The API is closed by default: every endpoint requires a valid token unless it opts out.
