<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Forecast Resource-Unconstrained and Resource-Constrained Project Finish Dates

- **Plan**: context/changes/forecast-finish-dates/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 7 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automated checks were re-run on 7d92d38. `npm test` passed (92 tests), and so did `npm run lint`, `npx astro check` (0 errors) and `npm run build`. The built `dist/_astro/*.css` defines `--warning` in both `:root` and `.dark`, plus `.text-warning` and `.border-warning`. The `ETA|deadline` grep is empty. Every planned item is present; nothing is MISSING. A reviewer ran `addDays` over every day from 0001-01-01 to 9999-12-31 with no gaps, and recomputed the `--warning` contrast ratios in `tokens.md`. The Manual Progress items are all checked against commit shas; the browser-only checks (Safari/Firefox, React Profiler) leave no trace in the diff, so they are taken on trust.

The overall verdict is APPROVED rather than NEEDS ATTENTION because the only WARNING-severity finding (F1) is latent until S-03. The three dimensions marked WARNING carry observations only.

## Findings

### F1 — forecast() can throw during render on data an S-03 import could bring in

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/forecast.ts:67, src/lib/services/calendar-date.ts:56, src/lib/services/task-graph.ts:79
- **Detail**:
  - `forecast()` runs during `Planner`'s render. It throws on a malformed START date, an out-of-range `today`, or a cycle. A confirmed example: `forecast(p, "10000-01-01")` throws `"10000-01-01" is not an ISO date.`
  - Nothing in the planner catches this, so a throw blanks the whole island.
  - It can't happen today, because every edit path validates its input.
  - S-03 import makes it reachable for hand-edited files.
  - `forecast` also ignores `dayCountingMode`, as planned. An imported `"weekdays"` project would therefore forecast in calendar days without saying so.
- **Fix A ⭐ Recommended**: Record in the S-03 roadmap slice that import must validate everything through the exported checks. That means the START date (`isIsoDate`), Durations (`isPositiveWholeDays`) and cycles (`wouldCreateCycle`), and rejecting `dayCountingMode: "weekdays"` until S-06 lands.
  - Strength: This is the plan's own design ("S-03 reuses the checks exported here"); it makes the dependency explicit where the next planner will read it.
  - Tradeoff: The island stays unprotected against a bug that gets past validation.
  - Confidence: HIGH. All three checks are already exported and tested.
  - Blind spot: The year-10000 system-clock case stays unhandled. It is negligible.
- **Fix B**: Also add a React error boundary around the planner island now.
  - Strength: A defence in depth. A future validation gap degrades gracefully instead of leaving a blank page.
  - Tradeoff: Adds UI (a fallback state) that the plan doesn't include, plus a component and a kitchen-sink cell.
  - Confidence: MED. Its value depends on how S-03 is built.
  - Blind spot: What the fallback should offer the user (export? reload?) is undecided.
- **Decision**: FIXED (Fix A) — roadmap S-03 Risk now requires import to validate through isIsoDate, isPositiveWholeDays and wouldCreateCycle, and to reject "weekdays" until S-06.

### F2 — Typing a START year commits each intermediate year as a real edit

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/StartPanel.tsx:67
- **Detail**:
  - The plan accepts committing on every change (Critical Implementation Details). Typing "2026" commits 0002-…, then 0020-…, then 0202-…, then 2026-….
  - Each value is a real project edit, and the `role="status"` strip announces "START date 0002-… is in the past…" each time.
  - This is harmless in S-04, but two later slices inherit it:
    - With S-08, every intermediate edit counts as an unexported change.
    - With S-07, an intermediate year can break the "START date ≤ completion date" Done rule, so the user is rejected mid-typing.
- **Fix**: Add a note to the S-07 and S-08 roadmap slices (Risk) that START date commit timing must be revisited. One option: commit on blur/Enter, plus on calendar-popup selection.
  - Strength: Keeps S-04 as planned and puts the constraint where S-07 will meet it.
  - Tradeoff: The screen-reader noise stays until then.
  - Confidence: MED. The interaction with S-07's rejection is inferred, not tested.
  - Blind spot: How each browser fires `change` from the calendar popup without a blur.
- **Decision**: FIXED (fixed differently) — StartPanel keeps a draft: typed changes commit on Enter/blur, Escape restores, and a change with no preceding key press (calendar popup) commits at once. Recorded in the plan Addendum. Needs a manual check in Chrome, Firefox and Safari.

