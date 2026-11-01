# Progress-Aware Forecast (S-07) Implementation Plan

## Overview

Roadmap slice S-07 (US-04, FR-005, FR-019, FR-014): a user can set a Task's Status (To Do, In Progress, Done) with a completion date for Done, and sees both Project Finish Dates recalculated from today and the actual completion dates. Every edit that breaks a Done rule, directly or indirectly, is rejected with an explanation naming the rule, and an imported file that breaks one is rejected too. This plan brings the Done rules into the Project aggregate's guardian (with `today` threaded through it), adds the two Status edits, lifts the import gate `task-status-not-supported-yet`, makes the forecast progress-aware for the cases the PRD leaves open, and shows Status in the side panel and on the diagram. As its last step it bumps the project file version from `"0.1"` to `"1.0"`, marking the MVP file schema and closing the version clause of M-1's "Done when".

## Current State Analysis

- **Forecast arithmetic already handles the PRD examples.** A Done Task counts as finishing at offset 0 from the base date and is left out of remaining work (`src/lib/services/remaining-work.ts:83-86`); the base date is today whenever the START date is unset or in the past (`src/lib/services/forecast.ts:43-54`). Traced against the code, the four US-04 examples give 9 Sep, 6 Sep, 11 Sep and 8 Sep (research.md "Forecast and remaining work"). This is exact only while the Done rules hold (`remaining-work.ts:52-58`).
- **The Done rules are missing.** `ValidationErrorRule` (`src/lib/services/project.ts:21-38`) has no Status or completion-date rule; there is no `setStatus`/`setCompletionDate`; `createTask` hard-codes `status: "to-do"` (`project.ts:182`); import refuses any Status other than To Do and any `completionDate` through `checkSupportedYet` (`src/lib/services/project-file.ts:353-369`, called at `:377`).
- **The guardian is built for them.** Every edit ends in `accept` (`project.ts:64-69`), which walks `TASK_CHECKS` per Task (`:382-404`) then `PROJECT_CHECKS` (`:410-428`); import uses the same walk through `checkProject` (`:170`, `project-file.ts:378`). A Done rule added as a `TASK_CHECKS` entry rejects indirect edits (`addPredecessor`, `setStartDate`, reverting a Done predecessor) and import with no rule code in those functions — the plan the invariant-aggregate refactor left for S-07 (`context/archive/2026-10-19-invariant-aggregate-refactor/plan.md:31, :40-41`).
- **`today` reaches no guardian door.** `accept`, `checkProject`, `toCheckedProject`, `validateProject` (`project.ts:64, :170, :175, :452`) and `parseProjectFile(text)` (`project-file.ts:389`) take no date; the clock is read once per render in `Planner.tsx:124`. The upstream design (`context/domain/02-invariant-aggregate-refactor.md:185-203`) gives every edit an `EditContext { today }`; it was deferred to S-07 and not built.
- **UI has no Status anywhere.** TaskPanel fields are name, Duration, predecessors, Delete (`src/components/planner/TaskPanel.tsx:159-299`); the diagram node has no Status (`src/lib/services/diagram.ts:46-56`, `taskAccessibleName` `:128-137`, `src/components/planner/diagram/TaskNode.tsx:22-50`). The withheld copy "Forecast not possible until every Task has one." (`src/components/planner/ForecastSummary.tsx:117`) is wrong once Done Tasks need no Duration; the legend swatch shows at 0 days (`:38-40`).

## Desired End State

