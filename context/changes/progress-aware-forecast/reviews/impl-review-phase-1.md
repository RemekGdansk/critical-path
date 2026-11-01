<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Progress-Aware Forecast (S-07)

- **Plan**: context/changes/progress-aware-forecast/plan.md
- **Scope**: Phase 1 of 8
- **Reviewed phases**: 1
- **Date**: 2026-11-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Evidence: commit 666d1d4. Every planned signature matches the Phase 1 contract (`EditContext` at `project.ts:59`, all nine edits plus `createEmptyProject`, `checkProject`, `toCheckedProject`, `validateProject`, `parseProjectFile`, `createPerfProject`). A token diff of every test file before and after the commit with context arguments stripped shows no assertion or expected value changed. The hook reads the clock in `apply` at edit time (`useProject.ts:118`), not at mount, and action identities stay stable. Automated criteria re-run on the commit: lint 0, `astro check` 0 errors, 463/463 tests, build + `check:csp` pass (2 pages), the clock grep finds nothing. Manual 1.6 was confirmed by the user before the commit.

## Findings

### F1 — Today reaches Task checks and project checks two different ways

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project.ts:403, :458-462
- **Detail**: `TaskCheck` receives `ProjectIndex` (which now carries `today`), while `ProjectCheck` receives `(project, context, wording)`. The same value arrives by two routes. Phase 2 puts `done-predecessor-not-done` and `completion-date-before-predecessor` into `PROJECT_CHECKS`, and both need `tasksById`, which only the index has, so the `ProjectCheck` signature has to change in Phase 2 anyway.
- **Fix**: Make `ProjectCheck` `(index: ProjectIndex, wording: Wording)` and pass the index built in `firstValidationError`; existing lambdas destructure `{ project }`. Do it as the first step of Phase 2.
- **Decision**: FIXED — ProjectCheck now takes (index: ProjectIndex, wording); the project checks read { project } from it

### F2 — Planner and the import/New/crash-fallback doors read the clock without a test seam

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/planner/Planner.tsx:25, :65, :125; src/components/planner/ProjectControls.tsx:152, :159, :192; src/components/planner/RenderCrashFallback.tsx:43
- **Detail**: Five view sites build `{ today: todayIsoDate(new Date()) }` inline, and Planner calls `useProject` without `options`, so a Planner render test cannot pin today. This is what the plan prescribes (Phase 1 §5; Phase 5 §6 says Planner has no `today` prop, its Done fixture uses a past START date, and its assertions use only clock-free text, with the fixed-clock case in Phase 7's e2e). Noted so Phase 5 keeps to that discipline; the existing far-future-START Planner fixture must not be reused for a "mark Done" test, since a real-clock completion date would be before its START date.
- **Fix**: No change now; follow Phase 5 §6 as planned.
- **Decision**: ACCEPTED — keep the plan approach (no Planner today prop); Phase 5 builds a new past-START Done fixture with clock-free assertions. Queued in follow-ups/review-fixes.md

### F3 — ForecastSummary.test.ts uses two different todays

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/ForecastSummary.test.ts
- **Detail**: The new edit `CONTEXT` uses today 2026-09-05, while `renderedMarkup` defaults its forecast today to 2026-08-20. Harmless while no rule reads today; once Phase 2's Done rules do, a fixture accepted at one today and forecast at another can disagree.
- **Fix**: Align the two todays (or derive the forecast today from `TODAY`) when Phase 5 adds the all-Done and `start-successors-done` renders.
- **Decision**: ACCEPTED — deferred to Phase 5: align the edit and forecast todays in ForecastSummary.test.ts. Queued in follow-ups/review-fixes.md

### F4 — Per-file TODAY constants

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: ~15 test files
- **Detail**: Each test file defines its own `TODAY = "2026-09-05"` and `CONTEXT` (project-file.test.ts keeps its existing `2026-10-11`). This matches the per-file fixture convention already in use (local `accepted`, `A_ID`), so no action is needed; Phase 2 cases may choose their own today per case.
- **Fix**: None.
- **Decision**: ACCEPTED — no change; matches the per-file fixture convention
