---
project: "Critical Path"
version: 1
status: draft
created: 2026-09-26
updated: 2026-09-26
prd_version: 1
main_goal: quality
top_blocker: time
milestone_id: first-usable-planner
milestone_seq: 1
milestone_status: open
---

# Roadmap: Critical Path

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: First usable planner** — Status: open

- **Intent:** Deliver the PRD's MVP: a planner can capture a task graph with no friction, is prevented from ever saving an invalid project, sees both finish-date forecasts (withheld while warnings exist), tracks progress, and round-trips the project through a plain-text file into another browser.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`, and the PRD's MVP flow (Success Criteria → Primary, steps 1–9) runs end to end on the deployed build.
- **Scope anchors:** FR-001 – FR-014, FR-016, FR-017, FR-019 (all must-have); US-01 – US-04. Nice-to-have FR-015 and FR-018 are parked as stretch goals.

## Vision recap

Early-stage project planning needs near-zero-friction task capture, with details added later; issue trackers are too slow for that, and whiteboards draw arrows but never check or compute anything. Critical Path lets a planner capture Tasks and their predecessors on an auto-arranged diagram, blocks invalid structures such as cycles as they are entered, and forecasts two finish dates from the critical path — the longest chain of dependent remaining work, which bounds how fast the project can finish. Everything runs locally in the browser with no login and no data leaving the device, which is what makes it usable under corporate data policies.

## North star

**S-03: User can export the project to a named plain-text file and import it in another browser to get exactly the same project back** — chosen because the exported file is the MVP's only persistence: until this works, nothing a user builds survives the session, so every other capability is unusable in practice. Under the `quality` goal it is also where the strictest Guardrails ("no silent data loss", "a project never contains a Validation Error — not in an exported file, not after import") are first exercised.

> "North star" here means the smallest end-to-end slice whose successful delivery would prove the product is worth using — it is placed as early as its Prerequisites allow, because everything else only matters if this works.

## At a glance

| ID   | Change ID                     | Outcome (user can …)                                                                        | Prerequisites | PRD refs                                    | Status   |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------- | -------- |
| F-01 | domain-test-gate              | (foundation) automated checks of domain rules run in the pre-merge and deploy quality gates | —             | Guardrails, Business Logic                  | ready    |
| S-01 | capture-task-graph            | user can capture Tasks and predecessors and see them on an auto-arranged diagram            | F-01          | FR-001, FR-002, FR-003, FR-008              | proposed |
| S-02 | reject-invalid-dependencies   | user is stopped from creating a cycle or breaking START/FINISH rules, with an explanation   | S-01          | US-01, FR-003, FR-019                       | proposed |
| S-03 | project-file-round-trip       | user can export the project to a named file and import it back identically elsewhere       | S-02          | US-03, FR-007, FR-013, FR-014               | proposed |
| S-04 | forecast-finish-dates         | user can set START date and Durations and see both finish dates, withheld while warned      | S-01          | US-02, FR-004, FR-006, FR-009, FR-012       | proposed |
| S-05 | critical-path-highlight       | user can see the critical path(s) highlighted plus critical-path and total-work times       | S-04          | FR-010, FR-011                              | proposed |
| S-06 | weekdays-day-counting         | user can switch the project between calendar days and weekdays for all date calculations    | S-04          | FR-017, FR-012                              | proposed |
| S-07 | progress-aware-forecast       | user can mark Tasks In Progress / Done with a completion date and see the forecast adjust   | S-03, S-04    | US-04, FR-005, FR-019, FR-014               | proposed |
| S-08 | start-new-project             | user can start a new empty project, confirming first if changes were not exported           | S-03          | FR-016                                      | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                  | Chain                                          | Note                                                                                              |
| ------ | ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A      | Graph and project file | `F-01` → `S-01` → `S-02` → `S-03` → `S-08`     | Critical chain to the north star; quality goal puts the verification gate and rule-checking first. |
| B      | Forecast               | `S-04` → `S-05`, `S-06`                        | Branches from Stream A at `S-01`; `S-05` and `S-06` can run in parallel.                          |
| C      | Progress tracking      | `S-07`                                         | Joins Stream A at `S-03` and Stream B at `S-04`; extends both editing and import rules.            |

## Baseline

