---
project: "Critical Path"
context_type: greenfield
created: 2026-09-19
updated: 2026-09-19
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "context type"
      decision: "greenfield — repo holds only LICENSE and .gitignore"
    - topic: "primary persona"
      decision: "dev team lead in a corporation; individual planners skip features they don't need; in conflicts, team lead perspective wins"
    - topic: "pain category"
      decision: "workflow friction + missing capability + data can't leave org + stale plans"
    - topic: "access model"
      decision: "single user, no auth, no roles; data stays on the user's device"
    - topic: "persistence between sessions"
      decision: "exported plain-text file is the source of truth; browser also autosaves unsaved work so a closed tab or refresh doesn't lose it"
    - topic: "MVP scope beyond the core flow"
      decision: "in MVP: critical path highlight, failed-validation highlight, statuses + done dates, progress-aware forecast"
    - topic: "MVP timeline"
      decision: "3 weeks after-hours (user estimate)"
    - topic: "editing model"
      decision: "both: drag dependencies between Tasks on the diagram, and edit a selected Task's fields/predecessors in a side panel (superseded by 'editing paths' below)"
    - topic: "autosave priority"
      decision: "nice-to-have (export/import is the must-have persistence)"
    - topic: "progress in forecast"
      decision: "only Done counts (In Progress = not done); Done requires a completion date; not-Done Task cannot start before today; START date in the past is replaced by today"
    - topic: "duration unit and calendar"
      decision: "unit is Day only; project chooses calendar days or weekdays (Mon-Fri); holidays out of MVP"
    - topic: "latest (total-work) date with progress"
      decision: "same base date as earliest forecast + sum of Durations of all not-Done Tasks"
    - topic: "Task identity"
      decision: "every Task gets an auto-generated, constant id; dependencies reference ids, not names; id need not be prominently displayed"
    - topic: "cycles"
      decision: "blocked at input with an explanation naming the cycle; START/FINISH rules also enforced at input"
    - topic: "missing START date"
      decision: "defaults to today"
    - topic: "editing paths"
      decision: "side-panel editing is must-have; drawing dependencies directly on the diagram is nice-to-have"
    - topic: "auto-links"
      decision: "Tasks without predecessors depend on START; Tasks without successors feed FINISH"
    - topic: "remaining work"
      decision: "critical path highlight and critical-path / total-work times cover only remaining (not-Done) work"
    - topic: "import of invalid file"
      decision: "a file containing any Validation Error is rejected with a clear error; a file with only Validation Warnings is imported"
    - topic: "exported content"
      decision: "project data + day-counting setting; forecasts are never exported, always recalculated; format readable and stable for hand edits"
    - topic: "business rule"
      decision: "user accepted the one-sentence rule condensed from their stated forecast rules"
    - topic: "NFRs"
      decision: "zero network egress; ~200 ms perceived update for up to ~100 Tasks; current desktop Chrome/Edge/Firefox/Safari; works offline after load"
    - topic: "product framing"
      decision: "web app; user count irrelevant to load (each user runs own local copy, no server); hard deadline 2026-11-04; after-hours"
    - topic: "Done-date rules"
      decision: "completion date must be today or earlier, not earlier than the START date; a Task can be Done only when all predecessors are Done, with a completion date not earlier than theirs"
    - topic: "nice-to-have FRs"
      decision: "FR-015 and FR-018 are stretch goals: not required for the MVP, built only if time allows"
    - topic: "validation severity"
      decision: "two explicit levels. Validation Error: blocked by the app; a project, exported file or imported file never contains one (cycle; START with a predecessor; Task depending on FINISH; unknown id; Duration not a positive whole number; Done while a predecessor is not Done; Done without completion date; completion date after today, before the START date, or before a predecessor's completion date). Validation Warning: shown to the user; the project can exist, be exported and imported with it (missing Duration on a not-Done Task)"
    - topic: "edits that would indirectly create a Validation Error"
      decision: "rejected with an explanation, like cycles (e.g. reverting a Done predecessor while a successor is Done, adding a not-Done predecessor to a Done Task, moving the START date after a completion date)"
    - topic: "forecast while Validation Warnings exist"
      decision: "no finish date is shown while any Validation Warning exists"
    - topic: "missing Duration on Done Tasks"
      decision: "not a Validation Warning — only not-Done Tasks need a Duration, since the forecast uses only remaining work"
  frs_drafted: 19
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small          # per running instance: one user; total adoption does not create load (no server part)
  qps: none             # no server-side processing; works offline once loaded
  data_volume: small    # up to ~100 Tasks per project
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-11-04
  after_hours_only: true
