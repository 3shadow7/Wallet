# Qeeva Backend Foundation

A clean Django foundation for Qeeva's identity schema. This is separate from the legacy backend archive; the legacy project has not been modified.

## Current scope

- `profiles`
- `username_history`
- Django migrations for both tables
- PostgreSQL-only FK from `public.profiles.id` to `auth.users.id` when the Supabase Auth table exists

No API endpoints, signup trigger, RLS policies, Storage bucket, or Supabase database changes are included.

## Setup

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and configure environment variables in your shell or deployment environment.

For local SQLite model checks, keep the default `DB_ENGINE`. For Supabase Development, use the direct database connection or session pooler:

```env
DB_ENGINE=django.db.backends.postgresql
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=...
DB_HOST=...
DB_PORT=5432
DB_SSLMODE=require
```

Do not use Supabase's transaction pooler for Django migrations.

## Commands

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py test apps.identity
```

The migration adds the FK to `auth.users` only when run against PostgreSQL where `auth.users` exists. On SQLite it skips that external Supabase constraint.

## Important next steps

1. Review the generated model/migration design.
2. Implement the username change and claim service with transaction-level advisory locking.
3. Design the Supabase Auth signup/profile provisioning flow.
4. Add RLS policies and Storage access policies.
5. Only after explicit approval, apply the reviewed migration to the Supabase Development project.
