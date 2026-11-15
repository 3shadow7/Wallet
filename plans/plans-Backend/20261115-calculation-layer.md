---
title: "Calculation layer: month summary"
author: "Claude"
date: "2026-11-15"
status: "done"
---

# Calculation layer: month summary

## TL;DR

The dashboard formulas (planned outflow, free money, real expense, savings balance, actual saved,
overspend, saving shortfall) now exist in Python, as pure functions on integer minor units, with a
small database reader. The same cases are written in a neutral JSON file so the Angular calculator
can be checked against them later. No endpoint.

## Steps

1. [x] `apps/finance/calculations.py`: `CardAmount`, `MonthSummary`, `summarize_month` (D-109).
2. [x] `apps/finance/summary.py`: `summarize_month_from_db(month)` (two queries).
3. [x] Shared vectors: `apps/finance/tests/vectors/month_summary.json` (11 cases, includes the owner's example).
4. [x] Tests: vectors, owner's examples, ignored cards, invalid input, identities on 2,000 seeded random months, database reader (isolation between months and users, query count).
5. [x] Checked that broken formulas make the tests fail (three deliberate mistakes tried).
6. [ ] Run the same vectors in the Angular `FinancialCalculatorService` (needs the user's approval: outside `Qeeva-Backend`; the frontend works in dollars, the vectors in cents).
7. [ ] Next parts: saving allocation, saving goals and ETA, hourly rate and hours of life (each needs the user's go-ahead on details such as rounding).

## Relevant files

- `Qeeva-Backend/apps/finance/calculations.py`, `summary.py`
- `Qeeva-Backend/apps/finance/tests/test_calculations.py`, `test_summary.py`, `vectors/month_summary.json`
- `Qeeva-Frontend/src/app/@SERVICES/financial-calculator.service.ts` (reference; unchanged)

## Verification

- `cd Qeeva-Backend`, Docker database running, `QEEVA_TEST_DATABASE_URL` set: `python -m pytest apps/finance -q`.
- The formula tests need no database and also run without the variable.

## Decisions

D-108 (manual merge is always available), D-109 (shape of the calculation layer). The formulas are the
approved dashboard spec, so they are not new decisions. The owner's first example (income 500, saving
goal 100, expense 550) fits the formulas when the 550 is the planned outflow: free money -50,
actual saved 50, shortfall 50, overspend 0.