- A user selects a Task, picks **Done** in its Status select, and the Task is Done with today as its completion date in one edit; a Completion date field then lets them backdate it. Picking To Do or In Progress removes the completion date.
- Every Done rule from the PRD, plus "only a Done Task has a completion date", is a Validation Error decided in exactly one guardian entry (`TASK_CHECKS` for a Task alone, `PROJECT_CHECKS` after `cycle` for a Task and its predecessors). Direct and indirect edits that break one are rejected with a message naming the rule and the Task(s) involved; files that break one are rejected on import.
- A file with In Progress and Done Tasks and completion dates round-trips byte for byte; `project-file-0.1-statuses.json` proves it until Phase 8 replaces it with `project-file-1.0.json`.
- Export writes `"version": "1.0"`, the MVP file schema; import reads both `"0.1"` and `"1.0"` files, and `project-file-1.0.json` is the golden file `serializeProject` must match byte for byte.
- The forecast follows US-04. When every direct successor of a past START date is Done, the note says so rather than calling the START date "in the past". When every Task is Done, both Project Finish Dates are the latest completion date, the note says "Every Task is Done.", and the legend swatch is hidden.
- The diagram shows Done Tasks (muted, check icon, "Done 2026-09-03") and In Progress Tasks (marker after the Duration), in their accessible names too.
- Verify: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp && npm run test:e2e` all green; the kitchen sink shows the new states.

### Key Discoveries:

- The Done rules are load-bearing for forecast correctness, not just data hygiene: "Done = offset 0 from the base date" is exact only under START ≤ completion ≤ today (`remaining-work.ts:52-58`; S-04 plan-review F1, `context/archive/2026-10-04-forecast-finish-dates/reviews/plan-review.md:27-45`).
- `start-date-not-a-date` is a `PROJECT_CHECKS` entry (`project.ts:411`), run after every Task check, so a per-Task "before the START date" check can meet a malformed START date.
- `addWeekdays` throws on a Saturday or Sunday (`src/lib/services/calendar-date.ts:93-96`), and a completion date may fall on a weekend in weekdays mode.
- The two-wording convention (`project.ts:363-367`): edit wording names the rule only, because the edit already points at its Task. An indirect Done rejection breaks a Task other than the edited one (reverting A breaks B), so those messages must name the Task in both wordings.
- The date-field pattern to reuse is `StartPanel.tsx:33-152` (`<Input type="date" min max>`, keyboard draft vs. calendar pick, `validity.badInput` mapped to the domain message). The draft-until-commit behaviour exists so intermediate years never commit (`context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:52-68`).
- The only Status label map is `STATUS_NAMES` in `project-file.ts:351` (not exported), and `TASK_STATUSES` is in `project-file.ts:235`; both belong in the domain once views need them.
- The cast ban (`eslint.config.*:89-109`) means fixtures reach a `CheckedProject` only through edits or `toCheckedProject`, so Done fixtures go through the new edits.
- `e2e/forecast-today.spec.ts` (fixed Warsaw clock just after local midnight via `page.clock`) is the pattern for today-dependent browser behaviour.

## What We're NOT Doing

- No file schema change in the version bump: `"1.0"` adds, removes and reorders no key, so no field needs a default for older files. No reading of version spellings the app never wrote (`"1"`, `"1.00"`).
- No highlight bridging through Done Tasks: the critical-path highlight stays on remaining work only (FR-010), so it may start or end mid-diagram next to a Done Task; `diagram.test.ts` "never marks a Done Task or an edge from it" keeps its assertion.
- No keeping a completion date on a Task that leaves Done, and no silent dropping of one on import (it is a Validation Error in a file).
- No START-date bound on completion dates while the START date is unset.
- No weekend rule for completion dates in weekdays mode: a Saturday or Sunday completion date is allowed.
- No multi-step "mark Done" UI and no pending Done state: marking Done is one edit.
- No third forecast kind: the all-Done case stays `kind: "forecast"`, with a new base-date reason.
- No midnight re-render or clock tick (observability audit B6), no change to `deleteTask` bridging, no FR-015/FR-018.

## Implementation Approach

Follow the upstream aggregate design: rules live only in the guardian's lists, edits only address, parse and `accept`. Phase 1 threads `today` through every edit and door as a pure refactor, so the rule phase that follows reads as rule entries and tests rather than signature churn. The domain lands test-first: rules and edits (Phase 2), import (Phase 3), forecast (Phase 4). The views follow, wired through the existing hook and panel patterns (Phase 5) and the diagram (Phase 6). A browser check and the documentation updates follow (Phase 7). The slice closes by bumping the file version to `"1.0"` once the format holds every MVP field (Phase 8), following test-plan §6.3 "Version bump". Each phase lands green on its own.

## Critical Implementation Details

- **Check ordering in the guardian.** The five rules about a Task alone go into `TASK_CHECKS` after the three existing Task checks, in this order: `done-without-completion-date`, `completion-date-without-done`, `completion-date-not-a-date`, `completion-date-after-today`, `completion-date-before-start-date`. The two rules about a Task and its predecessors, `done-predecessor-not-done` then `completion-date-before-predecessor`, go into `PROJECT_CHECKS` **after `cycle`**, each walking the Tasks in array order. Placed in `TASK_CHECKS`, they would run before `cycle`, and an `addPredecessor` that closes a cycle through a Done Task would report a Done rule instead of the cycle that US-01 and FR-003 require (A Done, B To Do depending on A, `addPredecessor(A, B)` → `done-predecessor-not-done`). After `cycle`, they only ever see an acyclic graph whose every Task already passed its own completion-date checks, so the predecessor bound compares two ISO dates. The START bound is skipped while the START date is unset or not an ISO date, so `start-date-not-a-date` still reports a malformed one. `done-predecessor-not-done` runs first, so the predecessor bound only ever compares two Done Tasks.
- **The all-Done forecast must not use weekday arithmetic.** With `baseDateReason: "all-tasks-done"` the base date is the latest completion date, which may be a weekend in weekdays mode, and `addWeekdays` throws there. Both Project Finish Dates are that date as-is, with no weekend move and no `movedFromWeekend`.
- **The completion-date draft must follow the committed date.** TaskPanel is keyed by Task id, so its drafts start on mount. When `setStatus(…, "done")` commits today's date, or a revert removes the date, the Completion date field must show the committed value, not a stale draft. Reset the draft whenever the committed `completionDate` or Status changes.

## Phase 1: Thread `today` through the guardian

### Overview

Give the guardian access to today without changing any behaviour: an `EditContext` on every edit and door, supplied by the hook, the import handler and the crash fallback, and injected in tests. No rule reads it yet.

### Changes Required:

#### 1. Aggregate signatures

**File**: `src/lib/services/project.ts`

**Intent**: Introduce `EditContext` and pass it through `accept` to the rule walk, so Phase 2's rules can read today. Every edit takes it, even those no Done rule concerns, so S-07 changes each signature once (upstream design §4.3).

**Contract**: `export interface EditContext { today: string }` (ISO yyyy-mm-dd, local day). Last parameter `context: EditContext` on `createTask`, `renameTask`, `deleteTask`, `addPredecessor`, `removePredecessor`, `setProjectName`, `setDuration`, `setStartDate`, `setDayCountingMode`. Also on `createEmptyProject(context)`, `checkProject(project, context)`, `toCheckedProject(project, context)` and `validateProject(project, context)`. `ProjectIndex` gains `today`, and `ProjectCheck` receives the context. No module in `src/lib/services/` reads the clock.

#### 2. Import door

**File**: `src/lib/services/project-file.ts`

**Intent**: Import passes today to the guardian, so a file with a completion date after the importer's today can be rejected in Phase 3.

**Contract**: `parseProjectFile(text: string, context: EditContext): ImportResult`; `importProject` forwards it to `checkProject`.

#### 3. Fixtures

**File**: `src/lib/services/fixtures.ts`

**Intent**: The perf fixture mints through `toCheckedProject`, so it takes the context too.

**Contract**: `createPerfProject` takes an `EditContext` (parameter order is the implementer's choice; update every caller).

#### 4. Session hook

**File**: `src/hooks/useProject.ts`

**Intent**: The hook supplies today to every edit at the moment it is applied, read from the clock by default and injectable in tests (upstream design §4.6–4.7).

**Contract**: `useProject(initial?, initialSelection?, options?: { today?: () => string })`, default `() => todayIsoDate(new Date())`. Every action calls its edit with `{ today: today() }`. The default initial project is `createEmptyProject({ today: today() })`, built lazily: the `useState` initializer at `useProject.ts:74`, which passes `edits.createEmptyProject` by reference today, becomes a closure.

#### 5. View callers

**Files**: `src/components/planner/Planner.tsx`, `src/components/planner/ProjectControls.tsx`, `src/components/planner/RenderCrashFallback.tsx`, `src/dev/KitchenSinkPlanner.tsx`

**Intent**: Views read the clock where they already may (as `Planner.tsx:124` does) and pass it in: Planner's `initialProject()` (`Planner.tsx:24-28`, which calls `createPerfProject()` behind `?fixture=perf100` and `createEmptyProject()`), import (`ProjectControls.tsx:191`), New project's `createEmptyProject`, the crash fallback's `validateProject` (`RenderCrashFallback.tsx:42`), and kitchen-sink fixture builders.

**Contract**: each passes `{ today: todayIsoDate(new Date()) }`.

#### 6. Tests

**Files**: every test calling an edit or door — `project.test.ts`, `project.property.test.ts`, `project-file.test.ts`, `forecast.test.ts`, `remaining-work.test.ts`, `validation-warnings.test.ts`, `diagram.test.ts`, `layout-engine.test.ts`, `task-graph.test.ts` (`createPerfProject()` at `:208`), `flow-elements.test.ts`, `useProject.test.ts`, `Planner.test.ts`, `ForecastSummary.test.ts`, `StartPanel.test.ts`, `RenderCrashFallback.test.ts`

**Intent**: Pass a fixed context per file (a `TODAY` constant), never the clock, keeping every assertion unchanged. `useProject.test.ts` injects `options.today`.

**Contract**: no expected value changes in this phase.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- All unit tests pass with no expected value changed: `npm test`
- Build and CSP check pass: `npm run build && npm run check:csp`
- No module under `src/lib/services/` reads the clock: `grep -rn "new Date()" src/lib/services --include=*.ts | grep -v "\.test\.ts"` finds nothing

#### Manual Verification:

- Under `npm run dev`, creating, editing, importing and starting a new project behave as before

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Done rules and Status edits (domain, test-first)

### Overview

Add seven Validation Error rules as guardian entries (five in `TASK_CHECKS`, two in `PROJECT_CHECKS` after `cycle`), and add `setStatus` and `setCompletionDate` as addressing + parsing + `accept`. Every PRD acceptance criterion of US-04 about rejection gets a test first.

### Changes Required:

#### 1. Rule ids and checks

**File**: `src/lib/services/project.ts`

**Intent**: The PRD's Done rules (`prd.md:118-119, :194`) plus the plan's "only a Done Task has a completion date" become guardian entries, in the order of Critical Implementation Details. Edits contain no Done-rule code.

**Contract**: `ValidationErrorRule` gains `done-without-completion-date`, `completion-date-without-done`, `completion-date-not-a-date`, `completion-date-after-today`, `completion-date-before-start-date`, `done-predecessor-not-done`, `completion-date-before-predecessor`. Messages follow the domain terms (never "invalid", "conflict" or "blocked"):

- **Rules only an edit to the Task itself can break** (`done-without-completion-date`, `completion-date-without-done`, `completion-date-not-a-date`) keep the two-wording convention: edit wording names the rule, file wording prefixes `Task <label>:`. Example: "A Done Task needs a completion date."; "Only a Done Task can have a completion date."; "A completion date must be a calendar date from 0001-01-01 to 9999-12-31." (`MIN_ISO_DATE`/`MAX_ISO_DATE`).
- **Rules another edit or the clock can break** (`completion-date-after-today`, `completion-date-before-start-date`, `done-predecessor-not-done`, `completion-date-before-predecessor`) name the Task(s) and dates in both wordings. Examples: "Task 1: A has the completion date 2026-09-08, which is after today, 2026-09-05."; "Task 1: A has the completion date 2026-09-03, which is before the START date, 2026-09-04."; "Task 2: B cannot be Done while its predecessor 1: A is not Done."; "Task 2: B has the completion date 2026-09-02, which is before the completion date of its predecessor 1: A, 2026-09-03."
- Export `completionDateNotADate(): ValidationError` for the view's unreadable-date case (as `startDateNotADate`, `project.ts:255`).

#### 2. Status vocabulary in the domain

**File**: `src/lib/services/project.ts`

**Intent**: Views (Status select, node names) and import need one list and one label map.

**Contract**: export `TASK_STATUSES: readonly TaskStatus[]` (`["to-do", "in-progress", "done"]`, the order the select lists them) and `taskStatusName(status): "To Do" | "In Progress" | "Done"`. `project-file.ts` switches to these in Phase 3.

#### 3. The two edits

**File**: `src/lib/services/project.ts`

**Intent**: `setStatus` sets a Status; Done takes today as its completion date, so marking Done is one atomic edit. Leaving Done removes the completion date. `setCompletionDate` sets or clears the date and leaves every judgement to the guardian.

**Contract**:

- `setStatus(project, taskId, status, context): EditResult`. Unknown id → `unknown-task`. Same Status → `accept(project)` (an already Done Task keeps its date). To `"done"` → `{ status: "done", completionDate: context.today }`. To a not-Done Status → the Status, with `completionDate` removed.
- `setCompletionDate(project, taskId, input, context): EditResult`. Input is trimmed; empty input removes the field (the guardian then reports `done-without-completion-date` for a Done Task). Otherwise the trimmed text is stored, and the guardian reports `completion-date-not-a-date`, `completion-date-without-done`, or a bound.

#### 4. Domain tests

**Files**: `src/lib/services/project.test.ts`, `src/lib/services/project.property.test.ts`

**Intent**: Prove each rule once in the `validateProject` table (file wording) and each US-04 rejection through the edit that triggers it.

**Contract**: rows and cases —

- `validateProject` table: one row per new rule, plus the error-order test (`project.test.ts:576-609`) extended with the new positions (including a malformed START date reported as `start-date-not-a-date`, a predecessor with a malformed date reported on that predecessor, and a cycle through Done Tasks with unequal completion dates reported as `cycle`).
- Cycle before Done rules (US-01): A Done, B To Do depending on A, `addPredecessor(A, B)` → `cycle` with "would create the cycle 1: A → 2: B → 1: A"; the same with A and B Done on different dates.
- Edits (PRD `prd.md:116-119`): B Done while A To Do → `done-predecessor-not-done`; completion date after today, before the START date, before A's → each rule; A and B Done, `setStatus(A, "to-do")` → rejected naming B; `addPredecessor(B Done, C To Do)` → rejected naming B; `setStartDate` after A's completion date → rejected naming A; clearing the START date with Done Tasks → accepted; `setCompletionDate(A, later than B's)` → rejected naming B; `setCompletionDate(A, "")` while Done → `done-without-completion-date`; `setCompletionDate` on a To Do Task → `completion-date-without-done`; `setStatus(A, "done")` sets `completionDate` to `context.today`; Done → In Progress removes the date; Done → Done keeps the original date; a Saturday completion date in weekdays mode → accepted.
- Monotonicity (upstream §4.9): a project accepted with today T passes `validateProject` with today T+1.
- The guardian `it.each` (`project.test.ts:626-646`) gains both edits; the error-message assertions reject "invalid", "conflict" and "blocked".
- Property test (`project.property.test.ts:42-86`): the edit-step union gains a `setStatus` step and a `setCompletionDate` step; every accepted project still satisfies `validateProject(project, context) === undefined`.

#### 5. Hand-built Done fixtures through the edits

**Files**: `src/lib/services/forecast.test.ts:46-64, :140-193`, `remaining-work.test.ts:114-132`, `validation-warnings.test.ts:40-52`, `diagram.test.ts:187-197, :303-323`

**Intent**: Replace the hand-built Done projects and their "no edit sets a Status yet (S-07)" comments with projects built through `setStatus`/`setCompletionDate`, keeping every current expectation (Phase 4 changes the `baseDateReason` rows).

**Contract**: completion dates and the injected today satisfy the new rules (START 2026-09-01, completions 2026-09-03/2026-09-08, today ≥ completion).

### Success Criteria:

#### Automated Verification:

- New domain tests were red before the rules and edits existed, and are green now: `npx vitest run src/lib/services/project.test.ts src/lib/services/project.property.test.ts`
- Full suite passes: `npm test`
- Lint and type check pass: `npm run lint && npx astro check`

#### Manual Verification:

- Review: no Done-rule rule id or condition appears in `setStartDate`, `addPredecessor`, `setStatus` or `setCompletionDate`; each new rule id is produced by exactly one guardian entry, and the two predecessor rules sit after `cycle` in `PROJECT_CHECKS` (upstream acceptance test, `02-invariant-aggregate-refactor.md:381-383`)
- Review: every new message uses the domain terms and names the Task(s) for the four indirect rules

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Import lifts the Status gate

### Overview

Remove the pre-S-07 import limit so the Done rules reach files through `checkProject`, and prove the round-trip with a hand-written golden file.

### Changes Required:

#### 1. Pipeline

**File**: `src/lib/services/project-file.ts`

**Intent**: Delete stage 6 and its rule; the guardian is now the only judge of Statuses and completion dates.

**Contract**: remove `checkSupportedYet`, `STATUS_NAMES` and `task-status-not-supported-yet` from `ProjectFileRule`; use `TASK_STATUSES` from `project.ts` in the shape stage (`:235, :300`); update the module header and stage comments (`:5-8, :343`). Version stays `"0.1"` in this phase (Phase 8 bumps it); no key is added or reordered (`TASK_KEYS :234`).

#### 2. Golden file

**File**: `src/lib/services/golden/project-file-0.1-statuses.json` (new, hand-written, Prettier-ignored by `.prettierignore`)

**Intent**: Pin the byte format of In Progress and Done Tasks with completion dates (test-plan §6.3).

**Contract**: START date, a Done chain (A Done, B Done with B's completion ≥ A's), an In Progress Task with a Duration, a To Do Task, and a Done Task without a Duration. Completion dates are fixed past dates (2026-09-xx), so they stay on or before any real today.

#### 3. Contract tests

**File**: `src/lib/services/project-file.test.ts`

**Intent**: Turn the not-supported-yet rows into round-trip rows, add a rejection row per new rule, and keep the stage order proven.

**Contract**:

- The rows at `:687-704` become accepted-import and round-trip rows.
- `fullProject()` gains an In Progress Task and Done Tasks with completion dates; `expectRoundTrip` passes on it.
- `validationErrorRows` gains one row per new rule, built from `baseFile()` via `fileWith`, with today injected; `completion-date-after-today` uses a date after the injected today; file wording names the Task.
- The golden statuses file imports `toStrictEqual` a hand-written expected project and is what `serializeProject` writes for it, byte for byte.
- The stage-order test (`:759-769`) proves "unique ids before Validation Errors" with a file holding both duplicate ids and a Done-rule break, which reports `duplicate-task-id`.

### Success Criteria:

#### Automated Verification:

- Contract tests pass: `npx vitest run src/lib/services/project-file.test.ts`
- `task-status-not-supported-yet` is gone from the source: `grep -rn "task-status-not-supported-yet" src` finds nothing
- Full suite, lint, type check: `npm test && npm run lint && npx astro check`

#### Manual Verification:

- The golden statuses file reads as a hand-edited project would (key order, one predecessor list per line)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Progress-aware forecast

### Overview

Give the two decided forecast cases their own base-date reasons, and pin US-04 and the all-Done case as PRD oracle rows.

### Changes Required:

#### 1. Base date

**File**: `src/lib/services/forecast.ts`

**Intent**: When every Task is Done, the project finished on its latest completion date. When a past START date's direct successors are all Done, the START date no longer matters (`prd.md:192`) and the reason should say so.

**Contract**: `baseDateReason` gains `"start-successors-done"` and `"all-tasks-done"`. `forecastBaseDate` decides, in order:

1. At least one Task and every Task Done → `all-tasks-done`, base date = latest completion date, no weekend move.
2. START unset → `start-date-unset`.
3. START before today, at least one Task without predecessors, and every Task without predecessors Done → `start-successors-done`, base date today.
4. START before today otherwise → `start-date-in-past`.
5. Otherwise → `start-date`.

The weekend move applies to reasons 2–5 as today. In `forecast`, the `all-tasks-done` case gives both Project Finish Dates as `{ kind: "date", date: baseDate }` without calling `addDays`/`addWeekdays` (times stay 0 days). Update the `ForecastBaseDate` doc comment.

#### 2. Remaining-work comment

**File**: `src/lib/services/remaining-work.ts:52-58`

**Intent**: The Done rules are now in the guardian, so a `CheckedProject` vouches for them; reword the "join … in S-07" sentence.

**Contract**: comment only.

#### 3. Oracle rows

**File**: `src/lib/services/forecast.test.ts`

**Intent**: Pin the PRD's progress examples by hand-derived literals (test-plan §6.1), built through the edits.

**Contract**: `prdExamples` rows, calendar days, START 2026-09-01, A(5) → B(3):

- today before 1 Sep → 2026-09-09, `start-date`.
- A Done 3 Sep, today 3 Sep → 2026-09-06, `start-successors-done`.
- A Done 8 Sep, today 8 Sep → 2026-09-11, `start-successors-done`.
- A Done 3 Sep, today 5 Sep → 2026-09-08, `start-successors-done`.
- A In Progress, today before 1 Sep → 2026-09-09 (differs from the Done row on exactly the Status).
- Two direct successors of START, one Done and one not, START in the past → `start-date-in-past`, base today.

Edge cases outside the PRD block:

- A Done 3 Sep, B Done 6 Sep, today 20 Sep → both 2026-09-06, `all-tasks-done`, times 0 days.
- START unset with every Task Done → `all-tasks-done`.
- Weekdays mode, every Task Done, latest completion a Saturday → both dates that Saturday, no `movedFromWeekend`.
- No Tasks → unchanged (base date for both).

### Success Criteria:

#### Automated Verification:

- Oracle rows red before the change and green after: `npx vitest run src/lib/services/forecast.test.ts`
- Full suite, lint, type check: `npm test && npm run lint && npx astro check`

#### Manual Verification:

- Each new row's expected dates were derived by hand from the PRD convention, not from a production helper (review the row comments)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Session and panels

### Overview

Expose the two edits through the hook, add Status and Completion date to TaskPanel, and update the notes and copy in StartPanel and ForecastSummary.

### Changes Required:

#### 1. Hook actions

**File**: `src/hooks/useProject.ts`

**Intent**: One `apply` per user action, next to `setDuration` (`:128-131`). Since marking Done is one edit, no multi-apply atomicity case is needed (test-plan §6.5 Phase 2 note).

**Contract**: `ProjectActions` gains `setStatus(taskId, status): EditResult` and `setCompletionDate(taskId, input): EditResult`.

#### 2. TaskPanel

**File**: `src/components/planner/TaskPanel.tsx`

**Intent**: A Status select and, for a Done Task, a Completion date field, following the panel's error pattern and StartPanel's date pattern.

**Contract**:

- Field order: Task name, Status, Completion date (Done only), Duration, Predecessors, Delete.
- **Status** is a `NativeSelect` (as Day counting, `ProjectControls.tsx:259-276`) listing `TASK_STATUSES` by `taskStatusName`. It commits on change. Its value is the committed Status, so a rejection leaves the select on it and shows `<p role="alert" className="text-destructive text-sm">` linked by `aria-describedby`.
- **Completion date** is an `<Input type="date">` with `min` = the START date or `MIN_ISO_DATE` and `max` = today. It uses StartPanel's keyboard draft vs. calendar pick, maps `validity.badInput` to `completionDateNotADate().message`, commits on blur or Enter in a `<form onSubmit>` with `preventDefault`, and Escape restores. No Clear button.
- The draft follows the committed date (Critical Implementation Details).
- Props gain `today`; `TaskPanelActions` adds `setStatus`, `setCompletionDate`.

#### 3. Planner wiring

**File**: `src/components/planner/Planner.tsx`

**Intent**: Pass the two actions and `today` to TaskPanel (`:233`).

**Contract**: props only.

#### 4. StartPanel notes

**File**: `src/components/planner/StartPanel.tsx:50-55`

**Intent**: Say why the START date no longer drives the forecast.

**Contract**: `start-successors-done` → "The Tasks that follow START are Done, so this date no longer affects the forecast: it starts from today, {today}."; `all-tasks-done` → "Every Task is Done, so this date no longer affects the forecast." when a START date is set, and "Not set. Every Task is Done, so the START date does not affect the forecast." when it is unset (`all-tasks-done` is decided before `start-date-unset`, so the unset note would not show). Existing notes unchanged.

#### 5. ForecastSummary

**File**: `src/components/planner/ForecastSummary.tsx`

**Intent**: Correct the withheld copy for Done Tasks, hide the legend swatch when nothing is highlighted, and add the two notes.

**Contract**:

- Withheld line (`:117`) → "Forecast not possible until every Task that is not Done has one."
- Swatch (`:38-40`) only when `criticalPathTime.kind === "days"` and its days are above 0.
- `all-tasks-done` → note "Every Task is Done." and no other base-date note.
- `start-successors-done` → "The Tasks that follow START are Done: forecasting from today, {today}."
- The weekend note is unchanged for the other reasons.

#### 6. Tests

**Files**: `src/hooks/useProject.test.ts`, `src/components/planner/Planner.test.ts`, `src/components/planner/ForecastSummary.test.ts`, `src/components/planner/StartPanel.test.ts`

**Intent**: Prove the hook commits accepted Status edits only, and the views follow (test-plan §6.2).

**Contract**:

- **Hook** (`useProject.test.ts:50-130`): a second deep-frozen fixture with A and B Done, a past START date and `options.today` injected. Rows for every edit-reachable new rule:
  - `done-predecessor-not-done` via `setStatus` (both directions) and via `addPredecessor`
  - `completion-date-after-today`
  - `completion-date-before-start-date` via `setCompletionDate` and via `setStartDate`
  - `completion-date-before-predecessor` (both directions)
  - `done-without-completion-date` (empty input)
  - `completion-date-without-done`
  - `completion-date-not-a-date`

  Each row has the same identity, selection and replacement assertions as the existing rows, plus a row proving `setStatus(…, "done")` commits today's date.

- **ForecastSummary** static renders from real forecasts: all-Done (latest completion date, "Every Task is Done.", no swatch); `start-successors-done` note; reworded withheld line.
- **StartPanel**: the new notes, including the all-Done note with START set and with START unset.
- **Planner**: a fixture with START 2026-09-01 and A Done 2026-09-03, built through the edits. The node is found by "A, Done on 2026-09-03". Setting A's completion date to 2999-01-01 in the panel shows an alert naming the after-today rule, with the node unchanged. Reverting A to To Do while B is Done shows an alert naming B. Marking a To Do Task Done shows a node whose name starts "B, Done on ". Planner has no `today` prop and calls `useProject` without options, so in these renders the edits, the Completion date `max` and the forecast all use the real clock. A Done fixture needs a past START date, so the far-future-START workaround of test-plan §6.2 does not apply. These tests therefore assert only clock-free text: rule fragments (e.g. "which is after today"), the "B, Done on " prefix, never a full after-today message or a forecast date. The fixed-clock case is Phase 7's e2e. The `forecastRegion()` regexes (`:60, :103, :117`) are updated for the new withheld copy.

### Success Criteria:

#### Automated Verification:

- State and view tests pass: `npx vitest run src/hooks/useProject.test.ts src/components/planner/Planner.test.ts src/components/planner/ForecastSummary.test.ts src/components/planner/StartPanel.test.ts`
- Full suite, lint (jsx-a11y and the no-literal-colour rule), type check: `npm test && npm run lint && npx astro check`

#### Manual Verification:

- In `npm run dev`, marking a Task Done shows today in the Completion date field; backdating by keyboard and by calendar commits only on blur or Enter; Escape restores
- A rejected Status change leaves the select on the committed Status and announces the alert
- Keyboard-only: Status and Completion date are reachable in order and focus is visible

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Diagram Status display

### Overview

Carry Status into the domain diagram node and its accessible name, style Done and In Progress Tasks with tokens, and add kitchen-sink states.

### Changes Required:

#### 1. Domain node and accessible name

**File**: `src/lib/services/diagram.ts`

**Intent**: The view must not format; the domain node carries what the node shows and what assistive technology announces.

**Contract**: `TaskDiagramNode` gains `status: TaskStatus` and `completionDate?: string`. `taskAccessibleName` reads Status:

- Done → "A, Done on 2026-09-03" (no Duration, never warned or critical).
- In Progress → "A, 5 days, In Progress", "A, 5 days, In Progress, on the critical path", "A, no Duration (Validation Warning), In Progress".
- To Do names are unchanged.

#### 2. Token

**File**: `src/styles/global.css`

**Intent**: A Done role, kept apart from `--warning`, `--critical-path` and `--destructive`, for the Done node border and check icon.

**Contract**: `--done` in `:root` and `.dark`, `--color-done` in `@theme inline`; contrast against `--card` (≥ 3:1 for a non-text mark) recorded in `context/changes/progress-aware-forecast/tokens.md`, as earlier slices did.

#### 3. Node view

**File**: `src/components/planner/diagram/TaskNode.tsx`

**Intent**: Done reads as completed work; In Progress reads as in flight; the node keeps its size (`TASK_NODE_SIZE`, two lines).

**Contract**:

- **Done**: `border-done`, second line `CheckIcon` (`text-done`) plus "Done 2026-09-03" in `text-muted-foreground`.
- **In Progress**: the Duration line (or "No Duration" warning) followed by " · In Progress".
- Class priority: selected, warned, critical, Done, hover.
- Update the header comment.

#### 4. Kitchen sink

**Files**: `src/dev/KitchenSinkPlanner.tsx`, `src/dev/kitchen-sink.astro`

**Intent**: Show every new state (PROJECT_RULES UI: check UI changes there), built through the real edits.

**Contract**: new fixtures, each with START 2026-09-01 and past completion dates:

- **progress**: A Done, B In Progress and critical, C To Do; A selected, with the Completion date field showing.
- **all-done**: "Every Task is Done.", no swatch.
- **start-successors-done**: START selected, showing the new note.

Each has a `FIXTURES` entry and a `<figure>`.

#### 5. Tests

**Files**: `src/lib/services/diagram.test.ts`, `src/components/planner/diagram/flow-elements.test.ts`

**Intent**: Pin the accessible names and node fields per Status; keep "never marks a Done Task or an edge from it" as the decided behaviour, with its comment pointing at this plan instead of an open question.

**Contract**: one name row per Status combination listed above.

### Success Criteria:

#### Automated Verification:

- Diagram tests pass: `npx vitest run src/lib/services/diagram.test.ts src/components/planner/diagram/flow-elements.test.ts`
- Full suite, lint (no literal colours in `src/components/planner/`), type check, build, CSP: `npm test && npm run lint && npx astro check && npm run build && npm run check:csp`

#### Manual Verification:

- In the kitchen sink (`npm run dev`, `/kitchen-sink`), the progress, all-done and start-successors-done states read clearly in light and dark; Done is distinguishable from warned, critical and selected
- The `--done` contrast values in `tokens.md` match the rendered colours

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 7: Browser check and documentation

### Overview

Prove in the built app that marking Done takes the browser's local today and moves both Project Finish Dates as US-04 says, then record the decisions in the product and test documents.

### Changes Required:

#### 1. E2E spec

**File**: `e2e/progress.spec.ts` (new)

**Intent**: Cover the glue no unit test reaches: the hook's default clock read on an edit, in the user's time zone, under the CSP (`e2e/forecast-today.spec.ts` pattern).

**Contract**: `timezoneId: "Europe/Warsaw"`; fixed time just after local midnight on 2030-01-03 (still 2030-01-02 in UTC); START 2030-01-01, A(5) → B(3). Mark A Done in the panel and assert:

- the node "A, Done on 2030-01-03"
- the Completion date field holds 2030-01-03
- both Project Finish Dates are 2030-01-06
- the note "The Tasks that follow START are Done: forecasting from today, 2030-01-03."

#### 2. Product and domain documents

**Files**: `context/foundation/prd.md`, `context/domain/glossary.md`

**Intent**: Record this plan's product decisions where the next reader looks.

**Contract**:

- **PRD Business Logic**: when every Task is Done, both Project Finish Dates are the latest completion date; an unset START date does not bound completion dates; "a completion date on a Task that is not Done" joins the Validation Error list.
- **Glossary**: remove the "Not supported yet" row (`glossary.md:55`) and add the new rules where Validation Errors are listed.

#### 3. Test plan and roadmap

**Files**: `context/foundation/test-plan.md`, `context/foundation/roadmap.md`

**Intent**: Keep the cookbooks true and close the S-07 Unknowns.

**Contract**:

- **Test plan**: §6.1 "the Done rows' reason does not yet" becomes the PRD-backed `start-successors-done`; §6.2's hook-row list gains the new rules; §6.3's lifting paragraph records S-07 as landed with `project-file-0.1-statuses.json`.
- **Roadmap**: S-07 Unknowns marked resolved with the decisions (all-Done = latest completion date; `start-successors-done`; highlight stays on remaining work and the swatch hides at 0 days).

### Success Criteria:

#### Automated Verification:

- E2E passes against build + preview: `npm run test:e2e`
- Full gate: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual Verification:

- PRD MVP flow plus US-04 run end to end in `npm run preview`: mark A Done, backdate it, revert with B Done (rejected with explanation), export, and import in another browser to get the same Statuses and completion dates
- Importing a hand-edited file with a completion date after today is rejected with a message naming the Task

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 8: Bump the file version to 1.0 (MVP file schema)

### Overview

With S-07 the file format holds every US-03 field, so mark it as the MVP schema. Export writes `"1.0"`; import reads both `"0.1"` and `"1.0"`, with the same key set and pipeline. This closes M-1's version clause (`context/foundation/roadmap.md:27`) the way test-plan §6.3 "Version bump" prescribes. It is the slice's last step, so no intermediate commit ships a `"1.0"` file without the Done rules.

### Changes Required:

#### 1. Version reading and writing

**File**: `src/lib/services/project-file.ts`

**Intent**: Raise the written version and keep reading every shipped one. `0.1` and `1.0` share one schema, so no per-version branch exists beyond the version check.

**Contract**:

- `PROJECT_FILE_VERSION = "1.0"`.
- `checkVersion` (`:175-192`) accepts exactly `"0.1"` and `"1.0"`.
- A canonical `VERSION` (`:173`) numerically above 1.0 → `file-version-newer`, "The file has version 1.1, newer than version 1.0 that this app reads; …". Any other text, including the canonical but never-written `"1"`, `"0.2"` and `"0.0"` → `file-not-a-project`.
- An imported `"0.1"` file re-exports as `"1.0"`.
- The module header (`:1`), export doc (`:69`) and `parseProjectFile` doc (`:384`) name both versions.

#### 2. MVP golden file

**File**: `src/lib/services/golden/project-file-1.0.json` (new, hand-written, Prettier-ignored)

**Intent**: The one golden file the exporter must reproduce byte for byte, holding the full MVP field set.

**Contract**: it holds:

- a project name and a START date
- `"dayCountingMode": "weekdays"`
- Durations, with one Task missing its Duration (a Validation Warning)
- a gap left by a deleted id
- To Do, In Progress and Done Tasks, with past weekday completion dates satisfying every Done rule

#### 3. Contract tests

**File**: `src/lib/services/project-file.test.ts`

**Intent**: Apply test-plan §6.3 "Version bump", so older files keep importing and the byte assertion moves to the new version.

**Contract**:

- The 1.0 golden file imports `toStrictEqual` a hand-written project, keeps its Validation Warning, mints the right next Task id, and is what `serializeProject` writes byte for byte.
- The two shipped 0.1 golden files (`project-file-0.1.json`, `-0.1-weekdays.json`) keep only their import assertions. Their byte-for-byte checks and the `PROJECT_FILE_VERSION === "0.1"` assertion (`:202-206`) go.
- `project-file-0.1-statuses.json` and its tests are deleted: no deployed build ever writes a `"0.1"` file with Statuses (Migration Notes), and `project-file-1.0.json` pins the same fields byte for byte.
- One row proves an imported 0.1 golden re-exports with bytes identical except the version line.
- The version rows (`:428-450`) are re-derived against 1.0. Newer: `"1.1"`, `"2"`, `"10"`, `"1.12"`. Not a version: `"0.2"`, `"0.0"`, `"1"`, `"1.00"`, `"01.0"`, `"1.0.0"`, `"v1.0"`, `" 1.0"`.
- A test name or comment records that 1.0 adds no key, so no field has an older-version default (M-1 "Done when").

#### 4. Browser side

**File**: `e2e/project-file.spec.ts:96`

**Intent**: The exported file in the built app carries the new version.

**Contract**: expect `"1.0"`. `e2e/render-crash.spec.ts:37` and `e2e/unexported-changes.spec.ts:31` keep importing `"0.1"` files, which proves an older file still imports in the built app.

#### 5. Documents

**Files**: `context/foundation/roadmap.md`, `context/foundation/test-plan.md`, `context/domain/glossary.md`

**Intent**: Replace the planned `"1"` with the decided `"1.0"` and record the bump as landed.

**Contract**:

- **Roadmap**: M-1 "Done when" (`:27`) reads `"0.1"` → `"1.0"`, with the `"1.0"` golden file. The S-06 and S-07 Risk text (`:163, :178`) says S-07 bumps to `"1.0"`. M-1 status is left for `/10x-roadmap` and `/10x-archive`.
- **Test plan**: §6.3 "Version bump" says `"1.0"` and records it landed. The golden-file bullet names `project-file-1.0.json` as the byte-for-byte file, and the lifting paragraph Phase 7 updated names it instead of the deleted `project-file-0.1-statuses.json`.
- **Glossary**: the Project file row (`:48`) says version `"1.0"`, which reads `"0.1"` too.

### Success Criteria:

#### Automated Verification:

- Contract tests pass: `npx vitest run src/lib/services/project-file.test.ts`
- Export writes the new version: `grep -n 'PROJECT_FILE_VERSION = "1.0"' src/lib/services/project-file.ts` finds it
- E2E passes against build + preview: `npm run test:e2e`
- Full gate: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual Verification:

- In `npm run preview`, an exported file shows `"version": "1.0"`; a file exported before this slice (`"0.1"`) imports unchanged and re-exports as `"1.0"` with only the version line differing
- A hand-edited file with `"version": "1.1"` is rejected with the "newer than version 1.0" message

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- One `validateProject` row per new rule (file wording), and edit cases for every US-04 rejection, direct and indirect.
- Property test with Status steps: no accepted sequence ever holds a Validation Error.
- Forecast PRD oracle rows, hand-derived, plus all-Done and weekdays-weekend edge rows.
- Import: rejection row per rule, round-trip of `fullProject()` with Statuses. The statuses golden file is checked byte for byte in Phase 3, and after Phase 8 the `1.0` golden file is the only byte-for-byte check, the two shipped `0.1` files keep their import assertions, and the statuses file is deleted.

### Integration Tests:

- Hook rejection rows (jsdom, `renderHook`) on a deep-frozen Done fixture with injected today.
- `Planner` render: Done node names, rejected completion date and rejected revert in the view.
- Playwright: Done defaults to the browser's local today and moves both Project Finish Dates.

### Manual Testing Steps:

1. Build START 1 Sep, A(5) → B(3); mark A Done, backdate it to 3 Sep, and check both Project Finish Dates against US-04.
2. Mark B Done, then try to set A back to To Do: the rejection names B.
3. Move the START date after A's completion date: the rejection names A.
4. Mark every Task Done: both dates show the latest completion date, "Every Task is Done.", no swatch.
5. Export and import in another browser: same Statuses and completion dates.

## Performance Considerations

The new checks are per Task and read predecessors through the existing `tasksById` map, so the guardian stays linear in Tasks + dependencies; the 200 ms NFR for 100 Tasks (`prd.md:182`) is unaffected. The existing perf measurement on `createPerfProject()` must stay within budget.

## Migration Notes

Files exported before S-07 are version `"0.1"`, hold only To Do Tasks without completion dates, import unchanged, and re-export as `"1.0"`. Files from S-07 onward are `"1.0"`; an older deployed build rejects them as `file-version-newer` ("open it in a newer version of the app"), which is acceptable for a single deployed build.

## References

- Research: `context/changes/progress-aware-forecast/research.md`
- PRD: `context/foundation/prd.md` (US-04 `:105-119`, FR-005 `:135`, Business Logic `:188-196`)
- Upstream design: `context/domain/02-invariant-aggregate-refactor.md:160-203, :255-313, :379-383`
- Refactor plan deferring S-07 work: `context/archive/2026-10-19-invariant-aggregate-refactor/plan.md:31, :40-41`
- Guardian: `src/lib/services/project.ts:64-69, :382-428`
- Date-field pattern: `src/components/planner/StartPanel.tsx:33-152`
- Clock e2e pattern: `e2e/forecast-today.spec.ts`
- Test cookbooks: `context/foundation/test-plan.md` §6.1–6.3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Thread today through the guardian

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 666d1d4
- [x] 1.2 Type check passes: `npx astro check` — 666d1d4
- [x] 1.3 All unit tests pass with no expected value changed: `npm test` — 666d1d4
- [x] 1.4 Build and CSP check pass: `npm run build && npm run check:csp` — 666d1d4
- [x] 1.5 No module under `src/lib/services/` reads the clock — 666d1d4

#### Manual

- [x] 1.6 Under `npm run dev`, creating, editing, importing and starting a new project behave as before — 666d1d4

### Phase 2: Done rules and Status edits

#### Automated

- [x] 2.1 New domain tests were red before the rules and edits existed, and are green now — bd1e1b1
- [x] 2.2 Full suite passes: `npm test` — bd1e1b1
- [x] 2.3 Lint and type check pass: `npm run lint && npx astro check` — bd1e1b1

#### Manual

- [x] 2.4 Review: no Done-rule code in edits; each new rule id produced by exactly one guardian entry, predecessor rules after `cycle` — bd1e1b1
- [x] 2.5 Review: messages use domain terms and name the Task(s) for the four indirect rules — bd1e1b1

### Phase 3: Import lifts the Status gate

#### Automated

- [x] 3.1 Contract tests pass: `npx vitest run src/lib/services/project-file.test.ts` — 9972c4b
- [x] 3.2 `task-status-not-supported-yet` is gone from the source — 9972c4b
- [x] 3.3 Full suite, lint, type check: `npm test && npm run lint && npx astro check` — 9972c4b

#### Manual

- [x] 3.4 The golden statuses file reads as a hand-edited project would — 9972c4b

### Phase 4: Progress-aware forecast

#### Automated

- [x] 4.1 Oracle rows red before the change and green after: `npx vitest run src/lib/services/forecast.test.ts` — e63716e
- [x] 4.2 Full suite, lint, type check: `npm test && npm run lint && npx astro check` — e63716e

#### Manual

- [x] 4.3 Each new row's expected dates were derived by hand from the PRD convention — e63716e

### Phase 5: Session and panels

#### Automated

- [x] 5.1 State and view tests pass — dbf7266
- [x] 5.2 Full suite, lint, type check: `npm test && npm run lint && npx astro check` — dbf7266

#### Manual

- [x] 5.3 Marking Done shows today in Completion date; backdating commits only on blur or Enter; Escape restores — dbf7266
- [x] 5.4 A rejected Status change leaves the select on the committed Status and announces the alert — dbf7266
- [x] 5.5 Keyboard-only: Status and Completion date reachable in order with visible focus — dbf7266

### Phase 6: Diagram Status display

#### Automated

- [x] 6.1 Diagram tests pass — 4f68316
- [x] 6.2 Full suite, lint, type check, build, CSP — 4f68316

#### Manual

- [x] 6.3 Kitchen sink progress, all-done and start-successors-done states read clearly in light and dark — 4f68316
- [x] 6.4 The `--done` contrast values in `tokens.md` match the rendered colours — 4f68316

### Phase 7: Browser check and documentation

#### Automated

- [ ] 7.1 E2E passes against build + preview: `npm run test:e2e`
- [ ] 7.2 Full gate: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual

- [ ] 7.3 PRD MVP flow plus US-04 end to end in `npm run preview`, including export and import in another browser
- [ ] 7.4 Importing a file with a completion date after today is rejected naming the Task

### Phase 8: Bump the file version to 1.0

#### Automated

- [ ] 8.1 Contract tests pass: `npx vitest run src/lib/services/project-file.test.ts`
- [ ] 8.2 Export writes the new version: `PROJECT_FILE_VERSION = "1.0"`
- [ ] 8.3 E2E passes against build + preview: `npm run test:e2e`
- [ ] 8.4 Full gate: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual

- [ ] 8.5 Exported file shows `"version": "1.0"`; a `"0.1"` file imports and re-exports as `"1.0"` with only the version line differing
- [ ] 8.6 A `"version": "1.1"` file is rejected with the "newer than version 1.0" message
