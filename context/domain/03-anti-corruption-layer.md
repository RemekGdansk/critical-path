---
title: "Anti-Corruption Layer: the Diagram behind a layout port and a React Flow adapter"
created: 2026-10-18
type: refactor-plan
---

# Anti-Corruption Layer: the Diagram behind a layout port and a React Flow adapter

This is a refactoring plan, not an implementation, and it changes no production code. The change itself happens later through `/10x-plan` → `/10x-implement`. Terms follow `context/domain/glossary.md`. In particular, a dependency in the model is a predecessor id and an edge on the Diagram, and "link" and "relation" are avoided. Every `file:line` below was checked on branch `anti-corruption-layer` at `b03f5be`, with `@xyflow/react` 12.12.0 (`@xyflow/system` 0.0.83) and `@dagrejs/dagre` 3.1.1 installed. IDs `UL-NN`, `SD-NN` and `HM-NN` refer to `context/domain/01-domain-distillation.md`.

## Step 0: Context

**Documents read.** `context/foundation/prd.md`, `context/foundation/tech-stack.md`, `context/foundation/test-plan.md`, `README.md` (through `PROJECT_RULES.md`), `context/domain/01-domain-distillation.md`, `context/domain/02-invariant-aggregate-refactor.md`, `context/domain/glossary.md`, and the S-01 research that chose the diagram libraries: `context/archive/2026-09-27-capture-task-graph/research.md` and `research-diagram-libraries.md`.

**Statements about replaceability.** No document says "kept separate so that X can be swapped". Two documents do treat the layout engine as an open choice with named alternatives:

- `context/foundation/tech-stack.md:30`: "gives access to React Flow with dagre/ELK auto-layout for the auto-arranged dependency diagram, while the validation and forecast logic stays pure client-side TypeScript". The engine is "dagre/ELK", not one fixed library, and the domain logic is promised to stay pure.
- `context/archive/2026-09-27-capture-task-graph/research-diagram-libraries.md:35-36`: `elkjs` is a "Fallback only", and `d3-dag` is a "Fallback if dagre layouts are cluttered".
- `context/archive/2026-09-27-capture-task-graph/research.md:123`: the intended shape is a pipeline, "`project → (nodes, edges with START/FINISH synthetic links) → dagre layout → React Flow props`", so the projection, the layout and the renderer are meant to be three separate steps.
- `context/foundation/prd.md:211`: "No manual layout … no layout is stored in the exported file". Layout is derived and disposable, so changing the engine should never touch the Project file.

**Stack.** Astro 7 with static output and one React 19 island, TypeScript, Tailwind 4 and Vitest 5 (`PROJECT_RULES.md`). There is no server, no API and no database, so the Project file (`src/lib/services/project-file.ts`) is the only persistence and the only wire contract.

**External runtime dependencies** (`package.json` `dependencies`): `astro`, `@astrojs/react`, `@astrojs/sitemap`, `react`, `react-dom`, `@xyflow/react`, `@dagrejs/dagre`, `@radix-ui/react-label`, `@radix-ui/react-slot`, `@radix-ui/react-tooltip`, `class-variance-authority`, `clsx`, `tailwind-merge` and `lucide-react`. The code also relies on a few browser platform APIs that are not packages: `File.text()`, `Blob`/`URL.createObjectURL` and the clock.

**Layers**, mapped onto the generic template:

| Generic layer         | In this app                                                                             | Files                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Domain                | Model and pure edit, validation and forecast functions                                  | `src/types.ts`, `src/lib/services/{project,task-graph,forecast,validation-warnings,calendar-date}.ts` |
| Domain (presentation) | The Diagram projection, a Supporting subdomain (SD-08, `01-domain-distillation.md:100`) | `src/lib/services/diagram-layout.ts`                                                                  |
| Persistence / wire    | The Project file                                                                        | `src/lib/services/project-file.ts`                                                                    |
| Application / session | The `useProject` hook                                                                   | `src/hooks/useProject.ts`                                                                             |
| UI                    | The planner island and its views                                                        | `src/components/planner/*.tsx`                                                                        |
| Generic UI kit        | shadcn/ui wrappers                                                                      | `src/components/ui/*.tsx`, `src/lib/utils.ts`                                                         |
| Styles                | Tokens and React Flow theming                                                           | `src/styles/global.css`                                                                               |

`src/lib/services/` is meant to be pure domain logic ("extracted business logic in `src/lib/services/`", `PROJECT_RULES.md` Conventions), and it is the scope of mutation testing (`stryker.config.json:6`).

## Step 1: Leaking dependencies

The table lists every file that knows each dependency today. Matches in `package.json` and `package-lock.json` are left out. Searched with `grep -rnE "from ['\"][^@./]|from ['\"]@[^/]" src`, then `grep -rn "@xyflow\|dagre\|react-flow" src e2e scripts`.

