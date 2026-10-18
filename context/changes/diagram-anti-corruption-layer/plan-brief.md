# Diagram Anti-Corruption Layer — Plan Brief

> Full plan: `context/changes/diagram-anti-corruption-layer/plan.md`
> Design input: `context/domain/03-anti-corruption-layer.md`

## What & Why

React Flow's `Node`/`Edge` types are the public signature of a domain module, and dagre is wired to them in the same function that owns the rule "a Task without predecessors hangs off START". The documents treat the layout engine as replaceable ("dagre/ELK", two named fallbacks), yet any swap today edits domain rules and their tests, and S-05/S-07 would extend React Flow types inside `src/lib/services/`. This change puts both libraries behind an anti-corruption layer, with no change in behaviour.

## Starting Point

`src/lib/services/diagram-layout.ts` imports dagre and React Flow types, hard-codes React Flow's `"arrowclosed"`, sets renderer props (`ariaRole`, `focusable`, `selectable`) and also holds Duration formatting, which `TaskPanel.tsx` imports. React Flow is known in the domain, the views and the planner shell (`ReactFlowProvider` in `Planner.tsx`); 9 files reference either library.

## Desired End State

`src/lib/services/diagram.ts` owns the Diagram's meaning and imports no third-party package; layout goes through a synchronous `LayoutEngine` port. dagre lives only in `src/lib/adapters/layout-engine.ts`, React Flow only in `src/components/planner/diagram/` (plus its stylesheet in `global.css`), and `npm run lint` fails on any new leak. The planner looks and behaves exactly as before.

## Key Decisions Made

| Decision                | Choice                                                                    | Why (1 sentence)                                                                                          | Source  |
| ----------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------- |
| ACL shape               | Domain `diagram.ts` + dagre adapter + React Flow adapter directory        | One ACL fixes both leaks, which meet in `layoutDiagram`.                                                  | ACL doc |
| Port contract           | Synchronous, top-left `Placement`, fixed sizes owned by the domain        | Layout runs in render under `useMemo` (200 ms NFR); top-left matches React Flow and two of three engines. | ACL doc |
| Duration helpers        | New `src/lib/services/duration.ts`                                        | `project.ts` becomes the guarded aggregate in the 02 plan; keeps the two refactors off one file.          | Plan    |
| jsdom shim              | `src/components/planner/diagram/flow-jsdom-shim.ts`, imported by the test | A renderer swap then touches one directory, test support included.                                        | Plan    |
| START date entry        | `projectDiagram` without `start`; date via `withStartDate` only           | Layout memo never depends on the date, and no caller passes a stripped `start`.                           | Plan    |
| Arrowhead               | `MarkerType.ArrowClosed` in `flow-elements.ts`                            | Probed: the value import loads fine in a Node Vitest run, so the copied literal goes.                     | Plan    |
| Empty project edge kind | `start->finish` is `feeds-finish`                                         | With no Task, START has no successor and feeds FINISH; pinned by a test.                                  | Plan    |
| Fence                   | `no-restricted-imports` per directory, type imports included              | Turns the grep criterion into a gate in CI and the deploy build.                                          | ACL doc |

## Scope

**In scope:** duration module; Diagram model, port, dagre adapter and their tests; React Flow adapter directory with moved views, provider and one `selectionTarget`; jsdom shim move; deletion of `diagram-layout.ts`; lint fence; `PROJECT_RULES.md` line; glossary rows.

**Out of scope:** S-05 `critical` / S-07 `status`; any engine swap or new dependency; async port or measured sizes; `global.css`, Project file, `useProject`, e2e changes; Stryker config; `project.ts`.

## Architecture / Approach

`Project → projectDiagram → Diagram → layoutDiagram(diagram, layoutEngine) → LaidOutDiagram → toFlowNodes/toFlowEdges → <ReactFlow>`. Dependencies point from adapters to the domain only. Strangler order: build the core while `diagram-layout.ts` becomes a temporary mapping over it, then move the views and delete it, then fence.

## Phases at a Glance

| Phase                                      | What it delivers                                                     | Key risk                                                             |
| ------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Duration helpers into `duration.ts`     | `TaskPanel` stops importing the dagre-loading module                 | None material                                                        |
| 2. Domain model, port, dagre adapter (TDD) | Library-free `diagram.ts`, `layout-engine.ts`, tests; temporary shim | Node/edge insertion order drifts and dagre positions change          |
| 3. React Flow adapter directory            | All React Flow code in `diagram/`; old module deleted                | Rebuilding every node object per selection change (200 ms NFR)       |
| 4. Fence and records                       | Lint gate proven red/green; rules and glossary updated               | Fence blocks too little (type imports) or too much (wrong directory) |

**Prerequisites:** none; independent of `02-invariant-aggregate-refactor.md` (no shared file after the duration decision).
**Estimated effort:** ~2–3 sessions across 4 phases; Phase 2 and 3 carry most of the work.

## Open Risks & Assumptions

- Assumes dagre output is deterministic for identical insertion order. The existing position tests are relational only, so a temporary Phase 2 parity test (old vs new pipeline, same ids, positions and edge order) catches a drift before the old module is rewritten.
- `src/lib/adapters/` sits outside Stryker's default glob; mutation there needs an explicit `--mutate`.
- Mutation scores are unreliable until the Vitest 5 runner fix lands (`PROJECT_RULES.md`).

## Success Criteria (Summary)

- `@dagrejs/dagre` appears only in `src/lib/adapters/layout-engine{,.test}.ts`; `@xyflow/react` only under `src/components/planner/diagram/` and in `global.css`; lint enforces it.
- The full gate and the unchanged e2e suite pass after every phase.
- The planner's Diagram is visually and behaviourally identical on `/kitchen-sink` and under preview with the CSP.
