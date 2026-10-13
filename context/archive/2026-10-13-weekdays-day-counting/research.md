---
date: 2026-10-13T21:18:15+0200
researcher: Claude (Opus 5.5) for RemekGdansk
git_commit: 631599e
branch: weekdays-day-counting
repository: critical-path
topic: "S-06 weekdays-day-counting: what the forecast, import, edits and UI need for a per-project weekdays mode"
tags: [research, forecast, calendar-date, project-file, useProject, ForecastSummary, StartPanel, S-06]
status: complete
last_updated: 2026-10-13
last_updated_by: Claude (Opus 5.5)
---

# Research: S-06 weekdays day-counting

**Date**: 2026-10-13T21:18:15+0200
**Researcher**: Claude (Opus 5.5) for RemekGdansk
**Git Commit**: 631599e
**Branch**: weekdays-day-counting
**Repository**: critical-path

## Research Question

Roadmap S-06 (`context/foundation/roadmap.md:154-164`): the user can choose per project whether Durations count calendar days or weekdays (Mon–Fri); all finish dates recalculate, a weekend base date moves to the following Monday, and the choice round-trips through the exported file. What exists today, what must change, which prior decisions and test obligations bind the slice, and what is still undecided?

## Summary

- The model and the file format are already ready for the mode. `DayCountingMode = "calendar-days" | "weekdays"` exists (`src/types.ts:10`, `:43`). The exporter writes `dayCountingMode` (`src/lib/services/project-file.ts:78`). The parser accepts both values (`project-file.ts:232`, `:316`). On the inspected import path, the only thing that blocks `"weekdays"` is `checkSupportedYet` (`project-file.ts:357-363`). S-06 adds no file key and no absent-field default, and the version stays `"0.1"` (test-plan §6.3, `context/foundation/test-plan.md:127`).
- The forecast ignores the mode (`src/lib/services/forecast.ts:5`). It keeps every finish as a whole-day offset from the base date, and only converts offsets to dates at two call sites of `forecastDate` → `addDays` (`forecast.ts:24-27`, `:81-82`). Under the convention that "finish = start + N weekdays, counted forward and skipping Sat/Sun", weekday offsets add just like calendar offsets. On this path, weekdays mode then needs two changes: a weekend base date snapped to Monday, and a weekday-aware conversion in place of `addDays`. The graph walk at `forecast.ts:58-75` stays as it is. This is an inference from the code; the PRD does not state the convention (see Open Questions).
- No edit function sets the mode: `src/lib/services/project.ts` exports nothing for it (`project.ts:57-265`). No hook action exists either (`src/hooks/useProject.ts:13-28`, `:103-118`), and no UI control (subagent grep over `src/components`, `src/hooks`, `src/dev`). An imported mode would flow in through `replaceProject` (`useProject.ts:94-99`).
- Two places in the UI explain the base date, and neither knows about a weekend shift. ForecastSummary has a branch for each existing `baseDateReason` (`src/components/planner/ForecastSummary.tsx:94-103`). StartPanel builds its own note from `today`, not from the forecast (`src/components/planner/StartPanel.tsx:44-49`), so in weekdays mode it would name a Saturday or Sunday as the forecast start.
- Tests that encode the current rejection must be replaced, not deleted silently. They are the `fileRuleRows` weekdays row (`src/lib/services/project-file.test.ts:648-653`) and the stage-order test that uses weekdays as its pre-S-06 limit (`project-file.test.ts:725-736`).

## Detailed Findings

### Forecast and calendar arithmetic

- `addDays` works on whole UTC day numbers built with `setUTCFullYear` (`src/lib/services/calendar-date.ts:13-18`, `:54-62`). It returns `undefined` outside 0001-01-01..9999-12-31, which the forecast maps to `{ kind: "beyond-year-9999" }` (`forecast.ts:24-27`).
- `todayIsoDate` uses local date parts (`calendar-date.ts:69-72`). Everything after that is UTC day numbers. Day number 0 is 1970-01-01, a Thursday, so the weekday of a date can be computed from its UTC day number with no local-time `getDay()`. A weekday helper should take that route to stay DST-safe like the rest of the file. This is an inference; no doc states it.
- Base date (`forecast.ts:44-50`): the START date, or today when START is unset (`"start-date-unset"`) or in the past (`"start-date-in-past"`). PRD FR-012 and Business Logic (`context/foundation/prd.md:168`, `:192`): "in weekdays mode, a base date falling on Saturday or Sunday moves to the following Monday". That applies to both sources of the base date: a weekend START date and a weekend today.
- Walk (`forecast.ts:58-75`):
  - A Done Task finishes at offset 0 (`:61-63`).
  - A not-Done Task starts at the max of its predecessors' finish offsets and finishes `duration` later (`:69-72`).
  - The Resource-Constrained total is the plain sum of remaining Durations (`:74`).
  - Neither the walk nor the totals read the mode.