### F3 — Diagram layout re-runs on every START date change

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Diagram.tsx:32
- **Detail**: The dagre layout is memoised on `[project]`, but `layoutDiagram` and `validationWarnings` read only `project.tasks`. `setStartDate` keeps `project.tasks` as the same object, yet the layout still re-runs: about 29 ms for 100 Tasks, roughly 4 times while a year is typed (F2). This is within the 200 ms NFR.
- **Fix**: Memoise the layout on `project.tasks` and pass the Tasks to `layoutDiagram`, or keep the signature and depend on `project.tasks`.
- **Decision**: FIXED — Diagram memoises layoutDiagram on project.tasks; layoutDiagram and validationWarnings take Pick<Project, "tasks">.

### F4 — Withheld copy will be wrong once Done Tasks exist

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/ForecastSummary.tsx:23
- **Detail**: "Both Project Finish Dates are withheld until every Task has one." Done Tasks are exempt from the Duration Validation Warning (`validation-warnings.ts`), so once S-07 adds Done this sentence is inaccurate. The TaskPanel note may have the same wording.
- **Fix**: Add to the S-07 roadmap slice: reword to "every not-Done Task" when Statuses become visible.
- **Decision**: FIXED — roadmap S-07 Risk notes the ForecastSummary and TaskPanel copy to reword for not-Done Tasks.

### F5 — "START" announced twice when START is selected

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Planner.tsx:102, src/components/planner/StartPanel.tsx:53
- **Detail**: `<aside aria-label="START">` contains `<section aria-labelledby>`, whose `<h2>` also reads "START", so screen readers announce two nested "START" regions. `TaskPanel` has no labelled inner section.
- **Fix**: Drop `aria-labelledby` (and the then-unused `headingId`) from StartPanel's `<section>`, keeping the plain `<h2>`.
- **Decision**: FIXED — StartPanel section no longer has aria-labelledby; the h2 is plain.

### F6 — Plan doesn't record the ForecastSummary `startDate` prop and three small copy changes

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/planner/ForecastSummary.tsx:5-10, src/components/planner/Planner.tsx:102, src/lib/services/project.ts:161
- **Detail**:
  - The plan's props are `forecast` and `taskCount`. The code adds `startDate`, which is needed because the "START date <date> is in the past" note has to name the date and `Forecast` doesn't carry it. This is justified drift.
  - Three smaller unrecorded changes:
    - A singular "1 more Task has no Duration." was added.
    - The `<aside>` label reads "Selected Task" for the empty and nothing-selected states too. The plan said it "reflects what is shown".
    - `setStartDate` trims its input.
  - None is wrong. S-03/S-05 planners will read the plan as ground truth, though.
- **Fix**: Add a short addendum to plan.md under Phase 3 §3 and Phase 2 §3 recording these.
- **Decision**: FIXED — Addendum added to plan.md.

### F7 — Two texts claim more than the code does

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/task-graph.ts:52, src/lib/services/project.ts:155
- **Detail**:
  - `topologicalOrder`'s doc says "Ties keep creation order". The code is Kahn's algorithm with a FIFO queue, and its own diamond test expects `[1, 5, 2, 3, 4]`: only Tasks without predecessors stay in creation order. No caller depends on tie order.
  - `"9007199254740992"` is a positive whole number, yet it is rejected with "A Duration must be a positive whole number of days." The input is unreachable in practice.
- **Fix**: Reword the comment to "Deterministic: Tasks without predecessors come in creation order, the rest as they become ready." Leave the Duration message as it is.
- **Decision**: FIXED — topologicalOrder comment reworded; Duration message left as is.

### F8 — Plural "Both Project Finish Dates" isn't an exact PRD term

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/ForecastSummary.tsx:23, src/components/planner/TaskPanel.tsx:201, src/dev/kitchen-sink.astro:33
- **Detail**: The UI copy and comments use the plural "Both Project Finish Dates". It isn't the forbidden "finish date" alone, but it isn't one of the two exact terms either. Given that two commits exist only to fix terminology drift, a later agent may "correct" it inconsistently.
- **Fix**: Add one line to PROJECT_RULES.md → Domain terminology: "Project Finish Dates" (plural) may refer to both together.
- **Decision**: FIXED — PROJECT_RULES.md Domain terminology allows the plural "Project Finish Dates".
