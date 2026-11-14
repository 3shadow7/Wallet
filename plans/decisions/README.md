# Decisions

The place where every decision of Qeeva is written down, with its number. Chat is not a safe
place to keep decisions (Engineering Rules §35), so a decision exists only once it is in
`decision-log.md`.

## Files

| File | What it is |
|---|---|
| `decision-log.md` | One table row per decision, grouped by area. The **single source of truth** for D-numbers (D-098). |
| `README.md` | This file: how a decision is written, changed and ranked. |

## Anatomy of a decision

One row in a table of `decision-log.md`:

```
| D-NNN | status | The decision in one or two English sentences. |
```

* **ID.** `D-` and three digits. The next free number is written at the top of the log (it is
  the highest number plus one). A number is never reused, renumbered or deleted, even when its
  decision is replaced.
* **Status.** The first word is one of:
  * `approved`: the product owner confirmed it. Put who and when in brackets when it helps
    (`approved (user, 2026-11-14)`).
  * `proposal`: suggested, not confirmed. An AI never writes `approved` for its own idea.
  * `superseded by D-NNN`: replaced by a later decision. The row stays for history.
  * `deferred`: an idea saved for later; it is not a decision to build it.
  * `AI choice`: a small technical choice the AI made inside its own role (for example a column
    type). The product owner may review and reverse it.
* **Decision.** What was decided, and the reason when it is not obvious. Mention related numbers
  (`replaces D-044`, `see D-093`). Wording is a faithful summary of what the user said (his own
  words are often Arabic); it is never a new decision.

## Rules

1. **Only the product owner approves.** The AI proposes; he decides scope and features.
2. **Never edit history.** To change a decision, add a new row that says what it replaces, and
   mark the old row `superseded by D-NNN`. A typo or a clearer wording of the same decision may
   be fixed in place.
3. **Reserved numbers.** If a number was used but its text was lost, it stays in the "Reserved
   IDs" paragraph of the log so nobody reuses it.
4. **Same commit.** A change that follows from a decision is committed together with the decision
   row, and the "Next free number" line is updated in that commit.
5. **Conflicts.** When an older document disagrees with a later decision, the disagreement goes
   into the last table of the log and is closed by a D-number once the user rules on it.
6. **Plans point here, they do not copy.** A plan's `Decisions` section lists D-numbers (for
   example `D-087`); the text lives only in the log.
7. **A guard test protects the log.** `Qeeva-Backend/core/tests/test_decision_log.py` fails when a
   number is duplicated or silently lost, when a status is invalid, or when "Next free number" is
   wrong.

## Precedence

When two sources disagree, the higher one wins:

1. `QEEVA_MASTER_CONTEXT_MD`, `ADDITIONAL_ENGINEERING_RULES`, `Collaborative_Discovery_Protocol`
   (the product owner's files, given in chat, not in Git).
2. **This folder**, and `Qeeva-Backend/docs/database/schema-blueprint.md`.
3. Everything else in `plans/`, the `Foundation Build Plan` and the `description` file.

This folder is inside `plans/` but ranks above the rest of `plans/`, because its decisions were
made later than most plan files. Tests are required for the backend (D-001), even though older
files say "no test files".
