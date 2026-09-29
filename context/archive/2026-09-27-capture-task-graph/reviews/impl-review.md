<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Capture the Task Graph (S-01)

- **Plan**: context/changes/capture-task-graph/plan.md
- **Scope**: Full plan. Phase 4 was checked in depth. For Phases 1–3 this review re-ran the automated criteria, did a safety pass and checked the cross-phase contracts; plan drift for those phases is covered by impl-review-phase-1/2/3.md.
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-09-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Findings

### F1 — "Add predecessor" select adds a predecessor while the user is only browsing with the keyboard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/TaskPanel.tsx:153-158
- **Detail**: The native `<select>` calls `addPredecessor` on every `change` event and is then held at `value=""`. A closed select also fires `change` without a click: on Arrow Up/Down in Chrome and Firefox on Windows and Linux, and on type-ahead on most platforms. Type-ahead is easy to hit by accident because every label starts with the id ("7: Name"). Each such keypress adds a predecessor. The select then resets and the added Task leaves the list, so repeated ArrowDown presses keep adding candidates. `eligiblePredecessors` still prevents any Validation Error, but the user gets edits they did not intend and must undo them one by one. This is a gap in the plan itself: plan.md:308 says "adds on change" without considering the keyboard (the WCAG 3.2.2 On Input pattern).
- **Fix A ⭐ Recommended**: Keep the native select, hold the choice in local state, and add it with an explicit "Add" button (a small form with `preventDefault`).
  - Strength: Keeps the "N: Name" native control the plan chose. Needs no new dependency and adds no new CSP surface. The same form pattern as NewTaskForm.
  - Tradeoff: Adding a predecessor with the mouse takes two clicks instead of one.
  - Confidence: HIGH — a standard pattern that uses only components already in the repo.
  - Blind spot: The Phase 4 manual check 4.3 wording ("set A → B in the panel") still holds, but it was not re-tested.
- **Fix B**: Replace the native select with shadcn `Select` or `Combobox`, which commit only on Enter or click.
  - Strength: Keeps one-step selection and adds search for long Task lists.
  - Tradeoff: New Radix dependency and portal/positioning code. The CSP has to be re-verified under preview, because Radix positions content with inline styles set at runtime.
  - Confidence: MED — CSSOM style writes are normally allowed under `style-src`, but that has not been proven for this build.
  - Blind spot: Not checked against `connect-src 'none'`/`style-src` in `npm run preview`.
- **Decision**: FIXED via Fix A. The select now only picks, into local state. An "Add" submit button in a `preventDefault` form commits the choice. A pick that becomes ineligible resolves to the placeholder. The plan's Phase 4 TaskPanel contract was updated to match. Lint, astro check and tests pass. Manual re-check of 4.3 is still pending.

### F2 — Task nodes are keyboard tab stops that do nothing

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Diagram.tsx:55-65
- **Detail**: React Flow makes nodes focusable by default. Pressing Enter or Space on a focused node goes through React Flow's internal selection (`addSelectedNodes` → `onNodesChange`), not through `onNodeClick`, and `Diagram` passes no `onNodesChange`. As a result, Tab visits every Task node and nothing happens on activation. After "Delete Task", focus also falls to `<body>`. Keyboard node selection is out of scope (plan.md:39), so this does not break the plan. The problem is only the empty tab stops.
- **Fix**: Pass `nodesFocusable={false}` (and `edgesFocusable={false}`) until a slice adds keyboard selection.
- **Decision**: FIXED — `nodesFocusable={false}` and `edgesFocusable={false}` added to `<ReactFlow>` with a comment; lint and astro check pass.

### F3 — A rejected rename draft is discarded without trace when another Task is selected

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/TaskPanel.tsx:48-60, 97; src/components/planner/Planner.tsx:47
- **Detail**: Blur commits the draft before the node click, which is correct, and the `latest` ref in useProject keeps the edits in order. If that commit is rejected (for example an empty name), the click still remounts the panel through `key={task.id}`, and the draft and its rule message disappear. No project data is lost; only the uncommitted draft is. This matches the plan's "draft resets on selection change".
- **Fix**: Accept as planned. Revisit only if users report surprise.
- **Decision**: ACCEPTED — matches the plan's "draft resets on selection change"; no project data is lost. No code change.

### F4 — `eligiblePredecessors` re-walks the graph once per candidate

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/task-graph.ts:34-42 (used at src/components/planner/TaskPanel.tsx:46)
- **Detail**: Each candidate calls `wouldCreateCycle`, which rebuilds the predecessor map and walks ancestors again. That is O(n·(n+e)) and is recomputed on every edit while the panel is open. At 100 Tasks this is about 30k steps, negligible against the 200 ms budget. S-02 will extend this module, so this is the right time to note it.
- **Fix**: Queue for S-02: compute the Task's descendant set once (one pass over a successor map) and exclude it.
- **Decision**: FIXED — queued in follow-ups/review-fixes.md for S-02 planning.

### F5 — Phase 4 manual checks were ticked in the implementation commit, with no measurement recorded for the 200 ms NFR

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/capture-task-graph/plan.md:420-427
- **Detail**: Manual items 4.3–4.10 were flipped to `[x]` in the same commit that added the UI (e28c547). The plan asks for a pause for human confirmation, and nothing in the repo records that the pause happened. Check 4.9 (200 ms at 100 Tasks) is also the evidence for the roadmap's S-01 Unknown ("Does auto-layout plus re-render of a 100-Task diagram fit the 200 ms NFR?"), yet no measured times are written down.
- **Fix**: Confirm the manual checks were actually run, and append the measured commit times (add, remove, delete) to 4.9 so the S-01 roadmap Unknown can be closed with evidence.
- **Decision**: FIXED. The user confirmed the checks were run and 4.9 passed under 200 ms, but no figures were recorded. The plan's Progress row 4.9 now says so.
