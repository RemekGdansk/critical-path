import { describe, expect, it } from "vitest";

import { createPerfProject } from "@/lib/services/fixtures";
import { cyclePathFor, findCycle, predecessorCandidates, successorsOf } from "@/lib/services/task-graph";
import type { Project, TaskId } from "@/types";

/** Builds a project from `[id, predecessors]` pairs; Task names are "T<id>". */
function projectOf(tasks: [TaskId, TaskId[]][]): Project {
  return {
    start: {},
    finish: {},
    dayCountingMode: "calendar-days",
    nextTaskId: Math.max(0, ...tasks.map(([id]) => id)) + 1,
    tasks: tasks.map(([id, predecessors]) => ({ id, name: `T${id}`, predecessors, status: "to-do" })),
  };
}

/** The project with `predecessorId` added to the predecessors of `taskId`, unchecked. */
function withEdge(project: Project, taskId: TaskId, predecessorId: TaskId): Project {
  return {
    ...project,
    tasks: project.tasks.map((task) =>
      task.id === taskId
        ? { ...task, predecessors: [...task.predecessors, predecessorId].toSorted((a, b) => a - b) }
        : task,
    ),
  };
}

// Diamond: 1 → 2, 1 → 3, 2 → 4, 3 → 4; Task 5 is unrelated.
const diamond = projectOf([
  [1, []],
  [2, [1]],
  [3, [1]],
  [4, [2, 3]],
  [5, []],
]);

describe("cyclePathFor", () => {
  it("closes a Task on itself", () => {
    expect(cyclePathFor(diamond, 2, 2)).toEqual([2, 2]);
  });

  it("names the path when the predecessor directly depends on the Task", () => {
    expect(cyclePathFor(diamond, 1, 2)).toEqual([1, 2, 1]);
  });

  it("names the lowest-id path of two equal-length paths", () => {
    expect(cyclePathFor(diamond, 1, 4)).toEqual([1, 2, 4, 1]);
  });

  it("names a shorter path over a longer one with lower ids", () => {
    // 1 → 9 → 3 beside 1 → 2 → 5 → 3.
    const project = projectOf([
      [1, []],
      [2, [1]],
      [3, [5, 9]],
      [5, [2]],
      [9, [1]],
    ]);
    expect(cyclePathFor(project, 1, 3)).toEqual([1, 9, 3, 1]);
  });

  it("is undefined for an ancestor, a sibling and an unrelated Task", () => {
    expect(cyclePathFor(diamond, 4, 1)).toBeUndefined();
    expect(cyclePathFor(diamond, 2, 3)).toBeUndefined();
    expect(cyclePathFor(diamond, 3, 2)).toBeUndefined();
    expect(cyclePathFor(diamond, 4, 5)).toBeUndefined();
    expect(cyclePathFor(diamond, 5, 4)).toBeUndefined();
  });

  it("terminates on a dangling predecessor id and on a graph that already holds a cycle", () => {
    // Neither state can come from the edit functions, but an imported file can hold them.
    const dangling = projectOf([
      [1, [99]],
      [2, []],
    ]);
    expect(cyclePathFor(dangling, 2, 1)).toBeUndefined();
    expect(cyclePathFor(dangling, 1, 2)).toBeUndefined();
    const cyclic = projectOf([
      [1, [2]],
      [2, [1]],
      [3, []],
    ]);
    expect(cyclePathFor(cyclic, 3, 1)).toBeUndefined();
    expect(cyclePathFor(cyclic, 1, 2)).toEqual([1, 2, 1]);
  });
});

describe("findCycle", () => {
  it("is undefined for an acyclic project", () => {
    expect(findCycle(diamond)).toBeUndefined();
  });

  it("rotates the cycle to start and end at its lowest id", () => {
    // 1 → 3 → 2 → 3: the search enters the cycle at 3.
    const project = projectOf([
      [1, []],
      [2, [3]],
      [3, [1, 2]],
    ]);
    expect(findCycle(project)).toEqual([2, 3, 2]);
  });

  it("returns a Task that is its own predecessor", () => {
    const project = projectOf([
      [1, []],
      [2, [2]],
    ]);
    expect(findCycle(project)).toEqual([2, 2]);
  });

  it("returns the cycle the ascending-id search closes first", () => {
    // 1 → 4 ⇄ 5 is reached from Task 1, before 2 ⇄ 3.
    const project = projectOf([
      [1, []],
      [2, [3]],
      [3, [2]],
      [4, [1, 5]],
      [5, [4]],
    ]);
    expect(findCycle(project)).toEqual([4, 5, 4]);
  });

  it("ignores a dangling predecessor id", () => {
    expect(
      findCycle(
        projectOf([
          [1, [99]],
          [2, [1]],
        ]),
      ),
    ).toBeUndefined();
    expect(
      findCycle(
        projectOf([
          [1, [2, 99]],
          [2, [1]],
        ]),
      ),
    ).toEqual([1, 2, 1]);
  });
});