- Done Tasks cannot exist in an edited or imported project yet: import rejects every non-To Do Status (`project-file.ts:365-378`), and no edit sets a Status (S-07). So during S-06 a weekend completion date cannot reach the forecast (inspected paths: `project-file.ts:357-379`, `project.ts` exports).
- The overflow guard matters more in weekdays mode. A Duration may be any safe integer (`project.ts:218-220`). A weekday conversion that turns N weekdays into roughly 7N/5 calendar days must keep the "outside the date range → beyond year 9999" result exact rather than overflowing or losing precision. The existing comment at `forecast.ts:53` states the same intent for sums.

### Project file import and export

- The pipeline order is documented at `project-file.ts:4-6`, with stages 5–6 at `:347-379`. Lifting the rule means taking the `dayCountingMode` branch out of `checkSupportedYet` (`:358-363`).
- `day-counting-mode-not-supported-yet` stays in the `ProjectFileRule` union (`:18`) only if some file can still trigger it. After the lift none can. Removing it from the union and updating the header comments (`:6`, `:347`) is a plan decision.
- Tests to change:
  - `fileRuleRows` weekdays row (`project-file.test.ts:648-653`).
  - The stage-order test "checks unique ids before the pre-S-06/S-07 limits, and those before the Validation Errors" (`project-file.test.ts:725-736`). Its second half uses weekdays plus an unknown predecessor to prove the limit runs before `validateProject`. After the lift it needs another pre-S-07 limit, a Status, to keep proving the order.
- Golden file: test-plan §6.3 (`test-plan.md:127`) names it `src/lib/services/golden/project-file-0.1-weekdays.json`. It is hand-written and Prettier-ignored, with the import compared with `toStrictEqual` to a hand-written project (`test-plan.md:124`). The existing 0.1 golden test is at `project-file.test.ts:32-34`, `:150`.
- Round-trip: §6.3 (`test-plan.md:125`) says a new field value gets a value in `fullProject()` or its own hand-built project through `expectRoundTrip`.
- Version bump (`test-plan.md:128`): this is M-1's job, not S-06's. The weekdays golden file must keep only an import assertion when the bump moves the byte-for-byte assertion to the `"1"` file.

### Edits and state

- The edit pattern (`project.ts:1-3`): pure function → `EditResult`. Every edit in the inspected exports (`project.ts:135-263`) except `createTask` takes `(project, ..., input)`. A `setDayCountingMode(project, mode)` has no Validation Error that the PRD names, because any mode is valid for any project (`prd.md:146`). So test-plan §6.2 (`test-plan.md:115`) requires no new hook rejection row.
- The hook (`useProject.ts:54-61`): `apply(current => edits.X(current, ...))` commits only on `ok`. Adding an action takes four edits: the service function, a `ProjectActions` member (`:13-28`), a `useCallback` wrapper as at `:86`, and the return object (`:103-118`).
- `Planner.tsx:56-57` computes `today` per render and memoises `forecast(project, today)`. A mode change recomputes both Project Finish Dates with no extra wiring.

### UI surface

- Candidate hosts for the control are the header `ProjectControls.tsx:15-30` (name, Export, Import) and the START side panel `StartPanel.tsx:28-132`. The mode is a project setting rather than a START attribute; the choice is a plan or UI decision.
- Primitive: `NativeSelect`/`NativeSelectOption` in `src/components/ui/native-select.tsx` is already used at `TaskPanel.tsx:250-270`. The `src/components/ui/` listing has no radio-group or toggle; adding one would go through `npx shadcn@latest add` (PROJECT_RULES).
- Copy that depends on the mode:
  - ForecastSummary base-date notes (`ForecastSummary.tsx:94-103`). They have no weekend branch, and nothing in the summary shows which mode is in use (`:80-93`).
  - StartPanel note (`StartPanel.tsx:44-49`). It reads `today`, not `forecast.baseDate`.
  - The Duration label "Duration (days)" (`TaskPanel.tsx:183`). Tests select by that exact label (`Planner.test.ts` `commitDuration`), and e2e asserts the exact past-START note text (`e2e/forecast-today.spec.ts:40-48`). Changing either wording breaks those tests in the same change.
- Kitchen sink: `FIXTURES` (`src/dev/KitchenSinkPlanner.tsx:67-77`) plus one `<figure>` per cell in `src/dev/kitchen-sink.astro`. A weekdays fixture with a weekend START date would show the shift.

### Test conventions binding the slice

- §6.1 (`test-plan.md:102-105`):
  - Add `prdExamples` rows in `src/lib/services/forecast.test.ts:82`, with hand-derived ISO literals, "never with `addDays`, `forecast` or any other production helper".
  - Neighbouring rows should differ on exactly the point a plausible bug gets wrong.
  - Today is injected, with no fake timers.
  - Europe/Warsaw is pinned by config.
- The PRD has no weekdays worked example (`prd.md:107`, `:192`; noted in `context/archive/2026-10-10-testing-forecast-dates/research.md:50`), so S-06 writes its own oracle rows.
- Rendered output: `ForecastSummary.test.ts` renders statically from a real `forecast(...)` result with today pinned as a string. It does not cover the past or unset notes today (subagent report).
- e2e: only for behaviour no unit test reaches (`test-plan.md:129`). A mode round trip through the real download and file picker is optional; the unit round trip covers the format.

