<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Progress-Aware Forecast (S-07)

- **Plan**: context/changes/progress-aware-forecast/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5, 6, 7, 8
- **Date**: 2026-11-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 7 observations

Phases 1–7 each had a phase review (`impl-review-phase-1.md` … `impl-review-phase-7.md`); this full review re-checked all eight phases, with weight on Phase 8, the post-plan In Progress rule (e3c064d, e4b1e62) and cross-phase interactions. Automated gates on HEAD (bb47f00): `npm run lint` pass, `npx astro check` 0 errors, `npm test` 578 passed, `npm run build` pass, `npm run check:csp` pass (2 pages), `npm run test:e2e` 9 passed; the clock grep and the `task-status-not-supported-yet` grep find nothing; `PROJECT_FILE_VERSION = "1.0"` is present. Hostile-input probes (scratchpad only: all-Done weekdays project on a Saturday, In Progress in a cycle, malformed predecessor completion date, 5 MB completion date, odd version strings, a backward clock, 2000 property runs calling `forecast` and `projectDiagram` after every accepted edit) found nothing that throws or blanks the planner.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

## Findings

### F1 — Phase 7 follow-ups from earlier reviews were never done

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: context/changes/progress-aware-forecast/follow-ups/review-fixes.md (Phase 2 F1, Phase 3 F3, Phase 6 F2)
- **Detail**: Three items queued for the Phase 7 docs pass have no trace in the diff, and the Phase 7 review does not mention them. (a) Phase 2 F1: neither `prd.md` nor `test-plan.md` records that a clock moving backward leaves `completion-date-after-today` in the project (every edit reports it until the date is moved), or that a file exported on a later local day than the importer's today is rejected. Only the `accept` doc comment (`src/lib/services/project.ts:76-80`) and `context/domain/02-invariant-aggregate-refactor.md:313` say so. (b) Phase 3 F3: no decision on whether `context/domain/01-domain-distillation.md` and `02-invariant-aggregate-refactor.md` are snapshots or living documents; 01 still has UL-37 "Not supported yet (import)" (:74) and DR-03 "No edit sets a Status…" (:166). (c) Phase 6 F2: `test-plan.md` does not record that the app ships no dark mode, so the `.dark` values (`--done` included) were never checked rendered; only `change.md` Notes says so.
- **Fix**: Do the three items now: one Business Logic sentence in the PRD (or a test-plan note) for the clock/file limit, a test-plan note on dark mode, and a header line on 01/02 marking them as point-in-time snapshots (or update UL-37/DR-03 if they are living).
  - Strength: Closes the queue the reviews built, before `/10x-archive` freezes the change folder and the queue with it.
  - Tradeoff: Docs-only; the snapshot-vs-living call is yours to make.
  - Confidence: HIGH — grep finds none of the three in the named documents.
  - Blind spot: Whether the user deliberately dropped them in a session this review cannot see.
- **Decision**: FIXED — PRD Business Logic records the clock-backward and later-day-file limit; test-plan §7 records dark mode as unchecked; 01 and 02 domain docs marked as point-in-time snapshots pointing at glossary.md and prd.md

### F2 — A TaskPanel alert can outlive its cause in another field

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/TaskPanel.tsx:208, :263, :268
- **Detail**: An accepted Status change clears only `statusError` (:208), and an accepted predecessor add/remove clears only `predecessorError` (:263, :268). Two Status rules now tie the fields together, so a `role="alert"` can contradict the screen. Repro 1: B In Progress; add To Do C as a predecessor → refused ("Task 2: B cannot be In Progress while its predecessor 3: C is not Done."); set B to To Do → accepted, but the predecessor alert still says B is In Progress. Repro 2: B has To Do predecessor A; choose Done → refused; remove A → accepted, but the Status alert stays though Done would now be accepted. `commitRename` (:147-151) already clears the other alerts on success.
- **Fix**: On an accepted Status change also clear `predecessorError`; on an accepted predecessor add or remove also clear `statusError`; add a Planner row for one of the repros.
- **Decision**: FIXED — an accepted Status change also clears the predecessor alert; an accepted predecessor add or remove also clears the Status alert (commitPredecessorResult); Planner row "clears a Status refusal once removing the predecessor it named makes the Status possible", red without the fix

