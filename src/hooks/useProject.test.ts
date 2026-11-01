// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { type ProjectState, useProject } from "@/hooks/useProject";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  type EditContext,
  type EditResult,
  PROJECT_NAME_MAX_LENGTH,
  setCompletionDate,
  setDuration,
  setProjectName,
  setStartDate,
  setStatus,
  TASK_NAME_MAX_LENGTH,
  type ValidationErrorRule,
} from "@/lib/services/project";
import { parseProjectFile, serializeProject } from "@/lib/services/project-file";
import type { Project } from "@/types";

const TODAY = "2026-09-05";
const CONTEXT: EditContext = { today: TODAY };
/** The hook reads today from here, never from the clock. */
const OPTIONS = { today: () => TODAY };

afterEach(() => {
  cleanup();
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function accepted(result: EditResult): CheckedProject {
  if (!result.ok)
    throw new Error(`Expected the edit to be accepted, got ${result.error.rule}: ${result.error.message}`);
  return result.project;
}

/** "Q3 plan", START 2026-09-01, A (id 1, 5 days) → B (id 2, 3 days); deep-frozen, so any write throws. */
function fixture(): CheckedProject {
  const withA = accepted(setDuration(accepted(createTask(createEmptyProject(CONTEXT), "A", CONTEXT)), 1, "5", CONTEXT));
  const withB = accepted(setDuration(accepted(createTask(withA, "B", CONTEXT)), 2, "3", CONTEXT));
  const dependent = accepted(addPredecessor(withB, 2, 1, CONTEXT));
  return deepFreeze(
    accepted(setProjectName(accepted(setStartDate(dependent, "2026-09-01", CONTEXT)), "Q3 plan", CONTEXT)),
  );
}

/**
 * START 2026-09-01; A (id 1) Done 2026-09-03 → B (id 2) Done 2026-09-04; C (id 3)
 * To Do → D (id 4) To Do; built through the edits as of TODAY and deep-frozen.
 */
function doneFixture(): CheckedProject {
  const created = ["A", "B", "C", "D"].reduce(
    (current, name) => accepted(createTask(current, name, CONTEXT)),
    accepted(setStartDate(createEmptyProject(CONTEXT), "2026-09-01", CONTEXT)),
  );
  const linked = accepted(addPredecessor(accepted(addPredecessor(created, 2, 1, CONTEXT)), 4, 3, CONTEXT));
  const doneA = accepted(setCompletionDate(accepted(setStatus(linked, 1, "done", CONTEXT)), 1, "2026-09-03", CONTEXT));
  return deepFreeze(
    accepted(setCompletionDate(accepted(setStatus(doneA, 2, "done", CONTEXT)), 2, "2026-09-04", CONTEXT)),
  );
}

const UNKNOWN_ID = 99;

interface RejectionRow {
  name: string;
  run: (state: ProjectState) => EditResult;
  rule: ValidationErrorRule;
  /** What the message must say for this rule, taken from the domain's own wording. */
  fragment: string;
}

const rows: RejectionRow[] = [
  {
    name: "addPredecessor closing A → B → A",
    run: (state) => state.addPredecessor(1, 2),
    rule: "cycle",
    fragment: "would create the cycle 1: A → 2: B → 1: A",
  },
  {
    name: "createTask with an empty name",
    run: (state) => state.createTask("\u200B "),
    rule: "task-name-empty",
    fragment: "A Task name cannot be empty",
  },
  {
    name: "renameTask to an empty name",
    run: (state) => state.renameTask(1, "   "),
    rule: "task-name-empty",
    fragment: "A Task name cannot be empty",
  },
  {
    name: "renameTask to a too-long name",
    run: (state) => state.renameTask(1, "a".repeat(TASK_NAME_MAX_LENGTH + 1)),
    rule: "task-name-too-long",
    fragment: `can be at most ${TASK_NAME_MAX_LENGTH} characters`,
  },
  {
    name: "renameTask to a malformed name",
    run: (state) => state.renameTask(1, "A\uD83D"),
    rule: "task-name-malformed",
    fragment: "A Task name must be well-formed Unicode",
  },
  {
    name: "renameTask to a name with a control character",
    run: (state) => state.renameTask(1, "A\nB"),
    rule: "task-name-control-character",
    fragment: "A Task name cannot contain a line break or other control character",
  },
  {
    name: "setProjectName to an invisible name",
    run: (state) => state.setProjectName("\u200B\u200B"),
    rule: "project-name-empty",
    fragment: "A project name cannot be empty",
  },
  {
    name: "setProjectName to a too-long name",
    run: (state) => state.setProjectName("a".repeat(PROJECT_NAME_MAX_LENGTH + 1)),
    rule: "project-name-too-long",
    fragment: `can be at most ${PROJECT_NAME_MAX_LENGTH} characters`,
  },
  {
    name: "setProjectName to a malformed name",
    run: (state) => state.setProjectName("Q3\uD83D"),
    rule: "project-name-malformed",
    fragment: "A project name must be well-formed Unicode",
  },
  {
    name: "setProjectName to a name with a control character",
    run: (state) => state.setProjectName("A\u2028B"),
    rule: "project-name-control-character",
    fragment: "A project name cannot contain a line break or other control character",
  },
  {
    name: "setDuration to a non-whole number",
    run: (state) => state.setDuration(1, "2.5"),
    rule: "duration-not-positive-whole-number",
    fragment: "A Duration must be a positive whole number of days",
  },
  {
    name: "setStartDate to a non-date",
    run: (state) => state.setStartDate("2026-02-30"),
    rule: "start-date-not-a-date",
    fragment: "The START date must be a calendar date",
  },
  {
    name: "renameTask on an unknown Task",
    run: (state) => state.renameTask(UNKNOWN_ID, "C"),
    rule: "unknown-task",
    fragment: `There is no Task with id ${UNKNOWN_ID}`,
  },
  {
    name: "deleteTask on an unknown Task",
    run: (state) => state.deleteTask(UNKNOWN_ID),
    rule: "unknown-task",
    fragment: `There is no Task with id ${UNKNOWN_ID}`,
  },
  {
    name: "addPredecessor on an unknown Task",
    run: (state) => state.addPredecessor(UNKNOWN_ID, 1),
    rule: "unknown-task",
    fragment: `There is no Task with id ${UNKNOWN_ID}`,
  },
  {
    name: "addPredecessor with an unknown predecessor",
    run: (state) => state.addPredecessor(2, UNKNOWN_ID),
    rule: "unknown-task",
    fragment: `There is no Task with id ${UNKNOWN_ID}`,
  },
  {
    name: "removePredecessor on an unknown Task",
    run: (state) => state.removePredecessor(UNKNOWN_ID, 1),
    rule: "unknown-task",
    fragment: `There is no Task with id ${UNKNOWN_ID}`,
  },
  {
    name: "setDuration on an unknown Task",
    run: (state) => state.setDuration(UNKNOWN_ID, "4"),
    rule: "unknown-task",
    fragment: `There is no Task with id ${UNKNOWN_ID}`,
  },
];

/** Rows for the Done rules, run on `doneFixture()` as of TODAY (2026-09-05). */
const doneRows: RejectionRow[] = [
  {
    name: "setStatus reverting A to To Do while its successor B is Done",
    run: (state) => state.setStatus(1, "to-do"),
    rule: "done-predecessor-not-done",
    fragment: "Task 2: B cannot be Done while its predecessor 1: A is not Done.",
  },
  {
    name: "setStatus marking D Done while its predecessor C is To Do",
    run: (state) => state.setStatus(4, "done"),
    rule: "done-predecessor-not-done",
    fragment: "Task 4: D cannot be Done while its predecessor 3: C is not Done.",
  },
  {
    name: "addPredecessor giving Done B the To Do predecessor C",
    run: (state) => state.addPredecessor(2, 3),
    rule: "done-predecessor-not-done",
    fragment: "Task 2: B cannot be Done while its predecessor 3: C is not Done.",
  },
  {
    name: "setCompletionDate after today",
    run: (state) => state.setCompletionDate(2, "2026-09-06"),
    rule: "completion-date-after-today",
    fragment: "Task 2: B has the completion date 2026-09-06, which is after today, 2026-09-05.",
  },
  {
    name: "setCompletionDate before the START date",
    run: (state) => state.setCompletionDate(1, "2026-08-31"),
    rule: "completion-date-before-start-date",
    fragment: "Task 1: A cannot be completed on 2026-08-31, which is before the START date, 2026-09-01.",
  },
  {
    name: "setStartDate after A's completion date",
    run: (state) => state.setStartDate("2026-09-04"),
    rule: "completion-date-before-start-date",
    fragment: "Task 1: A cannot be completed on 2026-09-03, which is before the START date, 2026-09-04.",
  },
  {
    name: "setCompletionDate of B before its predecessor A's",
    run: (state) => state.setCompletionDate(2, "2026-09-02"),
    rule: "completion-date-before-predecessor",
    fragment:
      "Task 2: B has the completion date 2026-09-02, which is before the completion date of its predecessor 1: A, 2026-09-03.",
  },
  {
    name: "setCompletionDate of A after its successor B's",
    run: (state) => state.setCompletionDate(1, "2026-09-05"),
    rule: "completion-date-before-predecessor",
    fragment:
      "Task 2: B has the completion date 2026-09-04, which is before the completion date of its predecessor 1: A, 2026-09-05.",
  },
  {
    name: "setCompletionDate emptying a Done Task's date",
    run: (state) => state.setCompletionDate(1, " "),
    rule: "done-without-completion-date",
    fragment: "A Done Task needs a completion date.",
  },
  {
    name: "setCompletionDate on a To Do Task",
    run: (state) => state.setCompletionDate(3, "2026-09-03"),
    rule: "completion-date-without-done",
    fragment: "Only a Done Task can have a completion date.",
  },
  {
    name: "setCompletionDate to a non-date",
    run: (state) => state.setCompletionDate(1, "2026-02-30"),
    rule: "completion-date-not-a-date",
    fragment: "A completion date must be a calendar date",
  },
  {
    name: "setStatus on an unknown Task",
    run: (state) => state.setStatus(UNKNOWN_ID, "done"),
    rule: "unknown-task",
    fragment: `There is no Task with id ${UNKNOWN_ID}`,
  },
  {
    name: "setCompletionDate on an unknown Task",
    run: (state) => state.setCompletionDate(UNKNOWN_ID, "2026-09-03"),
    rule: "unknown-task",
    fragment: `There is no Task with id ${UNKNOWN_ID}`,
  },
];

function expectRejected(result: EditResult, row: RejectionRow): void {
  if (result.ok) throw new Error(`Expected the edit to be rejected with ${row.rule}`);
  expect(result.error.rule).toBe(row.rule);
  expect(result.error.message).toContain(row.fragment);
  expect(result.error.message).not.toMatch(/invalid|conflict|blocked/i);
}

/** The two rejection cases over `table`, each row run on a fresh `makeFixture()` with Task 1 selected. */
function rejectionCases(table: RejectionRow[], makeFixture: () => CheckedProject): void {
  it.each(table)("$name leaves project, selection and replacements unchanged", (row) => {
    const project = makeFixture();
    const before = structuredClone(project);
    const selectedBefore = project.tasks[0];
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    let edit: EditResult | undefined;
    act(() => {
      edit = row.run(result.current);
    });

    if (edit === undefined) throw new Error("The action did not run");
    expectRejected(edit, row);
    expect(result.current.project).toBe(project);
    expect(result.current.project).toStrictEqual(before);
    expect(result.current.selection).toBe(1);
    expect(result.current.selectedTask).toBe(selectedBefore);
    expect(result.current.replacements).toBe(0);
    expect(result.current.previousProject).toBeUndefined();
  });

  it.each(table)("$name followed by an accepted edit in one event applies only the accepted one", (row) => {
    const project = makeFixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    let rejected: EditResult | undefined;
    let next: EditResult | undefined;
    act(() => {
      rejected = row.run(result.current);
      next = result.current.setDuration(2, "4");
    });

    if (rejected === undefined || next === undefined) throw new Error("The actions did not run");
    expectRejected(rejected, row);
    const expected = accepted(setDuration(project, 2, "4", CONTEXT));
    expect(next).toStrictEqual({ ok: true, project: expected });
    expect(result.current.project).toStrictEqual(expected);
    expect(result.current.selection).toBe(1);
    expect(result.current.selectedTask).toBe(project.tasks[0]);
    expect(result.current.replacements).toBe(0);
  });
}

describe("useProject: a rejected edit commits nothing", () => {
  rejectionCases(rows, fixture);

  it("createTask on a replaced project at the id ceiling is rejected with task-id-limit-reached", () => {
    // Not a row in the table above: it needs a replaced project, not fixture().
    const row: RejectionRow = {
      name: "createTask at the id ceiling",
      run: (state) => state.createTask("One more"),
      rule: "task-id-limit-reached",
      fragment: "no more Tasks can be created",
    };
    const parsed = parseProjectFile(
      serializeProject({ ...createEmptyProject(CONTEXT), nextTaskId: 2147483647 }),
      CONTEXT,
    );
    if (!parsed.ok) throw new Error(`Expected the file to import, got ${parsed.error.rule}`);
    const before = structuredClone(parsed.project);
    const { result } = renderHook(() => useProject(undefined, null, OPTIONS));

    act(() => {
      result.current.replaceProject(parsed.project);
    });
    let edit: EditResult | undefined;
    act(() => {
      edit = row.run(result.current);
    });

    if (edit === undefined) throw new Error("The action did not run");
    expectRejected(edit, row);
    expect(result.current.project).toBe(parsed.project);
    expect(result.current.project).toStrictEqual(before);
  });

  it("two accepted edits in one event apply in sequence, the second to the first's result", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    act(() => {
      result.current.setDuration(1, "6");
      result.current.setDuration(2, "4");
    });

    const expected = accepted(setDuration(accepted(setDuration(project, 1, "6", CONTEXT)), 2, "4", CONTEXT));
    expect(result.current.project).toStrictEqual(expected);
  });
});

describe("useProject: a rejected Done-rule edit commits nothing", () => {
  rejectionCases(doneRows, doneFixture);
});

describe("useProject: setStatus", () => {
  it("marking a Task Done commits today's date as its completion date and keeps the selection", () => {
    const project = doneFixture();
    const { result } = renderHook(() => useProject(project, 3, OPTIONS));

    let edit: EditResult | undefined;
    act(() => {
      edit = result.current.setStatus(3, "done");
    });

    const expected = accepted(setStatus(project, 3, "done", CONTEXT));
    expect(expected.tasks[2]).toStrictEqual({
      id: 3,
      name: "C",
      predecessors: [],
      status: "done",
      completionDate: TODAY,
    });
    expect(edit).toStrictEqual({ ok: true, project: expected });
    expect(result.current.project).toStrictEqual(expected);
    expect(result.current.selection).toBe(3);
    expect(result.current.replacements).toBe(0);
    expect(result.current.previousProject).toBe(project);
  });
});

describe("useProject: setDayCountingMode", () => {
  it("commits the mode and keeps the selection", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    let edit: EditResult | undefined;
    act(() => {
      edit = result.current.setDayCountingMode("weekdays");
    });

    const expected = { ...project, dayCountingMode: "weekdays" };
    expect(edit).toStrictEqual({ ok: true, project: expected });
    expect(result.current.project).toStrictEqual(expected);
    expect(result.current.selection).toBe(1);
    expect(result.current.replacements).toBe(0);
  });
});