## Code References

- `src/types.ts:10,42-43` - `DayCountingMode` and the `dayCountingMode` field ("set from S-06")
- `src/lib/services/calendar-date.ts:13-18,54-62` - UTC day-number arithmetic and `addDays` range guard
- `src/lib/services/forecast.ts:5` - "Calendar days only; the weekdays mode is S-06"
- `src/lib/services/forecast.ts:24-27,44-50,58-75,81-82` - date conversion, base date and reason, walk, the two conversion sites
- `src/lib/services/project.ts:131-132` - `createEmptyProject` defaults to `"calendar-days"`
- `src/lib/services/project.ts:218-220` - Durations up to `Number.MAX_SAFE_INTEGER`
- `src/lib/services/project-file.ts:78,232,316` - export and parse of the mode
- `src/lib/services/project-file.ts:357-363` - the `day-counting-mode-not-supported-yet` rejection to lift
- `src/lib/services/project-file.test.ts:648-653,725-736` - tests that encode that rejection
- `src/lib/services/golden/project-file-0.1.json` - existing golden file (`"calendar-days"`)
- `src/hooks/useProject.ts:13-28,54-61,86,94-99,103-118` - action pattern
- `src/components/planner/ForecastSummary.tsx:80-103` - Project Finish Dates and base-date notes
- `src/components/planner/StartPanel.tsx:44-49` - START note computed from `today`
- `src/components/planner/TaskPanel.tsx:183,250-270` - "Duration (days)" label; NativeSelect usage
- `src/dev/KitchenSinkPlanner.tsx:67-77` - kitchen-sink fixtures
- `e2e/forecast-today.spec.ts:40-48` - exact past-START note text asserted

## Architecture Insights

- Edits are pure and atomic; the hook only commits `ok` results. A mode setter fits that pattern unchanged.
- The forecast is offset-based: offsets are additive in calendar days and, under the forward-skip convention, also in weekdays. Mode handling therefore belongs at the edge, in the base-date choice and the offset-to-date conversion, not in the graph walk. A natural shape is a `calendar-date.ts` helper (e.g. weekday snapping plus adding N weekdays) with its own unit tests, called from `forecastDate`.
- Import is a staged pipeline with one rule per stage. Lifting a limit is a one-branch deletion plus test reshuffling.

## Historical Context (from prior changes)

- `context/archive/2026-09-27-capture-task-graph/plan.md:132,152,176`: the mode type and the `"calendar-days"` default were reserved in S-01 so the file format would not change later.
- `context/archive/2026-10-04-forecast-finish-dates/plan.md:9,39` and `change.md:12`: S-04 deliberately ignores the mode. Its `plan-brief.md:28` chose whole UTC day numbers with today injected. `plan-brief.md:63` records a known gap: a tab left open past midnight keeps yesterday's today.
- `context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:40-51`: an imported weekdays project would silently forecast in calendar days, so the rejection was added to S-03 until S-06 lands.
- `context/archive/2026-10-11-project-file-round-trip/plan.md:55,63,83,212-218,299`: the rejection stage, "S-06 owns it", the version stays `"0.1"`, and S-06 must lift it and add a golden file.
- `context/archive/2026-10-10-testing-forecast-dates/research.md:50-51` and `plan-brief.md:61`: the finish = start + Duration convention is inferred from the PRD examples, and S-06 must author its own oracle rows.

## Related Research

- `context/archive/2026-10-10-testing-forecast-dates/research.md`
- `context/archive/2026-10-11-project-file-round-trip/research.md`
- `context/archive/2026-10-12-test-plan-refresh-2026-10-12/research.md`

## Open Questions

Product or plan decisions. None blocks the plan, but each changes the oracle rows.

1. **Counting convention for N weekdays.** The proposal mirrors calendar mode: finish = base + N, counted forward over Mon–Fri only, with an exclusive end. Examples: Fri + 1 → Mon; Mon + 5 → next Mon. With a weekday base date, every finish and every successor start then lands on a weekday, so the Monday shift is only ever needed for the base date. The alternative, "the finish is the last working day" (Mon + 5 → Fri), would break the additive offsets and differ from calendar mode's exclusive end. The PRD does not say which (`prd.md:146`, `:168`, `:192`).
2. **Base-date reason for a weekend shift.** Should `Forecast.baseDateReason` gain a value (e.g. a weekend START date moved to Monday), and how should ForecastSummary and StartPanel word it? Also, when today is a weekend and START is unset or in the past, should both facts be shown?
3. **Where the control lives** (ProjectControls header or START panel), and whether the summary shows the active mode.
4. **Removing `day-counting-mode-not-supported-yet`** from `ProjectFileRule` once nothing can trigger it, versus keeping it.
5. **Weekend START date as input.** The PRD moves only the base date and does not reject a weekend START date (`prd.md:168`). The proposal keeps the START date as entered and shifts only the forecast.
6. **FR-016 interaction.** Whether a mode change counts as an unexported change is S-08's question. S-08 is not built yet (`roadmap.md` S-08 `proposed`).
