import { describe, expect, it } from "vitest";

import { createPerfProject } from "@/lib/services/fixtures";
import {
  addPredecessor,
  type CheckedProject,
  checkProject,
  completionDateNotADate,
  createEmptyProject,
  createTask,
  deleteTask,
  type EditContext,
  type EditResult,
  isPositiveWholeDays,
  PROJECT_NAME_MAX_LENGTH,
  ProjectInvariantBreach,
  removePredecessor,
  renameTask,
  setCompletionDate,
  setDayCountingMode,
  setDuration,
  setProjectName,
  setStartDate,
  setStatus,
  startDateNotADate,
  TASK_NAME_MAX_LENGTH,
  TASK_STATUSES,
  taskLabel,
  taskStatusName,
  toCheckedProject,
  validateProject,
  type ValidationErrorRule,
} from "@/lib/services/project";
import type { Project, Task, TaskId } from "@/types";

const TODAY = "2026-09-05";
const CONTEXT: EditContext = { today: TODAY };

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Runs an edit on a deep-frozen input (any write throws in strict mode) and
 * checks the input is still deep-equal to a copy taken before the call. The
 * edit gets the file's fixed `CONTEXT` as its last argument.
 */
function edit<A extends unknown[]>(
  fn: (project: CheckedProject, ...args: [...A, EditContext]) => EditResult,
  project: CheckedProject,
  ...args: A
): EditResult {
  return editOn(CONTEXT, fn, project, ...args);
}

/** `edit` with another context, for a rule that needs a different today. */
function editOn<A extends unknown[]>(
  context: EditContext,
  fn: (project: CheckedProject, ...args: [...A, EditContext]) => EditResult,
  project: CheckedProject,
  ...args: A
): EditResult {
  const before = structuredClone(project);
  const result = fn(deepFreeze(project), ...args, context);
  expect(project).toEqual(before);
  return result;
}

function accepted(result: EditResult): CheckedProject {
  if (!result.ok)
    throw new Error(`Expected the edit to be accepted, got ${result.error.rule}: ${result.error.message}`);
  return result.project;
}

function expectRejected(result: EditResult, rule: ValidationErrorRule): void {
  if (result.ok) throw new Error(`Expected the edit to be rejected with ${rule}`);
  expect(result.error.rule).toBe(rule);
  expect(result.error.message).not.toMatch(/invalid|conflict|blocked/i);
}

