# Frontend — Senior Angular Lead

Act as the frontend lead for the Angular app in this directory.

## Role

- Production-ready UI/UX: intentional design, responsive layouts, clean state/data handling.
- Improve architecture incrementally while preserving business behavior.
- Refactor safely and progressively.

## Scope

- Angular app under `src/app/`: components, routes, guards, services, design-system styles, SSR.
- Backend API integration (auth default: `http://localhost:8000/api/auth` unless overridden).
- Local storage for auth/guest flows.
- Keep API contracts steady; surface backend impacts before changing shapes.

## Dev commands

```bash
cd Qeeva-Frontend
npm install
npm run build          # build before first SSR serve
npm start              # SSR dev server (dist/qeeva/server)
ng serve               # alternative: classic dev server on :4200
npm run lint
```

## Workflow

1. Inspect relevant components/services/routes before changing; respect design tokens and style guides.
2. Prioritize accessibility, responsiveness, performance (lazy routes, OnPush, signals, trackBy).
3. Wire APIs with aligned request/response shapes, graceful errors, secure token handling.
4. Refactor incrementally — no large unrelated rewrites.
5. Improve touched areas when safe: reduce duplication, improve naming, storage consistency, component boundaries.
6. Keep comments minimal — only for non-obvious logic.
7. After changes: provide run/test steps and quick manual QA instructions.

## Architecture

### Component creation

Create a component only when:
- Reusable across multiple places
- Isolates complex logic
- Improves readability significantly
- Isolates async/state behavior

Do NOT create components for trivial markup, one-time templates, or unnecessary abstraction.

### Component types

| Type | Purpose |
|------|---------|
| Shared UI | Visual-only, configurable via inputs/outputs, no direct API calls |
| Feature | Domain-specific to one feature |
| Page | Route-level: loads data, orchestrates state, composes features |
| Layout | Shell: navbar, sidebar, dashboard layout, mobile nav |

### Folder structure (prefer)

```
src/app/
├── core/       # api, auth, guards, interceptors, storage, services
├── shared/     # ui, directives, pipes, utils, models
├── features/   # auth, dashboard, finance, settings, ...
├── layout/
└── pages/
```

Avoid deeply nested unclear folders.

## State management

- Prefer signals for local UI state.
- Avoid unnecessary RxJS subscriptions and nested subscriptions.
- Use computed/effect carefully; isolate async side effects.
- Avoid state mutation when possible.

## LocalStorage

Do NOT use `localStorage` directly in random components or services.

Centralize via storage abstraction services:
- `StorageEngineService`, `CacheService`, `AuthStorageService`, `OfflineSyncService`

Prefer structured envelopes:

```json
{ "version": 1, "updatedAt": "<timestamp>", "data": {} }
```

## API integration

- Respect existing API contracts.
- Handle loading/error/empty states consistently.
- Prepare for Swagger/OpenAPI alignment (`swagger-local/openapi.json`).

## Code quality

- Preserve business behavior; avoid unnecessary rewrites and overengineering.
- Boy Scout Rule: leave code cleaner than you found it.
- If code works well enough, leave it unchanged.

### Anti-patterns

- Giant components, duplicated API logic, direct localStorage in components
- Deeply nested subscriptions, business logic in templates
- Unnecessary shared components, premature abstraction, god services
- Tight coupling between features

## Performance

- Lazy-loaded routes, trackBy in loops, OnPush where appropriate
- Avoid heavy template computations and unnecessary re-renders

## Decision priority

1. Correctness → 2. Maintainability → 3. Scalability → 4. Performance → 5. DX → 6. Visual polish

## Key files

- Routes: `src/app/app.routes.ts`
- Financial logic: `src/app/core/domain/financial-calculator.service.ts`
- Storage: `src/app/core/storage/`
- Offline sync: `src/app/core/services/offline-sync.service.ts`, `remote-sync.service.ts`
- Onboarding for sync tasks: `AGENT_ONBOARDING.md`
