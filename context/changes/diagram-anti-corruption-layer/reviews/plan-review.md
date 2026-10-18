<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Diagram Anti-Corruption Layer

- **Plan**: context/changes/diagram-anti-corruption-layer/plan.md
- **Mode**: Deep
- **Date**: 2026-10-18
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

11/11 paths ✓, 6/6 symbols ✓ (`layoutDiagram`, `projectEdges`, `formatDuration`, `durationUnit`, `plannerLiteralValuesConfig`, `ReactFlowProvider`), brief↔plan ✓, Progress↔Phase ✓ (4 phases, 21/21 criteria). Also checked: `ReactFlowProvider` in `Planner.tsx` serves only `Diagram`; the kitchen sink renders `Planner`, not `Diagram`; no ESLint block sets `no-restricted-imports` yet; no live doc outside the glossary references `diagram-layout`.

## Findings

### F1 — "Same positions" is never checked by a test

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Key Discoveries (insertion order); Phase 2 §4; brief → Open Risks
- **Detail**: The plan promises byte-identical positions and the brief relied on the unchanged `diagram-layout.test.ts` to catch a drift. Its position tests (`:207-261`) are relational only (START left, FINISH right, a `RANK_SEPARATION` gap on one row, no overlap), so a reordered insertion would pass them. The only other check was comparing the kitchen sink by eye.
- **Fix A ⭐ Recommended**: Temporary parity test in Phase 2, written before §4 rewrites `diagram-layout.ts`, comparing the old and new pipelines (node ids and order, positions, edge order); deleted in §4.
  - Strength: Proves equivalence at the one moment both versions exist, without permanent coupling to dagre's exact output.
  - Tradeoff: Guards one moment, not later commits.
  - Confidence: HIGH — the old function is intact at that point.
  - Blind spot: None significant.
- **Fix B**: Permanent position snapshot in `layout-engine.test.ts`.
  - Strength: Guards every phase and later commit.
  - Tradeoff: Fails on any dagre bump that moves a pixel; first snapshot in the repo.
  - Confidence: MED — noise depends on dagre release behaviour.
  - Blind spot: Unverified whether dagre patch releases change layouts.
- **Decision**: FIXED (Fix A) — parity test added to Phase 2 §3, deleted in §4; criterion 2.2, Key Discoveries and the brief's Open Risks updated.

### F2 — Lint fence: per-directory blocks replace each other, and one probe is missing

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §1
- **Detail**: In flat config a later `no-restricted-imports` block replaces the earlier block's patterns rather than adding to them, so each narrower block must forbid the other library again. The proof never planted `@xyflow/react` in `src/lib/adapters/`.
- **Fix**: State the override semantics and add a third deliberate leak in `layout-engine.ts`.
- **Decision**: FIXED

### F3 — New non-test .ts file in the Tailwind scan, with no CSS check

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §4
- **Detail**: `flow-jsdom-shim.ts` doesn't match the `*.test.ts` exclusion, so `@source` scans it (lessons.md "Pin the build's input set"). A probe with Tailwind's scanner found no utility in today's shim text. But `transform` is a utility, and only the `?` in `transform?:` keeps it out. The plan asserted "holds no class names" without checking the built CSS.
- **Fix**: Phase 3 criterion: built `dist/_astro/*.css` byte-identical to Phase 2's.
- **Decision**: FIXED — criterion 3.4 added; Phase 3 Progress renumbered 3.4–3.9.

### F4 — Mutation criterion 2.5 can't fail as written

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2, criterion 2.5
- **Detail**: The plan already expects the near-zero score from the Stryker/Vitest 5 runner bug, so "reviewed" can be ticked without learning anything.
- **Fix**: Run with the local `nameParts.join(' > ')` patch documented in `PROJECT_RULES.md` → Mutation testing.
- **Decision**: SKIPPED
