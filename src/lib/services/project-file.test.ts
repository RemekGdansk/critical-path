import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createPerfProject } from "@/lib/services/fixtures";
import { forecast } from "@/lib/services/forecast";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  deleteTask,
  type EditResult,
  setDayCountingMode,
  setDuration,
  setProjectName,
  setStartDate,
  type ValidationErrorRule,
} from "@/lib/services/project";
import {
  type ImportResult,
  parseProjectFile,
  PROJECT_FILE_VERSION,
  projectFileName,
  type ProjectFileRule,
  serializeProject,
} from "@/lib/services/project-file";
import { validationWarnings } from "@/lib/services/validation-warnings";
import type { Project, TaskId } from "@/types";

// "Today" is always passed in, never read from the clock.
const TODAY = "2026-10-11";

// Read as raw bytes from disk: the committed file is the oracle, never regenerated from the exporter.
const GOLDEN = readFileSync(new URL("./golden/project-file-0.1.json", import.meta.url), "utf8");

/** The project the golden file holds, written by hand from the file. */
const GOLDEN_PROJECT: Project = {
  name: "Relaunch – QA ✓",
  start: { date: "2026-11-02" },
  finish: {},
  dayCountingMode: "calendar-days",
  nextTaskId: 7,
  tasks: [
    { id: 1, name: "Design", predecessors: [], duration: 3, status: "to-do" },
    { id: 2, name: "Build", predecessors: [1, 4], duration: 5, status: "to-do" },
    { id: 4, name: "Write copy", predecessors: [], duration: 2, status: "to-do" },
    { id: 5, name: "Launch", predecessors: [2], status: "to-do" },
  ],
};

const GOLDEN_WEEKDAYS = readFileSync(new URL("./golden/project-file-0.1-weekdays.json", import.meta.url), "utf8");

/** The project the weekdays golden file holds, written by hand from the file: a Saturday START date, Task 2 deleted. */
const GOLDEN_WEEKDAYS_PROJECT: Project = {
  name: "Office move – weekdays",
  start: { date: "2026-10-17" },
  finish: {},
  dayCountingMode: "weekdays",
  nextTaskId: 5,
  tasks: [
    { id: 1, name: "Pack", predecessors: [], duration: 2, status: "to-do" },
    { id: 3, name: "Book movers", predecessors: [], duration: 1, status: "to-do" },
    { id: 4, name: "Move", predecessors: [1, 3], duration: 1, status: "to-do" },
  ],
};

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

/** The imported project; the forecast must not throw on it, since the planner runs it during render. */
function imported(result: ImportResult): CheckedProject {
  if (!result.ok) throw new Error(`Expected the import to succeed, got ${result.error.rule}: ${result.error.message}`);
  expect(() => forecast(result.project, TODAY)).not.toThrow();
  return result.project;
}

function expectRejected(result: ImportResult, rule: ValidationErrorRule | ProjectFileRule, fragment: string): void {
  if (result.ok) throw new Error(`Expected the import to be rejected with ${rule}`);
  expect(result.error.rule).toBe(rule);
  expect(result.error.message).toContain(fragment);
  expect(result.error.message).not.toMatch(/invalid|conflict|blocked/i);
}

/** A project with one Task per name, ids 1..n in order. */
function projectWith(...names: string[]): CheckedProject {
  return names.reduce((project, name) => accepted(createTask(project, name)), createEmptyProject());
}

/** Adds `predecessorId → taskId` for each pair. */
function withDependencies(project: CheckedProject, ...pairs: [TaskId, TaskId][]): CheckedProject {
  return pairs.reduce(
    (current, [predecessorId, taskId]) => accepted(addPredecessor(current, taskId, predecessorId)),
    project,
  );
}

/** Exports, imports and re-exports: the project and the text must both come back unchanged. */
function expectRoundTrip(project: Project): void {
  const text = serializeProject(deepFreeze(project));
  const back = imported(parseProjectFile(text));
  expect(back).toStrictEqual(project);
  expect(serializeProject(back)).toBe(text);
}

