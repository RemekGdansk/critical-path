import { describe, expect, it } from "vitest";

import { forecast } from "@/lib/services/forecast";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  type EditContext,
  type EditResult,
  setCompletionDate,
  setDuration,
  setStartDate,
  setStatus,
} from "@/lib/services/project";
import { remainingWork } from "@/lib/services/remaining-work";
import type { TaskId } from "@/types";

const TODAY = "2026-09-05";
const CONTEXT: EditContext = { today: TODAY };

function accepted(result: EditResult): CheckedProject {
  if (!result.ok) throw new Error(`Expected the edit to be accepted, got ${result.error.rule}`);
  return result.project;
}

/** A project with one Task per [name, Duration] pair, ids 1..n; an empty Duration leaves it unset. */
function projectWith(...tasks: [string, string][]): CheckedProject {
  return tasks.reduce((current, [name, duration]) => {
    const created = accepted(createTask(current, name, CONTEXT));
    return accepted(setDuration(created, created.nextTaskId - 1, duration, CONTEXT));
  }, createEmptyProject(CONTEXT));
}

/** Adds `predecessorId → taskId` for each pair. */
function withDependencies(project: CheckedProject, ...pairs: [TaskId, TaskId][]): CheckedProject {
  return pairs.reduce(
    (current, [predecessorId, taskId]) => accepted(addPredecessor(current, taskId, predecessorId, CONTEXT)),
    project,
  );
}

