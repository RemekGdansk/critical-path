import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  DAY_COUNTING_MODES,
  deleteTask,
  type EditResult,
  removePredecessor,
  renameTask,
  setDayCountingMode,
  setDuration,
  setProjectName,
  setStartDate,
  validateProject,
} from "@/lib/services/project";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

// Mostly valid names, so Tasks accumulate, and one of each kind a name rule
// rejects: empty, whitespace, invisible only, 201 code units, a control
// character, a lone surrogate.
const names = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom("Design", "  Build  ", "👩‍💻 Ship") },
  { weight: 1, arbitrary: fc.constantFrom("", " \t ", "\u200B\uFEFF", "a".repeat(201), "A\nB", "A\uD83D") },
);
const durations = fc.constantFrom("", "0", "3", " 7 ", "1.5", "1e3", "-2", "12345678901234567890");
const startDates = fc.constantFrom("2026-03-02", " 2026-10-19 ", "", "2026-02-30", "26-03-02");
// A small range, so both known and unknown Task ids occur (0 never names a Task).
const taskIds = fc.integer({ min: 0, max: 6 });

const steps = fc.oneof(
  { weight: 3, arbitrary: fc.record({ edit: fc.constant("createTask"), name: names }) },
  { weight: 1, arbitrary: fc.record({ edit: fc.constant("renameTask"), taskId: taskIds, name: names }) },
  { weight: 1, arbitrary: fc.record({ edit: fc.constant("deleteTask"), taskId: taskIds }) },
  {
    weight: 3,
    arbitrary: fc.record({ edit: fc.constant("addPredecessor"), taskId: taskIds, predecessorId: taskIds }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ edit: fc.constant("removePredecessor"), taskId: taskIds, predecessorId: taskIds }),
  },
  { weight: 1, arbitrary: fc.record({ edit: fc.constant("setProjectName"), name: names }) },
  { weight: 2, arbitrary: fc.record({ edit: fc.constant("setDuration"), taskId: taskIds, input: durations }) },
  { weight: 1, arbitrary: fc.record({ edit: fc.constant("setStartDate"), input: startDates }) },
  {
    weight: 1,
    arbitrary: fc.record({ edit: fc.constant("setDayCountingMode"), mode: fc.constantFrom(...DAY_COUNTING_MODES) }),
  },
);

type Step = typeof steps extends fc.Arbitrary<infer S> ? S : never;

function apply(project: CheckedProject, step: Step): EditResult {
  switch (step.edit) {
    case "createTask":
      return createTask(project, step.name);
    case "renameTask":
      return renameTask(project, step.taskId, step.name);
    case "deleteTask":
      return deleteTask(project, step.taskId);
    case "addPredecessor":
      return addPredecessor(project, step.taskId, step.predecessorId);
    case "removePredecessor":
      return removePredecessor(project, step.taskId, step.predecessorId);
    case "setProjectName":
      return setProjectName(project, step.name);
    case "setDuration":
      return setDuration(project, step.taskId, step.input);
    case "setStartDate":
      return setStartDate(project, step.input);
    case "setDayCountingMode":
      return setDayCountingMode(project, step.mode);
  }
}

describe("edit sequences", () => {
  // Every edit ends in the guardian, which throws ProjectInvariantBreach on a
  // broken model shape, so a sequence that breaks the shape fails here too.
  it("never accept a Validation Error, never throw, and leave the input unchanged when they reject", () => {
    fc.assert(
      // `size: "max"`: fast-check's default size would keep sequences near 10
      // edits, too short to build the Tasks a cycle attempt needs.
      fc.property(fc.array(steps, { maxLength: 40, size: "max" }), (sequence) => {
        let project = createEmptyProject();
        for (const step of sequence) {
          const before = structuredClone(project);
          const result = apply(deepFreeze(project), step);
          if (result.ok) {
            expect(validateProject(result.project)).toBeUndefined();
            project = result.project;
          } else {
            expect(project).toEqual(before);
          }
        }
      }),
      // A fixed seed keeps the gate deterministic. To explore new sequences
      // locally, drop `seed`: a failure prints the seed and path that replay it.
      { seed: 20261019, numRuns: 300 },
    );
  });
});
