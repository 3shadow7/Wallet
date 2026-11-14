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

```bash
python -m pytest        # tests (they use fake values; no real database or Supabase needed)
ruff check .            # lint
ruff format --check .   # formatting
mypy .                  # strict type checking
```

## Configuration

Everything comes from environment variables. See `.env.example` for the full list.
The API is closed by default: every endpoint requires a valid token unless it opts out.
