# Diagram Anti-Corruption Layer Implementation Plan

## Overview

Put the Diagram's two third-party libraries behind an anti-corruption layer. `src/lib/services/diagram.ts` becomes the only owner of the Diagram's meaning (nodes, edge kinds, accessible names, ready-to-show Duration text, whether a node can be edited) and reaches layout through one narrow, synchronous `LayoutEngine` port. `@dagrejs/dagre` is confined to `src/lib/adapters/layout-engine.ts`, `@xyflow/react` to `src/components/planner/diagram/` (plus its stylesheet in `src/styles/global.css`), and a lint fence makes the confinement a gate. Behaviour does not change: the e2e suite, which drives the Diagram by accessible names only, is the contract throughout.

The design is `context/domain/03-anti-corruption-layer.md` (the ACL plan). This plan follows it, with the two deviations recorded under Key Discoveries.

## Current State Analysis

Verified on branch `diagram-anti-corruption-layer` at `99ac778`; every `file:line` from the ACL plan still holds.

- `src/lib/services/diagram-layout.ts` is a domain module (`src/lib/services/` is pure domain logic and the Stryker scope, `stryker.config.json:6`) that imports both libraries: dagre at `:7`, React Flow types at `:8`. Its public types are React Flow `Node<…>`/`Edge` (`:29-37`), it hard-codes React Flow's `MarkerType.ArrowClosed` value as `"arrowclosed"` (`:67`), and it sets renderer props `ariaRole`, `focusable`, `selectable` (`:78-112`).
- `layoutDiagram` (`:140-161`) fuses projection, dagre layout and the centre → top-left conversion; it feeds dagre React Flow nodes (`node.width ?? 0`, `:148`) and its error names dagre (`:155`). The same module owns the "hangs off START / feeds FINISH" rule (`projectEdges`, `:116-138`), the Validation Warning projection (`:73`) and Duration formatting (`:50-59`).
- `src/lib/services/diagram-layout.test.ts` mixes domain rules (`:79-133`, `:147-205`), React Flow props (`:87`, `:135-145`), dagre conventions (`:227-243`) and the `createPerfProject` fixture checks (`:263-285`).
- `src/components/planner/Diagram.tsx` builds START's accessible name in the UI (`:46`), decodes a React Flow node into a Selection target twice (`:64-71`, `:86-91`), reads React Flow's DOM (`:85`), and relies on `ReactFlowProvider` in `Planner.tsx` (`:1`, `:179-180`, `:237`).
- `TaskNode.tsx:5,40` formats the Duration again from node data; `TaskPanel.tsx:9,184` imports `durationUnit` from the dagre-loading module.
- `Planner.test.ts:19-89` holds React Flow's jsdom shim (DOM patches, restored in `afterAll`); it does not import `@xyflow/react`.
- Only 9 files reference either library (`grep -rln "diagram-layout\|@xyflow\|dagre\|react-flow" src e2e scripts`): the two `diagram-layout` files, `Diagram.tsx`, `TaskNode.tsx`, `StartNode.tsx`, `FinishNode.tsx`, `Planner.tsx`, `TaskPanel.tsx`, `global.css`. `src/dev/` and `e2e/` reference neither.

## Desired End State

- `grep -rln "@dagrejs/dagre" src` returns only `src/lib/adapters/layout-engine.ts` and `src/lib/adapters/layout-engine.test.ts`.
- `grep -rln "@xyflow/react" src` returns only files under `src/components/planner/diagram/` and `src/styles/global.css`.
- `npm run lint` fails if any other file under `src/` imports `@xyflow/*` or `@dagrejs/*` (type imports included).
- `src/lib/services/` imports no third-party package for the Diagram; `Planner.tsx` and `TaskPanel.tsx` know neither library.
- The planner looks and behaves exactly as before: same layout positions, same accessible names, same keyboard and click selection, same FINISH inertness. `npm run test:e2e` passes unchanged at every phase.

### Key Discoveries:

