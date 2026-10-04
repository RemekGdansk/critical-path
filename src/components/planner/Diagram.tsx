import { Background, Controls, ReactFlow, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import { useCallback, useEffect, useMemo, type KeyboardEvent } from "react";

import { FinishNode } from "@/components/planner/FinishNode";
import { StartNode } from "@/components/planner/StartNode";
import { TaskNode } from "@/components/planner/TaskNode";
import type { Selection } from "@/hooks/useProject";
import { layoutDiagram, type DiagramEdge, type DiagramNode } from "@/lib/services/diagram-layout";
import type { Project, TaskId } from "@/types";

// Module scope: an inline object would make React Flow re-mount every node on each render.
const nodeTypes = { task: TaskNode, start: StartNode, finish: FinishNode };
// Module scope for the same reason. React Flow's default node description
// (shown while keyboard a11y is on, despite the key's name) promises arrow-key
// moves and Delete, and neither exists here.
const ariaLabelConfig = { "node.a11yDescription.keyboardDisabled": "Press Enter or Space to edit it." };

interface DiagramProps {
  project: Project;
  selection: Selection;
  /** Mouse selection: a click on START or a Task node, or `null` for a click on the empty canvas. */
  onSelect: (target: Selection) => void;
  /** Keyboard selection: Enter or Space on focused START or a Task node, which also asks the panel to take focus. */
  onEdit: (target: TaskId | "start") => void;
}

/**
 * The laid-out project. Nodes and edges are derived, never stored: layout runs
 * only when the Tasks change, and the selection and the START date are applied
 * in a second, cheap pass.
 */
export function Diagram({ project, selection, onSelect, onEdit }: DiagramProps) {
  const { tasks } = project;
  const diagram = useMemo(() => layoutDiagram({ tasks }), [tasks]);
  const startDate = project.start.date;
  const nodes = useMemo(
    () =>
      diagram.nodes.map((node): DiagramNode => {
        if (node.type === "start") {
          return {
            ...node,
            data: startDate === undefined ? {} : { date: startDate },
            ariaLabel: `START, ${startDate ?? "today"}`,
            selected: selection === "start",
          };
        }
        return node.type === "task" && node.data.taskId === selection ? { ...node, selected: true } : node;
      }),
    [diagram, selection, startDate],
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
      // FINISH has nothing to edit, so clicking it selects nothing.
      if (node.type === "task") onSelect(node.data.taskId);
      else if (node.type === "start") onSelect("start");
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
      if (node?.type !== "task" && node?.type !== "start") return;
      // The panel takes focus during this keydown; without this the key would
      // type a space into the focused field or submit its form.
      event.preventDefault();
      onEdit(node.type === "task" ? node.data.taskId : "start");
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
      // START and Task nodes are tab stops so they can be selected by keyboard
      // (handleKeyDown); FINISH opts out per node in diagram-layout.
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
