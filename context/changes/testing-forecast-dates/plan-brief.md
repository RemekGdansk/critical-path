# Forecast Oracle (Test-Plan Phase 1) — Plan Brief

> Full plan: `context/changes/testing-forecast-dates/plan.md`
> Research: `context/changes/testing-forecast-dates/research.md`

## What & Why

Test-plan §3 Phase 1: prove both Project Finish Dates match the PRD worked examples under a controlled "today" and are withheld while a Validation Warning exists (risks #4 and #6). Roadmap S-06 and S-07 are about to change the forecast; this phase locks the current behaviour against the PRD first and leaves a pattern those slices extend.

## Starting Point

The forecast already reproduces every numeric PRD worked example with hand-written expected dates, and "today" is injected rather than read from a clock. Gaps: nothing pins that "today" is the user's local day rather than the UTC day (CI runs in UTC), "In Progress is treated like To Do" is untested, and the rendered withheld state is untested.

## Desired End State

`npm test` runs in a fixed time zone everywhere and fails if "today" is computed in UTC. The forecast suite has one PRD worked-example table that S-05/S-06/S-07 add rows to, with a new In Progress row. A static render check proves the header shows no Project Finish Date while warned and both once fixed. Cookbook §6.1 explains how to add the next oracle test.

## Key Decisions Made

| Decision                | Choice                                                                  | Why (1 sentence)                                                                                        | Source   |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| How "today" is fixed    | Inject the ISO date; no fake timers                                     | `forecast(project, today)` already takes it; no tested code reads the clock.                            | Research |
| Time zone               | Suite-wide `test.env.TZ = "Europe/Warsaw"`                              | Works in both Vitest pools (probed); a UTC implementation fails; the DST test becomes meaningful in CI. | Plan     |
| Test layout             | One PRD worked-example `it.each` table; non-PRD cases unchanged         | One obvious place for the next oracle row; existing expected values move, never change.                 | Plan     |
| Risk #6 UI half         | Static render of `ForecastSummary` now, fed by real `forecast()` output | Avoids §2's "assert only the domain value" anti-pattern with no new dependency (probed).                | Plan     |
| Stale/memoized forecast | Left to test-plan Phase 2                                               | Needs the DOM harness Phase 2 introduces.                                                               | Research |
| All Tasks Done          | No test; handed to roadmap S-07 Unknowns                                | PRD is silent and only S-07 makes the state reachable; locking current output would invent a rule.      | Plan     |

## Scope

**In scope:**

- Zone pin in `vitest.config.ts` and four `todayIsoDate` cases around local midnight (summer and winter)
- PRD table in `forecast.test.ts` (nine rows, one new: In Progress, today 3 Sep → 11 Sep, not Done's 6 Sep)
- New `src/components/planner/ForecastSummary.test.ts` (withheld vs. restored US-02 states)
- Test-plan §6.1 and §6.5, roadmap S-07 Unknowns, PROJECT_RULES Testing section

**Out of scope:**

- Any production code change; the all-Tasks-Done rule; `Planner` clock glue and memoization (Phase 2); S-05 remaining-work times; S-06 weekdays; zones west of UTC; test-plan §1–§5; CI workflow edits

## Architecture / Approach

Test-only, four small commits. The zone pin lands first so every later date test runs under it. The oracle table keeps hand-derived literal dates (never `addDays`/`forecast` output). The render test builds projects through the real edit functions and `forecast()`, then renders `ForecastSummary` with `createElement` + `renderToStaticMarkup` inside a `.test.ts` (Node environment, excluded from Tailwind's scan) and asserts on text only.

## Phases at a Glance

| Phase                                       | What it delivers                                                 | Key risk                                                        |
| ------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Pin the time zone and the local-day rule | `TZ=Europe/Warsaw` for all tests; local-day `todayIsoDate` cases | A test that passes without the pin — guarded by a removal probe |
| 2. PRD oracle table for the forecast        | Nine-row PRD table incl. In Progress; US-02 kept step-by-step    | Silently changing or dropping an expected date while moving it  |
| 3. Withheld render check                    | `ForecastSummary.test.ts` for withheld and restored states       | Asserting on markup details that change for harmless reasons    |
| 4. Cookbook and hand-offs                   | §6.1, §6.5, S-07 Unknown, PROJECT_RULES Testing                  | Editing frozen §1–§5 or the orchestrator-owned §3 Status        |

**Prerequisites:** `npm ci` (local Vitest is 5.0.2; the lock file says 5.0.3).
**Estimated effort:** ~1 session across 4 small phases.

## Open Risks & Assumptions

- Only one zone east of UTC is exercised; a bug specific to zones west of UTC would not show.
- The PRD's day-counting convention (finish = start + Duration) is inferred from its worked examples, not stated; new rows follow the same convention.
- The render check sees one render per input; a stale memoized value across edits is caught only once Phase 2 lands.

## Success Criteria (Summary)

- Removing the zone pin, switching "today" to UTC, treating In Progress as Done, or showing dates while withheld each makes a specific test fail.
- `npm run lint && npx astro check && npm test` pass with no production code changed.
- A reader can add the next PRD oracle row from §6.1 alone.
