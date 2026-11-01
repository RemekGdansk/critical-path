<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Progress-Aware Forecast (S-07)

- **Plan**: context/changes/progress-aware-forecast/plan.md
- **Scope**: Phase 3 of 8
- **Reviewed phases**: 3
- **Date**: 2026-11-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — One not-supported-yet row became a rejection row, and extra rows were added

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/services/project-file.test.ts:366-396, :524, :241
- **Detail**: The plan says the not-supported-yet rows "become accepted-import and round-trip rows". Two did, but the third (a completion date on a To Do Task) is now the `completion-date-without-done` rejection row, because with the gate gone that file holds a Validation Error. The plan did not list a `markDone` helper, accepted rows for a same-day Done chain and a Done Task completed on TODAY, or a "holds no Validation Warning" test on the golden statuses file. All of these are additive and pin real rules.
- **Fix**: Accept as is. The conversion follows from Phase 2's `completion-date-without-done`, and the extra rows are boundary cases of the Done rules.
- **Decision**: ACCEPTED — the conversion follows from Phase 2's `completion-date-without-done`; the extra rows stay.

### F2 — No import row for a Done Task with the START date unset, or a weekend completion date in weekdays mode

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/services/project-file.test.ts:362-400 (status rows)
- **Detail**: Two cases the plan's "What We're NOT Doing" decides are not imported in any row: no START-date bound on completion dates while the START date is unset, and a Saturday or Sunday completion date allowed in weekdays mode. Neither can crash today, because no consumer reads `completionDate` yet. They matter once Phase 4's `all-tasks-done` base date reads completion dates (Phase 4 plans the weekdays Saturday row in forecast.test.ts, but not through import). `imported()` runs `forecast()` on every accepted row, so adding them would also prove the forecast does not throw on them.
- **Fix**: Add two accepted round-trip rows: a Done Task with no START date, and a weekdays file with a Saturday completion date.
- **Decision**: FIXED — accepted round-trip rows for a Done Task with the START date unset and a Saturday completion date in weekdays mode.

### F3 — Two domain documents not scheduled for the Phase 7 docs pass still name the removed rule

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/domain/01-domain-distillation.md:74, :122; context/domain/02-invariant-aggregate-refactor.md:103, :333, :382
- **Detail**: Phase 7 updates the PRD, glossary, test plan and roadmap, all of which still mention `task-status-not-supported-yet`. The domain distillation and the upstream aggregate design also reference it, and no phase lists them. They may be meant as point-in-time records, in which case they should stay as written.
- **Fix**: Queue a Phase 7 follow-up: decide whether these two documents are snapshots (leave them) or living documents (update them).
- **Decision**: FIXED — queued as a Phase 7 follow-up in `follow-ups/review-fixes.md`.

### F4 — Between Phase 3 and Phase 5, an imported Done Task cannot be shown or changed in the UI

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project-file.ts:351-360 (importProject)
- **Detail**: A file with Done or In Progress Tasks now imports, but the side panel and diagram show no Status until Phases 5 and 6. A Done Task's Duration drops out of the forecast with no visible reason, and a START-date edit can be refused with `completion-date-before-start-date` naming a Task whose completion date the user cannot edit yet. This is expected for a mid-slice branch and harmless as long as the branch is not merged or deployed before Phase 5.
- **Fix**: None in code. Do not merge `progress-aware-forecast` before Phase 5 lands.
- **Decision**: ACCEPTED — do not merge the branch before Phase 5 lands.

### F5 — The stage-order test has no control assertion

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/services/project-file.test.ts:921-928
- **Detail**: The test holds a duplicate id and a Done-rule break and expects `duplicate-task-id`. It never shows that the same file without the duplicate fails on a Done rule, so if the Done-rule break silently stopped being one, the test would still pass while proving less. The break is obvious (Task 2 Done with no completion date and a not-Done predecessor), so the risk is small.
- **Fix**: Add one assertion: the same file with the duplicate removed is rejected with `done-without-completion-date`.
- **Decision**: FIXED — control assertion: the same file without the duplicate is rejected with `done-without-completion-date`.