---

# Shape Notes: Critical Path

## Seed idea (verbatim)

A browser-only tool called "Critical Path" for quickly creating project tasks with dependencies: each task lists the predecessor tasks that must be done before work on that Task can start. Tasks are shown as a diagram that can be edited with UI, but layout is auto-arranged. Tasks have Statuses (To Do, In Progress, Done), Durations and can record finalization date when done. In every project, there are 2 special Tasks - "Start" and "Finish" that don't have Status or Duration. "Start" cannot have predecessors and can be used as "base" predecessor for other Tasks. "Start" can have "Start date" set, which is needed to make a forecast when project will be finished. Conversely, "Finish" can only have predecessors, but no Task can depend on "Finish". Application validates the project (no cyclic dependencies, whether a path from "Start" to "Finish" exists, what is the critical path, if Durations are set). Tasks without predecessors are treated as if they are depending on "Start" directly. Application visualizes critical path (or critical paths, if multiple exist) and where validations fail. When project passess validation, it can calculate critical path time (project can take no less time to finish than critical path time, it assummes unlimited parallellism) and total time to finish the project (worst case scenario assuming no parallellism at all). Both earliest (critical path based) and latest (total work based) project finalization times are then calculated taking into account current date and when specific tasks were already done. No login, no server-side processing and no data sharing, so it can be used in corporate environments. Work is saved by exporting to a plain-text file (so that diffs can be visualized in version control) and imported later. Format to be decided during tech-stack choice, most probably YAML or JSON. Diagram is auto-arranged so that users can focus on content, not layout adjustments, and so that exported file does not have to store information on the layout. Mentors already agreed that since lack of login is a feature, project will be accepted without access-control mechanism implemented.

## Vision & Problem Statement

A planner at an early stage of a project — while still discovering which tasks need doing and how they depend on each other — needs more than a to-do list, because tasks have predecessors that must be done first. Today they reach for an issue tracker or a whiteboard tool. The tracker is slow: it demands multiple mandatory fields at a moment when details are not yet known, so issues end up vague or inaccurate and are never updated; the same friction discourages restructuring, so the tracker is inconsistent with reality from the start. Tracker dependency links ("is blocked by") are information-only and not diagram-first: nothing validates them (e.g. for cycles) and nothing forecasts from them. The whiteboard makes drawing tasks and arrows easy, but offers no validation and no calculation, and manual layout pulls focus from content to arrangement.

Insight: early planning is not tracking — discovery-phase planning needs near-zero-friction task capture, with details added later. A dependency graph is only valuable when the tool validates it and derives the critical path and completion forecasts from it. Auto-arranged layout keeps attention on content (and keeps layout out of the saved file). Running entirely locally, with no login and no data leaving the user's machine, makes the tool usable in corporate environments where cloud tools are not allowed.

## User & Persona

### Primary persona: Dev team lead in a corporation

Leads a development team inside an organization with data and security policies. Reaches for the tool when planning a project whose tasks depend on each other, in the early phase when the task list and dependencies are still being discovered. Keeps plans alongside other work in version control. When needs conflict (e.g. version-control-friendly export vs. ease of use for a casual user), this persona's perspective wins.

### Secondary persona: Individual planner

Anyone planning a personal project with dependent tasks — e.g. someone renovating a house, a student preparing for final exams. Uses the same tool and simply skips features they don't need.

## Access Control

Single user; no auth; no roles. Whoever opens the app in their browser has full control over the project they load. No account is created and no project data leaves the user's device. The exported plain-text file is the source of truth for saving and sharing work (sharing happens outside the app, e.g. via version control); the app additionally keeps unsaved work on the device so that closing the tab or refreshing does not lose it (nice-to-have for MVP; see FR-015). The absence of login is a deliberate product property: it is what makes the tool usable under corporate data and security policies.