- Deviation 1 (decided in planning): `durationUnit`/`formatDuration` move to a new `src/lib/services/duration.ts`, not to `project.ts` as ACL plan 4.5 says, because `context/domain/02-invariant-aggregate-refactor.md:147` turns `project.ts` into the guarded Project aggregate; display helpers there would make the two refactors collide on one file.
- Deviation 2 (refinement): `projectDiagram` takes `Pick<Project, "tasks" | "dayCountingMode">`, without `start`. The START date and START's accessible name enter through one domain helper, so the memoized layout never depends on the date and no caller has to pass `start: {}` (ACL plan 4.2 does this with a stripped `start`).
- `MarkerType` is a value export of `@xyflow/react` that loads fine in a Node-environment Vitest run (probed in planning), so `flow-elements.ts` uses `MarkerType.ArrowClosed` and the hand-copied literal disappears.
- dagre's result depends on node and edge insertion order. `projectDiagram` must keep today's order (START, Tasks in creation order, FINISH; edges in the order `projectEdges` emits them) and the adapter must insert in request order, so positions stay byte-identical. The existing position tests are relational only (START left, FINISH right, no overlap) and would pass a reordering, so a temporary parity test in Phase 2 compares the old and new pipelines while both exist.
- The existing lint config pattern to follow is `plannerLiteralValuesConfig` (`eslint.config.js:80-94`), composed in the default export list (`:115-126`).
- `change_id` `diagram-anti-corruption-layer` is not a roadmap item; no roadmap sync.

## What We're NOT Doing

- No S-05 `critical` flag or S-07 `status` on Diagram nodes or edges; the model only leaves room for them.
- No engine swap (d3-dag, elkjs) and no new dependency; `package.json` is unchanged.
- No asynchronous port, no measured node sizes, no `nodeOrigin` change (ACL plan 5.3).
- No change to `src/styles/global.css` (the React Flow stylesheet import and `--xy-*` theming stay; they are the allowed exception).
- No change to the Project file, `useProject`, the panels' behaviour, or the e2e suite.
- No Stryker config change: `src/lib/adapters/` stays outside the default `mutate` glob; it can be targeted with `--mutate` when needed.
- No overlap with `02-invariant-aggregate-refactor.md`: `project.ts` is not touched.

## Implementation Approach

Strangler order, green at every phase. Phase 1 removes the one non-diagram reason to import the leaky module. Phase 2 builds the library-free domain and the dagre adapter test-first, then reduces `diagram-layout.ts` to a temporary React Flow mapping over them, so the views keep working untouched. Phase 3 moves every React Flow consumer into one adapter directory and deletes the old module. Phase 4 fences the result with lint and records the new names in the rules and the glossary. Every phase ends green on `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` plus `npm run test:e2e` (stop `npm run dev` first).

## Critical Implementation Details

**Performance constraints.** The 200 ms NFR path is render-time layout under `useMemo`. Keep the current two-pass shape in the new `Diagram.tsx`: layout and the full React Flow mapping memoize on `[tasks, dayCountingMode]` only; selection and the START date are applied in a second, cheap pass that returns the same node object for every node it does not change (today only START and the selected Task get new objects, `Diagram.tsx:39-53`). Rebuilding all 100 node objects on every selection change would make React Flow re-adopt every node.

## Phase 1: Duration helpers into `duration.ts`

### Overview

Move the two Duration display helpers out of the diagram module, so the Task side panel stops importing a module that loads dagre. No behaviour change.

### Changes Required:

#### 1. New Duration module

**File**: `src/lib/services/duration.ts` (new), `src/lib/services/duration.test.ts` (new)

**Intent**: Home for the Duration's display wording, named after the glossary term; `durationUnit` and `formatDuration` move here unchanged with their doc comments, and the "formats Durations in days or weekdays, by the mode" test moves from `diagram-layout.test.ts:190-197`.

**Contract**: `export function durationUnit(mode: DayCountingMode): string` and `export function formatDuration(days: number, mode: DayCountingMode): string`, imports only `@/types`.

#### 2. Repoint the callers

**File**: `src/lib/services/diagram-layout.ts`, `src/lib/services/diagram-layout.test.ts`, `src/components/planner/TaskPanel.tsx`, `src/components/planner/TaskNode.tsx`

**Intent**: `diagram-layout.ts` imports `formatDuration` from `duration.ts` (for `taskAriaLabel`) and no longer exports either helper; `TaskPanel.tsx:9` and `TaskNode.tsx:5` import from `duration.ts`; the moved test is removed from `diagram-layout.test.ts`.

**Contract**: No file imports `durationUnit` or `formatDuration` from `@/lib/services/diagram-layout`.

### Success Criteria:

#### Automated Verification:

- `grep -rn "import.*\(durationUnit\|formatDuration\)" src` shows every import coming from `@/lib/services/duration`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E passes unchanged: `npm run test:e2e`

#### Manual Verification:

- On `/kitchen-sink` (`npm run dev`), Task nodes and the Task panel's "Duration (days)" / "Duration (weekdays)" label read as before in both day-counting modes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Domain model, layout port and dagre adapter (test-first)

