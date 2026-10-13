# Weekdays Day Counting (S-06) Implementation Plan

## Overview

Roadmap S-06: the user can choose, per project, whether Durations count calendar days or weekdays (Mon–Fri). Both Project Finish Dates recalculate, a base date on Saturday or Sunday moves to the following Monday with a note saying so, and the choice round-trips through the exported file (PRD FR-017, FR-012 and Business Logic, `context/foundation/prd.md:146-147`, `:168`, `:192`).

## Current State Analysis

The model and the file format already carry `dayCountingMode` (`src/types.ts:10`, `:43`; export `src/lib/services/project-file.ts:78`; parse `:232`, `:316`). On import, only `checkSupportedYet` (`project-file.ts:357-363`) rejects `"weekdays"`, with the rule `day-counting-mode-not-supported-yet` (`:18`). No edit function, hook action or UI control sets the mode.

The forecast ignores the mode (`src/lib/services/forecast.ts:5`):

- It picks a base date (`:44-50`).
- It walks the graph in whole-day offsets (`:58-75`).
- It converts offsets to dates only at `forecastDate` → `addDays` (`:24-27`, `:81-82`).

Two views explain the base date:

- ForecastSummary has a note per `baseDateReason` (`src/components/planner/ForecastSummary.tsx:94-103`).
- StartPanel computes its own note from `today` (`src/components/planner/StartPanel.tsx:44-49`).

The unit "days" appears in two places:

- The Duration label (`src/components/planner/TaskPanel.tsx:183`).
- `formatDuration`, which builds both the node text (`TaskNode.tsx:40`) and the node's accessible name (`src/lib/services/diagram-layout.ts:46-53`).

Full code map: `context/changes/weekdays-day-counting/research.md`.

## Desired End State

- **Counting:** in weekdays mode a Duration of N counts N weekdays forward from the base date, skipping Saturday and Sunday, with an exclusive end, the same convention as calendar mode. Fri + 1 → Mon. Mon + 5 → next Mon.
- **Weekend base date:**
  - A weekend base date moves to Monday. This applies to a weekend START date, and to a weekend today when START is unset or in the past.
  - The forecast reports the weekend date it moved from.
  - ForecastSummary and StartPanel each add a sentence naming the shift.
  - Calendar-mode copy is unchanged byte for byte.
- **Control:** a labelled "Day counting" NativeSelect in the header sets the mode, with the options Calendar days and Weekdays (Mon–Fri).
- **Units:**
  - The Duration field reads "Duration (weekdays)" in weekdays mode and "Duration (days)" in calendar mode.
  - Nodes read "5 weekdays" or "1 weekday" in weekdays mode, in both their visible text and their accessible name.
- **Import:**
  - A weekdays file imports.
  - `day-counting-mode-not-supported-yet` no longer exists.
  - A hand-written `src/lib/services/golden/project-file-0.1-weekdays.json` imports to its hand-written project and is reproduced byte for byte by the exporter.
  - The file version stays `"0.1"`.

Verify with `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`, plus `npm run test:e2e` for no regressions, and by eye in the kitchen sink.

### Key Discoveries:

- The forecast is offset-based. Under forward-skip exclusive counting, weekday offsets add like calendar offsets, so only the base-date choice and the final conversion change. The graph walk (`forecast.ts:58-75`) stays as it is.
- 0001-01-01 is a Monday and 9999-12-31 is a Friday. Moving a weekend base date to Monday therefore never leaves the date range. Only "add N weekdays" can overflow.
- A Duration can be as large as `Number.MAX_SAFE_INTEGER` (`project.ts:218-220`). For N that large, `7·⌊N/5⌋` is not exact, so the weekday conversion must check N against the remaining range _before_ it multiplies.
- Day number 0 is 1970-01-01, a Thursday. The day of the week comes from the UTC day number (`calendar-date.ts:13-18`), never from local `getDay()`, so it stays DST-safe like the rest of the file.
- `Diagram.tsx:36` memoises `layoutDiagram({ tasks })` on `tasks` only, and the node's accessible name is built inside the layout (`diagram-layout.ts:51-53`, `:129`). A mode switch does not change `tasks`.
- No edit can create a Done Task during S-06: import rejects non-To Do Statuses (`project-file.ts:365-378`), and no edit sets a Status. A completion date on a weekend therefore cannot reach the forecast yet.
- Test-plan §6.3 (`context/foundation/test-plan.md:127`) binds this slice. It must replace the rejection rows with round-trip rows and add `project-file-0.1-weekdays.json`. The §6.1 oracle rows must be hand-derived literals (`test-plan.md:102-105`).

