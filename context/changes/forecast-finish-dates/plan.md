# Forecast Resource-Unconstrained and Resource-Constrained Project Finish Dates Implementation Plan

## Overview

Roadmap slice S-04 (US-02, FR-004, FR-006, FR-009, FR-012). The user can set a START date (today if unset) and a positive whole-day Duration on each Task, and sees the Resource-Unconstrained Project Finish Date (longest path, unlimited parallelism) and the Resource-Constrained Project Finish Date (sum of all Durations, parallelism 1). While any not-Done Task lacks a Duration, both dates are withheld, the project shows a Validation Warning, and the affected Tasks are highlighted on the diagram. Calendar-day mode only.

## Current State Analysis

- The model already carries the fields: `Task.duration?` (`src/types.ts:22`) and `Start.date?` (`src/types.ts:31`), both reserved "from S-04". `Task.status` is always `"to-do"` until S-07, and `dayCountingMode` is always `"calendar-days"` until S-06.
- Every edit is a pure function in `src/lib/services/project.ts` returning `EditResult` (`project.ts:22`); `ValidationErrorRule` (`project.ts:9-15`) names each rule. `useProject` (`src/hooks/useProject.ts:39-47`) commits only accepted results.
- Structural queries live in `src/lib/services/task-graph.ts`; there is no topological order helper yet.
- `layoutDiagram` (`src/lib/services/diagram-layout.ts:98`) is the one place Tasks become nodes. START and FINISH are `focusable: false, selectable: false` (`diagram-layout.ts:49-54`), asserted by `diagram-layout.test.ts:124`. Task node data is `{ name, taskId }` (`diagram-layout.ts:24`); `TASK_NODE_HEIGHT` is 44 (`:13`).
- Selection is `TaskId | null` end to end: `useProject` (`:35`), `Diagram` (`selectedTaskId`, `onSelect`, `onEdit`), `Planner` (`focusRequest.taskId`). Clicking START selects nothing (`Diagram.tsx:51-56`).
- The header holds only `NewTaskForm` (`Planner.tsx:73-75`). The side panel shows the empty-state copy, the "Select a Task" copy or `TaskPanel` (`Planner.tsx:84-98`).
- `TaskPanel` commits a rename on Enter or blur and restores on Escape (`TaskPanel.tsx:62-90`); errors render as `role="alert"` under the field.
- Tokens: `global.css` has `--destructive` and no warning role. `npm run lint` rejects literal colours, palette classes, arbitrary values and inline styles in `src/components/planner/` (`eslint.config.js:66-90`).
- Fixtures: `createPerfProject` (`src/lib/services/fixtures.ts:22`) has no Durations; the kitchen sink (`src/dev/KitchenSinkPlanner.tsx`, `src/dev/kitchen-sink.astro`) builds fixtures through the edit functions.

## Desired End State

- `setDuration` and `setStartDate` are pure edits with named Validation Error rules; clearing either removes the field.
- `validationWarnings(project)` lists every not-Done Task missing a Duration.
- `forecast(project, today)` returns either "withheld" (with the warnings) or both Project Finish Dates plus the base date and why it was chosen; dates after 9999-12-31 come back as "beyond year 9999".
- In the UI: a Duration field in the Task panel; START is selectable by click and keyboard and opens a START panel with the START date; a forecast strip in the header shows the two dates (ISO `yyyy-mm-dd`), the withheld Validation Warning, a "forecasting from today" note, or "Add Tasks to see a forecast"; Task nodes show their Duration or a "No Duration" warning in a new `--warning` token colour.
- Verify: the domain tests pass with the PRD's worked examples; MVP flow steps 4–6 run under `npm run preview` with no console errors.

### Key Discoveries:

