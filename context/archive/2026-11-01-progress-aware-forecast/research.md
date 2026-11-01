---
date: 2026-11-01T00:42:13+0100
researcher: RemekGdansk
git_commit: 6daf411c8352d919e63535b0f4f2e87d4ea7f672
branch: progress-aware-forecast
repository: critical-path
topic: "S-07 progress-aware-forecast: what exists, what is missing, and where Task Statuses, completion dates and the Done rules plug in"
tags:
  [
    research,
    codebase,
    project,
    project-file,
    forecast,
    remaining-work,
    diagram,
    task-panel,
    forecast-summary,
    use-project,
  ]
status: complete
last_updated: 2026-11-01
last_updated_by: RemekGdansk
---

# Research: S-07 progress-aware-forecast

**Date**: 2026-11-01T00:42:13+0100
**Researcher**: RemekGdansk
**Git Commit**: 6daf411c8352d919e63535b0f4f2e87d4ea7f672 (working tree: only `context/changes/progress-aware-forecast/` untracked)
**Branch**: progress-aware-forecast
**Repository**: critical-path

## Research Question

Roadmap slice S-07 (`context/foundation/roadmap.md:166-179`): user can set a Task's Status (To Do, In Progress, Done) with a completion date for Done, and sees both Project Finish Dates recalculated from today and the actual completion dates; edits that break the Done rules, directly or indirectly, are rejected with an explanation, and imported files that break them are rejected too (US-04, FR-005, FR-019, FR-014). What does the codebase already provide, what is missing, where does each piece plug in, and which decisions are still open for `/10x-plan`?

## Summary

