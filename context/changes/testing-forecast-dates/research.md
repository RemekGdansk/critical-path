---
date: 2026-10-10T22:07:57+0200
researcher: Claude (Opus 5.5) for RemekGdansk
git_commit: 86b442e408cb9772b14e6f5fc5f28a3fdfc22249
branch: main
repository: RemekGdansk/critical-path
topic: "Test-plan Phase 1 (Forecast oracle): what grounds risks #4 and #6 in the current code, and what is left to test"
tags: [research, codebase, test-plan, forecast, calendar-date, validation-warnings, planner]
status: complete
last_updated: 2026-10-10
last_updated_by: Claude (Opus 5.5) for RemekGdansk
---

# Research: Test-plan Phase 1 — Forecast oracle

**Date**: 2026-10-10T22:07:57+0200
**Researcher**: Claude (Opus 5.5) for RemekGdansk
**Git Commit**: 86b442e408cb9772b14e6f5fc5f28a3fdfc22249 (working tree: `context/changes/testing-forecast-dates/` and `context/foundation/test-plan.md` untracked; no `src/` changes)
**Branch**: main
**Repository**: RemekGdansk/critical-path

## Research Question

`context/foundation/test-plan.md` §3 Phase 1 asks to "prove both Project Finish Dates match the PRD worked examples under a fixed clock and are withheld while warned", covering risk #4 (a wrong but plausible Project Finish Date) and risk #6 (a Project Finish Date, or a stale one, visible while a Validation Warning exists). The §2 Risk Response Guidance asks research to ground, for #4: how "today" is obtained, date representation and time zone, which PRD examples are testable before roadmap S-06 and S-07, and where the existing forecast tests' expected values came from; for #6: where withholding is decided, and memoization of forecast results.

## Summary

