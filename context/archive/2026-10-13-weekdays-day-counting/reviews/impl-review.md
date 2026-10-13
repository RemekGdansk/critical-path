<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Weekdays Day Counting (S-06)

- **Plan**: context/changes/weekdays-day-counting/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Evidence

- Full gate `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`: pass (358 tests, CSP check passed on 2 pages).
- `npm run test:e2e`: 5/5 pass; `git diff 35dcaf9..HEAD --stat -- e2e` is empty (no spec edits).
- `grep -rn "day-counting-mode-not-supported-yet" src`: no output.
- All 8 forecast oracle rows and the Planner case (Tue 2999-01-01 → 2999-01-08 / 2999-01-11) re-derived by hand: correct.
- `addWeekdays` checked against a day-by-day loop over every weekday × N in 0..39: 0 mismatches; range guard runs before the `7·⌊N/5⌋` arithmetic.
- Benign extras, consistent with the plan's intent: `StartPanel.test.ts` (pins the StartPanel weekend note), `weekendMoveNote()` shared by ForecastSummary and StartPanel, a calendar-mode Saturday oracle row, and the `toStrictEqual` table assertion that covers "calendar rows carry no `movedFromWeekend`" for every row.
- Manual Progress items 3.4–3.6 can't be evidenced from the diff (acknowledged as human-confirmed); 1.4 has a Stryker report in `reports/mutation/`.
- Housekeeping: the uncommitted `context/foundation/roadmap.md` still marks S-06 `planning`; it becomes `done` at archive.

## Findings

### F1 — addWeekdays accepts negative, fractional and non-finite input without a guarded contract

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/calendar-date.ts:93-104
- **Detail**: `addWeekdays("2026-10-12", -1)` returns `"2026-10-11"`, a Sunday, and `1.5` is silently truncated. No caller reaches this today: Durations pass `isPositiveWholeDays`. `addDays` behaves the same way. Separately, the test at `calendar-date.test.ts:117` (`MAX_SAFE_INTEGER`) would pass even without the early range guard. The guard is what stops `Infinity`/`NaN` from producing `"NaN-NaN-NaN"`, and no test pins it.
- **Fix**: Throw when `!Number.isInteger(weekdays) || weekdays < 0` (Infinity still returns undefined via the range guard), and add an `addWeekdays(d, Infinity)` → `undefined` test.
- **Decision**: FIXED — integer/negative guard after the range check; tests for -1, 1.5 (throw) and Infinity, NaN (undefined)

### F2 — Day-counting mode list and type guard live in the file-format module

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project-file.ts:228, :267; src/components/planner/ProjectControls.tsx:10-11
- **Detail**: The plan asked for `DAY_COUNTING_MODES` to be reused rather than duplicated, and it is. As a result, the UI imports a domain enum and `isDayCountingMode` from the serializer. The mode list belongs to the model, next to `DayCountingMode` in `src/types.ts` or in `project.ts`.
- **Fix**: Move `DAY_COUNTING_MODES` and `isDayCountingMode` into `src/lib/services/project.ts` and have `project-file.ts` and `ProjectControls.tsx` import them from there.
- **Decision**: FIXED — moved to project.ts; project-file.ts and ProjectControls.tsx import from there

### F3 — Duration unit wording chosen in two places

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/TaskPanel.tsx:183-185; src/lib/services/diagram-layout.ts:51-54
- **Detail**: `formatDuration` picks "weekday"/"day" and TaskPanel hard-codes "Duration (weekdays)"/"Duration (days)". A wording change would have to update both.
- **Fix**: Export a small `durationUnit(mode)` from `diagram-layout.ts` and use it in both places.
- **Decision**: FIXED — `durationUnit(mode)` in diagram-layout.ts, used by formatDuration and the TaskPanel Duration label

### F4 — Planner test comment misdescribes the fixture

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/Planner.test.ts:194
- **Detail**: The comment says "B (3) runs on after A", but the fixture is A ∥ B. What runs on after A is the constrained (no-parallelism) schedule. The assertions are correct.
- **Fix**: Reword it to "…; with no parallelism, B (3) runs after A: Fri 2999-01-11."
- **Decision**: FIXED — comment reworded
