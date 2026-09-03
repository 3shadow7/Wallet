# Qeeva — Project Instructions

Personal money management and financial analytics system. Offline-first; online sync comes later.

## Repository layout

| Path | Stack | Purpose |
|------|-------|---------|
| `Qeeva-Frontend/` | Angular 21, Signals, SCSS, AG Grid | Frontend PWA |
| `Qeeva-Backend/` | Django REST, SimpleJWT, SQLite | Backend API (auth + finance) |
| `plans/` | Markdown | Feature plans and refactor notes |
| `swagger-local/` | OpenAPI | Local API reference |

When editing frontend files, follow `Qeeva-Frontend/AGENTS.md`.
When editing backend files, follow `Qeeva-Backend/AGENTS.md`.

## Product vision

- Simple, intuitive UI for monthly income, expenses, savings, taxes, and insights.
- Offline-first: works without internet; local storage on device; sync across devices later on request.
- Modular, maintainable, scalable. Clean code, strong typing, linting. No test files unless explicitly requested.
- Start with **basic role** (fewer features). **Power user role**, Arabic i18n, Telegram bot, and advanced features come later unless asked.
- User is project manager; agent acts as senior developer. Add features iteratively — one at a time.

## Business logic (basic role)

**Currency:** USD, 2 decimals; store money as integer cents.

**Month boundary:** Calendar month (1st to end).

**Item types:** burn (expense), tax, saving. Importance for sort only: want, must, emergency, gift (default want).

**Auto-repeat:** Only tax and saving items repeat into the next month. Ignore state carries over.

**Ignore behavior:** Ignored items stay visible but are excluded from totals, history, and charts.

**Saving items:** Shown in the expense card as planned outflow, but are not real expenses in business logic.

### Dashboard formulas (exclude ignored items)

- Total income = sum of income
- Planned outflow = burn + tax + savingTarget
- Free money = income − (burn + tax + savingTarget); can be negative
- Real expense = burn + tax
- Savings balance = income − (burn + tax); can be negative
- Actual saved total = max(0, savings balance)
- Overspend = max(0, real expense − income)
- Saving shortfall = max(0, savingTarget − actual saved total)
- If burn + tax exceeds income, saving items save nothing that month

### Saving allocation

- If actual saved < savingTarget, user picks which saving items reduce
- At least one saving item must remain reducible (cannot lock all)
- Optional long-term goal per saving item; track accumulated saved across months

### Example

$500 income, $100 saving goal, $550 expenses → $50 overspend, $50 saving shortfall. Charts and stats must reflect this.

## Workflow

1. Inspect relevant files before changing code.
2. Preserve existing business behavior; keep API contracts stable unless change is requested.
3. Refactor incrementally — no large unrelated rewrites.
4. After each change, provide:
   - Brief summary of what changed and why
   - Commands to run (install, serve, migrate)
   - Quick manual QA steps
5. Ask clarifying questions when requirements are unclear.

## Out of scope (unless explicitly requested)

- Power user role, Arabic language, Telegram bot, watch UI
- Breaking API or routing changes
- Database reset/drop
- Adding test files