## What We're NOT Doing

- Holiday calendars or any non-Sat/Sun skipping (PRD §Non-Goals, `prd.md:214`).
- Rejecting a weekend START date: it is kept as entered, and only the forecast's base date moves.
- Done Tasks and completion dates on weekends: Statuses arrive with S-07.
- Deciding whether a mode change counts as an unexported change: that belongs to FR-016 / S-08.
- Bumping the file version to `"1"`: that is the M-1 close.
- A new e2e spec: the format round-trip is covered by unit tests, and the existing e2e specs run in calendar mode and must stay green unchanged.
- Changing the Duration Validation Error copy ("A Duration must be a positive whole number of days."): weekdays are still days.

## Implementation Approach

Handle the mode at the edges of the offset-based forecast.

`calendar-date.ts` gains three pure helpers, each unit-tested on its own:

- Day of the week.
- Move to the next weekday.
- Add N weekdays.

`forecast.ts` gains:

- An exported base-date function, which both `forecast()` and StartPanel use, so the two notes can never disagree.
- A mode-aware conversion from day offset to date.

The edit layer gains `setDayCountingMode`, following the existing pure-edit and hook pattern. The import pipeline loses one limit stage branch. The views read the mode from the project for the label, the unit and the select. The forecast result carries the weekend date the base date moved from, for the notes.

## Critical Implementation Details

**State sequencing.** The diagram's layout memo depends only on `tasks`, so a mode switch would leave every node's accessible name and unit text stale. The mode must reach `layoutDiagram` (or the node-data step after it), and that memo's dependency list must include `dayCountingMode`. The Planner view test in Phase 3 proves this by switching the mode and finding "A, 5 weekdays".

**Range guard order.** The weekday conversion must return "beyond year 9999" for any N whose result cannot fit. It has to decide that by comparing N against a bound derived from the remaining day numbers before any `7·⌊N/5⌋` arithmetic. Otherwise a Duration near `MAX_SAFE_INTEGER` loses precision and could land back inside the range.

## Phase 1: Weekday arithmetic and mode-aware forecast

### Overview

Pure domain: the forecast honours `dayCountingMode`, with hand-derived oracle rows. No UI changes yet. Calendar-mode results are unchanged.

### Changes Required:

#### 1. Weekday helpers

**File**: `src/lib/services/calendar-date.ts`, `src/lib/services/calendar-date.test.ts`

**Intent**: Add the calendar arithmetic that weekdays mode needs, on UTC day numbers like the rest of the file, so it is DST-safe and range-guarded.

**Contract**:

- `dayOfWeek(date: string): number`
  - Returns 0 = Monday … 6 = Sunday.
  - Derived from the UTC day number: day 0, 1970-01-01, is a Thursday.
  - Throws on a non-ISO date, as `addDays` does.
- `nextWeekday(date: string): string`
  - Returns `date` itself on Monday–Friday, and the following Monday on Saturday or Sunday.
  - It never leaves the range, because 9999-12-31 is a Friday.
- `addWeekdays(date: string, weekdays: number): string | undefined`
  - Precondition: `date` is a weekday. Throw otherwise, since the forecast always moves the base date first.
  - Steps forward over Mon–Fri only, with an exclusive end: Fri + 1 → Mon, Mon + 5 → next Mon, + 0 → `date`.
  - Returns `undefined` when the result falls outside 0001-01-01..9999-12-31. N is checked against the range before any multiplication (see Critical Implementation Details).
- Tests use hand-written literals only:
  - `dayOfWeek` on 1970-01-01 (Thu), 0001-01-01 (Mon) and 9999-12-31 (Fri).
  - `nextWeekday` on Fri, Sat and Sun.
  - `addWeekdays` across a weekend, a month end and a year end.
  - `addWeekdays` of 0.
  - The last representable result.
  - `undefined` one weekday past it and at `Number.MAX_SAFE_INTEGER`.
  - A DST-week case, mirroring the existing `addDays` DST test.

