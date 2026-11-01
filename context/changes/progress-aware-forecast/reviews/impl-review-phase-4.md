<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Progress-Aware Forecast (S-07)

- **Plan**: context/changes/progress-aware-forecast/plan.md
- **Scope**: Phase 4 of 8
- **Reviewed phases**: 4
- **Date**: 2026-11-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

Reviewed commit `e63716e` (`src/lib/services/forecast.ts`, `forecast.test.ts`, `remaining-work.ts`, plan Progress). The scope is three source files, so the drift and safety passes ran inline instead of in sub-agents. Automated criteria were re-run on HEAD: `npx vitest run src/lib/services/forecast.test.ts` 31/31, `npm test` 518/518, `npm run lint` exit 0, `npx astro check` 0 errors. The implement run's break-check went red on both breaks: removing the `start-successors-done` branch failed 4 rows, and bypassing the `all-tasks-done` early return failed the weekdays-Saturday row. Manual 4.3 is backed by a hand-derivation comment on every new or changed row.

Drift: `forecastBaseDate` decides in the plan's order 1–5. The weekend move applies only to reasons 2–5. `forecast` returns both Project Finish Dates as the base date for `all-tasks-done` without calling `addDays`/`addWeekdays`, and the doc comments are updated (MATCH). The `remaining-work.ts` change is comment only. Its extra "and work remains" qualifier is accurate now that an all-Done base date is the latest completion date (MATCH). One oracle row was adapted: the plan's "A In Progress, today before 1 Sep" row cannot pair with a Done row on the same day under the Done rules, so it pairs with the To Do Given row instead (US-04 AC "Marking A as In Progress does not change the forecast"). This adaptation is benign.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — ForecastSummary derives "today" from the base date, which all-tasks-done breaks

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/planner/ForecastSummary.tsx:140
- **Detail**: `const today = movedFromWeekend ?? forecast.baseDate` was true for every reason before Phase 4, because the base date was either the START date or today. With `all-tasks-done` the base date is the latest completion date, so `today` there is not today. Nothing is wrong yet: only the `start-date-in-past` and `start-date-unset` notes read it. Phase 5 adds the `start-successors-done` note ("forecasting from today, {today}"), which is still correct because that reason's base date is today. But the variable name now promises more than it holds, and a Phase 5 note that used it under `all-tasks-done` would show a completion date as "today".
- **Fix**: In Phase 5, rename it, or scope it to the reasons whose base date is today (unset, in-past, successors-done), with a one-line comment saying `all-tasks-done` does not qualify.
- **Decision**: FIXED — queued as a Phase 5 follow-up in follow-ups/review-fixes.md

### F2 — No row pins the weekend move for start-successors-done

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/services/forecast.test.ts:236-335
- **Detail**: The plan says "The weekend move applies to reasons 2–5 as today". Weekdays rows cover `start-date`, `start-date-unset` and `start-date-in-past` moving off a weekend, and `all-tasks-done` not moving. No row covers `start-successors-done` with today on a Saturday or Sunday. The current code shares one move for reasons 2–5, so nothing fails today. A refactor that returned the new reason early (as `all-tasks-done` does) would drop the move unnoticed and show a weekend base date in weekdays mode.
- **Fix**: Add a weekdays row: START Thu 1 Oct 2026, A (5) → B (3), A Done Fri 16 Oct, today Sat 17 Oct → base Mon 19 Oct, `movedFromWeekend` 2026-10-17, `start-successors-done`, B (3 weekdays: Tue 20, Wed 21, Thu 22) → Thu 22 Oct for both.
- **Decision**: FIXED — row added to `prdExamples` in forecast.test.ts; an early-return break on the reason turned it red

### F3 — Base-date notes go quiet for the two new reasons until Phase 5

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/planner/StartPanel.tsx:51-59, src/components/planner/ForecastSummary.tsx:158-165
- **Detail**: Both views compare `baseDateReason` against `start-date-unset` and `start-date-in-past` only. A project whose START successors are all Done used to show "START date … is in the past: forecasting from today". After `e63716e` it shows no base-date note, and an all-Done project shows none either. This is the plan's phase split (Phase 5 §4–5 adds the copy), and no test asserted those notes for Done fixtures. It matters only if the branch were merged or deployed between Phase 4 and Phase 5.
- **Fix**: None beyond Phase 5 §4–5. Do not merge the branch before Phase 5 lands.
- **Decision**: ACCEPTED — planned interim state, closed by Phase 5 §4–5
