# Decision log

Every D-number of Qeeva, one row each. How a decision is written and changed: see `README.md`
in this folder. This file is the **single source of truth** for D-numbers (D-098).

Recovered on 2026-11-14 from the saved copy of the whole working conversation (every message and
tool call in it, 1,349 entries, from 2026-11-08 on), because chat is not a safe place to keep
decisions (Engineering Rules §35). One line per decision, in English. The user's own words were
Arabic; wording here is a faithful summary, not a new decision.

**Numbers:** D-001 to D-101 are used. **Next free number: D-102.** Never reuse or renumber one.

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
| D-093 | proposal, waiting for the user's yes | Manual savings (D-083): do not build now. Design them later together with debit/credit (gifts, money from someone), because both are money moving outside the monthly cards. The user's idea: optional title, attached to a month, useful for analysis. Today's frontend stores one number per month (no title, no date). |
| D-094 | approved (user's guess, 2026-11-14) | No `category` column. Never decided in any D-number; the frontend field is a pass-through leftover; "importance" (want/must/emergency/gift) is the only classification. Reversible. |
| D-095 | approved (user, 2026-11-14) | One-time permission to update the root `AGENTS.md`. Done in patch 0009. Not a standing permission. |
| D-096 | approved (user, 2026-11-14) | After the backend work there is a planned alignment phase between frontend and backend, done carefully so old work is not broken and production is not delayed. See `plans/plans-Backend/20261114-frontend-backend-alignment.md`. |
| D-097 | proposal, waiting for the user's yes | Do not add `is_reducible` to `month_items` now. No frontend logic uses `isReducible` yet; the rule "which saving items shrink" is still open (Master Context section 15 #13). Adding the column later is a small migration. |
| D-098 | approved (user, 2026-11-14) | The decision log lives in `plans/decisions/` (this folder), not in `Qeeva-Backend/docs/database/`. It is the single source of truth for D-numbers. It sits inside `plans/` but ranks **above** the rest of `plans/` (see `README.md`). The old path keeps a one-line pointer so earlier links still work. |
| D-099 | approved (user, 2026-11-14) | Permission to update the file in `.cursor/` that describes how plans are laid out: `.cursor/rules/00-monorepo.mdc`. It is the twin of the root `AGENTS.md`. Done in patch 0010: the plans anatomy was added, and the stale lines inside that same file ("SimpleJWT", "do not add test files") were aligned with the root `AGENTS.md`. This covers only that file; the other `.cursor` and `.github` files are listed under D-101. |
| D-100 | approved (user, 2026-11-14) | When the user says "read all `.md` files", the AI reads **every** `.md` and `.mdc` file in the repository, including everything under `.cursor/` and `.github/`, and never answers that it did not read them. If it had not, it reads them then. Written into `Qeeva-Backend/AGENTS.md`. |
| D-101 | proposal, waiting for the user's yes | Fix the agent and documentation files outside `Qeeva-Backend/` that describe things that no longer exist. **Backend side:** `.cursor/rules/backend-django.mdc`, `.cursor/skills/backend-senior/SKILL.md`, `.github/agents/backend-senior.agent.md` and the backend lines of the root `README.md` still say SimpleJWT, SQLite, `apps/authentication`, `apps/core_finance`; the root `AGENTS.md` still points at the old decision-log path. **Frontend side (paths only, no behaviour):** `Qeeva-Frontend/AGENTS.md`, `AGENT_ONBOARDING.md`, `README.md`, `.cursor/rules/frontend-angular.mdc` and `.cursor/skills/frontend-senior/SKILL.md` name `core/...` folders that do not exist (the real ones are under `src/app/@SERVICES/`), and two files give the auth API as `http://localhost:8000/api/auth`. A Cursor agent is told the wrong stack today. Nothing is changed until the user says yes. |

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

## Finance (approved design, NOT built yet; see `schema-blueprint.md`)

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