## MVP flow (first session)

1. User opens the application in the browser.
2. User adds several Tasks: A, B, C, and sets predecessors so that START → A, A → B, B → C, C → FINISH.
3. User tries to also add C → A. The application rejects it as a Validation Error and explains it would create the cycle A → B → C → A. The project stays unchanged.

   *(Revised in Socrates round: originally the cycle was let in, flagged, and cleared by the user removing C → A. See FR-003, US-01.)*
4. User sets the project start date on START and Durations for A, B, C. Critical-path and total-work project finish dates are now calculated. They are the same, as no parallelism is possible.
5. User adds Task D that depends on A and on which C depends: A → D → C. Project finish dates are no longer calculated; the application shows a Validation Warning that Durations are missing.
6. User adds a Duration to Task D. Critical-path and total-work finish dates are calculated again, and now differ due to possible parallelism.
7. User exports the project to a file. The user is asked for a project name if they did not set it earlier; this is also the name of the exported file.
8. User opens the application in another browser; the project is empty.
9. User imports the previously exported file. The application shows the same data as in the previous browser.

Also in MVP (not exercised in the flow above): critical path(s) highlighted on the diagram; Tasks with Validation Warnings highlighted on the diagram; task statuses (To Do / In Progress / Done) with completion date for Done tasks; forecast that takes the current date and actual completion dates of Done tasks into account.

## Success Criteria

### Primary
- The MVP flow above works end to end: the user builds a task graph, sees a cycle rejected as a Validation Error, gets critical-path and total-work finish dates once all Durations and the start date are set, sees them withheld while a Validation Warning (missing Durations) exists, and round-trips the project through an exported file into a different browser.

### Secondary
- Capturing a plan of ~10 tasks with dependencies takes minutes — clearly faster than creating the same issues in an issue tracker.

### Guardrails
- No project data ever leaves the user's device.
- Exporting and then importing a project yields exactly the same project — no silent data loss.
- A project never contains a Validation Error — not while editing, not in an exported file, not after import.
- While the project has any Validation Warning (e.g. missing Durations), no finish date is shown rather than a misleading one.

## Functional Requirements

### Task graph
- FR-001: User can create a Task by giving only its name; all other Task fields are optional. Priority: must-have
  > Socrates: Counter-argument considered: "two Tasks with the same name are ambiguous." Resolution: every Task gets an auto-generated, constant id that distinguishes it; dependencies are stored by id. The id does not need to be prominently displayed. Names need not be unique.
- FR-002: User can rename and delete a Task. Priority: must-have
  > Socrates: Counter-argument considered: "renames rewrite references; deleting a Task orphans its dependents." Resolution: references use ids, so renames don't touch dependencies. Deleting a Task causes a forecast recalculation; dependents left without predecessors fall back to depending on START, so no Validation Error can arise.
- FR-003: User can add and remove predecessors of a Task; a dependency that would create a cycle, give START a predecessor, or make a Task depend on FINISH is a Validation Error and is rejected at input with an explanation (for a cycle, naming it). Priority: must-have
  > Socrates: Counter-argument considered: "letting a cycle in and warning is more complex than preventing it; START/FINISH rules should be impossible to break in the UI." Resolution: accepted — both are blocked at input. US-01 rewritten accordingly.
- FR-004: User can set a Duration on a Task as a positive whole number of days; any other value is a Validation Error and is rejected at input. Leaving the Duration empty is allowed (see FR-009). Priority: must-have
  > Socrates: Counter-argument considered: "zero or fractional Durations are undefined." Resolution: Duration must be positive; no fractional Durations in MVP.
- FR-005: User can set a Task's Status (To Do, In Progress, Done) and record its completion date when Done. These are Validation Errors, so the app rejects them: marking a Task Done without a completion date, or while any predecessor is not Done; a completion date after today, before the START date, or before a predecessor's completion date. Edits that would create one of these errors indirectly are also rejected with an explanation — e.g. setting a Done predecessor back to not-Done while its successor is Done, adding a not-Done predecessor to a Done Task, or moving the START date after a completion date. Priority: must-have
  > Socrates: Counter-argument considered: "In Progress doesn't affect the forecast; completion dates in the future are undefined." Resolution: no counter-argument; stands as written.