#### 2. Mode-aware forecast and exported base date

**File**: `src/lib/services/forecast.ts`

**Intent**: Pick the base date in one exported function that StartPanel can reuse, move a weekend base date in weekdays mode, and convert offsets to dates with the mode's arithmetic. Update the header comment, which currently says "Calendar days only".

**Contract**:

- New exported `forecastBaseDate(project: Project, today: string)` returns `{ baseDate; baseDateReason; movedFromWeekend?: string }`.
  - `baseDateReason` keeps its existing three values and meaning: why START or today was chosen.
  - `movedFromWeekend` is the Saturday or Sunday chosen before the move. It is present only in weekdays mode when that date is a weekend.
  - `baseDate` is the date after the move.
- The `forecast` variant of `Forecast` gains `dayCountingMode` and an optional `movedFromWeekend: string`.
- `forecastDate` takes the mode: `addDays` for calendar days, `addWeekdays` for weekdays. The walk at `:58-75` is unchanged.

#### 3. Oracle rows

**File**: `src/lib/services/forecast.test.ts`

**Intent**: Add weekdays rows to `prdExamples`, hand-derived and never computed with a production helper (test-plan §6.1). Extend `PrdExample` with an optional `movedFromWeekend` that every row asserts, absent when not set, plus a way to build the row's project in weekdays mode. Neighbouring rows differ on exactly one point.

**Contract**: the rows below, using October 2026 (Fri 16, Sat 17, Sun 18, Mon 19), `aThenB` (A 5 → B 3, a chain) and an independent A 5 ∥ B 3 project. Every row is in weekdays mode unless it says calendar.

| Project and inputs                                      | Base date and reason                                       | Unconstrained | Constrained | What the row pins                      |
| ------------------------------------------------------- | ---------------------------------------------------------- | ------------- | ----------- | -------------------------------------- |
| `aThenB`, START Mon 2026-10-19, today 2026-10-01        | 10-19, `start-date`                                        | 2026-10-29    | 2026-10-29  | Two weekends skipped                   |
| Same project in **calendar** mode                       | 10-19, `start-date`                                        | 2026-10-27    | 2026-10-27  | Neighbour: only the mode differs       |
| Independent A 5 ∥ B 3, START Mon 10-19                  | 10-19, `start-date`                                        | 2026-10-26    | 2026-10-29  | Constrained differs from unconstrained |
| Single A 1, START Fri 2026-10-16                        | 10-16, `start-date`                                        | 2026-10-19    | 2026-10-19  | Fri + 1 → Mon                          |
| `aThenB`, START Sat 2026-10-17                          | 10-19, `start-date`, `movedFromWeekend` 2026-10-17         | 2026-10-29    | 2026-10-29  | Weekend START moves                    |
| `aThenB`, START Sun 2026-10-18                          | 10-19, `start-date`, `movedFromWeekend` 2026-10-18         | 2026-10-29    | 2026-10-29  | Sunday moves too                       |
| `aThenB`, START unset, today Sat 2026-10-17             | 10-19, `start-date-unset`, `movedFromWeekend` 2026-10-17   | 2026-10-29    | 2026-10-29  | Weekend today moves                    |
| `aThenB`, START 2026-09-01 (past), today Sun 2026-10-18 | 10-19, `start-date-in-past`, `movedFromWeekend` 2026-10-18 | 2026-10-29    | 2026-10-29  | Past START, weekend today              |

A separate `it` asserts "beyond year 9999" in weekdays mode for a Duration of `Number.MAX_SAFE_INTEGER`, and that the calendar-mode rows still carry no `movedFromWeekend`.

### Success Criteria:

#### Automated Verification:

- Calendar-date and forecast tests pass: `npx vitest run src/lib/services/calendar-date.test.ts src/lib/services/forecast.test.ts`
- Whole suite passes: `npm test`
- Lint and type check pass: `npm run lint && npx astro check`

#### Manual Verification:

- Optional Stryker run on the new `calendar-date.ts` and `forecast.ts` lines, with survivors reviewed one by one (accounting for the known runner false result in PROJECT_RULES)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Editing and the project file

### Overview

The mode can be set through the state hook, and a weekdays project imports and round-trips. The S-03 limit is gone.

