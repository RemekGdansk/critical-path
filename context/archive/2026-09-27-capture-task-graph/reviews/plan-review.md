<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Capture the Task Graph (S-01)

- **Plan**: context/changes/capture-task-graph/plan.md
- **Mode**: Deep
- **Date**: 2026-09-29
- **Verdict**: REVISE → SOUND after triage
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

6/6 paths ✓, 6/6 symbols ✓ (global.css:5-11, :40-47, eslint.config.js:17, :44, dagre graph-lib.d.ts:2-3, vitest.config.ts:5), brief↔plan ✓, Progress↔Phase ✓. Library types inspected from the @xyflow/react 12.12.0, @xyflow/system 0.0.83 and @dagrejs/dagre 3.1.1 tarballs.

## Findings

### F1 — Phase 1 CSS-layering check cannot fail

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Manual Verification (1.4)
- **Detail**: Check 1.4 referred to a toolbar that does not exist until Phase 4 and a heading Phase 1 removes; no Tailwind utility competed with a React Flow rule, so the check passed whether or not `layer(components)` worked.
- **Fix**: Give the Phase 1 START node a competing Tailwind background class and verify it wins over React Flow's default node background.
- **Decision**: FIXED — START node carries `bg-primary text-primary-foreground` as a layering probe; 1.4 reworded in the Phase block and Progress (plan not yet reviewed, so the title change is allowed).

### F2 — `targetPosition: "left"` fails the type check under `import type`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Projection and layout (contract)
- **Detail**: `Position` is a string enum (@xyflow/system `types/utils.d.ts:8`); tsc confirms `TS2322: Type '"left"' is not assignable to type 'Position | undefined'`. The contract also required `import type` only for React Flow symbols. `MarkerType` is unaffected (`EdgeMarker.type` accepts `${MarkerType}`).
- **Fix**: Drop `targetPosition`/`sourcePosition` from the projection; edge sides come from the handle's `position` (`getEdgePosition` reads `sourceHandle?.position`), set by `<Handle position>` in the Phase 4 custom nodes.
- **Decision**: FIXED

### F3 — New name rules extend the PRD's Validation Error list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 §2 — ValidationErrorRule
- **Detail**: The name rules were new Validation Errors absent from the canonical list at `prd.md:181`, which S-03's import rejection (FR-014) builds on.
- **Fix**: Add a Phase 2 item appending the name rules to the PRD's Validation Errors list.
- **Decision**: FIXED — Phase 2 §6 added (covers all three name rules after F4).

### F4 — Unit of the 200-character limit is not decided

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1/§3 — "trimmed, 1..200 chars"
- **Detail**: "Chars" could mean UTF-16 code units (`.length`, as `maxLength` counts) or code points. Discussed in triage: the S-03 file's UTF-8 encoding is independent of the count and round-trips any well-formed string exactly; only a lone surrogate would be silently replaced with U+FFFD by `TextEncoder`.
- **Fix**: Count in UTF-16 code units and reject strings that are not well-formed Unicode.
- **Decision**: FIXED — `name.trim().length` ≤ 200 UTF-16 units plus `isWellFormed()`; new rule `task-name-malformed` ("A Task name cannot contain an incomplete character."); tests for an emoji at the limit and a lone surrogate.

### F5 — Refit mechanism and provider placement not specified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §3 Diagram / §6 Planner composition
- **Detail**: The refit had no stated mechanism, and "replace the Phase 1 shell" did not keep `ReactFlowProvider` above `Diagram` (`useReactFlow()` throws error001 without it). React Flow 12.12 queues `fitView` until nodes are measured.
- **Fix**: Effect keyed on the joined Task ids calling `fitView` from `useReactFlow()`; keep `ReactFlowProvider` in `Planner`.
- **Decision**: FIXED