- **The forecast arithmetic needs no change for the PRD's worked examples.** A Done Task finishes at offset 0 from the base date and is excluded from remaining work (`src/lib/services/remaining-work.ts:83-86`); the base date is today whenever the START date is unset or in the past (`src/lib/services/forecast.ts:43-54`). Traced against the code, the four US-04 examples give 9 Sep, 6 Sep, 11 Sep and 8 Sep, and three of them already exist as hand-built rows in `src/lib/services/forecast.test.ts:140-171`. `completionDate` is not read by `forecast.ts`, `remaining-work.ts`, `validation-warnings.ts` or `diagram.ts` (inspected path). That is exact only while the Done rules hold (completion date ≤ today and ≥ START date imply base date = today whenever any Task is Done), which `remaining-work.ts:52-58` documents and says "join the aggregate's rule list in S-07; until then a `CheckedProject` does not vouch for them."
- **The Done rules are entirely missing.** `ValidationErrorRule` (`src/lib/services/project.ts:21-38`) has no Status or completion-date rule; there is no `setStatus`/`setCompletionDate` edit; `createTask` hard-codes `status: "to-do"` (`project.ts:182`); import refuses any Status other than To Do and any `completionDate` through `checkSupportedYet`, rule `task-status-not-supported-yet` (`src/lib/services/project-file.ts:353-369`, called at `:377`).
- **The guardian is built for them.** Every edit calls `accept`, which checks the whole candidate project against `TASK_CHECKS` (per Task, `project.ts:382-404`) then `PROJECT_CHECKS` (`:410-428`); import uses the same list via `checkProject` (`project.ts:170`, `project-file.ts:378`). A Done rule added as a `TASK_CHECKS` entry therefore rejects indirect edits (`addPredecessor`, `setStartDate`, reverting a Done predecessor) and import with no rule code in those functions — the plan the invariant-aggregate refactor left for S-07 (`context/archive/2026-10-19-invariant-aggregate-refactor/plan.md:31, :40-41`).
- **The one structural gap is `today`.** "A completion date after today" needs today, but no guardian door takes it: `accept`/`checkProject`/`toCheckedProject`/`validateProject` (`project.ts:64, :170, :175, :452`) and `parseProjectFile(text)` (`project-file.ts:389`). The clock is read in one place, `Planner.tsx:124` (`todayIsoDate(new Date())`). Threading `today` (the upstream design's `EditContext`, `context/domain/02-invariant-aggregate-refactor.md:185-203`) was explicitly deferred to S-07 (`refactor plan.md:41`) and was not implemented (`grep EditContext src/` finds nothing).
- **UI work is all new.** No Status control, completion-date field, Done styling or Status in accessible names exists (`TaskPanel.tsx:159-299`, `diagram/TaskNode.tsx:22-50`, `diagram.ts:125-137`). The withheld copy to reword is `ForecastSummary.tsx:117` ("Forecast not possible until every Task has one."); TaskPanel has no withheld note today (grep of `TaskPanel.tsx` for warning copy finds none), so the S-04 review's worry that it shares the wording no longer applies.
- **Three roadmap Unknowns and a few new rule-edge questions remain for the user** (see Open Questions): all-Done finish dates, the `start-date-in-past` label once START's successors are Done, the critical-path highlight and legend swatch next to Done Tasks; plus completion date with an unset START date, a completion date on a not-Done Task, and whether Done is set together with its completion date in one edit.

## Detailed Findings

### Forecast and remaining work (no arithmetic change expected)

- `forecastBaseDate` (`forecast.ts:43-54`): START unset → today, `"start-date-unset"`; START < today → today, `"start-date-in-past"`; otherwise START, `"start-date"`. It does not read Status, so a past START date gives `"start-date-in-past"` even when every successor of START is Done. In weekdays mode a Saturday/Sunday base date moves to Monday (`:52-53`).
- `forecast(project: CheckedProject, today)` (`forecast.ts:91-109`) takes `today` as an injected string; it withholds while `remainingWork` is withheld (`:94`) and otherwise returns base date + critical-path time and base date + total-work time.
- `remainingWork` (`remaining-work.ts:70-132`): a Done Task gets finish day 0 and is skipped from `scheduled` and from the total (`:83-86`); the backward pass and critical links consider only scheduled (not-Done) Tasks (`:114, :122-128`), so a Done Task is never critical and no link from a Done Task is critical.
- Trace of US-04 (`prd.md:105-119`), calendar days, START 2026-09-01, A(5) → B(3): (1) today before 1 Sep → base 1 Sep, critical path 8 → 9 Sep; (2) A Done 3 Sep, today 3 Sep → base 3 Sep (`start-date-in-past`), B 0–3 → 6 Sep; (3) A Done 8 Sep, today 8 Sep → 11 Sep; (4) A Done 3 Sep, today 5 Sep → 8 Sep. In (2)–(4) the completion date plays no part; with the Done rules absent, a completion date after today or before START would give the same output.
- All-Done project: both times are 0 days, so both Project Finish Dates equal the base date — today under the Done rules. No test covers it; the nearest is "gives the base date for both when there are no Tasks" (`forecast.test.ts:369`).
- `validationWarnings` already skips Done Tasks (`validation-warnings.ts:17-21`); an In Progress Task without a Duration is still warned.

### The guardian and the edit API (`src/lib/services/project.ts`)

- Shapes: `EditResult = {ok:true; project: CheckedProject} | {ok:false; error: ValidationError}` (`:53`), `ValidationError = {rule, message}` (`:40-43`), rule ids are kebab-case literals (`:21-38`).
- `accept(candidate, explain?, wording)` (`:64-69`) runs `assertModelShape` then `firstValidationError` (`:430-445`); the first error found in the candidate is attributed to the edit, and the optional `explain` map rewords it for that edit. Only `addPredecessor` uses `explain` today (cycle path, `:219-227`).
- Two wordings (`:363-367`): `"edit"` names the rule only (the edit already points at its Task); `"file"` prefixes the Task. For an indirect Done rejection the broken Task is not the edited one (reverting A breaks B), so S-07's messages must name the other Task in edit wording too — the upstream design's example is "This change would leave Task 2: B Done while its predecessor 1: A is not Done." (`02-invariant-aggregate-refactor.md:266`).
- `ProjectIndex.tasksById` is built once per walk (`:370-373`) precisely so per-Task Done checks can read predecessor statuses (refactor plan.md:113).
- Edits (signatures at `:181, :186, :198, :211, :230, :241, :271, :287, :305`): createTask, renameTask, deleteTask, addPredecessor, removePredecessor, setProjectName, setDuration, setStartDate, setDayCountingMode. Per edit, against the Done rules:
  - `addPredecessor`: can add a not-Done predecessor, or one completed later, to a Done Task → caught by the guardian; needs an `explain` message.
  - `setStartDate`: can move START after a completion date → caught by the guardian; needs an `explain` message naming the Task. Clearing START (`:289-293`) raises the unset-START question below.
  - `deleteTask` (`:198-208`, no bridging of predecessors to successors) and `removePredecessor` (`:230-238`) only remove dependencies, so on this inspected code they cannot create a Done-rule violation.
  - `setDayCountingMode`, `setDuration`, `renameTask`, `createTask`, `setProjectName`: no Done rule reads what they change.
- Upstream intent (`02-invariant-aggregate-refactor.md:167-171, :185-203, :379-383`): five Done checks (`doneNeedsCompletionDate`, `doneNeedsPredecessorsDone`, `completionDateNotAfterToday`, `completionDateNotBeforeStartDate`, `completionDateNotBeforePredecessors`), `setStatus` and `setCompletionDate` as "addressing + parsing + `accept`, nothing more", and the acceptance test "each Done rule id is produced in exactly one function". The shipped refactor split the single list into per-Task and per-Project lists and notes "S-07's five Done rules are all per-Task" (refactor plan.md:31). A completion date must also be well-formed: import's shape stage only checks it is text (`project-file.ts:301-303`), so an `isIsoDate` check (`calendar-date.ts:62`) belongs in the guardian as well.
- §4.9 of the upstream design (`02-invariant-aggregate-refactor.md:311-313`): "after today" only gets easier as today advances, so a project checked yesterday is still clean today; a backwards clock (time-zone change) can make an unrelated edit fail naming another Task's date; a file from someone whose today is ahead is rejected, as the PRD requires.

### Where `today` would have to reach

Callers that would need it if the guardian takes `today` (inspected via grep of non-test `src/`):

- `accept` via every edit; `useProject.ts` `apply` (`:100-107`), which today never touches the clock.
- `checkProject` ← `parseProjectFile` ← `ProjectControls.tsx:191`.
- `toCheckedProject` ← `createEmptyProject` (`project.ts:163`) and test fixtures (`forecast.test.ts`, `remaining-work.test.ts`, `project.test.ts`).
- `validateProject` ← `RenderCrashFallback.tsx:42` (the crash screen's own check).
- The alternative the edit/import analysis raised: keep the guardian clock-free and run "not after today" only in the Status/completion edits and in import. It is monotonic, so a `CheckedProject` stays valid over time, but it splits one rule across two places, against the "exactly one function" acceptance test above.

### Project file import (`src/lib/services/project-file.ts`)

- Pipeline (`importProject`, `:371-381`): version → START/FINISH shape → `readProject` (strict keys) → `normalise` → `checkUniqueIds` → `checkSupportedYet` → `checkProject`.
- The shape stage already reads both fields: `status` required and one of `TASK_STATUSES` (`:300`); `completionDate` optional text (`:301-303`). The serializer writes `status` always and `completionDate` only when set, in the fixed order `id, name, predecessors, duration?, status, completionDate?` (`:54-66`, `TASK_KEYS :234`). S-07 adds no keys (test-plan-refresh research.md:44).
- Lifting the rejection = deleting stage 6 (`checkSupportedYet`, `:353-369`) and the `task-status-not-supported-yet` id from `ProjectFileRule` (`:21-22`); the Done rules then reach import through `checkProject`. `STATUS_NAMES` (`:351`, not exported) is the only existing To Do / In Progress / Done label map.
- Version stays `"0.1"` (`:19, :179`); the `"1"` bump is owned by M-1's "Done when", not S-07 (roadmap.md:27; `context/archive/2026-10-12-test-plan-refresh-2026-10-12/follow-ups/review-fixes.md:5-10`).
- Golden files: `golden/project-file-0.1.json` and `golden/project-file-0.1-weekdays.json`, all Tasks `"status": "to-do"`, no completion dates; tested by "imports to the project it holds" and "is what serializeProject writes … byte for byte" (`project-file.test.ts:169-195`). S-07 adds a hand-written `project-file-0.1-statuses.json` (test-plan.md §6.3 `:128`); its completion dates must be on or before the real today wherever the "after today" rule runs, which past dates satisfy permanently.

### Session hook (`src/hooks/useProject.ts`)

- Each action wraps one pure edit through `apply` (`:100-107`): run on `latest.current`, commit only if ok, return the `EditResult`. No error state in the hook; views keep `result.error.message` locally. A new `setStatus`/`setCompletionDate` action goes next to `setDuration` (`:128-131`) and into `ProjectActions`. If one user action becomes two `apply` calls (e.g. set Done, then set its date), test-plan §6.5 Phase 2 (`:182`) asks for a case proving no part commits when a later part is rejected.

### UI surfaces

- **TaskPanel** (`TaskPanel.tsx`): fields are Task name (`:159-181`), Duration (`:183-205`), Predecessors (`:207-243`), Add predecessor via `NativeSelect` (`:245-286`), Delete (`:289-299`). Actions are a `Pick<ProjectActions, …>` (`:14-17`) passed from `Planner.tsx:233`. Pattern: local draft, commit on blur or Enter via `<form onSubmit>` with `preventDefault` (CSP `form-action 'none'`), Escape restores, error as `<p role="alert" className="text-destructive text-sm">` linked by `aria-describedby` (`:101-141, :197-204`). TaskPanel receives no `today`.
- **Completion-date input pattern**: `StartPanel.tsx:33-152` — `<Input type="date" min max>`, keyboard draft vs. calendar pick (`:42-44, :106-117`), `validity.badInput` rejected with the domain message (`:62-74`), Clear button. The draft-until-commit behaviour was added specifically so intermediate years never commit and break "START date ≤ completion date" mid-typing (`context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:52-68`).
- **Status control**: `NativeSelect` already used for Day counting (`ProjectControls.tsx:259-276`) and the predecessor picker; `src/components/ui/` holds button, confirm-dialog, input, label, native-select, tooltip — no `select`, `radio-group`, `toggle-group` or `badge`. A rejectable Status select needs the TaskPanel error pattern, unlike Day counting which can never be rejected.
- **ForecastSummary** (`ForecastSummary.tsx`): withheld lines "Validation Warning: {n} Task(s) without Duration." (`:87-88`) and "Forecast not possible until every Task has one." (`:117`, the roadmap's rewording target); legend swatch shown whenever `criticalPathTime.kind === "days"` (`:38-40`), including 0 days; "START date {startDate} is in the past: forecasting from today, {today}." (`:158-162`). Strings asserted in `ForecastSummary.test.ts:78, :89` and in `Planner.test.ts:60, :103, :117` (`forecastRegion()` regex).
- **StartPanel** notes: "This date is in the past: the forecast starts from today, {today}." (`StartPanel.tsx:53-55`) — the panel-side twin of the `start-date-in-past` question.
- **Diagram**: domain node `TaskDiagramNode` (`diagram.ts:36-56`: `accessibleName`, `durationText?`, `durationMissing`, `critical`) has no Status; `taskAccessibleName` (`:125-137`) ignores Status; `TaskNode.tsx:29-47` picks classes in priority selected → durationMissing → critical → default and shows the Duration on the second line. A Done marker needs a new domain field, an accessible-name part (tests query nodes by name, `Planner.test.ts:84-85`), and either an existing token role or a new one in `global.css` `:root`/`.dark`/`@theme inline`.
- **Kitchen sink**: fixtures in `src/dev/KitchenSinkPlanner.tsx:135-151`, built through real edits wrapped in `accepted()`; a new state is a builder + `FIXTURES` entry + `<figure>` in `src/dev/kitchen-sink.astro`. A Done fixture must go through the new edit, not a hand-built object.
- **E2E**: no Status coverage in `e2e/`; `e2e/forecast-today.spec.ts` (fixed clock via `page.clock.setFixedTime`) is the pattern for today-dependent behaviour.

### Tests S-07 must flip or extend (inspected anchors)

- `project-file.test.ts:687-704` — rows for In Progress, Done and `completionDate` expecting `task-status-not-supported-yet`; become round-trip rows.
- `project-file.test.ts:759-769` — stage-order test that uses an In Progress Status as its pre-S-07 limit; needs another way to prove "unique ids → … → Validation Errors" (`context/archive/2026-10-13-weekdays-day-counting/plan.md:211-213`).
- `project.test.ts:576-609` (error order), `:626-646` (guardian `it.each`) — new rules take a position; new edits join.
- `project.property.test.ts:42-86` — edit-step union has no Status step.
- `useProject.test.ts:50-130` — rejected-edit `rows`; one row per new edit-reachable rule (test-plan §6.2 `:115`).
- Hand-built Done projects with "no edit sets a Status yet (S-07)" comments: `forecast.test.ts:46-64, :140-193`, `remaining-work.test.ts:114-132`, `validation-warnings.test.ts:40-52`, `diagram.test.ts:187-197, :303-323`. The forecast ones pass through `toCheckedProject`, so they must satisfy the new rules (their dates do: START 2026-09-01, completions 09-03/09-08, today ≥ completion).
- `diagram.test.ts:303-323` "never marks a Done Task or an edge from it" and the `start-date-in-past` expectations on the Done rows encode current choices tied to the open questions, not PRD values (test-plan.md §6.1 `:103`).

## Code References

- `src/types.ts:8, 22-26` — `TaskStatus`, `Task.status`, `Task.completionDate?` ("set from S-07").
- `src/lib/services/project.ts:21-38` — `ValidationErrorRule` union (no Done rules).
- `src/lib/services/project.ts:64-69` — `accept`, the guardian.
- `src/lib/services/project.ts:170-178` — `checkProject`, `toCheckedProject` (no `today`).
- `src/lib/services/project.ts:182` — `createTask` sets `status: "to-do"`.
- `src/lib/services/project.ts:382-404` — `TASK_CHECKS`, where the per-Task Done rules go.
- `src/lib/services/project.ts:410-428` — `PROJECT_CHECKS`.
- `src/lib/services/project.ts:452` — `validateProject` (file wording; used by `RenderCrashFallback.tsx:42`).
- `src/lib/services/project-file.ts:351-369` — `STATUS_NAMES`, `checkSupportedYet`.
- `src/lib/services/project-file.ts:54-66, :234, :300-303` — serializer order and shape reading of `status`/`completionDate`.
- `src/lib/services/project-file.ts:389` — `parseProjectFile(text)`, caller `ProjectControls.tsx:191`.
- `src/lib/services/forecast.ts:43-54` — `forecastBaseDate`.
- `src/lib/services/remaining-work.ts:52-58, :83-86` — Done = offset 0; the documented dependency on the Done rules.
- `src/lib/services/validation-warnings.ts:17-21` — Done Tasks need no Duration.
- `src/lib/services/calendar-date.ts:62, :111, :116` — `isIsoDate`, `compareIsoDates` (lexical, safe after `isIsoDate`), `todayIsoDate`.
- `src/components/planner/Planner.tsx:124-125, :218, :233` — the one clock read; forecast; StartPanel and TaskPanel props.
- `src/components/planner/ForecastSummary.tsx:38-40, :87-88, :117, :158-162` — swatch, withheld copy, past-START note.
- `src/components/planner/TaskPanel.tsx:14-17, :101-141` — actions Pick and the draft/commit/error pattern.
- `src/components/planner/StartPanel.tsx:33-152` — date-input pattern.
- `src/lib/services/diagram.ts:36-56, :125-137` — diagram node and accessible name (no Status).
- `src/components/planner/diagram/TaskNode.tsx:29-47` — node class priority and second line.

## Architecture Insights

- One rule list, two wordings: Validation Errors are decided only by `TASK_CHECKS`/`PROJECT_CHECKS`; edits explain, they don't check. Adding a Done rule is a list entry plus, where an indirect edit triggers it, an `explain` message — no rule code in `setStartDate` or `addPredecessor`.
- Done is modelled as "finished at the base date", which is exact only under START ≤ completion ≤ today. Those rules are therefore load-bearing for forecast correctness, not just data hygiene (S-04 plan-review F1, `context/archive/2026-10-04-forecast-finish-dates/reviews/plan-review.md:27-45`).
- `today` is injected everywhere it is used (forecast, StartPanel); the clock is read once per render in `Planner`. The S-07 rule that needs today is the first to bring it into the guardian.
- The file format is already S-07-ready (keys, order, optional `completionDate`); S-07 changes import only by removing a gate.

## Historical Context (from prior changes)

- `context/archive/2026-10-19-invariant-aggregate-refactor/plan.md:7, :31, :40-41` — the guardian was built before S-07 so the Done rules become list entries; Done rules, `setStatus`, `setCompletionDate`, removing `checkSupportedYet` and passing `today` (`EditContext`, `options.today`) were all deferred to S-07. Supported by current code (no `EditContext` in `src/`).
- `context/domain/02-invariant-aggregate-refactor.md:167-203, :266, :311-313, :379-383` — planned rule names, edit signatures, example indirect-rejection message, today monotonicity, and Phase 5 as S-07's first step. Partial against current code: its single `VALIDATION_ERROR_CHECKS` list became two lists (refactor plan.md:31).
- `context/archive/2026-10-04-forecast-finish-dates/plan.md:30, :37` — the "all START successors Done" exception needs no code because a Done Task implies START ≤ today; Done contributes 0 days. Supported by `forecast.ts:43-54` and `remaining-work.ts:83-86`.
- `context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:82-90` (F4) — withheld copy wrong once Done exists; "the TaskPanel note may have the same wording". Partial: ForecastSummary still has the wording (`:117`); TaskPanel currently has no such note.
- `context/archive/2026-10-11-project-file-round-trip/plan-brief.md:23-26` — version `"0.1"` through S-07; `completionDate` absent when unset; non-To-Do Statuses and completion dates rejected until S-07. Supported by `project-file.ts:19, :54-66, :353-369`.
- `context/archive/2026-10-10-testing-forecast-dates/reviews/impl-review.md:31-48` (F1) — Done oracle rows pin a `baseDateReason` the code chose, not the PRD; handed to S-07 as a roadmap Unknown.
- `context/archive/2026-10-31-critical-path-highlight/reviews/impl-review-round-1.md:57-65`, `impl-review-round-2.md:71-73` (F4) — mid-diagram highlight start/end next to Done Tasks and the legend swatch for an all-Done project, both handed to S-07 (roadmap.md:177).
- `context/archive/2026-10-13-weekdays-day-counting/plan.md:56, :63` — weekend completion dates in weekdays mode deferred to S-07.
- `context/archive/2026-10-12-testing-edit-rejection-atomicity/plan.md:44, :192` — compound S-07 rejections reuse the hook harness; multi-`apply` actions need an atomicity case.
- `context/audits/observability/2026-10-13_project-file-edit-render-weekdays.md:151` (item 5) — "Pick one invariant policy for render-time code … Do this before S-07." Not verified whether it was done; out of this research's scope.
- `context/foundation/shape-notes.md:277` — "START date in the future with Done Tasks — cannot occur" (resolved edge case).

## Related Research

- `context/archive/2026-10-11-project-file-round-trip/research.md` — file format, open question 3 (reject non-To-Do Statuses until S-07).
- `context/archive/2026-10-12-test-plan-refresh-2026-10-12/research.md` — S-07 adds no keys; Done-rule errors not yet proven.
- `context/archive/2026-10-10-testing-forecast-dates/research.md` — forecast oracle conventions.
- `context/domain/01-domain-distillation.md` — DR-03, DR-04, DR-05, DR-12, DR-13, Q-08, RK-03 (Done rules gap, withheld copy, completion dates only constrain validation, the two labels).

## Open Questions

Product decisions for the user (roadmap Unknowns, `roadmap.md:175-177`):

1. **All-Done project**: both Project Finish Dates equal the base date (today) in the current code; PRD silent. Keep, or show something else (e.g. "all work Done")?
2. **`start-date-in-past` once every direct successor of START is Done**: the PRD says the START date no longer matters then (`prd.md:192`), but `ForecastSummary.tsx:158-162` and `StartPanel.tsx:53-55` still say it is in the past. Keep the note or drop it (needs a new `baseDateReason` or a Status-aware condition)?
3. **Critical-path highlight next to Done Tasks** and the **legend swatch at 0 days**: should START/FINISH edges be highlighted through Done Tasks, and should the swatch hide when nothing is highlighted?

New questions surfaced by this research (not in the roadmap):

4. **How `today` reaches the "completion date after today" rule**: thread `today` through the guardian, every edit, the hook, `parseProjectFile` and `validateProject` (upstream design; one rule location), or check it only in the Status/completion edits and in import (smaller diff; rule in two places). Either way `RenderCrashFallback.tsx:42` and every `toCheckedProject` fixture are affected by the first option.
5. **Completion date with START unset**: the PRD says an unset START means today (FR-006). If "before the START date" compared against today, clearing START with any Task Done before today would be rejected. Recommended reading: no START check when unset (forecast stays exact because the base date is then today).
6. **A completion date on a not-Done Task**: reject as a Validation Error (import normalisation is documented as lossless), or have `setStatus` drop it when leaving Done and reject it only in files?
7. **Setting Done atomically**: since "Done requires a completion date", does one edit set Status and date together (e.g. default to today in the UI), or do two edits run in sequence (then the hook atomicity case of test-plan §6.5 `:182` applies)?
8. **Weekend completion dates in weekdays mode** (deferred from S-06): no PRD rule forbids them and the forecast is unaffected (Done = offset 0 from a base date already moved to Monday); confirm they are allowed.
9. **Diagram treatment of Done Tasks**: show a Done marker / muted style, and whether a Done Task still shows its Duration ("A, 5 days") in the node and its accessible name.