| ID   | Dependency                                | Who knows it today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Signals                                                                                                                                                                                                                             |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LK-1 | `@xyflow/react` (React Flow)              | **Domain:** `src/lib/services/diagram-layout.ts:8` (`Edge as FlowEdge, Node`), `:29-37` (public types `TaskNodeType`, `StartNodeType`, `FinishNodeType`, `DiagramNode`, `DiagramEdge` are React Flow `Node`/`Edge`), `:67` (`markerEnd: { type: "arrowclosed" }`, a hand-copied `MarkerType.ArrowClosed` value from `@xyflow/system` `edges.d.ts:97`), `:76-86`, `:97-98`, `:103-111` (`ariaRole`, `ariaLabel`, `focusable`, `selectable`), `:156` ("React Flow positions a node by its top-left corner"). **Domain tests:** `src/lib/services/diagram-layout.test.ts:87`, `:135-145`, `:64-73`, `:232` (React Flow's `width`/`height`/`position`/`markerEnd`/`focusable`). **UI:** `src/components/planner/Diagram.tsx:1`, `:11-16`, `:39-53`, `:58`, `:64-71`, `:85` (the DOM class `react-flow__node` and `dataset.id`), `:97-117`; `TaskNode.tsx:1`, `:17`, `:31`, `:43`; `StartNode.tsx:1`, `:9`, `:12`; `FinishNode.tsx:1`, `:8`, `:11`. **Application shell:** `src/components/planner/Planner.tsx:1`, `:179-180`, `:237` (`ReactFlowProvider`). **Styles:** `src/styles/global.css:8` (stylesheet import), `:145-161` (`--xy-*` theming). **View tests:** `src/components/planner/Planner.test.ts:18-61` (React Flow's jsdom shim). | Imported in three code layers (domain, UI, shell) plus styles. Library types are the public signature of a domain module. A library enum is copied as a string literal into the domain. Library props are asserted by domain tests. |
| LK-2 | `@dagrejs/dagre`                          | **Domain:** `src/lib/services/diagram-layout.ts:7` (import), `:44` (`GraphLabel` config), `:145-157` (graph built from React Flow nodes, `layout`, centre → top-left), `:155` (error text names dagre). **Domain tests:** `src/lib/services/diagram-layout.test.ts:227-243` ("positions nodes by their top-left corner, not by dagre's centre").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | One file, but it is the domain module that also owns the auto-link rule (UL-12, `:116-138`), the Validation Warning projection (`:73`) and Duration formatting (`:50-59`). Documents name alternatives (Step 0).                    |
| LK-3 | `lucide-react`                            | `src/components/planner/ForecastSummary.tsx:1`, `TaskNode.tsx:2`, `TaskPanel.tsx:1`; `src/components/ui/native-select.tsx:2`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | UI only. An icon is a leaf element, so it does not cross a layer.                                                                                                                                                                   |
| LK-4 | `@radix-ui/*`, `class-variance-authority` | `src/components/ui/button.tsx:2-3`, `label.tsx:2`, `tooltip.tsx:2`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Already wrapped: the shadcn components in `src/components/ui/` act as an anti-corruption layer.                                                                                                                                     |
| LK-5 | `clsx`, `tailwind-merge`                  | `src/lib/utils.ts:1-2`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Already wrapped behind `cn()` (`PROJECT_RULES.md` → UI).                                                                                                                                                                            |
| LK-6 | Browser platform (file, download, clock)  | `src/components/planner/ProjectControls.tsx:118` (`file.text()`), `src/lib/download.ts:8` (`Blob`, `URL.createObjectURL`), `src/components/planner/Planner.tsx:121` (`new Date()`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Already confined. Each lives in one UI or helper file, and the domain receives text and "today" as values (`src/lib/services/calendar-date.ts:116`).                                                                                |

`react` is the framework rather than a leak: no file in `src/lib/services/` imports it, so the domain stays React-free. No package is used across a client/server boundary, because the app has no server.

## Step 2: Classification and choice of #1

The three axes are (a) the layers and files a dependency touches, (b) the risk and cost of replacing it today, and (c) whether the documents intend it to be replaceable.

| ID   | (a) Spread                                                        | (b) Risk / cost of replacing today                                                                                                                                                                                                                                                                                                                                                    | (c) Documents                                                                                                                                                   |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LK-1 | **High**: 3 code layers plus styles; 7 source files, 2 test files | **High.** The domain module's public types, the shape its tests assert, every custom node, the Diagram's event decoding and the planner shell would all change. Upcoming work makes this worse: S-05's critical-path highlight (`roadmap.md:144-152`) and parked FR-018 (draw a dependency, `prd.md:143`) would both be written against React Flow shapes inside `src/lib/services/`. | No explicit claim. The pipeline intent (`research.md:123`) separates "dagre layout" from "React Flow props", and the code merges them.                          |
| LK-2 | Low: 1 domain file, 1 test file                                   | **Medium.** Replacing it means editing the module that owns UL-12 (auto-links), the Validation Warning projection and Duration formatting. The engine is fed React Flow nodes (`:148`), so even a dagre-to-d3-dag change touches React Flow knowledge.                                                                                                                                | **Strong.** `tech-stack.md:30` says "dagre/ELK"; `research-diagram-libraries.md:35-36` names two fallbacks. The gap between intent and code is a strong signal. |
| LK-3 | Low, UI only                                                      | Low                                                                                                                                                                                                                                                                                                                                                                                   | None                                                                                                                                                            |
| LK-4 | Low, wrapped                                                      | Low                                                                                                                                                                                                                                                                                                                                                                                   | None (shadcn convention)                                                                                                                                        |
| LK-5 | Low, wrapped                                                      | Low                                                                                                                                                                                                                                                                                                                                                                                   | None                                                                                                                                                            |
| LK-6 | Low, confined                                                     | Low                                                                                                                                                                                                                                                                                                                                                                                   | `PROJECT_RULES.md` ("today is always passed in")                                                                                                                |

**Choice: #1 is LK-1, React Flow's model inside the domain layer, and the same ACL also handles LK-2.**

- React Flow is the only dependency that crosses three code layers, and the only one whose types are the public signature of a domain module (`diagram-layout.ts:29-37`). Every consumer of the Diagram projection therefore receives a raw library object.
- LK-2 is the dependency the documents most clearly mean to be swappable, but it cannot be swapped cleanly today, and the cause is LK-1. dagre is fed React Flow nodes (`diagram-layout.ts:148`, `node.width ?? 0`), and its output is converted into React Flow's coordinate convention in the same expression (`:156-157`). The two leaks meet in one function, `layoutDiagram` (`:140-161`), so one ACL with two adapters fixes both. Fixing LK-2 alone would leave React Flow types in the port.
- The cost of waiting rises with each slice. S-05 must add "is on a critical path" to nodes and edges, and S-07 adds Status to Task nodes. With today's structure, both would extend React Flow `Node<…>` data inside `src/lib/services/`.

## Step 3: Diagnosis

### 3.1 A domain module whose output is a library object

`src/lib/services/diagram-layout.ts:1-6`, the module header, describes it as "the one place that knows how a project becomes a diagram". It then says "React Flow is imported as types only: this module and its tests never load React." The module avoids loading React Flow at runtime, but its domain output is still a React Flow object:

```ts
// src/lib/services/diagram-layout.ts:29-37
export type TaskNodeType = Node<
  { name: string; taskId: TaskId; duration?: number; durationMissing: boolean; dayCountingMode: DayCountingMode },
  "task"
>;
export type StartNodeType = Node<{ date?: string }, "start">;
export type FinishNodeType = Node<Record<string, never>, "finish">;
export type DiagramNode = TaskNodeType | StartNodeType | FinishNodeType;
export type DiagramEdge = FlowEdge;
```

The type-only import is a convention, and nothing enforces it. React Flow's idiomatic way to write the arrowhead is `MarkerType.ArrowClosed`, an enum and therefore a runtime import, which would load React into the Node test run. To avoid that, the domain hard-codes the enum's string value:

```ts
// src/lib/services/diagram-layout.ts:66-68
function edge(source: string, target: string): DiagramEdge {
  return { id: `${source}->${target}`, source, target, markerEnd: { type: "arrowclosed" } };
}
```

`MarkerType.ArrowClosed = "arrowclosed"` lives in `node_modules/@xyflow/system/dist/esm/types/edges.d.ts:97`. If React Flow ever renames it, the domain module, not the renderer, carries the stale copy.

### 3.2 Interaction and accessibility decisions for the renderer, made in the domain

React Flow node props such as `ariaRole`, `focusable` and `selectable` are set in the domain:

```ts
// src/lib/services/diagram-layout.ts:103-112
    // FINISH has nothing to edit, so it is neither selectable nor a tab stop.
    {
      id: FINISH_NODE_ID,
      type: "finish",
      data: {},
      position: origin,
      ...terminal,
      focusable: false,
      selectable: false,
    },
```

The UI then points back into the domain module to explain its own React Flow prop:

```tsx
// src/components/planner/Diagram.tsx:106-108
// START and Task nodes are tab stops so they can be selected by keyboard
// (handleKeyDown); FINISH opts out per node in diagram-layout.
nodesFocusable;
```

The domain fact, "FINISH has nothing to edit", is real and belongs in the domain. Its translation into React Flow props does not. The domain tests then pin those props: `diagram-layout.test.ts:135-145` asserts `focusable`, `selectable` and `ariaRole`, and `:87` asserts `markerEnd: { type: "arrowclosed" }`.

### 3.3 Two libraries joined in one expression

```ts
// src/lib/services/diagram-layout.ts:145-157
  const graph = new Graph<GraphLabel, NodeLabel, EdgeLabel>();
  graph.setGraph(LAYOUT);
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) graph.setNode(node.id, { width: node.width ?? 0, height: node.height ?? 0 });
  for (const { source, target } of edges) graph.setEdge(source, target);
  layout(graph);
  ...
      // dagre returns the node's centre; React Flow positions a node by its top-left corner.
      return { ...node, position: { x: x - (node.width ?? 0) / 2, y: y - (node.height ?? 0) / 2 } };
```

dagre's input is React Flow nodes (with `?? 0` for React Flow's optional size), and its output is converted into React Flow's coordinate convention. Changing either library means rewriting this function, and the function sits in the same module as the auto-link rule (`:116-138`, UL-12), which every engine would need unchanged. The test that guards the conversion is named after the library: "positions nodes by their top-left corner, not by dagre's centre" (`diagram-layout.test.ts:227`).

