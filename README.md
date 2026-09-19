# Qeeva

Personal money management app — offline-first Angular PWA with optional Django REST backend.

## Project structure

```
Qeeva/
├── Qeeva-Frontend/   # Angular 21 frontend (PWA)
├── Qeeva-Backend/    # Django REST + SimpleJWT
├── plans/            # Feature plans and refactor notes
├── swagger-local/    # OpenAPI spec
├── AGENTS.md         # Project-wide agent instructions
└── .cursor/          # Cursor rules and skills
```

## Cursor setup (migrated from VS Code Copilot)

This repo is configured for **Cursor Agent**. Your old Copilot files in `.github/agents/` and `.github/instructions/` are kept for reference; Cursor reads the new setup below.

### How it works

| What | Where | When it applies |
|------|-------|-----------------|
| Project context & business logic | `AGENTS.md` | Always (root) |
| Frontend rules | `Qeeva-Frontend/AGENTS.md` | When editing frontend files |
| Backend rules | `Qeeva-Backend/AGENTS.md` | When editing backend files |
| Monorepo workflow | `.cursor/rules/00-monorepo.mdc` | Always |
| Scoped reminders | `.cursor/rules/frontend-angular.mdc`, `backend-django.mdc` | Auto when matching files are open |
| Specialist skills | `.cursor/skills/frontend-senior/`, `backend-senior/` | Type `/frontend-senior` or `/backend-senior` |

### Quick start in Cursor

1. Open this repo folder in Cursor.
2. Open **Customize → Rules** in the sidebar to confirm project rules are loaded.
3. Use **Agent chat** (not just Tab autocomplete) for feature work — rules apply to Agent.
4. For frontend work: open files under `Qeeva-Frontend/` or run `/frontend-senior`.
5. For backend work: open files under `Qeeva-Backend/` or run `/backend-senior`.

### Dev commands

**Frontend** (`Qeeva-Frontend/`):
```bash
npm install
npm run build
npm start          # SSR server
# or: ng serve      # classic dev on :4200
```

**Backend** (`Qeeva-Backend/`):
```bash
python manage.py migrate
python manage.py runserver   # :8000
```

## Copilot → Cursor mapping

| Copilot (VS Code) | Cursor equivalent |
|-------------------|---------------------|
| `.github/instructions/project_plan.instructions.md` | `AGENTS.md` (root) |
| `.github/agents/frontend-senior.agent.md` | `Qeeva-Frontend/AGENTS.md` + `/frontend-senior` skill |
| `.github/agents/backend-senior.agent.md` | `Qeeva-Backend/AGENTS.md` + `/backend-senior` skill |

See `Qeeva-Frontend/README.md` for frontend architecture details.