describe("useProject: the previous project", () => {
  it("an accepted edit records the project it replaced", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    act(() => {
      result.current.setDuration(2, "4");
    });

    expect(result.current.previousProject).toBe(project);
  });

  it("two accepted edits in one event leave the first edit's result as previous", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    act(() => {
      result.current.setDuration(1, "6");
      result.current.setDuration(2, "4");
    });

    expect(result.current.previousProject).toStrictEqual(accepted(setDuration(project, 1, "6", CONTEXT)));
  });

  it("replaceProject records the replaced project", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    act(() => {
      result.current.replaceProject(createEmptyProject(CONTEXT));
    });

    expect(result.current.previousProject).toBe(project);
  });

  it("restorePreviousProject brings back the replaced project, selects nothing and clears the previous one", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    act(() => {
      result.current.replaceProject(createEmptyProject(CONTEXT));
    });
    act(() => {
      result.current.select(1);
    });
    act(() => {
      result.current.restorePreviousProject();
    });

    expect(result.current.project).toBe(project);
    expect(result.current.selection).toBeNull();
    expect(result.current.selectedTask).toBeUndefined();
    expect(result.current.replacements).toBe(2);
    expect(result.current.previousProject).toBeUndefined();
  });

  it("restorePreviousProject with no previous project changes nothing", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    act(() => {
      result.current.restorePreviousProject();
    });

    expect(result.current.project).toBe(project);
    expect(result.current.selection).toBe(1);
    expect(result.current.replacements).toBe(0);
    expect(result.current.previousProject).toBeUndefined();
  });
});

