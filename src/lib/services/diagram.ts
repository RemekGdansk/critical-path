// The one place that knows how a project becomes a Diagram: START and FINISH
// always exist, every Task is a node, every predecessor is a dependency edge, a
// Task without predecessors hangs off START and a Task without successors feeds
// FINISH. It also decides what each node shows and is called (its Duration,
// Status and completion date included), which Tasks and edges are on the
// critical path, and that FINISH has nothing to edit. It imports no
// third-party package: positions come through the LayoutEngine port, and
// drawing the Diagram is the view's concern.
import { formatDuration } from "@/lib/services/duration";
import { taskStatusName } from "@/lib/services/project";
import { remainingWork, type RemainingWork, taskLinkId } from "@/lib/services/remaining-work";
import { validationWarnings } from "@/lib/services/validation-warnings";
import type { DayCountingMode, Project, Task, TaskId, TaskStatus } from "@/types";

export const START_NODE_ID = "start";
export const FINISH_NODE_ID = "finish";

/** `String(taskId)` for a Task node; never parsed back into a Task id. */
export type DiagramNodeId = string;

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Two lines: the name, then the Duration or "No Duration" (with "In Progress" after it), or "Done" and the completion date. */
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
  /**
   * The Duration as it reads on screen ("5 days", "1 weekday"); absent when the
   * Task has none. A Done Task's node shows its completion date instead.
   */
  durationText?: string;
  status: TaskStatus;
  /** A Done Task's completion date (ISO yyyy-mm-dd); only a Done Task has one. */
  completionDate?: string;
  /** The Task's duration-missing Validation Warning, from validationWarnings. */
  durationMissing: boolean;
  /** On some longest chain of remaining work, from remainingWork; never while a Validation Warning exists. */
  critical: boolean;
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
  /**
   * On some longest chain of remaining work: a dependency whose link is
   * critical, or a START or FINISH edge whose Task is critical.
   */
  critical: boolean;
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

/**
 * A Done Task's name and completion date: "A, Done on 2026-09-03". It is not
 * remaining work, so it has no Duration to announce and is never warned or
 * critical. Otherwise the Task's name, then its Duration, or that it has none
 * as a Validation Warning, then "In Progress" when it is, then whether it is
 * on the critical path; a To Do Task's Status goes unsaid. A warned Task is
 * never critical: the schedule is withheld while any Validation Warning exists.
 */
export function taskAccessibleName(
  task: Task,
  durationMissing: boolean,
  mode: DayCountingMode,
  critical: boolean,
): string {
  if (task.status === "done")
    return task.completionDate === undefined
      ? `${task.name}, ${taskStatusName("done")}`
      : `${task.name}, ${taskStatusName("done")} on ${task.completionDate}`;
  const duration = durationMissing
    ? `${task.name}, no Duration (Validation Warning)`
    : task.duration === undefined
      ? task.name
      : `${task.name}, ${formatDuration(task.duration, mode)}`;
  const status = task.status === "in-progress" ? `${duration}, ${taskStatusName("in-progress")}` : duration;
  return critical ? `${status}, on the critical path` : status;
}

/** The only way the START date and its accessible name enter the Diagram. */
export function withStartDate(node: StartDiagramNode, date: string | undefined): StartDiagramNode {
  const { date: _previousDate, ...rest } = node;
  return { ...rest, ...(date === undefined ? {} : { date }), accessibleName: startAccessibleName(date) };
}

function edge(source: DiagramNodeId, target: DiagramNodeId, kind: DiagramEdgeKind, critical: boolean): DiagramEdge {
  return { id: `${source}->${target}`, source, target, kind, critical };
}

/** The critical Tasks and links of the schedule; while it is withheld, nothing is critical. */
interface CriticalPath {
  isTaskCritical: (taskId: TaskId) => boolean;
  isLinkCritical: (predecessorId: TaskId, taskId: TaskId) => boolean;
}

function criticalPath(schedule: RemainingWork): CriticalPath {
  if (schedule.kind === "withheld") return { isTaskCritical: () => false, isLinkCritical: () => false };
  const { criticalTaskIds, criticalLinks } = schedule;
  return {
    isTaskCritical: (taskId) => criticalTaskIds.has(taskId),
    isLinkCritical: (predecessorId, taskId) => criticalLinks.has(taskLinkId(predecessorId, taskId)),
  };
}

/** Nodes in a stable order: START, Tasks in creation order, FINISH. */
function projectNodes(project: Pick<Project, "tasks" | "dayCountingMode">, critical: CriticalPath): DiagramNode[] {
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
      const isCritical = critical.isTaskCritical(task.id);
      return {
        kind: "task",
        id: taskNodeId(task.id),
        size: TASK_NODE_SIZE,
        taskId: task.id,
        name: task.name,
        ...(task.duration === undefined
          ? {}
          : { durationText: formatDuration(task.duration, project.dayCountingMode) }),
        status: task.status,
        ...(task.completionDate === undefined ? {} : { completionDate: task.completionDate }),
        durationMissing,
        critical: isCritical,
        accessibleName: taskAccessibleName(task, durationMissing, project.dayCountingMode, isCritical),
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
 * A START or FINISH edge is critical when its Task is; a dependency edge only
 * when its link is, since two critical Tasks do not make the link between them
 * critical.
 */
function projectEdges(project: Pick<Project, "tasks">, critical: CriticalPath): DiagramEdge[] {
  // With no Task, START itself has no successor, so it feeds FINISH. No Task, no critical path.
  if (project.tasks.length === 0) return [edge(START_NODE_ID, FINISH_NODE_ID, "feeds-finish", false)];

  // The edit functions never leave a predecessor id without its Task; skipping
  // one anyway keeps a stray id from becoming an edge to a node that does not exist.
  const taskIds = new Set(project.tasks.map((task) => task.id));
  const hasSuccessor = new Set<TaskId>();
  const edges: DiagramEdge[] = [];

  for (const task of project.tasks) {
    const predecessors = task.predecessors.filter((id) => taskIds.has(id));
    if (predecessors.length === 0)
      edges.push(edge(START_NODE_ID, taskNodeId(task.id), "hangs-off-start", critical.isTaskCritical(task.id)));
    for (const predecessorId of predecessors) {
      edges.push(
        edge(
          taskNodeId(predecessorId),
          taskNodeId(task.id),
          "dependency",
          critical.isLinkCritical(predecessorId, task.id),
        ),
      );
      hasSuccessor.add(predecessorId);
    }
  }
  for (const task of project.tasks) {
    if (!hasSuccessor.has(task.id))
      edges.push(edge(taskNodeId(task.id), FINISH_NODE_ID, "feeds-finish", critical.isTaskCritical(task.id)));
  }
  return edges;
}

/**
 * The project as a Diagram, not yet positioned. START carries no date, so a
 * layout memoized on the result never re-runs for a START date edit; add the
 * date with withStartDate. The critical path depends only on the Tasks, never
 * on the START date or today, which shift every remaining Task alike.
 *
 * Throws "The project contains a cycle." on a cycle, as remainingWork does,
 * unless the schedule is withheld for a Validation Warning; a `CheckedProject`
 * never holds a cycle.
 */
export function projectDiagram(project: Pick<Project, "tasks" | "dayCountingMode">): Diagram {
  const critical = criticalPath(remainingWork(project));
  return { nodes: projectNodes(project, critical), edges: projectEdges(project, critical) };
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
