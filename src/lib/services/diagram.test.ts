import { describe, expect, it } from "vitest";

import {
  type Diagram,
  type DiagramNode,
  FINISH_NODE_ID,
  type LayoutEngine,
  type LayoutRequest,
  layoutDiagram,
  NODE_SEPARATION,
  projectDiagram,
  RANK_SEPARATION,
  START_FINISH_NODE_SIZE,
  START_NODE_ID,
  type StartDiagramNode,
  startAccessibleName,
  TASK_NODE_SIZE,
  withStartDate,
} from "@/lib/services/diagram";
import { createPerfProject } from "@/lib/services/fixtures";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  deleteTask,
  type EditContext,
  type EditResult,
  setCompletionDate,
  setDuration,
  setStatus,
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

/** Adds `predecessorId → taskId` for each pair. */
function withDependencies(project: CheckedProject, ...pairs: [TaskId, TaskId][]): CheckedProject {
  return pairs.reduce(
    (current, [predecessorId, taskId]) => accepted(addPredecessor(current, taskId, predecessorId, CONTEXT)),
    project,
  );
}

function edgeIds(project: Project): string[] {
  return projectDiagram(project)
    .edges.map((edge) => edge.id)
    .toSorted();
}

/** Each edge as `[id, kind]`, in the order the Diagram lists them. */
function edgeKinds(project: Project): [string, string][] {
  return projectDiagram(project).edges.map((edge) => [edge.id, edge.kind]);
}

function nodeById(nodes: readonly DiagramNode[], id: string): DiagramNode {
  const node = nodes.find((candidate) => candidate.id === id);
  if (node === undefined) throw new Error(`No node "${id}" in the diagram`);
  return node;
}

function startNodeOf(diagram: Diagram): StartDiagramNode {
  const node = nodeById(diagram.nodes, START_NODE_ID);
  if (node.kind !== "start") throw new Error(`Node "${START_NODE_ID}" is a ${node.kind} node`);
  return node;
}

