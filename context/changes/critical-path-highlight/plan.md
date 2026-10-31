# Critical Path Highlight Implementation Plan

## Overview

Roadmap slice S-05 (FR-010, FR-011): highlight the critical path(s) of the remaining (not-Done) work on the diagram, and show the critical-path time and the total-work time of that work under the two Project Finish Dates, whenever the project has no Validation Warning. Both views read one new domain calculation, which `forecast()` is rebuilt on, so the longest path through the remaining work is computed in exactly one place.

## Current State Analysis

- `forecast()` (`src/lib/services/forecast.ts:84-127`) already walks the remaining work in topological order and computes the critical-path length (`latestFinishDay`) and the total-work length (`totalRemainingDays`), then discards both after turning them into the two Project Finish Dates. It keeps no per-Task start or finish, so it cannot say which Tasks are critical.
- The domain Diagram (`src/lib/services/diagram.ts`) derives what each node shows: `projectNodes` calls `validationWarnings` and sets `durationMissing` plus the "(Validation Warning)" accessible name. `TaskDiagramNode` and `DiagramEdge` have no `critical` flag; the anti-corruption-layer design reserved exactly that (`context/domain/03-anti-corruption-layer.md:283`, `:395`).
- `Diagram.tsx:58-61` memoizes layout on `[tasks, dayCountingMode]` and applies selection and the START date in a cheap second pass, so a START date edit never re-runs layout.
- `flow-elements.ts:61-68` gives every edge `markerEnd: { type: MarkerType.ArrowClosed }`; arrowheads follow `--xy-edge-stroke` only because `Diagram.tsx` passes `defaultMarkerColor={null}`.
- `TaskNode.tsx` draws the selected border (`border-primary ring-primary/30 ring-2`), otherwise the warned border (`border-warning`), otherwise a hover border.
- `ForecastSummary.tsx` shows the two Project Finish Dates in a `<dl>`, plus up to two notes, inside a `role="status"` region.
- The `--warning` precedent (`context/archive/2026-10-04-forecast-finish-dates/plan.md:201-215`, `tokens.md`): a role token in `:root` and `.dark`, published via `@theme inline`, its contrast recorded in a change-folder `tokens.md`, its state in the accessible name, a kitchen-sink cell per new state, and the built CSS checked for the token.
- Test-plan hand-offs to this slice: Risk #6 (`context/foundation/test-plan.md:31`, `:44`, `:182`): the remaining-work times are withheld while warned and restored after, as a row in the `Planner` test; §6.1: oracle rows in `prdExamples` with hand-derived expected values; §7: no pixel snapshots, so the highlight is proven through accessible names and classes.
- `context/domain/01-domain-distillation.md:186` (RK-02): done when a test with two equal-length critical paths asserts both are returned, the Resource-Unconstrained Project Finish Date equals the base date plus the critical-path time, and a search for `startDay + duration` finds one place.

## Desired End State

With every not-Done Task carrying a Duration:

- Every Task on any longest chain of remaining work has a border in the new `--critical-path` colour, and its accessible name ends ", on the critical path".
- Every edge on a longest chain, including the START edge into its first Task and the FINISH edge out of its last, is drawn thicker in `--critical-path`, with an arrowhead of the same colour. Every other edge stays as it is, including an edge between two critical Tasks that is not on a longest chain.
- Below the two Project Finish Dates, one line reads e.g. "Critical-path time 8 days · Total-work time 11 days" (units follow the day-counting mode). A small swatch in `--critical-path` sits beside "Critical-path time" and serves as the diagram's legend.

While any Validation Warning exists, nothing is highlighted and the line is absent, along with both Project Finish Dates. An empty project shows neither.