/** Rejected with `rule` and exactly `message`. */
function expectRejectedWith(result: EditResult, rule: ValidationErrorRule, message: string): void {
  expectRejected(result, rule);
  if (!result.ok) expect(result.error.message).toBe(message);
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

function predecessorsOf(project: Project, taskId: TaskId): TaskId[] | undefined {
  return project.tasks.find((task) => task.id === taskId)?.predecessors;
}

/** A to-do Task literal, built by hand so it can hold values that break a Validation Error rule. */
function task(id: TaskId, name: string, predecessors: TaskId[] = [], extra: Partial<Task> = {}): Task {
  return { id, name, predecessors, status: "to-do", ...extra };
}

/** The `extra` of a hand-built Done Task, with its completion date when given. */
function done(completionDate?: string): Partial<Task> {
  return { status: "done", ...(completionDate === undefined ? {} : { completionDate }) };
}

/**
 * START 2026-09-01, A → B, built through the edits: A Done on `aDone` and B Done
 * on `bDone` when given, To Do otherwise. Completion dates must fall between the
 * START date and TODAY.
 */
function aThenB(aDone?: string, bDone?: string): CheckedProject {
  let project = withDependencies(projectWith("A", "B"), [1, 2]);
  project = accepted(setStartDate(project, "2026-09-01", CONTEXT));
  for (const [taskId, completionDate] of [
    [1, aDone],
    [2, bDone],
  ] as const) {
    if (completionDate === undefined) continue;
    project = accepted(setStatus(project, taskId, "done", CONTEXT));
    project = accepted(setCompletionDate(project, taskId, completionDate, CONTEXT));
  }
  return project;
}

/** A hand-built project literal with `nextTaskId` above every id. */
function projectOf(tasks: Task[], extra: Partial<Project> = {}): Project {
  const nextTaskId = Math.max(0, ...tasks.map((t) => t.id)) + 1;
  return { start: {}, finish: {}, dayCountingMode: "calendar-days", nextTaskId, tasks, ...extra };
}

describe("createEmptyProject", () => {
  it("has no Tasks, starts ids at 1 and counts calendar days", () => {
    expect(createEmptyProject(CONTEXT)).toEqual({
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
    const first = accepted(edit(createTask, createEmptyProject(CONTEXT), "  Design  "));
    const second = accepted(edit(createTask, first, "Build"));

    expect(second.tasks).toEqual([
      { id: 1, name: "Design", predecessors: [], status: "to-do" },
      { id: 2, name: "Build", predecessors: [], status: "to-do" },
    ]);
    expect(second.nextTaskId).toBe(3);
  });

  it("rejects an empty or whitespace-only name", () => {
    expectRejected(edit(createTask, createEmptyProject(CONTEXT), ""), "task-name-empty");
    expectRejected(edit(createTask, createEmptyProject(CONTEXT), " \t\n "), "task-name-empty");
  });

  it("rejects a name made only of invisible characters as empty", () => {
    expectRejected(edit(createTask, createEmptyProject(CONTEXT), "\u200B\u200B"), "task-name-empty");
    expectRejected(edit(createTask, createEmptyProject(CONTEXT), " \u200B\uFEFF "), "task-name-empty");
  });

  it("rejects a name with a line break or other control character", () => {
    for (const name of ["A\nB", "A\tB", "A\u2028B", "A\u0000B"]) {
      expectRejected(edit(createTask, createEmptyProject(CONTEXT), name), "task-name-control-character");
    }
  });

  it("accepts an emoji sequence joined by zero-width joiners", () => {
    const name = "👩‍💻 Design";
    expect(accepted(edit(createTask, createEmptyProject(CONTEXT), name)).tasks[0]?.name).toBe(name);
  });

  it("accepts 200 code units and rejects 201", () => {
    expect(TASK_NAME_MAX_LENGTH).toBe(200);
    expect(accepted(edit(createTask, createEmptyProject(CONTEXT), "a".repeat(200))).tasks[0]?.name).toHaveLength(200);
    expectRejected(edit(createTask, createEmptyProject(CONTEXT), "a".repeat(201)), "task-name-too-long");
  });

  it("counts the length after trimming", () => {
    expect(
      accepted(edit(createTask, createEmptyProject(CONTEXT), `  ${"a".repeat(200)}  `)).tasks[0]?.name,
    ).toHaveLength(200);
  });

  it("counts a surrogate pair as 2 code units", () => {
    const at200 = `${"a".repeat(198)}😀`;
    expect(at200).toHaveLength(200);
    expect(accepted(edit(createTask, createEmptyProject(CONTEXT), at200)).tasks[0]?.name).toBe(at200);
    expectRejected(edit(createTask, createEmptyProject(CONTEXT), `${"a".repeat(199)}😀`), "task-name-too-long");
  });

  it("rejects a name with a lone surrogate", () => {
    const result = edit(createTask, createEmptyProject(CONTEXT), "A\uD83D");
    expectRejected(result, "task-name-malformed");
    if (!result.ok) expect(result.error.message).toBe("A Task name must be well-formed Unicode.");
    expectRejected(edit(createTask, createEmptyProject(CONTEXT), "\uDE00B"), "task-name-malformed");
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
  it("rejects a Task as its own predecessor and names the cycle", () => {
    const result = edit(addPredecessor, projectWith("A"), 1, 1);

    expectRejected(result, "cycle");
    if (!result.ok) {
      expect(result.error.message).toBe("Adding 1: A as a predecessor of 1: A would create the cycle 1: A → 1: A.");
    }
  });

  it("rejects a transitive cycle and names it", () => {
    // A → B → C, add C as predecessor of A.
    const project = withDependencies(projectWith("A", "B", "C"), [1, 2], [2, 3]);
    const result = edit(addPredecessor, project, 1, 3);

    expectRejected(result, "cycle");
    if (!result.ok) {
      expect(result.error.message).toBe(
        "Adding 3: C as a predecessor of 1: A would create the cycle 1: A → 2: B → 3: C → 1: A.",
      );
    }
  });

  it("tells apart same-named Tasks in the cycle by their ids", () => {
    // Review → Review, add the second as predecessor of the first.
    const project = withDependencies(projectWith("Review", "Review"), [1, 2]);
    const result = edit(addPredecessor, project, 1, 2);

    expectRejected(result, "cycle");
    if (!result.ok) {
      expect(result.error.message).toBe(
        "Adding 2: Review as a predecessor of 1: Review would create the cycle 1: Review → 2: Review → 1: Review.",
      );
    }
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

describe("taskLabel", () => {
  it("prefixes the name with the id", () => {
    expect(taskLabel({ id: 7, name: "Name", predecessors: [], status: "to-do" })).toBe("7: Name");
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

describe("setDuration", () => {
  it("sets a positive whole number of days, trimmed, leading zeros allowed", () => {
    const project = projectWith("A");
    expect(accepted(edit(setDuration, project, 1, " 5 ")).tasks[0]?.duration).toBe(5);
    expect(accepted(edit(setDuration, project, 1, "05")).tasks[0]?.duration).toBe(5);
  });

  it("clears the Duration on empty input by removing the field", () => {
    const project = accepted(setDuration(projectWith("A"), 1, "5", CONTEXT));
    const cleared = accepted(edit(setDuration, project, 1, "  "));
    expect(cleared.tasks[0]).toEqual({ id: 1, name: "A", predecessors: [], status: "to-do" });
    expect(cleared.tasks[0]).not.toHaveProperty("duration");
  });

  it("rejects anything but a positive whole number of days", () => {
    const project = accepted(setDuration(projectWith("A"), 1, "5", CONTEXT));
    for (const input of ["0", "-1", "2.5", "1e3", "+5", "abc", "5 days", "٥", "9007199254740992"]) {
      expectRejected(edit(setDuration, project, 1, input), "duration-not-positive-whole-number");
    }
    expect(accepted(edit(setDuration, project, 1, "9007199254740991")).tasks[0]?.duration).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("names the rule in the message", () => {
    const result = edit(setDuration, projectWith("A"), 1, "0");
    if (result.ok) throw new Error("Expected a rejection");
    expect(result.error.message).toBe("A Duration must be a positive whole number of days.");
  });

  it("rejects an unknown id", () => {
    expectRejected(edit(setDuration, projectWith("A"), 2, "5"), "unknown-task");
  });
});

describe("isPositiveWholeDays", () => {
  it("accepts positive safe integers only", () => {
    expect([1, 5, Number.MAX_SAFE_INTEGER].map(isPositiveWholeDays)).toEqual([true, true, true]);
    expect([0, -1, 2.5, Number.NaN, Infinity, 2 ** 53].map(isPositiveWholeDays)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("setStartDate", () => {
  it("sets an ISO date, trimmed", () => {
    expect(accepted(edit(setStartDate, createEmptyProject(CONTEXT), " 2026-09-01 ")).start).toEqual({
      date: "2026-09-01",
    });
    expect(accepted(edit(setStartDate, createEmptyProject(CONTEXT), "0002-01-01")).start).toEqual({
      date: "0002-01-01",
    });
  });

  it("clears the START date on empty input by removing the field", () => {
    const project = accepted(setStartDate(createEmptyProject(CONTEXT), "2026-09-01", CONTEXT));
    expect(accepted(edit(setStartDate, project, "")).start).toEqual({});
  });

  it("rejects anything but a calendar date from 0001-01-01 to 9999-12-31", () => {
    for (const input of ["2026-02-29", "0000-01-01", "10000-01-01", "2026-9-1", "1 Sep 2026", "today"]) {
      expectRejected(edit(setStartDate, createEmptyProject(CONTEXT), input), "start-date-not-a-date");
    }
  });

  it("names the rule in the message", () => {
    const result = edit(setStartDate, createEmptyProject(CONTEXT), "2026-02-30");
    if (result.ok) throw new Error("Expected a rejection");
    expect(result.error.message).toBe("The START date must be a calendar date from 0001-01-01 to 9999-12-31.");
  });

  it("rejects with the same Validation Error the view shows for a date the browser cannot read", () => {
    const result = edit(setStartDate, createEmptyProject(CONTEXT), "2026-02-30");
    if (result.ok) throw new Error("Expected a rejection");
    expect(result.error).toStrictEqual(startDateNotADate());
    expect(result.error.message).not.toMatch(/invalid|conflict|blocked/i);
  });
});

describe("setDayCountingMode", () => {
  it("switches between calendar days and weekdays, changing nothing else", () => {
    const project = withDependencies(projectWith("A", "B"), [1, 2]);
    const weekdays = accepted(edit(setDayCountingMode, project, "weekdays"));
    expect(weekdays).toEqual({ ...project, dayCountingMode: "weekdays" });
    expect(accepted(edit(setDayCountingMode, weekdays, "calendar-days"))).toEqual(project);
  });

  it("returns the same project when the mode is already set", () => {
    const project = createEmptyProject(CONTEXT);
    expect(accepted(edit(setDayCountingMode, project, "calendar-days"))).toBe(project);
    const weekdays = accepted(setDayCountingMode(project, "weekdays", CONTEXT));
    expect(accepted(edit(setDayCountingMode, weekdays, "weekdays"))).toBe(weekdays);
  });
});

describe("setProjectName", () => {
  it("sets the name, trimmed", () => {
    expect(accepted(edit(setProjectName, createEmptyProject(CONTEXT), "  Website relaunch ")).name).toBe(
      "Website relaunch",
    );
  });

  it("clears the name on empty input by removing the field", () => {
    const project = accepted(setProjectName(createEmptyProject(CONTEXT), "Website relaunch", CONTEXT));
    const cleared = accepted(edit(setProjectName, project, "   "));
    expect(cleared).toEqual(createEmptyProject(CONTEXT));
    expect(cleared).not.toHaveProperty("name");
  });

  it("rejects a name made only of invisible characters as empty", () => {
    const result = edit(setProjectName, createEmptyProject(CONTEXT), "\u200B\u200B");
    expectRejected(result, "project-name-empty");
    if (!result.ok) expect(result.error.message).toBe("A project name cannot be empty.");
  });

  it("accepts 200 code units and rejects 201", () => {
    expect(PROJECT_NAME_MAX_LENGTH).toBe(200);
    expect(accepted(edit(setProjectName, createEmptyProject(CONTEXT), "a".repeat(200))).name).toHaveLength(200);
    const result = edit(setProjectName, createEmptyProject(CONTEXT), "a".repeat(201));
    expectRejected(result, "project-name-too-long");
    if (!result.ok) expect(result.error.message).toBe("A project name can be at most 200 characters.");
  });

  it("rejects a name with a lone surrogate", () => {
    const result = edit(setProjectName, createEmptyProject(CONTEXT), "Q3\uD83D");
    expectRejected(result, "project-name-malformed");
    if (!result.ok) expect(result.error.message).toBe("A project name must be well-formed Unicode.");
  });

  it("rejects a name with a line break or other control character", () => {
    for (const name of ["A\nB", "A\tB", "A\u2028B", "A\u0000B"]) {
      const result = edit(setProjectName, createEmptyProject(CONTEXT), name);
      expectRejected(result, "project-name-control-character");
      if (!result.ok) {
        expect(result.error.message).toBe("A project name cannot contain a line break or other control character.");
      }
    }
  });

  it("keeps the current name when the new one is rejected", () => {
    const project = accepted(setProjectName(createEmptyProject(CONTEXT), "Website relaunch", CONTEXT));
    expectRejected(edit(setProjectName, project, "A\nB"), "project-name-control-character");
    expect(project.name).toBe("Website relaunch");
  });
});

describe("TASK_STATUSES and taskStatusName", () => {
  it("lists the Statuses in the order the Status select shows them, with their names", () => {
    expect(TASK_STATUSES.map(taskStatusName)).toEqual(["To Do", "In Progress", "Done"]);
  });
});

describe("setStatus", () => {
  it("marks a Task Done with today as its completion date, in one edit", () => {
    expect(accepted(edit(setStatus, projectWith("A"), 1, "done")).tasks[0]).toEqual({
      id: 1,
      name: "A",
      predecessors: [],
      status: "done",
      completionDate: TODAY,
    });
  });

  it("marks a Task In Progress with no completion date", () => {
    const task = accepted(edit(setStatus, projectWith("A"), 1, "in-progress")).tasks[0];
    expect(task).toEqual({ id: 1, name: "A", predecessors: [], status: "in-progress" });
    expect(task).not.toHaveProperty("completionDate");
  });

  it("removes the completion date when a Task leaves Done", () => {
    const project = aThenB("2026-09-02");
    for (const status of ["to-do", "in-progress"] as const) {
      const task = accepted(edit(setStatus, project, 1, status)).tasks[0];
      expect(task).toEqual({ id: 1, name: "A", predecessors: [], status });
      expect(task).not.toHaveProperty("completionDate");
    }
  });

  it("keeps the completion date of a Task that is already Done", () => {
    const project = aThenB("2026-09-02");
    expect(accepted(edit(setStatus, project, 1, "done"))).toBe(project);
    expect(project.tasks[0]?.completionDate).toBe("2026-09-02");
  });

  it("rejects marking a Task Done while a predecessor is not Done (US-04), naming both", () => {
    for (const status of ["to-do", "in-progress"] as const) {
      const project = accepted(setStatus(aThenB(), 1, status, CONTEXT));
      expectRejectedWith(
        edit(setStatus, project, 2, "done"),
        "done-predecessor-not-done",
        "Task 2: B cannot be Done while its predecessor 1: A is not Done.",
      );
    }
  });

  it("rejects setting a Done predecessor back while its successor is Done (US-04), naming the successor", () => {
    const project = aThenB("2026-09-02", "2026-09-03");
    for (const status of ["to-do", "in-progress"] as const) {
      expectRejectedWith(
        edit(setStatus, project, 1, status),
        "done-predecessor-not-done",
        "Task 2: B cannot be Done while its predecessor 1: A is not Done.",
      );
    }
  });

  it("rejects marking a Task In Progress while a predecessor is not Done, naming both", () => {
    for (const status of ["to-do", "in-progress"] as const) {
      const project = accepted(setStatus(aThenB(), 1, status, CONTEXT));
      expectRejectedWith(
        edit(setStatus, project, 2, "in-progress"),
        "in-progress-predecessor-not-done",
        "Task 2: B cannot be In Progress while its predecessor 1: A is not Done.",
      );
    }
  });

  it("accepts marking a Task In Progress once every predecessor is Done", () => {
    expect(accepted(edit(setStatus, aThenB("2026-09-02"), 2, "in-progress")).tasks[1]?.status).toBe("in-progress");
  });

  it("rejects setting a Done predecessor back while its successor is In Progress, naming the successor", () => {
    const project = accepted(setStatus(aThenB("2026-09-02"), 2, "in-progress", CONTEXT));
    for (const status of ["to-do", "in-progress"] as const) {
      expectRejectedWith(
        edit(setStatus, project, 1, status),
        "in-progress-predecessor-not-done",
        "Task 2: B cannot be In Progress while its predecessor 1: A is not Done.",
      );
    }
  });

  it("rejects marking a Task Done while today is before the START date", () => {
    const project = accepted(setStartDate(projectWith("A"), "2026-09-10", CONTEXT));
    expectRejectedWith(
      edit(setStatus, project, 1, "done"),
      "completion-date-before-start-date",
      "Task 1: A cannot be completed on 2026-09-05, which is before the START date, 2026-09-10.",
    );
  });

  it("rejects an unknown id", () => {
    expectRejected(edit(setStatus, projectWith("A"), 2, "done"), "unknown-task");
  });
});

describe("setCompletionDate", () => {
  it("sets the completion date of a Done Task, trimmed", () => {
    const project = aThenB("2026-09-02");
    expect(accepted(edit(setCompletionDate, project, 1, " 2026-09-01 ")).tasks[0]?.completionDate).toBe("2026-09-01");
    expect(accepted(edit(setCompletionDate, project, 1, TODAY)).tasks[0]?.completionDate).toBe(TODAY);
  });

  it("rejects a completion date after today (US-04), naming the Task and both dates", () => {
    expectRejectedWith(
      edit(setCompletionDate, aThenB("2026-09-02"), 1, "2026-09-06"),
      "completion-date-after-today",
      "Task 1: A has the completion date 2026-09-06, which is after today, 2026-09-05.",
    );
  });

  it("rejects a completion date before the START date (US-04) and accepts one on it", () => {
    const project = accepted(setStartDate(aThenB("2026-09-04"), "2026-09-04", CONTEXT));
    expectRejectedWith(
      edit(setCompletionDate, project, 1, "2026-09-03"),
      "completion-date-before-start-date",
      "Task 1: A cannot be completed on 2026-09-03, which is before the START date, 2026-09-04.",
    );
    expect(accepted(edit(setCompletionDate, project, 1, "2026-09-04")).tasks[0]?.completionDate).toBe("2026-09-04");
  });

  it("rejects a completion date before a predecessor's (US-04) and accepts the same date", () => {
    const project = aThenB("2026-09-03", "2026-09-04");
    expectRejectedWith(
      edit(setCompletionDate, project, 2, "2026-09-02"),
      "completion-date-before-predecessor",
      "Task 2: B has the completion date 2026-09-02, which is before the completion date of its predecessor 1: A, 2026-09-03.",
    );
    expect(accepted(edit(setCompletionDate, project, 2, "2026-09-03")).tasks[1]?.completionDate).toBe("2026-09-03");
  });

  it("rejects moving a predecessor's completion date after its Done successor's, naming the successor", () => {
    expectRejectedWith(
      edit(setCompletionDate, aThenB("2026-09-02", "2026-09-03"), 1, "2026-09-04"),
      "completion-date-before-predecessor",
      "Task 2: B has the completion date 2026-09-03, which is before the completion date of its predecessor 1: A, 2026-09-04.",
    );
  });

  it("rejects clearing the completion date of a Done Task (US-04)", () => {
    expectRejectedWith(
      edit(setCompletionDate, aThenB("2026-09-02"), 1, "  "),
      "done-without-completion-date",
      "A Done Task needs a completion date.",
    );
  });

  it("rejects a completion date on a Task that is not Done", () => {
    for (const status of ["to-do", "in-progress"] as const) {
      const project = accepted(setStatus(projectWith("A"), 1, status, CONTEXT));
      expectRejectedWith(
        edit(setCompletionDate, project, 1, "2026-09-02"),
        "completion-date-without-done",
        "Only a Done Task can have a completion date.",
      );
    }
  });

  it("accepts empty input on a Task that is not Done, leaving no completion date", () => {
    const project = projectWith("A");
    const cleared = accepted(edit(setCompletionDate, project, 1, ""));
    expect(cleared).toEqual(project);
    expect(cleared.tasks[0]).not.toHaveProperty("completionDate");
  });

  it("rejects anything but a calendar date from 0001-01-01 to 9999-12-31, as the view does for a date it cannot read", () => {
    const project = aThenB("2026-09-02");
    for (const input of ["2026-02-30", "0000-01-01", "10000-01-01", "2026-9-3", "3 Sep 2026", "today"]) {
      const result = edit(setCompletionDate, project, 1, input);
      expectRejected(result, "completion-date-not-a-date");
      if (!result.ok) expect(result.error).toStrictEqual(completionDateNotADate());
    }
    expect(completionDateNotADate().message).toBe(
      "A completion date must be a calendar date from 0001-01-01 to 9999-12-31.",
    );
  });

  it("accepts a completion date on a Saturday in weekdays mode", () => {
    // 2026-09-05 is a Saturday.
    const project = accepted(setDayCountingMode(aThenB("2026-09-02"), "weekdays", CONTEXT));
    expect(accepted(edit(setCompletionDate, project, 1, "2026-09-05")).tasks[0]?.completionDate).toBe("2026-09-05");
  });

  it("rejects an unknown id", () => {
    expectRejected(edit(setCompletionDate, projectWith("A"), 2, "2026-09-02"), "unknown-task");
  });
});

describe("the Done rules on edits to other Tasks and the project", () => {
  it("rejects adding a predecessor that is not Done to a Done Task, naming the Done Task", () => {
    let project = projectWith("A", "B", "C");
    project = accepted(setStatus(project, 2, "done", CONTEXT));
    expectRejectedWith(
      edit(addPredecessor, project, 2, 3),
      "done-predecessor-not-done",
      "Task 2: B cannot be Done while its predecessor 3: C is not Done.",
    );
  });

  it("rejects adding a predecessor that is not Done to an In Progress Task, naming the In Progress Task", () => {
    let project = projectWith("A", "B", "C");
    project = accepted(setStatus(project, 2, "in-progress", CONTEXT));
    expectRejectedWith(
      edit(addPredecessor, project, 2, 3),
      "in-progress-predecessor-not-done",
      "Task 2: B cannot be In Progress while its predecessor 3: C is not Done.",
    );
  });

  it("rejects adding a Done predecessor completed later than the Done Task, naming both Tasks and dates", () => {
    let project = projectWith("A", "B", "C");
    project = accepted(setCompletionDate(accepted(setStatus(project, 1, "done", CONTEXT)), 1, "2026-09-04", CONTEXT));
    project = accepted(setCompletionDate(accepted(setStatus(project, 2, "done", CONTEXT)), 2, "2026-09-03", CONTEXT));
    expectRejectedWith(
      edit(addPredecessor, project, 2, 1),
      "completion-date-before-predecessor",
      "Task 2: B has the completion date 2026-09-03, which is before the completion date of its predecessor 1: A, 2026-09-04.",
    );
  });

  it("rejects a START date after a completion date, naming the Task", () => {
    expectRejectedWith(
      edit(setStartDate, aThenB("2026-09-02"), "2026-09-03"),
      "completion-date-before-start-date",
      "Task 1: A cannot be completed on 2026-09-02, which is before the START date, 2026-09-03.",
    );
  });

  it("accepts clearing the START date of a project with Done Tasks", () => {
    expect(accepted(edit(setStartDate, aThenB("2026-09-02", "2026-09-03"), "")).start).toEqual({});
  });

  it("still reports a START date that is not a date in a project with Done Tasks", () => {
    expectRejected(edit(setStartDate, aThenB("2026-09-02"), "2026-02-30"), "start-date-not-a-date");
  });

  it("reports the cycle, not a Done rule, for a dependency that closes a cycle through a Done Task (US-01)", () => {
    const expected = "Adding 2: B as a predecessor of 1: A would create the cycle 1: A → 2: B → 1: A.";
    expectRejectedWith(edit(addPredecessor, aThenB("2026-09-02"), 1, 2), "cycle", expected);
    expectRejectedWith(edit(addPredecessor, aThenB("2026-09-02", "2026-09-03"), 1, 2), "cycle", expected);
  });

  it("keeps a project accepted today free of Validation Errors tomorrow", () => {
    const project = accepted(createTask(aThenB("2026-09-02", "2026-09-03"), "C", CONTEXT));
    const completedToday = accepted(setStatus(project, 3, "done", CONTEXT));
    expect(completedToday.tasks[2]?.completionDate).toBe(TODAY);
    expect(validateProject(completedToday, { today: "2026-09-06" })).toBeUndefined();
  });

  it("decides the completion date bound against the today it is given", () => {
    const project = aThenB("2026-09-02");
    expectRejected(
      editOn({ today: "2026-09-03" }, setCompletionDate, project, 1, "2026-09-04"),
      "completion-date-after-today",
    );
    expect(
      accepted(editOn({ today: "2026-09-04" }, setCompletionDate, project, 1, "2026-09-04")).tasks[0]?.completionDate,
    ).toBe("2026-09-04");
  });
});

describe("validateProject", () => {
  function expectValidationError(project: Project, rule: ValidationErrorRule, message: string): void {
    const error = validateProject(project, CONTEXT);
    expect(error).toEqual({ rule, message });
    expect(message).not.toMatch(/invalid|conflict|blocked/i);
  }

  it("accepts the empty project and every edit-built fixture", () => {
    expect(validateProject(createEmptyProject(CONTEXT), CONTEXT)).toBeUndefined();
    expect(validateProject(createPerfProject(CONTEXT), CONTEXT)).toBeUndefined();

    let project = withDependencies(projectWith("Design", "Build", "Test", "Docs"), [1, 2], [2, 3], [1, 4]);
    project = accepted(setDuration(project, 1, "3", CONTEXT));
    project = accepted(setDuration(project, 2, "5", CONTEXT));
    project = accepted(setStartDate(project, "2026-09-01", CONTEXT));
    project = accepted(setProjectName(project, "Website relaunch – QA ✓", CONTEXT));
    expect(validateProject(project, CONTEXT)).toBeUndefined();
    expect(validateProject(accepted(setDuration(project, 2, "", CONTEXT)), CONTEXT)).toBeUndefined();
    expect(validateProject(accepted(deleteTask(project, 2, CONTEXT)), CONTEXT)).toBeUndefined();
    expect(validateProject(accepted(createTask(projectWith("Review"), "👩‍💻 Review", CONTEXT)), CONTEXT)).toBeUndefined();
    expect(validateProject(aThenB("2026-09-02", "2026-09-03"), CONTEXT)).toBeUndefined();
  });

  it("does not mutate the project", () => {
    const project = deepFreeze(projectOf([task(1, "A", [2]), task(2, "B", [1])]));
    const before = structuredClone(project);
    validateProject(project, CONTEXT);
    expect(project).toEqual(before);
  });

  it("names the Task by id alone for each Task name rule", () => {
    expectValidationError(
      projectOf([task(1, "A"), task(3, "")]),
      "task-name-empty",
      "Task 3: A Task name cannot be empty.",
    );
    expectValidationError(projectOf([task(3, "\u200B")]), "task-name-empty", "Task 3: A Task name cannot be empty.");
    expectValidationError(
      projectOf([task(3, "a".repeat(201))]),
      "task-name-too-long",
      "Task 3: A Task name can be at most 200 characters.",
    );
    expectValidationError(
      projectOf([task(3, "Build\uD800")]),
      "task-name-malformed",
      "Task 3: A Task name must be well-formed Unicode.",
    );
    expectValidationError(
      projectOf([task(3, "Build\nTest")]),
      "task-name-control-character",
      "Task 3: A Task name cannot contain a line break or other control character.",
    );
  });

  it("names the Task for a Duration that is not a positive whole number", () => {
    for (const duration of [0, -1, 1.5]) {
      expectValidationError(
        projectOf([task(1, "Design"), task(3, "Build", [], { duration })]),
        "duration-not-positive-whole-number",
        "Task 3: Build: A Duration must be a positive whole number of days.",
      );
    }
  });

  it("names the Task and the missing id for a dependency on an unknown id", () => {
    expectValidationError(
      projectOf([task(1, "Design"), task(3, "Build", [1, 9])]),
      "unknown-task",
      "Task 3: Build depends on Task 9, which is not in the project.",
    );
  });

  it("rejects a START date that is not a calendar date", () => {
    expectValidationError(
      projectOf([task(1, "Design")], { start: { date: "2027-02-30" } }),
      "start-date-not-a-date",
      "The START date must be a calendar date from 0001-01-01 to 9999-12-31.",
    );
  });

  it("applies the project name rules to a project name that is present", () => {
    expectValidationError(projectOf([], { name: "" }), "project-name-empty", "A project name cannot be empty.");
    expectValidationError(projectOf([], { name: "\u200B" }), "project-name-empty", "A project name cannot be empty.");
    expectValidationError(
      projectOf([], { name: "a".repeat(201) }),
      "project-name-too-long",
      "A project name can be at most 200 characters.",
    );
    expectValidationError(
      projectOf([], { name: "Q3\uDE00" }),
      "project-name-malformed",
      "A project name must be well-formed Unicode.",
    );
    expectValidationError(
      projectOf([], { name: "Q3\nLaunch" }),
      "project-name-control-character",
      "A project name cannot contain a line break or other control character.",
    );
  });

  it("rejects a nextTaskId above the id ceiling", () => {
    expectValidationError(
      projectOf([task(1, "Design")], { nextTaskId: 2147483648 }),
      "task-id-limit-reached",
      "Task ids go up to 2147483646 and this project has reached that limit, so no more Tasks can be created.",
    );
    expect(validateProject(projectOf([task(1, "Design")], { nextTaskId: 2147483647 }), CONTEXT)).toBeUndefined();
  });

  it("names the cycle the project holds", () => {
    // A → B → A, and C hanging off A.
    expectValidationError(
      projectOf([task(1, "A", [2]), task(2, "B", [1]), task(3, "C", [1])]),
      "cycle",
      "The project contains the cycle 1: A → 2: B → 1: A.",
    );
  });

  it("names a Task that is its own predecessor as the cycle [a, a]", () => {
    expectValidationError(
      projectOf([task(1, "A"), task(2, "Review", [1, 2])]),
      "cycle",
      "The project contains the cycle 2: Review → 2: Review.",
    );
  });

  it("names the Task for a Done Task without a completion date", () => {
    expectValidationError(
      projectOf([task(1, "Design"), task(3, "Build", [], done())]),
      "done-without-completion-date",
      "Task 3: Build: A Done Task needs a completion date.",
    );
  });

  it("names the Task for a completion date on a Task that is not Done", () => {
    for (const status of ["to-do", "in-progress"] as const) {
      expectValidationError(
        projectOf([task(1, "Design"), task(3, "Build", [], { status, completionDate: "2026-09-03" })]),
        "completion-date-without-done",
        "Task 3: Build: Only a Done Task can have a completion date.",
      );
    }
  });

  it("names the Task for a completion date that is not a calendar date", () => {
    for (const completionDate of ["2026-02-30", "0000-12-31", "2026-9-3", ""]) {
      expectValidationError(
        projectOf([task(1, "Design"), task(3, "Build", [], done(completionDate))]),
        "completion-date-not-a-date",
        "Task 3: Build: A completion date must be a calendar date from 0001-01-01 to 9999-12-31.",
      );
    }
  });

  it("names the Task and both dates for a completion date after today", () => {
    expectValidationError(
      projectOf([task(1, "Design"), task(3, "Build", [], done("2026-09-06"))]),
      "completion-date-after-today",
      "Task 3: Build has the completion date 2026-09-06, which is after today, 2026-09-05.",
    );
  });

  it("names the Task and both dates for a completion date before the START date, and has no bound while it is unset", () => {
    const tasks = [task(1, "Design"), task(3, "Build", [], done("2026-09-03"))];
    expectValidationError(
      projectOf(tasks, { start: { date: "2026-09-04" } }),
      "completion-date-before-start-date",
      "Task 3: Build cannot be completed on 2026-09-03, which is before the START date, 2026-09-04.",
    );
    expect(validateProject(projectOf(tasks), CONTEXT)).toBeUndefined();
    expect(validateProject(projectOf(tasks, { start: { date: "2026-09-03" } }), CONTEXT)).toBeUndefined();
  });

  it("names both Tasks for a Done Task with a predecessor that is not Done", () => {
    for (const status of ["to-do", "in-progress"] as const) {
      expectValidationError(
        projectOf([task(1, "Design", [], { status }), task(3, "Build", [1], done("2026-09-03"))]),
        "done-predecessor-not-done",
        "Task 3: Build cannot be Done while its predecessor 1: Design is not Done.",
      );
    }
  });

  it("names both Tasks for an In Progress Task with a predecessor that is not Done", () => {
    for (const status of ["to-do", "in-progress"] as const) {
      expectValidationError(
        projectOf([task(1, "Design", [], { status }), task(3, "Build", [1], { status: "in-progress" })]),
        "in-progress-predecessor-not-done",
        "Task 3: Build cannot be In Progress while its predecessor 1: Design is not Done.",
      );
    }
    expect(
      validateProject(
        projectOf([task(1, "Design", [], done("2026-09-03")), task(3, "Build", [1], { status: "in-progress" })]),
        CONTEXT,
      ),
    ).toBeUndefined();
  });

  it("names both Tasks and both dates for a completion date before a predecessor's", () => {
    expectValidationError(
      projectOf([task(1, "Design", [], done("2026-09-04")), task(3, "Build", [1], done("2026-09-03"))]),
      "completion-date-before-predecessor",
      "Task 3: Build has the completion date 2026-09-03, which is before the completion date of its predecessor 1: Design, 2026-09-04.",
    );
    expect(
      validateProject(
        projectOf([task(1, "Design", [], done("2026-09-03")), task(3, "Build", [1], done("2026-09-03"))]),
        CONTEXT,
      ),
    ).toBeUndefined();
  });

  it("returns the first Validation Error: Tasks in array order, then START date, project name, id ceiling, cycle, then the Done predecessor rules", () => {
    const cycle = [task(1, "A", [2]), task(2, "B", [1])];
    const badStart = { start: { date: "2026-13-01" } };
    const badName = { name: "" };
    const pastCeiling = { nextTaskId: 2147483648 };

    expect(validateProject(projectOf(cycle, { ...badName, ...pastCeiling }), CONTEXT)?.rule).toBe("project-name-empty");
    expect(validateProject(projectOf(cycle, pastCeiling), CONTEXT)?.rule).toBe("task-id-limit-reached");

    expect(validateProject(projectOf([...cycle, task(3, "")], { ...badStart, ...badName }), CONTEXT)?.rule).toBe(
      "task-name-empty",
    );
    expect(validateProject(projectOf([task(1, "A", [], { duration: 0 }), task(2, "")]), CONTEXT)?.rule).toBe(
      "duration-not-positive-whole-number",
    );
    expect(validateProject(projectOf([task(1, "", [9])]), CONTEXT)?.rule).toBe("task-name-empty");
    expect(validateProject(projectOf([task(1, "A", [9], { duration: 0 })]), CONTEXT)?.rule).toBe(
      "duration-not-positive-whole-number",
    );
    expect(validateProject(projectOf([...cycle, task(3, "C", [9])], badStart), CONTEXT)?.rule).toBe("unknown-task");
    expect(validateProject(projectOf(cycle, { ...badStart, ...badName }), CONTEXT)?.rule).toBe("start-date-not-a-date");
    expect(validateProject(projectOf(cycle, badName), CONTEXT)?.rule).toBe("project-name-empty");
  });

  it("checks the Done rules about a Task with its Task checks, and those about its predecessors after the cycle", () => {
    // A Task's own completion date is checked before the START date, which skips its bound while malformed.
    expect(
      validateProject(projectOf([task(1, "A", [], done("2026-02-30"))], { start: { date: "2026-13-01" } }), CONTEXT)
        ?.rule,
    ).toBe("completion-date-not-a-date");
    expect(
      validateProject(projectOf([task(1, "A", [], done("2026-09-03"))], { start: { date: "2026-13-01" } }), CONTEXT)
        ?.rule,
    ).toBe("start-date-not-a-date");
    // A malformed predecessor date is reported on the predecessor, even when it comes later in the array.
    expectValidationError(
      projectOf([task(1, "B", [2], done("2026-09-03")), task(2, "A", [], done("2026-02-30"))]),
      "completion-date-not-a-date",
      "Task 2: A: A completion date must be a calendar date from 0001-01-01 to 9999-12-31.",
    );
    // A cycle through Done Tasks with unequal completion dates is reported as the cycle.
    expectValidationError(
      projectOf([task(1, "A", [2], done("2026-09-04")), task(2, "B", [1], done("2026-09-03"))]),
      "cycle",
      "The project contains the cycle 1: A → 2: B → 1: A.",
    );
    expect(validateProject(projectOf([task(1, "A", [2], done("2026-09-03")), task(2, "B", [1])]), CONTEXT)?.rule).toBe(
      "cycle",
    );
    // The predecessor rules come after the START date, project name and id ceiling.
    const notDonePredecessor = [task(1, "A"), task(2, "B", [1], done("2026-09-03"))];
    expect(validateProject(projectOf(notDonePredecessor, { start: { date: "2026-13-01" } }), CONTEXT)?.rule).toBe(
      "start-date-not-a-date",
    );
    expect(validateProject(projectOf(notDonePredecessor, { name: "" }), CONTEXT)?.rule).toBe("project-name-empty");
    expect(validateProject(projectOf(notDonePredecessor, { nextTaskId: 2147483648 }), CONTEXT)?.rule).toBe(
      "task-id-limit-reached",
    );
    // Each predecessor rule walks every Task before the next: Task 2 breaks the date bound, Task 4 the Status rule.
    expectValidationError(
      projectOf([
        task(1, "A", [], done("2026-09-03")),
        task(2, "B", [1], done("2026-09-02")),
        task(3, "C"),
        task(4, "D", [3], done("2026-09-04")),
      ]),
      "done-predecessor-not-done",
      "Task 4: D cannot be Done while its predecessor 3: C is not Done.",
    );
    // The In Progress rule runs after the Done Status rule and before the date bound, each over every Task.
    expectValidationError(
      projectOf([
        task(1, "A"),
        task(2, "B", [1], { status: "in-progress" }),
        task(3, "C"),
        task(4, "D", [3], done("2026-09-04")),
      ]),
      "done-predecessor-not-done",
      "Task 4: D cannot be Done while its predecessor 3: C is not Done.",
    );
    expectValidationError(
      projectOf([
        task(1, "A", [], done("2026-09-03")),
        task(2, "B", [1], done("2026-09-02")),
        task(3, "C"),
        task(4, "D", [3], { status: "in-progress" }),
      ]),
      "in-progress-predecessor-not-done",
      "Task 4: D cannot be In Progress while its predecessor 3: C is not Done.",
    );
    // A cycle through In Progress Tasks is reported as the cycle.
    expect(
      validateProject(projectOf([task(1, "A", [2], { status: "in-progress" }), task(2, "B", [1])]), CONTEXT)?.rule,
    ).toBe("cycle");
  });

  it("checks every rule of a Task before the next Task: name, Duration, predecessor ids, then its completion date", () => {
    expect(validateProject(projectOf([task(1, "", [], { duration: 0 })]), CONTEXT)?.rule).toBe("task-name-empty");
    expect(validateProject(projectOf([task(1, "A", [9], done())]), CONTEXT)?.rule).toBe("unknown-task");
    expect(
      validateProject(projectOf([task(1, "A", [], { status: "to-do", completionDate: "2026-02-30" })]), CONTEXT)?.rule,
    ).toBe("completion-date-without-done");
    // After today and before the START date at once: the today bound comes first.
    expect(
      validateProject(projectOf([task(1, "A", [], done("2026-09-07"))], { start: { date: "2026-09-10" } }), CONTEXT)
        ?.rule,
    ).toBe("completion-date-after-today");
    expect(validateProject(projectOf([task(1, "A", [], done("2026-09-06")), task(2, "")]), CONTEXT)?.rule).toBe(
      "completion-date-after-today",
    );
    // A walk rule by rule over all Tasks would report Task 2's empty name first.
    expectValidationError(
      projectOf([task(1, "Design", [9]), task(2, "")]),
      "unknown-task",
      "Task 1: Design depends on Task 9, which is not in the project.",
    );
  });
});

describe("ProjectInvariantBreach", () => {
  it("is an Error that names itself in a console trace and carries the fault", () => {
    const fault = {
      rule: "model-shape",
      message: "Task ids must be strictly ascending: Task 2 follows Task 3.",
    } as const;
    const breach = new ProjectInvariantBreach(fault);

    expect(breach).toBeInstanceOf(Error);
    expect(breach.name).toBe("ProjectInvariantBreach");
    expect(breach.message).toBe(fault.message);
    expect(breach.fault).toEqual(fault);
  });
});

describe("the guardian", () => {
  // A ⇄ B is a cycle no edit can build; C is unrelated to it. An edit that
  // checked only the rule it knows it can break would accept every edit on C.
  // Cast past the doors, which would refuse it, so the edits meet it.
  const cyclic = projectOf([task(1, "A", [2]), task(2, "B", [1]), task(3, "C")]) as CheckedProject;
  const cycleMessage = "The project contains the cycle 1: A → 2: B → 1: A.";

  it.each([
    ["setDuration", (project: CheckedProject) => setDuration(project, 3, "5", CONTEXT)],
    ["renameTask", (project: CheckedProject) => renameTask(project, 3, "Ship", CONTEXT)],
    ["setProjectName", (project: CheckedProject) => setProjectName(project, "Website", CONTEXT)],
    ["setDayCountingMode", (project: CheckedProject) => setDayCountingMode(project, "weekdays", CONTEXT)],
    ["addPredecessor", (project: CheckedProject) => addPredecessor(project, 3, 1, CONTEXT)],
    ["setStatus", (project: CheckedProject) => setStatus(project, 3, "done", CONTEXT)],
    ["setCompletionDate", (project: CheckedProject) => setCompletionDate(project, 3, "", CONTEXT)],
  ])("rejects %s when the resulting project holds a cycle, not only the rule the edit can break", (_name, apply) => {
    const result = apply(deepFreeze(structuredClone(cyclic)));

    expectRejected(result, "cycle");
    if (!result.ok) expect(result.error.message).toBe(cycleMessage);
  });

  it.each([
    [
      "duplicate Task ids",
      projectOf([task(1, "A"), task(1, "B")]),
      "Task ids must be strictly ascending: Task 1 follows Task 1.",
    ],
    [
      "unsorted predecessors",
      projectOf([task(1, "A"), task(2, "B"), task(3, "C", [2, 1])]),
      "The predecessors of Task 3 must be strictly ascending: 1 follows 2.",
    ],
    [
      "a duplicate predecessor",
      projectOf([task(1, "A"), task(2, "B", [1, 1])]),
      "The predecessors of Task 2 must be strictly ascending: 1 follows 1.",
    ],
  ])("throws ProjectInvariantBreach when createTask meets %s", (_name, project, message) => {
    expect(() => createTask(project as CheckedProject, "New", CONTEXT)).toThrow(
      expect.objectContaining({ name: "ProjectInvariantBreach", fault: { rule: "model-shape", message } }),
    );
  });

  it("throws ProjectInvariantBreach when nextTaskId is not above every Task id", () => {
    // Not createTask: it would mint the duplicate id 2 and report that first.
    const project = projectOf([task(1, "A"), task(2, "B")], { nextTaskId: 2 });

    expect(() => renameTask(project as CheckedProject, 1, "Design", CONTEXT)).toThrow(
      expect.objectContaining({
        name: "ProjectInvariantBreach",
        fault: { rule: "model-shape", message: "nextTaskId must be above every Task id: it is 2, and Task 2 exists." },
      }),
    );
  });
});

describe("the doors for a project no edit built", () => {
  const cyclic = projectOf([task(1, "A", [2]), task(2, "B", [1]), task(3, "C")]);

  it("checkProject accepts a project with no Validation Error, as it is", () => {
    const project = projectOf([task(1, "Design", [], { duration: 3 }), task(2, "Build", [1])], { name: "Website" });

    expect(checkProject(project, CONTEXT)).toEqual({ ok: true, project });
  });

  it("checkProject rejects a project's first Validation Error, worded for a file", () => {
    expect(checkProject(projectOf([task(1, "Design"), task(2, " ")]), CONTEXT)).toEqual({
      ok: false,
      error: { rule: "task-name-empty", message: "Task 2: A Task name cannot be empty." },
    });
  });

  it("toCheckedProject throws ProjectInvariantBreach carrying the Validation Error of a cyclic project", () => {
    expect(() => toCheckedProject(cyclic, CONTEXT)).toThrow(
      expect.objectContaining({
        name: "ProjectInvariantBreach",
        fault: { rule: "cycle", message: "The project contains the cycle 1: A → 2: B → 1: A." },
      }),
    );
  });

  it("toCheckedProject throws ProjectInvariantBreach with a model-shape fault for duplicate Task ids", () => {
    expect(() => toCheckedProject(projectOf([task(1, "A"), task(1, "B")]), CONTEXT)).toThrow(
      expect.objectContaining({
        name: "ProjectInvariantBreach",
        fault: { rule: "model-shape", message: "Task ids must be strictly ascending: Task 1 follows Task 1." },
      }),
    );
  });
});