describe("predecessorCandidates", () => {
  const flags = (project: Project, taskId: TaskId) =>
    predecessorCandidates(project, taskId).map((candidate) => [candidate.task.id, candidate.closesCycle]);

  it("flags exactly the descendants of the Task", () => {
    expect(flags(diamond, 1)).toEqual([
      [2, true],
      [3, true],
      [4, true],
      [5, false],
    ]);
    expect(flags(diamond, 2)).toEqual([
      [3, false],
      [4, true],
      [5, false],
    ]);
  });

  it("excludes the Task itself and its current predecessors", () => {
    expect(flags(diamond, 4)).toEqual([
      [1, false],
      [5, false],
    ]);
    expect(flags(diamond, 3)).toEqual([
      [2, false],
      [4, true],
      [5, false],
    ]);
  });

  it("returns Tasks in ascending numeric id order", () => {
    // Creation order 10 before 2; a string sort would also put 10 first.
    const project = projectOf([
      [10, []],
      [2, []],
      [7, []],
    ]);
    expect(flags(project, 7)).toEqual([
      [2, false],
      [10, false],
    ]);
  });

  it("is empty for a Task that is not in the project", () => {
    expect(predecessorCandidates(diamond, 99)).toEqual([]);
  });
});

describe("successorsOf", () => {
  it("lists the Tasks that have the Task as a predecessor", () => {
    expect(successorsOf(diamond, 1)).toEqual([2, 3]);
    expect(successorsOf(diamond, 3)).toEqual([4]);
    expect(successorsOf(diamond, 4)).toEqual([]);
  });
});

describe("cycle checks on the 100-Task fixture", () => {
  const project = createPerfProject();
  const ids = project.tasks.map((task) => task.id);

  it("starts acyclic", () => {
    expect(findCycle(project)).toBeUndefined();
  });

  it("agree: the per-edge path exists exactly when the whole-project check finds a cycle", () => {
    for (const task of project.tasks) {
      for (const predecessorId of ids) {
        if (task.predecessors.includes(predecessorId)) continue;
        const extended = withEdge(project, task.id, predecessorId);
        const path = cyclePathFor(project, task.id, predecessorId);
        expect(path !== undefined, `${predecessorId} → ${task.id}`).toBe(findCycle(extended) !== undefined);
        if (path === undefined) continue;

        expect(path[0]).toBe(task.id);
        expect(path.at(-1)).toBe(task.id);
        for (let index = 1; index < path.length; index++) {
          const successor = extended.tasks.find((candidate) => candidate.id === path[index]);
          expect(successor?.predecessors).toContain(path[index - 1]);
        }
      }
    }
  });

  it("agree: a candidate is flagged exactly when the per-edge path exists", () => {
    for (const task of project.tasks) {
      for (const candidate of predecessorCandidates(project, task.id)) {
        expect(candidate.closesCycle, `${candidate.task.id} → ${task.id}`).toBe(
          cyclePathFor(project, task.id, candidate.task.id) !== undefined,
        );
      }
    }
  });
});

describe("graph queries", () => {
  it("leave the input project unmutated", () => {
    const project = projectOf([
      [1, []],
      [2, [1]],
      [3, [1, 2]],
    ]);
    const before = structuredClone(project);
    Object.freeze(project);
    Object.freeze(project.tasks);
    for (const task of project.tasks) {
      Object.freeze(task);
      Object.freeze(task.predecessors);
    }

    cyclePathFor(project, 1, 3);
    findCycle(project);
    predecessorCandidates(project, 1);
    successorsOf(project, 1);

    expect(project).toEqual(before);
  });
});
