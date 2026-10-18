// The one place that knows how a project becomes a Diagram: START and FINISH
// always exist, every Task is a node, every predecessor is a dependency edge, a
// Task without predecessors hangs off START and a Task without successors feeds
// FINISH. It also decides what each node shows and is called, and that FINISH
// has nothing to edit. It imports no third-party package: positions come
// through the LayoutEngine port, and drawing the Diagram is the view's concern.
import { formatDuration } from "@/lib/services/duration";
import { validationWarnings } from "@/lib/services/validation-warnings";
import type { DayCountingMode, Project, Task, TaskId } from "@/types";

export const START_NODE_ID = "start";
export const FINISH_NODE_ID = "finish";

/** `String(taskId)` for a Task node; never parsed back into a Task id. */
export type DiagramNodeId = string;

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Two lines: the name, then the Duration or "No Duration". */
export const TASK_NODE_SIZE: Size = { width: 180, height: 52 };
export const START_FINISH_NODE_SIZE: Size = { width: 96, height: 40 };
/** Horizontal gap between the right edge of one rank and the left edge of the next. */
export const RANK_SEPARATION = 60;
/** Gap between neighbouring nodes in one rank. */
export const NODE_SEPARATION = 40;

interface DiagramNodeBase {
  id: DiagramNodeId;
  size: Size;
  /** What assistive technology announces for the node. */
  accessibleName: string;
  /** Whether the node opens a side panel: START and every Task do, FINISH does not. */
  editable: boolean;
}

export interface StartDiagramNode extends DiagramNodeBase {
  kind: "start";
  /** The START date; only withStartDate adds it, so the layout never depends on it. */
  date?: string;
}

export interface TaskDiagramNode extends DiagramNodeBase {
  kind: "task";
  taskId: TaskId;
  name: string;
  /** The Duration as it reads on screen ("5 days", "1 weekday"); absent when the Task has none. */
  durationText?: string;
  /** The Task's duration-missing Validation Warning, from validationWarnings. */
  durationMissing: boolean;
}

export interface FinishDiagramNode extends DiagramNodeBase {
  kind: "finish";
}

export type DiagramNode = StartDiagramNode | TaskDiagramNode | FinishDiagramNode;

/** "dependency" is a stored predecessor; the other two are derived: a Task hangs off START or feeds FINISH. */
export type DiagramEdgeKind = "dependency" | "hangs-off-start" | "feeds-finish";

export interface DiagramEdge {
  id: `${DiagramNodeId}->${DiagramNodeId}`;
  source: DiagramNodeId;
  target: DiagramNodeId;
  kind: DiagramEdgeKind;
}

export interface Diagram {
  nodes: readonly DiagramNode[];
  edges: readonly DiagramEdge[];
}

/** Top-left corner of the node's box, in Diagram units. */
export interface Placement {
  x: number;
  y: number;
}

export interface LaidOutDiagram {
  nodes: readonly (DiagramNode & { position: Placement })[];
  edges: readonly DiagramEdge[];
}

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
 * Synchronous by contract: the Diagram derives positions during render, and the
 * 200 ms NFR was measured on that path. Positions are top-left corners. An
 * engine that answers asynchronously or by centre adapts in its adapter, or the
 * port changes in a reviewed commit.
 */
export type LayoutEngine = (request: LayoutRequest) => ReadonlyMap<DiagramNodeId, Placement>;

function taskNodeId(taskId: TaskId): DiagramNodeId {
  return String(taskId);
}

/** "START, 2030-01-07", or "START, today" while the START date is unset. */
export function startAccessibleName(date: string | undefined): string {
  return `START, ${date ?? "today"}`;
}

/** The Task's name, then its Duration, or that it has none as a Validation Warning. */
export function taskAccessibleName(task: Task, durationMissing: boolean, mode: DayCountingMode): string {
  if (durationMissing) return `${task.name}, no Duration (Validation Warning)`;
  return task.duration === undefined ? task.name : `${task.name}, ${formatDuration(task.duration, mode)}`;
}

/** The only way the START date and its accessible name enter the Diagram. */
export function withStartDate(node: StartDiagramNode, date: string | undefined): StartDiagramNode {
  const { date: _previousDate, ...rest } = node;
  return { ...rest, ...(date === undefined ? {} : { date }), accessibleName: startAccessibleName(date) };
}

