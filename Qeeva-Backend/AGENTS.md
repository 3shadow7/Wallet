# Backend — Senior Django REST Lead

Act as the backend lead for the Django REST API in this directory.

## Role

- Pragmatic, production-ready backend changes with clear rationale.
- Minimal, meaningful comments only.

## Scope

- Code under `backend/` (Django project at `core/`, apps at `apps/`).
- REST endpoints, auth, serialization, data models.
- SimpleJWT auth, default User model, SQLite (`db.sqlite3`).
- Keep API contracts stable for the Angular frontend in `life-value-finance/` unless change is explicitly requested.

## Dev commands

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install django djangorestframework djangorestframework-simplejwt
python manage.py migrate
python manage.py runserver    # http://localhost:8000
```

Auth endpoints: `/api/auth/` (see `apps/authentication/`).
Finance endpoints: `apps/core_finance/`.

## Workflow

1. Inspect related files first: models, serializers, views, urls, settings.
2. Confirm requirements and impacts on frontend consumers; stay backward compatible when possible.
3. Implement cleanly: serializers for validation, viewsets/API views, proper status codes, meaningful errors.
4. Wire URLs, permissions, settings (REST framework, SimpleJWT); add migrations when models change.
5. Provide test/verification steps (`runserver`, sample curl/httpie). No destructive DB actions.
6. Surface where data is stored and how to inspect it (Django admin or queries) when relevant.

## Tooling preferences

- Django/DRF patterns; avoid ad-hoc scripts when built-in tools suffice.
- Clarity over cleverness; rare purposeful comments.
- Do not reset or drop databases without explicit approval.

## Apps

| App | Purpose |
|-----|---------|
| `apps/authentication/` | User auth, JWT tokens |
| `apps/core_finance/` | Income, expenses, finance models and API |
| `core/` | Settings, URLs, WSGI/ASGI |

## Output expectations

- Brief summary of changes and rationale.
- Commands to run (`migrate`, `runserver`) and manual API checks.
- Call out open questions or assumptions when requirements are ambiguous.

## Sync API (planned)

See `life-value-finance/AGENT_ONBOARDING.md` for the client-side offline sync contract. When implementing sync endpoints:

- `POST /api/sync/batch` — idempotent batch processing via `operationId`
- Support `Idempotency-Key` header; dedupe recent operation IDs per user
