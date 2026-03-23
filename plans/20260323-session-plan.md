---
title: "Session Canonical Plan"
author: assistant
date: 2026-03-23
status: draft
---

## Plan: Plans Folder Setup

TL;DR: Create a dedicated `plans/` folder in the repository (default) to store all plan files. Assistant will create new plan files there when asked; session-canonical plan copies remain at /memories/session/plan.md.

**Steps**
1. Decide folder location: default `plans/` at repository root (*awaiting confirmation*).
2. Naming convention: `YYYYMMDD-short-title.md` and frontmatter keys: `title`, `author`, `date`, `status`.
3. When asked to create a plan that requires new files, the assistant will create the markdown file under `plans/` and populate it per the template below.
4. For ephemeral or in-progress plans, the assistant will also save/update `/memories/session/plan.md` as the canonical working copy.
5. On approval, the assistant can create the folder and an initial `plans/README.md` in the repository (this requires permission to edit workspace files and to commit if desired).

**Relevant files**
- `/memories/session/plan.md` — canonical session plan (this file).
- `plans/` — repository folder to store plan files (to be created in workspace on approval).

**Verification**
1. Confirm `plans/` exists in repository and contains at least `README.md`.
2. Create a sample plan `plans/{date}-example-plan.md` and verify metadata and content.

**Decisions**
- Default: store plans in repository `plans/` folder, Markdown files with frontmatter.
- Assistant role: create files under `plans/` only after your approval to modify the repo.

**Further Considerations**
1. Do you want plan files committed to git automatically when created? (Yes/No)
2. If No, should the assistant create files but not commit, or propose PRs instead?

---

Template for new plan files (assistant will populate):

Title: {Human readable title}

Metadata:
- title: "{Title}"
- author: "{Assistant name}"
- date: "YYYY-MM-DD"
- status: "draft|proposed|approved|done"

Body:
- TL;DR
- Steps
- Relevant files
- Verification
- Decisions
