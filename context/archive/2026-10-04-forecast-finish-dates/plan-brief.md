# Forecast Resource-Unconstrained and Resource-Constrained Project Finish Dates — Plan Brief

> Full plan: `context/changes/forecast-finish-dates/plan.md`

## What & Why

Roadmap slice S-04: the user sets a START date and whole-day Durations and sees the Resource-Unconstrained Project Finish Date (longest path, unlimited parallelism) and the Resource-Constrained Project Finish Date (all work one after another). While a not-Done Task lacks a Duration both dates are withheld as a Validation Warning and the Task is highlighted, because the PRD's Guardrails prefer no date to a misleading one.

## Starting Point

S-01 left a project model that already has `Task.duration?` and `Start.date?` (unused), pure edit functions returning `EditResult`, a dagre-laid-out diagram where START and FINISH are inert, and a side panel that edits only a Task's name and predecessors. There is no forecast, no warning token and no way to select START.

## Desired End State

The user selects START and sets its date, types a Duration per Task in the panel, and sees both Project Finish Dates in a header strip, updated on every edit. A Task without a Duration shows "No Duration" in amber on the diagram and the strip explains why the dates are withheld. A past START date forecasts from today, with a note saying so.

## Key Decisions Made

| Decision                 | Choice                                                      | Why (1 sentence)                                                                                    |
| ------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Where START date is set  | Select the START node; a START panel holds the date         | Matches the PRD's "set on START" and the existing select-then-edit model; S-07 can reuse the panel. |
| Where the forecast shows | Strip at the right of the header                            | Always visible regardless of selection, so a Duration edit shows its effect immediately.            |
| START date in the past   | Forecast from today now, with a visible note                | PRD Business Logic already requires it while no Task is Done; the note explains the ignored date.   |
| Duration upper bound     | No cap; dates after 9999-12-31 show "Beyond year 9999"      | Keeps the PRD's Validation Error list unchanged; many Tasks could overflow any cap anyway.          |
| Warning look             | New `--warning` token; nodes show Duration or "No Duration" | Keeps Validation Warnings visually distinct from Validation Errors (destructive red).               |
| Date display             | ISO `yyyy-mm-dd`                                            | Unambiguous and the same form the S-03 file will store.                                             |
| Empty project            | "Add Tasks to see a forecast."                              | A finish date equal to START on an empty canvas would be meaningless.                               |
| Date arithmetic          | Whole day numbers in UTC, `today` injected                  | No DST shifts, and tests control "today".                                                           |

## Scope

**In scope:**

- `setDuration` / `setStartDate` edits with named Validation Error rules
- `validationWarnings` (missing Duration) and `forecast(project, today)`, tested on the PRD examples
- Duration field, selectable START with START panel, forecast strip, warned Task nodes, `--warning` token
- Durations in the 100-Task perf fixture; new kitchen-sink cells

**Out of scope:**

- Completion dates, Statuses UI and Done-rule checks (S-07; the forecast already counts a Done Task as 0 remaining days); critical path and remaining-work times (S-05); weekdays mode (S-06); export/import (S-03)
- Duration cap, locale date formats, midnight refresh without an edit, selectable FINISH

## Architecture / Approach

Pure modules under `src/lib/services/` — `calendar-date`, `validation-warnings`, `forecast` (plus a `topologicalOrder` helper in `task-graph`) — and two new edits in `project.ts`. `useProject` gains the actions and a `TaskId | "start" | null` selection. `Planner` computes `forecast(project, today)` once per change and hands it to a new `ForecastSummary`; `layoutDiagram` adds Duration and the warning flag to Task node data.

## Phases at a Glance

| Phase                            | What it delivers                                                      | Key risk                                                           |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Forecast domain               | Dates, edits, Validation Warnings and forecast with PRD-example tests | Off-by-one in day arithmetic; `Date.UTC` two-digit-year quirk      |
| 2. Editing UI                    | Duration field; START selectable with its date field                  | Widening selection touches hook, diagram, planner and layout tests |
| 3. Forecast display and warnings | Header strip, warned nodes, `--warning` token, fixtures               | Token contrast; two-line node fitting the fixed node height        |

**Prerequisites:** S-01 done (it is); no new dependencies.
**Estimated effort:** ~3 sessions, one per phase.

## Open Risks & Assumptions

- Until S-07 a past START date never moves the dates, which may surprise; the note in the strip and START panel is the mitigation.
- Native `<input type="date">` differs across Chrome, Firefox and Safari (Safari has no built-in clear), hence the explicit Clear button and the cross-browser manual check.
- "Today" is read on render; a tab left open past midnight shows yesterday's base date until the next edit.

## Success Criteria (Summary)

- MVP flow steps 4–6 work under `npm run preview`: equal dates for A → B → C, withheld with D highlighted, differing dates once D has a Duration.
- Invalid Durations and START dates are rejected at input with the rule named; the project never holds them.
- The domain tests encode the PRD's worked examples and pass in CI and the deploy build.
