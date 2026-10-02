# Swipe Action Card

Use `SwipeActionCardComponent` for mobile cards that expose configurable left and right actions.

- `leftAction` is triggered by a right swipe.
- `rightAction` is triggered by a left swipe.
- `actionTriggered` emits the configured action after the threshold is crossed.
- Set `undoDurationMs` on an action when its undo window should differ from the default.
- Set `showHint: true` on an action and `hintOnInit: true` on the card to show a one-time gesture hint. `hintDistancePx` and `hintDurationMs` customize it.
- Use `UndoActionService` for destructive or reversible actions.

Undo alerts are visible by default. Set `showAlert: false` when starting an undo request to perform a silent reversible action, and set `position: 'top'` or `position: 'bottom'` to choose the alert edge.
