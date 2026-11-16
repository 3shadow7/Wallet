# Decision log

Every D-number of Qeeva, one row each. How a decision is written and changed: see `README.md`
in this folder. This file is the **single source of truth** for D-numbers (D-098).

Recovered on 2026-11-14 from the saved copy of the whole working conversation (every message and
tool call in it, 1,349 entries, from 2026-11-08 on), because chat is not a safe place to keep
decisions (Engineering Rules §35). One line per decision, in English. The user's own words were
Arabic; wording here is a faithful summary, not a new decision.

**Numbers:** D-001 to D-123 are used. **Next free number: D-124.** Never reuse or renumber one.

**Status:** approved = the user confirmed it · proposal = not confirmed · superseded = replaced
(kept for history) · deferred = idea saved for later · AI choice = a small technical choice the
AI made inside its own role; the user may review and reverse it.

**Reserved IDs with no text: D-007, D-008, D-010, D-011, D-043.** The saved copy of the whole
conversation never writes these numbers (they appear only in the AI's own notes), so what they
meant cannot be recovered. They stay reserved: do not reuse them. If the product owner remembers
what one of them was, add it here as a normal row.

**Recovered in the 2026-11-14 collection pass** (they were missing from the first version of this
log): D-018 and D-030.

**Meaning taken from context:** the chat has no separate decision sentence for D-009, D-020 to
D-025, D-034 to D-036, D-047 and D-063. Their rows state what the message or table that cites
them says. Confirm them if one looks wrong.

## Process and scope

| ID | Status | Decision |
|---|---|---|
| D-001 | approved | On conflict, Master Context + Engineering Rules win over the Foundation Build Plan and `description`. (So tests ARE written.) |
| D-002 | approved | First goal is the database design. The AI asks about the idea, fills gaps, corrects misunderstandings, and writes no table before approval. |
| D-005 | approved | Build tables one by one, starting with `profiles`. One question per step with options and a recommendation. |
| D-006 | proposal | Archive the legacy backend outside Git (it held a `SECRET_KEY` and a database file) and migrate nothing; start a fresh Django project when implementation begins, keeping only the `request.user` pattern and the closed-by-default permission. Reasons given: no real data, and its design (numeric ids, text types, default User, no sync) conflicts with the Master Context. Never confirmed by the user. (In practice commit 1 deleted the legacy backend and started a fresh Django project; the old code survives in Git history.) |
| D-019 | approved | The table map is only a starting point; each table is reviewed when reached. |
| D-084 | approved | Nothing changes in Supabase without explicit final approval for each change; always `qeeva-dev` first. |
| D-085 | approved | Django owns the schema (migrations). Supersedes an earlier AI proposal (Supabase-first). |
| D-086 | approved, changed | User first chose "connect GitHub write access first", then changed his mind: the AI rebuilds commit 2 and delivers a patch; the user pushes. |
| D-087 | approved (user delegated the choice, 2026-11-14) | Option A for RLS: RLS on every table with no policies plus revoked privileges for `anon`/`authenticated`; Django connects as the owner and filters by owner through `for_user`. Per-request RLS (option B) may be added later by migration. Option C (frontend talks to Supabase data directly) rejected: it conflicts with D-085. |
| D-088 | approved (2026-11-14) | Database tests run on PostgreSQL 17 (same major as Supabase) in Docker locally, and in GitHub Actions on every push. The workflow file lives at `.github/workflows/backend-ci.yml`, the only approved file outside `Qeeva-Backend/`. |
| D-089 | AI choice, please review | Account tables: (a) deleting a Supabase user cascades to `profiles` and `user_settings` in SQL, but `username_reservations` rows survive with `previous_owner_id` cleared; (b) no unique constraint on a reserved name (the same name may be reserved again later; availability is decided in the username service); (c) time zone validity is checked in Python (IANA names), the database only forbids an empty value; (d) all choice columns are `text` with CHECK constraints. |
| D-090 | approved (restated by the user, 2026-11-14) | Qeeva is a money **log** for money management, not a payments or banking product. Consistent with D-032. |
| D-091 | approved (user statement, 2026-11-14) | Files the user gave in chat (Master Context, Engineering Rules, Discovery Protocol) come after the `plans/` folder and override it. The AI may add and update `.md` files in `plans/` and in `Qeeva-Backend/`. Backend plans go in `plans/plans-Backend/` and follow `plans/rules/Template-of-plans.md`. |
| D-092 | approved (user, 2026-11-14) | Item links (Item Explorer plan): postponed as D-060 says. No link table now. The conflict with the older plan is closed. |
| D-093 | approved (user, 2026-11-15) | Manual savings (D-083): do not build now. Design them later together with debit/credit (gifts, money from someone), because both are money moving outside the monthly cards. The user's idea: optional title, attached to a month, useful for analysis. Today's frontend stores one number per month (no title, no date). |
| D-094 | approved (user's guess, 2026-11-14) | No `category` column. Never decided in any D-number; the frontend field is a pass-through leftover; "importance" (want/must/emergency/gift) is the only classification. Reversible. |
| D-095 | approved (user, 2026-11-14) | One-time permission to update the root `AGENTS.md`. Done in patch 0009. Not a standing permission. |
| D-096 | approved (user, 2026-11-14) | After the backend work there is a planned alignment phase between frontend and backend, done carefully so old work is not broken and production is not delayed. See `plans/plans-Backend/20261114-frontend-backend-alignment.md`. |
| D-097 | approved (user, 2026-11-15) | Do not add `is_reducible` to `month_items` now. No frontend logic uses `isReducible` yet; the rule "which saving items shrink" is still open (Master Context section 15 #13). Adding the column later is a small migration. |
| D-098 | approved (user, 2026-11-14) | The decision log lives in `plans/decisions/` (this folder), not in `Qeeva-Backend/docs/database/`. It is the single source of truth for D-numbers. It sits inside `plans/` but ranks **above** the rest of `plans/` (see `README.md`). The old path keeps a one-line pointer so earlier links still work. |
| D-099 | approved (user, 2026-11-14) | Permission to update the file in `.cursor/` that describes how plans are laid out: `.cursor/rules/00-monorepo.mdc`. It is the twin of the root `AGENTS.md`. Done in patch 0010: the plans anatomy was added, and the stale lines inside that same file ("SimpleJWT", "do not add test files") were aligned with the root `AGENTS.md`. This covers only that file; the other `.cursor` and `.github` files are listed under D-101. |
| D-100 | approved (user, 2026-11-14) | When the user says "read all `.md` files", the AI reads **every** `.md` and `.mdc` file in the repository, including everything under `.cursor/` and `.github/`, and never answers that it did not read them. If it had not, it reads them then. Written into `Qeeva-Backend/AGENTS.md`. |
| D-101 | approved (user, 2026-11-15) | Fix the agent and documentation files outside `Qeeva-Backend/` that describe things that no longer exist. **Backend side:** `.cursor/rules/backend-django.mdc`, `.cursor/skills/backend-senior/SKILL.md`, `.github/agents/backend-senior.agent.md` and the backend lines of the root `README.md` still say SimpleJWT, SQLite, `apps/authentication`, `apps/core_finance`; the root `AGENTS.md` still points at the old decision-log path. **Frontend side (paths only, no behaviour):** `Qeeva-Frontend/AGENTS.md`, `AGENT_ONBOARDING.md`, `README.md`, `.cursor/rules/frontend-angular.mdc` and `.cursor/skills/frontend-senior/SKILL.md` name `core/...` folders that do not exist (the real ones are under `src/app/@SERVICES/`), and two files give the auth API as `http://localhost:8000/api/auth`. A Cursor agent is told the wrong stack today. The user said "you can do it" on 2026-11-15; done in patch 0012. The frontend path fixes touch documentation only, never code. |
| D-102 | approved (user, 2026-11-15) | A database host written as `localhost` is read as `127.0.0.1` (in `parse_database_url`). Measured on the user's Windows machine with Docker: connecting through `localhost` took 15,027 ms, through `127.0.0.1` 19 ms, per connection. The test suite opens many connections, so the 145 tests took 393 s instead of seconds. Probable cause (not proven): Windows tries IPv6 `::1` first and Docker publishes the port on IPv4 only. `[::1]` and every other host are left as written. Confirmed on the user's Windows machine after patch 0011: 164 tests passed in 2.53 s (before: 145 in 393 s). |
| D-103 | approved (user, 2026-11-15) | Item name comparison (`items.name_key`) follows D-056 and D-057, not only "trim + lowercase" as the blueprint said: surrounding spaces and letter case are ignored, every alef form counts as one letter, teh marbuta = heh, alef maksura = yeh, diacritics and tatweel are dropped, Arabic-Indic and Persian digits equal 0-9 (the digit rule is the assumption D-057 already names). Django computes the key in `Item.save()` (the stored name is unchanged). The Angular `normalizeName` only trims and lowercases today; making it match is part of the alignment phase (D-096). |
| D-104 | approved (user, 2026-11-15) | "No symbols" in item names (D-056) is checked in Python (`validate_item_name`: letters, digits, marks and single spaces) and **not** as a database CHECK, because PostgreSQL character classes depend on the server's locale and the rule would then behave differently per machine. The database still enforces length 1-40 and no leading, trailing or double spaces. |
| D-105 | approved (user, 2026-11-15) | Delete rules of the finance tables: deleting a user (or profile) removes all of the user's finance rows; deleting a month removes its income lines and cards; deleting an item removes its merge dismissals; an item that still has cards **cannot** be deleted (the user merges or deletes the cards first; `NO ACTION` in the database, `RESTRICT` in Django). Every child row also keeps its own `user_id` foreign key to `profiles`, and every link to a month or item is a composite key `(id, user_id)`, so a card can never join another user's month or item. |
| D-106 | approved (user, 2026-11-15) | A merge dismissal (D-053) is stored in one fixed order: `item_a_id` is the smaller id (CHECK `item_a_id < item_b_id`), so "A with B" and "B with A" are one row and an item cannot be dismissed against itself. `ItemMergeDismissal.ordered_pair` puts two ids in that order. |
| D-107 | AI choice, please review | Small constraints the blueprint left open: `items.target_minor` only on saving items (database CHECK, D-073 defers a Tax goal); `month_items.unit_price_minor` is NULL or >= 0; a month has no cap on how many income lines it holds (D-041); `hours_per_day` is `numeric(4,2)` (kept, D-122). Tables built with D-093 and D-097 as approved: no manual savings table, no `is_reducible` column. |
| D-108 | approved (user, 2026-11-15) | Merging items by hand is always available and never depends on a dismissed suggestion (D-053, D-106). The user can open Setup Items (search) or click an item in an old month and merge it with another item, for chosen months or for the whole timeline. The dismissals table only remembers "do not suggest this pair again". The merge logic itself (partial merge, what happens when both items have a card in the same month) is a future service, not built. |
| D-109 | AI choice, please review | The calculation layer is pure Python in `apps/finance/calculations.py`: integer minor units only (no division, no rounding), ignored cards are left out, a negative amount or an unknown item type raises `ValueError`. Formulas are exactly the approved dashboard formulas (they also equal `financial-calculator.service.ts`). Income of a month is the sum of its income lines (D-041). `summary.py` reads a month from the database and calls it. No endpoint. |
| D-110 | approved (user, 2026-11-15) | A month can be deleted only when it is excluded (`totals_mode = excluded`) and has no cards; otherwise the user must clear it first. This is the rule the Angular app already follows. The server must enforce it when the API exists (nothing enforces it in the database today; only the delete rules of D-105 protect orphan rows). |
| D-111 | approved (user, 2026-11-15) | Covering a deficit (the user's rule of 2026-11-15, restated). When the plan is bigger than the income (free money below 0), the deficit is covered first by lowering this month's saving cards (never more than they hold), and the user picks which saving item gives the money when there is more than one. Whatever is left (that is the overspend) is taken from the money already saved in earlier months (the "storage"), again with a pick when there is more than one saving item. The card shows a note, for example: "planned 300, saved 200 because you overspent 100 this month". "Storage" is the Angular savings module (`savings.service.ts`): a running total of every month's savings balance plus manual additions; it can go negative, and the user can also set it directly. The Angular app today lowers the saving cards by the same percentage (pro-rata, `history.component.ts`); it never asks the user to pick. Resolved (one rule for every case, the user's choice of 2026-11-15, D-119): while the user has not picked, the reduction is split pro-rata across the month's saving cards that have not reached their target yet (the default is automatic, the numbers are always complete, nothing is forced); anyone (Regular or Advanced) may tap to override and choose, which is stored in `month_items.reduction_minor` (D-117). A saving card that has reached its target is protected from the default, and at least one card must stay reducible. The pick is a column on the card, not a table. Nothing is built; D-097 stands. |
| D-112 | deferred (user idea, 2026-11-15) | Tax amount has two kinds: a fixed amount (built: for example 30 each month for a service) and a percentage (not built). A percentage can be taken from the month's income or from the user's total funds. A user may have several tax items. How several percentage taxes combine, and what "total funds" means, are open. |
| D-113 | deferred (user idea, 2026-11-15) | Advanced mode: religious tax helper (Zakat) for Muslim users: thresholds for money, gold and livestock; a tax item can be added or removed when a threshold is crossed or no longer crossed because of the month's spending. Not everyone is Muslim and not every Muslim is an Advanced user, so it is opt-in, and the app offers it through a neutral question and never guesses a religion. Idea: build it as a generic tax rule (base, rate, threshold, period) with Zakat as one template, so other taxes can use the same engine. Rules differ between schools and countries, so values must be editable and checked against a trusted source when built. Conflict to settle first: D-032 says the log never changes a value by itself (suggest and confirm, or an auto mode the user turns on). |
| D-114 | deferred (user idea, 2026-11-15) | A goal for tax items (this is D-073, now wanted): for example a monthly car tax with a total target, progress and notifications. The database today allows a target on saving items only (D-107); one small migration lifts that when this is designed. |
| D-115 | deferred (user idea, 2026-11-15) | Working time input: Regular users enter hours in time format (h:mm) only; Advanced users may use time format or a decimal number. Where the switch lives (a setting, or a toggle next to the field) is open. It is a screen choice only. A database idea of storing minutes was dropped by the user (D-122: hours stay). The screen part (where the switch lives) stays open. |
| D-116 | approved (user, 2026-11-15) | The chat cannot hold the whole project, so the `.md` files are the memory: the AI updates the decision log, the feature-data map, the plans and `Qeeva-Backend/AGENTS.md` (section 10, "Where we stopped") from time to time and at the end of every work step, so no decision or idea is lost. The user confirmed that the AI keeps working the way it does now: one area at a time, one question per message, the database as the only subject until the tables are complete. |
| D-117 | approved (user, 2026-11-15) | Area 1 storage: the user's pick of which saving item takes the deficit is saved in one nullable column on the saving card (working name `month_items.reduction_minor`: NULL = not chosen yet, otherwise 0 up to the card's amount, saving cards only). The total savings storage is not a table: it is calculated from the months plus a later list of manual adjustments (D-083, D-093). Not built; the migration comes with the code that uses the column. |
| D-118 | approved (user, 2026-11-15; his idea) | Funds and start amounts. The user's total funds are one pool; a saving item holds a part of it. When creating (or later) a saving item, the user may move an amount from the free part of the pool into the item (his example: funds 6000, "Car" target 14000 with 4000 moved in, then "Wedding ring" can take at most the 2000 that is still free). The total does not change; only where the money sits. The item stays simple (the target is optional and the start amount is an extra option next to it). Database idea: no column on `items`; one ledger table of dated entries (working name `fund_entries`) with kinds such as opening funds, manual add, manual withdraw, move to an item, move back from an item; each entry belongs to a month and an item entry names its item. The same table would answer the manual savings list (D-083, D-093). The pool total is calculated (months' savings balances + entries), never a stored number. The user's rule (2026-11-15): a move larger than the free funds is refused when the user enters it. When a later edit of an old month makes the free funds negative, see D-119. Not built. |
| D-119 | approved (user, 2026-11-15; mechanics restated by the AI, please review) | A gap in the free funds (the saving items hold more than the pool, usually after the user edits an old month, for example adding a burn item to a past month). **One rule for every case (the user's choice of 2026-11-15), no branching on how many saving items exist and the same for Regular and Advanced:** the months recalculate automatically; the shortfall is split pro-rata across that month's saving cards that have not reached their target (0 such cards: it simply shows as overspend; 1: that card takes it; many: pro-rata). The default is automatic, so the numbers are never left incomplete and nothing is deleted and nothing is forced. Anyone may tap a note ("auto-adjusted, tap to choose") to override the split and pick which saving card gives, stored in `month_items.reduction_minor` (D-111, D-117). Advanced also has the explicit "fix" action from D-118 (a ledger "move back from item"). The app never changes a value silently in a way the user cannot see or undo (D-032). **The user's rule: from the next month on, the money of the month fills the gap first, before the planned saving reaches its items** (his reason: otherwise an item can show its target as reached while the real money is not there, and the user finds out when he wants to spend it). Mechanics: the month's free leftover (savings balance minus the saving cards) goes to the gap first; if a gap remains, it lowers the month's saving cards, with the same pick and the same `reduction_minor` column as the deficit rule (D-111, D-117); the card says why ("planned 300, saved 200: 100 went to cover your funds gap"). The gap is calculated, never stored: free funds = pool minus what the items hold, so editing an old month recalculates every later month in order. Risk to watch: a big gap can keep a month's saving at zero for several months, so the screen shows how much is still left to cover. Not built. |
| D-120 | deferred (user idea, 2026-11-15) | A global undo: every action the user does (add, edit, delete, merge, a reduction pick) can be undone for a short time through an undo timer, like "undo send" in Gmail. It is a general feature, not tied to one screen, so it is designed once and used everywhere. Database effect to settle when built: a soft delete (a `deleted_at` tombstone) instead of a hard delete, which also helps sync across devices (Area 8); until then deletes stay hard. Not built. |
| D-121 | approved (user, 2026-11-15; details by the AI, please review) | Notification state lives in one generic table (working name `notifications`), not a table per feature. A row is created the first time the app finds that something is newly true (a goal reached 25/50/75/100%, D-072; later a tax goal, D-114; a Zakat threshold, D-113; Telegram messages). Columns idea: owner, kind, a unique key per owner such as `goal:<item id>:50` (so the same message is never created twice), an optional small JSON payload, `created_at`, `seen_at` (empty = not seen). Whether a milestone that is lost and reached again (after a history edit) notifies again is open. Channels (in-app, Telegram), settings and push are Area 9. Not built. |
| D-122 | approved (user, 2026-11-17) | Working time stays in hours, exactly as built: `hours_per_day` numeric(4,2) (0-24, default 8) and `work_hours_override` integer (1-744). No migration. History: on 2026-11-16 the user's reply "go with first one" picked the minutes option and the AI wrote it down here; on 2026-11-17 the user said he wants hours, so this row now says hours. Note by the AI: two decimals keep whole minutes exact when shown (7:20 is stored as 7.33 and shows 7:20 again); the only inexactness is the hourly rate in the money maths, well under 0.2% for a normal working day, which is fine for a log. Whether the monthly override should accept parts of an hour (for example 160:30) is left to the Area 3 talk about Advanced. |
| D-123 | approved (user, 2026-11-17; his popup idea, details by the AI, please review) | Deleting a month that has funds-ledger entries (`fund_entries`, D-118). The database never deletes entries silently: `fund_entries.month_id` is NO ACTION, so a month with entries cannot be deleted (safety net). On the screen a popup appears (it is the helper for D-110, which says a month must be cleared before it is deleted): it lists the month's cards and every entry as its own row (if the user added 28, then 22, then 10, that is three rows, because each addition is its own row; a card holds one number, D-059), it shows the total funds before and after, and it offers: (a) delete everything and empty the month, or (b) delete the cards and keep the entries the user ticks; each kept entry moves to the next month and each unticked entry is deleted. Details by the AI: the next month is the next existing month, and if there is none the app creates the next calendar month; the moves and the month delete happen in one transaction; entries that move money to or from a saving item are listed too. Two more AI defaults: (1) fund entries always count in the funds pool, even when their month is excluded (D-037), because they are the user's own money and not the month's income or spending; (2) deleting a saving item deletes its move entries with it (database CASCADE) and its money goes back to the free funds, with a confirm message; the pool total does not change. Not built. |

## Product

| ID | Status | Decision |
|---|---|---|
| D-003 | approved | A month holds items; each item has a name, a price and a quantity. No per-purchase dates now; dated transactions are a separate future feature. |
| D-004 | superseded by D-046, D-055 | Name-based suggestions: picking a suggestion joins the existing item, not picking creates a separate item, and a manual merge may come later only when type and importance match. The user described it; details were left open. |
| D-009 | approved | "Hours of life" (price of an item expressed in working hours) is a core idea of the product. |
| D-012 | approved | An item is money **already spent** ("apple = 488" means 488 was spent), not a plan. |
| D-013 | deferred | Two ideas postponed, details later: (1) **bank link**: money spent at the bank shows in Qeeva as a *pending* amount; the user gives it a name, type and importance, then it joins the log like any item; (2) **voice and AI**: the user speaks and the AI inserts the item. The design leaves room for a pending list without changing the items table (see D-062, D-074). |
| D-014 | approved | The user never picks a day; the month is enough. The app stores the entry time automatically in the background. |
| D-015 | approved | Principle: speed and simplicity first; adding an expense takes as few fields as possible. |
| D-016 | approved | A Saving item is money the user wants to save from this month's income for a goal; its long-term target is optional. |
| D-017 | approved | Tax is a real expense and appears automatically in every new month. |
| D-018 | approved, refined by D-070 and D-071 | A Saving item appears automatically every month until it stops, either because it reached its goal or because the user changed his mind. The "stopped" state this first implied was replaced: stopping is by deleting the latest month's card (D-070) or by reaching the goal (D-071); no `stopped` field. |
| D-032 | approved | Principle: the app is a log; it never creates or changes a value by itself. |
| D-082 | approved | The ignored state carries over with Tax/Saving cards copied to the next month (rule from `description`). |

## Accounts (built in `apps/accounts`)

| ID | Status | Decision |
|---|---|---|
| D-020 | approved | Username: unique ignoring case, English letters, digits and underscore, 3-20 characters. |
| D-021 | approved | A username may be changed once every 14 days (`username_changed_at`). |
| D-022 | approved | `display_name` optional, 1-30 characters, any language. |
| D-023 | approved | No country field. |
| D-024 | approved | `role` is `user` or `admin` (security role, not Regular/Advanced). The user edits only `display_name`. |
| D-025 | approved | `status` is `active`, `suspended` or `pending_deletion`. |
| D-026 | approved | No public/private account setting yet; added when Community is built. |
| D-027 | approved | `profiles` and `username_reservations` (old name held 30 days); name stored as typed; a list of forbidden usernames. |
| D-028 | approved | `user_settings`: Regular/Advanced mode, time zone, language (English now). No theme. (Currency was removed by D-033.) |
| D-029 | superseded by D-033 | Currency is only a name shown to the user; changing it never converts any number; there is no currency conversion. It is stored once in `user_settings`, not with every amount. |
| D-030 | deferred | Small calculator tools in the UI (add and multiply). No automatic conversion. |
| D-031 | superseded by D-033 | Currency chosen from a list. |
| D-033 | approved | Ignore currency entirely for now: no currency in the database; amounts are plain numbers. |
| D-034 | approved | `user_settings` has no sync fields; sync is a separate later topic. |
| D-035 | approved | `user_settings` columns as built (plus `skip_merge_confirm`, see D-081). |

## Finance (approved design; the five tables are built in `apps/finance`, see `schema-blueprint.md`)

| ID | Status | Decision |
|---|---|---|
| D-036 | approved | Income lines are copied to a new month automatically. |
| D-037 | approved | Keep the existing excluded-months rule; the user has a switch deciding whether a month with no (or only ignored) items counts; the explicit choice is stored with the month. |
| D-038 | approved | Income is lines under each month; no separate `income_sources` table now. |
| D-039 | approved | Work hours and a manual hourly rate are stored per income line per month. |
| D-040 | approved | `months` table as proposed. |
| D-041 | approved | In all modes a user may add several income lines. Regular treats them as one sum; Advanced may later link items to a specific income. |
| D-042 | approved | Hours per day and days per week are stored in the backend with the income line. |
| D-044 | superseded by D-055 | Same-name items were merged only if picked from suggestions. |
| D-045 | approved | Importance does not affect an item's identity. |
| D-046 | approved | Setup Items has a merge tool that can merge same-named items even with different types (a correction tool). Amends D-004. |
| D-047 | approved | An item's type never changes; the card moves to another item. |
| D-048 | superseded by D-049 | Changing a card's type created a separate new item. |
| D-049 | approved | A card may change type; it joins an existing item with the same name and new type, otherwise a new item is created. |
| D-050 | deferred | Bulk type change in Setup Items. |
| D-051 | approved | Picking a suggestion makes this month's card carry the same item id as older months; an existing card for that item gets the amount added. |
| D-052 | approved | Every edit applies immediately, without an extra confirmation step. |
| D-053 | approved | Same name with a different type shows a merge suggestion in Setup Items; a dismissed suggestion is remembered and not shown again. |
| D-054 | approved | Deleting a card (any month) removes it as if it was never added; affected results are recalculated. |
| D-055 | approved | Same name and same type = the same item automatically. Supersedes D-044. |
| D-056 | approved | Item names: Arabic and English, case-insensitive comparison, single spaces only, no symbols. |
| D-057 | approved | Arabic spelling variants count as one name (alef forms, ta marbuta/ha, alef maqsura/ya; diacritics ignored). Arabic and Western digits assumed equal (assumption). |
| D-058 | superseded by D-061 | Renaming to an existing name kept both items. |
| D-059 | approved | A card holds one number (no row per addition). |
| D-060 | deferred | Linking items with different names: ignored for now, maybe never. |
| D-061 | approved | Renaming to an existing same-type name opens a popup: accept to merge (values add up) or decline (old name returns). A different type stays a separate item with a Setup Items suggestion. |
| D-062 | approved (future) | Voice, receipt photos and bank/card input go to a pending list with tabs by source; confirmed entries join the normal list. |
| D-063 | superseded by D-064 | The "x" multiply row in an earlier table (see D-064). |
| D-064 | approved | The "x" tool is removed; "add one more" button (adds the unit value and 1 to the quantity) and an icon to add N pieces. |
| D-065 | approved | Those buttons lock when the value is edited directly, changed by merging, or a different amount is added with `+`. |
| D-066 | approved | Only Advanced users can unlock. |
| D-067 | approved | Quantity is a whole number. |
| D-068 | approved | Adding the same amount does not lock; a different amount locks. |
| D-069 | approved | The add-N icon auto-focuses; typing 5 adds 5 pieces. Its icon is not a multiplication sign. |
| D-070 | approved | Tax/Saving repeat stops by deleting the latest month's card; there is no stop button and no "stopped" field. |
| D-071 | approved | A Saving item stops repeating when its goal is reached, with a notification (derived from data, no field). |
| D-072 | approved | Goal notifications at 25/50/75/100% and when the goal is expected next month; never two at once. |
| D-073 | deferred | A goal for Tax. |
| D-074 | approved (future) | In the pending list, bank items come without a name (the user types it); voice/camera/card items need only confirmation; nothing is locked until it enters the normal list. |
| D-075 | approved | The same item with different importance makes two cards in one group; the group shows total value and quantity and is not edited directly. |
| D-076 | approved (AI reading) | Adding an item whose card is ignored un-ignores it and replaces (not adds) its values. |
| D-077 | approved | Undo for every action with a 5-second timer; only the last action stays undoable. |
| D-078 | approved | Editing a card's importance to match another card in the group asks for confirmation; accept merges, decline restores. |
| D-079 | approved | Advanced users may turn off merge confirmations (name and importance); undo remains for everyone. |
| D-080 | deferred | Admin features are postponed. No table prevents them; the admin's access level (aggregated or raw data) is decided when they are built. |
| D-081 | approved (design only) | Tables `items`, `month_items`, `item_merge_dismissals`, plus `skip_merge_confirm` in `user_settings`. |
| D-083 | approved, design postponed (see D-093) | Money the user adds by hand to savings is a separate list, shown in analysis, never changing month calculations. Which month it belongs to is still unanswered. |

## Conflicts between an older document and a later decision

| Topic | Older document says | Later decision says | Why it matters |
|---|---|---|---|
| Linking items (CLOSED by D-092: postponed) | `plans/20260807-saving-goal-storage-plan.md` (Item Explorer): different names are different items; the user may link any number of items by hand and the group shares one target; no automatic merge by name. | D-055: same name + same type = same item automatically. D-060: linking differently named items is ignored for now, maybe never. Master Context §15 #11 still lists "shared savings-target relationships and cardinality" as open. | If links are wanted, the database needs a link/target-group table (and the target moves from `items.target_minor` to the group). The frontend has not built it (no `linkedItemIds`/`sharedTargetId` in `src/`). The plan's `targetConfig {monthly, yearly}` is also a different idea from the single long-term `targetTotal` the frontend uses today. |

Checked against the frontend (2026-11-14) and found consistent: excluded months (`excludedFromTotals`
explicit-or-derived = `months.totals_mode`), same name + same type merge (`mergeItems`), money in
cents, stable item ids, Regular/Advanced toggle, credits/debits and Telegram bot deferred.
Undo timer: the plans say 6 s, D-077 says 5 s (already decided).
