<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Diagram Anti-Corruption Layer

- **Plan**: context/changes/diagram-anti-corruption-layer/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Evidence

- Full gate at HEAD (da0a133): `npm run lint` clean, `npx astro check` 0 errors/warnings/hints, `npm test` 16 files / 387 tests passed, `npm run build` passed, `npm run check:csp` passed (2 pages). `npm run test:e2e`: 6 passed.
- Grep criteria: 1.1 every `durationUnit`/`formatDuration` import comes from `@/lib/services/duration`; 2.1 `diagram.ts`/`diagram.test.ts` import only `vitest` as a third-party package; 3.1 `@xyflow/react` only under `src/components/planner/diagram/` and in `global.css`; 3.2 `@dagrejs/dagre` only in `src/lib/adapters/layout-engine.ts`; 3.3 no `diagram-layout` reference left.
- 3.4 built CSS: Phase 2 (c7b057f, built in a temporary worktree) and HEAD both give `0db993bbaad1af6254ba68836072676ab8c40df1 dist/_astro/Layout.CcHCCpMD.css`.
- Layout parity, done again independently because the Phase 2 parity test was removed by design: the old `diagram-layout.ts` from afe6a33 and `layoutDiagram(projectDiagram(p), layoutEngine)` at HEAD produced the same node ids, positions and edge ids, in the same order, for 6 projects: 100 Tasks, 7 Tasks, empty, a single Task, join/branch, and disjoint chains.
- 4.1 lint fence, probed through `eslint --stdin` without editing files: blocks a type-only `@xyflow/react` import in `services/diagram.ts`, `@dagrejs/dagre` in `services/diagram.test.ts`, `diagram/flow-elements.ts` and `diagram/Diagram.tsx`, `@xyflow/react` in `adapters/layout-engine.ts`, its test, `Planner.tsx` and `Planner.test.ts`, `@xyflow/system` in `TerminalNode.tsx`, and `@dagrejs/dagre` in `hooks/useProject.ts` (10 of 10). No other `no-restricted-imports` config exists for the fence to override, and `diagram/**` keeps all of `plannerLiteralValuesConfig`'s `no-restricted-syntax` entries.
- Behaviour against afe6a33: accessible names, `ariaRole`/`focusable`/`selectable`, the arrowhead marker, `fitView` dependencies, Enter/Space handling and the provider lifetime are all unchanged. The two-pass memo keeps object identity for every node other than START and the selected Task. A `layoutDiagram` refusal is caught by `RenderErrorBoundary`. Every `it` in the deleted `diagram-layout.test.ts` has a counterpart in the new test files.
- "What We're NOT Doing": `package.json`, `package-lock.json`, `src/styles/global.css`, `src/lib/services/project.ts`, `e2e/` and `stryker.config.json` are unchanged since afe6a33. `TerminalNode.tsx` stays in `src/components/planner/`, as the plan says.
- Manual items 1.4, 2.6, 3.7–3.9 and 4.4 are ticked with commit SHAs. They agree with the CSS byte identity, the layout parity and the e2e CSP checks.

## Findings

### F1 — Stale reason in the duration.ts header

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/duration.ts:2-4
- **Detail**: The header says the file is "kept apart from the diagram layout, so a view that only shows a Duration never loads dagre". After Phase 2, `services/diagram.ts` no longer loads dagre, so that reason no longer holds. The real reasons are the glossary-named home for Duration wording, and keeping the helpers out of `project.ts` (Deviation 1).
- **Fix**: Reword to e.g. "Kept apart from the Diagram, so a view that only shows a Duration does not load it, and out of project.ts (the Project aggregate)."
- **Decision**: FIXED

### F2 — flow-jsdom-shim assumes jsdom at import time and a single install

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/diagram/flow-jsdom-shim.ts:7-18
- **Detail**: `shimmed` reads `HTMLElement.prototype` and `SVGElement.prototype` at module load, so importing the shim from a test without `// @vitest-environment jsdom` throws a `ReferenceError` before any test runs. `originals` is module state, so a second `installFlowJsdomShim()` before a restore would record the shim's own descriptors, and the restore would then not undo the shim. Neither can happen today: there is one caller, `Planner.test.ts`, which uses `beforeAll`/`afterAll`.
- **Fix**: State both assumptions in the header comment (jsdom environment required; one install per restore), or build `shimmed` inside `installFlowJsdomShim`.
- **Decision**: FIXED

### F3 — Lint fence does not see dynamic import()

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: eslint.config.js:101-114
- **Detail**: `no-restricted-imports` checks static `import`/`export … from` only, so `import("@xyflow/react")` outside the adapter would pass the gate. Nothing does this today, and the plan only asked for static and type-only imports. A future `ImportExpression` selector must not go into a block that matches `src/components/planner/**`, or it would replace `plannerLiteralValuesConfig`'s `no-restricted-syntax`, the same flat-config override the fence already works around.
- **Fix**: Accept as a known limit (no change); add the override caveat to the fence comment if a dynamic-import rule is ever added.
- **Decision**: ACCEPTED — known limit: nothing uses a dynamic import today, and the plan scoped the fence to static and type-only imports.

### F4 — Mutation review outcome for diagram.ts not recorded

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/diagram-anti-corruption-layer/plan.md:333 (Progress 2.5)
- **Detail**: Step 2.5 ("Selective mutation run on diagram.ts reviewed") is ticked, and `reports/mutation/mutation.html` is dated 2026-10-18 16:31, so a run happened. The repo does not record the score, whether the known Vitest 5 runner false result was worked around, or which survived mutants were looked at. The report is gitignored and will be overwritten by the next run.
- **Fix**: Add one line under change.md Notes with the score and the survived mutants that were deliberately left.
- **Decision**: FIXED — recorded from the existing report: 84 mutants, 82 killed, 2 survived (97.6%), both left deliberately.
