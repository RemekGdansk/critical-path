<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Capture the Task Graph (S-01)

- **Plan**: context/changes/capture-task-graph/plan.md
- **Scope**: Phase 2 of 4
- **Reviewed phases**: 2
- **Date**: 2026-09-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | WARNING |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Rule checks work per edit and cannot yet validate a whole imported project

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/lib/services/project.ts:36, src/lib/services/project.ts:58, src/lib/services/task-graph.ts:10
- **Detail**: The plan says "S-03 import reuses the same checks" (plan.md:164), but the checks as built only fit single edits. `checkTaskName` is module-private. `wouldCreateCycle` tests one proposed edge, so it can neither find a cycle already in a loaded graph nor return the cycle path S-02 must name. No rule covers file-only facts: duplicate or non-positive-integer Task ids, duplicate or unsorted `predecessors`, a predecessor id pointing to no Task, or `nextTaskId <= max(task.id)`. The last one matters for the "no silent data loss" guardrail: `createTask` trusts `nextTaskId` (project.ts:58), so a duplicate id would follow, and `replaceTask` (project.ts:46) would then overwrite every Task with that id on rename. None of this is reachable until S-03 import exists.
- **Fix A ⭐ Recommended**: Queue a follow-up for S-02/S-03 planning: add a whole-project `validateProject(project): ValidationError[]` (a whole-graph cycle check that returns the path, id and `nextTaskId` invariants, and the name rules via an exported `checkTaskName`) that import runs and the edit functions share.
  - Strength: Puts the work in the slices that own it. S-02 has to write a path-reporting cycle check anyway, and building it now would be speculative.
  - Tradeoff: The plan's claim at plan.md:164 stays only partly true until S-02/S-03 land.
  - Confidence: HIGH — the roadmap already assigns import rejection to S-03 and cycle explanation to S-02.
  - Blind spot: The S-03 plan might not read this report unless the follow-up is recorded where `/10x-plan` looks.
- **Fix B**: Export `checkTaskName` now and add `nextTaskId`/unique-id guards to `createTask`.
  - Strength: Closes the duplicate-id hazard at the source, and costs little.
  - Tradeoff: Adds defensive code for a state that edit functions alone can never produce. The S-03 import check would still be needed.
  - Confidence: MED — it helps, but it only covers part of the concern.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — queued in follow-ups/review-fixes.md for S-02/S-03 planning

### F2 — Names that look empty or span lines pass the name checks

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project.ts:36-43
- **Detail**: `trim()` does not strip U+200B and similar zero-width characters, so a name made only of them is accepted as non-empty. Internal newlines and control characters are also accepted. The toolbar `<input>` strips newlines, but a hand-edited import file would not, and the file format and diagram labels would then have to handle them.
- **Fix**: Decide in S-03 planning whether zero-width-only names and control characters become Validation Errors; no change in S-01.
- **Decision**: FIXED (fixed differently: rejected in S-01 now) — invisible-only names → `task-name-empty`; new rule `task-name-control-character` (Cc, U+2028/2029); tests, `types.ts`, PRD Validation Errors and plan Phase 2 contract updated

### F3 — Small test gaps around unexpected input

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/task-graph.test.ts
- **Detail**: Untested behaviour that already works:
  - `wouldCreateCycle` terminates on a project with a dangling predecessor id and on one that already holds a cycle. The `visited` set and `?? []` handle both, and it is the import-time scenario.
  - The task-graph queries leave their input unmutated.
  - `removePredecessor` returns the project unchanged when given a predecessor id that exists nowhere.

  Change #5's intent says "every call leaves the input unmutated", and the tests enforce that only for the edit functions.

- **Fix**: Add three short tests to `task-graph.test.ts` / `project.test.ts` pinning these behaviours.
- **Decision**: FIXED — dangling-id and existing-cycle termination test and a query no-mutation test in `task-graph.test.ts`; nonexistent-id case added to `removePredecessor` in `project.test.ts`
