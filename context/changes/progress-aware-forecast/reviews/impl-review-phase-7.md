<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Progress-Aware Forecast (S-07)

- **Plan**: context/changes/progress-aware-forecast/plan.md
- **Scope**: Phase 7 of 8 (commits d875176 and e3c064d, the latter the user-requested `in-progress-predecessor-not-done` rule added after the plan)
- **Reviewed phases**: 7
- **Date**: 2026-11-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — The In Progress rule is recorded only in FR-005

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/prd.md:192; src/lib/services/project.ts:595; context/foundation/roadmap.md:168
- **Detail**: e3c064d added `in-progress-predecessor-not-done` to FR-005 and the Validation Error list, but PRD Business Logic still says "In Progress is treated exactly like To Do" (true only for the forecast now) and has a Done sentence ("A Task can be marked Done only when…") with no In Progress counterpart; US-04's Acceptance Criteria and the roadmap S-07 Outcome ("edits that break the Done rules") do not mention it. The code comment at project.ts:595 cites "PRD Business Logic", which does not state the rule.
- **Fix**: Scope "treated exactly like To Do" to "for the forecast", add "A Task can be In Progress only when all its predecessors are Done" to Business Logic and an acceptance criterion to US-04, mention it in the S-07 Outcome, and cite FR-005 in the project.ts comment.
- **Decision**: FIXED

### F2 — Roadmap S-07 Risk is stale, and its Outcome says "finish dates"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/roadmap.md:168, :178
- **Detail**: The S-07 Risk still says the withheld copy "must be reworded" and that the slice "lifts" the import rejection and "adds" a golden file — all done in Phases 3 and 5. The S-07 Outcome says "sees both finish dates recalculated", a bare "finish dates" that PROJECT_RULES forbids (pre-existing, not introduced here). The version wording in the Risk is left for Phase 8.
- **Fix**: Put the done parts of the Risk in the past tense (keeping the version clause for Phase 8), and change "both finish dates" to "both Project Finish Dates" in the Outcome.
- **Decision**: FIXED

### F3 — Test plan wording: all-Done rows and `doneRows` scope

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:103, :115
- **Detail**: §6.1's parenthetical, attached to the `prdExamples` table, says an all-Done project has `all-tasks-done`, but those rows live in `allTasksDoneExamples` outside the "PRD worked examples" block (forecast.test.ts:358, :463), as test-plan:153 itself says. §6.2 calls `doneRows` "the Done rules an edit can reach", though it now also holds `in-progress-predecessor-not-done`.
- **Fix**: Move the all-Done clause out of the `prdExamples` parenthetical into a sentence naming `allTasksDoneExamples`, and call `doneRows` "the Status and completion-date rules an edit can reach".
- **Decision**: FIXED

### F4 — e2e spec header names no test-plan risk; the test-plan e2e row omits it

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: e2e/progress.spec.ts:1; context/foundation/test-plan.md:69
- **Detail**: Sibling specs cite their test-plan risk (`forecast-today.spec.ts`: "test-plan.md #4"); `progress.spec.ts` cites only "roadmap S-07 / US-04", although its risk is #4 (a wrong "today"). The test-plan row listing what e2e covers names `forecast-today.spec.ts` but not this spec.
- **Fix**: Header → "roadmap S-07 / US-04 / test-plan.md #4", and add a clause for `progress.spec.ts` to the test-plan e2e row.
- **Decision**: FIXED

### F5 — Hook table has only the direct path for the In Progress rule

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/hooks/useProject.test.ts:215-220
- **Detail**: `done-predecessor-not-done` has three hook rows (both directions and `addPredecessor`); the new rule has one (`setStatus(4, "in-progress")`). The indirect paths (reverting a Done predecessor, `addPredecessor` on an In Progress Task) are covered in project.test.ts, and test-plan §6.2 says "(via `setStatus`)" accurately. Adding them needs an In Progress Task in `doneFixture()`.
- **Fix**: Optional — leave as is; the domain tests cover every path and the hook rows prove the commit-only-on-accept behaviour, which one row already does for this rule.
- **Decision**: SKIPPED

### F6 — FR-005 lacks the "(when one is set)" START-date qualifier

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/prd.md:135 (and US-04 at :118)
- **Detail**: Business Logic and the Validation Error list now say a completion date may not be before the START date "(when one is set)"; FR-005 and the US-04 criterion still say "before the START date" unqualified, so the PRD reads two ways.
- **Fix**: Add "(when one is set)" to FR-005 and the US-04 criterion.
- **Decision**: FIXED