/** A file as a hand edit sees it: plain JSON values that a test may change before stringifying. */
interface TestFile {
  [key: string]: unknown;
  start: Record<string, unknown>;
  tasks: Record<string, unknown>[];
}

/** A small, acceptable file, written by hand. */
function baseFile(): TestFile {
  return {
    version: "0.1",
    name: "Website relaunch",
    start: { date: "2026-11-02" },
    finish: {},
    dayCountingMode: "calendar-days",
    nextTaskId: 4,
    tasks: [
      { id: 1, name: "Design", predecessors: [], duration: 3, status: "to-do" },
      { id: 2, name: "Build", predecessors: [1], duration: 5, status: "to-do" },
      { id: 3, name: "Test", predecessors: [2], duration: 2, status: "to-do" },
    ],
  };
}

/** The project `baseFile()` holds, written by hand. */
function baseProject(): Project {
  return {
    name: "Website relaunch",
    start: { date: "2026-11-02" },
    finish: {},
    dayCountingMode: "calendar-days",
    nextTaskId: 4,
    tasks: [
      { id: 1, name: "Design", predecessors: [], duration: 3, status: "to-do" },
      { id: 2, name: "Build", predecessors: [1], duration: 5, status: "to-do" },
      { id: 3, name: "Test", predecessors: [2], duration: 2, status: "to-do" },
    ],
  };
}

function fileWith(change: (file: TestFile) => void): string {
  const file = baseFile();
  change(file);
  return JSON.stringify(file, null, 2);
}

function projectWithChange(change: (project: Project) => void): Project {
  const project = baseProject();
  change(project);
  return project;
}

describe("the golden file (format 0.1)", () => {
  it("imports to the project it holds", () => {
    expect(imported(parseProjectFile(GOLDEN))).toStrictEqual(GOLDEN_PROJECT);
  });

  it("is what serializeProject writes for that project, byte for byte", () => {
    expect(serializeProject(deepFreeze(structuredClone(GOLDEN_PROJECT)))).toBe(GOLDEN);
  });

  it("keeps its Validation Warning through import", () => {
    expect(validationWarnings(imported(parseProjectFile(GOLDEN)))).toStrictEqual([
      { rule: "duration-missing", taskId: 5, message: "Launch has no Duration." },
    ]);
  });

  it("mints nextTaskId for the next Task, never a deleted id", () => {
    const project = accepted(createTask(imported(parseProjectFile(GOLDEN)), "Retro"));
    expect(project.tasks.map((task) => task.id)).toEqual([1, 2, 4, 5, 7]);
    expect(project.nextTaskId).toBe(8);
  });
});

describe("the weekdays golden file (format 0.1)", () => {
  it("imports to the project it holds", () => {
    expect(imported(parseProjectFile(GOLDEN_WEEKDAYS))).toStrictEqual(GOLDEN_WEEKDAYS_PROJECT);
  });

  it("is what serializeProject writes for that project, byte for byte", () => {
    expect(serializeProject(deepFreeze(structuredClone(GOLDEN_WEEKDAYS_PROJECT)))).toBe(GOLDEN_WEEKDAYS);
  });
});

describe("serializeProject", () => {
  it("writes the empty project with empty START, FINISH and Task list", () => {
    expect(PROJECT_FILE_VERSION).toBe("0.1");
    expect(serializeProject(createEmptyProject())).toBe(
      [
        "{",
        '  "version": "0.1",',
        '  "start": {},',
        '  "finish": {},',
        '  "dayCountingMode": "calendar-days",',
        '  "nextTaskId": 1,',
        '  "tasks": []',
        "}",
        "",
      ].join("\n"),
    );
  });
});

