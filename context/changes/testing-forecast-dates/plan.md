# Forecast Oracle (Test-Plan Phase 1) Implementation Plan

## Overview

Test-plan §3 Phase 1 asks to "prove both Project Finish Dates match the PRD worked examples under a fixed clock and are withheld while warned", covering risk #4 (a wrong but plausible Project Finish Date) and risk #6 (a Project Finish Date visible while a Validation Warning exists). This plan pins the test time zone so the local-day rule of "today" is checked, gathers the PRD worked examples into one oracle table with the missing In Progress case, adds a static render check that a withheld forecast shows no date, and fills cookbook §6.1. No production code changes.

## Current State Analysis

- Every numeric PRD worked example is already tested with literal, hand-derived ISO dates (`src/lib/services/forecast.test.ts:45-148`), satisfying the test plan's independent-oracle rule (test-plan.md §1). The cases are scattered across separate `it` blocks, mixed with non-PRD cases.
- "Today" is injected as an ISO string everywhere below the UI (`forecast(project, today)`, `src/lib/services/forecast.ts:40`); the one clock read is `todayIsoDate(new Date())` in `src/components/planner/Planner.tsx:52`.
- `todayIsoDate` formats local date components (`src/lib/services/calendar-date.ts:69-72`), but its only test (`calendar-date.test.ts:72-76`) builds `Date`s with the local constructor, so it passes in any zone and would also pass with UTC components. CI sets no `TZ` (GitHub runners default to UTC), so the "not shifted by a DST change" test (`calendar-date.test.ts:45-49`) also proves nothing in CI.
- "In Progress is treated exactly like To Do" (PRD Business Logic; US-04) has no forecast test.
- Withholding is decided once in the domain (`forecast.ts:41-42`) and rendered by `ForecastSummary` (`src/components/planner/ForecastSummary.tsx:68-108`); the rendered output is untested.
- Vitest 5 runs in the Node environment and discovers `src/**/*.test.ts` only (`vitest.config.ts:5`); no DOM library is installed.

## Desired End State

- `npm test` runs with `TZ=Europe/Warsaw` on every machine and in both CI gates, and a `todayIsoDate` test fails if "today" is ever computed from UTC components, or if the zone pin is removed.
- `forecast.test.ts` has one PRD worked-example table: each row names its PRD rule and holds literal expected dates, including a new row proving In Progress does not change the forecast. US-02 stays a step-by-step test; non-PRD cases are unchanged. No existing expected value was changed or dropped.
- `src/components/planner/ForecastSummary.test.ts` renders `ForecastSummary` from real `forecast()` results and proves: while a Validation Warning exists, no Project Finish Date and no date appears; once it is fixed, both dates appear.
- Test-plan §6.1 says how to add a domain test with a PRD oracle; §6.5 records the Phase 1 notes; roadmap S-07 carries the all-Tasks-Done question; PROJECT_RULES' Testing section matches the new test kinds.

Verify with `npm run lint && npx astro check && npm test`, plus the probes listed under Manual Verification.

### Key Discoveries:

- Setting `test.env: { TZ: "…" }` in the Vitest config changes local-date results in both the `forks` and `threads` pools; assigning `process.env.TZ` inside a test works only under the default `forks` pool (probed 2026-10-10, Vitest 5.0.2, Node 24.21.0).
- `renderToStaticMarkup(createElement(ForecastSummary, …))` runs in a plain `.test.ts` under the project's own `vitest.config.ts` (Astro `getViteConfig`) with no new dependency (probed 2026-10-10, then removed). A `.test.ts` file is excluded from Tailwind's scan (`src/styles/global.css:11-14`), a `.test.tsx` would be neither discovered nor excluded.
- The PRD's day-counting convention (finish = start + Duration; a successor starts on its predecessor's finish or completion date) is implied by its worked examples, not stated; the hand-derived expectations below follow it.
- `ForecastSummary` renders tooltip content only when open, so the static markup of the withheld branch contains the count and copy but not the list of Task names.

## What We're NOT Doing

