import { Background, Controls, ReactFlow, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import { useCallback, useEffect, useMemo, type KeyboardEvent } from "react";

import { FinishNode } from "@/components/planner/FinishNode";
import { StartNode } from "@/components/planner/StartNode";
import { TaskNode } from "@/components/planner/TaskNode";
import { layoutDiagram, type DiagramEdge, type DiagramNode } from "@/lib/services/diagram-layout";
import type { Project, TaskId } from "@/types";

// Module scope: an inline object would make React Flow re-mount every node on each render.
const nodeTypes = { task: TaskNode, start: StartNode, finish: FinishNode };
// Module scope for the same reason. React Flow's default node description
// (shown while keyboard a11y is on, despite the key's name) promises arrow-key
// moves and Delete, and neither exists here.
const ariaLabelConfig = { "node.a11yDescription.keyboardDisabled": "Press Enter or Space to edit this Task." };

interface DiagramProps {
  project: Project;
  selectedTaskId: TaskId | undefined;
  /** Mouse selection: a click on a Task node, or `null` for a click on the empty canvas. */
  onSelect: (taskId: TaskId | null) => void;
  /** Keyboard selection: Enter or Space on a focused Task node, which also asks the panel to take focus. */
  onEdit: (taskId: TaskId) => void;
}

/**
 * The laid-out project. Nodes and edges are derived, never stored: layout runs
 * only when the project changes, and selection is applied in a second, cheap pass.
 */
export function Diagram({ project, selectedTaskId, onSelect, onEdit }: DiagramProps) {
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

  // Enter and Space on a focused node bubble here from the node wrapper, which
  // carries the node id. React Flow's own selection change for the same key is
  // inert (no onNodesChange), so this is the only keyboard path to a selection.
  // Escape is left to React Flow: it only blurs the node, and the selection and
  // the panel stay as they are.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains("react-flow__node")) return;
      const node = diagram.nodes.find((candidate) => candidate.id === target.dataset.id);
      if (node?.type !== "task") return;
      // The panel takes focus during this keydown; without this the key would
      // type a space into "Task name" or submit its form.
      event.preventDefault();
      onEdit(node.data.taskId);
    },
    [diagram, onEdit],
  );

  return (
    <ReactFlow<DiagramNode, DiagramEdge>
      nodes={nodes}
      edges={diagram.edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      onKeyDown={handleKeyDown}
      nodesDraggable={false}
      nodesConnectable={false}
      // Task nodes are tab stops so they can be selected by keyboard (handleKeyDown);
      // START and FINISH opt out per node in diagram-layout.
      nodesFocusable
      edgesFocusable={false}
      // Delete Task has no confirmation, so no key on the diagram may delete anything.
      deleteKeyCode={null}
      ariaLabelConfig={ariaLabelConfig}
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
