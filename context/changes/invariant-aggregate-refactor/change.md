---
change_id: invariant-aggregate-refactor
title: Invariant aggregate refactor
status: implementing
created: 2026-10-19
updated: 2026-10-19
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Phase 3: guardian cost (2026-10-19)

One `setDuration` on `createPerfProject()` (100 Tasks, 165 dependencies), with the guardian running `assertModelShape` and the whole rule list: median 0.015 ms, p99 0.040 ms, max 0.090 ms over 2000 runs after 200 warm-up runs (Vitest, Node 24, Apple Silicon). That is under 0.05% of the 200 ms NFR (`prd.md:182`), so no incremental checking is needed.

### Follow-up: an impossible START date clears the date (found 2026-10-19, pre-existing)

Found during Phase 3 manual verification; not caused by this change (`StartPanel.tsx` last changed in S-06). Chromium's native date input reports `""` for an impossible date: typing 2026, 02, 30 gives the values `2026-02-02`, `2026-02-03`, `""`. `StartPanel` commits that `""` on Enter or blur (`src/components/planner/StartPanel.tsx:58-65`, `:103-106`), and `setStartDate("")` clears the START date. So a valid START date is lost without a message, and `start-date-not-a-date` is never reached from the panel; it is reachable only through the hook (`src/hooks/useProject.test.ts:125`) and import. Suggested fix, as its own change: when the field's `validity.badInput` is true (an impossible or partly filled date, but not one with every segment emptied), keep the date and show the START date message instead of committing `""`. Pin it first with a jsdom `StartPanel` test.