- **All Tasks Done** — no test and no production change. The PRD does not say what both Project Finish Dates are when no remaining work exists (the code returns the base date, i.e. today); only S-07 makes the state reachable, so the question is handed to roadmap S-07's Unknowns.
- **Stale or memoized forecast after an edit, and the clock-to-forecast glue in `Planner`** — need the DOM harness that test-plan Phase 2 introduces; Phase 2 also covers risk #6.
- **Remaining-work times (S-05)** and **weekdays mode (S-06)** — not built yet; those slices author their own oracle rows in the table this plan creates.
- **Multiple time zones** — one zone east of UTC (Europe/Warsaw, with DST) is exercised; zones west of UTC are not.
- **`vi.useFakeTimers` / `vi.setSystemTime`** — no tested code reads the clock; "today" is injected.
- **A shared test-helper module** — helpers stay local to each test file, as today.
- **Editing test-plan §1–§5** (frozen) or the §3 Status column (owned by `/10x-test-plan`); **CI workflow changes** — the config-level zone applies wherever `npm test` runs.

## Implementation Approach

Test-only changes plus one Vitest config line, in four small commits. The zone pin comes first so every later date test runs under it. The oracle table follows, then the render check fed by real `forecast()` output (no hand-built `Forecast` objects, so the check covers the domain-to-UI contract rather than a mock of it). Docs close the phase so the cookbook describes what actually landed.

## Phase 1: Pin the time zone and the local-day rule

### Overview

Run the whole suite in Europe/Warsaw and pin `todayIsoDate` to the user's local day with instants on both sides of local midnight.

### Changes Required:

#### 1. Vitest config

**File**: `vitest.config.ts`

**Intent**: Fix the process time zone for every test run, so local-date results are deterministic on any machine and in both CI gates, and the existing DST test runs in a zone that has DST.

**Contract**: `test.env.TZ = "Europe/Warsaw"` next to the existing `include`, with a one-line comment saying why (local "today" checks; deterministic dates; a zone with DST). Use `test.env`, not a runtime `process.env.TZ` assignment inside tests (works only in the `forks` pool).

#### 2. `todayIsoDate` tests

**File**: `src/lib/services/calendar-date.test.ts`

**Intent**: Replace the zone-agnostic test with instants given in UTC (`new Date("…Z")`), whose local Warsaw date differs from the UTC date, so a UTC implementation or a missing zone pin fails.

**Contract**: Expected values, hand-derived (CEST = UTC+2 until 2026-10-25, CET = UTC+1 after):

| Instant (UTC)          | Local Warsaw time     | Expected `todayIsoDate` | A UTC implementation would give |
| ---------------------- | --------------------- | ----------------------- | ------------------------------- |
| `2026-10-09T21:59:00Z` | 2026-10-09 23:59 CEST | `2026-10-09`            | `2026-10-09`                    |
| `2026-10-09T22:30:00Z` | 2026-10-10 00:30 CEST | `2026-10-10`            | `2026-10-09`                    |
| `2026-12-31T22:59:00Z` | 2026-12-31 23:59 CET  | `2026-12-31`            | `2026-12-31`                    |
| `2026-12-31T23:30:00Z` | 2027-01-01 00:30 CET  | `2027-01-01`            | `2026-12-31`                    |

The test name states the rule ("today is the user's local date, not the UTC date") and a comment notes it relies on the zone pinned in `vitest.config.ts`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with the new `todayIsoDate` cases
- `npm run lint && npx astro check` pass

#### Manual Verification:

- Probe: with the `TZ` line removed from `vitest.config.ts` and `TZ=UTC npm test`, the `todayIsoDate` test fails on the two after-midnight rows; restore the line and the suite passes again
- Probe: with `todayIsoDate` temporarily switched to `getUTC*` components, the test fails; revert and the suite passes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: PRD oracle table for the forecast

### Overview

Move the PRD-sourced forecast cases into one table-driven `describe`, add the In Progress row, and leave non-PRD cases as they are.

### Changes Required:

#### 1. Forecast test suite

