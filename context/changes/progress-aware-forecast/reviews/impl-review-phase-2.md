<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Progress-Aware Forecast (S-07)

- **Plan**: context/changes/progress-aware-forecast/plan.md
- **Scope**: Phase 2 of 8
- **Reviewed phases**: 2
- **Date**: 2026-11-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence: commit bd1e1b1. All seven rule ids, their order (five in `TASK_CHECKS` after `unknown-task`, two in `PROJECT_CHECKS` after `cycle`), messages, exports and both edits match the contract; every planned test case is present (project.test.ts :516-1047, project.property.test.ts :76-145); the fixture rewrites in forecast, remaining-work, validation-warnings and diagram tests change no expected value. Inclusive bounds are right and each equal-date boundary is tested as accepted; moving the predecessor rules before `cycle` would fail the Done-cycle tests. No accepted edit path leaves a Done rule broken (`deleteTask` and `removePredecessor` only remove predecessors). Automated criteria re-run: domain tests 112/112, `npm test` 500/500, lint 0, `astro check` 0 errors / 0 warnings. Break-check at implementation time: disabling the after-today rule (4 red), the done-predecessor rule (5 red), and today in `setStatus` (9 red). Manual 2.4 and 2.5 confirmed by the user.

Benign deviations noted by the drift pass: the error-order coverage is a separate test rather than an extension of the existing one; the clear-date case uses `"  "` (trims to empty) rather than `""`; predecessor-walk tests only use fixtures whose array order equals id order (edits always append in id order). The property test's round-trip is conditional on every Task being To Do until Phase 3 lifts the import gate — Phase 3 must make it unconditional again.

## Findings

### F1 — A clock that moves backward makes every edit fail with completion-date-after-today

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project.ts:73-78 (`accept` doc), the `completion-date-after-today` Task check (~:513)
- **Detail**: `completion-date-after-today` is the first Validation Error that depends on the clock. `accept` assumes the input held no Validation Error, so the first error in the candidate is the edit's doing. If today moves backward after a Task was marked Done (clock correction, travelling west across a date line, a session left open across a time-zone change), the project already holds that error and every edit, including an unrelated rename, is rejected with it. The message names the Task and both dates, and editing that Task's completion date recovers. Import of a file exported on a later local day (a teammate east of the user) is rejected — correct per the PRD, but it will surprise.
- **Fix A ⭐ Recommended**: Document the limit in the `accept` doc comment now, and record it as a known edge case in the plan's follow-ups for Phase 7's documentation pass (PRD Business Logic / test plan).
  - Strength: Keeps the upstream "one guardian, whole-candidate check" design intact; the failure is loud, names the Task and is recoverable in one edit.
  - Tradeoff: The edge case stays user-visible, if rare.
  - Confidence: HIGH — the recovery path (setCompletionDate on that Task) goes through the same guardian and is accepted once the date is ≤ today.
  - Blind spot: Have not checked how the Phase 5 panel surfaces a rejection on an unrelated field (the alert appears next to the field the user edited, naming another Task).
- **Fix B**: Make `accept` reject only errors the input did not already hold (compare against the input's first error).
  - Strength: Unrelated edits keep working after the clock moves back.
  - Tradeoff: Breaks the aggregate invariant "a CheckedProject holds no Validation Error" and the upstream design; adds a second walk per edit.
  - Confidence: LOW — wide blast radius across every edit and the property test.
  - Blind spot: Interaction with import and the crash fallback's `validateProject`.
- **Decision**: FIXED via Fix A — limit documented in the accept doc comment; queued for Phase 7 in follow-ups/review-fixes.md

### F2 — Marking a Task Done before the START date explains a date the user never typed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project.ts `setStatus` done branch (~:377); `completion-date-before-start-date` message (~:530); project.test.ts "rejects marking a Task Done while today is before the START date"
- **Detail**: With a START date in the future, picking Done in the Status select is rejected with "Task 1: A has the completion date 2026-09-05, which is before the START date, 2026-09-06." The user did not enter a completion date; Done took today. Plan 2.4 forbids rule ids in `setStatus`, which rules out the `explain` override `addPredecessor` uses for `cycle`.
- **Fix A ⭐ Recommended**: Reword the guardian message so it reads right for every edit that can break it, e.g. "Task 1: A cannot be completed on 2026-09-05, which is before the START date, 2026-09-06." Update the plan-contract example in tests only (not the plan's Phase block).
  - Strength: No rule code enters an edit (keeps 2.4); one message serves `setStatus`, `setCompletionDate`, `setStartDate` and import.
  - Tradeoff: Departs from the plan's example wording for this rule.
  - Confidence: HIGH — one message constant and its test literals.
  - Blind spot: The completion-date-after-today wording ("has the completion date … which is after today") is left as is; it cannot be reached through `setStatus`.
- **Fix B**: Add an `explain` override in `setStatus` for `completion-date-before-start-date`, as `addPredecessor` does for `cycle`.
  - Strength: Exact wording for the Status edit ("A cannot be marked Done before the START date, …").
  - Tradeoff: Puts a Done rule id into `setStatus`, contradicting plan criterion 2.4 the user just confirmed.
  - Confidence: MEDIUM — mechanism exists, but deviates from the reviewed plan.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — message now "Task <label> cannot be completed on <date>, which is before the START date, <date>." (guardian + four test literals)

### F3 — Duration rule does not use the new inWording helper

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project.ts ~:483-489, ~:537
- **Detail**: `inWording` does exactly what the Duration check's inline ternary does, leaving two spellings of the edit/file wording.
- **Fix**: Move the Duration check onto `inWording` (the name check stays id-only).
- **Decision**: FIXED — Duration check uses inWording

### F4 — Order test title omits the Done predecessor rules

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project.test.ts, "returns the first Validation Error: Tasks in array order, then START date, project name, id ceiling and cycle"
- **Detail**: The two predecessor rules now follow `cycle`; the title no longer lists the whole order.
- **Fix**: Append "then the Done predecessor rules" to the title.
- **Decision**: FIXED — order test title now ends "…id ceiling, cycle, then the Done predecessor rules"

### F5 — findDonePredecessor's undefined guard hides the order it relies on

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project.ts ~:547
- **Detail**: `predecessor !== undefined` can never be false, because `unknown-task` runs first in `TASK_CHECKS`.
- **Fix**: Add a one-line comment that `unknown-task` has already passed, keeping the guard for the type.
- **Decision**: FIXED — comment added; guard kept for the type

### F6 — Duplicate Status vocabulary in project-file.ts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project-file.ts:235, :352
- **Detail**: `TASK_STATUSES` and `STATUS_NAMES` duplicate the new exports in project.ts. Phase 3 §1 already removes them.
- **Fix**: None now; Phase 3 as planned.
- **Decision**: ACCEPTED — left to Phase 3 §1, which removes them
