// The LayoutEngine port's contract, run against the engine the app ships. An
// engine swap reruns this file unchanged.
import { describe, expect, it } from "vitest";

import { layoutEngine } from "@/lib/adapters/layout-engine";
import {
  FINISH_NODE_ID,
  type LaidOutDiagram,
  layoutDiagram,
  NODE_SEPARATION,
  projectDiagram,
  RANK_SEPARATION,
  START_FINISH_NODE_SIZE,
  START_NODE_ID,
  TASK_NODE_SIZE,
} from "@/lib/services/diagram";
import { createPerfProject } from "@/lib/services/fixtures";
import { createEmptyProject, createTask, type EditResult } from "@/lib/services/project";
import type { Project } from "@/types";

type LaidOutNode = LaidOutDiagram["nodes"][number];

function accepted(result: EditResult): Project {
  if (!result.ok)
    throw new Error(`Expected the edit to be accepted, got ${result.error.rule}: ${result.error.message}`);
  return result.project;
}

/** A project with one Task per name, ids 1..n in order. */
function projectWith(...names: string[]): Project {
  return names.reduce((project, name) => accepted(createTask(project, name)), createEmptyProject());
}

function laidOut(project: Project): LaidOutDiagram {
  return layoutDiagram(projectDiagram(project), layoutEngine);
}

function nodeById(nodes: readonly LaidOutNode[], id: string): LaidOutNode {
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

function rectOf(node: LaidOutNode): Rect {
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + node.size.width,
    bottom: node.position.y + node.size.height,
  };
}

function overlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe("layoutEngine", () => {
  it("keeps the fixed node sizes: Task nodes and START/FINISH nodes", () => {
    const { nodes } = laidOut(projectWith("A"));
    expect(nodeById(nodes, "1").size).toEqual(TASK_NODE_SIZE);
    for (const id of [START_NODE_ID, FINISH_NODE_ID]) expect(nodeById(nodes, id).size).toEqual(START_FINISH_NODE_SIZE);
  });

  it("places START left of every Task and FINISH right of every Task", () => {
    const { nodes } = laidOut(createPerfProject());
    const start = rectOf(nodeById(nodes, START_NODE_ID));
    const finish = rectOf(nodeById(nodes, FINISH_NODE_ID));
    for (const node of nodes.filter((candidate) => candidate.kind === "task")) {
      const task = rectOf(node);
      expect(start.right).toBeLessThan(task.left);
      expect(task.right).toBeLessThan(finish.left);
    }
  });

  it("positions nodes by their top-left corner, not by their centre", () => {
    // START → 1 → FINISH is one straight row, so all three share a centre y.
    // Their heights differ, so only a top-left position (centre minus half the
    // size) puts their tops at different y values.
    const { nodes } = laidOut(projectWith("A"));
    const centreY = (node: LaidOutNode) => node.position.y + node.size.height / 2;
    const start = nodeById(nodes, START_NODE_ID);
    const task = nodeById(nodes, "1");
    const finish = nodeById(nodes, FINISH_NODE_ID);

    expect(centreY(task)).toBe(centreY(start));
    expect(centreY(finish)).toBe(centreY(start));
    expect(start.position.y - task.position.y).toBe((TASK_NODE_SIZE.height - START_FINISH_NODE_SIZE.height) / 2);
    // Horizontally, ranks are RANK_SEPARATION apart edge to edge; a centre
    // position would widen the gap by half the difference in width.
    expect(task.position.x - (start.position.x + START_FINISH_NODE_SIZE.width)).toBe(RANK_SEPARATION);
  });

  it("lays out the 100-Task fixture without overlapping node rectangles", () => {
    const project = createPerfProject();
    expect(project.tasks).toHaveLength(100);

    const rects = laidOut(project).nodes.map(rectOf);
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

  it("starts from nothing on every call: a node from an earlier request is never positioned again", () => {
    const separations = { rankSeparation: RANK_SEPARATION, nodeSeparation: NODE_SEPARATION };
    layoutEngine({
      ...separations,
      direction: "left-to-right",
      nodes: [
        { id: "a", width: 10, height: 10 },
        { id: "b", width: 10, height: 10 },
      ],
      edges: [{ source: "a", target: "b" }],
    });
    const placements = layoutEngine({
      ...separations,
      direction: "left-to-right",
      nodes: [{ id: "c", width: 10, height: 10 }],
      edges: [],
    });
    expect([...placements.keys()]).toEqual(["c"]);
  });
});