**File**: `src/lib/services/forecast.test.ts`

**Intent**: Make the PRD worked examples one obvious, extendable list — the §6.1 reference pattern S-05, S-06 and S-07 add rows to — and close the In Progress gap.

**Contract**:

- A `describe("PRD worked examples", …)` with `it.each` over rows of shape `{ rule, project, today, baseDate, baseDateReason, resourceUnconstrainedProjectFinishDate, resourceConstrainedProjectFinishDate }`. `rule` cites the PRD source (e.g. "Business Logic: START 1 Sep, A (5) → B (3) → 9 Sep") and is the test name. Expected dates are literal ISO strings; nothing is computed with `addDays` or `forecast`.
- Projects whose Tasks are all To Do are built through the edit functions (as `projectWith` / `withDependencies` do now); projects with Done or In Progress Tasks are built by hand, generalising the current `aDoneOn` helper to take A's Status, since no edit sets a Status yet.
- Rows (all START → A (5) → B (3) unless noted; expected values carried over from the current suite, new values hand-derived):

| PRD rule                                                             | START      | A Status / completion        | Today      | Base date, reason              | Both dates | Origin                        |
| -------------------------------------------------------------------- | ---------- | ---------------------------- | ---------- | ------------------------------ | ---------- | ----------------------------- |
| Business Logic E1 / US-04 Given                                      | 2026-09-01 | To Do                        | 2026-08-20 | 2026-09-01, start-date         | 2026-09-09 | existing `:45-51`             |
| START date in the past is replaced by today                          | 2026-09-01 | To Do                        | 2026-09-05 | 2026-09-05, start-date-in-past | 2026-09-13 | existing `:68-74`             |
| START date equal to today is kept                                    | 2026-09-05 | To Do                        | 2026-09-05 | 2026-09-05, start-date         | 2026-09-13 | existing `:76-78`; dates new  |
| START date unset → today                                             | unset      | To Do                        | 2026-10-01 | 2026-10-01, start-date-unset   | 2026-10-09 | existing `:80-83`             |
| US-04 Given: A Done 3 Sep, today 3 Sep                               | 2026-09-01 | Done 2026-09-03              | 2026-09-03 | 2026-09-03, start-date-in-past | 2026-09-06 | existing `:141`; base new     |
| US-04 AC: A Done 8 Sep, today 8 Sep                                  | 2026-09-01 | Done 2026-09-08              | 2026-09-08 | 2026-09-08, start-date-in-past | 2026-09-11 | existing `:142`; base new     |
| US-04 AC: A Done 3 Sep, today 5 Sep, B not Done                      | 2026-09-01 | Done 2026-09-03              | 2026-09-05 | 2026-09-05, start-date-in-past | 2026-09-08 | existing `:143`; base new     |
| A Done Task needs no Duration                                        | 2026-09-01 | Done 2026-09-03, no Duration | 2026-09-03 | 2026-09-03, start-date-in-past | 2026-09-06 | existing `:146-148`; base new |
| US-04 AC / Business Logic: In Progress is treated exactly like To Do | 2026-09-01 | In Progress                  | 2026-09-03 | 2026-09-03, start-date-in-past | 2026-09-11 | **new**                       |

- The In Progress row's expected 2026-09-11 (3 Sep + 5 + 3) differs from the Done row's 2026-09-06 for the same day, so a forecast that treats In Progress as Done fails it.
- The US-02 test (`:53-66`) moves inside the PRD `describe` as its own step-by-step `it`, unchanged. Creation-order independence, parallel chains, empty project and the year-9999 boundary stay outside it, unchanged.
- Invariant: every expected literal in the current file appears in the new file with the same value.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the new In Progress row
- `npm run lint && npx astro check` pass

#### Manual Verification:

- The diff of `forecast.test.ts` shows every previous expected date still present with the same value (moved, not changed or dropped)
- Probe: changing `forecast.ts` to treat `in-progress` like `done` makes only the In Progress row fail; revert and the suite passes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Withheld render check

### Overview

