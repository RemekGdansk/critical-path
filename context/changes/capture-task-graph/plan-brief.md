# Capture the Task Graph (S-01) — Plan Brief

> Full plan: `context/changes/capture-task-graph/plan.md`
> Research: `context/changes/capture-task-graph/research.md`

## What & Why

Roadmap slice S-01 (FR-001, FR-002, FR-003, FR-008): the user captures Tasks by name, links them to predecessors in a side panel, and sees an auto-arranged diagram from START to FINISH. It establishes the project model — constant Task ids, id-based references — that every later slice and the S-03 file format build on, so getting identity and rule-checking right here avoids rework.

## Starting Point

A placeholder page (`src/pages/index.astro`) with no island, no domain code beyond the F-01 smoke test, one shadcn button, and a CSP with hashed `style-src` and `connect-src 'none'`. Research confirmed `@xyflow/react` 12.12 and `@dagrejs/dagre` 3.1 are compatible on paper; neither is installed yet.

## Desired End State

The user types Task names into an always-focused toolbar input, clicks a node to edit it in a side panel (rename, add/remove predecessors, delete), and watches the diagram re-arrange left to right on every edit. Empty or over-long names are refused with a message naming the rule; Tasks that would close a cycle never appear in the picker, so a deployed build can never hold a Validation Error.

## Key Decisions Made

| Decision               | Choice                                                                  | Why (1 sentence)                                                                                  | Source   |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| FR-003 split with S-02 | S-01 blocks cycles (picker withholds candidates); S-02 explains them    | Every auto-deployed build honours the Guardrail while S-02 keeps the explanation work             | Plan     |
| START / FINISH         | Distinct model entities (`project.start`, `project.finish`), not Tasks  | They can never be predecessors or successors, and can gain attributes later                       | Plan     |
| Task id format         | Sequential integers 1, 2, … from a stored `nextTaskId`; never reused    | Simplest code and diff-friendly file; git history never shows a deleted Task "becoming" a new one | Plan     |
| Task name rules        | Trimmed, non-empty, max 200 chars, duplicates allowed                   | No invisible or runaway nodes; FR-001 allows non-unique names                                     | Plan     |
| Delete                 | Immediate, no confirmation, no bridging; orphans fall back to START     | Exactly FR-002 and fastest capture                                                                | Plan     |
| Task creation          | Toolbar input; Enter creates, input keeps focus, nothing gets selected  | Fastest bulk capture (Secondary success criterion)                                                | Plan     |
| Predecessor picker     | Removable list + native `<select>`, both labelled "7: Name" in id order | No new dependencies, keyboard-accessible, duplicate names distinguishable                         | Plan     |
| React Flow attribution | Keep the default link                                                   | Navigation only, CSP-permitted, respects the library's request                                    | Plan     |
| Island hydration       | `client:only="react"`                                                   | CSP blocks server-rendered inline styles React Flow emits                                         | Research |
| Diagram state          | Derived with `useMemo` from the project; layout never stored            | Satisfies React Compiler lint rules and the "no manual layout" non-goal                           | Research |
| Layout                 | dagre, left to right, fixed node sizes, fresh graph per call            | One synchronous pass per edit suits the 200 ms NFR                                                | Research |
| Cycle detection        | Pure domain code in `src/lib/services/`, not `graphlib.alg`             | Rules stay tested and independent of the renderer; S-03 import reuses them                        | Plan     |

## Scope

**In scope:** project model with all fields the S-03 file needs (optional Duration/Status/dates); pure edit functions returning the new project or a Validation Error; cycle-safe predecessor eligibility; dagre projection with synthetic START/FINISH links; the island with toolbar, diagram and side panel; CSP check in the built preview; 200 ms check on a 100-Task dev fixture.

**Out of scope:** cycle explanation (S-02); export/import and project name (S-03); START date, Durations, forecasts, warnings, critical path (S-04–S-07); selecting START/FINISH; drawing edges, dragging, MiniMap, dark mode; undo and delete confirmation; component tests.

## Architecture / Approach

`Project` (plain data, `src/types.ts`) → edit functions (`src/lib/services/project.ts`, `task-graph.ts`) → `useProject` hook (commits only on `ok: true`) → `layoutDiagram(project)` (`diagram-layout.ts`, dagre) memoized on the project → selection applied in a cheap second pass → React Flow in the `Planner` island. Everything left of the hook is pure and unit-tested in Node.

## Phases at a Glance

| Phase                              | What it delivers                                                          | Key risk                                                          |
| ---------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Toolchain probe                 | Libraries installed, layered CSS, static START → FINISH island, clean CSP | Rolldown vs zustand's CJS shim; `react/prop-types` false positive |
| 2. Domain model and edit functions | `Project` types and tested create/rename/delete/add/remove predecessor    | Model shape must hold up for S-03's file format                   |
| 3. Diagram projection and layout   | Tested `layoutDiagram` with START/FINISH links and top-left positions     | dagre typing under `strictTypeChecked`                            |
| 4. Planner UI                      | Toolbar, custom nodes, selection, side panel; manual MVP and 200 ms check | Refit timing after node changes; rename draft/commit behaviour    |

**Prerequisites:** F-01 done (Vitest gate in CI and Workers Builds); on branch `capture-task-graph`.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- The 200 ms NFR is measured in dev mode in Chrome on the development Mac; other browsers are assumed no slower by a margin that matters.
- A user sees cycle-closing Tasks missing from the picker without an explanation until S-02 lands.
- Keeping React Flow's attribution link may draw questions from reviewers of the zero-egress claim; it is navigation, not a connection.

## Success Criteria (Summary)

- MVP flow steps 1–2 (create A, B, C; link START → A → B → C → FINISH) work in the built preview with zero console errors or CSP violations.
- No edit can bring the project into a Validation Error: empty/over-long names are refused with an explanation, and cycles cannot be chosen.
- An edit at 100 Tasks re-arranges the diagram within 200 ms.
