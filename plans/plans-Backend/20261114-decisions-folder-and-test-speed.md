---
title: "Decisions folder, plans anatomy and test speed"
author: "Claude"
date: "2026-11-14"
status: "approved"
---

# Decisions folder, plans anatomy and test speed

## TL;DR

The product owner asked for three things: collect every D-number of the chat into a folder under
`plans/`, update the `.cursor` file that describes the anatomy of plans, and read **all** the `.md`
files (the `.cursor` and `.github` ones had been skipped). The whole saved conversation was scanned:
D-001 to D-097 all occur. Two (D-018, D-030) were missing from the first log and are recovered. Five
(D-007, D-008, D-010, D-011, D-043) have no text anywhere in the chat and stay reserved. The same
session found why the backend tests took 393 s on Windows: connecting through `localhost` costs about
15 s per connection (measured), through `127.0.0.1` 19 ms.

## Steps

1. [x] Scan the saved conversation for D-numbers and compare with the log (98 distinct ids seen; D-098
   was only a plan at that time).
2. [x] Create `plans/decisions/` with `README.md` (how a decision is written) and `decision-log.md`
   (moved from `Qeeva-Backend/docs/database/` with `git mv`, so its history is kept). Leave a pointer
   at the old path (D-098).
3. [x] Recover D-018 and D-030; correct the wording of D-006, D-013, D-029; mark D-063 as
   `superseded by D-064`; record D-098 to D-101.
4. [x] Add the guard test `core/tests/test_decision_log.py` (ten checks). Six deliberate breakages of
   the log were each caught.
5. [x] Write `plans/README.md` (it was empty): the anatomy of `plans/`.
6. [x] Update `.cursor/rules/00-monorepo.mdc` with the plans anatomy; align its stale lines with the
   root `AGENTS.md` (D-099).
7. [x] Read every `.md` and `.mdc` file of the repository, including `.cursor/` and `.github/`, and
   record what is stale (D-100, D-101).
8. [x] Read a database host written as `localhost` as `127.0.0.1` in `parse_database_url`, with tests
   (D-102).
9. [ ] The user re-runs the tests on Windows and reports the time.
10. [ ] The user answers D-101 (fix the stale agent files outside `Qeeva-Backend/`).

## Relevant files

- `plans/decisions/README.md`, `plans/decisions/decision-log.md`, `plans/README.md`
- `.cursor/rules/00-monorepo.mdc`
- `Qeeva-Backend/core/tests/test_decision_log.py`, `Qeeva-Backend/AGENTS.md`,
  `Qeeva-Backend/docs/database/decision-log.md` (pointer only)
- `Qeeva-Backend/core/env.py`, `Qeeva-Backend/core/tests/test_env.py` (step 8)

## Verification

- `cd Qeeva-Backend`, start the test database (see `README.md`, "Database tests"), then
  `python -m pytest`. Sandbox result for steps 1-7 (PostgreSQL 16, Linux, Python 3.13):
  155 passed in 0.8 s (145 earlier tests + 10 new). The user's Docker uses PostgreSQL 17.
- `ruff check .`, `ruff format --check .`, `mypy .`, `python manage.py makemigrations --check --dry-run
  --settings=core.settings_test`: all clean.
- The guard test was proven by breaking the log six ways (lost row, duplicated row, wrong next-free
  number, unknown status, `superseded` pointing at a missing row, a typo in a reference).
- Step 8: the old test that expected `localhost` was the only one that failed after the change; new
  tests cover the name in three spellings, the rest of the URL staying intact, and five hosts that
  must NOT change (`127.0.0.1`, `[::1]`, `localhost.example.com`, `mylocalhost`, `db.localhost`).
- Every file path written in backticks in the changed documents was checked to exist; the ones that do
  not are URL routes, slash commands, names of deleted legacy code, or the future `apps/finance`.

## Decisions

D-098, D-099, D-100, D-101, D-102. Recovered: D-018, D-030. Reserved without text: D-007, D-008,
D-010, D-011, D-043. See `plans/decisions/decision-log.md`.
