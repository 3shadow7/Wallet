---
title: "MyWallet Frontend-Backend Gap Closure Plan"
author: assistant
date: 2026-04-24
status: in-progress
---

## Progress Update (2026-05-01)
- Completed: Step 7 core manual QA flows (auth, expenses, income, guest/offline, cloud sync/restore baseline).
- Remaining: extended edge-case coverage for cloud sync/restore scenarios.

## Frontend-Backend Gap Check
- Current status: the main frontend-backend gap is mostly closed.
- Residual gap: cloud sync and restore edge cases still need coverage, especially conflicts, partial payloads, interrupted restores, and retry behavior.
- 2026-05-01 update: implemented backend conflict guard for backup writes (`expected_revision` -> 409 on stale push), added backend tests for revision bump + stale rejection, and began frontend UX shift to auto-sync (manual Sync button removed, status card added, background auto-sync service wired).
- 2026-05-01 update: added income conflict detection (`expected_updated_at`) and UI conflict resolution actions; remaining gap: confirm conflict UX in edge-case QA and document expense conflict policy.
- 2026-05-01 update: refined the Cloud Sync & Cloud Security card for desktop/mobile with one primary cloud action and collapsed advanced details; no new backend gap was introduced.
- 2026-05-01 update: fixed offline queue dedupe for unsynced expense edits and removed invalid DI from queue flush reconciliation; frontend build passes again after the sync fix.
- 2026-05-01 update: added per-device sync state on the backend and automatic queue retry with device identity headers on the frontend; backend finance tests and Angular build pass after the change.
- 2026-05-01 update: allowed the sync client’s custom CORS headers (`X-Device-ID`, `Idempotency-Key`) and both localhost origins so the backup request can reach Django without browser preflight failure.
- 2026-05-01 update: removed the client-only `expected_revision` field from backup serializer input so matching cloud writes are accepted instead of failing validation; backend finance tests still pass.
- 2026-05-01 update: core sync flow is now functionally complete and validated by build/tests; only edge-case QA remains, so the project can move on to the next feature while keeping a small sync follow-up backlog.
- Rule for this plan: after every new user message about this work, append a short dated gap status note here so the next request starts from the latest confirmed state.
- If no new gap is found, record that the current gap is unchanged rather than leaving the plan stale.

## Gap Closure Checklist
- Verify cloud sync conflict handling when local and backend changes diverge.
- Verify cloud restore behavior with partial, invalid, or missing backup payloads.
- Verify interrupted restore behavior and confirm the app recovers without losing local state.
- Verify retry behavior after temporary backend failures or auth expiration.
- Verify repeated cloud push and restore requests stay idempotent or fail safely.
- Keep local-first behavior intact while these cases are checked.
- When a case is confirmed, add a dated note here so the remaining gap always stays visible.

## Progress Update (2026-04-24)
- Completed: Step 1 (Admin Visibility Layer).
- Completed: Step 4 first sync slice (cloud push and cloud restore in Settings).
- Completed: Step 3 baseline (frontend API layer consolidation and shared environment base URL).
- Completed: Step 2 hardening pass baseline (backend input validation and ordering).
- Completed: Step 5 baseline (expense + income authenticated sync for current month with local-first fallback).
- Completed: Step 6 data strategy decision (hybrid local-first + authenticated cloud sync).
- In progress: Step 7 final QA sweep (automated checks complete; core manual verification passed; extended edge-case verification pending).

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
- Completed manual checks:
- Login/register, then create/edit/delete expenses and confirm admin/API persistence.
- Update income and confirm value is reloaded from backend on next session.
- Cloud sync + cloud restore end-to-end in Settings (baseline scenarios).
- Guest/offline behavior still works without forced backend dependency.
- Remaining manual checks to close Step 7:
- Cloud sync/restore extended edge cases (conflicts, partial/invalid payloads, interrupted restore, repeated retries).

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
- Before starting new frontend/backend work, check the latest entry in the gap log above so the next request continues from the current confirmed state.