### F3 — The 1.0 golden test claims a Done Task without a Duration that the file does not hold

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/project-file.test.ts:211; src/lib/services/golden/project-file-1.0.json
- **Detail**: The test is named "keeps its Validation Warning through import, since a Done Task needs no Duration", copied from the deleted statuses-golden test, whose "Order signage" was Done with no Duration. In `project-file-1.0.json` both Done Tasks have Durations (2 and 3), so the "since" clause is never exercised. Phase 8 deleted the statuses golden on the ground that the 1.0 golden "pins the same fields byte for byte"; no file-level test now covers a Done Task with no Duration (`fullProject()` and `statusRows` all have Durations).
- **Fix**: Drop `"duration": 3` from "Strip out" (Done) in `project-file-1.0.json` and its hand-written expected project, so the warning test exercises its claim and the byte-for-byte check pins that case.
- **Decision**: FIXED — "Strip out" (Done) has no Duration in project-file-1.0.json and GOLDEN_1_0_PROJECT; doc comment updated; contract tests green

### F4 — The property test does not pin "an accepted project never makes the forecast or the diagram throw"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project.property.test.ts:125-151
- **Detail**: The property asserts no accepted Validation Error and an exact round-trip, but not the invariant this slice leans on most: `forecast()` and `projectDiagram()` never throw on an accepted project (weekend `addWeekdays` path, a Done Task with no Duration, the latest completion date as base date). A throw during render blanks the planner. A scratchpad probe (2000 runs, five todays including a weekend and a day before every completion date) shows it holds today; nothing in the gate keeps it holding.
- **Fix**: In the `if (result.ok)` branch, call `forecast` with the edit's today, a weekend today and an earlier today, and `projectDiagram`, and let a throw fail the property.
- **Decision**: FIXED — the property also runs forecast (edit today, a Sunday, a clock moved back) and projectDiagram on every accepted project; numRuns 300 → 1000, since this seed first reaches the all-Done weekdays Saturday case at run 360 (break-checked: skipping the all-tasks-done branch in weekdays mode turns it red)

### F5 — The "newer version" threshold is hard-coded to 1.0

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project-file.ts:191
- **Detail**: `Number(major) > 1 || (Number(major) === 1 && Number(minor) > 0)` repeats `PROJECT_FILE_VERSION` as literals, and the test-plan §6.3 bump recipe does not mention it. A bump to `"2.0"` that follows the recipe would still report `"1.5"` as "newer than version 2.0".
- **Fix**: Derive the major and minor from `PROJECT_FILE_VERSION` with the same `VERSION` regex and compare against them.
- **Decision**: FIXED — checkVersion compares against the major and minor parsed from PROJECT_FILE_VERSION (versionParts, WRITTEN_VERSION_PARTS); probed by setting the version to "2.0": "1.1", "2" and "1.12" stop being newer

### F6 — Completion date `min` encodes only the START bound

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/TaskPanel.tsx:333
- **Detail**: `min={project.start.date ?? MIN_ISO_DATE}` follows the plan, but the calendar still offers dates `completion-date-before-predecessor` will refuse (before the latest predecessor completion date), and `max` = today ignores Done successors' completion dates. Nothing breaks; the guardian refuses with a message.
- **Fix**: Leave it and note in the field's comment that `min`/`max` give the START and today bounds only, the guardian the rest (raising `min` to the latest predecessor completion date is the alternative, at the cost of a second source of the rule).
- **Decision**: FIXED — comment on the Completion date input: min/max are the START and today bounds only; predecessor and Done-successor bounds stay with the guardian

