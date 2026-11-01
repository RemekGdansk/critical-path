import { describe, expect, it } from "vitest";

import {
  type CheckedProject,
  createEmptyProject,
  createTask,
  type EditContext,
  type EditResult,
  setDuration,
} from "@/lib/services/project";
import { validationWarnings } from "@/lib/services/validation-warnings";
import type { Project } from "@/types";

const TODAY = "2026-09-05";
const CONTEXT: EditContext = { today: TODAY };

function accepted(result: EditResult): CheckedProject {
  if (!result.ok) throw new Error(`Expected the edit to be accepted, got ${result.error.rule}`);
  return result.project;
}

/** A project with one Task per [name, Duration] pair; an empty Duration leaves it unset. */
function projectWith(...tasks: [string, string][]): Project {
  return tasks.reduce((project, [name, duration]) => {
    const created = accepted(createTask(project, name, CONTEXT));
    return accepted(setDuration(created, created.nextTaskId - 1, duration, CONTEXT));
  }, createEmptyProject(CONTEXT));
}

describe("validationWarnings", () => {
  it("has none for a fully estimated project or an empty one", () => {
    expect(validationWarnings(projectWith(["A", "5"], ["B", "3"]))).toEqual([]);
    expect(validationWarnings(createEmptyProject(CONTEXT))).toEqual([]);
  });

  it("raises one duration-missing warning per Task without a Duration, in creation order", () => {
    const project = projectWith(["Design", ""], ["Build", "3"], ["Test", ""]);
    expect(validationWarnings(project)).toEqual([
      { rule: "duration-missing", taskId: 1, message: "Design has no Duration." },
      { rule: "duration-missing", taskId: 3, message: "Test has no Duration." },
    ]);
  });

  it("raises none for a Done Task without a Duration", () => {
    // Built by hand: no edit sets Done yet (S-07).
    const project: Project = {
      ...createEmptyProject(CONTEXT),
      nextTaskId: 3,
      tasks: [
        { id: 1, name: "A", predecessors: [], status: "done", completionDate: "2026-09-03" },
        { id: 2, name: "B", predecessors: [1], status: "in-progress" },
      ],
    };
    expect(validationWarnings(project).map((warning) => warning.taskId)).toEqual([2]);
  });
});