Verify: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`, then the kitchen sink at `/kitchen-sink` under `npm run dev`.

### Key Discoveries:

- Which Tasks are critical depends only on the Tasks (Durations, Statuses, predecessors), never on the START date or today: the base date shifts every remaining Task by the same offset. So criticality can be computed inside the existing layout memo, the same way `projectNodes` calls `validationWarnings` (`src/lib/services/diagram.ts:139`). No change to the memo keys, and a START date edit still never re-runs layout.
- `topologicalOrder` throws on a cycle (`src/lib/services/task-graph.ts:177`). `validationWarnings` and `projectDiagram` take `Pick<Project, …>`, not `CheckedProject`; the new calculation follows that precedent and inherits the documented throw.
- React Flow draws an edge's path with `stroke: var(--xy-edge-stroke, …)` and `stroke-width: var(--xy-edge-stroke-width, …)` (`@xyflow/react/dist/style.css:139-140`). Setting those two variables on an edge class themes the critical path through the documented route.
- Arrowheads are shared SVG `<marker>` defs whose id is derived from the marker object (`@xyflow/system` `getMarkerId`), coloured through an inline `style` on the polyline (`@xyflow/react` `ArrowClosedSymbol`). CSS on the edge cannot reach them, so a critical edge needs its own marker object with `color`. Markers use `markerUnits="strokeWidth"`, so a thicker stroke also enlarges the arrowhead unless `width`/`height` compensate.
- `forecast.test.ts` `prdExamples` asserts the whole forecast with `toStrictEqual` (`forecast.test.ts:265-285`), so adding two fields to the forecast forces every row to state its times, which is the oracle coverage we want.

## What We're NOT Doing

- No per-Task slack or float shown anywhere, and no "on the critical path" line in the Task side panel.
- No near-critical highlighting, and no ranking among equal-length critical paths: every Task and edge on any longest chain is highlighted the same way.
- No highlight while a Validation Warning exists (Durations are missing, so no longest chain is known). The warned Tasks are highlighted instead, as today.
- No decision on what an all-Done project shows (critical-path time 0, nothing highlighted, by construction). The copy for that case is S-07's, which owns the all-Done Unknown in the roadmap; Done Tasks cannot be set through an edit yet.
- No change to the file format: `serializeProject`, `parseProjectFile`, the golden files in `src/lib/services/golden/` and the file version stay untouched. The times and the highlight are derived and never saved.
- No edits to `src/components/planner/Planner.tsx` or `src/hooks/useProject.ts`. None are needed: `ForecastSummary` already receives the forecast, and `Diagram` the project. No edits to `ProjectControls.tsx`, `RenderCrashFallback.tsx` or the state's "exported" marker either, since those belong to S-08 (see Critical Implementation Details → Parallel work).
- No Playwright test: no CSP, file or browser-only behaviour is involved, and §7 of the test plan rules out pixel snapshots.
- No dark-mode toggle (the canvas stays `colorMode="light"`), though the token gets a `.dark` value like every other role.

## Implementation Approach

Domain first: one function, `remainingWork`, computes the earliest start and finish of each remaining Task, the critical-path time, the total-work time, the critical Tasks and the critical links. `forecast()` is rebuilt on it and adds the two times to its result. The diagram then calls the same function in `projectDiagram` to set `critical` flags and accessible names, and the React Flow adapter maps those flags to a CSS class and a coloured marker. Last, `ForecastSummary` reads the two times from the forecast. Phases 2 and 3 depend only on Phase 1.

## Critical Implementation Details

- **Critical-link rule.** A Task is critical when its earliest start equals its latest start (zero slack, from a forward and a backward pass over the remaining work). A dependency edge `u → v` is critical only when both are critical **and** `u` finishes on the day `v` starts. Two critical endpoints are not enough: in START→A(3)→B(1)→C(3)→FINISH plus A→C, A, B and C are critical but A→C is not. A `hangs-off-start` edge is critical when its Task is critical; a `feeds-finish` edge is critical when its Task is critical (a critical Task without successors finishes on the last day by definition). A Done Task is never critical, so no edge from a Done Task is highlighted.
- **Too large to count.** Each Duration is a safe integer (`isPositiveWholeDays`, `src/lib/services/project.ts:260`), but sums can pass `Number.MAX_SAFE_INTEGER` and lose precision. A time that is not a safe integer is reported as "too large" and reads "Too large to count". When the critical-path time is too large, no Task or edge is marked critical, because equality comparisons are no longer exact. This mirrors the existing "Beyond year 9999" handling, so a misleading value is never shown.
- **Arrowhead exception to the UI rule.** PROJECT_RULES says canvas colours are changed in `global.css`, not in props. The arrowhead is the one place React Flow offers no CSS route, so `flow-elements.ts` passes `color: "var(--critical-path)"` on the critical edge's marker. That references the token, so the value still lives only in `global.css`. Say so in a comment at that line.
- **Parallel work.** This change runs alongside S-08 (`start-new-project`), so the two must not edit the same files.
  - S-05 stays in the forecast service (`remaining-work.ts`, `forecast.ts`), the diagram (`diagram.ts`, `src/components/planner/diagram/`, the `--critical-path` token in `global.css`) and `ForecastSummary.tsx`.
  - S-08 owns `ProjectControls.tsx`, `RenderCrashFallback.tsx` and a small "exported" marker in state.
  - `Planner.tsx` and `useProject.ts` get no S-05 edit. If one turns out to be needed, keep it to a few lines and say so in the phase's commit message.
  - Shared files that both changes may touch get additive edits only: `Planner.test.ts` (extend the one existing test named in Phase 3), the kitchen sink files (add one cell) and `context/foundation/test-plan.md` (change only the Risk #6 sentence). No reformatting or reordering of the surrounding content, so a merge stays trivial.
- **No layout shift on the node.** The critical border must not change the 180×52 Task box. Use the border colour plus a ring (the selected style already combines border and ring), not a wider border. A selected critical node keeps the selection style, as a selected warned node does.

## Phase 1: Remaining-work schedule

### Overview

One domain function computes the schedule of the remaining work. `forecast()` uses it and returns the two times next to the two Project Finish Dates.

### Changes Required:

#### 1. Remaining-work schedule

**File**: `src/lib/services/remaining-work.ts` (new), `src/lib/services/remaining-work.test.ts` (new)

**Intent**: The single longest-path calculation over the remaining work, shared by the forecast and the diagram, so the highlighted path, the times and the Resource-Unconstrained Project Finish Date can never disagree.

**Contract**: `remainingWork(project: Pick<Project, "tasks">): RemainingWork`, where `RemainingWork` is `{ kind: "withheld" }` when `validationWarnings(project)` is non-empty, else `{ kind: "scheduled"; criticalPathTime: RemainingWorkTime; totalWorkTime: RemainingWorkTime; criticalTaskIds: ReadonlySet<TaskId>; criticalLinks: ReadonlySet<\`${TaskId}->${TaskId}\`>; }`, where `criticalPathTime`and`totalWorkTime`are both`RemainingWorkTime = { kind: "days"; days: number } | { kind: "too-large" }`. Days are whole-day offsets from the base date in the project's unit; the base date is not an input. Done Tasks finish at offset 0 and are never critical. A Task is critical when its slack is zero; `criticalLinks`holds`predecessorId->taskId`for each dependency on a longest chain (rule in Critical Implementation Details). Too-large times empty both sets. It throws on a cycle, as`topologicalOrder`does, and the doc comment says so.`startDay + duration` lives here and nowhere else.

#### 2. Forecast built on it

**File**: `src/lib/services/forecast.ts`

**Intent**: `forecast()` stops walking the graph itself and derives both Project Finish Dates from `remainingWork`, and it exposes the two times so the header can show them.

**Contract**: the `kind: "forecast"` variant gains `criticalPathTime: RemainingWorkTime` and `totalWorkTime: RemainingWorkTime`. `resourceUnconstrainedProjectFinishDate` is the base date plus `criticalPathTime`, and `resourceConstrainedProjectFinishDate` the base date plus `totalWorkTime`. A too-large time gives `{ kind: "beyond-year-9999" }`. The withheld variant and `forecastBaseDate` are unchanged. The existing "Done Task finishes on the base date" comment moves to `remaining-work.ts`.

#### 3. Oracle tests

**File**: `src/lib/services/forecast.test.ts`, `src/lib/services/remaining-work.test.ts`

**Intent**: Prove the schedule against values derived by hand from the PRD, never with production helpers (§6.1).

**Contract**: every `prdExamples` row gains `criticalPathTime` and `totalWorkTime` as literal day counts (the Done rows built by hand count only B). The US-02 step test asserts the times after D gets its Duration (A5 → B3 → C2 and A → D4 → C: critical-path time 11, total-work time 14). `remaining-work.test.ts` covers:

- a chain, where every Task and link is critical;
- two equal-length parallel branches, where both are critical (RK-02), plus a test that the Resource-Unconstrained Project Finish Date equals the base date plus the critical-path time;
- the A(3)→B(1)→C(3) plus A→C case, where A→C is not a critical link;
- a shorter parallel branch, which is not critical;
- a Done predecessor built by hand, which is excluded, with its successor starting at 0;
- withheld while warned;
- an empty project (0 days, nothing critical);
- two Durations of `Number.MAX_SAFE_INTEGER`, giving too-large times and empty sets.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/services/remaining-work.test.ts src/lib/services/forecast.test.ts` passes
- `grep -rn "startDay + duration" src/lib/services --include=*.ts | grep -v test` finds exactly one line, in `remaining-work.ts`
- `npm run lint && npx astro check && npm test` pass

#### Manual Verification:

- Optional selective mutation run on `remaining-work.ts` (`npm run test:mutation -- --mutate "src/lib/services/remaining-work.ts"`); every survivor that would be a user-visible bug (a wrong critical Task or link, a wrong time) gets an assertion, others are noted and left

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Critical path on the diagram

### Overview

The domain Diagram marks critical Tasks and edges; a new `--critical-path` token colours them, and the accessible name announces them.

### Changes Required:

#### 1. Critical flags in the domain Diagram

**File**: `src/lib/services/diagram.ts`, `src/lib/services/diagram.test.ts`

**Intent**: Decide in the domain which nodes and edges are critical and what that sounds like, so the view only draws it.

**Contract**: `TaskDiagramNode` and `DiagramEdge` gain `critical: boolean`. `projectNodes` and `projectEdges` call `remainingWork` once per `projectDiagram`; `withheld` marks nothing. Edge rule: a `dependency` edge is critical when its link is in `criticalLinks`; a `hangs-off-start` or `feeds-finish` edge is critical when its Task is critical. The empty project's START→FINISH edge is never critical. `taskAccessibleName` appends ", on the critical path" for a critical Task (a warned Task is never critical). Tests cover the flags on the A→C example including the START and FINISH edges, both branches of a tie, nothing while warned, the accessible name, and an unchanged empty-project Diagram.

#### 2. `--critical-path` token

**File**: `src/styles/global.css`, `context/changes/critical-path-highlight/tokens.md` (new)

**Intent**: A role that means only "on the critical path", visually distinct from `--warning` (amber), `--destructive` (red), the grey edges and the near-black selection, added where every role lives.

**Contract**:

- `--critical-path` gets a value in `:root` and in `.dark`, in a hue away from amber and red (e.g. a saturated blue or violet in OKLCH), plus `--color-critical-path` in `@theme inline`.
- In the `.react-flow` section, a `.react-flow__edge.critical-path` rule sets `--xy-edge-stroke: var(--critical-path)` and `--xy-edge-stroke-width: 2`.
- `tokens.md` records both values and the contrast ratios, computed by the method in `context/archive/2026-10-04-forecast-finish-dates/tokens.md`:
  - at least 3:1 against `--muted` (the canvas, for edges);
  - at least 3:1 against `--card` (node borders);
  - the hue distinction from `--warning`, `--destructive` and `--muted-foreground`.

#### 3. React Flow mapping and Task node

**File**: `src/components/planner/diagram/flow-elements.ts`, `src/components/planner/diagram/flow-elements.test.ts`, `src/components/planner/diagram/TaskNode.tsx`

**Intent**: Translate the `critical` flag into what React Flow draws, keeping all knowledge of React Flow in this folder.

**Contract**:

- A critical edge gets `className: "critical-path"` and `markerEnd: { type: MarkerType.ArrowClosed, color: "var(--critical-path)" }`. Set `width`/`height` on that marker if needed, so the arrowhead does not double in size with the 2-unit stroke. A comment there notes the documented exception (Critical Implementation Details).
- A non-critical edge keeps today's object unchanged.
- `TaskNode`, when not selected and critical, draws `border-critical-path` plus a `ring-critical-path` ring with no change to the box. The order is selected, then warned, then critical, then hover.
- `flow-elements.test.ts` asserts:
  - the class and the marker colour on a critical edge;
  - the unchanged non-critical edge;
  - the accessible name reaching `ariaLabel`.

#### 4. Kitchen sink

**File**: `src/dev/KitchenSinkPlanner.tsx`, `src/dev/kitchen-sink.astro`

**Intent**: Show the new state next to the others for the visual check.

**Contract**: a `critical-path` cell built through the edit functions, holding two equal-length critical branches, a shorter non-critical branch and a non-critical link between two critical Tasks (the A→C shape), with one critical Task selected.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/services/diagram.test.ts src/components/planner/diagram/flow-elements.test.ts` passes
- `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` pass
- The built CSS in `dist/_astro/*.css` defines `--critical-path` in both `:root` and `.dark`, and contains `.border-critical-path`, `.ring-critical-path` and the `.react-flow__edge.critical-path` rule (checked on the artifact, per lessons.md)

#### Manual Verification:

- At `/kitchen-sink` (1440 and 1024 wide), the `critical-path` cell shows both equal branches highlighted end to end, from START through to FINISH, with arrowheads in the critical colour and of normal size. The shorter branch and the A→C-shaped link stay grey.
- A selected critical Task still reads as selected; the `validation-warning` cell shows no critical highlight; the critical colour is clearly distinct from the amber warning and from the selection
- `tokens.md` records both values and ratios at or above 3:1

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Remaining-work times in the header

### Overview

`ForecastSummary` shows the two times on one line under the Project Finish Dates, with a swatch that explains the diagram's colour, and the test plan records that Risk #6 now covers them.

### Changes Required:

#### 1. Times line

**File**: `src/components/planner/ForecastSummary.tsx`, `src/components/planner/ForecastSummary.test.ts`

**Intent**: Show FR-011's two times wherever the Project Finish Dates are shown, and nowhere else, using the PRD's terms.

**Contract**:

- In the `kind: "forecast"` branch only, add one line after the dates and before the notes:
  - `Critical-path time <value> · Total-work time <value>`, with each value from `formatDuration(days, forecast.dayCountingMode)`, or "Too large to count" for a too-large time.
  - A decorative swatch (`aria-hidden`, `bg-critical-path`) before "Critical-path time".
- The labels are muted like the date labels and the values are `tabular-nums`. The line lives inside the existing `role="status"` region.
- Static-render tests from a real `forecast()` result cover:
  - the line in calendar days;
  - weekday units in weekdays mode;
  - no line while withheld;
  - no line for an empty project.

#### 2. Planner withheld-and-restored row (Risk #6)

**File**: `src/components/planner/Planner.test.ts`

**Intent**: Prove the times, like the dates, disappear while a Validation Warning exists and return with fresh values, so a stale memoized value cannot survive.

**Contract**: extend "withholds both Project Finish Dates while A lacks a Duration, then shows new ones once it has one" (`Planner.test.ts:86`). Following §6.2, with a far-future START date, assert:

- the times line first;
- no "Critical-path time" or "Total-work time" text in the status region while warned;
- the new values after A gets a different Duration.

Also assert the critical Task's accessible name on the diagram before and after.

#### 3. Docs

**File**: `context/foundation/test-plan.md`, `context/domain/glossary.md`

**Intent**: Keep the test plan and the glossary true once the times and the highlight exist.

**Contract**:

- In the test plan's Risk #6 guidance row, replace "The remaining-work times (FR-011) are owned by roadmap S-05, not yet built" with a statement that they are withheld and restored with the dates, covered by `ForecastSummary.test.ts` and the `Planner` test.
- In the glossary, the "Critical path" and "Critical-path time / total-work time" rows lose "Not built yet" and name `remainingWork`, `criticalTaskIds`/`criticalLinks`, `criticalPathTime` and `totalWorkTime` as their code terms.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/components/planner/ForecastSummary.test.ts src/components/planner/Planner.test.ts` passes
- `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` pass
- `git diff --stat main...HEAD -- src/components/planner/Planner.tsx src/hooks/useProject.ts src/components/planner/ProjectControls.tsx src/components/planner/RenderCrashFallback.tsx src/lib/services/project-file.ts src/lib/services/golden/` prints nothing (no S-08 file, state hook or file format touched)

#### Manual Verification:

- Under `npm run build && npm run preview`, the header shows "Critical-path time … · Total-work time …" in one line under the dates, and the swatch matches the diagram's critical colour. Clearing a Duration removes the line and the highlight together, and setting the Duration back restores both.
- Switching Day counting to Weekdays changes the units in the times line to weekdays.
- At 1024 wide the header still wraps cleanly with the extra line and leaves the diagram usable

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `remaining-work.test.ts`: chain, tie, A→C non-critical link, shorter branch, Done predecessor, withheld, empty, too large. Expected sets and day counts are written by hand.
- `forecast.test.ts`: every `prdExamples` row states both times. US-02 step test: 11 and 14 days after D gets 4 days. The Resource-Unconstrained Project Finish Date is the base date plus the critical-path time.
- `diagram.test.ts`: the critical flags on nodes and on all three edge kinds, and the accessible-name suffix.
- `flow-elements.test.ts`: the class and marker on critical edges only.
- `ForecastSummary.test.ts`: the line, units, absence while withheld or empty.

### Integration Tests:

- `Planner.test.ts` (jsdom): times and the critical accessible name withheld while A lacks a Duration, restored with new values.

### Manual Testing Steps:

1. Kitchen sink `critical-path` cell at 1440 and 1024: both equal branches highlighted START to FINISH; shorter branch and A→C link grey; arrowheads in colour and normal size; selected critical Task reads as selected.
2. Preview build: add A(5)→B(3)→C(2), then D(4) between A and C. Check that the highlight moves to A→D→C and the line reads 11 / 14 days. Clear D's Duration: the line, the dates and the highlight disappear, and D is warned.
3. Switch to Weekdays: units change in the line and on the nodes, and the highlight is unchanged.

## Performance Considerations

`remainingWork` is O(tasks + links) and runs in the existing layout memo and the existing forecast memo, so each edit adds two linear passes for a 100-Task project, well inside the 200 ms NFR. No memo keys change, so START date edits still skip layout.

## Migration Notes

None: the exported file format and the project model are unchanged.

## References

- PRD FR-010, FR-011, Business Logic: `context/foundation/prd.md`
- Roadmap S-05: `context/foundation/roadmap.md`
- RK-02, INV-17, DR-10: `context/domain/01-domain-distillation.md:186`
- Diagram design reserving `critical`: `context/domain/03-anti-corruption-layer.md:283`, `:395`
- `--warning` precedent: `context/archive/2026-10-04-forecast-finish-dates/plan.md:201-215`, `tokens.md`
- Canvas tokens and edge contrast: `context/archive/2026-10-04-planner-ui-contract/tokens.md`
- Test-plan Risk #6 and §6.1, §6.2, §7: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Remaining-work schedule

#### Automated

- [x] 1.1 `npx vitest run src/lib/services/remaining-work.test.ts src/lib/services/forecast.test.ts` passes
- [x] 1.2 `startDay + duration` appears in exactly one non-test line, in `remaining-work.ts`
- [x] 1.3 `npm run lint && npx astro check && npm test` pass

#### Manual

- [x] 1.4 Optional selective mutation run on `remaining-work.ts`, user-visible survivors covered

### Phase 2: Critical path on the diagram

#### Automated

- [ ] 2.1 `npx vitest run src/lib/services/diagram.test.ts src/components/planner/diagram/flow-elements.test.ts` passes
- [ ] 2.2 `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` pass
- [ ] 2.3 Built CSS defines `--critical-path` in both modes and contains the border, ring and edge rules

#### Manual

- [ ] 2.4 Kitchen sink `critical-path` cell at 1440 and 1024: both equal branches highlighted START to FINISH, shorter branch and A→C link grey, arrowheads coloured and normal size
- [ ] 2.5 Selected critical Task reads as selected; warned cell shows no highlight; critical colour distinct from warning and selection
- [ ] 2.6 `tokens.md` records both values and ratios at or above 3:1

### Phase 3: Remaining-work times in the header

#### Automated

- [ ] 3.1 `npx vitest run src/components/planner/ForecastSummary.test.ts src/components/planner/Planner.test.ts` passes
- [ ] 3.2 `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` pass
- [ ] 3.6 No diff against `main` in `Planner.tsx`, `useProject.ts`, `ProjectControls.tsx`, `RenderCrashFallback.tsx`, `project-file.ts` or the golden files

#### Manual

- [ ] 3.3 Preview build: times line under the dates, swatch matches the diagram, cleared Duration removes line and highlight, restored Duration brings both back
- [ ] 3.4 Weekdays mode shows weekday units in the times line
- [ ] 3.5 At 1024 wide the header wraps cleanly and the diagram stays usable