function edge(source: DiagramNodeId, target: DiagramNodeId, kind: DiagramEdgeKind): DiagramEdge {
  return { id: `${source}->${target}`, source, target, kind };
}

/** Nodes in a stable order: START, Tasks in creation order, FINISH. */
function projectNodes(project: Pick<Project, "tasks" | "dayCountingMode">): DiagramNode[] {
  const warned = new Set(validationWarnings(project).map((warning) => warning.taskId));
  return [
    {
      kind: "start",
      id: START_NODE_ID,
      size: START_FINISH_NODE_SIZE,
      accessibleName: startAccessibleName(undefined),
      editable: true,
    },
    ...project.tasks.map((task): TaskDiagramNode => {
      const durationMissing = warned.has(task.id);
      return {
        kind: "task",
        id: taskNodeId(task.id),
        size: TASK_NODE_SIZE,
        taskId: task.id,
        name: task.name,
        ...(task.duration === undefined
          ? {}
          : { durationText: formatDuration(task.duration, project.dayCountingMode) }),
        durationMissing,
        accessibleName: taskAccessibleName(task, durationMissing, project.dayCountingMode),
        editable: true,
      };
    }),
    // FINISH has nothing to edit.
    {
      kind: "finish",
      id: FINISH_NODE_ID,
      size: START_FINISH_NODE_SIZE,
      accessibleName: "FINISH",
      editable: false,
    },
  ];
}

/**
 * Dependency edges plus the derived START and FINISH edges, in O(tasks +
 * predecessors): Task by Task, the START edge or the dependency edges into it,
 * then the FINISH edges. A layout engine's result can depend on this order.
 */
function projectEdges(project: Pick<Project, "tasks">): DiagramEdge[] {
  // With no Task, START itself has no successor, so it feeds FINISH.
  if (project.tasks.length === 0) return [edge(START_NODE_ID, FINISH_NODE_ID, "feeds-finish")];

  // The edit functions never leave a predecessor id without its Task; skipping
  // one anyway keeps a stray id from becoming an edge to a node that does not exist.
  const taskIds = new Set(project.tasks.map((task) => task.id));
  const hasSuccessor = new Set<TaskId>();
  const edges: DiagramEdge[] = [];

  for (const task of project.tasks) {
    const predecessors = task.predecessors.filter((id) => taskIds.has(id));
    if (predecessors.length === 0) edges.push(edge(START_NODE_ID, taskNodeId(task.id), "hangs-off-start"));
    for (const predecessorId of predecessors) {
      edges.push(edge(taskNodeId(predecessorId), taskNodeId(task.id), "dependency"));
      hasSuccessor.add(predecessorId);
    }
  }
  for (const task of project.tasks) {
    if (!hasSuccessor.has(task.id)) edges.push(edge(taskNodeId(task.id), FINISH_NODE_ID, "feeds-finish"));
  }
  return edges;
}

/**
 * The project as a Diagram, not yet positioned. START carries no date, so a
 * layout memoized on the result never re-runs for a START date edit; add the
 * date with withStartDate.
 */
export function projectDiagram(project: Pick<Project, "tasks" | "dayCountingMode">): Diagram {
  return { nodes: projectNodes(project), edges: projectEdges(project) };
}

/** Positions every node through the engine, and refuses a result that misses one. */
export function layoutDiagram(diagram: Diagram, engine: LayoutEngine): LaidOutDiagram {
  const placements = engine({
    nodes: diagram.nodes.map((node) => ({ id: node.id, width: node.size.width, height: node.size.height })),
    edges: diagram.edges.map((diagramEdge) => ({ source: diagramEdge.source, target: diagramEdge.target })),
    direction: "left-to-right",
    rankSeparation: RANK_SEPARATION,
    nodeSeparation: NODE_SEPARATION,
  });
  return {
    nodes: diagram.nodes.map((node) => {
      const placement = placements.get(node.id);
      if (placement === undefined) throw new Error(`The layout engine did not position node "${node.id}".`);
      return { ...node, position: { x: placement.x, y: placement.y } };
    }),
    edges: diagram.edges,
  };
}