describe("export then import", () => {
  /** Every US-03 field the model can hold before S-07 but the day-counting mode (its own case below): name, START date, Durations, a cleared one, a deleted id. */
  function fullProject(): CheckedProject {
    let project = withDependencies(
      projectWith("Design", "Build", "Write copy", "Review", "Launch"),
      [1, 2],
      [3, 2],
      [2, 5],
      [4, 5],
    );
    project = accepted(setDuration(project, 1, "3"));
    project = accepted(setDuration(project, 2, "5"));
    project = accepted(setDuration(project, 3, "2"));
    project = accepted(setDuration(project, 5, "8"));
    project = accepted(setDuration(project, 5, ""));
    project = accepted(deleteTask(project, 4));
    project = accepted(setStartDate(project, "2026-11-02"));
    return accepted(setProjectName(project, "Website relaunch – QA ✓"));
  }

  it("gives back every field, and a second export is byte-identical", () => {
    expectRoundTrip(fullProject());
  });

  it("keeps names with emoji and surrogate pairs", () => {
    const project = accepted(setProjectName(projectWith("👩‍💻 Design", "Build 😀"), "🚀 Launch 𝄞"));
    expectRoundTrip(project);
  });

  it("keeps 200-character names", () => {
    const name = `${"a".repeat(198)}😀`;
    expect(name).toHaveLength(200);
    expectRoundTrip(accepted(setProjectName(projectWith(name), name)));
  });

  it("keeps the weekdays day-counting mode", () => {
    expectRoundTrip(accepted(setDayCountingMode(fullProject(), "weekdays")));
  });

  it("keeps a project without a START date or a name", () => {
    expectRoundTrip(withDependencies(projectWith("A", "B"), [1, 2]));
  });

  it("keeps the empty project and the 100-Task performance project", () => {
    expectRoundTrip(createEmptyProject());
    expectRoundTrip(createPerfProject());
  });

  it("mints nextTaskId after import, never the id of the deleted last Task", () => {
    const project = accepted(deleteTask(projectWith("A", "B", "C"), 3));
    const back = imported(parseProjectFile(serializeProject(project)));
    expect(accepted(createTask(back, "D")).tasks.map((task) => task.id)).toEqual([1, 2, 4]);
  });

  it("keeps the Validation Warnings (US-03)", () => {
    const project = fullProject();
    const back = imported(parseProjectFile(serializeProject(project)));
    expect(validationWarnings(back)).toStrictEqual([
      { rule: "duration-missing", taskId: 5, message: "Launch has no Duration." },
    ]);
    expect(validationWarnings(back)).toStrictEqual(validationWarnings(project));
  });
});

