<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Impossible START Date Keeps the Previous One

- **Plan**: context/changes/impossible-date-should-not-clear-previous/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Automated verification run on 2026-10-19: `npx vitest run src/lib/services/project.test.ts src/components/planner/Planner.test.ts` (84 passed), `npm run lint` (clean), `npx astro check` (0 errors), `npm test` (411 passed), `npm run build`, `npm run check:csp` (2 pages), `npm run test:e2e` (7 passed, `e2e/start-date.spec.ts` included). Manual items 1.5 and 2.4 are checked; 2.4 is visible in the diff (the §6.2 sentence and the follow-up line, no inserted line breaks).

## Findings

### F1 — The Clear and Escape DOM resets have no automated test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/StartPanel.tsx:85, src/components/planner/StartPanel.tsx:128
- **Detail**: The plan's only "Critical Implementation Detail" is that Clear and Escape reset the input's DOM value. No test reaches either reset where it matters. Delete line 128 and Clear on an unreadable date shows the alert instead of clearing. Delete line 85 and Escape with START unset leaves the impossible segments and `badInput` in the field. The suite stays green either way. The jsdom stub is a fixed `{ badInput: true }`, so it cannot observe a DOM reset. The e2e Escape step runs with START set, where React's `setDraft("2999-01-01")` rewrites the DOM even without line 85. Clear is covered only by manual step 1.5. Escape with START unset is in no test and no manual step, and it rests on Chromium clearing edited segments when the value is assigned `""` while already `""`.
- **Fix**: Extend `e2e/start-date.spec.ts` with two steps after the partly filled date: type 02/30/2026 again and click Clear, then assert an empty field, no alert, `badInput` false and the `START, today` node. Then, with START unset, type 02/30/2026, press Escape, and assert an empty field, `badInput` false and no alert.
- **Decision**: FIXED — `e2e/start-date.spec.ts` gains a `typeImpossibleDate` helper and two steps: Clear on an unreadable date, and Escape on an unreadable date with START unset, each asserting `{ value: "", badInput: false }` and no alert. Removing `StartPanel.tsx:128` or `:85` now fails the spec at `:135` or `:145` respectively.

### F2 — The E2E spec departs from the plan's contract; the plan was not amended

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: e2e/start-date.spec.ts:6-7, :64-80, :117-118
- **Detail**: The plan specified `test.use({ locale: "en-US" })` and, for the partly filled case, "type only the month segment". The spec instead detects the segment order with ArrowUp, because Chromium on macOS takes the order from the system region, not the context locale. It also empties one segment of the committed date with Backspace. Both choices are sound, and the spec header and the test-plan §6.2 sentence give the reason. `plan.md` still describes the locale pin, though, so anyone reading the plan as the record of truth before archiving gets the wrong mechanism.
- **Fix**: Add one line under Phase 2 §1 of `plan.md` (or in `change.md` Notes) recording the order detection and the Backspace variant, and why.
- **Decision**: FIXED — an "As implemented" note under Phase 2 §1 of `plan.md` records the segment-order detection, the Backspace variant and why, and the two steps F1 added.