- PRD worked example fixes the arithmetic: START 1 Sep, A (5) → B (3) → 9 Sep. A Task starts on the day its predecessors finish; finish = start + Duration as plain date addition (`prd.md:192`).
- PRD Business Logic: "A not-Done Task cannot start before today, so a START date in the past is replaced by today" (`prd.md:192`). The "once all START successors are Done, the START date no longer matters" exception needs no code: a Done Task implies a START date not after today, so the base date is today either way.
- A Task can depend on a Task created after it (`addPredecessor` accepts any acyclic pair, `project.ts:105`), so creation order is not a topological order.
- Rejection messages must not contain "invalid", "conflict" or "blocked" (`project.test.ts:47`), and UI copy must use the exact PRD terms (`PROJECT_RULES.md` → Domain terminology).
- The previous UI change recorded token contrast in its change folder (`context/archive/2026-10-04-planner-ui-contract/tokens.md`), with WCAG luminance computed from OKLCH.

## What We're NOT Doing

- Completion dates, the Statuses UI, and the Done-rule edit and import checks — S-07. The forecast already counts only remaining work: a Done Task contributes 0 days and finishes at the base date. The PRD's Done rules make this exact: START date ≤ completion date ≤ today, so the base date is today whenever a Task is Done. `validationWarnings` exempts Done Tasks by the PRD rule's literal definition. Without this, a Done Task lacking a Duration (possible through an S-03 import before S-07) would pass the withhold check and produce NaN dates.
- Critical-path highlight, critical-path time and total-work time — S-05.
- Weekdays day-counting — S-06. The forecast ignores `dayCountingMode`.
- Export/import and import-time validation of Durations and the START date — S-03 (it reuses the checks exported here).
- An upper cap on Duration — decided against; the forecast guards the date instead, so the PRD's Validation Error list is unchanged.
- Locale-aware date formatting — dates are shown as ISO `yyyy-mm-dd`.
- Refreshing "today" at midnight while the tab stays open with no edits — "today" is read on each render.
- Making FINISH selectable, or clicking the Validation Warning to jump to a Task.

## Implementation Approach

Domain first, UI after. Phase 1 adds date arithmetic, the two edits, Validation Warnings and the forecast as pure modules under `src/lib/services/`, each with colocated tests built on the PRD's examples. Phase 2 wires the edits into the panel and widens selection so START can be selected. Phase 3 makes the result visible: the `--warning` token, the Task node's Duration line and highlight, the forecast strip, and fixtures for the kitchen sink and the 200 ms check.

## Critical Implementation Details

- **Date arithmetic.** Work in whole day numbers from UTC midnight, never in local `Date` arithmetic, so DST cannot shift a day. `Date.UTC` maps years 0–99 to 1900–1999; build day numbers with `setUTCFullYear` (or equivalent) so START dates in years 0001–0099 stay correct, and zero-pad years below 1000 when formatting.
- **Absent, not undefined.** Clearing a Duration or the START date removes the key (`{ start: {} }`, no `duration` property), so `toEqual` comparisons and S-03's round-trip see one representation of "unset".
- **START date commits on change.** A native date input fires `change` for each complete date while the user types the year (0002, 0020, 0202, 2026). Each is a valid date, and a past date already forecasts from today, so committing on every change is harmless; do not add a blur-only commit, because picking from the calendar popup does not blur the input. Emptying one segment of the date (e.g. Backspace on the day) fires a change with value `""`, which clears the START date until the date is complete again; the Clear button and the "Not set" note flash meanwhile. This is accepted: the forecast falls back to today, and `""` must keep clearing, since the browsers' own clear control sends it too.

## Phase 1: Forecast domain

### Overview

Pure, tested domain logic: day arithmetic, the two edits, Validation Warnings and the forecast.

### Changes Required:

#### 1. Calendar dates

**File**: `src/lib/services/calendar-date.ts` (new), `src/lib/services/calendar-date.test.ts` (new)

**Intent**: One place for ISO date parsing, validation, day addition, comparison and "today", so the forecast and the START date edit agree on what a date is.