Prove at the rendered-output level that a forecast withheld by a Validation Warning shows no Project Finish Date, and that both dates appear once the warning is fixed.

### Changes Required:

#### 1. `ForecastSummary` static render test

**File**: `src/components/planner/ForecastSummary.test.ts` (new)

**Intent**: Close test-plan §2's anti-pattern for risk #6 ("asserting only the domain return value") at zero dependency cost, using the US-02 project as the oracle.

**Contract**:

- `.test.ts`, no JSX: `createElement(ForecastSummary, { forecast, tasks, startDate })` rendered with `renderToStaticMarkup` from `react-dom/server`; Node environment, no DOM library.
- Input built through the edit functions (`createTask`, `setDuration`, `addPredecessor`, `setStartDate` from `@/lib/services/project`) and passed through the real `forecast(project, "2026-08-20")` — never a hand-built `Forecast` object.
- Withheld case (US-02 AC 1: START 2026-09-01, A (5) → B (3) → C (2), D with A → D → C and no Duration): markup contains "Validation Warning" and "Forecast not possible"; contains neither "Project Finish Date" nor any `yyyy-mm-dd` date.
- Restored case (US-02 AC 2: D gets Duration 4): markup contains "Resource-Unconstrained Project Finish Date" with `2026-09-12` and "Resource-Constrained Project Finish Date" with `2026-09-15`, and does not contain "Forecast not possible".
- Assertions read text, not class names.

### Success Criteria:

#### Automated Verification:

- `npm test` discovers and passes `src/components/planner/ForecastSummary.test.ts`
- `npm run lint && npx astro check` pass
- `npm run build` passes

#### Manual Verification:

- Probe: making `ForecastSummary` render the date list in the withheld branch too makes the withheld case fail; revert and the suite passes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Cookbook and hand-offs

### Overview

Record the pattern that landed, so the next domain test follows it, and hand the open product question to the slice that owns it.

### Changes Required:

#### 1. Test plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.1 placeholder with the actual pattern and append the Phase 1 notes to §6.5. §1–§5 and the §3 Status column are not edited.

**Contract**:

- §6.1 "Adding a domain unit test with a PRD oracle": location (colocated `src/**/*.test.ts`, `.ts` only); reference (`src/lib/services/forecast.test.ts`, the "PRD worked examples" table — add a row citing the PRD rule with a literal expected date derived by hand, never via `addDays` or `forecast`); "today" is injected, never read from the clock; the suite runs in Europe/Warsaw (`vitest.config.ts`); a component's output from a domain result is checked by static render in a `.test.ts` (reference: `src/components/planner/ForecastSummary.test.ts`); run with `npm test` or `npx vitest run <file>`.
- §6.5 Phase 1 note: what landed; all-Tasks-Done handed to roadmap S-07; stale-memo and `Planner` clock glue left to §3 Phase 2; §4's "`vi.setSystemTime` controls today" is superseded — today is injected and the zone is pinned (for the next `--refresh`).
- Bump the "Last updated" line.

#### 2. Roadmap S-07 Unknowns

**File**: `context/foundation/roadmap.md`

**Intent**: Make S-07's planner settle the all-Tasks-Done rule before writing its oracle rows.

**Contract**: S-07's `- **Unknowns:** —` becomes one bullet: what both Project Finish Dates are when every Task is Done (the code returns the base date, i.e. today; the PRD is silent; raised by test-plan Phase 1) — Owner: user. Block: no (decide during planning). Nothing else in the roadmap changes; the roadmap sync mirrors it into the S-07 issue on the next push to `main`.

#### 3. Project rules

**File**: `PROJECT_RULES.md`

**Intent**: The Testing section says "Vitest runs pure domain logic", which is no longer the whole truth.

**Contract**: In `## Testing`, one or two sentences: Vitest also checks a component's static output (`react-dom/server` + `createElement` in a `.test.ts`, never `.test.tsx`); the suite runs in Europe/Warsaw via `vitest.config.ts`; point to test-plan §6.1 for the pattern.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check context/foundation/test-plan.md context/foundation/roadmap.md PROJECT_RULES.md` passes
- `node scripts/sync-roadmap.mjs --dry-run` (needs `gh` auth) reports the S-07 issue as the only roadmap change

