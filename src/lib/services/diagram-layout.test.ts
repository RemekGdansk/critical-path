import { describe, expect, it } from "vitest";

import {
  type DiagramNode,
  FINISH_NODE_ID,
  formatDuration,
  layoutDiagram,
  RANK_SEPARATION,
  START_FINISH_NODE_HEIGHT,
  START_FINISH_NODE_WIDTH,
  START_NODE_ID,
  TASK_NODE_HEIGHT,
  TASK_NODE_WIDTH,
} from "@/lib/services/diagram-layout";
import { createPerfProject } from "@/lib/services/fixtures";
import {
  addPredecessor,
  createEmptyProject,
  createTask,
  deleteTask,
  type EditResult,
  setDuration,
} from "@/lib/services/project";
import type { Project, TaskId } from "@/types";

function accepted(result: EditResult): Project {
  if (!result.ok)
    throw new Error(`Expected the edit to be accepted, got ${result.error.rule}: ${result.error.message}`);
  return result.project;
}

/** A project with one Task per name, ids 1..n in order. */
function projectWith(...names: string[]): Project {
  return names.reduce((project, name) => accepted(createTask(project, name)), createEmptyProject());
}

/** Adds `predecessorId → taskId` for each pair. */
function withDependencies(project: Project, ...pairs: [TaskId, TaskId][]): Project {
  return pairs.reduce(
    (current, [predecessorId, taskId]) => accepted(addPredecessor(current, taskId, predecessorId)),
    project,
  );
}

function edgeIds(project: Project): string[] {
  return layoutDiagram(project)
    .edges.map((edge) => edge.id)
    .toSorted();
}

function nodeById(nodes: DiagramNode[], id: string): DiagramNode {
  const node = nodes.find((candidate) => candidate.id === id);
  if (node === undefined) throw new Error(`No node "${id}" in the diagram`);
  return node;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function rectOf(node: DiagramNode): Rect {
  const width = node.width ?? 0;
  const height = node.height ?? 0;
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + width,
    bottom: node.position.y + height,
  };
}

function overlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe("layoutDiagram projection", () => {
  it("draws an empty project as START and FINISH joined by one edge", () => {
    const { nodes, edges } = layoutDiagram(createEmptyProject());
    expect(nodes.map((node) => [node.id, node.type])).toEqual([
      [START_NODE_ID, "start"],
      [FINISH_NODE_ID, "finish"],
    ]);
    expect(edges).toEqual([
      { id: "start->finish", source: "start", target: "finish", markerEnd: { type: "arrowclosed" } },
    ]);
  });

  it("links a lone Task from START and to FINISH", () => {
    const { nodes } = layoutDiagram(projectWith("Design"));
    expect(nodeById(nodes, "1")).toMatchObject({
      type: "task",
      data: { name: "Design", taskId: 1, durationMissing: true },
    });
    expect(edgeIds(projectWith("Design"))).toEqual(["1->finish", "start->1"]);
  });

  it("gives START only the Tasks without predecessors and FINISH only the Tasks without successors", () => {
    const project = withDependencies(projectWith("A", "B"), [1, 2]);
    expect(edgeIds(project)).toEqual(["1->2", "2->finish", "start->1"]);
  });

  it("draws a join once per predecessor and a branch once per successor", () => {
    // 1 → 2, 1 → 3, 2 → 4, 3 → 4
    const project = withDependencies(projectWith("A", "B", "C", "D"), [1, 2], [1, 3], [2, 4], [3, 4]);
    expect(edgeIds(project)).toEqual(["1->2", "1->3", "2->4", "3->4", "4->finish", "start->1"]);
  });

  it("has one node per Task plus START and FINISH, and no edge to a deleted Task", () => {
    const project = withDependencies(projectWith("A", "B", "C"), [1, 2], [2, 3]);
    const afterDelete = accepted(deleteTask(project, 2));
    const { nodes, edges } = layoutDiagram(afterDelete);

    expect(nodes).toHaveLength(afterDelete.tasks.length + 2);
    const nodeIds = new Set(nodes.map((node) => node.id));
    expect(nodeIds.has("2")).toBe(false);
    for (const edge of edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
    // Deleting 2 leaves 1 and 3 unlinked: each hangs off START and feeds FINISH.
    expect(edgeIds(afterDelete)).toEqual(["1->finish", "3->finish", "start->1", "start->3"]);
  });

  it("gives every edge the id <source>-><target> and the same edges on every call", () => {
    const project = createPerfProject(30);
    const { edges } = layoutDiagram(project);
    for (const edge of edges) expect(edge.id).toBe(`${edge.source}->${edge.target}`);
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
    expect(layoutDiagram(project)).toEqual(layoutDiagram(project));
  });

  it("leaves START to the diagram settings like a Task node; FINISH is neither focusable nor selectable", () => {
    const { nodes } = layoutDiagram(projectWith("A"));
    expect(nodeById(nodes, FINISH_NODE_ID)).toMatchObject({ focusable: false, selectable: false });
    for (const id of [START_NODE_ID, "1"]) {
      const node = nodeById(nodes, id);
      expect(node).not.toHaveProperty("focusable");
      expect(node).not.toHaveProperty("selectable");
    }
    expect(nodeById(nodes, START_NODE_ID)).toMatchObject({ ariaLabel: "START", ariaRole: "button" });
    expect(nodeById(nodes, "1")).toMatchObject({ ariaRole: "button" });
  });

  it("carries the Duration, or flags its absence as a Validation Warning, in node data and aria label", () => {
    const project = accepted(setDuration(accepted(setDuration(projectWith("A", "B", "C"), 1, "5")), 2, "1"));
    const { nodes } = layoutDiagram(project);

    expect(nodeById(nodes, "1")).toMatchObject({
      data: { duration: 5, durationMissing: false },
      ariaLabel: "A, 5 days",
    });
    expect(nodeById(nodes, "2")).toMatchObject({
      data: { duration: 1, durationMissing: false },
      ariaLabel: "B, 1 day",
    });
    expect(nodeById(nodes, "3")).toMatchObject({
      data: { durationMissing: true },
      ariaLabel: "C, no Duration (Validation Warning)",
    });
    expect(nodeById(nodes, "3").data).not.toHaveProperty("duration");
  });

  it("raises no warning on a Done Task without a Duration", () => {
    // Built by hand: no edit sets Done yet (S-07).
    const project: Project = {
      ...createEmptyProject(),
      nextTaskId: 2,
      tasks: [{ id: 1, name: "A", predecessors: [], status: "done", completionDate: "2026-09-03" }],
    };
    expect(nodeById(layoutDiagram(project).nodes, "1")).toMatchObject({
      data: { durationMissing: false },
      ariaLabel: "A",
    });
  });

  it("formats Durations in days", () => {
    expect([1, 2, 30].map(formatDuration)).toEqual(["1 day", "2 days", "30 days"]);
  });

  it("does not mutate the project", () => {
    const project = withDependencies(projectWith("A", "B"), [1, 2]);
    const before = structuredClone(project);
    layoutDiagram(project);
    expect(project).toEqual(before);
  });
});

describe("layoutDiagram positions", () => {
  it("sets fixed sizes: Task nodes and START/FINISH nodes", () => {
    const { nodes } = layoutDiagram(projectWith("A"));
    expect(nodeById(nodes, "1")).toMatchObject({ width: TASK_NODE_WIDTH, height: TASK_NODE_HEIGHT });
    for (const id of [START_NODE_ID, FINISH_NODE_ID]) {
      expect(nodeById(nodes, id)).toMatchObject({ width: START_FINISH_NODE_WIDTH, height: START_FINISH_NODE_HEIGHT });
    }
  });

  it("places START left of every Task and FINISH right of every Task", () => {
    const { nodes } = layoutDiagram(createPerfProject());
    const start = rectOf(nodeById(nodes, START_NODE_ID));
    const finish = rectOf(nodeById(nodes, FINISH_NODE_ID));
    for (const node of nodes.filter((candidate) => candidate.type === "task")) {
      const task = rectOf(node);
      expect(start.right).toBeLessThan(task.left);
      expect(task.right).toBeLessThan(finish.left);
    }
  });

  it("positions nodes by their top-left corner, not by dagre's centre", () => {
    // START → 1 → FINISH is one straight row, so dagre gives all three the same
    // centre y. Their heights differ, so only a top-left position (centre minus
    // half the size) puts their tops at different y values.
    const { nodes } = layoutDiagram(projectWith("A"));
    const centreY = (node: DiagramNode) => node.position.y + (node.height ?? 0) / 2;
    const start = nodeById(nodes, START_NODE_ID);
    const task = nodeById(nodes, "1");
    const finish = nodeById(nodes, FINISH_NODE_ID);

    expect(centreY(task)).toBe(centreY(start));
    expect(centreY(finish)).toBe(centreY(start));
    expect(start.position.y - task.position.y).toBe((TASK_NODE_HEIGHT - START_FINISH_NODE_HEIGHT) / 2);
    // Horizontally, ranks are RANK_SEPARATION apart edge to edge; a centre
    // position would widen the gap by half the difference in width.
    expect(task.position.x - (start.position.x + START_FINISH_NODE_WIDTH)).toBe(RANK_SEPARATION);
  });

  it("lays out the 100-Task fixture without overlapping node rectangles", () => {
    const project = createPerfProject();
    expect(project.tasks).toHaveLength(100);

    const rects = layoutDiagram(project).nodes.map(rectOf);
    for (const rect of rects) {
      expect(Number.isFinite(rect.left) && Number.isFinite(rect.top)).toBe(true);
    }
    const overlapping: [number, number][] = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (overlap(rects[i], rects[j])) overlapping.push([i, j]);
      }
    }
    expect(overlapping).toEqual([]);
  });
});

describe("createPerfProject", () => {
  it("builds the requested number of Tasks with branches, joins and Tasks feeding FINISH", () => {
    const project = createPerfProject();
    expect(project.tasks.map((task) => task.id)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));

    const { edges } = layoutDiagram(project);
    const outDegree = new Map<string, number>();
    for (const edge of edges) outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);

    expect(project.tasks.some((task) => task.predecessors.length > 1)).toBe(true);
    expect([...outDegree].some(([source, count]) => source !== START_NODE_ID && count > 1)).toBe(true);
    expect(edges.filter((edge) => edge.target === FINISH_NODE_ID).length).toBeGreaterThan(1);
  });

  it("is deterministic", () => {
    expect(createPerfProject()).toEqual(createPerfProject());
    expect(createPerfProject(7).tasks).toHaveLength(7);
  });

  it("gives every Task a Duration, so the fixture forecasts", () => {
    expect(createPerfProject().tasks.every((task) => task.duration !== undefined)).toBe(true);
  });
});