**Contract**: An ISO date is `yyyy-mm-dd` naming a real calendar date from `0001-01-01` to `9999-12-31` (`MAX_ISO_DATE`). Exports: `isIsoDate(value: string): boolean`; `addDays(date: string, days: number): string | undefined` (undefined when the result is after `MAX_ISO_DATE`); `compareIsoDates(a, b): number` (ISO strings of the fixed 4-digit form also compare lexically); `todayIsoDate(now: Date): string` from the local date components. Tests: leap days (2028-02-29 valid, 2026-02-29 not), month and year rollover, 2026-10-24 + 2 across the EU DST change on 2026-10-25 → 2026-10-26, year 0050, `9999-12-31` + 1 → undefined, `addDays` with a huge safe integer → undefined.

#### 2. Duration and START date edits

**File**: `src/lib/services/project.ts`, `src/lib/services/project.test.ts`

**Intent**: Make Durations and the START date settable only through checked edits that reject at input and name the rule.

**Contract**: `ValidationErrorRule` gains `"duration-not-positive-whole-number"` and `"start-date-not-a-date"`. `setDuration(project, taskId, input: string): EditResult` trims the input; empty clears the Duration; otherwise it must be ASCII digits only and parse to a positive safe integer (`"05"` → 5; `"0"`, `"-1"`, `"2.5"`, `"1e3"`, `"+5"`, `"abc"`, `"9007199254740992"` rejected); unknown Task → `unknown-task`. `setStartDate(project, input: string): EditResult`: empty clears, otherwise `isIsoDate` must hold. Export `isPositiveWholeDays(value: number): boolean` for S-03's import check. Messages, e.g. "A Duration must be a positive whole number of days." and "The START date must be a calendar date from 0001-01-01 to 9999-12-31." Tests use the existing `edit()` frozen-input helper.

#### 3. Validation Warnings

**File**: `src/lib/services/validation-warnings.ts` (new), `src/lib/services/validation-warnings.test.ts` (new)

**Intent**: The single definition of a Validation Warning, used by the forecast, the diagram highlight and the strip.

**Contract**: `type ValidationWarningRule = "duration-missing"`; `interface ValidationWarning { rule; taskId: TaskId; message: string }`; `validationWarnings(project): ValidationWarning[]` — one per Task with `status !== "done"` and no `duration`, in creation order. Message names the Task, e.g. `Design has no Duration.` Tests: none for a fully estimated project; one per missing Task; a Done Task without a Duration raises none (built by hand, since no edit sets Done yet).

#### 4. Forecast

**File**: `src/lib/services/forecast.ts` (new), `src/lib/services/forecast.test.ts` (new); `src/lib/services/task-graph.ts` (topological order helper)

**Intent**: Compute both Project Finish Dates from the graph, the Durations, the START date and today, or withhold them while a Validation Warning exists.

**Contract**:

```ts
export type ForecastDate = { kind: "date"; date: string } | { kind: "beyond-year-9999" };
export type Forecast =
  | { kind: "withheld"; warnings: ValidationWarning[] }
  | {
      kind: "forecast";
      baseDate: string;
      /** Why baseDate was chosen: the START date, or today because START has no date or its date is in the past. */
      baseDateReason: "start-date" | "start-date-unset" | "start-date-in-past";
      resourceUnconstrainedProjectFinishDate: ForecastDate;
      resourceConstrainedProjectFinishDate: ForecastDate;
    };
export function forecast(project: Project, today: string): Forecast;
```

Base date = START date when set and not before today, otherwise today. Each not-Done Task starts at the latest finish of its predecessors (base date when it has none) and finishes at start + Duration; a Done Task is not remaining work and finishes at the base date, whether or not it has a Duration. The Resource-Unconstrained Project Finish Date is the latest Task finish (base date with no Tasks); the Resource-Constrained Project Finish Date is base date + the sum of the Durations of all not-Done Tasks. Tasks are visited in topological order (`topologicalOrder(project): TaskId[]` in `task-graph.ts`, O(tasks + links)). Day sums stay numbers until a single `addDays`, so any overflow becomes `beyond-year-9999`. Tests (today injected):

