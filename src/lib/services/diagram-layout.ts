// TEMPORARY, lives only until Phase 3 of the diagram-anti-corruption-layer
// change moves the React Flow mapping into src/components/planner/diagram/.
// It keeps today's exports and React Flow node and edge shapes, so no view
// changes yet, but computes them from the new pipeline: the Diagram from
// projectDiagram, positions from layoutDiagram through the layoutEngine port.
// React Flow is imported as types only: this module and its tests never load React.
import type { Edge as FlowEdge, Node } from "@xyflow/react";

import { layoutEngine } from "@/lib/adapters/layout-engine";
import {
  FINISH_NODE_ID,
  layoutDiagram as layoutDomainDiagram,
  projectDiagram,
  RANK_SEPARATION,
  START_FINISH_NODE_SIZE,
  START_NODE_ID,
  TASK_NODE_SIZE,
} from "@/lib/services/diagram";
import type { DayCountingMode, Project, TaskId } from "@/types";

export { FINISH_NODE_ID, RANK_SEPARATION, START_NODE_ID };

export const TASK_NODE_WIDTH = TASK_NODE_SIZE.width;
/** Two lines: the name, then the Duration or "No Duration". */
export const TASK_NODE_HEIGHT = TASK_NODE_SIZE.height;
export const START_FINISH_NODE_WIDTH = START_FINISH_NODE_SIZE.width;
export const START_FINISH_NODE_HEIGHT = START_FINISH_NODE_SIZE.height;

/**
 * Click handling reads `data.taskId`; the node id is `String(taskId)` and is never parsed.
 * `durationMissing` is the Task's duration-missing Validation Warning, from validationWarnings.
 * `dayCountingMode` is the unit the Duration is shown in.
 */
export type TaskNodeType = Node<
  { name: string; taskId: TaskId; duration?: number; durationMissing: boolean; dayCountingMode: DayCountingMode },
  "task"
>;
/** `date` is the START date; layout leaves it out and Diagram adds it, so a date edit never re-runs layout. */
export type StartNodeType = Node<{ date?: string }, "start">;
export type FinishNodeType = Node<Record<string, never>, "finish">;
export type DiagramNode = TaskNodeType | StartNodeType | FinishNodeType;
export type DiagramEdge = FlowEdge;

export interface Diagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export function layoutDiagram(project: Pick<Project, "tasks" | "dayCountingMode">): Diagram {
  const laidOut = layoutDomainDiagram(projectDiagram(project), layoutEngine);
  const durations = new Map(project.tasks.map((task) => [task.id, task.duration]));

  return {
    nodes: laidOut.nodes.map((node): DiagramNode => {
      const box = { position: node.position, width: node.size.width, height: node.size.height };
      switch (node.kind) {
        // START and Task nodes leave focusable and selectable unset and follow the
        // diagram-wide settings: Enter or Space edits them, so each is announced as a button.
        case "start":
          return { id: node.id, type: "start", data: {}, ariaLabel: "START", ariaRole: "button", ...box };
        case "task": {
          const duration = durations.get(node.taskId);
          return {
            id: node.id,
            type: "task",
            data: {
              name: node.name,
              taskId: node.taskId,
              ...(duration === undefined ? {} : { duration }),
              durationMissing: node.durationMissing,
              dayCountingMode: project.dayCountingMode,
            },
            ariaLabel: node.accessibleName,
            ariaRole: "button",
            ...box,
          };
        }
        // FINISH has nothing to edit, so it is neither selectable nor a tab stop.
        case "finish":
          return { id: node.id, type: "finish", data: {}, ...box, focusable: false, selectable: false };
      }
    }),
    edges: laidOut.edges.map(({ id, source, target }) => ({ id, source, target, markerEnd: { type: "arrowclosed" } })),
  };
}
