<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Edit-Rejection Atomicity and the Withheld Forecast

- **Plan**: context/changes/testing-edit-rejection-atomicity/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Every planned item matches; every factual claim in test-plan §2, §3, §4, §5, §6.2 and §6.5 was checked against the two test files, `npm ls`, `npx vitest run` (12 files, 324 tests) and `vitest related`. No production code under `src/` changed; the new dependencies are dev-only and accept Node 24.21.0. Both jsdom files run with clean stderr (no `act` or React warnings). Automated criteria re-run on 2026-10-13: prettier check and the full pre-push gate pass.

## Findings

### F1 — Testing paragraph still opens "Vitest runs pure domain logic" and says today is never read from the clock

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: PROJECT_RULES.md:57
- **Detail**: The plan's intent was to stop the rules saying Vitest runs only pure logic. The new jsdom sentence is there, but the paragraph's opening sentence is unchanged, and "'today' is always passed in, never read from the clock" is not true of `Planner.test.ts` (Planner reads the clock; the test neutralises it with a far-future START, documented only in §6.2).
- **Fix**: Reword the opening to "Vitest runs pure domain logic, static renders and jsdom state and view tests." and add "(a `Planner` render reads the clock, so its fixture uses a far-future START date, §6.2)" after the clock clause.
- **Decision**: FIXED — opening now covers static renders and jsdom state and view tests; the clock clause points to the far-future START date (§6.2).

### F2 — Phase 5 "Stated limit" bullet still says the planner-state half checks nothing

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:170
- **Detail**: The Phase 2 note (§6.5) marks this limit Closed, but a reader landing on the Phase 5 bullet alone reads "an edit to `src/hooks/useProject.ts` finds no related test", which is now false.
- **Fix**: Append "Closed by §3 Phase 2 (2026-10-12)." to the bullet, keeping the dated history.
- **Decision**: FIXED — appended "Closed by §3 Phase 2 (2026-10-12)." to the Phase 5 Stated limit bullet.

### F3 — `textOf` strips tags from `innerHTML` without decoding entities

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Planner.test.ts:122-127
- **Detail**: A future fixture with `&`, `<` or a non-breaking space in the forecast region would be compared as `&amp;` etc. Today's fixtures ("A", "B", ISO dates) are unaffected. (Also noted, no action: `expect(await findByRole(...)).toBeDefined()` is redundant since `findByRole` throws; the shim's `scale` regex captures one character, harmless at zoom 1, copied from React Flow's docs.)
- **Fix**: Leave as is until a fixture needs it; if changed, join the text nodes (`TreeWalker` over `SHOW_TEXT`) with spaces instead of regex-stripping `innerHTML`.
- **Decision**: FIXED — `textOf` joins the region's text nodes (`TreeWalker`, `SHOW_TEXT`) with spaces. Planner test 3/3; red with the forecast memo deps set to `[today]`, restored, green.