### 3.4 The intent in the documents compared with the code

| Document says                                                                                                                                | Code does                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tech-stack.md:30`: "React Flow with dagre/ELK auto-layout"; `research-diagram-libraries.md:35-36`: `elkjs` and `d3-dag` are named fallbacks | There is no seam for an engine. Swapping in either fallback means editing `diagram-layout.ts`, the domain module that also holds UL-12, the Validation Warning projection (`:73`) and Duration formatting (`:50-59`), and changing the domain test at `diagram-layout.test.ts:227-243`. |
| `research.md:123`: three steps, `project → (nodes, edges …) → dagre layout → React Flow props`                                               | All three steps are fused in `layoutDiagram` (`:140-161`). The first step's output is already React Flow props (`:71-113`).                                                                                                                                                             |
| `tech-stack.md:30`: "the validation and forecast logic stays pure client-side TypeScript"                                                    | That holds for validation and forecast. The Diagram projection is the one module in `src/lib/services/` that depends on two UI libraries.                                                                                                                                               |

### 3.5 Domain helpers that sit behind the leak

`durationUnit` and `formatDuration` (`diagram-layout.ts:50-59`) apply the day-counting mode to a Duration. They have nothing to do with diagrams, but because they live in the layout module, the Task side panel imports a module that loads dagre: `src/components/planner/TaskPanel.tsx:9` `import { durationUnit } from "@/lib/services/diagram-layout";`. `TaskNode.tsx:5` and `:40` format the Duration again from React Flow node data.

The Task's accessible name is also split between two layers. Task names are built in the domain (`taskAriaLabel`, `diagram-layout.ts:61-64`), but the START name is built in the UI (`Diagram.tsx:46`, `` ariaLabel: `START, ${startDate ?? "today"}` ``). The e2e suite depends on both (`e2e/project-file.spec.ts:43`, `:56`).

### 3.6 Library context in the shell, library DOM in the view

`Planner.tsx:179-180` wraps the whole planner, including the header and the side panel, in `ReactFlowProvider`, with the comment "useReactFlow() in Diagram throws without a provider above it". The shell knows the library only to serve one child. `Diagram.tsx:81-93` decodes keyboard selection from React Flow's internal DOM (`target.classList.contains("react-flow__node")`, `target.dataset.id`). That is legitimate adapter code, but the Selection mapping it produces is written twice, at `:64-71` and `:87-91`.

### 3.7 Leak severity

This is not the "server library in the client bundle" case: the app has no server, and the domain's React Flow import is erased at build time. The danger here is a different one:

- the domain's contract is the library's contract;
- the domain's tests are partly tests of library props;
- the documented engine swap cannot be made without editing domain rules;
- Stryker mutates React Flow prop mapping as if it were business logic (`stryker.config.json:6` covers `src/lib/services/**`).

## Step 4: ACL design

### 4.1 Shape

```
src/types.ts (Project)
        │
        ▼
src/lib/services/diagram.ts           ← domain: Diagram model, projection, layout PORT, layoutDiagram
        │   uses LayoutEngine (port)            no third-party import
        ▼
src/lib/adapters/layout-engine.ts     ← adapter: the ONLY file that imports @dagrejs/dagre
        │
        ▼ LaidOutDiagram (domain value)
src/components/planner/diagram/       ← adapter: the ONLY directory that imports @xyflow/react
  flow-elements.ts   Diagram → React Flow nodes/edges; React Flow node → Selection target
  Diagram.tsx        <ReactFlowProvider><ReactFlow …/></ReactFlowProvider>, composition root for the engine
  TaskNode.tsx, StartNode.tsx, FinishNode.tsx   custom nodes reading the domain node from data
```

The dependency direction is adapters → domain, never the reverse. `src/lib/services/diagram.ts` imports only `@/types`, `@/lib/services/validation-warnings` and `@/lib/services/project` (for `formatDuration`, see 4.5).

### 4.2 The domain value: `Diagram` and `LaidOutDiagram` (`src/lib/services/diagram.ts`)

This module is the only place that knows how a Project becomes a Diagram: which nodes exist, which edges exist and why, what each node shows and says, and that FINISH cannot be edited. It knows nothing about how a library draws or arranges them.

```ts
// Signatures and pseudocode only.
export const START_NODE_ID = "start";
export const FINISH_NODE_ID = "finish";
export type DiagramNodeId = string; // String(taskId) for a Task; never parsed

export interface Size {
  width: number;
  height: number;
}
export const TASK_NODE_SIZE: Size = { width: 180, height: 52 }; // was TASK_NODE_WIDTH/HEIGHT
export const START_FINISH_NODE_SIZE: Size = { width: 96, height: 40 };
export const RANK_SEPARATION = 60;
export const NODE_SEPARATION = 40;

interface NodeBase {
  id: DiagramNodeId;
  size: Size;
  accessibleName: string;
  editable: boolean;
}
export interface StartDiagramNode extends NodeBase {
  kind: "start";
  date?: string;
} // editable: true
export interface TaskDiagramNode extends NodeBase {
  kind: "task";
  taskId: TaskId;
  name: string;
  durationText?: string; // "5 days" / "1 weekday", ready to show
  durationMissing: boolean; // the Task's duration-missing Validation Warning
} // editable: true
export interface FinishDiagramNode extends NodeBase {
  kind: "finish";
} // editable: false
export type DiagramNode = StartDiagramNode | TaskDiagramNode | FinishDiagramNode;

/** "dependency" is a stored predecessor; the other two are the derived "hangs off START" / "feeds FINISH" edges. */
export type DiagramEdgeKind = "dependency" | "hangs-off-start" | "feeds-finish";
export interface DiagramEdge {
  id: `${string}->${string}`;
  source: DiagramNodeId;
  target: DiagramNodeId;
  kind: DiagramEdgeKind;
}

