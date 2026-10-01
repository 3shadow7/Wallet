---
title: "Excluded Months Change Map"
author: "GitHub Copilot"
date: "2026-10-01"
status: "proposed"
---

# Excluded Months Change Map

## TL;DR

The original request spans two layers, but the current implementation is mostly frontend-only. The Angular app already contains the exclusion field, state actions, savings filtering, history UI, chart filtering, and storage/backup handling. The Django API has no month-level exclusion implementation.

## Split plans

- Frontend implementation and remaining verification: [plans-Frontend/20260522-excluded-months-map.md](plans-Frontend/20260522-excluded-months-map.md)
- Backend design and implementation prerequisites: [plans-Backend/20260522-excluded-months-map.md](plans-Backend/20260522-excluded-months-map.md)

## Current status

### Frontend

Mostly implemented. Remaining work is to make legacy normalization derive the default exclusion from empty/all-ignored expenses and to verify all mutation, chart, delete, persistence, and reload paths.

### Backend

Not implemented. The current API has per-expense `is_ignored`, but no month history/savings resource or `excluded_from_totals` contract. A source-of-truth decision is required before adding migrations or endpoints.

## Original behavior target

- Empty or all-ignored historical months are excluded from totals by default.
- A dashboard control can include or exclude an empty past month.
- History marks excluded months as ignored and allows deletion only for empty excluded months.
- Savings and charts skip excluded months by default; charts may show them with an ignored style.
