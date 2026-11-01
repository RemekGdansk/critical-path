---
change_id: progress-aware-forecast
title: Progress aware forecast
status: impl_reviewed
created: 2026-11-01
updated: 2026-11-01
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Phase 6 diagram decisions taken at manual review (2026-11-01), departing from the plan's node contract: an In Progress node shows a dashed-circle icon and `--foreground` text instead of the suffix " · In Progress", which did not fit beside a weekdays Duration (the words stay in the tooltip and the accessible name); a selected Task keeps its state colour (warned, critical, Done, plain) and selection thickens it to a 3px ring in that colour instead of the uniform `--primary` selection. The app ships no dark mode, so the `--done` dark value was not checked rendered.
