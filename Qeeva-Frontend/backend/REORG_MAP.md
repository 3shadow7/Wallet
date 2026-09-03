Backend Reorganization Map

Goal: move Django apps into a clear `backend/apps/` layout and keep project package (`core`) as the project settings/entrypoint.

Proposed structure:

backend/
- apps/
  - authentication/
  - core_finance/
- core/ (Django project: settings, urls, wsgi, asgi)
- manage.py
- db.sqlite3

Notes and migration steps:
1. Create `backend/apps/` and move each Django app folder (`authentication`, `core_finance`) into it using `git mv` to preserve history.
2. Add `backend/apps/__init__.py` if needed and ensure `backend/apps` is a package.
3. Update `PYTHONPATH` or `sys.path` in `manage.py` and `wsgi.py`/`asgi.py` to include the `backend` directory, or update `INSTALLED_APPS` entries in `core/settings.py` to reference new dotted paths (e.g. `apps.authentication` -> `apps.authentication`).
4. Update any import paths across the codebase that referenced the old app locations.
5. Run migrations and tests: `python manage.py makemigrations` / `migrate` and `python manage.py test`.

Caveats:
- Moving apps can break relative imports; do the changes in small commits and run tests after each move.
- Prefer to run `git mv` from repo root to preserve history.
- I can apply these moves now in small batches if you authorize me to proceed.
