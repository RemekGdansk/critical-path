import { MarkerType } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  type FlowNode,
  selectionTarget,
  toFlowEdges,
  toFlowNode,
  toFlowNodes,
} from "@/components/planner/diagram/flow-elements";
import {
  FINISH_NODE_ID,
  type LaidOutDiagram,
  type LayoutEngine,
  layoutDiagram,
  projectDiagram,
  START_FINISH_NODE_SIZE,
  START_NODE_ID,
  TASK_NODE_SIZE,
  withStartDate,
} from "@/lib/services/diagram";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  type EditContext,
  type EditResult,
  setDuration,
} from "@/lib/services/project";
import type { Project, TaskId } from "@/types";

const TODAY = "2026-09-05";
const CONTEXT: EditContext = { today: TODAY };

function accepted(result: EditResult): CheckedProject {
  if (!result.ok)
    throw new Error(`Expected the edit to be accepted, got ${result.error.rule}: ${result.error.message}`);
  return result.project;
}

/** A project with one Task per name, ids 1..n in order. */
function projectWith(...names: string[]): CheckedProject {
  return names.reduce((project, name) => accepted(createTask(project, name, CONTEXT)), createEmptyProject(CONTEXT));
}

/** A project with one Task per [name, Duration] pair, ids 1..n, and `predecessorId → taskId` for each pair. */
function scheduledProject(tasks: [string, string][], ...pairs: [TaskId, TaskId][]): CheckedProject {
  const withTasks = tasks.reduce((current, [name, duration]) => {
    const created = accepted(createTask(current, name, CONTEXT));
    return accepted(setDuration(created, created.nextTaskId - 1, duration, CONTEXT));
  }, createEmptyProject(CONTEXT));
  return pairs.reduce(
    (current, [predecessorId, taskId]) => accepted(addPredecessor(current, taskId, predecessorId, CONTEXT)),
    withTasks,
  );
}

/** A (5) → B (3): 8 days, so START → A → B → FINISH is critical; C (1) alone is not. */
function chainAndLoneTask(): CheckedProject {
  return scheduledProject(
    [
      ["A", "5"],
      ["B", "3"],
      ["C", "1"],
    ],
    [1, 2],
  );
}

/** A fake engine that puts node i at column i of one row, so positions are known without a real layout. */
const gridEngine: LayoutEngine = (request) =>
  new Map(request.nodes.map((node, index) => [node.id, { x: index * 200, y: 10 }]));

function laidOut(project: Project): LaidOutDiagram {
  return layoutDiagram(projectDiagram(project), gridEngine);
}

function flowNodeById(nodes: readonly FlowNode[], id: string): FlowNode {
  const node = nodes.find((candidate) => candidate.id === id);
  if (node === undefined) throw new Error(`No node "${id}" in the diagram`);
  return node;
}

