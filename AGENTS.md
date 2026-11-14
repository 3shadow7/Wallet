---
description: Monorepo layout, dev commands, and workflow for Qeeva
alwaysApply: true
---

# Qeeva monorepo

## Layout

- **general rules:** `/plans/rules/general-rules.md` — rules
- **Project Idea & scope** `/plans/project-idea` — version 1 and 2 ideas (see `/plans/project-idea/idea-v1.md`, `idea-v2.md`)
- **Frontend:** `Qeeva-Frontend/` — Angular 21 PWA (see `Qeeva-Frontend/AGENTS.md`)
- **Backend:** `Qeeva-Backend/` — Django 5.2 + Django REST Framework, Supabase Auth (Django only verifies the token), PostgreSQL on Supabase; Django owns the schema (see `Qeeva-Backend/AGENTS.md`, read it first)
- **Plans:** `plans/` — new plan for any ask (see `plans/rules/Template-of-plans.md`)
- **API spec:** `swagger-local/openapi.json` — today it documents the frontend's localStorage shapes (no API paths yet)

## Quick start

Frontend:
```bash
cd Qeeva-Frontend && npm install && npm run build && npm start
```

Backend (needs a `.env`; database tests need Docker, see `Qeeva-Backend/README.md`):
```bash
cd Qeeva-Backend
docker compose up -d --wait          # PostgreSQL 17 for the tests
python -m pytest                     # set QEEVA_TEST_DATABASE_URL first, see the README
```

## Agent behavior

- Treat the user as project manager; implement features incrementally.
- Read nested `AGENTS.md` in the directory you are editing.
- After code changes: summary, run commands, manual QA steps.
- Precedence on conflict: the Master Context and Engineering Rules (given by the user in chat, not in Git) > `Qeeva-Backend/docs/database/decision-log.md` > the `plans/` folder.
- Backend: tests are required. Frontend: keep the existing rule (no test files unless asked) until the product owner decides otherwise.
- Backend: no new API endpoints until the product owner changes the scope.
- Do not reset databases or expand scope unless asked.
- Legacy Copilot agents live in `.github/agents/` — Cursor uses `AGENTS.md` and `.cursor/` instead.

## Invoke specialist mode

- Frontend lead: type `/frontend-senior` or `@frontend-senior` in Agent chat
- Backend lead: type `/backend-senior` or `@backend-senior` in Agent chat