- **The domain forecast already reproduces every numeric PRD worked example, with literal expected dates.** The four Business Logic examples (prd.md:192) and the US-02 shape (prd.md:84-91) are in `src/lib/services/forecast.test.ts:45-148`; the expected values are hand-written ISO dates, not computed by any production helper. The PRD has no weekdays worked example, so nothing in it waits on S-06; the three Done examples are already tested on hand-built projects ahead of S-07.
- **"Today" is injected, not read from a clock, everywhere below the UI.** `forecast(project, today: string)` (`forecast.ts:40`) takes an ISO string; the only clock read is `todayIsoDate(new Date())` in `Planner.tsx:52`, on every render. No test in `src/` uses `vi.setSystemTime` or `vi.useFakeTimers` (grep over `src/**/*.test.ts`), so "under a fixed clock" is today achieved by injection, and the Planner's clock-to-forecast glue is untested.
- **Time zone:** "today" is the user's local date (`calendar-date.ts:69-72`, local `getFullYear/getMonth/getDate`), while day arithmetic runs on UTC day numbers (`calendar-date.ts:1-5, 54-62`). The only `todayIsoDate` test (`calendar-date.test.ts:72-76`) builds its `Date`s with the local constructor, so it passes in any time zone and would also pass if the implementation switched to UTC components. Nothing pins the local-vs-UTC choice, and CI sets no `TZ` (`.github/workflows/ci.yml`; GitHub's `ubuntu-latest` runner default is UTC — external knowledge, not verified in-repo).
- **Withholding is decided once, in the domain:** `forecast()` returns `{ kind: "withheld" }` whenever `validationWarnings(project)` is non-empty (`forecast.ts:41-42`), and `ForecastSummary` renders dates only in the `kind === "forecast"` branch (`ForecastSummary.tsx:71-105`). The forecast is memoized on `[project, today]` (`Planner.tsx:53`); every accepted edit that changes the project returns a new `Project` object (`project.ts:78-80` and each edit's spread), so the memo recomputes on every such edit. The withheld result is tested at domain level (`forecast.test.ts:59-62`); the rendered UI is not tested at all.
- **Gaps Phase 1 can close with unit tests now:** In Progress treated like To Do (US-04, prd.md:115) has no forecast test; the local-day rule of `todayIsoDate` is not pinned; the all-Tasks-Done case is untested and the PRD does not define its expected result (product question below). The UI half of risk #6 needs a DOM or render harness the repo does not have (no jsdom, happy-dom or Testing Library in `node_modules`; Vitest discovers only `*.test.ts`).

## Detailed Findings

### PRD oracle → existing tests

The PRD's numeric worked examples, all in calendar days and without a year (prd.md:192, repeated at prd.md:107-114):

| PRD example                                                                                                                              | PRD expected             | Existing test (year 2026 added)                                           | Class                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------- | -------------------------------------- |
| START 1 Sep, A (5) → B (3) (prd.md:192, 107)                                                                                             | 9 Sep                    | `forecast.test.ts:45-51`, today 2026-08-20 → both 2026-09-09              | testable now                           |
| A Done 3 Sep, today 3 Sep (prd.md:108-109, 192)                                                                                          | 6 Sep                    | `forecast.test.ts:141`, hand-built project                                | Done (S-07 domain), tested now by hand |
| A Done 8 Sep, today 8 Sep (prd.md:113, 192)                                                                                              | 11 Sep                   | `forecast.test.ts:142`, hand-built                                        | same                                   |
| A Done 3 Sep, today 5 Sep, B not Done (prd.md:114, 192)                                                                                  | 8 Sep                    | `forecast.test.ts:143`, hand-built                                        | same                                   |
| START in the past, successors not all Done → today (prd.md:117, 192)                                                                     | rule, no date            | `forecast.test.ts:68-74`, START 2026-09-01, today 2026-09-05 → 2026-09-13 | testable now (all-To-Do variant)       |
| Marking A In Progress does not change the forecast (prd.md:115; "In Progress is treated exactly like To Do", prd.md:192)                 | rule                     | **none** — `in-progress` appears only in `validation-warnings.test.ts:41` | testable now, hand-built project       |
| US-02: chain equal; add D with A → D → C, no Duration → dates disappear + Warning for D; D gets a Duration → dates differ (prd.md:84-91) | rule, no Durations given | `forecast.test.ts:53-66`, Durations A 5, B 3, C 2, D 4 chosen by the test | testable now                           |

- No PRD worked example uses weekdays mode. The only weekdays rule is "a base date falling on Saturday or Sunday moves to the following Monday" (prd.md:168, 192); S-06 must author its own oracle. `forecast()` ignores `dayCountingMode` (`forecast.ts:5`; `types.ts:43`).
- The PRD fixes the day-counting convention through E1: 1 Sep + 5 + 3 = 9 Sep, i.e. a Task finishes at start + Duration (exclusive end), and a successor starts on its predecessor's finish or completion date (E2: completion 3 Sep + 3 = 6 Sep). The code implements exactly this: `taskFinishDay = startDay + duration` (`forecast.ts:71`), Done Tasks finish at day 0 = base date (`forecast.ts:61-63`). The PRD never states the convention in words.
- Hand check of the test-chosen US-02 numbers: chain 5+3+2 = 10 days → 2026-09-11 for both; with D (4): longest path A→D→C = 11 → 2026-09-12, sum 14 → 2026-09-15 — matching `forecast.test.ts:55, 65`.
- Cases in `forecast.test.ts` not sourced from the PRD but hand-derivable: creation-order independence (`:86-90`), parallel chains A2→B2 / C1→D7 → 2026-09-09 / 2026-09-13 (`:92-100`), empty project → base date (`:102-104`), the year-9999 boundary (`:106-117`), a Done Task without Duration (`:146-148`). The empty-project and beyond-9999 results are the code's own choices; the PRD is silent on both.

### How "today" is obtained and represented

- `todayIsoDate(now: Date)` formats the **local** date components of `now` (`calendar-date.ts:69-72`).
- `Planner` calls `todayIsoDate(new Date())` on each render and passes the string to `forecast` and to `StartPanel` (`Planner.tsx:51-53, 106-110`). A tab left open past midnight shows yesterday's base date until the next render — an accepted, documented gap (archive `2026-10-04-forecast-finish-dates/plan.md:43`, `plan-brief.md:63`).
- Dates are ISO `yyyy-mm-dd` strings from `0001-01-01` to `9999-12-31` (`calendar-date.ts:7-8`); arithmetic converts to whole UTC day numbers so DST cannot shift a day (`calendar-date.ts:1-5`); the DST case is tested (`calendar-date.test.ts:45-49`). Overflow becomes `{ kind: "beyond-year-9999" }` (`forecast.ts:24-27`).
- Base date: START date unless unset or before today, then today, with a `baseDateReason` (`forecast.ts:44-50`). PRD: prd.md:137, 192.
- `addDays` throws on a non-ISO base date (`calendar-date.ts:56`), so `forecast(p, "10000-01-01")` throws; the archived impl review accepted this as negligible and pushed input validation onto S-03 import (`archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:28-51`).
- Time-zone control is feasible without production changes: in plain Node v24.21.0 (the `.nvmrc` version), assigning `process.env.TZ` at runtime changed `Date#getDate()` for the same instant (observed: `2026-10-09T23:30:00Z` → 9 under `UTC`, 10 under `Europe/Warsaw`). Whether this also holds inside Vitest's worker without a `TZ` set at process start was **not** checked.
- The PRD never defines "today" beyond "the current date" (prd.md:188, 190, 167); no time-zone wording exists in it.

### Where withholding is decided; memoization

- `validationWarnings` is the single definition: one `duration-missing` warning per not-Done Task without a Duration, in creation order (`validation-warnings.ts:13-21`), matching the PRD's single listed Validation Warning (prd.md:194). Tested in `validation-warnings.test.ts:20-45`, including Done-without-Duration (no warning) and In Progress-without-Duration (warning).
- `forecast()` returns `{ kind: "withheld", warnings }` before computing anything when warnings exist (`forecast.ts:41-42`). The archived plan review rejected a second withhold rule inside the forecast (`archive/2026-10-04-forecast-finish-dates/reviews/plan-review.md:39-44`).
- `ForecastSummary` branches, in order: no Tasks → "Add Tasks to see a forecast."; `withheld` → warning count and "Forecast not possible until every Task has one."; otherwise both dates and the from-today notes (`ForecastSummary.tsx:71-105`). It holds no state of its own; dates come only from the `forecast` prop.
- `useMemo(() => forecast(project, today), [project, today])` (`Planner.tsx:53`). `useProject.apply` commits a new project only on an accepted edit (`useProject.ts:45-52`); accepted edits build a new object (`project.ts:78-80, 164-196`). One accepted edit returns the same object: removing a predecessor that is not there (`project.ts:142-151`), which changes nothing to forecast. So a stale forecast after a Warning-raising edit would need `project` identity to stay unchanged across a real change — no inspected edit path does that.
- S-05's remaining-work times (named in risk #6's "what would prove protection") do not exist yet; roadmap S-05 is `proposed`.
- The withheld copy ("until every Task has one") must be reworded for not-Done Tasks in S-07 (roadmap S-07 Risk line; `impl-review.md:82-90`).

