---
project: "Critical Path"
version: 1
status: draft
created: 2026-09-19
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: none
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-11-04
  after_hours_only: true
---

# PRD: Critical Path

## Vision & Problem Statement

A planner at an early stage of a project — while still discovering which tasks need doing and how they depend on each other — needs more than a to-do list, because tasks have predecessors that must be done first. Today they reach for an issue tracker or a whiteboard tool. The tracker is slow: it demands multiple mandatory fields at a moment when details are not yet known, so issues end up vague or inaccurate and are never updated; the same friction discourages restructuring, so the tracker is inconsistent with reality from the start. Tracker dependency links ("is blocked by") are information-only and not diagram-first: nothing validates them (e.g. for cycles) and nothing forecasts from them. The whiteboard makes drawing tasks and arrows easy, but offers no validation and no calculation, and manual layout pulls focus from content to arrangement.

Insight: early planning is not tracking — discovery-phase planning needs near-zero-friction task capture, with details added later. A dependency graph is only valuable when the tool validates it and derives the critical path and completion forecasts from it. Auto-arranged layout keeps attention on content (and keeps layout out of the saved file). Running entirely locally, with no login and no data leaving the user's machine, makes the tool usable in corporate environments where cloud tools are not allowed.

## User & Persona

### Primary persona: Dev team lead in a corporation

Leads a development team inside an organization with data and security policies. Reaches for the tool when planning a project whose tasks depend on each other, in the early phase when the task list and dependencies are still being discovered. Keeps plans alongside other work in version control. When needs conflict (e.g. version-control-friendly export vs. ease of use for a casual user), this persona's perspective wins.

### Secondary persona

Individual planner: anyone planning a personal project with dependent tasks — e.g. someone renovating a house, a student preparing for final exams. Uses the same tool and simply skips features they don't need.

## Success Criteria

### Primary
- The MVP flow below works end to end: the user builds a task graph, sees a cycle rejected as a Validation Error, gets the Resource-Unconstrained Project Finish Date and Resource-Constrained Project Finish Date once all Durations and the start date are set, sees them withheld while a Validation Warning (missing Durations) exists, and round-trips the project through an exported file into a different browser.

  MVP flow (first session):
  1. User opens the application in the browser.
  2. User adds several Tasks: A, B, C, and sets predecessors so that START → A, A → B, B → C, C → FINISH.
  3. User tries to also add C → A. The application rejects it as a Validation Error and explains it would create the cycle A → B → C → A. The project stays unchanged.

     *(Revised in Socrates round: originally the cycle was let in, flagged, and cleared by the user removing C → A. See FR-003, US-01.)*
  4. User sets the project start date on START and Durations for A, B, C. The Resource-Unconstrained Project Finish Date and Resource-Constrained Project Finish Date are now calculated. They are the same, as no parallelism is possible.
  5. User adds Task D that depends on A and on which C depends: A → D → C. Project finish dates are no longer calculated; the application shows a Validation Warning that Durations are missing.
  6. User adds a Duration to Task D. The Resource-Unconstrained Project Finish Date and Resource-Constrained Project Finish Date are calculated again, and now differ due to possible parallelism.
  7. User exports the project to a file. The user is asked for a project name if they did not set it earlier; this is also the name of the exported file.
  8. User opens the application in another browser; the project is empty.
  9. User imports the previously exported file. The application shows the same data as in the previous browser.

  Also in MVP (not exercised in the flow above): critical path(s) highlighted on the diagram; Tasks with Validation Warnings highlighted on the diagram; task statuses (To Do / In Progress / Done) with completion date for Done tasks; forecast that takes the current date and actual completion dates of Done tasks into account.

### Secondary
- Capturing a plan of ~10 tasks with dependencies takes minutes — clearly faster than creating the same issues in an issue tracker.

### Guardrails
- No project data ever leaves the user's device.
- Exporting and then importing a project yields exactly the same project — no silent data loss.
- A project never contains a Validation Error — not while editing, not in an exported file, not after import.
- While the project has any Validation Warning (e.g. missing Durations), no finish date is shown rather than a misleading one.

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
- **Then** the Resource-Unconstrained Project Finish Date and Resource-Constrained Project Finish Date are shown, and they are equal (no parallelism possible)

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
- **Then** both the Resource-Unconstrained Project Finish Date and the Resource-Constrained Project Finish Date become 6 Sep