- PRD example: START 2026-09-01, today 2026-08-20, A (5) → B (3) → both 2026-09-09.
- US-02: START 2026-09-01, A (5) → B (3) → C (2) → both 2026-09-11; add D (4) with A → D → C → Resource-Unconstrained 2026-09-12, Resource-Constrained 2026-09-15; D without Duration → `withheld` with one `duration-missing` warning for D.
- Past START: START 2026-09-01, today 2026-09-05, A (5) → B (3) → base 2026-09-05, `start-date-in-past`, both 2026-09-13. START equal to today → `start-date`. Unset → `start-date-unset`, base = today.
- A Task whose predecessor was created after it gives the same dates as the reverse creation order.
- Two parallel chains: Resource-Unconstrained follows the longer chain.
- Empty project: both dates equal the base date.
- START 9999-12-01: A (30) → `9999-12-31`; A (31) → `beyond-year-9999`; Duration `Number.MAX_SAFE_INTEGER` → `beyond-year-9999` for both.
- PRD Done examples (projects built by hand, since no edit sets Done yet), START 2026-09-01, A (5) → B (3): A Done 2026-09-03, today 2026-09-03 → both 2026-09-06; A Done 2026-09-08, today 2026-09-08 → both 2026-09-11; A Done 2026-09-03, today 2026-09-05 → both 2026-09-08. A Done Task without a Duration gives a forecast, not `withheld` and not NaN.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the new `calendar-date`, `validation-warnings` and `forecast` suites and the new `project` cases
- The forecast suite contains the PRD calendar-day example, the US-02 A/B/C/D case, the past-START case, the empty project, the later-created predecessor, the beyond-year-9999 and the PRD Done cases listed above
- `npm run lint && npx astro check && npm run build` pass

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Editing UI

### Overview

The user can enter a Duration on a Task and select START to set its date.

### Changes Required:

#### 1. Selection model and actions

**File**: `src/hooks/useProject.ts`

**Intent**: Selection can be a Task or START; the two new edits become actions.

**Contract**: `export type Selection = TaskId | "start" | null`. `select(target: Selection)`; state exposes `selection`, `selectedTask` (unchanged meaning) and the new actions `setDuration(taskId, input: string)` and `setStartDate(input: string)`, both through `apply`. A deleted Task still resolves to "nothing selected"; a START selection survives every Task edit. The second parameter `initialSelectedTaskId: TaskId | null` becomes `initialSelection: Selection` (default `null`).

#### 2. START becomes selectable

**File**: `src/lib/services/diagram-layout.ts`, `src/lib/services/diagram-layout.test.ts`, `src/components/planner/StartNode.tsx`, `src/components/planner/TerminalNode.tsx`, `src/components/planner/Diagram.tsx`

**Intent**: START is a tab stop and a click target, styled like a selectable Task node (hover, focus ring, selected ring); FINISH stays inert.

**Contract**: The START node drops `focusable: false, selectable: false`, gets `ariaLabel: "START"` and `ariaRole: "button"`; FINISH keeps both flags `false`. The test at `diagram-layout.test.ts:124` becomes "START follows the diagram settings like a Task node; FINISH is neither focusable nor selectable". `TerminalNode` takes an optional `selected` and an `interactive` flag (the `cursor-default` reset applies only to FINISH). `Diagram` takes `selection: Selection` instead of `selectedTaskId`; `onSelect(target: Selection)` and `onEdit(target: TaskId | "start")` handle START in `handleNodeClick` and `handleKeyDown`. The `ariaLabelConfig` description no longer says "this Task" (e.g. "Press Enter or Space to edit it.").

#### 3. START panel

**File**: `src/components/planner/StartPanel.tsx` (new), `src/components/planner/Planner.tsx`