describe("projectDiagram", () => {
  it("draws an empty project as START and FINISH joined by one edge, which feeds FINISH", () => {
    const { nodes, edges } = projectDiagram(createEmptyProject(CONTEXT));
    expect(nodes.map((node) => [node.id, node.kind])).toEqual([
      [START_NODE_ID, "start"],
      [FINISH_NODE_ID, "finish"],
    ]);
    // With no Task, START itself has no successor, so it feeds FINISH.
    // With no Task there is no critical path, so the one edge is never critical.
    expect(edges).toEqual([
      { id: "start->finish", source: "start", target: "finish", kind: "feeds-finish", critical: false },
    ]);
  });

  it("hangs a lone Task off START and feeds it to FINISH", () => {
    const { nodes } = projectDiagram(projectWith("Design"));
    expect(nodeById(nodes, "1")).toMatchObject({ kind: "task", name: "Design", taskId: 1, durationMissing: true });
    expect(edgeKinds(projectWith("Design"))).toEqual([
      ["start->1", "hangs-off-start"],
      ["1->finish", "feeds-finish"],
    ]);
  });

  it("gives START only the Tasks without predecessors and FINISH only the Tasks without successors", () => {
    const project = withDependencies(projectWith("A", "B"), [1, 2]);
    expect(edgeIds(project)).toEqual(["1->2", "2->finish", "start->1"]);
    expect(edgeKinds(project)).toContainEqual(["1->2", "dependency"]);
  });

  it("draws a join once per predecessor and a branch once per successor", () => {
    // 1 → 2, 1 → 3, 2 → 4, 3 → 4
    const project = withDependencies(projectWith("A", "B", "C", "D"), [1, 2], [1, 3], [2, 4], [3, 4]);
    expect(edgeIds(project)).toEqual(["1->2", "1->3", "2->4", "3->4", "4->finish", "start->1"]);
  });

  it("lists nodes as START, Tasks in creation order, FINISH, and edges Task by Task before the FINISH edges", () => {
    // The layout engine's result can depend on this order, so it is part of the contract.
    const project = withDependencies(projectWith("A", "B", "C", "D"), [1, 2], [1, 3], [2, 4], [3, 4]);
    const { nodes } = projectDiagram(project);
    expect(nodes.map((node) => node.id)).toEqual([START_NODE_ID, "1", "2", "3", "4", FINISH_NODE_ID]);
    expect(edgeKinds(project)).toEqual([
      ["start->1", "hangs-off-start"],
      ["1->2", "dependency"],
      ["1->3", "dependency"],
      ["2->4", "dependency"],
      ["3->4", "dependency"],
      ["4->finish", "feeds-finish"],
    ]);
  });

  it("has one node per Task plus START and FINISH, and no edge to a deleted Task", () => {
    const project = withDependencies(projectWith("A", "B", "C"), [1, 2], [2, 3]);
    const afterDelete = accepted(deleteTask(project, 2, CONTEXT));
    const { nodes, edges } = projectDiagram(afterDelete);

    expect(nodes).toHaveLength(afterDelete.tasks.length + 2);
    const nodeIds = new Set(nodes.map((node) => node.id));
    expect(nodeIds.has("2")).toBe(false);
    for (const edge of edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
    // Deleting 2 leaves 1 and 3 without dependencies: each hangs off START and feeds FINISH.
    expect(edgeIds(afterDelete)).toEqual(["1->finish", "3->finish", "start->1", "start->3"]);
  });

  it("gives every edge the id <source>-><target> and the same Diagram on every call", () => {
    const project = createPerfProject(CONTEXT, 30);
    const { edges } = projectDiagram(project);
    for (const edge of edges) expect(edge.id).toBe(`${edge.source}->${edge.target}`);
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
    expect(projectDiagram(project)).toEqual(projectDiagram(project));
  });

  it("makes START and every Task editable, and only FINISH not", () => {
    const { nodes } = projectDiagram(projectWith("A", "B"));
    expect(nodes.filter((node) => !node.editable).map((node) => node.id)).toEqual([FINISH_NODE_ID]);
  });

  it("sizes Task nodes and START/FINISH nodes", () => {
    const { nodes } = projectDiagram(projectWith("A"));
    expect(nodeById(nodes, "1").size).toEqual(TASK_NODE_SIZE);
    for (const id of [START_NODE_ID, FINISH_NODE_ID]) expect(nodeById(nodes, id).size).toEqual(START_FINISH_NODE_SIZE);
  });

  it("leaves the START date out and names START for today", () => {
    const project = { ...createEmptyProject(CONTEXT), start: { date: "2030-01-07" } };
    const start = startNodeOf(projectDiagram(project));
    expect(start).not.toHaveProperty("date");
    expect(start.accessibleName).toBe("START, today");
  });

  it("carries the Duration as text, or flags its absence as a Validation Warning, in the node and its accessible name", () => {
    const project = accepted(
      setDuration(accepted(setDuration(projectWith("A", "B", "C"), 1, "5", CONTEXT)), 2, "1", CONTEXT),
    );
    const { nodes } = projectDiagram(project);

    expect(nodeById(nodes, "1")).toMatchObject({
      durationText: "5 days",
      durationMissing: false,
      accessibleName: "A, 5 days",
    });
    expect(nodeById(nodes, "2")).toMatchObject({
      durationText: "1 day",
      durationMissing: false,
      accessibleName: "B, 1 day",
    });
    expect(nodeById(nodes, "3")).toMatchObject({
      durationMissing: true,
      accessibleName: "C, no Duration (Validation Warning)",
    });
    expect(nodeById(nodes, "3")).not.toHaveProperty("durationText");
  });

  it("raises no warning on a Done Task without a Duration", () => {
    const done = accepted(setStatus(projectWith("A"), 1, "done", CONTEXT));
    const project = accepted(setCompletionDate(done, 1, "2026-09-03", CONTEXT));
    const node = nodeById(projectDiagram(project).nodes, "1");
    expect(node).toMatchObject({ durationMissing: false, accessibleName: "A" });
    expect(node).not.toHaveProperty("durationText");
  });

  it("shows the weekday unit in the Duration text and accessible name in weekdays mode", () => {
    const project = accepted(
      setDuration(accepted(setDuration(projectWith("A", "B"), 1, "5", CONTEXT)), 2, "1", CONTEXT),
    );
    const { nodes } = projectDiagram({ ...project, dayCountingMode: "weekdays" });

    // A (5) and B (1) are independent: A alone is the longest chain.
    expect(nodeById(nodes, "1")).toMatchObject({
      durationText: "5 weekdays",
      accessibleName: "A, 5 weekdays, on the critical path",
    });
    expect(nodeById(nodes, "2")).toMatchObject({ durationText: "1 weekday", accessibleName: "B, 1 weekday" });
  });

  it("does not mutate the project", () => {
    const project = withDependencies(projectWith("A", "B"), [1, 2]);
    const before = structuredClone(project);
    projectDiagram(project);
    expect(project).toEqual(before);
  });
});

/** A project with one Task per [name, Duration] pair, ids 1..n; an empty Duration leaves it unset. */
function projectWithDurations(...tasks: [string, string][]): CheckedProject {
  return tasks.reduce((current, [name, duration]) => {
    const created = accepted(createTask(current, name, CONTEXT));
    return accepted(setDuration(created, created.nextTaskId - 1, duration, CONTEXT));
  }, createEmptyProject(CONTEXT));
}

/** Each edge as `[id, critical]`, in the order the Diagram lists them. */
function edgeCriticality(project: Project): [string, boolean][] {
  return projectDiagram(project).edges.map((edge) => [edge.id, edge.critical]);
}

/** Each Task node as `[id, critical]`, in the order the Diagram lists them. */
function taskCriticality(project: Project): [string, boolean][] {
  return projectDiagram(project).nodes.flatMap((node) => (node.kind === "task" ? [[node.id, node.critical]] : []));
}

// Expected flags are derived by hand: a Task starts when its last predecessor
// finishes, and the longest chains of remaining work are critical.
describe("critical path", () => {
  it("marks the critical Tasks, the START and FINISH edges of the longest chain, and only the links on it", () => {
    // A (3) → B (1) → C (3) plus A → C: A 0–3, B 3–4, C 4–7. A → C joins two
    // critical Tasks, but C starts on day 4, after B, not when A finishes.
    const project = withDependencies(projectWithDurations(["A", "3"], ["B", "1"], ["C", "3"]), [1, 2], [2, 3], [1, 3]);
    expect(taskCriticality(project)).toEqual([
      ["1", true],
      ["2", true],
      ["3", true],
    ]);
    expect(edgeCriticality(project)).toEqual([
      ["start->1", true],
      ["1->2", true],
      ["1->3", false],
      ["2->3", true],
      ["3->finish", true],
    ]);
  });

  it("marks both of two equal-length branches end to end, and leaves a shorter branch out", () => {
    // A (2) → B (3) and C (4) → D (1): both 5 days. E (1) alone: 1 day.
    const project = withDependencies(
      projectWithDurations(["A", "2"], ["B", "3"], ["C", "4"], ["D", "1"], ["E", "1"]),
      [1, 2],
      [3, 4],
    );
    expect(taskCriticality(project)).toEqual([
      ["1", true],
      ["2", true],
      ["3", true],
      ["4", true],
      ["5", false],
    ]);
    expect(edgeCriticality(project)).toEqual([
      ["start->1", true],
      ["1->2", true],
      ["start->3", true],
      ["3->4", true],
      ["start->5", false],
      ["2->finish", true],
      ["4->finish", true],
      ["5->finish", false],
    ]);
  });

  it("marks nothing while a Validation Warning exists", () => {
    // A (5) → B without a Duration: the schedule is withheld, so no longest chain is known.
    const project = withDependencies(projectWithDurations(["A", "5"], ["B", ""], ["C", "3"]), [1, 2]);
    const { nodes, edges } = projectDiagram(project);
    for (const node of nodes) if (node.kind === "task") expect(node.critical).toBe(false);
    for (const edge of edges) expect(edge.critical).toBe(false);
    expect(nodeById(nodes, "1").accessibleName).toBe("A, 5 days");
    expect(nodeById(nodes, "2").accessibleName).toBe("B, no Duration (Validation Warning)");
  });

  it("ends a critical Task's accessible name with ', on the critical path', and leaves the others as they are", () => {
    // A (5) → B (3): 8 days; C (1) alone.
    const project = withDependencies(projectWithDurations(["A", "5"], ["B", "3"], ["C", "1"]), [1, 2]);
    const { nodes } = projectDiagram(project);
    expect(nodeById(nodes, "1").accessibleName).toBe("A, 5 days, on the critical path");
    expect(nodeById(nodes, "2").accessibleName).toBe("B, 3 days, on the critical path");
    expect(nodeById(nodes, "3").accessibleName).toBe("C, 1 day");
  });

  it("never marks a Done Task or an edge from it", () => {
    // A (5) Done → B (3): only B remains.
    let project = withDependencies(projectWithDurations(["A", "5"], ["B", "3"]), [1, 2]);
    project = accepted(setStatus(project, 1, "done", CONTEXT));
    project = accepted(setCompletionDate(project, 1, "2026-09-03", CONTEXT));
    expect(taskCriticality(project)).toEqual([
      ["1", false],
      ["2", true],
    ]);
    expect(edgeCriticality(project)).toEqual([
      ["start->1", false],
      ["1->2", false],
      ["2->finish", true],
    ]);
  });
});

describe("START date", () => {
  it("names START by its date, or for today when it has none", () => {
    expect(startAccessibleName("2030-01-07")).toBe("START, 2030-01-07");
    expect(startAccessibleName(undefined)).toBe("START, today");
  });

  it("adds the START date and its accessible name to the START node, and nothing else", () => {
    const start = startNodeOf(projectDiagram(createEmptyProject(CONTEXT)));
    const before = structuredClone(start);

    expect(withStartDate(start, "2030-01-07")).toEqual({
      ...start,
      date: "2030-01-07",
      accessibleName: "START, 2030-01-07",
    });
    expect(start).toEqual(before);
  });

  it("drops the START date when it is cleared", () => {
    const dated = withStartDate(startNodeOf(projectDiagram(createEmptyProject(CONTEXT))), "2030-01-07");
    const cleared = withStartDate(dated, undefined);

    expect(cleared).not.toHaveProperty("date");
    expect(cleared.accessibleName).toBe("START, today");
  });
});

describe("layoutDiagram", () => {
  /** A fake engine that puts node i at column i of one row and records what it was asked. */
  function gridEngine(): { engine: LayoutEngine; requests: LayoutRequest[] } {
    const requests: LayoutRequest[] = [];
    const engine: LayoutEngine = (request) => {
      requests.push(request);
      return new Map(request.nodes.map((node, index) => [node.id, { x: index * 200, y: 0 }]));
    };
    return { engine, requests };
  }

  it("sends the engine every node's id and size and every edge, in Diagram order", () => {
    const diagram = projectDiagram(withDependencies(projectWith("A", "B"), [1, 2]));
    const { engine, requests } = gridEngine();
    layoutDiagram(diagram, engine);

    expect(requests).toEqual([
      {
        nodes: [
          { id: START_NODE_ID, ...START_FINISH_NODE_SIZE },
          { id: "1", ...TASK_NODE_SIZE },
          { id: "2", ...TASK_NODE_SIZE },
          { id: FINISH_NODE_ID, ...START_FINISH_NODE_SIZE },
        ],
        edges: [
          { source: START_NODE_ID, target: "1" },
          { source: "1", target: "2" },
          { source: "2", target: FINISH_NODE_ID },
        ],
        direction: "left-to-right",
        rankSeparation: RANK_SEPARATION,
        nodeSeparation: NODE_SEPARATION,
      },
    ]);
  });

  it("gives every node the engine's position and keeps the Diagram's nodes and edges as they are", () => {
    const diagram = projectDiagram(withDependencies(projectWith("A", "B"), [1, 2]));
    const laidOut = layoutDiagram(diagram, gridEngine().engine);

    expect(laidOut.nodes).toEqual(
      diagram.nodes.map((node, index) => ({ ...node, position: { x: index * 200, y: 0 } })),
    );
    expect(laidOut.edges).toEqual(diagram.edges);
  });

  it("refuses a result that misses a node", () => {
    const diagram = projectDiagram(projectWith("A"));
    const forgetsFinish: LayoutEngine = (request) =>
      new Map(request.nodes.filter((node) => node.id !== FINISH_NODE_ID).map((node) => [node.id, { x: 0, y: 0 }]));

    expect(() => layoutDiagram(diagram, forgetsFinish)).toThrow('The layout engine did not position node "finish".');
  });
});

describe("createPerfProject", () => {
  it("builds the requested number of Tasks with branches, joins and Tasks feeding FINISH", () => {
    const project = createPerfProject(CONTEXT);
    expect(project.tasks.map((task) => task.id)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));

    const { edges } = projectDiagram(project);
    const outDegree = new Map<string, number>();
    for (const edge of edges) outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);

    expect(project.tasks.some((task) => task.predecessors.length > 1)).toBe(true);
    expect([...outDegree].some(([source, count]) => source !== START_NODE_ID && count > 1)).toBe(true);
    expect(edges.filter((edge) => edge.kind === "feeds-finish").length).toBeGreaterThan(1);
  });

  it("is deterministic", () => {
    expect(createPerfProject(CONTEXT)).toEqual(createPerfProject(CONTEXT));
    expect(createPerfProject(CONTEXT, 7).tasks).toHaveLength(7);
  });

  it("gives every Task a Duration, so the fixture forecasts", () => {
    expect(createPerfProject(CONTEXT).tasks.every((task) => task.duration !== undefined)).toBe(true);
  });
});
