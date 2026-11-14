---
description: Monorepo layout, dev commands, and workflow for Qeeva
alwaysApply: true
---

# Qeeva monorepo

## Layout

- **Frontend:** `Qeeva-Frontend/` — Angular 21 PWA (see `Qeeva-Frontend/AGENTS.md`)
- **Backend:** `Qeeva-Backend/` — Django 5.2 + Django REST Framework, Supabase Auth (Django only verifies the token), PostgreSQL on Supabase; Django owns the schema (see `Qeeva-Backend/AGENTS.md`, read it first)
- **Plans:** `plans/` — the project's shared memory (anatomy below)
- **API spec:** `swagger-local/openapi.json` — today it documents the frontend's localStorage shapes (no API paths yet)

## Anatomy of `plans/`

Full guide: `plans/README.md`.

```text
plans/
├── README.md            map of the folder and how a plan is written
├── rules/               general-rules.md (how to work), Template-of-plans.md (plan template)
├── project-idea/        idea-v1.md, idea-v2.md (product idea and scope)
├── decisions/           decision-log.md (every D-number), README.md (how decisions are written)
├── plans-Frontend/      plans about Qeeva-Frontend
└── plans-Backend/       plans about Qeeva-Backend
```

- New plan for any ask: in `plans/plans-Frontend/` or `plans/plans-Backend/` (work on both sides → one plan in each), named `YYYYMMDD-short-title.md`.
- Frontmatter: `title`, `author`, `date`, `status` (`draft|proposed|approved|done`). Sections, in order: TL;DR, Steps, Relevant files, Verification, Decisions (template: `plans/rules/Template-of-plans.md`).
- The Decisions section lists D-numbers (`D-087`); the text lives only in `plans/decisions/decision-log.md`. New decisions go there, in the same commit as the work they cause.
- Files directly under `plans/` are older plans: leave them as they are, do not add new ones there.
- Precedence on conflict: the Master Context and Engineering Rules (the product owner's chat files, not in Git) > `plans/decisions/` and `Qeeva-Backend/docs/database/schema-blueprint.md` > the rest of `plans/`.

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
- "Read all the `.md` files" means every `.md` and `.mdc` in the repository, including `.cursor/` and `.github/`. Never answer that you did not read them.
- Backend: tests are required. Frontend: keep the existing rule (no test files unless asked) until the product owner decides otherwise.
- Backend: no new API endpoints until the product owner changes the scope.
- Do not reset databases or expand scope unless asked.
- Legacy Copilot agents live in `.github/agents/` — Cursor uses `AGENTS.md` and `.cursor/` instead.

## Invoke specialist mode

- Frontend lead: type `/frontend-senior` or `@frontend-senior` in Agent chat
- Backend lead: type `/backend-senior` or `@backend-senior` in Agent chat
