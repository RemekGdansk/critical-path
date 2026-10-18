import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import { useCallback, useEffect, useMemo, type KeyboardEvent } from "react";

import { FinishNode } from "@/components/planner/diagram/FinishNode";
import {
  selectionTarget,
  toFlowEdges,
  toFlowNode,
  toFlowNodes,
  type FlowEdge,
  type FlowNode,
} from "@/components/planner/diagram/flow-elements";
import { StartNode } from "@/components/planner/diagram/StartNode";
import { TaskNode } from "@/components/planner/diagram/TaskNode";
import type { Selection } from "@/hooks/useProject";
import { layoutEngine } from "@/lib/adapters/layout-engine";
import { layoutDiagram, projectDiagram, withStartDate } from "@/lib/services/diagram";
import type { Project, TaskId } from "@/types";

// Module scope: an inline object would make React Flow re-mount every node on each render.
const nodeTypes = { task: TaskNode, start: StartNode, finish: FinishNode };
// Module scope for the same reason. React Flow's default node description
// (shown while keyboard a11y is on, despite the key's name) promises arrow-key
// moves and Delete, and neither exists here.
const ariaLabelConfig = { "node.a11yDescription.keyboardDisabled": "Press Enter or Space to edit it." };

interface DiagramProps {
  project: Project;
  /** A change refits the view, as a change in the Task ids does: the planner passes its import count. */
  fitKey: number;
  selection: Selection;
  /** Mouse selection: a click on START or a Task node, or `null` for a click on the empty canvas. */
  onSelect: (target: Selection) => void;
  /** Keyboard selection: Enter or Space on focused START or a Task node, which also asks the panel to take focus. */
  onEdit: (target: TaskId | "start") => void;
}

/**
 * The laid-out project, drawn by React Flow. This is the composition root that
 * pairs the domain's layoutDiagram with the layout engine, and it owns React
 * Flow's provider, so nothing above it knows which library draws the Diagram.
 */
export function Diagram(props: DiagramProps) {
  return (
    // useReactFlow() in DiagramCanvas throws without a provider above it.
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  );
}

/**
 * Nodes and edges are derived, never stored: layout runs only when the Tasks
 * or the day-counting mode change, and the selection and the START date are
 * applied in a second, cheap pass.
 */
function DiagramCanvas({ project, fitKey, selection, onSelect, onEdit }: DiagramProps) {
  const { tasks, dayCountingMode } = project;
  // The mode is a dependency too: it sets the unit in each node's text and accessible name.
  const flow = useMemo(() => {
    const laidOut = layoutDiagram(projectDiagram({ tasks, dayCountingMode }), layoutEngine);
    return { nodes: toFlowNodes(laidOut), edges: toFlowEdges(laidOut) };
  }, [tasks, dayCountingMode]);
  const startDate = project.start.date;
  // Only START and the selected Task get new objects; every other node keeps
  // its object, so React Flow does not adopt all of them again on each selection.
  const nodes = useMemo(
    () =>
      flow.nodes.map((node): FlowNode => {
        if (node.type === "start") {
          const start = withStartDate(node.data.node, startDate);
          return { ...toFlowNode({ ...start, position: node.position }), selected: selection === "start" };
        }
        return node.type === "task" && node.data.node.taskId === selection ? { ...node, selected: true } : node;
      }),
    [flow, selection, startDate],
  );

  // Refit when Tasks are created or deleted, or a project is imported (which
  // may keep the same ids), not on rename or selection. React Flow queues
  // fitView until the new nodes are measured.
  const { fitView } = useReactFlow<FlowNode, FlowEdge>();
  const taskIdsKey = project.tasks.map((task) => task.id).join(",");
  useEffect(() => {
    void fitView();
  }, [taskIdsKey, fitKey, fitView]);

  const handleNodeClick = useCallback<NodeMouseHandler<FlowNode>>(
    (_event, node) => {
      // FINISH has nothing to edit, so clicking it selects nothing.
      const target = selectionTarget(node);
      if (target !== undefined) onSelect(target);
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
      const element = event.target;
      if (!(element instanceof HTMLElement) || !element.classList.contains("react-flow__node")) return;
      const target = selectionTarget(flow.nodes.find((candidate) => candidate.id === element.dataset.id));
      if (target === undefined) return;
      // The panel takes focus during this keydown; without this the key would
      // type a space into the focused field or submit its form.
      event.preventDefault();
      onEdit(target);
    },
    [flow, onEdit],
  );

  return (
    <ReactFlow<FlowNode, FlowEdge>
      nodes={nodes}
      edges={flow.edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      onKeyDown={handleKeyDown}
      nodesDraggable={false}
      nodesConnectable={false}
      // START and Task nodes are tab stops so they can be selected by keyboard
      // (handleKeyDown); FINISH opts out per node in toFlowNode.
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
