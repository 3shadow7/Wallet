---
title: "Initial Plans Folder and Template"
author: assistant
date: 2026-03-23
status: draft
---

TL;DR: Create a `plans/` folder to store all project plans. This initial plan documents conventions and provides a template for future plans.

Steps
1. Create `plans/` folder at repository root and add this README and initial plan. (done)
2. Use naming convention `YYYYMMDD-short-title.md`.
3. When asked to create a plan that requires new files, the assistant will create them under `plans/` and populate frontmatter.

Relevant files
- `plans/README.md` — folder guidance and workflow.

Verification
- Confirm `plans/` contains `README.md` and plan files.

Decisions
- Files are created in the working tree; assistant will ask before committing or opening PRs.

Template for future plans

Title: {Human readable title}

Metadata (frontmatter)
- title: "{Title}"
- author: "{Assistant name}"
- date: "YYYY-MM-DD"
- status: "draft|proposed|approved|done"

Body
- TL;DR
- Steps
- Relevant files
- Verification
- Decisions