**Intent**: Selecting START shows its date field; the panel explains what the forecast uses when the date is unset or in the past.

**Contract**: `StartPanel` props: `project`, `today`, `setStartDate`, `focusRequest?`. Content: heading "START"; `Label` "START date" with `<Input type="date">` (min `0001-01-01`, max `9999-12-31`), committing `setStartDate` on change; a "Clear" button when a date is set; the rule message under the field as `role="alert"` on rejection; a muted note — unset: "Not set: the forecast starts from today, <today>."; in the past: "This date is in the past: the forecast starts from today, <today>." `Planner` shows `StartPanel` whenever `selection === "start"` (also with zero Tasks); the `<aside>` label reflects what is shown; `focusRequest` widens to `{ target: TaskId | "start"; id }` and a keyboard selection of START focuses the date input. `today` is computed in `Planner` from `todayIsoDate(new Date())` on each render. `PlannerProps.initialSelectedTaskId?: TaskId` becomes `initialSelection?: Selection`, passed through to `useProject`.

#### 4. Duration field

**File**: `src/components/planner/TaskPanel.tsx`

**Intent**: Enter, change or clear a Task's Duration with the same commit model as the rename field.

**Contract**: Between "Task name" and "Predecessors": `Label` "Duration (days)", `<Input type="text" inputMode="numeric">`, draft from `task.duration`, commit on Enter or blur via `setDuration`, Escape restores, rejection message under the field (`aria-invalid`, `aria-describedby`). When the Task has no Duration a muted note says it is a Validation Warning and both Project Finish Dates are withheld until it has one. `TaskPanelActions` adds `setDuration`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the updated `diagram-layout` assertions (START focusable and selectable, FINISH neither)
- `npm run lint && npx astro check && npm run build` pass

#### Manual Verification:

- In `npm run dev`: typing 5 in Duration and pressing Enter keeps 5; `0`, `-1`, `2.5`, `1e3` and `abc` each show the rule message under the field and leave the Duration unchanged; Escape restores the committed value; clearing the field and pressing Enter removes the Duration
- Clicking START selects it (selected ring) and shows the START panel, also with zero Tasks; clicking FINISH selects nothing; clicking the pane deselects
- From New Task, Tab reaches START with the focus ring, then each Task node; Enter or Space on START puts the caret in START date
- Setting, changing and clearing the START date (picker, typing and the Clear button) works in Chrome, Firefox and Safari; the unset and past-date notes show the expected copy
- Switching selection between START and Tasks swaps the panels; Delete Task still returns focus to New Task

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Forecast display and warnings

### Overview

The forecast and its Validation Warning become visible: a header strip, warned Task nodes, a new token, and fixtures that exercise both.

### Changes Required:

#### 1. Warning token

**File**: `src/styles/global.css`; `context/changes/forecast-finish-dates/tokens.md` (new)

**Intent**: A `--warning` role for Validation Warnings, distinct from `--destructive` (Validation Errors).

**Contract**: `--warning` in `:root` and `.dark` (amber, OKLCH), `--color-warning: var(--warning)` in `@theme inline`. One role used for text, icon and border, so it must reach 4.5:1 against `--card`, `--sidebar` and `--background` in its mode. `tokens.md` records the values and the computed contrast ratios (method as in the archived `planner-ui-contract/tokens.md`).

#### 2. Task node shows Duration or warning

**File**: `src/lib/services/diagram-layout.ts`, `src/lib/services/diagram-layout.test.ts`, `src/components/planner/TaskNode.tsx`

**Intent**: Durations readable at a glance; a Task missing one is highlighted as a Validation Warning.

**Contract**: Task node data becomes `{ name, taskId, duration?: number, durationMissing: boolean }`, with `durationMissing` taken from `validationWarnings` (one definition). `ariaLabel` becomes e.g. "Design, 5 days" or "Design, no Duration (Validation Warning)". The node shows the name and a second line: "5 days" / "1 day" in `text-muted-foreground`, or a warning icon plus "No Duration" in `text-warning` with a `border-warning` border when not selected. `TASK_NODE_HEIGHT` grows (e.g. to 52) so two lines fit. Layout tests cover `durationMissing` and the aria labels.

