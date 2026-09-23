1. place :
`plans/plans-Frontend` — for plan that work at Front-end side.
`plans/plans-Backend` — for plan that work at Back-end side.
if required both then create a plan for each folder.
2. name :
Use naming convention `YYYYMMDD-short-title.md`.
3. think :
When asked to create a plan that requires new files, the assistant will create them under `plans/` and populate frontmatter.

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