export interface Diagram {
  nodes: readonly DiagramNode[];
  edges: readonly DiagramEdge[];
}

/** Top-left corner of the node's box, in diagram units. */
export interface Placement {
  x: number;
  y: number;
}
export interface LaidOutDiagram {
  nodes: readonly (DiagramNode & { position: Placement })[];
  edges: readonly DiagramEdge[];
}

/** Pure projection, O(tasks + predecessors). Was projectNodes + projectEdges. */
export function projectDiagram(project: Pick<Project, "tasks" | "dayCountingMode" | "start">): Diagram;
//   warned = set of validationWarnings(project).taskId
//   nodes  = [start(project.start.date), ...tasks.map(task(warned)), finish]
//   edges  = same rule as today's projectEdges (diagram-layout.ts:116-138), each tagged with its kind

export function startAccessibleName(date: string | undefined): string; // "START, 2030-01-07" / "START, today"
export function taskAccessibleName(task: Task, durationMissing: boolean, mode: DayCountingMode): string; // moved from taskAriaLabel

/** Positions every node through the engine and refuses a result that misses one. */
export function layoutDiagram(diagram: Diagram, engine: LayoutEngine): LaidOutDiagram;
//   placements = engine({ nodes: diagram.nodes.map(n => ({ id: n.id, ...n.size })),
//                         edges: diagram.edges.map(e => ({ source: e.source, target: e.target })),
//                         direction: "left-to-right", rankSeparation: RANK_SEPARATION, nodeSeparation: NODE_SEPARATION })
//   for each node: p = placements.get(node.id); if (!p) throw new Error(`The layout engine did not position node "${id}".`)
//   return { nodes: nodes.map(n => ({ ...n, position: p })), edges: diagram.edges }
```

**Layout stays independent of the START date.** Today Diagram adds the START date in a second pass "so a date edit never re-runs layout" (`diagram-layout.ts:33`). The same split survives here. `Diagram.tsx` memoizes `layoutDiagram(projectDiagram({ tasks, dayCountingMode, start: {} }), layoutEngine)` on `[tasks, dayCountingMode]`, then applies `startAccessibleName(startDate)` and the date to the START node in its cheap pass. A domain helper, `withStartDate(laidOut, date): LaidOutDiagram`, keeps that pass free of library knowledge.

**Room for later slices.** S-05 adds `critical: boolean` to `TaskDiagramNode` and `DiagramEdge`, computed from the forecast in this module. S-07 adds `status`. Neither needs a React Flow type.

### 4.3 The narrow port: `LayoutEngine` (defined in `src/lib/services/diagram.ts`)

```ts
export interface LayoutRequest {
  nodes: readonly { id: DiagramNodeId; width: number; height: number }[];
  edges: readonly { source: DiagramNodeId; target: DiagramNodeId }[];
  direction: "left-to-right";
  /** Gap between the right edge of one rank and the left edge of the next. */
  rankSeparation: number;
  /** Gap between neighbouring nodes in one rank. */
  nodeSeparation: number;
}
/**
 * Synchronous by contract: the Diagram derives positions during render (useMemo),
 * and the 200 ms NFR was measured on that path. Positions are TOP-LEFT corners.
 * An engine that answers asynchronously or by centre adapts in its adapter, or the
 * port changes in a reviewed commit (see 5.3).
 */