#### 3. Forecast strip

**File**: `src/components/planner/ForecastSummary.tsx` (new), `src/components/planner/Planner.tsx`

**Intent**: Both Project Finish Dates, or why they are withheld, always visible and updated on every edit.

**Contract**: `ForecastSummary` props: `forecast: Forecast`, `taskCount: number`. Placed at the right of the header (`NewTaskForm` left). A `role="status"` region with four states:

- No Tasks: "Add Tasks to see a forecast."
- Withheld: warning icon + "Validation Warning:" followed by the `message` of the first 3 warnings ("D has no Duration."), then "N more Tasks have no Duration." when there are more, then "Both Project Finish Dates are withheld until every Task has one." (US-02: the warning names the Task.)
- Forecast: a `<dl>` with "Resource-Unconstrained Project Finish Date" and "Resource-Constrained Project Finish Date", each value `<time dateTime="yyyy-mm-dd">yyyy-mm-dd</time>`, or "Beyond year 9999".
- Plus, under the forecast, the base-date note: "START date <date> is in the past: forecasting from today, <today>." or "START date not set: forecasting from today, <today>."
  `Planner` memoises `forecast(project, today)` on `[project, today]`. Copy uses only the exact PRD terms.

#### 4. Fixtures

**File**: `src/lib/services/fixtures.ts`, `src/dev/KitchenSinkPlanner.tsx`, `src/dev/kitchen-sink.astro`

**Intent**: The 200 ms check includes the forecast, and the kitchen sink shows every new state.

**Contract**: `createPerfProject` sets a Duration on every Task (deterministic, e.g. `(id % 5) + 1`) through `setDuration`, so `?fixture=perf100` forecasts. The kitchen-sink small project gets Durations, so existing cells show a forecast. New fixtures and cells: "validation-warning" (one Task without a Duration, that Task selected), "start-selected" (START selected with the fixed past START date 2020-01-01, showing the forecasting-from-today note). The `FIXTURES` entries and their `satisfies` type switch from `selectedTaskId` to `initialSelection: Selection`. The "error" cell action also mentions typing `0` in Duration.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the new `diagram-layout` assertions for `durationMissing` and aria labels
- `npm run lint && npx astro check && npm run build` pass
- The built CSS in `dist/_astro/` defines `--warning` for both `:root` and `.dark` and the `text-warning` / `border-warning` utilities (read the built file, not `global.css`)
- `grep -rnwE "ETA|deadline|Deadline" src` returns nothing

#### Manual Verification:

- MVP flow steps 4–6 under `npm run build && npm run preview`: with START a few weeks ahead and A (5) → B (3) → C (2), both Project Finish Dates equal START + 10 days; adding D with A → D → C withholds them, the strip shows the Validation Warning naming D and D is highlighted; setting D to 4 shows Resource-Unconstrained START + 11 and Resource-Constrained START + 14
- A START date in the past shows the forecasting-from-today note and dates computed from today; clearing it shows the not-set note; an empty project shows "Add Tasks to see a forecast."
- `tokens.md` records `--warning` at 4.5:1 or more against `--card`, `--sidebar` and `--background` in light and dark
- Kitchen sink at 1440 and 1024: the new cells render; the Duration line and "No Duration" are not clipped; a selected warned node still reads as warned
- 200 ms NFR: in `npm run dev` with `?fixture=perf100`, committing a Duration change commits in under 200 ms in the React Profiler
- Browser console under `npm run preview` shows zero CSP violations or errors during the whole flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before archiving.

---

## Testing Strategy

### Unit Tests:

