# Decision log

Recovered on 2026-11-14 from the working conversation, because chat is not a safe place to keep
decisions (Engineering Rules §35). One line per decision, in English. The user's own words were
Arabic; wording here is a faithful summary, not a new decision.

**Status:** approved = the user confirmed it · proposal = not confirmed · superseded = replaced
(kept for history) · deferred = idea saved for later.

**IDs not recovered:** D-007, D-008, D-010, D-011, D-043. They were assigned in the conversation
but their text could not be found. Do not reuse these numbers; add them here if they turn up.

## Process and scope

| ID | Status | Decision |
|---|---|---|
| D-001 | approved | On conflict, Master Context + Engineering Rules win over the Foundation Build Plan and `description`. (So tests ARE written.) |
| D-002 | approved | First goal is the database design. The AI asks about the idea, fills gaps, corrects misunderstandings, and writes no table before approval. |
| D-005 | approved | Build tables one by one, starting with `profiles`. One question per step with options and a recommendation. |
| D-006 | proposal | Archive the legacy backend outside Git and migrate nothing. (Done in practice: commit 1 started a fresh Django project.) |
| D-019 | approved | The table map is only a starting point; each table is reviewed when reached. |
| D-084 | approved | Nothing changes in Supabase without explicit final approval for each change; always `qeeva-dev` first. |
| D-085 | approved | Django owns the schema (migrations). Supersedes an earlier AI proposal (Supabase-first). |
| D-086 | approved, changed | User first chose "connect GitHub write access first", then changed his mind: the AI rebuilds commit 2 and delivers a patch; the user pushes. |
| D-087 | approved (user delegated the choice, 2026-11-14) | Option A for RLS: RLS on every table with no policies plus revoked privileges for `anon`/`authenticated`; Django connects as the owner and filters by owner through `for_user`. Per-request RLS (option B) may be added later by migration. Option C (frontend talks to Supabase data directly) rejected: it conflicts with D-085. |
| D-088 | approved (2026-11-14) | Database tests run on PostgreSQL 17 (same major as Supabase) in Docker locally, and in GitHub Actions on every push. The workflow file lives at `.github/workflows/backend-ci.yml`, the only approved file outside `Qeeva-Backend/`. |
| D-089 | AI choices, please review | Account tables: (a) deleting a Supabase user cascades to `profiles` and `user_settings` in SQL, but `username_reservations` rows survive with `previous_owner_id` cleared; (b) no unique constraint on a reserved name (the same name may be reserved again later; availability is decided in the username service); (c) time zone validity is checked in Python (IANA names), the database only forbids an empty value; (d) all choice columns are `text` with CHECK constraints. |
| D-091 | approved (user statement, 2026-11-14) | Files the user gave in chat (Master Context, Engineering Rules, Discovery Protocol) come after the `plans/` folder and override it. The AI may add and update `.md` files in `plans/` and in `Qeeva-Backend/`. Backend plans follow the plan template in `plans/plans-Backend/`. |
| D-090 | approved (restated by the user, 2026-11-14) | Qeeva is a money **log** for money management, not a payments or banking product. Consistent with D-032. |

## Product

| ID | Status | Decision |
|---|---|---|
| D-003 | approved | A month holds items; each item has a name, a price and a quantity. No per-purchase dates now; dated transactions are a separate future feature. |
| D-004 | superseded by D-046, D-055 | Name-based suggestion and merging rules. |
| D-009 | approved | "Hours of life" (price of an item expressed in working hours) is a core idea of the product. |
| D-012 | approved | An item is money **already spent** ("apple = 488" means 488 was spent), not a plan. |
| D-013 | deferred | Two ideas postponed (details later). |
| D-014 | approved | The user never picks a day; the month is enough. The app stores the entry time automatically in the background. |
| D-015 | approved | Principle: speed and simplicity first; adding an expense takes as few fields as possible. |
| D-016 | approved | A Saving item is money the user wants to save from this month's income for a goal; its long-term target is optional. |
| D-017 | approved | Tax is a real expense and appears automatically in every new month. |
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
| D-029 | superseded by D-033 | Currency as a per-card name, no conversion. |
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
| D-063 | superseded | The "x" multiply row in an earlier table (see D-064). |
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
| D-080 | deferred | Admin features. |
| D-081 | approved (design only) | Tables `items`, `month_items`, `item_merge_dismissals`, plus `skip_merge_confirm` in `user_settings`. |
| D-083 | approved | Money the user adds by hand to savings is a separate list, shown in analysis, never changing month calculations. Which month it belongs to is still unanswered. |

## Open conflicts (older document vs a later decision; user asked 2026-11-14, answer pending)

| Topic | Older document says | Later decision says | Why it matters |
|---|---|---|---|
| Linking items | `plans/20260807-saving-goal-storage-plan.md` (Item Explorer): different names are different items; the user may link any number of items by hand and the group shares one target; no automatic merge by name. | D-055: same name + same type = same item automatically. D-060: linking differently named items is ignored for now, maybe never. Master Context §15 #11 still lists "shared savings-target relationships and cardinality" as open. | If links are wanted, the database needs a link/target-group table (and the target moves from `items.target_minor` to the group). The frontend has not built it (no `linkedItemIds`/`sharedTargetId` in `src/`). The plan's `targetConfig {monthly, yearly}` is also a different idea from the single long-term `targetTotal` the frontend uses today. |

Checked against the frontend (2026-11-14) and found consistent: excluded months (`excludedFromTotals`
explicit-or-derived = `months.totals_mode`), same name + same type merge (`mergeItems`), money in
cents, stable item ids, Regular/Advanced toggle, credits/debits and Telegram bot deferred.
Undo timer: the plans say 6 s, D-077 says 5 s (already decided).