### Test infrastructure constraints

- Vitest 5 runs in the default Node environment and discovers `src/**/*.test.ts` only (`vitest.config.ts:5`). `package-lock.json` locks vitest 5.0.3; the local `node_modules` has 5.0.2 (stale install, `npm ci` fixes it).
- No DOM library or renderer is installed (no `jsdom`, `happy-dom` or `@testing-library/*` in `node_modules`).
- A `.test.tsx` file would be neither discovered by Vitest (`vitest.config.ts:5`) nor excluded from Tailwind's scan: `global.css` excludes only `../**/*.test.ts` from `@source "../**/*.{astro,ts,tsx}"` (`src/styles/global.css:11-14`), so class names in such a test would reach the production CSS.
- Test helpers `accepted`, `projectWith`, `withDependencies` and `finishDates` are local to `forecast.test.ts:14-42` (a separate `accepted` also lives in `validation-warnings.test.ts:7-10` and `fixtures.ts:9-12`); there is no shared test-helper module.

## Code References

- `src/lib/services/forecast.ts:40-84` — `forecast(project, today)`; withhold at :41-42, base date at :44-50, finish arithmetic at :58-75
- `src/lib/services/calendar-date.ts:54-62` — `addDays` on UTC day numbers; `:69-72` — `todayIsoDate`, local components
- `src/lib/services/validation-warnings.ts:17-21` — the single Validation Warning rule
- `src/lib/services/forecast.test.ts:45-148` — current forecast tests, literal expectations
- `src/lib/services/calendar-date.test.ts:72-76` — the only `todayIsoDate` test (time-zone agnostic)
- `src/components/planner/Planner.tsx:51-53` — clock read and memoized forecast
- `src/components/planner/ForecastSummary.tsx:68-108` — rendering of dates / withheld state
- `src/hooks/useProject.ts:45-52` — commit only on accepted edit
- `vitest.config.ts:5`, `src/styles/global.css:11-14` — test discovery and Tailwind exclusion patterns

