# Weekdays Day Counting (S-06) — Plan Brief

> Full plan: `context/changes/weekdays-day-counting/plan.md`
> Research: `context/changes/weekdays-day-counting/research.md`

## What & Why

Roadmap S-06 (PRD FR-017, FR-012): the user chooses, per project, whether Durations count calendar days or weekdays (Mon–Fri). Both Project Finish Dates recalculate, a weekend base date moves to the following Monday, and the choice survives export and import. Until now, a weekdays file is rejected on import, because the forecast would silently count calendar days.

## Starting Point

- `dayCountingMode` already exists in the model and the file format. The forecast ignores it, and only `checkSupportedYet` in `project-file.ts` blocks `"weekdays"`.
- The forecast works in whole-day offsets and converts them to dates in one place.
- No edit, hook action or UI control sets the mode.
- The base-date notes (ForecastSummary, StartPanel) and the "days" units (Duration label, node text) know only calendar days.

## Desired End State

- A "Day counting" select in the header switches the project between Calendar days and Weekdays (Mon–Fri), and both Project Finish Dates recompute at once.
- In weekdays mode, the Duration field reads "Duration (weekdays)" and nodes read "5 weekdays".
- A weekend START date, or a weekend today, moves the forecast to Monday, and a note says so, e.g. "2026-10-17 is a Saturday: counting weekdays, the forecast starts on Monday, 2026-10-19."
- Weekdays projects export and import identically. A new golden file pins the format, and the version stays `"0.1"`.

## Key Decisions Made

| Decision                    | Choice                                                                                    | Why (1 sentence)                                                                                       | Source   |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| Counting convention         | Forward-skip, exclusive end: Fri + 1 → Mon, Mon + 5 → next Mon                            | Mirrors calendar mode's exclusive end and keeps offsets additive, so the graph walk is untouched       | Plan     |
| Where mode logic lives      | At the edges: base-date choice plus the offset-to-date conversion                         | Research showed the walk is mode-independent under this convention                                     | Research |
| Reporting the weekend move  | Keep `baseDateReason`; add an optional `movedFromWeekend` date and an extra note sentence | Both facts show when they combine (unset START and a weekend today), and calendar copy stays unchanged | Plan     |
| Base-date source for views  | Exported `forecastBaseDate`, used by `forecast()` and StartPanel                          | The two notes can never disagree, even while the forecast is withheld                                  | Plan     |
| Control placement           | Header NativeSelect in ProjectControls                                                    | A project setting saved in the file, always visible, reusing an existing primitive                     | Plan     |
| Dead import rule            | Remove `day-counting-mode-not-supported-yet`                                              | No dead union member; the stage-order test switches to the Status limit                                | Plan     |
| Duration label              | Follows the mode: "Duration (days)" / "Duration (weekdays)"                               | The unit is stated where the number is typed                                                           | Plan     |
| Node unit                   | Follows the mode: "5 days" / "5 weekdays"                                                 | Field and node never disagree                                                                          | Plan     |
| Weekend START date as input | Kept as entered; only the forecast moves                                                  | The PRD moves the base date and names no Validation Error for a weekend START date                     | Research |

## Scope

**In scope:**

- Weekday helpers in `calendar-date.ts`.
- A mode-aware `forecast()` and the exported base-date function.
- Hand-derived oracle rows.
- The `setDayCountingMode` edit and hook action.
- Lifting and removing the import limit.
- The weekdays golden file and round-trip.
- The header select, the weekend notes, mode-aware units, and the layout memo fix.
- ForecastSummary and Planner tests.
- A kitchen-sink fixture.
- A test-plan handoff note.

**Out of scope:**

- Holidays.
- Rejecting a weekend START date.
- Done Tasks and completion dates (S-07).
- Unexported-change tracking (S-08).
- The file version bump to `"1"` (M-1 close).
- A new e2e spec.
- Rewording the Duration Validation Error.

## Architecture / Approach

`calendar-date.ts` gains `dayOfWeek`, `nextWeekday` and `addWeekdays`. All three work on UTC day numbers, are DST-safe, and range-guard before any multiplication, because a Duration can reach `MAX_SAFE_INTEGER`.

`forecast.ts` gains an exported `forecastBaseDate`. It picks START or today as before, then in weekdays mode moves a weekend base date to Monday, recording the original date. `forecast()` converts offsets with `addDays` or `addWeekdays` according to the mode, and returns the mode and `movedFromWeekend` for the views.

The edit is a plain pure function behind the hook's `apply`. The views read the mode from the project, and the Diagram layout memo gains the mode as a dependency.

## Phases at a Glance

| Phase                                         | What it delivers                                                                | Key risk                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1. Weekday arithmetic and mode-aware forecast | Helpers, `forecastBaseDate`, mode-aware `forecast()`, 8 oracle rows             | Off-by-one at weekends; overflow precision near `MAX_SAFE_INTEGER`                                      |
| 2. Editing and the project file               | `setDayCountingMode`, import limit removed, weekdays golden file and round-trip | Losing the stage-order proof when the weekdays fixture goes away                                        |
| 3. UI                                         | Header select, weekend notes, mode-aware units, kitchen-sink cell, view tests   | Stale node accessible names from the layout memo; drifting calendar-mode copy that e2e asserts verbatim |

**Prerequisites:** S-04 (forecast) and S-03 (file round-trip) are done. Branch `weekdays-day-counting`.
**Estimated effort:** about 2–3 sessions across 3 phases.

## Open Risks & Assumptions

- The PRD does not define the weekday counting convention. The forward-skip exclusive end was chosen here, and the oracle rows encode it.
- The e2e specs run in calendar mode and assert the past-START note verbatim. The plan keeps that copy byte-identical, so no spec edits are expected.
- During S-06, no Done Task can reach the forecast, so weekend completion dates are deferred to S-07.

## Success Criteria (Summary)

- Switching to Weekdays in the header changes both Project Finish Dates to the hand-derived weekday values, and switching back restores the calendar ones.
- A weekend START date shows Monday as the forecast start, with a note naming the weekend date.
- A weekdays project exported in one browser imports identically in another, and the full gate plus e2e stay green.