### Overview

Build the library-free Diagram model and the `LayoutEngine` port in `src/lib/services/diagram.ts`, and the dagre adapter in `src/lib/adapters/layout-engine.ts`, test-first (suited to `/10x-tdd`). Then reduce `diagram-layout.ts` to a temporary React Flow mapping over them, keeping its exports so no view changes.

### Changes Required:

#### 1. Domain model and port

**File**: `src/lib/services/diagram.ts` (new)

**Intent**: The one place that knows how a Project becomes a Diagram — which nodes and edges exist and why, what each node shows and is called, and that FINISH cannot be edited — with no knowledge of how a library draws or arranges them. Its header comment states that it imports no third-party package.

**Contract**:

- Constants: `START_NODE_ID = "start"`, `FINISH_NODE_ID = "finish"`, `TASK_NODE_SIZE: Size = { width: 180, height: 52 }`, `START_FINISH_NODE_SIZE: Size = { width: 96, height: 40 }`, `RANK_SEPARATION = 60`, `NODE_SEPARATION = 40`.
- Types as in ACL plan 4.2: `DiagramNodeId`, `Size`, `StartDiagramNode` (`kind: "start"`, `date?`), `TaskDiagramNode` (`kind: "task"`, `taskId`, `name`, `durationText?`, `durationMissing`), `FinishDiagramNode` (`kind: "finish"`), each with `id`, `size`, `accessibleName`, `editable`; `DiagramNode`; `DiagramEdgeKind = "dependency" | "hangs-off-start" | "feeds-finish"`; `DiagramEdge { id: \`${source}->${target}\`, source, target, kind }`; `Diagram`; `Placement`(top-left);`LaidOutDiagram`.
- `projectDiagram(project: Pick<Project, "tasks" | "dayCountingMode">): Diagram` — today's `projectNodes` + `projectEdges` rule and order, each edge tagged with its kind; START has no date and the accessible name `"START, today"`; `durationText` is `formatDuration(...)` from `duration.ts`, absent when the Task has no Duration.
- `startAccessibleName(date: string | undefined): string` (`"START, 2030-01-07"` / `"START, today"`), `taskAccessibleName(task, durationMissing, mode): string` (moved from `taskAriaLabel`, same strings).
- `withStartDate(node: StartDiagramNode, date: string | undefined): StartDiagramNode` — the only way the START date and its accessible name enter the Diagram.
- Port, as in ACL plan 4.3: `LayoutRequest { nodes: { id, width, height }[]; edges: { source, target }[]; direction: "left-to-right"; rankSeparation; nodeSeparation }`, `type LayoutEngine = (request: LayoutRequest) => ReadonlyMap<DiagramNodeId, Placement>`, with the doc comment "synchronous by contract, positions are top-left corners".
- `layoutDiagram(diagram: Diagram, engine: LayoutEngine): LaidOutDiagram` — sends ids, sizes and edges in diagram order; throws `The layout engine did not position node "<id>".` for a node missing from the result.

#### 2. dagre adapter

**File**: `src/lib/adapters/layout-engine.ts` (new)

**Intent**: The only file that imports `@dagrejs/dagre`; a fresh graph per call, nodes and edges inserted in request order, dagre's centre converted to the port's top-left. Named after its role, so an engine swap rewrites this file only.