- `calendar-date`: validity bounds, leap years, rollover, DST independence, years below 1000, overflow past 9999-12-31.
- `project`: `setDuration` and `setStartDate` accept, clear and reject per the contracts; inputs are never mutated; messages avoid the forbidden words.
- `validation-warnings`: missing Duration per not-Done Task; Done exemption.
- `forecast`: the PRD and US-02 worked examples, past/unset/today START, topological independence from creation order, parallel chains, empty project, beyond year 9999, the PRD Done examples and a Done Task without a Duration.
- `diagram-layout`: START selectable and focusable, FINISH not; `durationMissing` and aria labels.

### Integration Tests:

- None automated (Vitest covers pure logic only); the kitchen sink and MVP flow steps 4–6 under preview are the integration check.

### Manual Testing Steps:

1. `npm run build && npm run preview`; run MVP flow steps 1–2, then 4–6 as in Phase 3's manual criteria.
2. Select START, set a past date, confirm the note and the dates from today; clear it.
3. Enter each rejected Duration input and confirm the rule message and unchanged project.
4. Check the console for CSP errors.

## Performance Considerations

The forecast and Validation Warnings are O(tasks + links) and run once per project change (`useMemo` on `[project, today]`), next to the dagre layout that already meets the 200 ms NFR for 100 Tasks. The perf fixture gains Durations so the manual 200 ms check includes the forecast.

## Migration Notes

None: no persisted data exists before S-03. Existing projects in memory have no Durations and no START date, which the forecast treats as withheld and today.

## References

- PRD: `context/foundation/prd.md` (US-02, FR-004, FR-006, FR-009, FR-012, Business Logic)
- Roadmap: `context/foundation/roadmap.md` → S-04
- Edit pattern: `src/lib/services/project.ts:67-126`, `src/lib/services/project.test.ts:27-48`
- Commit-on-blur field pattern: `src/components/planner/TaskPanel.tsx:62-90`
- Layout and START/FINISH flags: `src/lib/services/diagram-layout.ts:43-72`
- Token contrast precedent: `context/archive/2026-10-04-planner-ui-contract/tokens.md`

## Addendum (implementation review, 2026-10-05)

Recorded after `reviews/impl-review.md`; these supersede the sections they name.

- **START date commit timing** (supersedes Critical Implementation Details → "START date commits on change"): `StartPanel` keeps a draft. Typed changes commit on Enter or blur, and Escape restores the committed date. A change that follows no key press in the field (a pick from the calendar popup) commits at once, so the popup still works without a blur. Typing a year no longer commits 0002, 0020 and 0202 as real edits; under S-07 those would break the Done rules mid-typing, and under S-08 they would count as unexported changes.
- **ForecastSummary** (Phase 3 §3): the props are `forecast`, `tasks` (for the Task names and count) and `startDate: string | undefined`, because the "START date <date> is in the past" note names the date and `Forecast` does not carry it. The withheld state no longer names Tasks inline, so the header keeps its height: line one is "Validation Warning: N Task(s) without Duration." as a button whose tooltip (shadcn `Tooltip` on `@radix-ui/react-tooltip`) lists the Tasks as "7: Name" (`taskLabel` from `project.ts`) on hover or focus; line two is "Forecast not possible until every Task has one.", replacing "Both Project Finish Dates are withheld until every Task has one."
- **Duration note removed** (Phase 2 §4): the Task panel shows no note when a Task has no Duration. The header strip counts the Tasks without a Duration and lists them on hover, and the node is highlighted, so the note was redundant.
- **START node shows its date** (Phase 2 §2): a second line in the START pill shows the START date as ISO `yyyy-mm-dd`, or "today" when it is unset; the node's aria label is "START, <date>" or "START, today". A past date is shown as set, while the forecast uses today. `Diagram` adds the date in the same second pass as the selection, so a START date edit still does not re-run layout.
- **Side panel label** (Phase 2 §3): the `<aside>` is labelled "START" when START is selected and "Selected Task" otherwise, including the empty and nothing-selected states. The START panel's `<h2>` is a plain heading, not a second labelled region.
- **setStartDate** (Phase 1 §2) trims its input, as `setDuration` does.
- **Diagram layout** is memoised on `project.tasks`, not on `project`, so a START date edit does not re-run the dagre layout. `layoutDiagram` and `validationWarnings` take `Pick<Project, "tasks">`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Forecast domain

