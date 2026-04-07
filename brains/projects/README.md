---
type: meta
tags: [projects, meta]
created: "2026-04-06"
updated: "2026-04-06"
---

# Project Brains

Project brains are created per active project. They are the living memory of a project — updated by agents as work progresses, and read by agents at task start to orient quickly.

## What a Project Brain Contains

- **What the project is** — one paragraph summary, no jargon.
- **Current status** — active, paused, milestone name, what's in flight.
- **Current milestone** — what we're working toward right now.
- **Open questions** — unresolved decisions that any agent might need to address.
- **Key decisions made** — choices that are no longer open; include the rationale so future agents don't re-litigate them.
- **Relevant file paths** — key entry points in the codebase for this project's work.

## Agent Protocol

**At task start:** Read `context.md` for your project. Incorporate any open questions or recent decisions into your approach.

**At task end:** Update `context.md` with:
- Any decisions you made during the task.
- Resolution of open questions you addressed.
- New open questions that surfaced.
- Status update if the milestone has changed.

This is how the system improves. Skipping the update at task end breaks the knowledge loop.

## File Convention

Each project lives in `brains/projects/<project-name>/`:
- `README.md` — (optional) brief intro linking to external resources.
- `context.md` — the live project brain. Agents read and write this file.