**Contract**: `export const layoutEngine: LayoutEngine`; `rankdir: "LR"`, `ranksep`/`nodesep` from the request; omits a node dagre did not position (so `layoutDiagram`'s refusal fires). The ACL plan 4.4 sketch is the reference.

#### 3. Tests

**File**: `src/lib/services/diagram.test.ts` (new), `src/lib/adapters/layout-engine.test.ts` (new)

**Intent**: `diagram.test.ts` restates the domain assertions of `diagram-layout.test.ts:79-133`, `:147-188`, `:199-204` on `kind`, `editable`, `accessibleName`, `durationText` and edge kinds, plus `startAccessibleName`/`withStartDate`, and drives `layoutDiagram` with a fake grid engine and with a fake that omits one node (the refusal). `layout-engine.test.ts` carries `:207-261` (fixed sizes, START left / FINISH right of every Task, top-left with the `RANK_SEPARATION` gap, no overlap on `createPerfProject()`) through `layoutDiagram(projectDiagram(…), layoutEngine)`, so a future engine reruns the same file.

Before §4 rewrites `diagram-layout.ts`, add a temporary parity test (in `layout-engine.test.ts`) asserting that the old `layoutDiagram(project)` from `diagram-layout.ts` and `layoutDiagram(projectDiagram(project), layoutEngine)` give the same node ids in the same order, the same top-left positions and the same edge ids in the same order, for `createPerfProject()`, the empty project, a single Task, and a join/branch project. It must pass against the untouched old module; §4 deletes it.

**Contract**: `diagram.test.ts` imports no third-party package except `vitest`. The `createPerfProject` describe block (`diagram-layout.test.ts:263-285`) moves to `diagram.test.ts` in Phase 3 together with the old file's deletion.

#### 4. Temporary React Flow mapping

**File**: `src/lib/services/diagram-layout.ts`

**Intent**: Keep the views untouched and green while the new core lands: the module keeps its exports and signature but computes them as `layoutDiagram(projectDiagram(project), layoutEngine)` mapped to today's React Flow nodes and edges, so `diagram-layout.test.ts` still passes unchanged. Start only once the parity test from §3 passes against the old module, and delete the parity test in this step (after the rewrite it would compare the new pipeline with itself).

**Contract**: Exports, node and edge shapes, positions and `"START"` aria label identical to today. Lives only until Phase 3.

### Success Criteria:

#### Automated Verification:

- `grep -nE "from ['\"][^@./]|from ['\"]@[^/]" src/lib/services/diagram.ts src/lib/services/diagram.test.ts` lists only `vitest`
- The parity test passes against the old module before §4, then `diagram.test.ts`, `layout-engine.test.ts` and the unchanged `diagram-layout.test.ts` pass: `npm test`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E passes unchanged: `npm run test:e2e`
- Selective mutation run reviewed: `npm run test:mutation -- --mutate "src/lib/services/diagram.ts"` (a near-zero score is the known Vitest 5 runner false result, `PROJECT_RULES.md` → Mutation testing)

#### Manual Verification:

- On `/kitchen-sink`, every state lays out exactly as before (same positions, arrowheads, warned Task borders)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: React Flow adapter directory

### Overview

Move every React Flow consumer into `src/components/planner/diagram/`, give the custom nodes domain data instead of library objects built in the domain, make `selectionTarget` the one decoding of a React Flow node, and delete `diagram-layout.ts`.

### Changes Required:

#### 1. Pure mapping

**File**: `src/components/planner/diagram/flow-elements.ts` (new), `src/components/planner/diagram/flow-elements.test.ts` (new)

**Intent**: The one translation between the domain Diagram and React Flow, and back. `editable` becomes `ariaRole: "button"` (diagram-wide focus and selection) or `focusable: false, selectable: false`; `accessibleName` becomes `ariaLabel`; sizes become `width`/`height`; edges get `markerEnd: { type: MarkerType.ArrowClosed }`. The test holds the React Flow prop assertions from `diagram-layout.test.ts:87`, `:135-145`.

**Contract**: `FlowNode` — a React Flow `Node` whose `data` is `{ node }` (the domain node of that kind) and whose `type` is the node's `kind`, with per-kind aliases for `NodeProps`; `FlowEdge = Edge`; `toFlowNode(node)` / `toFlowNodes(diagram: LaidOutDiagram)`, `toFlowEdges(diagram: LaidOutDiagram)`, `selectionTarget(node: FlowNode | undefined): TaskId | "start" | undefined`. Selection is applied by `Diagram.tsx`'s second pass, not here (see Critical Implementation Details).

#### 2. Views move into the adapter

**File**: `src/components/planner/Diagram.tsx` → `src/components/planner/diagram/Diagram.tsx`; `TaskNode.tsx`, `StartNode.tsx`, `FinishNode.tsx` → `src/components/planner/diagram/`

**Intent**: `Diagram.tsx` is the composition root that pairs `layoutDiagram` with `layoutEngine`, owns `ReactFlowProvider` (an inner component calls `useReactFlow` for `fitView`), applies `withStartDate` and the selection in its cheap pass, and routes both the click and the Enter/Space handler through `selectionTarget` (the `react-flow__node` DOM decoding stays here). Custom nodes read `data.node`; `TaskNode` renders `durationText` and formats nothing. Update the `nodesFocusable` comment (`Diagram.tsx:106-107`) so it no longer points into the domain. `TerminalNode.tsx` has no React Flow import and stays in `src/components/planner/`.

**Contract**: `Diagram` props unchanged (`project`, `fitKey`, `selection`, `onSelect`, `onEdit`); rendered DOM, accessible names and keyboard behaviour unchanged.

#### 3. Shell

**File**: `src/components/planner/Planner.tsx`

**Intent**: Drop the `@xyflow/react` import and the `ReactFlowProvider` wrapper (`:1`, `:179-180`, `:237`) and import `Diagram` from `diagram/`.

**Contract**: `Planner.tsx` imports neither library.

#### 4. jsdom shim next to the adapter

**File**: `src/components/planner/diagram/flow-jsdom-shim.ts` (new), `src/components/planner/Planner.test.ts`

**Intent**: Move React Flow's jsdom shim (`Planner.test.ts:19-89`, install in `beforeAll`, restore in `afterAll`) into a helper next to the adapter, so a renderer swap touches one directory. `Planner.test.ts` imports and installs it in the same hooks. It is imported by no production code, so it never ships, and it holds no class names.

**Contract**: One exported install/restore pair (or a function that registers both hooks); `Planner.test.ts` keeps its tests and behaviour.

#### 5. Remove the old module

**File**: `src/lib/services/diagram-layout.ts`, `src/lib/services/diagram-layout.test.ts` (deleted); `src/lib/services/diagram.test.ts`

**Intent**: Delete both; move the `createPerfProject` describe block (`diagram-layout.test.ts:263-285`) to `diagram.test.ts`, restated on `projectDiagram`.

**Contract**: No file imports `@/lib/services/diagram-layout`.

### Success Criteria:

#### Automated Verification:

- `grep -rln "@xyflow/react" src` lists only `src/components/planner/diagram/**` and `src/styles/global.css`
- `grep -rln "@dagrejs/dagre" src` lists only `src/lib/adapters/layout-engine.ts` and `src/lib/adapters/layout-engine.test.ts`
- `grep -rn "diagram-layout" src` returns nothing
- The built CSS is byte-identical to Phase 2's: `shasum dist/_astro/*.css` after `npm run build` matches the value recorded at the end of Phase 2 (the new `flow-jsdom-shim.ts` is a non-test `.ts` inside the Tailwind `@source` scan, and the moved views must change no class)
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E passes unchanged: `npm run test:e2e`

#### Manual Verification:

- On `/kitchen-sink`, the Diagram in every state: layout, arrowheads, warned Task borders, START date line, selected rings, hover and focus rings, FINISH inert to click and Tab
- Keyboard: Tab to START and to a Task, Enter/Space opens its panel with focus in it; FINISH is skipped
- Once under `npm run build && npm run preview`: the planner loads and the browser console shows no CSP violation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Fence and records

### Overview

Turn the confinement into a lint gate and record the new names where agents read them.

### Changes Required:

#### 1. Lint fence

**File**: `eslint.config.js`

**Intent**: A `no-restricted-imports` block in the style of `plannerLiteralValuesConfig` that forbids `@xyflow/*` and `@dagrejs/*` in `src/**`, with narrower blocks after it: `src/lib/adapters/**` may import `@dagrejs/*` only, `src/components/planner/diagram/**` may import `@xyflow/*` only. In flat config a later block's `no-restricted-imports` replaces the earlier block's patterns rather than adding to them, so each narrower block forbids the other library again (adapters: `@xyflow/*`; `diagram/`: `@dagrejs/*`). The message names the rule in `PROJECT_RULES.md`.

**Contract**: Type-only imports are caught too (the rule's default). Prove it by adding `import type { Node } from "@xyflow/react";` to `src/lib/services/diagram.ts`, `import "@dagrejs/dagre";` to `src/components/planner/diagram/flow-elements.ts` and `import "@xyflow/react";` to `src/lib/adapters/layout-engine.ts`: `npm run lint` must fail on all three; then revert.

#### 2. Rules and glossary

**File**: `PROJECT_RULES.md`, `context/domain/glossary.md`

**Intent**: Add the Conventions line: "Third-party diagram libraries stay in their adapters: `@dagrejs/dagre` in `src/lib/adapters/`, `@xyflow/react` in `src/components/planner/diagram/` (and its stylesheet in `global.css`); the domain speaks `Diagram`/`LaidOutDiagram` and the `LayoutEngine` port." In the glossary: the Diagram row's code names become `projectDiagram`, `layoutDiagram`, `Diagram`, `LaidOutDiagram`; the "Hangs off START / feeds FINISH" row becomes the edge kinds `hangs-off-start` and `feeds-finish` in `projectDiagram`; the Dependency row's "edges in the diagram" becomes the edge kind `dependency`; the Duration row adds `formatDuration` (`duration.ts`).

**Contract**: Wording only; no other rule changes.

### Success Criteria:

#### Automated Verification:

- `npm run lint` fails with the deliberate leaks in place and passes after reverting them
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E passes unchanged: `npm run test:e2e`

#### Manual Verification:

- `PROJECT_RULES.md` and `context/domain/glossary.md` read correctly after `prettier --write` reflows the glossary table

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `duration.test.ts`: singular/plural in both modes (moved).
- `diagram.test.ts`: node order and kinds, edge ids and kinds (the empty project's single `start->finish` edge is `feeds-finish`: with no Task, START itself has no successor and feeds FINISH; asserted so the kind is pinned, not incidental), join/branch once each, no edge to a deleted Task, `editable` false only on FINISH, accessible names (Duration, weekdays, warned, Done without Duration), `durationText`, no project mutation, `withStartDate`, `layoutDiagram` with a fake engine and the missing-placement refusal, `createPerfProject` checks.
- `layout-engine.test.ts`: the port contract against the real dagre engine (fixed sizes, START left / FINISH right, top-left with the `RANK_SEPARATION` gap, no overlap on 100 Tasks).
- `flow-elements.test.ts`: React Flow props per kind, arrowhead marker, `selectionTarget` for each kind and `undefined`.

### Integration Tests:

- `Planner.test.ts` (jsdom) unchanged in assertions, now with the shim from `diagram/flow-jsdom-shim.ts`.
- `npm run test:e2e` unchanged; it drives the Diagram by accessible names only (`e2e/project-file.spec.ts:43`, `:56`).

### Manual Testing Steps:

1. `npm run dev`, open `/kitchen-sink`, check every state's Diagram against the previous build.
2. Tab through START and Tasks, press Enter and Space, confirm the panel opens with focus; confirm FINISH is skipped and inert.
3. `npm run build && npm run preview`, load the planner, confirm no CSP violation in the console.

## Performance Considerations

Layout cost is unchanged (same dagre call, same insertion order). The only risk is object churn in React Flow; see Critical Implementation Details.

## Migration Notes

None: layout is never stored (`prd.md:211`), so the Project file and golden files are unaffected.

## References

- ACL design: `context/domain/03-anti-corruption-layer.md`
- Domain map: `context/domain/01-domain-distillation.md`, `context/domain/glossary.md`
- Overlapping plan on `project.ts`: `context/domain/02-invariant-aggregate-refactor.md`
- Original pipeline intent: `context/archive/2026-09-27-capture-task-graph/research.md:123`
- Lint pattern to follow: `eslint.config.js:80-94`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Duration helpers into duration.ts

#### Automated

- [x] 1.1 No file imports durationUnit or formatDuration from diagram-layout — e7d1722
- [x] 1.2 Full gate passes — e7d1722
- [x] 1.3 E2E passes unchanged — e7d1722

#### Manual

- [x] 1.4 Kitchen sink Task nodes and Duration label read as before in both modes — e7d1722

### Phase 2: Domain model, layout port and dagre adapter (test-first)

#### Automated

- [x] 2.1 diagram.ts and diagram.test.ts import no third-party package but vitest — c7b057f
- [x] 2.2 Parity test passes before the rewrite, then new tests and unchanged diagram-layout.test.ts pass — c7b057f
- [x] 2.3 Full gate passes — c7b057f
- [x] 2.4 E2E passes unchanged — c7b057f
- [x] 2.5 Selective mutation run on diagram.ts reviewed — c7b057f

#### Manual

- [x] 2.6 Kitchen sink layout identical to before — c7b057f

### Phase 3: React Flow adapter directory

#### Automated

- [x] 3.1 @xyflow/react only under diagram/ and in global.css
- [x] 3.2 @dagrejs/dagre only in layout-engine.ts and its test
- [x] 3.3 No reference to diagram-layout remains
- [x] 3.4 Built CSS byte-identical to Phase 2
- [x] 3.5 Full gate passes
- [x] 3.6 E2E passes unchanged

#### Manual

- [x] 3.7 Kitchen sink Diagram correct in every state
- [x] 3.8 Keyboard selection works and FINISH is skipped
- [x] 3.9 Preview build loads with no CSP violation

### Phase 4: Fence and records

#### Automated

- [ ] 4.1 Lint fails on deliberate leaks and passes after revert
- [ ] 4.2 Full gate passes
- [ ] 4.3 E2E passes unchanged

#### Manual

- [ ] 4.4 PROJECT_RULES.md and glossary read correctly after prettier
