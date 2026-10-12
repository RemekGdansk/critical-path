# Edit-Rejection Atomicity and the Withheld Forecast Implementation Plan

## Overview

Deliver rollout Phase 2 of `context/foundation/test-plan.md` (risks #5 and #6) by adding the project's first DOM-environment tests: a `renderHook(useProject)` table proving that every edit-reachable Validation Error leaves the planner's state exactly as it was, and a `Planner` render proving that no Project Finish Date, and no stale one, is shown while a Validation Warning exists, that both reappear once it is fixed, and that a rejected Duration is never shown as committed. No production code changes.

## Current State Analysis

- `useProject.apply` (`src/hooks/useProject.ts:54-61`) is the only place an `EditResult` becomes React state: it advances the `latest` ref and calls `setProject` only when `result.ok`. No test imports the hook, so a regression there (commit on both branches, advance `latest` before the check, touch `selection` or `replacements` on a rejection) goes unnoticed, and the per-edit agent hook's `vitest related` finds nothing to run on edits to it (test-plan §6.5, Phase 5 "Stated limit").
- The domain half of "a rejected edit changes nothing" is already proven: `project.test.ts:24-56` runs every edit on a deep-frozen input and checks it is still deep-equal afterwards.
- Withholding is decided once, in `forecast()` (`src/lib/services/forecast.ts:40-42`), and the static render of `ForecastSummary` is tested from a real domain result (`ForecastSummary.test.ts:65-82`). The forecast is memoised in `Planner` (`Planner.tsx:57`, `useMemo(..., [project, today])`), not in the hook, so only a `Planner` render can see a stale memo. Nothing renders `Planner` in a test today.
- Vitest 5.0.3 runs in the Node environment with no `globals` (`vitest.config.ts`); `jsdom` and every `@testing-library/*` package are absent. Tests must stay `.test.ts` (`PROJECT_RULES.md`, Testing).
- `Planner` reads the clock (`Planner.tsx:56`) and accepts `initialProject` and `initialSelection` (`Planner.tsx:29-34`), so a test can start from a fixture with a Task selected, without clicking the diagram.

## Desired End State

`npm test` runs two new jsdom test files:

- `src/hooks/useProject.test.ts` — one row per edit-reachable rejection, each proving: the returned rule and message wording; the project is the same reference and deep-equal to a clone taken before; `selection`, `selectedTask` and `replacements` unchanged; and a following accepted edit applies to the pre-rejection project.
- `src/components/planner/Planner.test.ts` — the withheld → restored sequence with new dates (no stale memo), the node's "no Duration (Validation Warning)" name while withheld, and a rejected Duration that leaves the node and the dates as they were.

Each assertion group has been seen red under a named deliberate break and green after its revert. The test plan records the pattern (§6.2), the corrected §2 guidance and the Phase 2 note; `PROJECT_RULES.md` names the DOM-environment test pattern.

### Key Discoveries:

- `src/hooks/useProject.ts:49-61` — the `latest` ref exists so two edits in one event never apply to a stale render's project; a test can call a rejected then an accepted action inside one `act`.
- `src/hooks/useProject.ts:94-99` — `replaceProject` is the only path that bumps `replacements` and clears `selection`; on an edit rejection both must stay put (`replacements` keys `ProjectControls` and the diagram's `fitKey`, `Planner.tsx:116, 129`).
- `src/lib/services/project.ts:11-27` — `start-has-predecessor` and `task-depends-on-finish` cannot be produced by any edit (the model cannot hold them); they belong to the import contract (Phase 3, `project-file.test.ts`).
- `src/lib/services/project.ts:48-50` — `unknown-task` is reachable through every Task-addressed action, though not through the UI.
- `src/lib/services/project.ts:229-244` — empty Duration input is accepted (it clears the Duration and raises a Validation Warning); `"0"` is rejected as `duration-not-positive-whole-number`.
- `src/lib/services/diagram-layout.ts:47-54` — a Task node's accessible name is `"<name>, <n> days"`, or `"<name>, no Duration (Validation Warning)"` when warned.
- `src/components/planner/TaskPanel.tsx:118-148, 184-198` — the Duration field commits on blur or submit and keeps the rejected draft with a `role="alert"` message; keeping the draft is a recorded design decision, so tests assert the committed views, never that the field reverts.
- `src/components/planner/ForecastSummary.test.ts:17-43` — the pattern for building a fixture through the real edit functions (`accepted(...)`), reused here.
- `src/lib/services/project.test.ts:24-56` — `deepFreeze`, the `edit` wrapper and `expectRejected` (rule plus no "invalid", "conflict" or "blocked"), the shapes to mirror.

## What We're NOT Doing

- No production code change; if a deliberate break shows a test cannot go red, fix the test, not the code.
- No rows for `start-has-predecessor` or `task-depends-on-finish`: no edit can produce them; the import rejection table and `e2e/project-file.spec.ts` already cover them.
- No check of the remaining-work times (critical-path time, total-work time, FR-011): they do not exist until roadmap S-05, which owns that check. Recorded as a hand-off in the test plan only; the roadmap is not edited.
- No per-rule matrix at `Planner` level: every committed view renders from `project` alone, so one rejected-Duration case covers the view half.
- No `@testing-library/user-event`, no happy-dom, no Vitest `setupFiles` or `test.projects`: per-file `// @vitest-environment jsdom` and an explicit `afterEach(cleanup)` keep Node-only tests untouched.
- No new e2e spec, no fake timers or `vi.setSystemTime`.
- No test of S-07's compound or indirect rejections (they do not exist); the hook harness is what S-07 will reuse.

## Implementation Approach

Install the smallest DOM toolset (jsdom, `@testing-library/react`, its required peer `@testing-library/dom`) and prove the commit point first with a table-driven hook test on a deep-frozen project and the real domain, no mocks. Then spike `Planner` under jsdom with React Flow's documented shim; if the unsized flex layout yields no nodes, render it inside a test wrapper with an explicit size and keep the node assertions. Drive the Duration field with `fireEvent.change` plus `fireEvent.blur`, use a START date far in the future so the clock read in `Planner` never affects the expected dates, and restore the cleared Duration with a different value so a replayed forecast fails. Each phase closes with its deliberate breaks, one at a time and reverted. Finally, record the pattern and corrections in the test plan and one sentence in `PROJECT_RULES.md`.

## Critical Implementation Details

- **Fixture identity in the hook test.** Deep-freeze the initial project before passing it to `useProject`, and keep the reference: the `toBe` check is what catches a "commit a rebuilt copy" regression, which `toStrictEqual` alone misses (it would still rerun the forecast and layout memos).
- **Expected dates are literals derived by hand** (§6.1): finish = START + the summed Durations along the path. With START `2999-01-01` and two independent Tasks A (5) and B (3): Resource-Unconstrained `2999-01-06`, Resource-Constrained `2999-01-09`; after A is set to 7: `2999-01-08` and `2999-01-11`. Never compute them with `addDays` or `forecast`.
- **React Flow edges and node measurement are asynchronous**: wait with `findBy*`, never with a timer.

## Phase 1: DOM harness and the `useProject` rejection table

### Overview

Add the DOM test toolset and prove, through the hook's public API on the real domain, that every edit-reachable rejection commits nothing and leaves selection and the replacement counter alone.

### Changes Required:

#### 1. Test dependencies

**File**: `package.json`, `package-lock.json`

**Intent**: Give Vitest a DOM environment and a hook/component renderer, nothing more.

**Contract**: `devDependencies` gain `jsdom`, `@testing-library/react` and `@testing-library/dom` at their current npm releases (research saw jsdom 30.1.x, `@testing-library/react` 16.3.x, `@testing-library/dom` 10.4.x; confirm with `npm view` at install and check jsdom's `engines` against Node 24.21.0). No `@types/jsdom` unless `astro check` or lint requires it. No change to `vitest.config.ts`.

#### 2. Hook rejection table

**File**: `src/hooks/useProject.test.ts` (new)

**Intent**: Prove that `apply` commits only accepted edits: for each edit-reachable rejection, the project, the latest-ref state, the selection and the replacement counter are exactly as before, and the returned error names the rule.

**Contract**:

- First line `// @vitest-environment jsdom`; `afterEach(() => { cleanup(); })` imported from `vitest` and `@testing-library/react` (no `globals`).
- Fixture: a small project built through the real edit functions (an `accepted(...)` helper as in `ForecastSummary.test.ts`), e.g. Tasks A → B with Durations, a START date and a project name, deep-frozen (a local `deepFreeze`, as in `project.test.ts`), passed to `renderHook(() => useProject(fixture, <a Task id>))`. No mocks of `@/lib/services/project`.
- Table rows (one `it.each` row each), inputs taken from the matching domain tests in `project.test.ts`:
  - `cycle` via `addPredecessor` (closing A → B → A); the message contains the cycle path.
  - `task-name-empty`, `task-name-too-long`, `task-name-malformed`, `task-name-control-character` via `renameTask`, plus at least one via `createTask`.
  - `project-name-empty`, `project-name-too-long`, `project-name-malformed`, `project-name-control-character` via `setProjectName`.
  - `duration-not-positive-whole-number` via `setDuration`.
  - `start-date-not-a-date` via `setStartDate`.
  - `unknown-task` via each Task-addressed action: `renameTask`, `deleteTask`, `addPredecessor` (unknown Task and unknown predecessor), `removePredecessor`, `setDuration`.
- Each row asserts: `ok: false`, the exact `rule`, the message contains its rule-specific fragment and matches none of `/invalid|conflict|blocked/i`; `result.current.project` is `toBe` the fixture and `toStrictEqual` a `structuredClone` taken before; `selection`, `selectedTask` (`toBe` the same Task object) and `replacements` (still `0`) unchanged.
- One case per row, or one shared case, for the same-event path: inside one `act`, the rejected action followed by an accepted one (e.g. `setDuration(<id>, "4")`); the resulting project `toStrictEqual` the accepted edit applied to the original fixture alone, computed with the domain function.

### Success Criteria:

#### Automated Verification:

- The hook test passes: `npx vitest run src/hooks/useProject.test.ts`
- The whole suite stays green and Node-only tests still run in Node: `npm test`
- Lint passes, including type-checked rules on the new file: `npm run lint`
- Type check passes: `npx astro check`
- `vitest related` selects the new file for the hook: `npx vitest related src/hooks/useProject.ts --run` lists `src/hooks/useProject.test.ts`

#### Manual Verification:

- Deliberate break 1, `apply` commits unconditionally (e.g. `setProject(result.ok ? result.project : { ...latest.current })`): the identity assertions go red; reverted, green.
- Deliberate break 2, `latest.current` advanced before the `ok` check: the same-event case goes red; reverted, green.
- Deliberate break 3, `setSelection(null)` (or a `replacements` bump) on a rejection: the selection/counter assertions go red; reverted, green.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: `Planner` render — withheld, restored, no stale memo

### Overview

Render the real `Planner` in jsdom and prove the forecast glue: while a not-Done Task lacks a Duration no date is shown and the node is warned; once fixed, new dates appear (not replayed ones); a rejected Duration changes no committed view.

### Changes Required:

#### 1. Spike: `Planner` under jsdom

**File**: `src/components/planner/Planner.test.ts` (new, first case)

**Intent**: Confirm that `Planner` renders under jsdom with React Flow's documented shim and that a Task node is findable by its accessible name, before writing the real cases.

**Contract**: React Flow's testing shim applied in this file only (`beforeAll`): a `ResizeObserver` that fires once, `DOMMatrixReadOnly` with `m22`, `HTMLElement` `offsetWidth`/`offsetHeight` read from `style`, `SVGElement.prototype.getBBox`. If the nodes do not appear inside `Planner`'s unsized flex layout, render `Planner` inside a test wrapper element with an explicit width and height (set through the test's own DOM, not a `style` prop in `src/components/planner/`, which lint forbids there) and keep the node assertions; do not drop them. Record in the §6.2 pattern which variant was needed.

#### 2. Withheld and restored sequence

**File**: `src/components/planner/Planner.test.ts`

**Intent**: Close risk #6 at the only layer that sees the `useMemo` and the prop wiring: dates → withheld with the node warned → different dates.

**Contract**:

- First line `// @vitest-environment jsdom`; `afterEach(cleanup)`; `render(createElement(Planner, { initialProject, initialSelection: <A's id> }))`.
- Fixture through the real edit functions: START `2999-01-01`, Tasks A (5) and B (3), no dependencies between them.
- Steps and assertions, scoped to the forecast's `role="status"` region (pick it out unambiguously, e.g. by its "Project Finish Date" text, if React Flow adds another live region):
  1. Shows "Resource-Unconstrained Project Finish Date 2999-01-06" and "Resource-Constrained Project Finish Date 2999-01-09".
  2. Clear A's Duration (`fireEvent.change` on the "Duration (days)" field to `""`, then `fireEvent.blur`): the region shows "Validation Warning" and "Forecast not possible", contains no "Project Finish Date" text and no `\d{4}-\d{2}-\d{2}` anywhere in its markup; the node named "A, no Duration (Validation Warning)" is found.
  3. Set A's Duration to `"7"`: the region shows `2999-01-08` and `2999-01-11` (not the step 1 dates), no "Forecast not possible"; the node named "A, 7 days" is found.

#### 3. Rejected Duration never shown as committed

**File**: `src/components/planner/Planner.test.ts`

**Intent**: The view half of risk #5: after a rejected edit, the alert names the rule, while every committed view still shows the pre-rejection project.

**Contract**: Same fixture, separate `it`. Change A's Duration to `"0"` and blur: a `role="alert"` with the Duration rule's message ("A Duration must be a positive whole number of days."); the node named "A, 5 days" is still found; the forecast region still shows `2999-01-06` and `2999-01-09`. Do not assert the field's value (the draft stays by design).

### Success Criteria:

#### Automated Verification:

- The `Planner` test passes: `npx vitest run src/components/planner/Planner.test.ts`
- The whole suite stays green: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- `vitest related` selects the new file for the memo's file: `npx vitest related src/components/planner/Planner.tsx --run` lists `src/components/planner/Planner.test.ts`

#### Manual Verification:

- Deliberate break 4, the forecast `useMemo` dependencies at `Planner.tsx:57` changed to `[today]`: the withheld/restored case goes red; reverted, green.
- Deliberate break 5, the `withheld` and dates branches swapped in `ForecastSummary`: the new `Planner` case and `ForecastSummary.test.ts` both go red; reverted, green.
- The per-edit agent hook's `vitest related` on an edit to `src/hooks/useProject.ts` and to `src/components/planner/Planner.tsx` finishes inside its 50 s budget with the new jsdom files.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Test plan and project rules

### Overview

Record the new pattern and the corrections so the next planner-state test, and roadmap S-05 and S-07, start from the right place.

### Changes Required:

#### 1. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Turn §6.2 from TBD into the cookbook pattern, correct the §2 guidance that research showed wrong, and close Phase 2.

**Contract**:

- §2 Risk Response Guidance, row #5: the edit-kind list becomes the edit-reachable set (cycle, Task name, project name, Duration, START date, unknown id), with START-predecessor and depending-on-FINISH noted as import-only (§6.3).
- §2 row #6: the cheapest layer becomes "unit + one `Planner` render (DOM environment)", and the remaining-work times are marked as owned by roadmap S-05 (not yet built).
- §3 row 2: Status `complete`, change folder `testing-edit-rejection-atomicity`.
- §4: the "integration (hooks)" row names jsdom + `@testing-library/react` (+ `@testing-library/dom`) with versions and a `checked:` date; the unit row's test-base count is updated.
- §6.2: location, the `renderHook` table shape (deep-frozen fixture, `toBe` + `toStrictEqual`, selection and counter, same-event case), the `Planner` render shape (shim, sizing variant used, far-future START, restore with a different Duration), the no-mocks rule, `.test.ts` + `createElement` + per-file jsdom comment + `afterEach(cleanup)`, and the run commands.
- §6.5: a Phase 2 note — landed; corrections (edit kinds, cheapest layer); hand-off of the remaining-work-times check to roadmap S-05 and of compound/indirect rejections to S-07 (reuse the hook harness); the Phase 5 "Stated limit" now closed (`vitest related` selects these files for `useProject.ts`, `Planner.tsx` and its import graph).

#### 2. Project rules

**File**: `PROJECT_RULES.md`

**Intent**: Stop the rules from saying Vitest runs only pure logic and static renders, so the next agent writes DOM tests the same way.

**Contract**: The Testing paragraph gains one sentence: state and view tests run in jsdom via a per-file `// @vitest-environment jsdom` comment with `@testing-library/react` (`renderHook`, `render`), still `.test.ts` with `createElement`, explicit `afterEach(cleanup)`, real domain (no mocks), pattern in §6.2 of the test plan. The `npm test` command line mentions these tests.

### Success Criteria:

#### Automated Verification:

- Prettier leaves both files unchanged after formatting: `npx prettier --check context/foundation/test-plan.md PROJECT_RULES.md`
- The full pre-push gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual Verification:

- §2, §3, §4, §6.2 and §6.5 read consistently with each other and with what the two test files actually do (sizing variant, versions, test count).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- None added; the domain rules stay covered by `project.test.ts` and `forecast.test.ts`.

### Integration Tests:

- `src/hooks/useProject.test.ts`: every edit-reachable rejection through the hook, on a deep-frozen fixture and the real domain; the same-event rejected-then-accepted path.
- `src/components/planner/Planner.test.ts`: dates → withheld (node warned, no ISO date in the region) → different dates; a rejected Duration leaves node and dates unchanged.

### Manual Testing Steps:

1. Apply deliberate breaks 1–3 in `useProject.ts` one at a time; see the hook test go red, revert, see it green.
2. Apply deliberate breaks 4–5 in `Planner.tsx` and `ForecastSummary.tsx` one at a time; see the `Planner` test (and, for 5, `ForecastSummary.test.ts`) go red, revert, see them green.
3. Edit `useProject.ts` and `Planner.tsx` with the agent hooks registered; confirm `vitest related` runs the new files within budget.

## Performance Considerations

jsdom startup is paid only by the two new files, through the per-file comment. It adds to `npm test` and to the per-edit `vitest related` run (50 s budget, test-plan §6.5); Phase 2 verifies the budget still holds.

## Migration Notes

None. Dev dependencies only.

## References

- Related research: `context/changes/testing-edit-rejection-atomicity/research.md`
- Test plan rows: `context/foundation/test-plan.md` §2 (#5, #6), §3 row 2, §6.1, §6.5
- Commit point: `src/hooks/useProject.ts:54-61`
- Forecast memo: `src/components/planner/Planner.tsx:55-57`
- Fixture and assertion patterns: `src/components/planner/ForecastSummary.test.ts:17-82`, `src/lib/services/project.test.ts:24-56`
- Prior hand-off: `context/archive/2026-10-10-testing-forecast-dates/plan-brief.md:26`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DOM harness and the `useProject` rejection table

#### Automated

- [x] 1.1 The hook test passes: `npx vitest run src/hooks/useProject.test.ts` — 2aa2087
- [x] 1.2 The whole suite stays green and Node-only tests still run in Node: `npm test` — 2aa2087
- [x] 1.3 Lint passes, including type-checked rules on the new file: `npm run lint` — 2aa2087
- [x] 1.4 Type check passes: `npx astro check` — 2aa2087
- [x] 1.5 `vitest related` selects the new file for the hook: `npx vitest related src/hooks/useProject.ts --run` lists `src/hooks/useProject.test.ts` — 2aa2087

#### Manual

- [x] 1.6 Deliberate break 1, `apply` commits unconditionally: the identity assertions go red; reverted, green. — 2aa2087
- [x] 1.7 Deliberate break 2, `latest.current` advanced before the `ok` check: the same-event case goes red; reverted, green. — 2aa2087
- [x] 1.8 Deliberate break 3, `setSelection(null)` (or a `replacements` bump) on a rejection: the selection/counter assertions go red; reverted, green. — 2aa2087

### Phase 2: `Planner` render — withheld, restored, no stale memo

#### Automated

- [ ] 2.1 The `Planner` test passes: `npx vitest run src/components/planner/Planner.test.ts`
- [ ] 2.2 The whole suite stays green: `npm test`
- [ ] 2.3 Lint passes: `npm run lint`
- [ ] 2.4 Type check passes: `npx astro check`
- [ ] 2.5 `vitest related` selects the new file for the memo's file: `npx vitest related src/components/planner/Planner.tsx --run` lists `src/components/planner/Planner.test.ts`

#### Manual

- [ ] 2.6 Deliberate break 4, the forecast `useMemo` dependencies changed to `[today]`: the withheld/restored case goes red; reverted, green.
- [ ] 2.7 Deliberate break 5, the `withheld` and dates branches swapped in `ForecastSummary`: the new `Planner` case and `ForecastSummary.test.ts` both go red; reverted, green.
- [ ] 2.8 The per-edit agent hook's `vitest related` on `useProject.ts` and `Planner.tsx` finishes inside its 50 s budget with the new jsdom files.

### Phase 3: Test plan and project rules

#### Automated

- [ ] 3.1 Prettier leaves both files unchanged after formatting: `npx prettier --check context/foundation/test-plan.md PROJECT_RULES.md`
- [ ] 3.2 The full pre-push gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual

- [ ] 3.3 §2, §3, §4, §6.2 and §6.5 read consistently with each other and with what the two test files actually do (sizing variant, versions, test count).