#### Acceptance Criteria
- A marked Done on 8 Sep, today 8 Sep → finish dates 11 Sep.
- A marked Done on 3 Sep, today 5 Sep, B not Done → finish dates 8 Sep (a not-Done Task cannot start before today).
- Marking A as In Progress does not change the forecast; only Done does.
- Marking a Task as Done requires a completion date.
- If the START date is in the past and START's direct successors are not all Done, the forecast uses today instead of the START date.
- Marking B as Done while A is not Done is rejected; a completion date after today, before the START date, or before A's completion date is rejected (all are Validation Errors).
- With A and B Done, setting A back to To Do is rejected, because B would then be Done while its predecessor is not.

## Functional Requirements

Nice-to-have FRs (FR-015, FR-018) are stretch goals: not required for the MVP, built only if time allows.

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
- FR-012: User can see the Resource-Unconstrained Project Finish Date (based on the critical path of remaining work, assuming unlimited parallelism) and the Resource-Constrained Project Finish Date (based on the total remaining work, assuming a maximum parallelism of 1 — i.e. no parallelism — which is the only setting in the MVP), computed from the project start date, the current date and completion dates of Done Tasks. Priority: must-have
  > Socrates: Counter-argument considered: "in weekdays mode a base date on a weekend is undefined." Resolution: in weekdays mode, a base date falling on Saturday or Sunday moves to the following Monday.

### Persistence
- FR-013: User can export the project to a plain-text file named after the project, and is asked for a project name if none is set; a project with Validation Warnings can be exported. Priority: must-have
  > Socrates: Counter-argument considered: "a diff-friendly text file will be hand-edited in version control." Resolution: the file stays human-readable and stable across exports (e.g. ordering, ids) so hand edits and diffs remain meaningful.
- FR-014: User can import a previously exported file and get exactly the same project back; a file containing any Validation Error (e.g. cycle, unknown ids, broken START/FINISH rules, broken Done rules) is rejected with a clear error; a file with Validation Warnings is imported and its warnings are shown. Priority: must-have
  > Socrates: Counter-argument considered: "hand-edited files may be invalid." Resolution: files with Validation Errors are rejected with a clear error.
- FR-015: User's unsaved work survives a tab refresh or close. Priority: nice-to-have
  > Socrates: Counter-argument considered: "losing work to an accidental tab close / data lingering on shared machines." Resolution: no counter-argument; stays nice-to-have.

## Non-Functional Requirements

- Once the application is loaded, no project data is sent over the network; a reviewer observing network traffic while the user creates, edits, exports and imports a project sees no project data leave the device.
- For a project of up to 100 Tasks, the user sees validation results, the forecast and the re-arranged diagram reflect an edit within 200 ms.
- The application remains usable on current versions of Chrome, Edge, Firefox and Safari on desktop.
- Once opened, the application keeps working with no network connection.

## Business Logic

From the dependency graph, the durations and the completion dates of Done Tasks, the app forecasts the Resource-Unconstrained Project Finish Date (critical path of remaining work, unlimited parallelism) and the Resource-Constrained Project Finish Date (all remaining work done one after another, maximum parallelism 1), with no remaining work allowed to start before today.

Inputs (all user-supplied, plus the current date): Tasks, each with an id, a name, predecessors, a Duration in whole positive days, a Status (To Do / In Progress / Done) and, when Done, a completion date; the START date (today if not set); and the project's day-counting mode (calendar days, or weekdays Mon–Fri with no holidays). Structural rules: START has no predecessors; nothing depends on FINISH; a Task without predecessors depends on START; a Task without successors feeds FINISH; cycles are not allowed.