describe("toFlowNodes", () => {
  it("keeps the Diagram's node order, and gives each node its kind as type, its position and its size", () => {
    const nodes = toFlowNodes(laidOut(projectWith("A")));

    expect(nodes.map((node) => [node.id, node.type])).toEqual([
      [START_NODE_ID, "start"],
      ["1", "task"],
      [FINISH_NODE_ID, "finish"],
    ]);
    expect(flowNodeById(nodes, START_NODE_ID)).toMatchObject({ position: { x: 0, y: 10 }, ...START_FINISH_NODE_SIZE });
    expect(flowNodeById(nodes, "1")).toMatchObject({ position: { x: 200, y: 10 }, ...TASK_NODE_SIZE });
    expect(flowNodeById(nodes, FINISH_NODE_ID)).toMatchObject({
      position: { x: 400, y: 10 },
      ...START_FINISH_NODE_SIZE,
    });
  });

  it("hands the custom nodes the domain node in data.node", () => {
    const diagram = laidOut(accepted(setDuration(projectWith("A"), 1, "5", CONTEXT)));
    const nodes = toFlowNodes(diagram);

    for (const node of diagram.nodes) expect(flowNodeById(nodes, node.id).data.node).toEqual(node);
    expect(flowNodeById(nodes, "1").data.node).toMatchObject({ kind: "task", taskId: 1, durationText: "5 days" });
  });

  it("leaves START to the diagram settings like a Task node; FINISH is neither focusable nor selectable", () => {
    const nodes = toFlowNodes(laidOut(projectWith("A")));
    expect(flowNodeById(nodes, FINISH_NODE_ID)).toMatchObject({ focusable: false, selectable: false });
    for (const id of [START_NODE_ID, "1"]) {
      const node = flowNodeById(nodes, id);
      expect(node).not.toHaveProperty("focusable");
      expect(node).not.toHaveProperty("selectable");
    }
  });

  it("announces START and every Task as a button under its accessible name, and FINISH by its text alone", () => {
    const nodes = toFlowNodes(laidOut(projectWith("A")));
    expect(flowNodeById(nodes, START_NODE_ID)).toMatchObject({ ariaLabel: "START, today", ariaRole: "button" });
    expect(flowNodeById(nodes, "1")).toMatchObject({
      ariaLabel: "A, no Duration (Validation Warning)",
      ariaRole: "button",
    });
    expect(flowNodeById(nodes, FINISH_NODE_ID)).not.toHaveProperty("ariaRole");
    expect(flowNodeById(nodes, FINISH_NODE_ID)).not.toHaveProperty("ariaLabel");
  });

  it("names START by the date withStartDate adds, and carries the date to the node", () => {
    const start = laidOut(createEmptyProject(CONTEXT)).nodes.find((node) => node.kind === "start");
    if (start === undefined) throw new Error("No START node in the diagram");
    const dated = { ...withStartDate(start, "2030-01-07"), position: start.position };

    const node = toFlowNode(dated);
    expect(node).toMatchObject({
      id: START_NODE_ID,
      type: "start",
      ariaLabel: "START, 2030-01-07",
      data: { node: { date: "2030-01-07" } },
    });
  });

  it("announces a critical Task as on the critical path", () => {
    const nodes = toFlowNodes(laidOut(chainAndLoneTask()));
    expect(flowNodeById(nodes, "1")).toMatchObject({ ariaLabel: "A, 5 days, on the critical path" });
    expect(flowNodeById(nodes, "3")).toMatchObject({ ariaLabel: "C, 1 day" });
  });

  it("sets no selection: the Diagram applies it", () => {
    for (const node of toFlowNodes(laidOut(projectWith("A")))) expect(node).not.toHaveProperty("selected");
  });
});

describe("toFlowEdges", () => {
  it("draws an empty project's one edge with a closed arrowhead, and no edge kind", () => {
    expect(toFlowEdges(laidOut(createEmptyProject(CONTEXT)))).toEqual([
      { id: "start->finish", source: "start", target: "finish", markerEnd: { type: MarkerType.ArrowClosed } },
    ]);
  });

  it("draws a critical edge with the critical-path class and an arrowhead in the token's colour, at its usual size", () => {
    const edges = toFlowEdges(laidOut(chainAndLoneTask()));
    const criticalMarker = { type: MarkerType.ArrowClosed, color: "var(--critical-path)", width: 6.25, height: 6.25 };
    expect(edges).toEqual([
      { id: "start->1", source: "start", target: "1", className: "critical-path", markerEnd: criticalMarker },
      { id: "1->2", source: "1", target: "2", className: "critical-path", markerEnd: criticalMarker },
      { id: "start->3", source: "start", target: "3", markerEnd: { type: MarkerType.ArrowClosed } },
      { id: "2->finish", source: "2", target: "finish", className: "critical-path", markerEnd: criticalMarker },
      { id: "3->finish", source: "3", target: "finish", markerEnd: { type: MarkerType.ArrowClosed } },
    ]);
  });

  it("keeps a non-critical edge as it was, with no class and the default arrowhead", () => {
    // B has no Duration: a Validation Warning withholds the schedule, so no edge is critical.
    const warned = scheduledProject(
      [
        ["A", "5"],
        ["B", ""],
      ],
      [1, 2],
    );
    for (const edge of toFlowEdges(laidOut(warned)))
      expect(edge).toEqual({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        markerEnd: { type: MarkerType.ArrowClosed },
      });
  });

  it("keeps the Diagram's edge ids, ends and order", () => {
    const diagram = laidOut(projectWith("A", "B"));
    expect(toFlowEdges(diagram).map(({ id, source, target }) => ({ id, source, target }))).toEqual(
      diagram.edges.map(({ id, source, target }) => ({ id, source, target })),
    );
  });
});

describe("selectionTarget", () => {
  const nodes = toFlowNodes(laidOut(projectWith("A", "B")));

  it("selects START, or a Task by its id", () => {
    expect(selectionTarget(flowNodeById(nodes, START_NODE_ID))).toBe("start");
    expect(selectionTarget(flowNodeById(nodes, "2"))).toBe(2);
  });

  it("selects nothing for FINISH or for no node", () => {
    expect(selectionTarget(flowNodeById(nodes, FINISH_NODE_ID))).toBeUndefined();
    expect(selectionTarget(undefined)).toBeUndefined();
  });
});
