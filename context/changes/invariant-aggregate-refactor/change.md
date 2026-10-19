---
change_id: invariant-aggregate-refactor
title: Invariant aggregate refactor
status: impl_reviewed
created: 2026-10-19
updated: 2026-10-19
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Phase 3: guardian cost (2026-10-19)

One `setDuration` on `createPerfProject()` (100 Tasks, 165 dependencies), with the guardian running `assertModelShape` and the whole rule list: median 0.015 ms, p99 0.040 ms, max 0.090 ms over 2000 runs after 200 warm-up runs (Vitest, Node 24, Apple Silicon). That is under 0.05% of the 200 ms NFR (`prd.md:182`), so no incremental checking is needed.

### Phase 5: mutation review (2026-10-19)

Stryker on `src/lib/services/project.ts:64-438` (the guardian, `assertModelShape` and the rule list), with the vitest-runner patched locally as `PROJECT_RULES.md` describes: 85 killed, 7 survived, 0 without coverage. Survivors, reviewed one by one (lines as in the file at c6fccf6):

| #   | Line | Mutant                                                  | Verdict                                                                                                                                                                                                                               |
| --- | ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | 64   | `wording = "edit"` → `""`                               | Equivalent: every check tests `wording === "file"`, so `""` behaves as `"edit"`.                                                                                                                                                      |
| 10  | 68   | `explain?.[error.rule]?.()` → `explain?.[error.rule]()` | Unreachable from a `CheckedProject`: only `addPredecessor` explains, and from checked input its only possible error is `cycle`. Not user-visible.                                                                                     |
| 17  | 338  | `lastId !== undefined` → `true`                         | Equivalent: `task.id <= undefined` is false.                                                                                                                                                                                          |
| 29  | 344  | `i > 0` → `true`                                        | Equivalent: `id <= undefined` is false.                                                                                                                                                                                               |
| 30  | 344  | `i > 0` → `i >= 0`                                      | Equivalent, as #29.                                                                                                                                                                                                                   |
| 46  | 351  | `lastId !== undefined` → `true`                         | Equivalent: `nextTaskId <= undefined` is false.                                                                                                                                                                                       |
| 33  | 344  | `id <= prev` → `id < prev`                              | Was a gap: no test held a duplicate predecessor. Killed by the "a duplicate predecessor" row added to the guardian's model-shape table in `project.test.ts` after the implementation review (checked by applying the mutant by hand). |

### Follow-up: an impossible START date clears the date (found 2026-10-19, pre-existing)

Found during Phase 3 manual verification; not caused by this change (`StartPanel.tsx` last changed in S-06). Chromium's native date input reports `""` for an impossible date: typing 2026, 02, 30 gives the values `2026-02-02`, `2026-02-03`, `""`. `StartPanel` commits that `""` on Enter or blur (`src/components/planner/StartPanel.tsx:58-65`, `:103-106`), and `setStartDate("")` clears the START date. So a valid START date is lost without a message, and `start-date-not-a-date` is never reached from the panel; it is reachable only through the hook (`src/hooks/useProject.test.ts:125`) and import. Suggested fix, as its own change: when the field's `validity.badInput` is true (an impossible or partly filled date, but not one with every segment emptied), keep the date and show the START date message instead of committing `""`. Pin it first with a jsdom `StartPanel` test.

Fixed in change `impossible-date-should-not-clear-previous`.