- FR-006: User can set the project start date on START; if none is set, today is assumed. Priority: must-have
  > Socrates: Counter-argument considered: "withholding the forecast until a START date is set adds friction." Resolution: a missing START date defaults to today.
- FR-007: User can set the project name. Priority: must-have
  > Socrates: (covered with FR-008) no separate counter-argument.
- FR-008: User can view the project as an auto-arranged diagram of Tasks and dependencies, select a Task, and edit it in a side panel. Priority: must-have
  > Socrates: Counter-argument considered: "two edit paths (diagram + panel) double the UI work." Resolution: side-panel editing is must-have; direct diagram editing split out as FR-018 (nice-to-have).
- FR-018: User can create a dependency by drawing it directly between two Tasks on the diagram. Priority: nice-to-have
- FR-016: User can start a new, empty project, and is asked to confirm when the current project has changes that were not exported. Priority: must-have
  > Socrates: Counter-argument considered: "starting a new project silently discards unexported work." Resolution: confirmation required when there are unexported changes.
- FR-017: User can choose, per project, whether Durations (in days) count calendar days or weekdays (Mon–Fri) only; the choice is saved with the project. Priority: must-have
  > Socrates: Counter-argument considered: "switching the mode silently shifts forecast dates." Resolution: the day-counting mode is a project setting included in the export; forecasts are never exported and are always recalculated.

