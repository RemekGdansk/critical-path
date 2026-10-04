// The one place that knows how a project becomes a diagram: START and FINISH
// always exist, every Task is a node, every predecessor link is an edge, a Task
// without predecessors hangs off START and a Task without successors feeds
// FINISH. Positions come from dagre with constant node sizes, so one synchronous
// pass lays out the whole project. React Flow is imported as types only: this
// module and its tests never load React.
import { Graph, layout, type EdgeLabel, type GraphLabel, type NodeLabel } from "@dagrejs/dagre";
import type { Edge as FlowEdge, Node } from "@xyflow/react";

import { validationWarnings } from "@/lib/services/validation-warnings";
import type { Project, Task, TaskId } from "@/types";

export const TASK_NODE_WIDTH = 180;
/** Two lines: the name, then the Duration or "No Duration". */
export const TASK_NODE_HEIGHT = 52;
export const START_FINISH_NODE_WIDTH = 96;
export const START_FINISH_NODE_HEIGHT = 40;
/** Horizontal gap between the right edge of one rank and the left edge of the next. */
export const RANK_SEPARATION = 60;

export const START_NODE_ID = "start";
export const FINISH_NODE_ID = "finish";

/**
 * Click handling reads `data.taskId`; the node id is `String(taskId)` and is never parsed.
 * `durationMissing` is the Task's duration-missing Validation Warning, from validationWarnings.
 */
export type TaskNodeType = Node<{ name: string; taskId: TaskId; duration?: number; durationMissing: boolean }, "task">;
/** `date` is the START date; layout leaves it out and Diagram adds it, so a date edit never re-runs layout. */
export type StartNodeType = Node<{ date?: string }, "start">;
export type FinishNodeType = Node<Record<string, never>, "finish">;
export type DiagramNode = TaskNodeType | StartNodeType | FinishNodeType;
export type DiagramEdge = FlowEdge;

export interface Diagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const LAYOUT: GraphLabel = { rankdir: "LR", nodesep: 40, ranksep: RANK_SEPARATION };

function taskNodeId(taskId: TaskId): string {
  return String(taskId);
}

/** "1 day", "5 days". */
export function formatDuration(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

function taskAriaLabel(task: Task, durationMissing: boolean): string {
  if (durationMissing) return `${task.name}, no Duration (Validation Warning)`;
  return task.duration === undefined ? task.name : `${task.name}, ${formatDuration(task.duration)}`;
}

function edge(source: string, target: string): DiagramEdge {
  return { id: `${source}->${target}`, source, target, markerEnd: { type: "arrowclosed" } };
}

/** Nodes in a stable order (START, Tasks in creation order, FINISH), not yet positioned. */
function projectNodes(project: Pick<Project, "tasks">): DiagramNode[] {
  const origin = { x: 0, y: 0 };
  const warned = new Set(validationWarnings(project).map((warning) => warning.taskId));
  const terminal = { width: START_FINISH_NODE_WIDTH, height: START_FINISH_NODE_HEIGHT };
  return [
    // START and Task nodes leave focusable and selectable unset and follow the
    // diagram-wide settings: Enter or Space edits them, so each is announced as a button.
    {
      id: START_NODE_ID,
      type: "start",
      data: {},
      ariaLabel: "START",
      ariaRole: "button",
      position: origin,
      ...terminal,
    },
    ...project.tasks.map((task): TaskNodeType => ({
      id: taskNodeId(task.id),
      type: "task",
      data: {
        name: task.name,
        taskId: task.id,
        ...(task.duration === undefined ? {} : { duration: task.duration }),
        durationMissing: warned.has(task.id),
      },
      ariaLabel: taskAriaLabel(task, warned.has(task.id)),
      ariaRole: "button",
      position: origin,
      width: TASK_NODE_WIDTH,
      height: TASK_NODE_HEIGHT,
    })),
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
  ];
}

/** Predecessor links plus the synthetic START and FINISH links, in O(tasks + links). */
function projectEdges(project: Pick<Project, "tasks">): DiagramEdge[] {
  if (project.tasks.length === 0) return [edge(START_NODE_ID, FINISH_NODE_ID)];

  // The edit functions never leave a predecessor id without its Task; skipping
  // one anyway keeps a stray id from becoming an edge to a node that does not exist.
  const taskIds = new Set(project.tasks.map((task) => task.id));
  const hasSuccessor = new Set<TaskId>();
  const edges: DiagramEdge[] = [];

  for (const task of project.tasks) {
    const predecessors = task.predecessors.filter((id) => taskIds.has(id));
    if (predecessors.length === 0) edges.push(edge(START_NODE_ID, taskNodeId(task.id)));
    for (const predecessorId of predecessors) {
      edges.push(edge(taskNodeId(predecessorId), taskNodeId(task.id)));
      hasSuccessor.add(predecessorId);
    }
  }
  for (const task of project.tasks) {
    if (!hasSuccessor.has(task.id)) edges.push(edge(taskNodeId(task.id), FINISH_NODE_ID));
  }
  return edges;
}

export function layoutDiagram(project: Pick<Project, "tasks">): Diagram {
  const nodes = projectNodes(project);
  const edges = projectEdges(project);

  // A fresh graph per call: a reused one would keep nodes and edges deleted since the last layout.
  const graph = new Graph<GraphLabel, NodeLabel, EdgeLabel>();
  graph.setGraph(LAYOUT);
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) graph.setNode(node.id, { width: node.width ?? 0, height: node.height ?? 0 });
  for (const { source, target } of edges) graph.setEdge(source, target);
  layout(graph);

  return {
    nodes: nodes.map((node) => {
      const { x, y } = graph.node(node.id);
      if (x === undefined || y === undefined) throw new Error(`dagre did not position node "${node.id}".`);
      // dagre returns the node's centre; React Flow positions a node by its top-left corner.
      return { ...node, position: { x: x - (node.width ?? 0) / 2, y: y - (node.height ?? 0) / 2 } };
    }),
    edges,
  };
}
