# Plans

The shared memory of the project: what we want to build, how we decided, and the plan for each
piece of work. Read the relevant plans before you start (they are short).

## Anatomy of `plans/`

```text
plans/
├── README.md             this file
├── rules/                how to work
│   ├── general-rules.md      the product owner's working rules
│   └── Template-of-plans.md  the template every plan follows
├── project-idea/         the product idea and scope
│   ├── idea-v1.md
│   └── idea-v2.md
├── decisions/            every D-number and how decisions are written
│   ├── README.md
│   └── decision-log.md
├── plans-Frontend/       plans about Qeeva-Frontend
└── plans-Backend/        plans about Qeeva-Backend
```

Two older plans sit directly under `plans/` (`20260522-excluded-months-map.md`,
`20260807-saving-goal-storage-plan.md`). They stay as they were written. **New plans never go
there.**

## Writing a plan

1. **Place.** `plans/plans-Frontend/` for work on the frontend, `plans/plans-Backend/` for work on
   the backend. If a task needs both, write one plan in each folder.
2. **Name.** `YYYYMMDD-short-title.md`.
3. **Frontmatter.** `title`, `author`, `date` (`YYYY-MM-DD`) and `status`:
   `draft` (being written) · `proposed` (waiting for the product owner) · `approved` (go) ·
   `done`.
4. **Sections, in this order.** TL;DR · Steps (checkboxes) · Relevant files · Verification ·
   Decisions.
5. **Decisions section.** List D-numbers (`D-087`), never copy their text; the text lives only in
   `decisions/decision-log.md`.
6. **Updating.** Prefer a new dated plan over rewriting a plan another tool wrote. Tick steps
   and set `status` when work is done.

The full template is `rules/Template-of-plans.md`.

## Which source wins

1. The Master Context, Engineering Rules and Discovery Protocol (the product owner's files from
   chat, not in Git).
2. `decisions/` and `Qeeva-Backend/docs/database/schema-blueprint.md`.
3. Everything else in this folder, then the `Foundation Build Plan` and the `description` file.

Some older plans say "no test files" or "SimpleJWT". Those are older than the decisions above;
the backend now requires tests (D-001) and uses Supabase Auth (D-085).

## Who may change what

The AI may add and update `.md` files here (D-091). It does not change frontend decisions without
asking. Scope and features are the product owner's decision.