// Expected times, Tasks and links are literals derived by hand: a Task starts
// when its last predecessor finishes and finishes Duration days later.
describe("remainingWork", () => {
  it("makes every Task and link of a chain critical", () => {
    // A (5) → B (3) → C (2): 0–5, 5–8, 8–10.
    const chain = withDependencies(projectWith(["A", "5"], ["B", "3"], ["C", "2"]), [1, 2], [2, 3]);
    expect(remainingWork(chain)).toStrictEqual({
      kind: "scheduled",
      criticalPathTime: { kind: "days", days: 10 },
      totalWorkTime: { kind: "days", days: 10 },
      criticalTaskIds: new Set([1, 2, 3]),
      criticalLinks: new Set(["1->2", "2->3"]),
    });
  });

  it("makes both of two equal-length parallel branches critical", () => {
    // A (2) → B (3) and C (4) → D (1): both 5 days.
    const tie = withDependencies(projectWith(["A", "2"], ["B", "3"], ["C", "4"], ["D", "1"]), [1, 2], [3, 4]);
    expect(remainingWork(tie)).toStrictEqual({
      kind: "scheduled",
      criticalPathTime: { kind: "days", days: 5 },
      totalWorkTime: { kind: "days", days: 10 },
      criticalTaskIds: new Set([1, 2, 3, 4]),
      criticalLinks: new Set(["1->2", "3->4"]),
    });
  });

  it("gives the critical-path time the forecast adds to the base date for the Resource-Unconstrained Project Finish Date", () => {
    // The same tie from START 1 Sep: 5 days later is 6 Sep; all 10 days of work one after another end 11 Sep.
    const tie = withDependencies(projectWith(["A", "2"], ["B", "3"], ["C", "4"], ["D", "1"]), [1, 2], [3, 4]);
    const result = forecast(accepted(setStartDate(tie, "2026-09-01", CONTEXT)), "2026-08-20");
    expect(result).toMatchObject({
      baseDate: "2026-09-01",
      resourceUnconstrainedProjectFinishDate: { kind: "date", date: "2026-09-06" },
      resourceConstrainedProjectFinishDate: { kind: "date", date: "2026-09-11" },
      criticalPathTime: { kind: "days", days: 5 },
      totalWorkTime: { kind: "days", days: 10 },
    });
  });

  it("leaves out a link between two critical Tasks that is not on a longest chain", () => {
    // A (3) → B (1) → C (3) plus A → C: A ends on day 3 but C starts on day 4, after B.
    const shortcut = withDependencies(projectWith(["A", "3"], ["B", "1"], ["C", "3"]), [1, 2], [2, 3], [1, 3]);
    expect(remainingWork(shortcut)).toStrictEqual({
      kind: "scheduled",
      criticalPathTime: { kind: "days", days: 7 },
      totalWorkTime: { kind: "days", days: 7 },
      criticalTaskIds: new Set([1, 2, 3]),
      criticalLinks: new Set(["1->2", "2->3"]),
    });
  });

  it("leaves a shorter parallel branch out of the critical path", () => {
    // A (5) → B (3): 8 days; C (1) → D (2): 3 days.
    const project = withDependencies(projectWith(["A", "5"], ["B", "3"], ["C", "1"], ["D", "2"]), [1, 2], [3, 4]);
    expect(remainingWork(project)).toStrictEqual({
      kind: "scheduled",
      criticalPathTime: { kind: "days", days: 8 },
      totalWorkTime: { kind: "days", days: 11 },
      criticalTaskIds: new Set([1, 2]),
      criticalLinks: new Set(["1->2"]),
    });
  });

  it("leaves out the link into a shorter branch, even when it starts the day its critical predecessor finishes", () => {
    // A (5) → B (3) and A → C (1): A 0–5, B 5–8, C 5–6. C starts when A finishes but is not on the longest chain.
    const project = withDependencies(projectWith(["A", "5"], ["B", "3"], ["C", "1"]), [1, 2], [1, 3]);
    expect(remainingWork(project)).toStrictEqual({
      kind: "scheduled",
      criticalPathTime: { kind: "days", days: 8 },
      totalWorkTime: { kind: "days", days: 9 },
      criticalTaskIds: new Set([1, 2]),
      criticalLinks: new Set(["1->2"]),
    });
  });

  it("excludes a Done predecessor, so its successor starts at 0", () => {
    // A (5) Done → B (3) To Do. Only B remains: 0–3.
    let project = withDependencies(projectWith(["A", "5"], ["B", "3"]), [1, 2]);
    project = accepted(setStartDate(project, "2026-09-01", CONTEXT));
    project = accepted(setStatus(project, 1, "done", CONTEXT));
    project = accepted(setCompletionDate(project, 1, "2026-09-03", CONTEXT));
    expect(remainingWork(project)).toStrictEqual({
      kind: "scheduled",
      criticalPathTime: { kind: "days", days: 3 },
      totalWorkTime: { kind: "days", days: 3 },
      criticalTaskIds: new Set([2]),
      criticalLinks: new Set(),
    });
  });

  it("is withheld while a Validation Warning exists", () => {
    const warned = withDependencies(projectWith(["A", "5"], ["B", ""]), [1, 2]);
    expect(remainingWork(warned)).toStrictEqual({ kind: "withheld" });
  });

  it("gives 0 days and nothing critical for a project without Tasks", () => {
    expect(remainingWork(createEmptyProject(CONTEXT))).toStrictEqual({
      kind: "scheduled",
      criticalPathTime: { kind: "days", days: 0 },
      totalWorkTime: { kind: "days", days: 0 },
      criticalTaskIds: new Set(),
      criticalLinks: new Set(),
    });
  });

  it("reports times past the largest safe integer as too large and marks nothing critical", () => {
    const max = String(Number.MAX_SAFE_INTEGER);
    const huge = withDependencies(projectWith(["A", max], ["B", max]), [1, 2]);
    expect(remainingWork(huge)).toStrictEqual({
      kind: "scheduled",
      criticalPathTime: { kind: "too-large" },
      totalWorkTime: { kind: "too-large" },
      criticalTaskIds: new Set(),
      criticalLinks: new Set(),
    });
  });

  it("still marks the critical Tasks when only the total-work time is too large", () => {
    // Independent A and B: the longest chain is one of them, an exact count; only their sum is too large.
    const max = String(Number.MAX_SAFE_INTEGER);
    expect(remainingWork(projectWith(["A", max], ["B", max]))).toStrictEqual({
      kind: "scheduled",
      criticalPathTime: { kind: "days", days: 9007199254740991 },
      totalWorkTime: { kind: "too-large" },
      criticalTaskIds: new Set([1, 2]),
      criticalLinks: new Set(),
    });
  });
});