### Changes Required:

#### 1. Mode edit and hook action

**File**: `src/lib/services/project.ts`, `src/lib/services/project.test.ts`, `src/hooks/useProject.ts`, `src/hooks/useProject.test.ts`

**Intent**: Add a pure edit that sets the mode, and expose it through the hook like `setStartDate`. Any mode is valid for any project, so the edit never rejects, and the §6.2 rejection table gains no row.

**Contract**:

- `setDayCountingMode(project: Project, mode: DayCountingMode): EditResult` returns `accept(project)` unchanged (the same object) when the mode is already set, and otherwise a new project with the mode replaced.
- `ProjectActions.setDayCountingMode: (mode: DayCountingMode) => EditResult`, wired through `apply` and added to the return object.
- Tests:
  - A domain test for both modes, including the same-object no-op.
  - One hook test showing that the action commits.

#### 2. Lift and remove the import limit

**File**: `src/lib/services/project-file.ts`, `src/lib/services/project-file.test.ts`

**Intent**: Weekdays files import. Remove `day-counting-mode-not-supported-yet` from `ProjectFileRule`, the `checkSupportedYet` branch and the pipeline comments (`:6`, `:347`), so no dead rule remains.

**Contract**:

- The weekdays `fileRuleRows` row (`project-file.test.ts:648-653`) becomes an accepted-import or round-trip row (test-plan §6.3, `test-plan.md:127`).
- The stage-order test (`:725-736`) keeps proving "unique ids → pre-S-07 limits → Validation Errors":
  - Its weekdays fixtures switch to an In Progress Status.
  - The second half then expects `task-status-not-supported-yet` before the unknown-predecessor Validation Error.
  - The test name drops "S-06".

#### 3. Weekdays golden file and round-trip

**File**: `src/lib/services/golden/project-file-0.1-weekdays.json` (new, hand-written), `src/lib/services/project-file.test.ts`

**Intent**: Pin the format for a weekdays project the same way as the 0.1 golden file: committed bytes as the oracle, a hand-written expected project, and no regeneration from the exporter.

**Contract**:

- The file is a hand-written variant of `project-file-0.1.json` with `"dayCountingMode": "weekdays"`, a weekend START date (e.g. `"2026-10-17"`) and its own name.
- `.prettierignore` already excludes `src/lib/services/golden/`, so Prettier leaves its bytes alone.
- The tests mirror the existing `describe("the golden file (format 0.1)")`:
  - The import is `toStrictEqual` to a hand-written project.
  - `serializeProject` reproduces it with `toBe`, byte for byte.
- A weekdays project also goes through `expectRoundTrip`, either by giving `fullProject()` the mode or by adding its own hand-built project.

#### 4. Test plan handoff note

**File**: `context/foundation/test-plan.md`

**Intent**: Record that S-06's handed-off items have landed: the weekdays round-trip and its golden file. This affects §3 Phase 3 "Handed off" (`:164`) and the S-06 half of §6.3's "Lifting a not-supported-yet rejection" (`:127`), so the plan no longer lists them as pending.

**Contract**: prose-only edit to those two lines. No line breaks within paragraphs (PROJECT_RULES Markdown).

### Success Criteria:

#### Automated Verification:

- Edit, hook and file tests pass: `npx vitest run src/lib/services/project.test.ts src/hooks/useProject.test.ts src/lib/services/project-file.test.ts`
- No reference to `day-counting-mode-not-supported-yet` remains in `src/`: `grep -rn "day-counting-mode-not-supported-yet" src` prints nothing
- Whole suite, lint and type check pass: `npm run lint && npx astro check && npm test`

#### Manual Verification:

- The weekdays golden file reads as a plausible hand-written project, and its expected project in the test is written out by hand, not derived from the parser

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI

### Overview

The user can switch the mode in the header. Labels, node units and base-date notes follow it, and the kitchen sink shows a weekdays project with a weekend START date.

### Changes Required:

#### 1. Day counting control

**File**: `src/components/planner/ProjectControls.tsx`, `src/components/planner/Planner.tsx`

**Intent**: A labelled "Day counting" `NativeSelect` in ProjectControls, after Import, with the options "Calendar days" (`calendar-days`) and "Weekdays (Mon–Fri)" (`weekdays`). It commits on change through `setDayCountingMode`.