describe("parseProjectFile", () => {
  it("accepts the base file of the rejection table", () => {
    expect(imported(parseProjectFile(fileWith(() => undefined)))).toStrictEqual(baseProject());
  });

  it("accepts a file that counts weekdays", () => {
    expect(imported(parseProjectFile(fileWith((file) => (file.dayCountingMode = "weekdays"))))).toStrictEqual({
      ...baseProject(),
      dayCountingMode: "weekdays",
    });
  });

  interface RejectionRow {
    case: string;
    text: string;
    rule: ValidationErrorRule | ProjectFileRule;
    fragment: string;
  }

  const validationErrorRows: RejectionRow[] = [
    {
      case: "a cycle",
      text: fileWith((file) => (file.tasks[0].predecessors = [3])),
      rule: "cycle",
      fragment: "The project contains the cycle 1: Design → 2: Build → 3: Test → 1: Design.",
    },
    {
      case: "a Task that is its own predecessor",
      text: fileWith((file) => (file.tasks[1].predecessors = [1, 2])),
      rule: "cycle",
      fragment: "The project contains the cycle 2: Build → 2: Build.",
    },
    {
      case: "START with a predecessor",
      text: fileWith((file) => (file.start.predecessors = [1])),
      rule: "start-has-predecessor",
      fragment: "START cannot have predecessors",
    },
    {
      case: "START with a predecessor list, before the unknown-key check",
      text: fileWith((file) => (file.start.predecessors = [])),
      rule: "start-has-predecessor",
      fragment: "start.predecessors",
    },
    {
      case: "a Task depending on FINISH",
      text: fileWith((file) => (file.tasks[1].predecessors = [1, "FINISH"])),
      rule: "task-depends-on-finish",
      fragment: "Task 2 depends on FINISH",
    },
    {
      case: "a dependency on an unknown id",
      text: fileWith((file) => (file.tasks[1].predecessors = [1, 9])),
      rule: "unknown-task",
      fragment: "Task 2: Build depends on Task 9, which is not in the project.",
    },
    {
      case: "an empty Task name",
      text: fileWith((file) => (file.tasks[1].name = "   ")),
      rule: "task-name-empty",
      fragment: "Task 2: A Task name cannot be empty.",
    },
    {
      case: "a Task name longer than 200 characters",
      text: fileWith((file) => (file.tasks[1].name = "a".repeat(201))),
      rule: "task-name-too-long",
      fragment: "Task 2: A Task name can be at most 200 characters.",
    },
    {
      case: "a Task name with a lone surrogate",
      // JSON.stringify writes the lone surrogate as the escape \ud800, as a hand edit would.
      text: fileWith((file) => (file.tasks[1].name = "Build\ud800")),
      rule: "task-name-malformed",
      fragment: "Task 2: A Task name must be well-formed Unicode.",
    },
    {
      case: "a Task name with a line break",
      text: fileWith((file) => (file.tasks[1].name = "Build\nTest")),
      rule: "task-name-control-character",
      fragment: "Task 2: A Task name cannot contain a line break or other control character.",
    },
    ...[0, -1, 1.5].map((duration) => ({
      case: `a Duration of ${duration}`,
      text: fileWith((file) => (file.tasks[1].duration = duration)),
      rule: "duration-not-positive-whole-number" as const,
      fragment: "Task 2: Build: A Duration must be a positive whole number of days.",
    })),
    {
      case: "a START date that is not a calendar date",
      text: fileWith((file) => (file.start.date = "2027-02-30")),
      rule: "start-date-not-a-date",
      fragment: "The START date must be a calendar date from 0001-01-01 to 9999-12-31.",
    },
    {
      case: "a project name of invisible characters only",
      text: fileWith((file) => (file.name = "​​")),
      rule: "project-name-empty",
      fragment: "A project name cannot be empty.",
    },
    {
      case: "a project name longer than 200 characters",
      text: fileWith((file) => (file.name = "a".repeat(201))),
      rule: "project-name-too-long",
      fragment: "A project name can be at most 200 characters.",
    },
    {
      case: "a project name with a lone surrogate",
      text: fileWith((file) => (file.name = "Q3\ude00")),
      rule: "project-name-malformed",
      fragment: "A project name must be well-formed Unicode.",
    },
    {
      case: "a project name with a line break",
      text: fileWith((file) => (file.name = "Q3\nLaunch")),
      rule: "project-name-control-character",
      fragment: "A project name cannot contain a line break or other control character.",
    },
  ];

  const fileRuleRows: RejectionRow[] = [
    {
      case: "text that is not JSON",
      text: "not json",
      rule: "file-not-json",
      fragment: "The file is not valid JSON: ",
    },
    { case: "an empty file", text: "", rule: "file-not-json", fragment: "The file is not valid JSON: " },
    {
      case: "a JSON array",
      text: "[]",
      rule: "file-not-a-project",
      fragment: "The file is not a project file: it must hold a JSON object, not a list.",
    },
    {
      case: "a missing version",
      text: fileWith((file) => delete file.version),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: version is missing.",
    },
    {
      case: "a version that is a number",
      text: fileWith((file) => (file.version = 0.1)),
      rule: "file-not-a-project",
      fragment: "version must be text, not a number",
    },
    {
      case: 'version "0.2"',
      text: fileWith((file) => (file.version = "0.2")),
      rule: "file-version-newer",
      fragment: "The file has version 0.2, newer than version 0.1 that this app reads",
    },
    {
      case: 'version "1"',
      text: fileWith((file) => (file.version = "1")),
      rule: "file-version-newer",
      fragment: "The file has version 1, newer than version 0.1 that this app reads",
    },
    // Multi-digit parts compare as integers, not as single characters.
    ...["10", "0.12"].map((version) => ({
      case: `version ${JSON.stringify(version)}`,
      text: fileWith((file) => (file.version = version)),
      rule: "file-version-newer" as const,
      fragment: `The file has version ${version}, newer than version 0.1 that this app reads`,
    })),
    ...["0.0", "00.1", "0.01", "0.1.0", "0.2.1", "v0.1", " 0.1"].map((version) => ({
      case: `version ${JSON.stringify(version)}`,
      text: fileWith((file) => (file.version = version)),
      rule: "file-not-a-project" as const,
      fragment: `version ${JSON.stringify(version)} is not a version this app reads`,
    })),
    {
      case: "an unknown key on a Task",
      text: fileWith((file) => (file.tasks[1].colour = "red")),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: tasks[1].colour is not a known field.",
    },
    {
      case: "an unknown key at the top",
      text: fileWith((file) => (file.forecast = "2026-11-12")),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: forecast is not a known field.",
    },
    // A key or version from the file is repeated quoted, escaped and cut to 40 characters, so it cannot pass for the message.
    {
      case: "an unknown key that reads like a message",
      text: fileWith((file) => (file.tasks[1]["Import succeeded.\nAll good"] = true)),
      rule: "file-not-a-project",
      fragment: 'The file is not a project file: tasks[1]["Import succeeded.\\nAll good"] is not a known field.',
    },
    {
      case: "a very long unknown key",
      text: fileWith((file) => (file["k".repeat(1000)] = true)),
      rule: "file-not-a-project",
      fragment: `The file is not a project file: ["${"k".repeat(40)}…"] is not a known field.`,
    },
    {
      case: "a very long version that is not a version",
      text: fileWith((file) => (file.version = "v".repeat(1000))),
      rule: "file-not-a-project",
      fragment: `The file is not a project file: version "${"v".repeat(40)}…" is not a version this app reads.`,
    },
    {
      case: "a very long newer version",
      text: fileWith((file) => (file.version = "1".repeat(1000))),
      rule: "file-version-newer",
      fragment: `The file has version ${"1".repeat(40)}…, newer than version 0.1 that this app reads`,
    },
    {
      case: "a key on FINISH",
      text: fileWith((file) => (file.finish = { date: "2026-12-01" })),
      rule: "file-not-a-project",
      fragment: "finish.date is not a known field",
    },
    {
      case: "a missing required key",
      text: fileWith((file) => delete file.tasks[2].status),
      rule: "file-not-a-project",
      fragment: "tasks[2].status is missing",
    },
    {
      case: "a null Duration",
      text: fileWith((file) => (file.tasks[1].duration = null)),
      rule: "file-not-a-project",
      fragment: "tasks[1].duration must be a number, not null",
    },
    {
      case: "a Duration written as text",
      text: fileWith((file) => (file.tasks[1].duration = "5")),
      rule: "file-not-a-project",
      fragment: "tasks[1].duration must be a number, not text",
    },
    {
      case: "a null project name",
      text: fileWith((file) => (file.name = null)),
      rule: "file-not-a-project",
      fragment: "name must be text, not null",
    },
    {
      case: "a string id",
      text: fileWith((file) => (file.tasks[0].id = "1")),
      rule: "file-not-a-project",
      fragment: "tasks[0].id must be a positive whole number, not text",
    },
    {
      case: "an id of 0",
      text: fileWith((file) => (file.tasks[0].id = 0)),
      rule: "file-not-a-project",
      fragment: "tasks[0].id must be a positive whole number, not 0",
    },
    {
      case: "a string nextTaskId",
      text: fileWith((file) => (file.nextTaskId = "4")),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: nextTaskId must be a positive whole number, not text.",
    },
    {
      case: "a predecessor written as text",
      text: fileWith((file) => (file.tasks[1].predecessors = ["1"])),
      rule: "file-not-a-project",
      fragment: "tasks[1].predecessors[0] must be a Task id (a positive whole number), not text",
    },
    {
      case: "START in a predecessors list",
      text: fileWith((file) => (file.tasks[0].predecessors = ["START"])),
      rule: "file-not-a-project",
      fragment: "a Task without predecessors already depends on START",
    },
    {
      case: "a Status that does not exist",
      text: fileWith((file) => (file.tasks[0].status = "started")),
      rule: "file-not-a-project",
      fragment: 'tasks[0].status must be one of "to-do", "in-progress", "done"',
    },
    // Malformed shapes the walk must reject with a JSON path, never throw on: an exception would escape the import instead of naming the problem.
    {
      case: "a JSON string",
      text: '"0.1"',
      rule: "file-not-a-project",
      fragment: "The file is not a project file: it must hold a JSON object, not text.",
    },
    ...(["start", "finish", "dayCountingMode", "nextTaskId", "tasks"] as const).map((key) => ({
      case: `a missing ${key}`,
      text: fileWith((file) => Reflect.deleteProperty(file, key)),
      rule: "file-not-a-project" as const,
      fragment: `The file is not a project file: ${key} is missing.`,
    })),
    ...(
      [
        [null, "null"],
        [[], "a list"],
        ["2026-11-02", "text"],
      ] as const
    ).map(([start, type]) => ({
      case: `START written as ${type}`,
      text: fileWith((file) => ((file as Record<string, unknown>).start = start)),
      rule: "file-not-a-project" as const,
      fragment: `The file is not a project file: start must be an object, not ${type}.`,
    })),
    {
      case: "an unknown key on START",
      text: fileWith((file) => (file.start.colour = "red")),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: start.colour is not a known field.",
    },
    {
      case: "a START date written as a number",
      text: fileWith((file) => (file.start.date = 20261102)),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: start.date must be text, not a number.",
    },
    {
      case: "a Task list written as an object",
      text: fileWith((file) => ((file as Record<string, unknown>).tasks = {})),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: tasks must be a list, not an object.",
    },
    {
      case: "a null Task",
      text: fileWith((file) => ((file.tasks as unknown[])[1] = null)),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: tasks[1] must be an object, not null.",
    },
    {
      case: "a predecessors list written as text",
      text: fileWith((file) => (file.tasks[1].predecessors = "1")),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: tasks[1].predecessors must be a list, not text.",
    },
    {
      case: "a null Task name",
      text: fileWith((file) => (file.tasks[1].name = null)),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: tasks[1].name must be text, not null.",
    },
    {
      case: "a completion date written as a number",
      text: fileWith((file) => (file.tasks[1].completionDate = 20261104)),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: tasks[1].completionDate must be text, not a number.",
    },
    {
      case: "a project name written as true",
      text: fileWith((file) => (file.name = true)),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: name must be text, not true or false.",
    },
    {
      case: "a project name written as an object",
      text: fileWith((file) => (file.name = {})),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: name must be text, not an object.",
    },
    {
      case: "a day-counting mode that does not exist",
      text: fileWith((file) => (file.dayCountingMode = "fortnights")),
      rule: "file-not-a-project",
      fragment: 'The file is not a project file: dayCountingMode must be one of "calendar-days", "weekdays".',
    },
    ...[1.5, -1].map((id) => ({
      case: `an id of ${id}`,
      text: fileWith((file) => (file.tasks[0].id = id)),
      rule: "file-not-a-project" as const,
      fragment: `tasks[0].id must be a positive whole number, not ${id}`,
    })),
    {
      case: "a nextTaskId of 1.5",
      text: fileWith((file) => (file.nextTaskId = 1.5)),
      rule: "file-not-a-project",
      fragment: "nextTaskId must be a positive whole number, not 1.5",
    },
    // Ids stay far below Number.MAX_SAFE_INTEGER (9007199254740991), and below nextTaskId's cap of 2147483647.
    ...[2147483647, 9007199254740991].map((id) => ({
      case: `a Task id of ${id}`,
      text: fileWith((file) => (file.tasks[0].id = id)),
      rule: "file-not-a-project" as const,
      fragment: `The file is not a project file: tasks[0].id must be at most 2147483646, not ${id}.`,
    })),
    {
      case: "a predecessor id above the cap",
      text: fileWith((file) => (file.tasks[1].predecessors = [2147483647])),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: tasks[1].predecessors[0] must be at most 2147483646, not 2147483647.",
    },
    {
      case: "a nextTaskId above the cap",
      text: fileWith((file) => (file.nextTaskId = 2147483648)),
      rule: "file-not-a-project",
      fragment: "The file is not a project file: nextTaskId must be at most 2147483647, not 2147483648.",
    },
    {
      case: "a Task depending on FINISH whose id is not a Task id",
      text: fileWith((file) => {
        file.tasks[1].id = "two";
        file.tasks[1].predecessors = ["FINISH"];
      }),
      rule: "task-depends-on-finish",
      fragment: "The Task at tasks[1] depends on FINISH, but no Task can depend on FINISH.",
    },
    {
      case: "duplicate ids",
      text: fileWith((file) => (file.tasks[2].id = 2)),
      rule: "duplicate-task-id",
      fragment: "Two Tasks have the id 2.",
    },
    {
      case: "an In Progress Task",
      text: fileWith((file) => (file.tasks[1].status = "in-progress")),
      rule: "task-status-not-supported-yet",
      fragment: "Task 2 is In Progress, and this version of the app can import only To Do Tasks.",
    },
    {
      case: "a Done Task",
      text: fileWith((file) => (file.tasks[1].status = "done")),
      rule: "task-status-not-supported-yet",
      fragment: "Task 2 is Done, and this version of the app can import only To Do Tasks.",
    },
    {
      case: "a completion date",
      text: fileWith((file) => (file.tasks[1].completionDate = "2026-11-04")),
      rule: "task-status-not-supported-yet",
      fragment: "Task 2 has a completion date, and this version of the app cannot import completion dates yet.",
    },
  ];

  it.each([...validationErrorRows, ...fileRuleRows])("rejects $case", ({ text, rule, fragment }) => {
    expectRejected(parseProjectFile(text), rule, fragment);
  });

  it("passes the engine's message through for text that is not JSON", () => {
    const result = parseProjectFile("{");
    if (result.ok) throw new Error("Expected a rejection");
    expect(result.error.message).toMatch(/^The file is not valid JSON: .+/);
  });

  it("reports the START and FINISH spellings before an unknown key or a non-id entry", () => {
    const finish = fileWith((file) => {
      file.tasks[0].colour = "red";
      file.tasks[2].predecessors = ["x", "FINISH"];
    });
    expectRejected(parseProjectFile(finish), "task-depends-on-finish", "Task 3 depends on FINISH");
    const start = fileWith((file) => {
      file.colour = "red";
      file.start.predecessors = [1];
    });
    expectRejected(parseProjectFile(start), "start-has-predecessor", "START cannot have predecessors");
  });

  it("does not let a __proto__ key through", () => {
    const text = fileWith(() => undefined).replace('"finish": {}', '"finish": { "__proto__": { "date": "x" } }');
    expectRejected(parseProjectFile(text), "file-not-a-project", "finish.__proto__ is not a known field");
  });

  it("rejects a name of ten million invisible characters instead of throwing", () => {
    // An anchored ^[…]*$ check exhausts V8's regexp stack on a run this long (about 30 MB of file).
    const invisible = "​".repeat(10_000_000);
    expectRejected(
      parseProjectFile(fileWith((file) => (file.tasks[1].name = invisible))),
      "task-name-empty",
      "Task 2: A Task name cannot be empty.",
    );
    expectRejected(
      parseProjectFile(fileWith((file) => (file.name = invisible))),
      "project-name-empty",
      "A project name cannot be empty.",
    );
  });

  it("checks the version before the shape", () => {
    const text = fileWith((file) => {
      file.version = "0.2";
      file.colour = "red";
    });
    expectRejected(parseProjectFile(text), "file-version-newer", "0.2");
  });

  it("checks unique ids before the pre-S-07 limits, and those before the Validation Errors", () => {
    const duplicate = fileWith((file) => {
      file.tasks[2].id = 2;
      file.tasks[1].status = "in-progress";
    });
    expectRejected(parseProjectFile(duplicate), "duplicate-task-id", "Two Tasks have the id 2.");
    const inProgress = fileWith((file) => {
      file.tasks[1].status = "in-progress";
      file.tasks[0].predecessors = [7];
    });
    expectRejected(parseProjectFile(inProgress), "task-status-not-supported-yet", "Task 2 is In Progress");
  });

  describe("normalises without loss", () => {
    const rows: { case: string; text: string; project: Project }[] = [
      {
        case: "unsorted predecessors",
        text: fileWith((file) => (file.tasks[2].predecessors = [2, 1])),
        project: projectWithChange((project) => (project.tasks[2].predecessors = [1, 2])),
      },
      {
        case: "duplicate predecessors",
        text: fileWith((file) => (file.tasks[2].predecessors = [2, 1, 2, 1])),
        project: projectWithChange((project) => (project.tasks[2].predecessors = [1, 2])),
      },
      {
        case: "untrimmed names",
        text: fileWith((file) => {
          file.name = "  Website relaunch \t";
          file.tasks[1].name = " Build  ";
        }),
        project: baseProject(),
      },
      {
        case: "Tasks out of id order",
        text: fileWith((file) => file.tasks.reverse()),
        project: baseProject(),
      },
      {
        case: "a nextTaskId not above every id",
        text: fileWith((file) => (file.nextTaskId = 2)),
        project: baseProject(),
      },
      {
        case: "an empty project name",
        text: fileWith((file) => (file.name = "")),
        project: projectWithChange((project) => delete project.name),
      },
      {
        case: "a whitespace-only project name",
        text: fileWith((file) => (file.name = "   ")),
        project: projectWithChange((project) => delete project.name),
      },
    ];

    it.each(rows)("accepts $case", ({ text, project }) => {
      expect(imported(parseProjectFile(text))).toStrictEqual(project);
    });

    it("keeps a higher nextTaskId as it is", () => {
      const text = fileWith((file) => (file.nextTaskId = 10));
      expect(imported(parseProjectFile(text)).nextTaskId).toBe(10);
    });

    it("accepts the largest Task id, raises nextTaskId to its cap, and round-trips", () => {
      const text = fileWith((file) => (file.tasks[2].id = 2147483646));
      const project = imported(parseProjectFile(text));
      expect(project.nextTaskId).toBe(2147483647);
      expect(project.tasks.map((task) => task.id)).toStrictEqual([1, 2, 2147483646]);
      expect(imported(parseProjectFile(serializeProject(project)))).toStrictEqual(project);
    });

    it("at the id ceiling, refuses createTask, so the project's export still imports", () => {
      const project = imported(parseProjectFile(fileWith((file) => (file.nextTaskId = 2147483647))));
      const before = structuredClone(project);

      const result = createTask(project, "One more");
      if (result.ok) throw new Error("Expected createTask to be rejected at the id ceiling");
      expect(result.error).toStrictEqual({
        rule: "task-id-limit-reached",
        message:
          "Task ids go up to 2147483646 and this project has reached that limit, so no more Tasks can be created.",
      });
      expect(project).toStrictEqual(before);
      expect(imported(parseProjectFile(serializeProject(project)))).toStrictEqual(project);
    });

    it("leaves out an absent START date and Duration rather than writing undefined", () => {
      const text = fileWith((file) => {
        file.start = {};
        delete file.tasks[2].duration;
      });
      const project = imported(parseProjectFile(text));
      expect(project.start).toStrictEqual({});
      expect(project.tasks[2]).toStrictEqual({ id: 3, name: "Test", predecessors: [2], status: "to-do" });
    });
  });
});

describe("projectFileName", () => {
  it("replaces each reserved character with a hyphen and appends .json", () => {
    expect(projectFileName("Q3: Launch / EU")).toBe("Q3- Launch - EU.json");
    expect(projectFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a-b-c-d-e-f-g-h-i-j.json");
    expect(projectFileName("//")).toBe("--.json");
  });

  it("keeps a name without reserved characters as it is", () => {
    expect(projectFileName("Relaunch – QA ✓")).toBe("Relaunch – QA ✓.json");
  });
});
