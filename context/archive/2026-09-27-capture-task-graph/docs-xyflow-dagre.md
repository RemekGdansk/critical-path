---
change_id: capture-task-graph
topic: Library docs for @xyflow/react and @dagrejs/dagre, scoped to S-01
kind: external
date: 2026-09-27
sources: Context7 (/websites/reactflow_dev, /dagrejs/dagre)
---

# Library docs: `@xyflow/react` and `@dagrejs/dagre`

Companion to `research-diagram-libraries.md` (which chose these libraries). This note captures the API surface S-01 needs, fetched from current docs via Context7. Examples below are from the docs; comments marked **S-01** are how they apply here.

## Context7 library IDs

| Library          | Context7 ID               | Notes                                                                                                                            |
| ---------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `@xyflow/react`  | `/websites/reactflow_dev` | reactflow.dev (v12 docs, ~2.6k snippets, High reputation). Preferred over `/xyflow/xyflow`, whose only pinned version is 11.5.5. |
| `@dagrejs/dagre` | `/dagrejs/dagre`          | GitHub repo + wiki, including `dist/dagre.d.ts` and `lib/*.ts` from the v3 TypeScript rewrite.                                   |

## `@dagrejs/dagre`

### Install and import

```bash
npm install @dagrejs/dagre
```

```ts
import dagre from "@dagrejs/dagre"; // default export, as used in the React Flow dagre example
```

Types ship with the package (`dist/dagre.d.ts`); `@types/dagre` is not needed. The wiki's `require("dagre")` snippet refers to the old unscoped package — ignore it.

### Build a graph and run layout

```ts
const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 50 }); // rankdir: "TB" | "BT" | "LR" | "RL"
g.setNode("a", { width: 172, height: 36 }); // width/height default to 0 — always set them
g.setEdge("a", "b");
dagre.layout(g); // synchronous, mutates g in place
```

- `setDefaultEdgeLabel(() => ({}))` is required so edges added without a label get an object to write layout data into.
- `nodesep` (between nodes in a rank) and `ranksep` (between ranks) default to 50.
- `ranker` graph option: `"network-simplex"` (default), `"tight-tree"`, `"longest-path"`, `"none"`, or a custom function.
- Create a **fresh** `Graph` per layout call. The React Flow example reuses a module-level graph, which leaks nodes/edges deleted since the previous call — wrong for S-01, where Tasks and predecessors are removed.

### Read the result

```ts
const { x, y } = g.node("a"); // CENTER of the node
const { points } = g.edge("a", "b"); // [{ x, y }, …] control points incl. node intersections
const { width, height } = g.graph(); // bounding box of the whole layout
```

**S-01:** React Flow positions nodes by their **top-left** corner, so convert: `position = { x: x - width / 2, y: y - height / 2 }`.

### Cycles

dagre lays out graphs containing cycles without failing (it reverses edges internally). The diagram will not crash on a cyclic graph, so it cannot be relied on to detect one — cycle rejection belongs in the domain layer (S-02).

### Bundled graphlib algorithms

`dagre.graphlib.alg` exposes `topsort`, `isAcyclic`, `findCycles`, `tarjan` (typed as `tarjam` in `dagre.d.ts`), `components`, `preorder`, `postorder`, `dijkstra`, `floydWarshall`, `prim`. **S-01/S-02 note:** tempting for cycle detection, but domain rules live in `src/lib/services/` as pure, tested TypeScript; depending on a layout library's internals there couples validation to the renderer. Decide explicitly in `/10x-plan`.

## `@xyflow/react`

### Styles

```ts
import "@xyflow/react/dist/style.css"; // or dist/base.css for structural styles only
```

With Tailwind 4, import it from `src/styles/global.css` after `@import "tailwindcss"` (see `research-diagram-libraries.md`). React Flow will not work without these styles.

### Official dagre integration (from reactflow.dev)

```ts
import dagre from "@dagrejs/dagre";

const getLayoutedElements = (nodes, edges, options) => {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: options.direction });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) =>
    g.setNode(node.id, {
      ...node,
      width: node.measured?.width ?? 0,
      height: node.measured?.height ?? 0,
    }),
  );

  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const position = g.node(node.id);
      // dagre anchors at the center; React Flow anchors at the top left.
      const x = position.x - (node.measured?.width ?? 0) / 2;
      const y = position.y - (node.measured?.height ?? 0) / 2;
      return { ...node, position: { x, y } };
    }),
    edges,
  };
};
```

The fixed-size variant (Dagre Tree example) uses constants (`nodeWidth = 172`, `nodeHeight = 36`) instead of `node.measured`, and sets handle sides per direction:

```ts
targetPosition: isHorizontal ? "left" : "top",
sourcePosition: isHorizontal ? "right" : "bottom",
```

**S-01:** prefer the fixed-size variant — one synchronous pass per edit, no wait for measurement, which suits the 200 ms NFR. The measured variant needs `useNodesInitialized()` and a second render after measuring.

### Node dimensions in v12

- Set explicit size with top-level `width` / `height` on the node (not `style.width`).
- Read measured size from `node.measured?.width` / `node.measured?.height`.
- `useNodesInitialized()` returns `true` once all nodes have been measured — the trigger for measured-size layouts.

### Custom nodes in TypeScript

```tsx
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

type TaskNode = Node<{ name: string }, "task">;

export function TaskNode({ data }: NodeProps<TaskNode>) {
  return (
    <>
      <div>{data.name}</div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </>
  );
}
```

`Node<Data, Type>` ties a `data` shape to a `type` string. Use the `nodrag` class on interactive elements inside a node so clicks don't start a drag.

### Registering node types

```ts
const nodeTypes = { task: TaskNode }; // module scope — never inline in JSX
```

Defining `nodeTypes` / `edgeTypes` inline creates a new object per render and re-renders the whole flow; define them at module scope or wrap in `useMemo`.

### Performance

- Wrap custom node and edge components in `React.memo`.
- Wrap handlers passed to `<ReactFlow>` in `useCallback`; memoize objects/arrays passed as props (`defaultEdgeOptions`, `snapGrid`) with `useMemo`.
- `fitView` prop fits the viewport on first render; `useReactFlow().fitView()` refits after a relayout (requires `ReactFlowProvider` above the component).

### State

`useNodesState` / `useEdgesState` return `[items, setItems, onItemsChange]` for the controlled pattern. **S-01:** layout is derived, never stored (PRD non-goal "Manual layout"), so the project model is the source of truth and React Flow nodes/edges can be computed from it (for example with `useMemo`) rather than held as independent state. Whether to allow dragging at all is a planning decision; if not, disable it on `<ReactFlow>`.

## Open points for `/10x-plan`

1. Fixed vs measured node size (recommendation: fixed).
2. Layout direction — `LR` reads naturally as START → FINISH.
3. Derived nodes/edges from the project model vs `useNodesState`.
4. Whether to use `dagre.graphlib.alg` for S-02 cycle detection or keep it in pure domain code.
5. Where `getLayoutedElements` lives — it is pure and testable, so `src/lib/` with a colocated Vitest test fits the conventions.
