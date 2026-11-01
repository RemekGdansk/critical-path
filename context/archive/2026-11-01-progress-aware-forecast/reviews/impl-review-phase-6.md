<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Progress-Aware Forecast (S-07)

- **Plan**: context/changes/progress-aware-forecast/plan.md
- **Scope**: Phase 6 of 8
- **Reviewed phases**: 6
- **Date**: 2026-11-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

Plan drift: every Changes Required item is in `4f68316`. The domain node and accessible names, the `--done` token, the Done node style, the kitchen-sink fixtures and the test rows MATCH. Two departures from the node contract were decided by the user at manual review and are recorded in `change.md` Notes and `tokens.md`. An In Progress node shows a dashed-circle icon and `--foreground` text in place of " · In Progress"; the words stay in the tooltip and the accessible name. A selected Task keeps its state colour and gains a 3px ring in it. `Planner.test.ts` carries the node-name assertions the Phase 5 review deferred to this phase. Every `tokens.md` contrast figure was recomputed and matches. Each kitchen-sink fixture was traced through `forecast.ts` and yields its intended base-date reason. Success criteria re-run: the 2 diagram test files pass (46 tests), `npm test` passes (566), lint passes, `astro check` reports 0 errors, and the build and `check:csp` pass.

## Findings

### F1 — Kitchen-sink captions describe the dropped design

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/dev/kitchen-sink.astro:115, :155-157
- **Detail**: The kitchen sink is the visual gate, so its captions tell a reviewer what to look for. Two of them are stale. The `progress` caption says Build "reads '5 days · In Progress'" and that the selected Done Task "keeps the selection style over the Done border". The build shows a dashed circle with "5 days", and a selected Done node shows a green 3px ring. The `critical-path` caption from an earlier phase ("Build is selected and keeps the selection style") is stale for the same reason: a selected critical Task stays blue. Separately, `progressProject` uses local ids (`writeDocs = 3`) that read against the module constant `WRITE_DOCS = 4`.
- **Fix**: Rewrite both captions to the current design (dashed circle; selection thickens the state colour). Optionally, name the local ids so they don't clash with the module constants.
- **Decision**: FIXED — both captions rewritten to the current design; progress fixture ids named `PROGRESS_DESIGN`/`PROGRESS_BUILD`/`PROGRESS_WRITE_DOCS`

### F2 — Manual rows 6.3 and 6.4 are ticked for a dark check that was not done

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/progress-aware-forecast/plan.md (Progress 6.3, 6.4)
- **Detail**: Row 6.3 says the states "read clearly in light and dark", and row 6.4 says the contrast values "match the rendered colours". Both are `[x]`. The user checked light only, because the app ships no dark mode: nothing applies `.dark`. `change.md` Notes and `tokens.md` record this, but the Progress rows themselves overstate it. Step titles are not renamed by the Progress convention.
- **Fix**: Accept as recorded: the `change.md` note is the trace, and this report links the rows to it. Queue for Phase 7's documentation pass a test-plan line saying dark tokens are computed but unchecked until a dark mode ships.
- **Decision**: FIXED — accepted as recorded in `change.md` Notes; Phase 7 follow-up queued in `follow-ups/review-fixes.md`

### F3 — Focus outline now overlaps the 3px selection ring

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/diagram/TaskNode.tsx:10-13, :56
- **Detail**: The header comment says the focus outline "never hides the selected style". The selection ring is now 3px outside the border (`ring-3`), while the focus outline starts 2px out (`outline-offset-2 outline-3`), so they overlap by 1px. With the old `ring-2` they touched but did not overlap.
- **Fix**: Change `in-focus-visible:outline-offset-2` to `in-focus-visible:outline-offset-3`, which restores the old touching-not-overlapping layout.
- **Decision**: FIXED — `in-focus-visible:outline-offset-3`

### F4 — Stale comments: suffix, near-black selection, START "the way TaskNode does"

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/diagram.ts:26; src/styles/global.css:44, :48; src/components/planner/TerminalNode.tsx:16; context/changes/progress-aware-forecast/tokens.md:3
- **Detail**: These comments still describe the planned design, not the one that was built:
  - `TASK_NODE_SIZE`'s doc still has "In Progress" after the second line.
  - The `--critical-path` and `--done` comments contrast the colour with "the near-black selection", which no selected critical or Done node shows any more.
  - `--critical-path` also points at `context/changes/critical-path-highlight/tokens.md`, which is now under `context/archive/2026-10-31-critical-path-highlight/` (stale before this commit).
  - TerminalNode says START draws its selected ring "the way TaskNode does", but START keeps the translucent `ring-primary/30 ring-4` while a plain Task now uses a solid `ring-primary ring-3`.
  - `tokens.md` lists `border-done` and `text-done` but not `ring-done`.
- **Fix**: Reword the five comments to the current design and fix the archived path. Leave START's ring as is and reword its comment; the user has not asked to align it.
- **Decision**: FIXED — five comments reworded to the current design, archived path fixed, `ring-done` added to `tokens.md`; START's ring unchanged

### F5 — Weaker cues from the approved node design

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/diagram/TaskNode.tsx:38-45, :53
- **Detail**: Both cues follow from the design the user chose:
  - The words "In Progress" appear only in a hover tooltip. Keyboard focus never shows a `title`, and no legend explains the dashed circle. Screen readers get the words through the accessible name. The icon's shape is a non-colour cue, so this is not a WCAG 1.4.1 failure.
  - A selected critical Task differs from an unselected one only by ring width (1px to 3px, same blue).
  - No test renders TaskNode, so neither cue is pinned.
- **Fix**: Accept, since both follow from the design the user chose at manual review. Re-check the selected critical Task in the kitchen sink; if it reads weakly, add a second selection cue such as a ring offset.
- **Decision**: ACCEPTED — both cues follow from the node design the user chose at manual review; no code change