describe("useProject: only a checked project gets in", () => {
  // The doors are closed by type, so `npx astro check` is the assertion here:
  // each @ts-expect-error fails the type check if the line after it compiles.
  const plain: Project = { start: {}, finish: {}, dayCountingMode: "calendar-days", nextTaskId: 1, tasks: [] };

  it("takes a parsed file or a new empty project, never a plain Project", () => {
    // @ts-expect-error -- a plain Project is not checked
    renderHook(() => useProject(plain, null, OPTIONS));
    const { result } = renderHook(() => useProject(undefined, null, OPTIONS));
    const parsed = parseProjectFile(serializeProject(fixture()), CONTEXT);
    if (!parsed.ok) throw new Error(`Expected the fixture to import, got ${parsed.error.rule}`);

    act(() => {
      result.current.replaceProject(parsed.project);
    });
    act(() => {
      result.current.replaceProject(createEmptyProject(CONTEXT));
    });
    act(() => {
      // @ts-expect-error -- a plain Project is not checked
      result.current.replaceProject(plain);
    });
    expect(result.current.replacements).toBe(3);
  });
});

describe("useProject: unexported changes", () => {
  /** The fixture renamed "Q4 plan", exported and imported: a parsed file unlike the fixture. */
  function parsedOther(): CheckedProject {
    const parsed = parseProjectFile(serializeProject(accepted(setProjectName(fixture(), "Q4 plan", CONTEXT))), CONTEXT);
    if (!parsed.ok) throw new Error(`Expected the file to import, got ${parsed.error.rule}`);
    return parsed.project;
  }

  it("the project the planner opened with has none", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    expect(result.current.hasUnexportedChanges()).toBe(false);
  });

  it("hasUnexportedChanges and markExported keep their identity across commits", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));
    const { hasUnexportedChanges, markExported } = result.current;

    act(() => {
      result.current.setDuration(2, "4");
    });

    expect(result.current.hasUnexportedChanges).toBe(hasUnexportedChanges);
    expect(result.current.markExported).toBe(markExported);
  });

  it("one accepted edit makes them unexported", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    act(() => {
      result.current.setDuration(2, "4");
    });

    expect(result.current.hasUnexportedChanges()).toBe(true);
  });

  it("a rejected edit leaves none", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    act(() => {
      result.current.addPredecessor(1, 2);
    });

    expect(result.current.hasUnexportedChanges()).toBe(false);
  });

  it("an edit committed earlier in the same event counts", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    let unexported: boolean | undefined;
    act(() => {
      result.current.setProjectName("Q4 plan");
      unexported = result.current.hasUnexportedChanges();
    });

    expect(unexported).toBe(true);
  });

  it("a rename and back leaves none, since the file text is the same", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    act(() => {
      result.current.renameTask(1, "A renamed");
    });
    expect(result.current.hasUnexportedChanges()).toBe(true);
    act(() => {
      result.current.renameTask(1, "A");
    });

    expect(result.current.hasUnexportedChanges()).toBe(false);
  });

  it("a Task created and deleted is unexported, since nextTaskId moved", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    act(() => {
      result.current.createTask("C");
    });
    act(() => {
      result.current.deleteTask(3);
    });

    expect(result.current.project.tasks).toStrictEqual(project.tasks);
    expect(result.current.project.nextTaskId).toBe(project.nextTaskId + 1);
    expect(result.current.hasUnexportedChanges()).toBe(true);
  });

  it("a Day counting switch is unexported, and switching back leaves none", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    act(() => {
      result.current.setDayCountingMode("weekdays");
    });
    expect(result.current.hasUnexportedChanges()).toBe(true);
    act(() => {
      result.current.setDayCountingMode("calendar-days");
    });

    expect(result.current.hasUnexportedChanges()).toBe(false);
  });

  it("markExported of the current project leaves none, and a later edit is unexported again", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    act(() => {
      result.current.setDuration(2, "4");
    });
    act(() => {
      result.current.markExported(result.current.project);
    });
    expect(result.current.hasUnexportedChanges()).toBe(false);
    act(() => {
      result.current.setDuration(2, "5");
    });

    expect(result.current.hasUnexportedChanges()).toBe(true);
  });

  it("replaceProject with a parsed file leaves none", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    act(() => {
      result.current.setDuration(2, "4");
    });
    act(() => {
      result.current.replaceProject(parsedOther());
    });

    expect(result.current.hasUnexportedChanges()).toBe(false);
  });

  it("replaceProject with a new empty project leaves none", () => {
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    act(() => {
      result.current.setDuration(2, "4");
    });
    act(() => {
      result.current.replaceProject(createEmptyProject(CONTEXT));
    });

    expect(result.current.hasUnexportedChanges()).toBe(false);
  });

  it("restorePreviousProject leaves the baseline where it was: a restored project unlike the replacement is unexported", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    act(() => {
      result.current.replaceProject(parsedOther());
    });
    act(() => {
      result.current.restorePreviousProject();
    });

    expect(result.current.project).toBe(project);
    expect(result.current.hasUnexportedChanges()).toBe(true);
  });

  it("a restored project that was the one last passed to markExported has none", () => {
    const project = fixture();
    const { result } = renderHook(() => useProject(project, 1, OPTIONS));

    act(() => {
      result.current.replaceProject(parsedOther());
    });
    act(() => {
      result.current.markExported(project);
    });
    act(() => {
      result.current.restorePreviousProject();
    });

    expect(result.current.project).toBe(project);
    expect(result.current.hasUnexportedChanges()).toBe(false);
  });

  it("a baseline that cannot be serialized counts as unexported", () => {
    const malformed = { ...fixture(), tasks: null } as unknown as Project;
    expect(() => serializeProject(malformed)).toThrow();
    const { result } = renderHook(() => useProject(fixture(), 1, OPTIONS));

    act(() => {
      result.current.markExported(malformed);
    });

    expect(result.current.hasUnexportedChanges()).toBe(true);
  });
});
