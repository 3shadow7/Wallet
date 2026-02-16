# LIFE VALUE FINANCE — PROJECT GOVERNANCE PLAN
Version: 1.0
Framework: Angular 19 (Standalone Architecture)
Goal: Personal Decision Intelligence Tool
Scope: No testing files required

-------------------------------------------------
1. CORE PRINCIPLES
-------------------------------------------------

- Angular 19 standalone APIs only
- Strict mode enabled
- SCSS styling
- Signals-based state management
- No NgModules
- Feature-based folder structure
- OnPush change detection everywhere
- Domain logic must be framework-agnostic
- State is the single source of truth
- AG Grid must NEVER be treated as data storage

-------------------------------------------------
2. ARCHITECTURE RULES
-------------------------------------------------

Folder Structure:

/core
  /domain        -> Pure TypeScript models + financial engine
  /services      -> App-wide services
  /state         -> Signal-based state

/features
  /budget
  /value-calculator
  /dashboard

/shared
  /ui
  /pipes
  /directives

/layout
/theme

-------------------------------------------------
3. DOMAIN LAYER RULES
-------------------------------------------------

- No Angular decorators inside domain
- No dependency on browser APIs
- Pure functions only
- All calculations must handle edge cases:
  - Zero income
  - Negative values
  - NaN inputs
  - Division by zero

Financial Engine Responsibilities:
- Remaining income calculation
- Work-hours conversion
- Percentage calculations
- Recurring simulation

-------------------------------------------------
4. STATE MANAGEMENT RULES
-------------------------------------------------

- Use Angular signals
- All computed values must use computed()
- Expose readonly signals
- No direct mutation of arrays
- Immutable updates only
- State must sync automatically with persistence layer

-------------------------------------------------
5. PERSISTENCE STRATEGY
-------------------------------------------------

Since this is a personal project and speed is priority:

Use localStorage.

Rules:
- Create PersistenceService
- JSON schema versioning support
- Graceful fallback if corrupted data
- Auto-save on state change
- Load state during app bootstrap

No backend required.
No external database required.

-------------------------------------------------
6. AG GRID RULES
-------------------------------------------------

- Use community edition
- defaultColDef must:
    - handle null/undefined as '--'
    - enable sorting
    - enable resizing
- Grid must emit updates to state service
- Grid must not hold business logic

-------------------------------------------------
7. THEME SYSTEM
-------------------------------------------------

- SCSS design tokens
- CSS variables for runtime theming
- Support dark mode toggle
- AG Grid theme override file
- No inline styles

-------------------------------------------------
8. PRODUCTION HARDENING
-------------------------------------------------

- Global error handler
- Numeric input sanitization
- Currency formatting pipe
- No console logs in production
- Environment separation (dev/prod)
- Build must pass with no warnings

-------------------------------------------------
9. DEVELOPMENT WORKFLOW
-------------------------------------------------

Before adding any new feature:

1. Build project
2. Fix warnings
3. Ensure no TypeScript errors
4. Verify strict mode compliance
5. Commit changes
6. Then continue

No feature stacking.
No partial implementation.
Each feature must be stable before next.

-------------------------------------------------
10. PERFORMANCE TARGETS
-------------------------------------------------

- Initial bundle < 300kb gzipped
- Lazy load dashboard
- Avoid unnecessary re-renders
- Lighthouse score 90+

-------------------------------------------------
11. FUTURE EXTENSION (Optional)
-------------------------------------------------

- IndexedDB upgrade path
- PWA support
- Backend-ready domain layer
