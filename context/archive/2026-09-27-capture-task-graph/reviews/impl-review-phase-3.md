<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Capture the Task Graph (S-01)

- **Plan**: context/changes/capture-task-graph/plan.md
- **Scope**: Phase 3 of 4
- **Reviewed phases**: 3
- **Date**: 2026-09-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

## Evidence

- Commit `eacf530` changes exactly the planned files: `src/lib/services/diagram-layout.ts`, `src/lib/services/fixtures.ts`, `src/lib/services/diagram-layout.test.ts`, plus Phase 3 progress in `plan.md`. No unplanned or missing files.
- Every point of the `layoutDiagram` contract matches: `"start"`/`"finish"`/`String(task.id)` node ids, `data.taskId`, top-level `width`/`height`, centre → top-left conversion, no `sourcePosition`/`targetPosition`, `"<source>-><target>"` edge ids with an `arrowclosed` marker, a fresh `Graph<GraphLabel, NodeLabel, EdgeLabel>` per call, named dagre imports, React Flow `import type` only, `Edge` aliased as `FlowEdge`, and exported size constants (180×44, 96×40).
- `createPerfProject(taskCount = 100)` is built only through `createTask`/`addPredecessor`.
- Full gate (`npx astro sync && npm run lint && npx astro check && npm test && npm run build`): pass, 4 files and 51 tests.
- Performance probe (a temporary test, removed afterwards): `layoutDiagram(createPerfProject())` averages 26.7 ms over 20 runs in Node. That uses about 13% of the 200 ms NFR budget before React Flow renders anything.

## Findings

### F1 — A comment word compiles `.fixed{position:fixed}` into the production CSS

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/diagram-layout.ts:4
- **Detail**: This repeats the recorded lesson "Pin the build's input set". The comment reads "Positions come from dagre with fixed node sizes". `@source "../**/*.{astro,ts,tsx}"` (`global.css:10`) scans every non-test `.ts` file under `src/`, and `fixed` is a Tailwind utility. A probe confirmed the cause: after rewording the comment, the build had 0 `.fixed` rules (`Layout.GndTkdZN.css`). With the original comment restored it had 1 rule (`Layout.C5Pw4UFY.css`). No other `src/` file uses `fixed`, so a code comment changes the shipped CSS and its asset hash. Domain modules in `src/lib/services/` are prose-heavy and have no class names yet, which makes them the likeliest place for this to happen again.
- **Fix A ⭐ Recommended**: Reword the comment (e.g. "constant node sizes") and rebuild to confirm that `.fixed` is gone from `dist/_astro/*.css`.
  - Strength: One-word change that removes the leak; it was proven by the probe above.
  - Tradeoff: Prevents only this instance; the next comment in a domain module can do the same.
  - Confidence: HIGH — the probe showed the rule appear and disappear.
  - Blind spot: None significant.
- **Fix B**: Also add `@source not "../lib/services/**";` to `global.css` so domain modules are never scanned.
  - Strength: Removes the whole class of leak for the most prose-heavy folder.
  - Tradeoff: Any class name a service returns in the future would be silently dropped from the CSS, for example a critical-path `className` set in `layoutDiagram` for S-05. That failure is quieter than the one it prevents.
  - Confidence: MED — correct today, but it depends on a convention nothing enforces.
  - Blind spot: S-05's highlight design is not planned yet.
- **Decision**: FIXED via Fix A — the comment now reads "constant node sizes". After a rebuild the CSS has 0 `.fixed` rules (`Layout.GndTkdZN.css`).

### F2 — The top-left conversion test pins only the y-axis

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/services/diagram-layout.test.ts:151
- **Detail**: The Testing Strategy asks for "positions are top-left (dagre centre minus half size)". The test checks only `y`. If `x` were left as the centre, every test would still pass. START → Task centres are 198 apart (48 + 60 + 90), so `start.right < task.left` still holds, and nodes in the same rank share a width, so the no-overlap test is unaffected.
- **Fix**: Add an x assertion to the same test, e.g. `expect(task.position.x - (start.position.x + START_FINISH_NODE_WIDTH)).toBe(60)` (the rank gap equals `ranksep`). You could also export `LAYOUT`, or its `ranksep`, instead of hard-coding 60.
- **Decision**: FIXED — added the exported `RANK_SEPARATION` (used as `ranksep`) and an x-axis gap assertion. A mutation probe that removed the x conversion made the test fail.

### F3 — Phase 4 check 4.2 probes the query string, not the fixture code

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/capture-task-graph/plan.md:325, src/lib/services/fixtures.ts:10
- **Detail**: `grep -rl "perf100" dist/` proves that the `?fixture=perf100` branch was eliminated, not that `createPerfProject` was tree-shaken. A top-level import that survives, for example one used outside the `import.meta.env.DEV` guard, would ship the fixture without failing the check. Under the lesson "Verify the artifact, not the config", the check should target a string that only the fixture module contains, such as the literal `Fixture edit was rejected`. Minification preserves string literals.
- **Fix**: Extend the plan's check 4.2 (Phase 4 block and Progress) to `grep -rlE "perf100|Fixture edit was rejected" dist/` returns nothing.
- **Decision**: FIXED — updated check 4.2 in `plan.md:325` and `plan.md:416`.
