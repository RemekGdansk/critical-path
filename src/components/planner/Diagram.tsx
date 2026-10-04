import { Background, Controls, ReactFlow, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";

import { FinishNode } from "@/components/planner/FinishNode";
import { StartNode } from "@/components/planner/StartNode";
import { TaskNode } from "@/components/planner/TaskNode";
import { layoutDiagram, type DiagramEdge, type DiagramNode } from "@/lib/services/diagram-layout";
import type { Project, TaskId } from "@/types";

// Module scope: an inline object would make React Flow re-mount every node on each render.
const nodeTypes = { task: TaskNode, start: StartNode, finish: FinishNode };

interface DiagramProps {
  project: Project;
  selectedTaskId: TaskId | undefined;
  onSelect: (taskId: TaskId | null) => void;
}

/**
 * The laid-out project. Nodes and edges are derived, never stored: layout runs
 * only when the project changes, and selection is applied in a second, cheap pass.
 */
export function Diagram({ project, selectedTaskId, onSelect }: DiagramProps) {
  const diagram = useMemo(() => layoutDiagram(project), [project]);
  const nodes = useMemo(
    () =>
      selectedTaskId === undefined
        ? diagram.nodes
        : diagram.nodes.map((node) =>
            node.type === "task" && node.data.taskId === selectedTaskId ? { ...node, selected: true } : node,
          ),
    [diagram, selectedTaskId],
  );

  // Refit when Tasks are created or deleted, not on rename or selection.
  // React Flow queues fitView until the new nodes are measured.
  const { fitView } = useReactFlow<DiagramNode, DiagramEdge>();
  const taskIdsKey = project.tasks.map((task) => task.id).join(",");
  useEffect(() => {
    void fitView();
  }, [taskIdsKey, fitView]);

  const handleNodeClick = useCallback<NodeMouseHandler<DiagramNode>>(
    (_event, node) => {
      // START and FINISH have nothing to edit yet, so clicking them selects nothing.
      if (node.type === "task") onSelect(node.data.taskId);
    },
    [onSelect],
  );
  const handlePaneClick = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  return (
    <ReactFlow<DiagramNode, DiagramEdge>
      nodes={nodes}
      edges={diagram.edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      nodesDraggable={false}
      nodesConnectable={false}
      // Keyboard selection is not built yet: Enter on a focused node would go
      // through onNodesChange, which is not passed, so focus would be a dead stop.
      nodesFocusable={false}
      edgesFocusable={false}
      colorMode="light"
      // null drops React Flow's inline arrowhead colour, so arrowheads read --xy-edge-stroke like the edges.
      defaultMarkerColor={null}
      fitView
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
