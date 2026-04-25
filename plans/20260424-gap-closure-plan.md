---
title: "MyWallet Frontend-Backend Gap Closure Plan"
author: assistant
date: 2026-04-24
status: in-progress
---

## Progress Update (2026-04-24)
- Completed: Step 1 (Admin Visibility Layer).
- Completed: Step 4 first sync slice (cloud push and cloud restore in Settings).
- Completed: Step 3 baseline (frontend API layer consolidation and shared environment base URL).
- Completed: Step 2 hardening pass baseline (backend input validation and ordering).
- Completed: Step 5 baseline (expense + income authenticated sync for current month with local-first fallback).
- Completed: Step 6 data strategy decision (hybrid local-first + authenticated cloud sync).
- In progress: Step 7 final QA sweep (automated checks complete; manual verification pending).

## Strategy Decision (Step 6)
- Adopt a hybrid model:
- Local-first remains active for UX speed and offline resilience.
- When authenticated and on the active month, expense/income operations sync to backend.
- Cloud backup in Settings supports push and restore for cross-device continuity.
- If backend sync fails, local state is preserved and warnings are logged, preventing user-facing data loss.

## QA Status (Step 7)
- Completed automated checks:
- Django `manage.py check` passes.
- Angular production build (`npm run build`) passes after each integration slice.
- Backend API smoke test passes (register/login + expense CRUD + income update + backup put/get).
- Remaining manual checks to close Step 7:
- Login/register, then create/edit/delete expenses and confirm admin/API persistence.
- Update income and confirm value is reloaded from backend on next session.
- Cloud sync + cloud restore end-to-end in Settings.
- Guest/offline behavior still works without forced backend dependency.

## TL;DR
Build the project in a controlled order: first make the Django admin a clear inspection console, then formalize backend contracts, then connect the Angular app to those contracts one flow at a time while keeping the existing local-first behavior working until each sync path is proven.

## Goals
- Make the admin page show users and their finance data clearly.
- Close the frontend/backend integration gap without breaking the current app.
- Keep the project understandable for the next agent and for future maintenance.
- Preserve existing local storage behavior until server sync is verified.

## Step 1: Admin Visibility Layer
- Register the core finance models in Django admin.
- Extend the User admin with finance inlines so one user page shows expenses, income, and backup data together.
- Keep list display, filters, search, and ordering focused on debugging and review.
- Add short comments/docstrings that explain the purpose of each admin class.

## Step 2: Backend Contract Review
- Review the existing finance endpoints for expenses, income, and backup.
- Confirm request and response shapes for each endpoint.
- Add validation and clearer error responses where needed.
- Keep the API backward compatible unless a change is explicitly required.

## Step 3: Frontend API Layer
- Create a dedicated Angular finance API service.
- Add typed methods for expense, income, and backup operations.
- Wire the service to the existing auth token flow.
- Add error handling and loading states so sync failures do not break the UI.

## Step 4: One End-to-End Sync Slice
- Connect one feature first, preferably backup or income.
- Verify create, read, update, and error behavior from the Angular UI to Django.
- Keep local storage as fallback until the server flow is stable.
- Document the exact behavior change in the relevant code comments.

## Step 5: Expenses Sync
- Add expense sync after the first slice is stable.
- Ensure month filtering and user ownership stay correct.
- Keep the UI state consistent when records are edited or removed.
- Verify the backend data matches the frontend summary calculations.

## Step 6: Data Strategy Decision
- Decide whether local storage remains primary, becomes fallback, or becomes a cache.
- If needed, add a clear sync policy for offline and online behavior.
- Document the decision in code comments and repo notes.
- Avoid changing the user flow until the strategy is approved.

## Step 7: QA and Stability
- Run backend checks after every backend change.
- Run Angular build and targeted UI checks after every frontend change.
- Manually test login, register, dashboard, history, settings, and backup flows.
- Confirm the admin page remains useful for inspection and debugging.

## Acceptance Criteria
- The admin page clearly shows users and related finance data.
- Backend APIs are stable, authenticated, and documented by code structure.
- Angular has a typed service layer for backend communication.
- At least one flow works end to end from UI to backend and back.
- Existing local-first behavior still works until sync is fully confirmed.

## Notes for Future Agents
- Read the admin classes first before changing data flow behavior.
- Keep comments short but purposeful, focused on why the code exists.
- Do not remove local storage support until backend sync is fully proven.
- Prefer small, testable slices over broad refactors.
