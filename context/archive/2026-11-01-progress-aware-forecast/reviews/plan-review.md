<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Progress-Aware Forecast (S-07)

- **Plan**: context/changes/progress-aware-forecast/plan.md
- **Mode**: Deep
- **Date**: 2026-11-01
- **Verdict**: REVISE → SOUND after triage
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

19/19 paths ✓, 10/10 symbols ✓, line refs ✓, brief↔plan ✓, Progress↔Phase ✓ (8/8 phases, 37/37 rows)

## Findings

### F1 — Done-rule messages hide the cycle message (US-01 regression)

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details (check ordering); Phase 2 §1
- **Detail**: The guardian checks every Task against `TASK_CHECKS` before running `PROJECT_CHECKS`, and `cycle` is the last `PROJECT_CHECKS` entry (`project.ts:421-433`). With `done-predecessor-not-done` and `completion-date-before-predecessor` in `TASK_CHECKS`, an `addPredecessor` that closes a cycle through a Done Task reports a Done rule instead of the cycle. Two examples: A Done, B To Do depending on A, `addPredecessor(A, B)` → `done-predecessor-not-done`; A Done 09-03 and B Done 09-05 → `completion-date-before-predecessor`. This breaks US-01 and FR-003 (`prd.md:73-75, :131`).
- **Fix**: Move the two predecessor rules into `PROJECT_CHECKS` after `cycle`, each walking the Tasks in array order. Add edit and error-order rows proving a cycle through Done Tasks reports `cycle`.
  - Strength: Rules stay in one guardian location; cycles always win.
  - Tradeoff: The wording changes from seven `TASK_CHECKS` entries to five plus two `PROJECT_CHECKS` entries.
  - Confidence: HIGH — both examples traced through `firstValidationError`.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — Phase 1 caller list misses Planner.tsx and task-graph.test.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §4–6
- **Detail**: `Planner.tsx:24-28` (`initialProject()`) calls `createPerfProject()` and `createEmptyProject()`. `task-graph.test.ts:208` calls `createPerfProject()`. `useProject.ts:74` passes `createEmptyProject` by reference as the lazy initializer, so it must become a closure.
- **Fix**: Add `Planner.tsx` to §5 and `task-graph.test.ts` to §6, and name the `useProject.ts:74` closure in §4.
- **Decision**: FIXED

### F3 — Planner view tests run on the real clock, which the plan doesn't say

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 §6 (Planner)
- **Detail**: `PlannerProps` has no `today`, and Planner calls `useProject` without options, so in a Planner render the edits, the Completion date `max` and the forecast all use the real clock. A Done fixture needs a past START date, so the far-future-START workaround of test-plan §6.2 does not apply. An after-today message embeds the real date.
- **Fix**: State in Phase 5 §6 that Planner tests assert only clock-free text (rule fragments and the "B, Done on " prefix). The fixed-clock case stays in Phase 7's e2e.
- **Decision**: FIXED

### F4 — `project-file-0.1-statuses.json` pins a file shape that never ships

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 §2; Phase 8 §3; Migration Notes
- **Detail**: Phases 3–8 land on one branch, so no deployed build ever writes a `"0.1"` file with Statuses. After Phase 8, the statuses golden would stay permanently as an import assertion for a shape no user can have.
- **Fix**: Phase 8 deletes `project-file-0.1-statuses.json` and its tests; `project-file-1.0.json` covers the same fields byte for byte.
- **Decision**: FIXED

### F5 — The all-Done StartPanel note says "this date" when START is unset

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1 (reason order); Phase 5 §4
- **Detail**: `all-tasks-done` is decided before `start-date-unset`. With START unset and every Task Done, the note "Every Task is Done, so this date no longer affects the forecast." appears under an empty field.
- **Fix**: Add the wording "Not set. Every Task is Done, so the START date does not affect the forecast." for the unset case, with a StartPanel row.
- **Decision**: FIXED
