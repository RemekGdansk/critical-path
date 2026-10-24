<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Invariant Aggregate Refactor

- **Plan**: context/changes/invariant-aggregate-refactor/plan.md
- **Mode**: Deep
- **Date**: 2026-10-19
- **Verdict**: REVISE (SOUND after fixes)
- **Findings**: 1 critical, 1 warning, 5 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | FAIL    |
| Blind Spots           | PASS    |
| Plan Completeness     | WARNING |

## Grounding

8/8 paths ✓, 6/6 symbols ✓, brief↔plan ✓, Progress↔Phases ✓. Verified: no existing test applies an edit to a hand-built Project; import's normalise and unique-id stages establish every invariant `assertModelShape` checks; `forecast`'s only non-test caller (`Planner.tsx:121`) passes hook state.

## Findings

### F1 — Cast ban in the planner ESLint block fails on Planner.test.ts

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 §5 Cast ban
- **Detail**: The planner block (`eslint.config.js:80-93`) also lints planner test files, and Phase 4 §4 casts `cyclicProject` in `Planner.test.ts`, so `npm run lint` would fail.
- **Fix**: Split the selectors: the planner block gets literals plus the cast ban and ignores planner tests; a later block restates only the literal selectors for those tests.
- **Decision**: FIXED

### F2 — The hook rejection table can't hold the id-ceiling row

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 §2 Tests
- **Detail**: Each `RejectionRow` is one action on `fixture()`, and the table asserts `replacements` 0 and `previousProject` undefined (`useProject.test.ts:188-193`, `:214`), so a `replaceProject` setup breaks them.
- **Fix**: A separate `it` next to the table.
- **Decision**: FIXED

### F3 — Per-Task checks get no shared index, so they rebuild lookups

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 §1 Contract
- **Detail**: `TaskCheck = (task, project, wording)` makes the known-predecessor check quadratic, contradicting "all linear"; S-07's Done rules need `tasksById` too.
- **Fix**: `TaskCheck` takes a `ProjectIndex` built once per walk.
- **Decision**: FIXED

### F4 — The forecast comment would claim guarantees the guardian doesn't give yet

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §3
- **Detail**: `forecast.ts:76-80` relies on the Done rules (S-07); `toCheckedProject` accepts `aWithStatus`.
- **Fix**: Cite the guardian for the cycle and START date only; the Done rules join in S-07.
- **Decision**: FIXED

### F5 — @ts-expect-error lines need a description of at least 10 characters

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §6 Type tests
- **Detail**: `strictTypeChecked` sets `ban-ts-comment` with `minimumDescriptionLength: 10`.
- **Fix**: State the comment form in the contract.
- **Decision**: FIXED

### F6 — checkProject already names a different function in the crash screen

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 §1, Phase 5 §3
- **Detail**: `RenderCrashFallback.tsx:32` has a local `checkProject` with a different meaning.
- **Fix**: Rename it `inspectCrashedProject` in Phase 4.
- **Decision**: FIXED

### F7 — The ceiling message repeats the cap as a literal

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 §1 Contract
- **Detail**: "2147483646" written out in the message escapes the 5.2 grep.
- **Fix**: Interpolate `MAX_TASK_ID`.
- **Decision**: FIXED
