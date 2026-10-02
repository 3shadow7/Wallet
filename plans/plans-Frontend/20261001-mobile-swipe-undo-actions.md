---
title: "Mobile Swipe Actions and Undo Alert"
author: "GitHub Copilot"
date: "2026-10-01"
status: "done"
---

# Mobile Swipe Actions and Undo Alert

## TL;DR

Add a reusable mobile swipe-card interaction with configurable left/right actions and a shared undo countdown alert. History is the first consumer; future item and page cards can reuse the same components and service.

## Implementation status

Implemented:

- Shared `SwipeActionCardComponent` with configurable left/right actions, tones, thresholds, and per-action undo duration.
- Swipe discoverability hint can be enabled per action with configurable distance and duration; history shows it only on the first eligible card after it enters the viewport.
- Shared `UndoActionService` with configurable countdown and undo callback.
- Shared responsive `UndoActionAlertComponent` mounted at the app shell, with optional visibility, top/bottom placement, and a draining circular countdown.
- History mobile cards support Ignore/Include and conditional Delete swipes.
- Delete and ignore/include actions restore the previous state through the shared undo flow.
- Existing route-level swipe navigation is protected by the shared `noSwipe` marker.

## Steps

1. [x] Create the generic swipe-card API and gesture handling.
2. [x] Create the shared undo service and responsive alert.
3. [x] Integrate the shared alert in the application shell.
4. [x] Integrate configurable swipe actions in history cards.
5. [x] Add reversible history state restoration.
6. [x] Build and validate the frontend.
7. [ ] Perform browser QA on mobile, tablet, and desktop widths.

## Review result

Implementation is complete and passes diagnostics, production build, and diff validation. Browser gesture QA remains a manual follow-up because the available guest session had no seeded history cards; this is an environment/data limitation, not an identified code defect.

## Relevant files

- `Qeeva-Frontend/src/app/@SHARED/components/swipe-action-card/`
- `Qeeva-Frontend/src/app/@SHARED/components/undo-action-alert/`
- `Qeeva-Frontend/src/app/@SHARED/services/undo-action.service.ts`
- `Qeeva-Frontend/src/app/@COMPONENTS/pages/history/`
- `Qeeva-Frontend/src/app/app.html`
- `Qeeva-Frontend/src/app/app.ts`
- `Qeeva-Frontend/src/app/@SERVICES/state/budget-state.service.ts`

## Verification

- `cd Qeeva-Frontend`
- `npm run build`
- On mobile width, swipe right and left on a history card and confirm the configured action label appears.
- Confirm Ignore/Include updates totals and shows the undo alert.
- Confirm Delete is offered only for an empty excluded month and restores correctly with Undo.
- Confirm the countdown is visible, expires automatically, and stays positioned within the viewport on mobile and desktop.
- Confirm vertical scrolling and existing route navigation are not triggered as accidental card actions.

## Decisions

- Swipe actions are generic IDs and labels so future consumers can define domain-specific behavior.
- The shared service owns timing and callbacks; feature components own domain state changes.
- The default undo duration is 6 seconds, with per-action overrides supported.
- Swipe hints are opt-in and honor `prefers-reduced-motion`.
- The hint waits for viewport visibility so cards below a scroll container do not consume the hint before the user can see it.
- Alerts are visible by default and can be disabled per action with `showAlert: false`.
- Alert placement is configured per action with `position: 'top' | 'bottom'`; history currently uses the bottom position.