Forecast rules: only Done counts as done — In Progress is treated exactly like To Do. A Task is ready to start as soon as all its predecessors are Done (or forecast to finish); Tasks have no planned start date of their own. A not-Done Task cannot start before today, so a START date in the past is replaced by today, and a Task whose predecessors finished earlier still starts no earlier than today. Once all of START's direct successors are Done, the START date no longer matters. A Task can be marked Done only when all its predecessors are Done, with a completion date that is today or earlier, not earlier than the START date, and not earlier than any predecessor's completion date — so completed work is always consistent with the graph and with the START date. In weekdays mode, a base date falling on Saturday or Sunday moves to the following Monday. The Resource-Unconstrained Project Finish Date assumes unlimited parallelism and is the end of the longest (critical) path through the remaining work. The Resource-Constrained Project Finish Date assumes a maximum parallelism of 1 — the only setting in the MVP, i.e. no parallelism at all — and is the same base date plus the sum of Durations of all not-Done Tasks. Critical-path time and total-work time count only remaining work. Example (calendar days): START 1 Sep, A (5) → B (3) → FINISH forecasts 9 Sep; A Done on 3 Sep with today 3 Sep → 6 Sep; A Done on 8 Sep with today 8 Sep → 11 Sep; A Done on 3 Sep with today 5 Sep → 8 Sep.

Validation has two levels. A **Validation Error** is a state the project may never be in: the app rejects any edit that would create one, directly or indirectly, and explains which rule it would break; an exported file never contains one; an imported file that contains one is rejected. Validation Errors: a cycle; START with a predecessor; a Task depending on FINISH; a dependency on an unknown id; a Duration that is not a positive whole number; a Task Done while any predecessor is not Done; a Done Task without a completion date; a completion date after today, before the START date, or before a predecessor's completion date. A **Validation Warning** is shown to the user, but the project may exist, be exported and be imported with it. Validation Warnings: a not-Done Task missing a Duration (a Done Task needs no Duration, since only remaining work is forecast).

The user encounters the rule continuously while editing: the critical path(s) of remaining work are highlighted on the diagram, and the critical-path time, total-work time, the Resource-Unconstrained Project Finish Date and the Resource-Constrained Project Finish Date are shown whenever the project has no Validation Warnings. While any Validation Warning exists (e.g. a not-Done Task is missing a Duration), no finish date is shown and the affected Tasks are highlighted instead. Forecasts are never saved in the exported file; they are always recalculated.

## Access Control

Single user; no auth; no roles. Whoever opens the app in their browser has full control over the project they load. No account is created and no project data leaves the user's device. The exported plain-text file is the source of truth for saving and sharing work (sharing happens outside the app, e.g. via version control); the app additionally keeps unsaved work on the device so that closing the tab or refreshing does not lose it (nice-to-have for MVP; see FR-015). The absence of login is a deliberate product property: it is what makes the tool usable under corporate data and security policies.

## Non-Goals

### Functional
- No resources or assignees — no people, capacity or resource leveling; the only resource constraint is a maximum parallelism: unlimited for the Resource-Unconstrained Project Finish Date, 1 (no parallelism) for the Resource-Constrained Project Finish Date.
- No parallelism levels other than 1 in the MVP — the Resource-Constrained Project Finish Date always assumes a maximum parallelism of 1; simulating other parallelism levels is planned after the MVP.
- No in-app collaboration — no sync, sharing or multi-user editing; sharing happens outside the app via the exported file (e.g. version control).
- No issue-tracker integration — no import from or export to an issue tracker.
- No Gantt or timeline view — the auto-arranged dependency diagram is the only view.
- No manual layout — users cannot position nodes, and no layout is stored in the exported file; this keeps attention on content.
- No Task-level dates — no planned start dates or "start no earlier than" constraints per Task; only START has a date.
- No estimate ranges — one Duration per Task; no optimistic/pessimistic or probabilistic forecasts.
- No holiday calendars and no sub-day Duration units — Day is the only unit; weekdays mode skips only Saturdays and Sundays.

### Non-functional
- No mobile or small-screen support — only larger (desktop) screens are supported.

## Open Questions

None open.

Resolved:
- **Are the nice-to-have FRs (FR-015, FR-018) out of MVP scope or stretch goals within it?** — Stretch goals: not required for the MVP, built only if time allows. Resolved by user, 2026-09-19.