What's already in place in the codebase as of `2026-09-26` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial — static-output app scaffold with a single client-side island per `tech-stack.md`; only a placeholder page (`src/pages/index.astro`) and one UI primitive (`src/components/ui/button.tsx`). No diagram, no app state.
- **Backend / API:** absent by design — no server logic (`tech-stack.md`; `astro.config.mjs` `output: "static"`).
- **Data:** absent by design — no database; persistence is the exported plain-text file (format not yet chosen).
- **Auth:** absent by design — PRD §Access Control: single user, no auth.
- **Deploy / infra:** present — static assets deployed to Cloudflare Workers (`wrangler.jsonc`), auto-deploy on merge, PR quality gate (`.github/workflows/ci.yml`: lint, type check, build), and a Content Security Policy with `connect-src 'none'` (`astro.config.mjs`) enforcing the zero-egress NFR.
- **Observability:** absent by design — no client telemetry (it would violate zero-egress). No automated test runner exists; the quality gate has no behavioural checks.

## Foundations

### F-01: Domain-rule verification gate

- **Outcome:** (foundation) automated checks of pure domain logic can be written and run locally, and they run in both the pre-merge quality gate and the deploy build, so a failing rule check blocks a merge and a deploy.
- **Change ID:** domain-test-gate
- **PRD refs:** Success Criteria → Guardrails; Business Logic (worked forecast examples); US-01 – US-04 Acceptance Criteria
- **Unlocks:** S-01, S-02, S-03, S-04, S-07 — the verification path for the PRD's precise rules (cycle rejection, Done rules, forecast worked examples, exact round-trip), which the current lint/type-check/build gate cannot check.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because the `quality` goal and absolute Guardrails need an executable gate before the first rule lands; kept to a runner wired into both gates plus one smoke check — no test suites written ahead of the slices that own the rules.
- **Status:** ready

## Slices

### S-01: Capture the task graph

- **Outcome:** user can create a Task by name only, rename and delete it, add and remove its predecessors in a side panel, and see the project as an auto-arranged diagram in which Tasks without predecessors hang off START and Tasks without successors feed FINISH.
- **Change ID:** capture-task-graph
- **PRD refs:** FR-001, FR-002, FR-003, FR-008
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Does auto-layout plus re-render of a 100-Task diagram fit the 200 ms NFR on the target desktop browsers? — Owner: user. Block: no.
- **Risk:** Establishes the project model (constant Task ids, id-based references) that every later slice and the file format build on; getting identity wrong here forces rework in S-03.
- **Status:** proposed

### S-02: Reject invalid dependencies with an explanation

- **Outcome:** user who tries to add a dependency that would create a cycle, give START a predecessor, or make a Task depend on FINISH is refused, the project stays unchanged, and the message names the rule — for a cycle, the cycle itself (e.g. A → B → C → A).
- **Change ID:** reject-invalid-dependencies
- **PRD refs:** US-01, FR-003, FR-019
- **Prerequisites:** S-01
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Placed before the north star because import (S-03) must reject hand-edited files containing a cycle, and it should reuse the same rule check rather than a second implementation that could disagree.
- **Status:** proposed

### S-03: Project file round-trip

- **Outcome:** user can set the project name, export the project to a human-readable plain-text file named after it (being asked for a name if none is set), and import that file in another browser to get exactly the same project; a file containing a Validation Error is rejected with a clear error, and a file with only Validation Warnings imports and shows them.
- **Change ID:** project-file-round-trip
- **PRD refs:** US-03, FR-007, FR-013, FR-014
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - Which plain-text format (YAML or JSON) and what stable ordering rules keep exports diff-friendly and hand-editable? — Owner: user. Block: no (decide during planning).
- **Risk:** The file format should cover every project field listed in US-03 (Durations, Statuses, completion dates, START date, name, day-counting mode) from the start, so later slices fill fields without changing the format; each later rule-owning slice (S-04, S-07) adds its rules to import validation as well as to editing.
- **Status:** proposed

### S-04: Forecast finish dates

- **Outcome:** user can set a START date (today if unset) and positive whole-day Durations, and sees the Resource-Unconstrained Project Finish Date (unlimited parallelism) and the Resource-Constrained Project Finish Date (no parallelism); while any not-Done Task lacks a Duration, no finish date is shown and the affected Tasks are highlighted as a Validation Warning.
- **Change ID:** forecast-finish-dates
- **PRD refs:** US-02, FR-004, FR-006, FR-009, FR-012
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Carries the core calculation in calendar-day mode only; the PRD's worked examples are its acceptance checks. Invalid Durations must also be rejected on import if S-03 has landed.
- **Status:** proposed

### S-05: Critical path highlight and remaining-work times

- **Outcome:** user can see the critical path(s) of remaining (not-Done) work highlighted on the diagram, and the critical-path time and total-work time of remaining work whenever the project has no Validation Warnings.
- **Change ID:** critical-path-highlight
- **PRD refs:** FR-010, FR-011
- **Prerequisites:** S-04
- **Parallel with:** S-02, S-03, S-06, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Separate from S-04 so the forecast lands first; multiple equal-length critical paths must all be highlighted.
- **Status:** proposed

