import { describe, expect, it } from "vitest";

import {
  addPredecessor,
  createEmptyProject,
  createTask,
  deleteTask,
  type EditResult,
  removePredecessor,
  renameTask,
  TASK_NAME_MAX_LENGTH,
  type ValidationErrorRule,
} from "@/lib/services/project";
import type { Project, TaskId } from "@/types";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Runs an edit on a deep-frozen input (any write throws in strict mode) and
 * checks the input is still deep-equal to a copy taken before the call.
 */
function edit<A extends unknown[]>(
  fn: (project: Project, ...args: A) => EditResult,
  project: Project,
  ...args: A
): EditResult {
  const before = structuredClone(project);
  const result = fn(deepFreeze(project), ...args);
  expect(project).toEqual(before);
  return result;
}

function accepted(result: EditResult): Project {
  if (!result.ok)
    throw new Error(`Expected the edit to be accepted, got ${result.error.rule}: ${result.error.message}`);
  return result.project;
}

function expectRejected(result: EditResult, rule: ValidationErrorRule): void {
  if (result.ok) throw new Error(`Expected the edit to be rejected with ${rule}`);
  expect(result.error.rule).toBe(rule);
  expect(result.error.message).not.toMatch(/invalid|conflict|blocked/i);
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

function predecessorsOf(project: Project, taskId: TaskId): TaskId[] | undefined {
  return project.tasks.find((task) => task.id === taskId)?.predecessors;
}

describe("createEmptyProject", () => {
  it("has no Tasks, starts ids at 1 and counts calendar days", () => {
    expect(createEmptyProject()).toEqual({
      start: {},
      finish: {},
      dayCountingMode: "calendar-days",
      nextTaskId: 1,
      tasks: [],
    });
  });
});

describe("createTask", () => {
  it("trims the name, assigns ids 1, 2, … and increments the counter", () => {
    const first = accepted(edit(createTask, createEmptyProject(), "  Design  "));
    const second = accepted(edit(createTask, first, "Build"));

    expect(second.tasks).toEqual([
      { id: 1, name: "Design", predecessors: [], status: "to-do" },
      { id: 2, name: "Build", predecessors: [], status: "to-do" },
    ]);
    expect(second.nextTaskId).toBe(3);
  });

  it("rejects an empty or whitespace-only name", () => {
    expectRejected(edit(createTask, createEmptyProject(), ""), "task-name-empty");
    expectRejected(edit(createTask, createEmptyProject(), " \t\n "), "task-name-empty");
  });

  it("rejects a name made only of invisible characters as empty", () => {
    expectRejected(edit(createTask, createEmptyProject(), "​​"), "task-name-empty");
    expectRejected(edit(createTask, createEmptyProject(), " ​﻿ "), "task-name-empty");
  });

  it("rejects a name with a line break or other control character", () => {
    for (const name of ["A\nB", "A\tB", "A B", "A\u0000B"]) {
      expectRejected(edit(createTask, createEmptyProject(), name), "task-name-control-character");
    }
  });

  it("accepts an emoji sequence joined by zero-width joiners", () => {
    const name = "👩‍💻 Design";
    expect(accepted(edit(createTask, createEmptyProject(), name)).tasks[0]?.name).toBe(name);
  });

  it("accepts 200 code units and rejects 201", () => {
    expect(TASK_NAME_MAX_LENGTH).toBe(200);
    expect(accepted(edit(createTask, createEmptyProject(), "a".repeat(200))).tasks[0]?.name).toHaveLength(200);
    expectRejected(edit(createTask, createEmptyProject(), "a".repeat(201)), "task-name-too-long");
  });

  it("counts the length after trimming", () => {
    expect(accepted(edit(createTask, createEmptyProject(), `  ${"a".repeat(200)}  `)).tasks[0]?.name).toHaveLength(200);
  });

  it("counts a surrogate pair as 2 code units", () => {
    const at200 = `${"a".repeat(198)}😀`;
    expect(at200).toHaveLength(200);
    expect(accepted(edit(createTask, createEmptyProject(), at200)).tasks[0]?.name).toBe(at200);
    expectRejected(edit(createTask, createEmptyProject(), `${"a".repeat(199)}😀`), "task-name-too-long");
  });

  it("rejects a name with a lone surrogate", () => {
    expectRejected(edit(createTask, createEmptyProject(), "A\uD83D"), "task-name-malformed");
    expectRejected(edit(createTask, createEmptyProject(), "\uDE00B"), "task-name-malformed");
  });

  it("allows duplicate names", () => {
    const project = accepted(edit(createTask, projectWith("Review"), "Review"));
    expect(project.tasks.map((task) => [task.id, task.name])).toEqual([
      [1, "Review"],
      [2, "Review"],
    ]);
  });
});

describe("renameTask", () => {
  it("trims the name and keeps the id and the predecessors of dependents", () => {
    const project = withDependencies(projectWith("A", "B"), [1, 2]);
    const renamed = accepted(edit(renameTask, project, 1, "  Alpha "));

    expect(renamed.tasks).toEqual([
      { id: 1, name: "Alpha", predecessors: [], status: "to-do" },
      { id: 2, name: "B", predecessors: [1], status: "to-do" },
    ]);
    expect(renamed.nextTaskId).toBe(3);
  });

  it("applies the Task name rules", () => {
    const project = projectWith("A");
    expectRejected(edit(renameTask, project, 1, "   "), "task-name-empty");
    expectRejected(edit(renameTask, project, 1, "a".repeat(201)), "task-name-too-long");
    expectRejected(edit(renameTask, project, 1, "A\uD83D"), "task-name-malformed");
    expectRejected(edit(renameTask, project, 1, "A\nB"), "task-name-control-character");
  });

  it("rejects an unknown id", () => {
    expectRejected(edit(renameTask, projectWith("A"), 2, "B"), "unknown-task");
  });
});

describe("deleteTask", () => {
  it("removes the Task and its id from every dependent", () => {
    const project = withDependencies(projectWith("A", "B", "C"), [1, 2], [1, 3], [2, 3]);
    const deleted = accepted(edit(deleteTask, project, 1));

    expect(deleted.tasks.map((task) => task.id)).toEqual([2, 3]);
    expect(predecessorsOf(deleted, 2)).toEqual([]);
    expect(predecessorsOf(deleted, 3)).toEqual([2]);
  });

  it("does not bridge predecessors to successors", () => {
    // A → B → C, delete B.
    const project = withDependencies(projectWith("A", "B", "C"), [1, 2], [2, 3]);
    const deleted = accepted(edit(deleteTask, project, 2));

    expect(predecessorsOf(deleted, 3)).toEqual([]);
    expect(deleted.tasks.some((task) => task.predecessors.includes(1))).toBe(false);
  });

  it("does not reuse the deleted id", () => {
    const deleted = accepted(edit(deleteTask, projectWith("A", "B", "C"), 3));
    expect(deleted.nextTaskId).toBe(4);

    const created = accepted(edit(createTask, deleted, "D"));
    expect(created.tasks.map((task) => task.id)).toEqual([1, 2, 4]);
  });

  it("rejects an unknown id", () => {
    expectRejected(edit(deleteTask, projectWith("A"), 2), "unknown-task");
  });
});

describe("addPredecessor", () => {
  it("rejects a Task as its own predecessor", () => {
    expectRejected(edit(addPredecessor, projectWith("A"), 1, 1), "cycle");
  });

  it("rejects a transitive cycle", () => {
    // A → B → C, add C as predecessor of A.
    const project = withDependencies(projectWith("A", "B", "C"), [1, 2], [2, 3]);
    const result = edit(addPredecessor, project, 1, 3);

    expectRejected(result, "cycle");
    if (!result.ok) expect(result.error.message).toBe("Adding this predecessor would create a cycle.");
  });

  it("returns the project unchanged for an existing predecessor", () => {
    const project = withDependencies(projectWith("A", "B"), [1, 2]);
    expect(accepted(edit(addPredecessor, project, 2, 1))).toEqual(project);
  });

  it("keeps predecessors in ascending id order", () => {
    const project = projectWith("1", "2", "3", "4", "5", "6");
    const withFive = accepted(edit(addPredecessor, project, 6, 5));
    const withTwo = accepted(edit(addPredecessor, withFive, 6, 2));
    expect(predecessorsOf(withTwo, 6)).toEqual([2, 5]);
  });

  it("rejects an unknown Task or predecessor id", () => {
    const project = projectWith("A");
    expectRejected(edit(addPredecessor, project, 2, 1), "unknown-task");
    expectRejected(edit(addPredecessor, project, 1, 2), "unknown-task");
  });
});

describe("removePredecessor", () => {
  it("removes the predecessor", () => {
    const project = withDependencies(projectWith("A", "B", "C"), [1, 3], [2, 3]);
    expect(predecessorsOf(accepted(edit(removePredecessor, project, 3, 1)), 3)).toEqual([2]);
  });

  it("returns the project unchanged for a Task that is not a predecessor", () => {
    const project = withDependencies(projectWith("A", "B", "C"), [1, 3]);
    expect(accepted(edit(removePredecessor, project, 3, 2))).toEqual(project);
    expect(accepted(edit(removePredecessor, project, 3, 99))).toEqual(project);
  });

  it("rejects an unknown Task id", () => {
    expectRejected(edit(removePredecessor, projectWith("A"), 2, 1), "unknown-task");
  });
});