**Contract**:

- ProjectControls takes `dayCountingMode` and `setDayCountingMode` props, and Planner passes them from `useProject`.
- The select's value is narrowed to `DayCountingMode` with a type guard rather than a cast. Reuse or export the `DAY_COUNTING_MODES` list from `project-file.ts:232` instead of a second list.
- The select is controlled by the project, so an import (remount on `replacements`) shows the imported mode.
- Token classes only, and `cn()` if classes merge.

#### 2. Weekend notes

**File**: `src/components/planner/ForecastSummary.tsx`, `src/components/planner/StartPanel.tsx`, `src/components/planner/Planner.tsx`

**Intent**: Name the move to Monday without changing any calendar-mode copy.

**Contract**:

- **ForecastSummary:**
  - The existing past and unset notes name "today" as `movedFromWeekend ?? baseDate`, so they still show the real today.
  - When `movedFromWeekend` is set, one more sentence follows, e.g. `2026-10-17 is a Saturday: counting weekdays, the forecast starts on Monday, 2026-10-19.`
  - The `start-date` reason shows only that sentence.
  - The day name comes from `dayOfWeek`.
- **StartPanel:**
  - Its note comes from `forecastBaseDate(project, today)` instead of comparing with `today` itself, so it agrees with the summary even while the forecast is withheld.
  - The same weekend sentence is added in weekdays mode.
  - Calendar-mode wording is unchanged.
- The exact past-START sentence asserted by `e2e/forecast-today.spec.ts:40-48` must stay byte-identical.

#### 3. Units follow the mode

**File**: `src/components/planner/TaskPanel.tsx`, `src/lib/services/diagram-layout.ts`, `src/lib/services/diagram-layout.test.ts`, `src/components/planner/TaskNode.tsx`, `src/components/planner/Diagram.tsx`

**Intent**: Show the unit wherever a Duration is shown: "Duration (weekdays)" or "Duration (days)", and "1 weekday" / "5 weekdays" versus "1 day" / "5 days" in node text and accessible names.

**Contract**:

- `formatDuration(days, mode)` takes the mode.
- `layoutDiagram` takes `Pick<Project, "tasks" | "dayCountingMode">`, or the node data carries the mode.
- Diagram's memo depends on `dayCountingMode` (see Critical Implementation Details).
- The `diagram-layout.test.ts:180` expectations gain weekdays cases.
- Calendar-mode strings are unchanged, so the `"Duration (days)"` and `"A, 5 days"` selectors in tests and e2e stay valid.

#### 4. Rendered and view tests

**File**: `src/components/planner/ForecastSummary.test.ts`, `src/components/planner/Planner.test.ts`

**Intent**: Prove that the domain result reaches the screen (test-plan §6.1 "Rendered output", §6.2).

**Contract**:

- **ForecastSummary**, static renders from a real `forecast(...)` in weekdays mode with hand-written dates:
  - The weekend START note.
  - The unset START with weekend today note, which shows both the unset note naming the real today and the weekend sentence.
  - One calendar-mode render proving no weekend sentence appears.
- **Planner**, a new case on the existing fixture: START Tue 2999-01-01, A 5 ∥ B 3.
  1. Switch "Day counting" to Weekdays with `fireEvent.change`.
  2. Expect the forecast to read "Resource-Unconstrained Project Finish Date 2999-01-08" and "Resource-Constrained Project Finish Date 2999-01-11", with the calendar dates 2999-01-06 and 2999-01-09 gone.
  3. Expect `findByRole("button", { name: "A, 5 weekdays" })` to find the node.
  4. Expect the selected Task's field labelled "Duration (weekdays)".

#### 5. Kitchen sink

**File**: `src/dev/KitchenSinkPlanner.tsx`, `src/dev/kitchen-sink.astro`

**Intent**: Add a weekdays fixture, built through the real edits: the small project in weekdays mode with a weekend START date, START selected. One `<figure>` shows the select, the weekday units and both weekend notes.

**Contract**: a new `FIXTURES` key (e.g. `"weekdays-weekend-start"`) and one `<figure>`, following the existing cells.

### Success Criteria:

#### Automated Verification:

