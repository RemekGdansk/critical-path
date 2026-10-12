<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Edit-Rejection Atomicity and the Withheld Forecast

- **Plan**: context/changes/testing-edit-rejection-atomicity/plan.md
- **Scope**: Phase 2 of 3
- **Reviewed phases**: 2
- **Date**: 2026-10-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Evidence

- Commit `10cdd3b` adds `src/components/planner/Planner.test.ts`, the only file the phase plans, plus plan bookkeeping. No production code, dependency or config changed.
- The spike (§1) is the first case: React Flow's shim is applied in `beforeAll` in this file only. The test renders `Planner` without a sized wrapper; the unsized variant worked, and Phase 3 must record that in §6.2. The shim's `ResizeObserver` also passes `contentRect`, which React Flow 12 reads for the pane and the docs' shim leaves out. The comment documents this.
- §2 follows the contract: START `2999-01-01`, A 5 days and B 3 days, independent. The dates are hand-derived literals (`2999-01-06` and `2999-01-09`, then `2999-01-08` and `2999-01-11`). While the forecast is withheld, the test checks that no ISO date appears anywhere in the region's `outerHTML`. The restore step uses a different Duration and asserts the old dates are gone. The node names are checked through `findByRole`; no timer waits.
- §3 follows the contract: `"0"` produces an alert naming the rule with none of `invalid|conflict|blocked`, the node still reads "A, 5 days" and the dates are unchanged. The field value is not asserted.
- I re-ran the automated criteria: Planner test 3/3; `npm test` 12 files / 324 tests; lint clean; `astro check` 0/0/0; `vitest related src/components/planner/Planner.tsx --run` selects `Planner.test.ts`. No `act(...)` warnings.
- Manual criterion 2.6: I re-ran deliberate break 4 in this review (`useMemo` deps → `[today]`). The withheld/restored case went red (1 failed, 2 passed). Restored with `git checkout`, green.
- Manual criterion 2.8: the jsdom file runs in about 1.1 s wall time, and `vitest related src/hooks/useProject.ts` (2 files, 40 tests) finishes in seconds, far inside the 50 s budget.

## Findings

### F1 — jsdom shim overrides prototypes permanently

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Planner.test.ts:40-58
- **Detail**: `beforeAll` replaces `globalThis.ResizeObserver` and `DOMMatrixReadOnly` and defines `offsetWidth` and `offsetHeight` on `HTMLElement.prototype` as non-configurable. None of this is restored. Today it is harmless, because Vitest isolates each file (default `isolate: true`, unchanged in `vitest.config.ts`). It would leak into other jsdom files if isolation were ever turned off for speed, and the non-configurable getters would then make a second shim throw on redefinition. The plan says "in this file only", and that holds only because of the isolation default.
- **Fix**: Mark the offset getters `configurable: true` and restore the saved originals in an `afterAll`. Alternatively, leave the code as it is and state the reliance on per-file isolation in the §6.2 pattern (Phase 3).
- **Decision**: FIXED — `beforeAll` saves the five replaced property descriptors, the offset getters are `configurable: true`, and `afterAll` restores each original, or deletes the property if it did not exist. Results after the fix: Planner test 3/3, `npm test` 324/324, lint and `astro check` clean.
