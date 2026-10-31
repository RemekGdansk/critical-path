<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Critical Path Highlight

- **Plan**: context/changes/critical-path-highlight/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-31
- **Verdict**: REJECTED (at review); all 7 findings fixed in triage, full gate and `npm run test:e2e` green afterwards
- **Findings**: 1 critical, 2 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | FAIL    |

Evidence gathered: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` pass (435/435 tests, 0 errors, CSP check passed on 2 pages). The targeted Vitest runs for all three phases pass (98 tests). `startDay + duration` appears once in non-test code (`src/lib/services/remaining-work.ts:87`). The built CSS in `dist/_astro/` defines `--critical-path` twice and contains `.border-critical-path`, `.ring-critical-path`, `.bg-critical-path` and `.react-flow__edge.critical-path`. The diff against `main` for `Planner.tsx`, `useProject.ts`, `ProjectControls.tsx`, `RenderCrashFallback.tsx`, `project-file.ts` and `golden/` is empty. `npm run test:e2e`: 6 passed, 1 failed (F1). The critical-path algorithm (forward and backward pass, link rule, overflow handling) was checked independently by two reviewers and found correct. The CSP does not block the arrowhead's inline colour (React applies it through CSSOM, and the island is `client:only`). Manual Progress rows 1.4 and 3.3–3.5 are checked with commit SHAs but leave no artifact in the diff (the mutation report and the preview checks are not committed); 2.4–2.6 are backed by the kitchen-sink cell and `tokens.md`.

## Findings

### F1 — E2E forecast test fails: times line sits between dates and note

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: e2e/forecast-today.spec.ts:41
- **Detail**: `expectForecastFromToday` matches the status region's text with a regex in which "START date … is in the past" follows the Resource-Constrained Project Finish Date directly. Phase 3 put "Critical-path time 3 days · Total-work time 5 days" between them, so `npm run test:e2e` fails ("a past START date is replaced by the local day…"). CI runs this step in the `ci` job, the required check for merges and Dependabot auto-merge, so the PR would go red. The plan's verification chain (plan.md:29, :183, :252) left out `npm run test:e2e`, and its "No Playwright test" decision did not consider existing specs that read the same region.
- **Fix**: Add `Critical-path time\s*3 days\s*·\s*Total-work time\s*5 days\s*` between the constrained date and the note in the regex (the times are the same on both nights), then rerun `npm run test:e2e`.
- **Decision**: FIXED — regex extended with the times line in `e2e/forecast-today.spec.ts`; `npm run test:e2e` 7/7 passed

### F2 — Stale docs and comments after the change

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/domain/glossary.md:44-45, context/foundation/test-plan.md:182, src/components/planner/ForecastSummary.tsx:95, src/dev/KitchenSinkPlanner.tsx:116
- **Detail**: (a) The glossary's "Critical path" row says "the Tasks with zero slack and the links between them", but the code and its tests treat a link between two zero-slack Tasks as critical only when the predecessor finishes on the day the successor starts (A→C is excluded). (b) The "Remaining work" row still cites `totalRemainingDays`, which this change removed. (c) The test-plan hand-off line at :182 still says the remaining-work times "do not exist yet; roadmap S-05 owns their withheld-and-restored check". The plan cited this line (plan.md:16) but only row #6 was updated. (d) The `ForecastSummary` doc comment still describes only the two Project Finish Dates, and the `renderCrashProject` comment names only `forecast()` as the thrower, though `projectDiagram` now throws on a cycle too.
- **Fix**: Change (a) to "…and the links on a longest chain between them" and (b) to `totalWorkTime`. Mark (c) as delivered by S-05, citing `ForecastSummary.test.ts` and the `Planner` test. Mention the times line in (d), and add `projectDiagram` to the crash-fixture comment.
- **Decision**: FIXED — glossary rows (a), (b), test-plan hand-off (c) and both comments (d) updated

### F3 — Shared-file edits wider than the parallel-work contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md:6, :49, :152; src/components/planner/Planner.test.ts:40, :82, :88, :126, :133, :141, :151
- **Detail**: The plan allowed only additive edits to shared files so the merge with S-08 stays trivial. The roadmap edit is not in the plan: it sets `updated` and moves S-05 to `in-progress`. Because "in-progress" is the longest status, prettier re-padded all 11 rows of the "At a glance" table, and S-08 will edit a row there too. Separately, the new ", on the critical path" suffix forced edits to four other tests and the fixture comment in `Planner.test.ts`, beyond the one test the plan named. That was unavoidable, but it is still a possible conflict with S-08.
- **Fix**: Record both as an addendum under the plan's Parallel work bullet. Resolve any roadmap conflict at merge by taking both status values and rerunning `prettier --write`.
- **Decision**: FIXED — addendum under Parallel work in plan.md with the merge-resolution steps

### F4 — Critical chain can start or end mid-diagram next to Done Tasks

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/services/remaining-work.ts:77-80, src/lib/services/diagram.ts:225, :240
- **Detail**: A critical Task whose predecessors are all Done has no START edge, and its incoming links come from Done Tasks, which are never critical. So the highlight starts at the node, and symmetrically a critical Task whose only successors are Done has no highlighted FINISH edge. The test "never marks a Done Task" asserts exactly this. It follows the plan, and Done cannot be set or imported yet, so it is first reachable in S-07.
- **Fix**: Add it to S-07's Unknowns in the roadmap: should the edges from Done Tasks into the critical path be highlighted?
- **Decision**: FIXED — added as an S-07 Unknown in context/foundation/roadmap.md

### F5 — Legend swatch shown when nothing is highlighted

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/ForecastSummary.tsx:34
- **Detail**: When the critical-path time is too large, `remainingWork` marks nothing critical by design, but the swatch still sits beside "Critical-path time Too large to count", so it refers to a highlight that is not drawn. Only reachable with Durations near `Number.MAX_SAFE_INTEGER`.
- **Fix**: Render the swatch only when `forecast.criticalPathTime.kind === "days"`, with a case in `ForecastSummary.test.ts`.
- **Decision**: FIXED — swatch rendered only for a counted critical-path time; too-large test asserts its absence

### F6 — Link-id format built by hand in two modules

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/diagram.ts:160, src/lib/services/remaining-work.ts:122
- **Detail**: `` `${predecessorId}->${taskId}` `` is built separately in both files. Only the `TaskLinkId` template type keeps them in step, and it would not catch a swapped argument order.
- **Fix**: Export `taskLinkId(predecessorId, taskId): TaskLinkId` from `remaining-work.ts` and use it in both places.
- **Decision**: FIXED — `taskLinkId()` exported from remaining-work.ts and used in both modules

### F7 — Times line uses spans, not the sibling `<dl>`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/ForecastSummary.tsx:33
- **Detail**: The two Project Finish Dates are `<dt>`/`<dd>` pairs, but the two times are plain `<span>`s in a `<p>`, so assistive technology does not tie each value to its label. The planned one-line layout makes this acceptable.
- **Fix**: Leave as is, or render the line as an inline `<dl>` with the same classes.
- **Decision**: FIXED — times line rendered as an inline `<dl>` (swatch and separator inside the `<dt>`s); test asserts each value sits in the `<dd>` after its label

## Triage summary

- Fixed: F1, F2, F3, F4, F5, F6, F7 (7)
- After the fixes, `npm run lint && npx astro check && npm test && npm run build && npm run check:csp && npm run test:e2e` pass (435 unit tests, 7 e2e tests).