- View, render and layout tests pass: `npx vitest run src/components/planner/ForecastSummary.test.ts src/components/planner/Planner.test.ts src/lib/services/diagram-layout.test.ts`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E stays green with no spec edits: `npm run test:e2e`

#### Manual Verification:

- In the kitchen sink (`npm run dev`, `/kitchen-sink`), the weekdays cell shows the "Day counting" select set to Weekdays, "Duration (weekdays)"-style units on nodes, and both weekend notes. The calendar cells look unchanged.
- In `npm run build && npm run preview`, switching the mode recomputes both Project Finish Dates at once, and exporting then importing a weekdays project in a fresh tab restores the Weekdays selection and the same dates.
- Keyboard: the select is reachable by Tab, operable with the arrow keys, and shows the visible focus ring.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Weekday arithmetic:
  - Day-of-week anchors.
  - Weekend moves.
  - Exclusive forward counting across weekends, month and year ends.
  - Range end and `MAX_SAFE_INTEGER`.
  - DST.
- Forecast oracle rows (table in Phase 1), where neighbouring rows differ by one point (mode, START weekday, base-date source).
- `setDayCountingMode`: accept, and the same-object no-op.
- Import: weekdays accepted, the stage order re-proved with a Status limit, the weekdays golden file (import and byte-for-byte), and the round-trip.

### Integration Tests:

- ForecastSummary static renders for the weekend notes and the calendar control.
- A Planner jsdom test: mode switch → new dates, node accessible names and Duration label, which covers the layout memo.

### Manual Testing Steps:

1. Kitchen sink weekdays cell: select, units and notes.
2. Preview build: set START to a Saturday in weekdays mode and read both notes. Switch to calendar and check that the notes revert.
3. Export a weekdays project, import it in a fresh browser context, and check that the mode and dates are identical.

## Performance Considerations

`addWeekdays` is O(1) arithmetic, and the forecast stays one topological walk. Re-laying out the diagram when the mode changes is a rare user action, within the 200 ms NFR already met for 100 Tasks.

## Migration Notes

No format change: `dayCountingMode` has been written since S-03, and existing files say `"calendar-days"`. The version stays `"0.1"`. When M-1 bumps to `"1"`, the weekdays golden file keeps only its import assertion (test-plan §6.3, `test-plan.md:128`).

## References

- Research: `context/changes/weekdays-day-counting/research.md`
- PRD: `context/foundation/prd.md:146-147`, `:168`, `:192`, `:214`
- Roadmap S-06: `context/foundation/roadmap.md` (S-06 block)
- Test plan: `context/foundation/test-plan.md` §6.1–§6.3 (`:102-130`)
- Pattern, pure edit plus hook action: `src/lib/services/project.ts:247-256`, `src/hooks/useProject.ts:21`, `:86`, `:115`
- Pattern, golden file test: `src/lib/services/project-file.test.ts:32-34`, `:150-160`
- Prior decision to reject weekdays until S-06: `context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:40-51`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Weekday arithmetic and mode-aware forecast

#### Automated

- [x] 1.1 Calendar-date and forecast tests pass — 7c58e8b
- [x] 1.2 Whole suite passes — 7c58e8b
- [x] 1.3 Lint and type check pass — 7c58e8b

#### Manual

- [x] 1.4 Optional Stryker run on the new lines, survivors reviewed — 7c58e8b

### Phase 2: Editing and the project file

#### Automated

- [x] 2.1 Edit, hook and file tests pass — ba74560
- [x] 2.2 No reference to day-counting-mode-not-supported-yet remains in src/ — ba74560
- [x] 2.3 Whole suite, lint and type check pass — ba74560

#### Manual

- [x] 2.4 Weekdays golden file and its expected project are hand-written — ba74560

### Phase 3: UI

#### Automated

- [x] 3.1 View, render and layout tests pass — fa8d592
- [x] 3.2 Full gate passes — fa8d592
- [x] 3.3 E2E stays green with no spec edits — fa8d592

#### Manual

- [x] 3.4 Kitchen sink weekdays cell shows select, units and both weekend notes — fa8d592
- [x] 3.5 Preview build: mode switch recomputes dates; weekdays export/import round-trips — fa8d592
- [x] 3.6 Keyboard: select reachable, operable, visible focus — fa8d592
