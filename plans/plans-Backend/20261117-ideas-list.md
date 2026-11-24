---
title: "Ideas list (low priority, do not forget)"
author: "Claude"
date: "2026-11-17"
status: "draft"
---

# Ideas list (low priority, do not forget)

## TL;DR

Small ideas that are not important now but must not be lost (the user's rule, 2026-11-17). They are not
decisions: nothing here is built or promised. Bigger deferred ideas live in the decision log as
"deferred" rows (D-112 percentage tax, D-113 Zakat helper, D-114 tax goal, D-115 time input format,
D-120 global undo). When an idea becomes real, it gets a D-number there and is removed from this list.

## Steps

Add a row here whenever a small idea comes up. Tick a row when it has become a decision or was dropped.

| Done | Idea | Where it applies | Who | Date |
|---|---|---|---|---|
| [ ] | In the "delete a month" popup (D-123: it lists the month's funds entries), tick every entry by default, which means "keep in the same month", so no money is lost by accident; the user unticks what he wants gone. | Screen (Angular), not the database | AI suggestion, the user asked to keep it as a low-priority idea | 2026-11-17 |
| [ ] | More control inside the analysis for Advanced users: view options that change no data, for example count the funds of ignored months, or ignore other things (Angular already has "Show excluded months" on the History charts). Regular keeps the one simple meaning of Ignore. | Screen and analysis (Angular), not the database | The user asked what to do; AI suggestion | 2026-11-17 |
| [ ] | In the month-delete popup, when the user keeps funds and the month is ignored, say in one sentence that those funds are not counted and offer a Count switch for that month. | Screen (Angular), part of D-123 | AI suggestion | 2026-11-17 |
| [ ] | Path C check of Angular fallbacks that invent a value: 160 monthly hours when none are set (`financial-calculator.service.ts`) and 1 per hour in the purchase calculator (`analyzePurchase`); compare with D-032 and D-126 (a line may have no working time) when the screens are aligned. | Screen (Angular) | AI finding | 2026-11-17 |
| [x] | Currencies that people write with three decimals (the Libyan dinar, KWD, BHD, OMR, JOD, TND): today every amount and every price keeps two decimals (D-033, D-144) and the user accepted it, but asked to keep in mind that people are used to three. A number of decimals per currency would touch every money column. | Database and screens (a later migration) | The user, "keep this in mind" | 2026-11-17 Decided 2026-11-19 as D-149 (a setting: Regular 3, Advanced 2 or 3). |
| [ ] | Receipt photos (the camera source of the pending list): the photo files are not stored in `pending_entries`; where and whether to keep them (file storage) is a later decision. | Database, storage | The AI, written at his request ("write it down so we don't forget") | 2026-11-23 |
| [x] | How long to keep the voice transcript and receipt text (`pending_entries.raw_text`) and the bank data: decide in Area 9 (account, privacy, deletion). | Database, privacy | The AI, written at his request | 2026-11-23 Decided 2026-11-23 (D-197): nothing is deleted. |
| [ ] | An incoming bank entry may be income, a gift or a debt repayment: how it is classified when he confirms it is a later detail of the pending list. | Database, screens | The AI, written at his request | 2026-11-23 |
| [ ] | Leaving Supabase later (D-211, his plan for after some years): move the database with `pg_dump`/`pg_restore` to any PostgreSQL 15+ server, move the users to a new sign-in service that signs tokens with JWKS, replace or drop the `profiles.id -> auth.users` foreign key. Everything else is plain Django and PostgreSQL. | Hosting, sign-in | User (AI wrote the steps) | 2026-11-24 |

## Relevant files

- `plans/decisions/decision-log.md` (D-123 is the popup rule; D-126 and D-032 for the fallbacks row)
- `plans/plans-Backend/20261115-feature-data-map.md`

## Verification

Nothing to test: this file is a memory aid. Review it at the start of each Area of the feature map and when the screens are designed.

## Decisions

D-123 (the popup this idea belongs to). Deferred ideas that are already numbered: D-112 to D-115, D-120.