#### Manual Verification:

- §6.1 alone is enough to add a new PRD oracle row without reading this plan
- No synonym for the domain terms (Validation Warning, Resource-Unconstrained / Resource-Constrained Project Finish Date) slipped into the edited docs

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `todayIsoDate`: four UTC instants around local midnight in summer and winter (Phase 1).
- `forecast`: the PRD worked-example table, nine rows, including the new In Progress row (Phase 2); US-02 step-by-step; non-PRD cases unchanged.
- `ForecastSummary`: static render of the withheld and restored US-02 states (Phase 3).

### Integration Tests:

- None in this phase; hook-level and memoization checks belong to test-plan §3 Phase 2.

### Manual Testing Steps:

1. Remove the zone pin, run `TZ=UTC npm test`: the `todayIsoDate` test fails. Restore.
2. Make `forecast` treat In Progress as Done: only the In Progress row fails. Revert.
3. Make `ForecastSummary` show dates while withheld: the withheld render case fails. Revert.

## Performance Considerations

None; the added tests run in milliseconds.

## Migration Notes

Run `npm ci` first: the local `node_modules` has Vitest 5.0.2 while `package-lock.json` locks 5.0.3.

## References

- Related research: `context/changes/testing-forecast-dates/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (risks #4, #6), §3 Phase 1, §6.1
- PRD oracle: `context/foundation/prd.md` — US-02, US-04, Business Logic
- Prior slice: `context/archive/2026-10-04-forecast-finish-dates/plan.md:110-120`
- Current tests: `src/lib/services/forecast.test.ts:45-148`, `src/lib/services/calendar-date.test.ts:72-76`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pin the time zone and the local-day rule

#### Automated

- [x] 1.1 `npm test` passes with the new `todayIsoDate` cases — 8447836
- [x] 1.2 `npm run lint && npx astro check` pass — 8447836

#### Manual

- [x] 1.3 Probe: with the `TZ` line removed from `vitest.config.ts` and `TZ=UTC npm test`, the `todayIsoDate` test fails on the two after-midnight rows; restore the line and the suite passes again — 8447836
- [x] 1.4 Probe: with `todayIsoDate` temporarily switched to `getUTC*` components, the test fails; revert and the suite passes — 8447836

### Phase 2: PRD oracle table for the forecast

#### Automated

- [x] 2.1 `npm test` passes, including the new In Progress row — b0b0fdc
- [x] 2.2 `npm run lint && npx astro check` pass — b0b0fdc

#### Manual

- [x] 2.3 The diff of `forecast.test.ts` shows every previous expected date still present with the same value (moved, not changed or dropped) — b0b0fdc
- [x] 2.4 Probe: changing `forecast.ts` to treat `in-progress` like `done` makes only the In Progress row fail; revert and the suite passes — b0b0fdc

### Phase 3: Withheld render check

#### Automated

- [x] 3.1 `npm test` discovers and passes `src/components/planner/ForecastSummary.test.ts`
- [x] 3.2 `npm run lint && npx astro check` pass
- [x] 3.3 `npm run build` passes

#### Manual

- [x] 3.4 Probe: making `ForecastSummary` render the date list in the withheld branch too makes the withheld case fail; revert and the suite passes

### Phase 4: Cookbook and hand-offs

#### Automated

- [ ] 4.1 `npx prettier --check context/foundation/test-plan.md context/foundation/roadmap.md PROJECT_RULES.md` passes
- [ ] 4.2 `node scripts/sync-roadmap.mjs --dry-run` (needs `gh` auth) reports the S-07 issue as the only roadmap change

#### Manual

- [ ] 4.3 §6.1 alone is enough to add a new PRD oracle row without reading this plan
- [ ] 4.4 No synonym for the domain terms (Validation Warning, Resource-Unconstrained / Resource-Constrained Project Finish Date) slipped into the edited docs