export type LayoutEngine = (request: LayoutRequest) => ReadonlyMap<DiagramNodeId, Placement>;
```

The port has one function, no library types and no node content. The engine sees only ids, sizes and edges, so it cannot depend on Task names, warnings or kinds.

### 4.4 Adapters

**`src/lib/adapters/layout-engine.ts`** is the only file that imports `@dagrejs/dagre`:

```ts
import { Graph, layout, type EdgeLabel, type GraphLabel, type NodeLabel } from "@dagrejs/dagre";
import type { LayoutEngine } from "@/lib/services/diagram";

export const layoutEngine: LayoutEngine = (request) => {
  // A fresh graph per call: a reused one would keep nodes and edges deleted since the last layout.
  const graph = new Graph<GraphLabel, NodeLabel, EdgeLabel>();
  graph.setGraph({ rankdir: "LR", ranksep: request.rankSeparation, nodesep: request.nodeSeparation });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const n of request.nodes) graph.setNode(n.id, { width: n.width, height: n.height });
  for (const e of request.edges) graph.setEdge(e.source, e.target);
  layout(graph);
  // dagre answers with the node's centre; the port speaks top-left.
  return new Map(
    request.nodes.flatMap((n) => {
      const { x, y } = graph.node(n.id);
      return x === undefined || y === undefined ? [] : [[n.id, { x: x - n.width / 2, y: y - n.height / 2 }]];
    }),
  );
};
```

The file is named after its role, not the library, so swapping the engine means rewriting this one file. The export name `layoutEngine` does not change, and no import elsewhere moves.

**`src/components/planner/diagram/flow-elements.ts`** is pure and uses `import type` from `@xyflow/react` only, so its tests run in Node:

```ts
export type FlowNode = Node<{ node: DiagramNode }, DiagramNode["kind"]>; // custom nodes read data.node
export type FlowEdge = Edge;