#### Automated

- [x] 1.1 `npm test` passes, including the new `calendar-date`, `validation-warnings` and `forecast` suites and the new `project` cases — 17f54a3
- [x] 1.2 The forecast suite contains the PRD calendar-day example, the US-02 A/B/C/D case, the past-START case, the empty project, the later-created predecessor, the beyond-year-9999 and the PRD Done cases listed above — 17f54a3
- [x] 1.3 `npm run lint && npx astro check && npm run build` pass — 17f54a3

### Phase 2: Editing UI

#### Automated

- [x] 2.1 `npm test` passes, including the updated `diagram-layout` assertions (START focusable and selectable, FINISH neither) — a055fe7
- [x] 2.2 `npm run lint && npx astro check && npm run build` pass — a055fe7

#### Manual

- [x] 2.3 In `npm run dev`: typing 5 in Duration and pressing Enter keeps 5; `0`, `-1`, `2.5`, `1e3` and `abc` each show the rule message under the field and leave the Duration unchanged; Escape restores the committed value; clearing the field and pressing Enter removes the Duration — a055fe7
- [x] 2.4 Clicking START selects it (selected ring) and shows the START panel, also with zero Tasks; clicking FINISH selects nothing; clicking the pane deselects — a055fe7
- [x] 2.5 From New Task, Tab reaches START with the focus ring, then each Task node; Enter or Space on START puts the caret in START date — a055fe7
- [x] 2.6 Setting, changing and clearing the START date (picker, typing and the Clear button) works in Chrome, Firefox and Safari; the unset and past-date notes show the expected copy — a055fe7
- [x] 2.7 Switching selection between START and Tasks swaps the panels; Delete Task still returns focus to New Task — a055fe7

### Phase 3: Forecast display and warnings

#### Automated

- [x] 3.1 `npm test` passes, including the new `diagram-layout` assertions for `durationMissing` and aria labels — 52afdd6
- [x] 3.2 `npm run lint && npx astro check && npm run build` pass — 52afdd6
- [x] 3.3 The built CSS in `dist/_astro/` defines `--warning` for both `:root` and `.dark` and the `text-warning` / `border-warning` utilities (read the built file, not `global.css`) — 52afdd6
- [x] 3.4 `grep -rnwE "ETA|deadline|Deadline" src` returns nothing — 52afdd6

#### Manual

- [x] 3.5 MVP flow steps 4–6 under `npm run build && npm run preview`: with START a few weeks ahead and A (5) → B (3) → C (2), both Project Finish Dates equal START + 10 days; adding D with A → D → C withholds them, the strip shows the Validation Warning naming D and D is highlighted; setting D to 4 shows Resource-Unconstrained START + 11 and Resource-Constrained START + 14 — 52afdd6
- [x] 3.6 A START date in the past shows the forecasting-from-today note and dates computed from today; clearing it shows the not-set note; an empty project shows "Add Tasks to see a forecast." — 52afdd6
- [x] 3.7 `tokens.md` records `--warning` at 4.5:1 or more against `--card`, `--sidebar` and `--background` in light and dark — 52afdd6
- [x] 3.8 Kitchen sink at 1440 and 1024: the new cells render; the Duration line and "No Duration" are not clipped; a selected warned node still reads as warned — 52afdd6
- [x] 3.9 200 ms NFR: in `npm run dev` with `?fixture=perf100`, committing a Duration change commits in under 200 ms in the React Profiler — 52afdd6
- [x] 3.10 Browser console under `npm run preview` shows zero CSP violations or errors during the whole flow — 52afdd6
