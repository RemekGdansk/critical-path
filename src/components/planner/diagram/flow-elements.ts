// The one translation between the domain Diagram and React Flow, and back.
// The domain says what a node is, shows and is called; this file says how React
// Flow is told so. Nothing outside src/components/planner/diagram/ sees a React
// Flow node or edge.
import { MarkerType, type Edge, type Node, type NodeProps } from "@xyflow/react";

import type {
  DiagramNode,
  FinishDiagramNode,
  LaidOutDiagram,
  StartDiagramNode,
  TaskDiagramNode,
} from "@/lib/services/diagram";
import type { TaskId } from "@/types";

/** The custom nodes read the domain node from `data.node`; `type` is its kind. */
export type StartFlowNode = Node<{ node: StartDiagramNode }, "start">;
export type TaskFlowNode = Node<{ node: TaskDiagramNode }, "task">;
export type FinishFlowNode = Node<{ node: FinishDiagramNode }, "finish">;
export type FlowNode = StartFlowNode | TaskFlowNode | FinishFlowNode;
export type FlowEdge = Edge;

export type StartNodeProps = NodeProps<StartFlowNode>;
export type TaskNodeProps = NodeProps<TaskFlowNode>;
export type FinishNodeProps = NodeProps<FinishFlowNode>;

type LaidOutNode = LaidOutDiagram["nodes"][number];

/**
 * An editable node leaves focusable and selectable unset and follows the
 * diagram-wide settings: Enter or Space edits it, so it is announced as a button
 * under its accessible name. A node with nothing to edit (FINISH) is neither
 * selectable nor a tab stop; it gets no role, so it takes no aria-label either
 * (ARIA forbids one there) and its text names it.
 */
function interaction(node: DiagramNode): Pick<Node, "ariaLabel" | "ariaRole" | "focusable" | "selectable"> {
  return node.editable
    ? { ariaLabel: node.accessibleName, ariaRole: "button" }
    : { focusable: false, selectable: false };
}

export function toFlowNode(node: LaidOutNode): FlowNode {
  const box = { id: node.id, position: node.position, width: node.size.width, height: node.size.height };
  switch (node.kind) {
    case "start":
      return { ...box, type: "start", data: { node }, ...interaction(node) };
    case "task":
      return { ...box, type: "task", data: { node }, ...interaction(node) };
    case "finish":
      return { ...box, type: "finish", data: { node }, ...interaction(node) };
  }
}

export function toFlowNodes(diagram: LaidOutDiagram): FlowNode[] {
  return diagram.nodes.map(toFlowNode);
}

export function toFlowEdges(diagram: LaidOutDiagram): FlowEdge[] {
  return diagram.edges.map(({ id, source, target }) => ({
    id,
    source,
    target,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

/** The one decoding of a React Flow node into what it selects; FINISH, or no node, selects nothing. */
export function selectionTarget(node: FlowNode | undefined): TaskId | "start" | undefined {
  if (node?.type === "task") return node.data.node.taskId;
  if (node?.type === "start") return "start";
  return undefined;
}
