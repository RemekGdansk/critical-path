import { Background, Controls, Position, ReactFlow, ReactFlowProvider, type Edge, type Node } from "@xyflow/react";

// Phase 1 toolchain probe: a hard-coded START → FINISH diagram, replaced by the real planner in Phase 4.
// START's Tailwind classes compete with React Flow's default node background, proving the
// `layer(components)` import in global.css lets utilities win.
const nodes: Node[] = [
  {
    id: "start",
    type: "input",
    position: { x: 0, y: 0 },
    data: { label: "START" },
    sourcePosition: Position.Right,
    className: "bg-primary text-primary-foreground",
  },
  {
    id: "finish",
    type: "output",
    position: { x: 250, y: 0 },
    data: { label: "FINISH" },
    targetPosition: Position.Left,
  },
];

const edges: Edge[] = [{ id: "start->finish", source: "start", target: "finish" }];

export function Planner() {
  return (
    <ReactFlowProvider>
      <ReactFlow nodes={nodes} edges={edges} colorMode="light" nodesDraggable={false} nodesConnectable={false} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
