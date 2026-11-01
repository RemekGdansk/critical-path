---
change_id: progress-aware-forecast
title: Progress aware forecast
status: implemented
created: 2026-11-01
updated: 2026-11-01
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Phase 6 diagram decisions taken at manual review (2026-11-01), departing from the plan's node contract: an In Progress node shows a dashed-circle icon and `--foreground` text instead of the suffix " · In Progress", which did not fit beside a weekdays Duration (the words stay in the tooltip and the accessible name); a selected Task keeps its state colour (warned, critical, Done, plain) and selection thickens it to a 3px ring in that colour instead of the uniform `--primary` selection. The app ships no dark mode, so the `--done` dark value was not checked rendered.
- Rule added after the plan, at the Phase 7 manual review (2026-11-01): a Task can be In Progress only when all its predecessors are Done (`in-progress-predecessor-not-done`, a `PROJECT_CHECKS` entry after `done-predecessor-not-done`, so a cycle through an In Progress Task is still reported as the cycle). Direct and indirect edits that break it are rejected naming both Tasks, and so are files that hold it. Recorded in the PRD (FR-005 and the Validation Error list), the glossary Status row and the test-plan §6.2 hook-row list.