## Architecture Insights

- The forecast is a pure function with an injected `today`; the only impure step is one line in `Planner`. Fixed-clock testing of the domain therefore needs no fake timers — `vi.setSystemTime` is only relevant if a test exercises `Planner` or `todayIsoDate(new Date())`.
- Withholding has one decision point (`validationWarnings` via `forecast`) and one renderer; a domain test of `forecast` covers the decision, a render test would cover only the branch in `ForecastSummary`.
- Expected values in the current suite are literal ISO strings derived by hand from the PRD (archive `2026-10-04-forecast-finish-dates/plan.md:110-120`; plan review "checks out by hand", `reviews/plan-review.md:23`). They satisfy the test plan's independent-oracle rule (test-plan.md §1); no expectation is computed through `addDays` or `forecast`.

## Historical Context (from prior changes)

- `context/archive/2026-10-04-forecast-finish-dates/plan.md:110-120` — the test list S-04 committed to, including the PRD Done examples on hand-built projects "since no edit sets Done yet". Supported by the code (`forecast.test.ts:119-148`).
- `context/archive/2026-10-04-forecast-finish-dates/plan.md:43`, `plan-brief.md:63` — midnight refresh out of scope; supported (`Planner.tsx:51-52`).
- `context/archive/2026-10-04-forecast-finish-dates/plan-brief.md:28` — "Whole day numbers in UTC, today injected": partial — true of arithmetic (`calendar-date.ts:1-5`), while "today" itself is read in local time (`calendar-date.ts:69-72`).
- `context/archive/2026-10-04-forecast-finish-dates/plan.md:273` — "Vitest covers pure logic only", no automated integration tests; still true.
- `context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:28-51` — `forecast()` throws during render on bad input; fixed by roadmap S-03 import validation, no error boundary. Supported (`forecast.ts:67`, `calendar-date.ts:56`); S-03 is still `proposed`.
- `context/archive/2026-09-26-domain-test-gate/plan.md:35` — each slice writes its own forecast tests; consistent with S-04 having done so.

## Related Research

- No other `research.md` covers the forecast; `context/archive/2026-10-04-forecast-finish-dates/` has none.

## Open Questions

1. **All Tasks Done** — the PRD does not say what both Project Finish Dates are when no remaining work exists (prd.md:188-192). The code returns the base date (today) for both (`forecast.ts:55, 77-83`). A test can only lock this in after the product choice is confirmed; it becomes reachable through editing only with S-07.
2. **Fixed-clock scope** — whether Phase 1 should also pin the clock-to-forecast glue (`Planner.tsx:52`, via `vi.setSystemTime` and a controlled `TZ`) or stop at `todayIsoDate` plus injected `today`. The glue is one line inside a React component, so testing it through `Planner` needs the render harness Phase 2 introduces.
3. **UI half of risk #6** — §3 assigns Phase 1 "unit (fixed clock)" only, while §2 suggests "unit + one hook-level check". Without a DOM environment, the options are `react-dom/server` rendering of `ForecastSummary` inside a `.test.ts` file (no JSX, Node environment; not tried), or deferring the render check to Phase 2, which also lists #6.
4. **Vitest and runtime `TZ`** — confirmed in plain Node only; needs a check inside a Vitest worker before a test relies on it.
