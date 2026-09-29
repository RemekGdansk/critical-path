import { describe, expect, it } from "vitest";

import { eligiblePredecessors, successorsOf, wouldCreateCycle } from "@/lib/services/task-graph";
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

// Diamond: 1 → 2, 1 → 3, 2 → 4, 3 → 4; Task 5 is unrelated.
const diamond = projectOf([
  [1, []],
  [2, [1]],
  [3, [1]],
  [4, [2, 3]],
  [5, []],
]);

describe("wouldCreateCycle", () => {
  it("is true for a Task as its own predecessor", () => {
    expect(wouldCreateCycle(diamond, 2, 2)).toBe(true);
  });

  it("is true when the predecessor directly depends on the Task", () => {
    expect(wouldCreateCycle(diamond, 1, 2)).toBe(true);
  });

  it("is true when the predecessor transitively depends on the Task", () => {
    expect(wouldCreateCycle(diamond, 1, 4)).toBe(true);
  });

  it("is false for an ancestor, a sibling and an unrelated Task", () => {
    expect(wouldCreateCycle(diamond, 4, 1)).toBe(false);
    expect(wouldCreateCycle(diamond, 2, 3)).toBe(false);
    expect(wouldCreateCycle(diamond, 3, 2)).toBe(false);
    expect(wouldCreateCycle(diamond, 4, 5)).toBe(false);
    expect(wouldCreateCycle(diamond, 5, 4)).toBe(false);
  });
});

describe("eligiblePredecessors", () => {
  const ids = (project: Project, taskId: TaskId) => eligiblePredecessors(project, taskId).map((task) => task.id);

  it("excludes the Task itself and all its descendants", () => {
    expect(ids(diamond, 1)).toEqual([5]);
    expect(ids(diamond, 2)).toEqual([3, 5]);
  });

  it("excludes existing predecessors", () => {
    expect(ids(diamond, 4)).toEqual([1, 5]);
    expect(ids(diamond, 3)).toEqual([2, 5]);
  });

  it("returns Tasks in ascending numeric id order", () => {
    // Creation order 10 before 2; a string sort would also put 10 first.
    const project = projectOf([
      [10, []],
      [2, []],
      [7, []],
    ]);
    expect(ids(project, 7)).toEqual([2, 10]);
  });

  it("is empty for a Task that is not in the project", () => {
    expect(ids(diamond, 99)).toEqual([]);
  });
});

describe("successorsOf", () => {
  it("lists the Tasks that have the Task as a predecessor", () => {
    expect(successorsOf(diamond, 1)).toEqual([2, 3]);
    expect(successorsOf(diamond, 3)).toEqual([4]);
    expect(successorsOf(diamond, 4)).toEqual([]);
  });
});