### S-06: Weekdays day-counting mode

- **Outcome:** user can choose per project whether Durations count calendar days or weekdays (Mon–Fri) only; all finish dates recalculate, a weekend base date moves to the following Monday, and the choice round-trips through the exported file.
- **Change ID:** weekdays-day-counting
- **PRD refs:** FR-017, FR-012
- **Prerequisites:** S-04
- **Parallel with:** S-02, S-03, S-05, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Isolated from S-04 so calendar arithmetic edge cases (weekend base dates) don't widen the forecast slice.
- **Status:** proposed

### S-07: Progress-aware forecast

- **Outcome:** user can set a Task's Status (To Do, In Progress, Done) with a completion date for Done, and sees both finish dates recalculated from today and the actual completion dates; edits that break the Done rules — directly or indirectly — are rejected with an explanation, and imported files that break them are rejected too.
- **Change ID:** progress-aware-forecast
- **PRD refs:** US-04, FR-005, FR-019, FR-014
- **Prerequisites:** S-03, S-04
- **Parallel with:** S-05, S-06, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The densest rule set in the PRD (seven US-04 acceptance criteria, several indirect-edit rejections); sequenced after the file round-trip so its rules land in editing and import at once.
- **Status:** proposed

### S-08: Start a new project safely

- **Outcome:** user can start a new, empty project, and is asked to confirm first when the current project has changes that were not exported.
- **Change ID:** start-new-project
- **PRD refs:** FR-016
- **Prerequisites:** S-03
- **Parallel with:** S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Depends on S-03 because "unexported changes" is only meaningful once export exists.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                   | Suggested issue title                                        | Ready for `/10x-plan` | Notes                          |
| ---------- | --------------------------- | ------------------------------------------------------------ | --------------------- | ------------------------------ |
| F-01       | domain-test-gate            | Add a domain-rule test gate to CI and the deploy build       | yes                   | Run `/10x-plan domain-test-gate` |
| S-01       | capture-task-graph          | Capture Tasks and predecessors on an auto-arranged diagram   | no                    | Waits on F-01                  |
| S-02       | reject-invalid-dependencies | Reject cycles and START/FINISH violations with explanation   | no                    | Waits on S-01                  |
| S-03       | project-file-round-trip     | Export/import the project as a plain-text file (north star)  | no                    | Waits on S-02                  |
| S-04       | forecast-finish-dates       | Show both finish dates; withhold while Durations are missing | no                    | Waits on S-01                  |
| S-05       | critical-path-highlight     | Highlight critical path(s) and show remaining-work times     | no                    | Waits on S-04                  |
| S-06       | weekdays-day-counting       | Add calendar-days / weekdays counting mode                   | no                    | Waits on S-04                  |
| S-07       | progress-aware-forecast     | Task Statuses, completion dates and progress-aware forecast  | no                    | Waits on S-03, S-04            |
| S-08       | start-new-project           | Start a new project with unexported-changes confirmation     | no                    | Waits on S-03                  |

## Open Roadmap Questions

None open. The PRD's `## Open Questions` has none; the one cross-cutting decision (file format) is a non-blocking Unknown on S-03.

## Parked

- **FR-015: unsaved work survives a tab refresh or close** — Why parked: nice-to-have stretch goal per PRD (resolved 2026-09-19); with `top_blocker: time`, built only if time allows after the milestone's slices.
- **FR-018: draw a dependency directly on the diagram** — Why parked: nice-to-have stretch goal per PRD; side-panel editing (S-01) covers the must-have path.
- **Resources, assignees, capacity or resource leveling** — Why parked: PRD §Non-Goals.
- **Parallelism levels other than 1** — Why parked: PRD §Non-Goals; planned after the MVP.
- **In-app collaboration, sync or sharing** — Why parked: PRD §Non-Goals; sharing happens via the exported file.
- **Issue-tracker integration** — Why parked: PRD §Non-Goals.
- **Gantt or timeline view** — Why parked: PRD §Non-Goals.
- **Manual layout** — Why parked: PRD §Non-Goals; layout is never stored.
- **Task-level dates** — Why parked: PRD §Non-Goals; only START has a date.
- **Estimate ranges or probabilistic forecasts** — Why parked: PRD §Non-Goals.
- **Holiday calendars and sub-day Duration units** — Why parked: PRD §Non-Goals.
- **Mobile / small-screen support** — Why parked: PRD §Non-Goals (non-functional).

## Milestone History

## Done