### Validation
Validation has two explicit levels:
- **Validation Error** — blocked by the app. A project never contains one — not while editing, not in an exported file, not after import. Examples: cyclic dependency; a Task marked Done while any of its predecessors is not Done; a Task Done before its predecessors were Done (completion date earlier than a predecessor's).
- **Validation Warning** — shown to the user; the project can exist in a state with Validation Warnings and can be exported and imported with them. Example: a not-Done Task missing a Duration.

- FR-009: User can see Validation Warnings — e.g. a not-Done Task missing a Duration — with the affected Tasks highlighted on the diagram; no finish date is shown while any Validation Warning exists. A Done Task without a Duration raises no warning. Priority: must-have
  > Socrates: Counter-argument considered: "every new Task without a successor would be an error until linked." Resolution: Tasks without successors automatically feed FINISH (mirroring Tasks without predecessors depending on START). Note: with cycles blocked at input (FR-003), auto-links to START/FINISH, and files with Validation Errors rejected on import (FR-014), cycle and START→FINISH path problems cannot arise in a project inside the app; they remain Validation Error checks applied to imported files.
- FR-019: User cannot bring the project into a state with a Validation Error: every edit that would create one, directly or indirectly, is rejected at input with an explanation naming the rule it would break. Priority: must-have
  > Socrates: No separate challenge — added on 2026-09-19 when the Validation Error / Validation Warning terms were introduced. It gathers into one place the rejections that were already challenged under FR-003, FR-004 and FR-005.

### Critical path & forecast
- FR-010: User can see the critical path(s) of the remaining (not-Done) work highlighted on the diagram. Priority: must-have
  > Socrates: Counter-argument considered: "highlighting Done Tasks on the critical path is misleading." Resolution: the highlighted critical path covers only remaining work.
- FR-011: User can see critical-path time and total-work time of the remaining (not-Done) work for a project with no Validation Warnings. Priority: must-have
  > Socrates: Counter-argument considered: "remaining vs whole-project time is ambiguous." Resolution: both times count only remaining work.
- FR-012: User can see the earliest (critical-path based) and latest (total-work based) project finish dates, computed from the project start date, the current date and completion dates of Done Tasks. Priority: must-have
  > Socrates: Counter-argument considered: "in weekdays mode a base date on a weekend is undefined." Resolution: in weekdays mode, a base date falling on Saturday or Sunday moves to the following Monday.

### Persistence
- FR-013: User can export the project to a plain-text file named after the project, and is asked for a project name if none is set; a project with Validation Warnings can be exported. Priority: must-have
  > Socrates: Counter-argument considered: "a diff-friendly text file will be hand-edited in version control." Resolution: the file stays human-readable and stable across exports (e.g. ordering, ids) so hand edits and diffs remain meaningful.
- FR-014: User can import a previously exported file and get exactly the same project back; a file containing any Validation Error (e.g. cycle, unknown ids, broken START/FINISH rules, broken Done rules) is rejected with a clear error; a file with Validation Warnings is imported and its warnings are shown. Priority: must-have
  > Socrates: Counter-argument considered: "hand-edited files may be invalid." Resolution: files with Validation Errors are rejected with a clear error.
- FR-015: User's unsaved work survives a tab refresh or close. Priority: nice-to-have
  > Socrates: Counter-argument considered: "losing work to an accidental tab close / data lingering on shared machines." Resolution: no counter-argument; stays nice-to-have.

## User Stories

### US-01: Cycle is prevented and explained

- **Given** a project with START → A → B → C → FINISH
- **When** the user tries to add the dependency C → A
- **Then** the dependency is not created (a cycle is a Validation Error), and the application explains that it would create the cycle A → B → C → A

#### Acceptance Criteria
- The project remains unchanged and the forecast is unaffected.
- Trying to add a predecessor to START, or to make a Task depend on FINISH, is likewise rejected with an explanation.

### US-02: Forecast appears only for a project with no Validation Warnings

- **Given** a project START → A → B → C → FINISH with a START date and Durations on A, B, C
- **When** the user views the forecast
- **Then** critical-path and total-work finish dates are shown, and they are equal (no parallelism possible)

#### Acceptance Criteria
- After adding Task D with A → D → C and no Duration, the finish dates disappear and the application shows a Validation Warning that D is missing a Duration.
- After D gets a Duration, both finish dates are shown again and differ (B and D can run in parallel).

### US-03: Export / import round-trip across browsers

- **Given** a project with no name set
- **When** the user exports it
- **Then** they are asked for a project name, and the exported file is named after the project

#### Acceptance Criteria
- Importing that file in a different browser shows exactly the same project (Tasks, dependencies, Durations, Statuses, completion dates, START date, project name, day-counting setting).
- A project with a Validation Warning (e.g. a Task missing a Duration) is exported and imported like any other; after import the same warning is shown.
- Importing a file that contains a Validation Error (e.g. a cycle added by hand) is rejected with a clear error.

### US-04: Progress changes the forecast

- **Given** a project counting calendar days: START date 1 Sep, START → A (5 days) → B (3 days) → FINISH; forecast finish 9 Sep
- **When** the user marks A as Done with completion date 3 Sep, and today is 3 Sep
- **Then** both earliest and latest finish dates become 6 Sep

#### Acceptance Criteria
- A marked Done on 8 Sep, today 8 Sep → finish dates 11 Sep.
- A marked Done on 3 Sep, today 5 Sep, B not Done → finish dates 8 Sep (a not-Done Task cannot start before today).
- Marking A as In Progress does not change the forecast; only Done does.
- Marking a Task as Done requires a completion date.
- If the START date is in the past and START's direct successors are not all Done, the forecast uses today instead of the START date.
- Marking B as Done while A is not Done is rejected; a completion date after today, before the START date, or before A's completion date is rejected (all are Validation Errors).
- With A and B Done, setting A back to To Do is rejected, because B would then be Done while its predecessor is not.

## Business Logic

From the dependency graph, the durations and the completion dates of Done Tasks, the app forecasts the earliest project finish date (critical path of remaining work, unlimited parallelism) and the latest one (all remaining work done one after another), with no remaining work allowed to start before today.

Inputs (all user-supplied, plus the current date): Tasks, each with an id, a name, predecessors, a Duration in whole positive days, a Status (To Do / In Progress / Done) and, when Done, a completion date; the START date (today if not set); and the project's day-counting mode (calendar days, or weekdays Mon–Fri with no holidays). Structural rules: START has no predecessors; nothing depends on FINISH; a Task without predecessors depends on START; a Task without successors feeds FINISH; cycles are not allowed.

Forecast rules: only Done counts as done — In Progress is treated exactly like To Do. A Task is ready to start as soon as all its predecessors are Done (or forecast to finish); Tasks have no planned start date of their own. A not-Done Task cannot start before today, so a START date in the past is replaced by today, and a Task whose predecessors finished earlier still starts no earlier than today. Once all of START's direct successors are Done, the START date no longer matters. A Task can be marked Done only when all its predecessors are Done, with a completion date that is today or earlier, not earlier than the START date, and not earlier than any predecessor's completion date — so completed work is always consistent with the graph and with the START date. In weekdays mode, a base date falling on Saturday or Sunday moves to the following Monday. The earliest finish date is the end of the longest (critical) path through the remaining work; the latest finish date is the same base date plus the sum of Durations of all not-Done Tasks. Critical-path time and total-work time count only remaining work. Example (calendar days): START 1 Sep, A (5) → B (3) → FINISH forecasts 9 Sep; A Done on 3 Sep with today 3 Sep → 6 Sep; A Done on 8 Sep with today 8 Sep → 11 Sep; A Done on 3 Sep with today 5 Sep → 8 Sep.

Validation has two levels. A **Validation Error** is a state the project may never be in: the app rejects any edit that would create one, directly or indirectly, and explains which rule it would break; an exported file never contains one; an imported file that contains one is rejected. Validation Errors: a cycle; START with a predecessor; a Task depending on FINISH; a dependency on an unknown id; a Duration that is not a positive whole number; a Task Done while any predecessor is not Done; a Done Task without a completion date; a completion date after today, before the START date, or before a predecessor's completion date. A **Validation Warning** is shown to the user, but the project may exist, be exported and be imported with it. Validation Warnings: a not-Done Task missing a Duration (a Done Task needs no Duration, since only remaining work is forecast).

The user encounters the rule continuously while editing: the critical path(s) of remaining work are highlighted on the diagram, and the critical-path time, total-work time and both finish dates are shown whenever the project has no Validation Warnings. While any Validation Warning exists (e.g. a not-Done Task is missing a Duration), no finish date is shown and the affected Tasks are highlighted instead. Forecasts are never saved in the exported file; they are always recalculated.

## Non-Functional Requirements

- Once the application is loaded, no project data is sent over the network; a reviewer observing network traffic while the user creates, edits, exports and imports a project sees no project data leave the device.
- For a project of up to 100 Tasks, the user sees validation results, the forecast and the re-arranged diagram reflect an edit within 200 ms.
- The application remains usable on current versions of Chrome, Edge, Firefox and Safari on desktop.
- Once opened, the application keeps working with no network connection.

## Non-Goals

### Functional
- No resources or assignees — no people, capacity or resource leveling; the forecast deliberately assumes unlimited parallelism (earliest) or none (latest).
- No in-app collaboration — no sync, sharing or multi-user editing; sharing happens outside the app via the exported file (e.g. version control).
- No issue-tracker integration — no import from or export to an issue tracker.
- No Gantt or timeline view — the auto-arranged dependency diagram is the only view.
- No manual layout — users cannot position nodes, and no layout is stored in the exported file; this keeps attention on content.
- No Task-level dates — no planned start dates or "start no earlier than" constraints per Task; only START has a date.
- No estimate ranges — one Duration per Task; no optimistic/pessimistic or probabilistic forecasts.
- No holiday calendars and no sub-day Duration units — Day is the only unit; weekdays mode skips only Saturdays and Sundays.

### Non-functional
- No mobile or small-screen support — only larger (desktop) screens are supported.

## Quality cross-check

Ran 2026-09-19: all elements present (Access Control, Business Logic, project artifacts, timeline ≤ 3 weeks, Non-Goals). Two edge cases surfaced during the check were resolved (Done-date rules; START date in the future with Done Tasks — cannot occur). Status: accepted.

Amended 2026-09-19: introduced the explicit terms Validation Error and Validation Warning. This changed FR-002, FR-003, FR-004, FR-005, FR-009, FR-011, FR-013, FR-014, US-01, US-02, US-03, US-04, the MVP flow (steps 3–4 replaced by the revised step 3), the Success Criteria (Primary and Guardrails) and the Business Logic, and added FR-019. Status: accepted.

## Forward: tech-stack

- Export format: plain text, diff-friendly in version control; YAML or JSON to be decided at tech-stack selection.
- Runs entirely in the browser; no server-side processing.