### F7 — `isTaskStatus` lives in the view

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/TaskPanel.tsx:51-53
- **Detail**: Its sibling `isDayCountingMode` sits beside `DAY_COUNTING_MODES` in `src/lib/services/project.ts:347` and is imported by ProjectControls; `isTaskStatus` is defined locally in TaskPanel next to an imported `TASK_STATUSES`.
- **Fix**: Export `isTaskStatus` from `project.ts` beside `TASK_STATUSES` and import it in TaskPanel.
- **Decision**: FIXED — isTaskStatus exported from project.ts beside TASK_STATUSES; TaskPanel imports it

### F8 — Doc and copy nits in the roadmap and kitchen sink

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/roadmap.md:178 (and the S-04 At-a-glance and Backlog rows); src/dev/KitchenSinkPlanner.tsx (`progressProject` doc)
- **Detail**: S-07 Risk misses a full stop ("…`task-status-not-supported-yet`) As its last step…", from 576989f) and still says "seven US-04 acceptance criteria", though the In Progress criterion added on this branch makes eight. The S-04 At-a-glance row ("see both finish dates") and Backlog row ("Show both finish dates") use bare "finish dates" (pre-existing, but in this diff's table reflow). The kitchen-sink doc says "in progress" as prose for a Status value.
- **Fix**: Add the full stop, "seven" → "eight", "both Project Finish Dates" in both S-04 rows, and "with Tasks In Progress" in the kitchen-sink doc.
- **Decision**: FIXED — roadmap S-07 Risk full stop and "eight US-04 acceptance criteria"; S-04 At-a-glance and Backlog rows say "both Project Finish Dates" (Prettier realigned both tables); kitchen-sink progressProject doc says "with Tasks In Progress and Done"

### F9 — Paths that go stale on archive, and the plan does not name the eighth rule

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/styles/global.css:49; context/changes/progress-aware-forecast/plan.md:135
- **Detail**: The `--done` comment (and `tokens.md` references) point at `context/changes/progress-aware-forecast/`, which breaks when `/10x-archive` moves the folder — the same kind of link Phase 6 F4 had to repair for `--critical-path`. The plan still says "seven Validation Error rules"; the In Progress rule is recorded only in `change.md` Notes.
- **Fix**: At archive, repoint the paths to `context/archive/2026-11-01-progress-aware-forecast/`, and add a one-line addendum under Phase 2 of the plan pointing at the `change.md` note.
- **Decision**: FIXED — plan Phase 2 addendum names the eighth rule (in-progress-predecessor-not-done, e3c064d) and points at change.md Notes; the global.css --done path repoint is queued for /10x-archive in follow-ups/review-fixes.md (the only reference outside the change folder)

### F10 — Phase 8 manual checks ticked in the implementation commit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/progress-aware-forecast/plan.md:804-805
- **Detail**: 8.5 (exported file shows `"1.0"`; a `"0.1"` file re-exports with only the version line changed, in `npm run preview`) and 8.6 (a `"1.1"` file rejected with the "newer than version 1.0" message) went from `[ ]` to `[x]` in 576989f, the same commit as the code, with no separate record of a browser run. Automated evidence covers most of it (e2e asserts `"1.0"` on export; unit rows cover the re-export diff and the `"1.1"` message), but not the in-browser import of a `"0.1"` file followed by a re-export.
- **Fix**: Run 8.5 and 8.6 in `npm run preview` before merging, or confirm they were run.
- **Decision**: DISMISSED — the user confirmed 8.5 and 8.6 were run in the browser

## Triage summary (2026-11-01)

- **Fixed**: F1, F2, F3, F4, F5, F6, F7, F8, F9 (9; F9's path repoint queued for `/10x-archive`)
- **Dismissed**: F10 (manual checks confirmed run)

After the fixes: `npm run lint` pass, `npx astro check` 0 errors, `npm test` 579 passed, `npm run build` pass, `npm run check:csp` pass, `npm run test:e2e` 9 passed.