export function toFlowNodes(diagram: LaidOutDiagram, selection: Selection): FlowNode[];
//   { id, type: node.kind, data: { node }, position, width: size.width, height: size.height,
//     ariaLabel: node.accessibleName,
//     ...(node.editable ? { ariaRole: "button" } : { focusable: false, selectable: false }),
//     selected: isSelected(node, selection) }
export function toFlowEdges(diagram: LaidOutDiagram): FlowEdge[];
//   { id, source, target, markerEnd: { type: MarkerType.ArrowClosed } }  // S-05: a class for critical edges
export function selectionTarget(node: FlowNode | undefined): TaskId | "start" | undefined;
//   the one decoding of a React Flow node into a Selection target, used by click and by keyboard
```

`flow-elements.ts` may import `MarkerType` as a value (it is an adapter file and allowed runtime React Flow). If that would pull React into its Node test run, it keeps the literal, with a pointer to `edges.d.ts`.

**`src/components/planner/diagram/Diagram.tsx`** is the React Flow component. It owns `ReactFlowProvider` (an inner `DiagramCanvas` calls `useReactFlow` for `fitView`). It is the composition root that pairs `layoutDiagram` with `layoutEngine`, and it keeps the DOM decoding of `react-flow__node` (`Diagram.tsx:85` today) through `selectionTarget`. `TaskNode`, `StartNode` and `FinishNode` move next to it and read `data.node`. `TaskNode` shows `data.node.durationText` and no longer formats anything. `TerminalNode.tsx` has no React Flow import and stays in `src/components/planner/`.

### 4.5 Domain helpers out of the leaky module

`durationUnit` and `formatDuration` move to `src/lib/services/project.ts`, next to the display helper `taskLabel` (`project.ts:57`) that `TaskPanel.tsx:10` already imports. If `02-invariant-aggregate-refactor.md` has reshaped `project.ts` by then, they go wherever `taskLabel` ends up. After the move, `TaskPanel.tsx` no longer imports a diagram module.

## Step 5: Isolation and before/after

### 5.1 What a library swap touches after the refactor

| Swap                           | Touches                                                                                                                                                                            | Does not touch                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dagre → `d3-dag` (synchronous) | `src/lib/adapters/layout-engine.ts`, its test and `package.json`                                                                                                                   | `src/lib/services/diagram.ts` and its tests, the auto-link rule, the Project file (`project-file.ts`, golden files), `useProject`, every view, the e2e suite                                |
| dagre → `elkjs`                | The same adapter, plus a reviewed change to `LayoutEngine` (5.3), which every engine adapter and `Diagram.tsx` follow                                                              | The Diagram model, the projection, the Project file, the panels and the hook                                                                                                                |
| React Flow → another renderer  | `src/components/planner/diagram/**`, the React Flow block in `src/styles/global.css` (`:8`, `:145-161`, kept there by `PROJECT_RULES.md` → UI) and the jsdom shim in the view test | `src/lib/**`, `src/types.ts`, `Planner.tsx`, `TaskPanel.tsx`, `StartPanel.tsx`, `ForecastSummary.tsx`, `useProject`, the Project file and the e2e suite, which drives accessible names only |

There are no tables or API endpoints in this app. The persistence contract is the Project file, and it has never held layout (`prd.md:211`), so no library swap reaches it before or after.

### 5.2 Before/after per spot

| #   | Spot                    | Before                                                                                                                                       | After                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Diagram public types    | `diagram-layout.ts:29-37`: React Flow `Node<…>` / `Edge`                                                                                     | `diagram.ts`: `DiagramNode` (`kind` union), `DiagramEdge` (`kind`), `LaidOutDiagram`; React Flow types only as `FlowNode`/`FlowEdge` in `flow-elements.ts`                                                                                                                                                      |
| 2   | Arrowhead               | `diagram-layout.ts:67`: literal `"arrowclosed"` in the domain                                                                                | `flow-elements.ts`: `MarkerType.ArrowClosed` (or the literal) in the adapter; the domain has no arrowheads                                                                                                                                                                                                      |
| 3   | FINISH not editable     | `diagram-layout.ts:103-111`: `focusable: false, selectable: false`; `Diagram.tsx:107` points back into the domain                            | Domain: `editable: false`. Adapter: `editable` → `ariaRole: "button"` or `focusable/selectable: false`                                                                                                                                                                                                          |
| 4   | Engine input and output | `diagram-layout.ts:145-157`: dagre fed React Flow nodes (`?? 0`), centre → React Flow top-left                                               | Port: ids + sizes in, top-left `Placement` out; centre → top-left inside `layout-engine.ts`; `layoutDiagram` checks every node is positioned, with no library name in the error                                                                                                                                 |
| 5   | Accessible names        | Task: `diagram-layout.ts:61-64` (domain); START: `Diagram.tsx:46` (UI)                                                                       | Both in `diagram.ts` (`taskAccessibleName`, `startAccessibleName`); the adapter copies `accessibleName` into `ariaLabel`                                                                                                                                                                                        |
| 6   | Duration display        | `diagram-layout.ts:50-59`, imported by `TaskPanel.tsx:9` and `TaskNode.tsx:5`; formatted again in `TaskNode.tsx:40`                          | `formatDuration`/`durationUnit` in `project.ts`; `TaskDiagramNode.durationText` is ready to show; `TaskNode` renders it                                                                                                                                                                                         |
| 7   | Selection decoding      | `Diagram.tsx:64-71` and `:87-91`, each reading `node.type` / `node.data.taskId`                                                              | `selectionTarget(flowNode)` in `flow-elements.ts`, used by both handlers                                                                                                                                                                                                                                        |
| 8   | Provider                | `Planner.tsx:1`, `:179-180`, `:237`                                                                                                          | Inside `diagram/Diagram.tsx`; `Planner.tsx` has no React Flow import                                                                                                                                                                                                                                            |
| 9   | Custom node data        | `TaskNode.tsx:17` reads `NodeProps<TaskNodeType>` built in the domain                                                                        | `NodeProps<FlowNode>`; reads `data.node`, a domain `TaskDiagramNode`, so the view gets ready domain data and never a library object built in the domain                                                                                                                                                         |
| 10  | Tests                   | `diagram-layout.test.ts` mixes domain rules (`:79-133`, `:147-205`), React Flow props (`:87`, `:135-145`) and dagre conventions (`:227-243`) | `diagram.test.ts`: projection and edge kinds, accessible names, `editable`, and `layoutDiagram` with a fake engine (including a missing placement). `layout-engine.test.ts`: the port contract (top-left, `RANK_SEPARATION` gap, no overlap on the 100-Task fixture). `flow-elements.test.ts`: React Flow props |

### 5.3 Open questions on the library contracts, settled from the docs

| Question                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decision and where it is encoded                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which coordinate convention does the port speak? | React Flow's dagre example (reactflow.dev, "Layout React Flow nodes with Dagre", via Context7 `/websites/reactflow_dev`): "We are shifting the dagre node position (anchor=center center) to the top left so it matches the React Flow node anchor point (top left)." The elkjs example uses ELK's `x`/`y` unchanged as `position`. React Flow's `origin` is `[0, 0]` (top left) by default (`@xyflow/system` `types/nodes.d.ts:63-70`, `:139-146`). | **Top-left.** Two of the three candidate engines and the renderer already use it. The centre → top-left shift is a dagre detail, encoded in `src/lib/adapters/layout-engine.ts`, not in the domain or in `Diagram.tsx`. Setting React Flow's `nodeOrigin` to `[0.5, 0.5]` was rejected: it would put dagre's convention into the renderer adapter. |
| Synchronous or asynchronous port?                | dagre: `layout(g): Graph` returns synchronously (`@dagrejs/dagre` `dist/types/lib/layout.d.ts:3`). elkjs: `elk.layout(graph)` returns a Promise (both React Flow elkjs examples `await` it or call `.then`). The project already rated elkjs "Fallback only" for its size, licence and blocked worker (`research-diagram-libraries.md:35`).                                                                                                          | **Synchronous**, stated in the `LayoutEngine` doc comment. The Diagram derives layout during render with `useMemo`, and the 200 ms NFR was measured on that path. Adopting ELK is therefore a reviewed port change, not a silent adapter swap. `d3-dag` fits the port as it stands.                                                                |
| Do node sizes come from the renderer?            | React Flow's examples size dagre input from `node.measured` after a first render. `research-diagram-libraries.md:45` chose fixed sizes for the 200 ms NFR.                                                                                                                                                                                                                                                                                           | **Fixed sizes owned by the domain** (`TASK_NODE_SIZE`, `START_FINISH_NODE_SIZE` in `diagram.ts`). The React Flow adapter passes them as `width`/`height`, so layout never waits for a measurement.                                                                                                                                                 |
| How does S-05 highlight critical edges?          | React Flow edges accept `className` (`@xyflow/react` `dist/esm/types/edges.d.ts:29`); edge colour is themed through `--xy-*` (`global.css:145-157`).                                                                                                                                                                                                                                                                                                 | The domain sets `critical` on `DiagramEdge`/`TaskDiagramNode`, and `flow-elements.ts` maps it to a class. Its colour is a token in `global.css`, as `PROJECT_RULES.md` → UI requires.                                                                                                                                                              |
| How would parked FR-018 (draw a dependency) map? | React Flow reports a drawn edge as `OnConnect = (connection: Connection) => void` (`@xyflow/system` `types/general.d.ts:120`), with string node ids.                                                                                                                                                                                                                                                                                                 | `Diagram.tsx` decodes `source`/`target` through `selectionTarget` into Task ids and calls `addPredecessor`, so a cycle is rejected by the same domain rule. Nothing new enters `src/lib/services/`.                                                                                                                                                |

## Step 6: Verification and plan

### 6.1 Success criterion

The criterion is two greps, run from the repository root and excluding `package.json`/`package-lock.json`:

- `grep -rln "@dagrejs/dagre" src` should return only `src/lib/adapters/layout-engine.ts` and `src/lib/adapters/layout-engine.test.ts`.
- `grep -rln "@xyflow/react" src` should return only `src/components/planner/diagram/**` and `src/styles/global.css` (the stylesheet import, which `PROJECT_RULES.md` → UI keeps in `global.css`).

A lint rule makes the criterion executable. It is a `no-restricted-imports` block in `eslint.config.js`, in the style of `plannerLiteralValuesConfig` (`eslint.config.js:80-94`), that forbids `@xyflow/*` and `@dagrejs/*` in `src/**` and is switched off for `src/components/planner/diagram/**` and `src/lib/adapters/**`. That turns the next leak into a failure of `npm run lint` in both gates.

| File                                              | Knows React Flow today        | Knows dagre today | After                                                                                                            |
| ------------------------------------------------- | ----------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/lib/services/diagram-layout.ts`              | yes (`:8`, types, props)      | yes (`:7`)        | deleted; replaced by `src/lib/services/diagram.ts`, which knows neither                                          |
| `src/lib/services/diagram-layout.test.ts`         | yes (props asserted)          | yes (`:227-243`)  | split into `diagram.test.ts` (neither), `layout-engine.test.ts`, `flow-elements.test.ts`                         |
| `src/components/planner/Planner.tsx`              | yes (`:1`)                    | no                | neither                                                                                                          |
| `src/components/planner/TaskPanel.tsx`            | no (imports the module, `:9`) | transitively      | neither; imports `durationUnit` from `project.ts`                                                                |
| `src/components/planner/Diagram.tsx`              | yes                           | no                | moved to `diagram/Diagram.tsx`, inside the adapter                                                               |
| `src/components/planner/TaskNode.tsx`             | yes                           | no                | moved to `diagram/`, inside the adapter                                                                          |
| `src/components/planner/StartNode.tsx`            | yes                           | no                | moved to `diagram/`, inside the adapter                                                                          |
| `src/components/planner/FinishNode.tsx`           | yes                           | no                | moved to `diagram/`, inside the adapter                                                                          |
| `src/components/planner/Planner.test.ts`          | the jsdom shim (`:18-61`)     | no                | the shim moves to a helper next to the adapter, `diagram/flow-jsdom-shim.ts`, imported by the test (see Phase 3) |
| `src/styles/global.css`                           | yes (`:8`, `:145-161`)        | no                | unchanged; this is the allowed exception                                                                         |
| `src/lib/adapters/layout-engine.ts`               | —                             | —                 | new: knows dagre only                                                                                            |
| `src/components/planner/diagram/flow-elements.ts` | —                             | —                 | new: knows React Flow only                                                                                       |

### 6.2 Phased plan

Suggested change id: `diagram-anti-corruption-layer`. Start it with `/10x-new diagram-anti-corruption-layer`, then `/10x-plan` with this document as input, then `/10x-implement`, or `/10x-tdd` for Phase 2. Every phase ends green on `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`, plus `npm run test:e2e`, which is unchanged throughout and is the behavioural contract: it drives the Diagram only by accessible names. The CSP is unaffected, because no network, worker or inline style is added. The phases are independent of `02-invariant-aggregate-refactor.md`; the only shared file is `project.ts` (Phase 1).

**Phase 1: Duration helpers out of the layout module.** Move `durationUnit` and `formatDuration` to `src/lib/services/project.ts` and move their test (`diagram-layout.test.ts:190-197`) with them. Point `TaskPanel.tsx:9` and `TaskNode.tsx:5` at `project.ts`. There is no behaviour change. Done when no file outside `diagram-layout.ts` imports the two helpers from it.

**Phase 2: Domain model, layout port and dagre adapter (test-first).**

- Add `src/lib/services/diagram.ts` with `projectDiagram`, `layoutDiagram(diagram, engine)`, the accessible-name functions, `withStartDate` and the `LayoutEngine` port.
- Add `src/lib/adapters/layout-engine.ts`.
- Write `diagram.test.ts` from the domain assertions of today's `diagram-layout.test.ts` (`:79-133`, `:147-205`), restated on `kind`, `editable`, `accessibleName` and `durationText`. It uses a fake engine that places nodes on a grid, and a fake that omits one node to prove the "did not position" refusal.
- Write `layout-engine.test.ts` from `:207-261` (fixed sizes, START left and FINISH right of every Task, top-left positions with the `RANK_SEPARATION` gap, no overlap on `createPerfProject()`), driven through `layoutDiagram` with the real `layoutEngine`. A future engine reruns the same file.
- Temporarily reduce `diagram-layout.ts` to a thin React Flow mapping over `layoutDiagram(projectDiagram(project), layoutEngine)`, keeping its current exports so the views stay untouched and green.
- Run `npm run test:mutation -- --mutate "src/lib/services/diagram.ts"` selectively, mindful of the Vitest 5 runner false result described in `PROJECT_RULES.md` → Mutation testing.

Done when `diagram.ts` imports no third-party package.

**Phase 3: React Flow adapter directory.**

- Create `src/components/planner/diagram/` with `flow-elements.ts` (`toFlowNodes`, `toFlowEdges`, `selectionTarget`) and `flow-elements.test.ts`, which holds the React Flow prop assertions from `diagram-layout.test.ts:87` and `:135-145`.
- Move `Diagram.tsx`, `TaskNode.tsx`, `StartNode.tsx` and `FinishNode.tsx` into the directory; the custom nodes read `data.node`.
- Move `ReactFlowProvider` from `Planner.tsx` into `Diagram.tsx`. Route both selection handlers through `selectionTarget`.
- Move the jsdom shim out of `Planner.test.ts:18-61` into `diagram/flow-jsdom-shim.ts`, imported by the test. It is never imported by production code, so it never ships, and it holds no class names.
- Delete `src/lib/services/diagram-layout.ts` and `diagram-layout.test.ts`.

The literal-value lint rule (`eslint.config.js:81`, `src/components/planner/**`) and the Tailwind `@source` glob already cover the new directory. Check the Diagram in every state on `/kitchen-sink` under `npm run dev`, and once in `npm run build && npm run preview` for the CSP. Done when `Planner.tsx`, `TaskPanel.tsx` and everything under `src/lib/services/` are free of both packages.

**Phase 4: Fence and records.**

- Add the `no-restricted-imports` block (6.1) and prove it by adding a deliberate `import type { Node } from "@xyflow/react"` to `src/lib/services/diagram.ts`, which must turn `npm run lint` red, then reverting it.
- Add one line to `PROJECT_RULES.md` → Conventions: "Third-party diagram libraries stay in their adapters: `@dagrejs/dagre` in `src/lib/adapters/`, `@xyflow/react` in `src/components/planner/diagram/` (and its stylesheet in `global.css`); the domain speaks `Diagram`/`LaidOutDiagram` and the `LayoutEngine` port."
- Update `context/domain/glossary.md`. In the Diagram row, the names in the code become `projectDiagram`, `layoutDiagram`, `Diagram`, `LaidOutDiagram`. In the "Hangs off START / feeds FINISH" row, the name in the code becomes the edge kinds `hangs-off-start` and `feeds-finish` in `projectDiagram`.

Done when the two greps in 6.1 return only adapter files.

## Summary

The leak that matters most in this codebase is the diagram stack. React Flow's `Node` and `Edge` types are the public signature of a domain module (`src/lib/services/diagram-layout.ts:29-37`), and dagre is wired to them in the same function that owns the rule "a Task without predecessors hangs off START" (`:116-161`). React Flow is known in three code layers (domain, UI and the planner shell) and in styles. Domain tests pin its props, and the domain even carries a hand-copied React Flow enum value (`:67`). The documents treat the layout engine as replaceable: "dagre/ELK" in `tech-stack.md:30` and two named fallbacks in the S-01 research. Today, though, any swap edits domain rules and their tests. The proposed ACL makes `src/lib/services/diagram.ts` the only owner of the Diagram's meaning: nodes and edge kinds, accessible names, ready-to-show Duration text, and whether FINISH can be edited. It reaches layout through one narrow, synchronous `LayoutEngine` port that speaks top-left positions, as settled from the React Flow, dagre and elkjs documentation. dagre is confined to `src/lib/adapters/layout-engine.ts` and React Flow to `src/components/planner/diagram/`, so a d3-dag swap touches one file, a renderer swap touches one directory, and the Project file, the hook, the panels and the e2e suite are untouched by either. Four green-at-every-step phases deliver it, and a lint rule turns the success criterion (both package names greppable only in adapter files) into a gate.
