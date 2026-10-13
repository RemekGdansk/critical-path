// The project file, version 0.1: the only place that knows the file format.
// Export writes JSON whose every byte the app controls, in a fixed key order,
// so a re-export is byte-identical, and Prettier leaves it as it is while each
// predecessors list fits in 120 columns (see taskLines). Import runs a pipeline
// of stages, each assuming the previous one passed: parse, version,
// shape, normalise, unique ids, the pre-S-07 limits, then validateProject.
// Only a project that passes every stage is returned.
import { validateProject, type ValidationErrorRule } from "@/lib/services/project";
import type { DayCountingMode, Finish, Project, Start, Task, TaskId, TaskStatus } from "@/types";

export const PROJECT_FILE_VERSION = "0.1";

export type ProjectFileRule =
  "file-not-json" | "file-not-a-project" | "file-version-newer" | "duplicate-task-id" | "task-status-not-supported-yet";

export interface ImportError {
  rule: ValidationErrorRule | ProjectFileRule;
  message: string;
}

export type ImportResult = { ok: true; project: Project } | { ok: false; error: ImportError };

// ---------------------------------------------------------------------------
// Export

/**
 * An object whose opening brace continues the current line: one `"key": value`
 * per entry, indented two spaces past `indent`, a comma after all but the last.
 * A value spanning several lines brings its own indentation after its first line.
 */
function objectLines(entries: [string, string[]][], indent: string): string[] {
  if (entries.length === 0) return ["{}"];
  const lines = ["{"];
  entries.forEach(([key, valueLines], index) => {
    const comma = index < entries.length - 1 ? "," : "";
    const last = valueLines.length - 1;
    valueLines.forEach((line, lineIndex) => {
      const head = lineIndex === 0 ? `${indent}  ${JSON.stringify(key)}: ` : "";
      lines.push(`${head}${line}${lineIndex === last ? comma : ""}`);
    });
  });
  lines.push(`${indent}}`);
  return lines;
}

function taskLines(task: Task, indent: string): string[] {
  const entries: [string, string[]][] = [
    ["id", [String(task.id)]],
    ["name", [JSON.stringify(task.name)]],
    // On one line, as Prettier prints a short number array. Prettier would wrap
    // only a line longer than its print width (120 here, about 20 four-digit ids).
    ["predecessors", [`[${task.predecessors.join(", ")}]`]],
  ];
  if (task.duration !== undefined) entries.push(["duration", [String(task.duration)]]);
  entries.push(["status", [JSON.stringify(task.status)]]);
  if (task.completionDate !== undefined) entries.push(["completionDate", [JSON.stringify(task.completionDate)]]);
  return objectLines(entries, indent);
}

/**
 * The project as version-0.1 JSON: keys in the fixed file order, absent fields
 * left out, two-space indentation, LF line endings and one trailing newline.
 * Non-ASCII characters are written as they are (the file is UTF-8).
 */
export function serializeProject(project: Project): string {
  const entries: [string, string[]][] = [["version", [JSON.stringify(PROJECT_FILE_VERSION)]]];
  if (project.name !== undefined) entries.push(["name", [JSON.stringify(project.name)]]);
  const startEntries: [string, string[]][] =
    project.start.date === undefined ? [] : [["date", [JSON.stringify(project.start.date)]]];
  entries.push(
    ["start", objectLines(startEntries, "  ")],
    ["finish", ["{}"]],
    ["dayCountingMode", [JSON.stringify(project.dayCountingMode)]],
    ["nextTaskId", [String(project.nextTaskId)]],
  );
  if (project.tasks.length === 0) {
    entries.push(["tasks", ["[]"]]);
  } else {
    const taskBlocks = project.tasks.map((task, index) => {
      const lines = taskLines(task, "    ");
      lines[0] = `    ${lines[0]}`;
      if (index < project.tasks.length - 1) lines[lines.length - 1] += ",";
      return lines;
    });
    entries.push(["tasks", ["[", ...taskBlocks.flat(), "  ]"]]);
  }
  return `${objectLines(entries, "").join("\n")}\n`;
}

/** `<name>.json`, with each character a file system may reserve (`/ \ : * ? " < > |`) replaced by `-`. */
export function projectFileName(name: string): string {
  return `${name.replace(/[/\\:*?"<>|]/g, "-")}.json`;
}

// ---------------------------------------------------------------------------
// Import

/** Carries the first error out of the stages; caught only in parseProjectFile. */
class ImportRejection extends Error {
  constructor(readonly importError: ImportError) {
    super(importError.message);
  }
}

function fail(rule: ImportError["rule"], message: string): never {
  throw new ImportRejection({ rule, message });
}

function notAProject(detail: string): never {
  fail("file-not-a-project", `The file is not a project file: ${detail}.`);
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The value of an own key only, so a missing key never reads through to Object.prototype. */
function own(object: JsonObject, key: string): unknown {
  return Object.hasOwn(object, key) ? object[key] : undefined;
}

function isTaskId(value: unknown): value is TaskId {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** The JSON type of a value, as a message names it. */
function jsonType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "string") return "text";
  if (typeof value === "number") return "a number";
  if (typeof value === "boolean") return "true or false";
  return "an object";
}

function at(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

// Text from the file that a message repeats is cut to this many characters, so
// a hand-edited file cannot fill the alert.
const ECHO_LENGTH = 40;

function shortened(text: string): string {
  return text.length > ECHO_LENGTH ? `${text.slice(0, ECHO_LENGTH)}…` : text;
}

/** Text from the file as a message repeats it: shortened, quoted and escaped, so it cannot pass for the message itself. */
function quoted(text: string): string {
  return JSON.stringify(shortened(text));
}

const PLAIN_KEY = /^[A-Za-z_$][\w$]*$/;

/** The path of a key the file holds: `tasks[1].colour`, or `tasks[1]["two words"]` for any other key. */
function keyPath(path: string, key: string): string {
  return PLAIN_KEY.test(key) && key.length <= ECHO_LENGTH ? at(path, key) : `${path}[${quoted(key)}]`;
}

// --- Stage 2: version

// A canonical `major` or `major.minor`: digits only, no leading zeros.
const VERSION = /^(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*))?$/;

function checkVersion(root: JsonObject): void {
  if (!Object.hasOwn(root, "version")) notAProject("version is missing");
  const version = root.version;
  if (typeof version !== "string") notAProject(`version must be text, not ${jsonType(version)}`);
  if (version === PROJECT_FILE_VERSION) return;

  const match = VERSION.exec(version);
  if (match !== null) {
    const [, major, minor = "0"] = match;
    if (Number(major) > 0 || Number(minor) > 1) {
      fail(
        "file-version-newer",
        `The file has version ${shortened(version)}, newer than version ${PROJECT_FILE_VERSION} that this app reads; open it in a newer version of the app.`,
      );
    }
  }
  notAProject(`version ${quoted(version)} is not a version this app reads`);
}

// --- Stage 3a: the START and FINISH spellings, before any generic shape error

/**
 * The model cannot hold START with a predecessor or a Task depending on FINISH,
 * so a hand edit can only spell them: a `predecessors` key on `start`, or
 * "FINISH" in a predecessors list. "START" in a predecessors list is not a Task
 * id. Checked before the shape walk, so these win over "not a known field" and
 * "not a Task id".
 */
function checkStartAndFinish(root: JsonObject): void {
  const start = own(root, "start");
  if (isObject(start) && Object.hasOwn(start, "predecessors")) {
    fail("start-has-predecessor", "START cannot have predecessors, so the file cannot hold start.predecessors.");
  }
  const tasks = own(root, "tasks");
  if (!Array.isArray(tasks)) return;
  for (const [index, task] of tasks.entries()) {
    if (!isObject(task)) continue;
    const predecessors = own(task, "predecessors");
    if (!Array.isArray(predecessors)) continue;
    for (const [entryIndex, entry] of predecessors.entries()) {
      if (entry === "FINISH") {
        // By id only: the name has not been checked yet.
        const id = own(task, "id");
        const label = isTaskId(id) ? `Task ${id}` : `The Task at tasks[${index}]`;
        fail("task-depends-on-finish", `${label} depends on FINISH, but no Task can depend on FINISH.`);
      }
      if (entry === "START") {
        notAProject(
          `tasks[${index}].predecessors[${entryIndex}] is "START", which is not a Task id; a Task without predecessors already depends on START`,
        );
      }
    }
  }
}

// --- Stage 3b: strict shape and types

const ROOT_KEYS = ["version", "name", "start", "finish", "dayCountingMode", "nextTaskId", "tasks"];
const START_KEYS = ["date"];
const TASK_KEYS = ["id", "name", "predecessors", "duration", "status", "completionDate"];
const DAY_COUNTING_MODES: readonly DayCountingMode[] = ["calendar-days", "weekdays"];
const TASK_STATUSES: readonly TaskStatus[] = ["to-do", "in-progress", "done"];

function readObject(value: unknown, path: string, keys: readonly string[]): JsonObject {
  if (!isObject(value)) notAProject(`${path} must be an object, not ${jsonType(value)}`);
  const unknownKey = Object.keys(value).find((key) => !keys.includes(key));
  if (unknownKey !== undefined) notAProject(`${keyPath(path, unknownKey)} is not a known field`);
  return value;
}

function required(object: JsonObject, path: string, key: string): unknown {
  if (!Object.hasOwn(object, key)) notAProject(`${at(path, key)} is missing`);
  return object[key];
}

function readText(value: unknown, path: string): string {
  if (typeof value !== "string") notAProject(`${path} must be text, not ${jsonType(value)}`);
  return value;
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== "number") notAProject(`${path} must be a number, not ${jsonType(value)}`);
  return value;
}

// The largest nextTaskId a file may hold, with every Task id below it. Far below
// Number.MAX_SAFE_INTEGER: a file at that edge would be accepted with an inexact
// nextTaskId, re-export a file it cannot import, and let createTask mint one id twice.
const MAX_NEXT_TASK_ID = 2_147_483_647;
const MAX_TASK_ID = MAX_NEXT_TASK_ID - 1;

function readPositiveWholeNumber(value: unknown, path: string, max: number, what = "a positive whole number"): number {
  if (isTaskId(value)) {
    if (value <= max) return value;
    notAProject(`${path} must be at most ${max}, not ${value}`);
  }
  notAProject(`${path} must be ${what}, not ${typeof value === "number" ? String(value) : jsonType(value)}`);
}

function readOneOf<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  const match = options.find((option) => option === value);
  if (match === undefined) {
    notAProject(`${path} must be one of ${options.map((option) => JSON.stringify(option)).join(", ")}`);
  }
  return match;
}

function readStart(value: unknown): Start {
  const start = readObject(value, "start", START_KEYS);
  return Object.hasOwn(start, "date") ? { date: readText(start.date, "start.date") } : {};
}

function readFinish(value: unknown): Finish {
  readObject(value, "finish", []);
  return {};
}

function readTask(value: unknown, path: string): Task {
  const object = readObject(value, path, TASK_KEYS);
  const id = readPositiveWholeNumber(required(object, path, "id"), at(path, "id"), MAX_TASK_ID);
  const name = readText(required(object, path, "name"), at(path, "name"));
  const predecessorsPath = at(path, "predecessors");
  const predecessorsValue = required(object, path, "predecessors");
  if (!Array.isArray(predecessorsValue)) {
    notAProject(`${predecessorsPath} must be a list, not ${jsonType(predecessorsValue)}`);
  }
  const predecessors = predecessorsValue.map((entry: unknown, index) =>
    readPositiveWholeNumber(entry, `${predecessorsPath}[${index}]`, MAX_TASK_ID, "a Task id (a positive whole number)"),
  );

  const task: Task = { id, name, predecessors, status: "to-do" };
  if (Object.hasOwn(object, "duration")) task.duration = readNumber(object.duration, at(path, "duration"));
  task.status = readOneOf(required(object, path, "status"), at(path, "status"), TASK_STATUSES);
  if (Object.hasOwn(object, "completionDate")) {
    task.completionDate = readText(object.completionDate, at(path, "completionDate"));
  }
  return task;
}

function readProject(root: JsonObject): Project {
  readObject(root, "", ROOT_KEYS);
  const name = Object.hasOwn(root, "name") ? readText(root.name, "name") : undefined;
  const start = readStart(required(root, "", "start"));
  const finish = readFinish(required(root, "", "finish"));
  const dayCountingMode = readOneOf(required(root, "", "dayCountingMode"), "dayCountingMode", DAY_COUNTING_MODES);
  const nextTaskId = readPositiveWholeNumber(required(root, "", "nextTaskId"), "nextTaskId", MAX_NEXT_TASK_ID);
  const tasksValue = required(root, "", "tasks");
  if (!Array.isArray(tasksValue)) notAProject(`tasks must be a list, not ${jsonType(tasksValue)}`);
  const tasks = tasksValue.map((task: unknown, index) => readTask(task, `tasks[${index}]`));

  const project: Project = { start, finish, dayCountingMode, nextTaskId, tasks };
  if (name !== undefined) project.name = name;
  return project;
}

// --- Stage 4: lossless normalisation

function normalise(project: Project): Project {
  const tasks = project.tasks
    .map((task) => ({
      ...task,
      name: task.name.trim(),
      predecessors: [...new Set(task.predecessors)].toSorted((a, b) => a - b),
    }))
    .toSorted((a, b) => a.id - b.id);
  const maxId = tasks.reduce((max, task) => Math.max(max, task.id), 0);
  const normalised: Project = { ...project, tasks, nextTaskId: Math.max(project.nextTaskId, maxId + 1) };

  delete normalised.name;
  const name = project.name?.trim();
  // An empty name is how an unnamed project would be spelled by hand: it means "unset".
  if (name !== undefined && name !== "") normalised.name = name;
  return normalised;
}

// --- Stages 5 and 6: unique ids, and what S-07 has not built yet

function checkUniqueIds(project: Project): void {
  // Tasks are ordered by id, so a duplicate sits next to its twin.
  const duplicate = project.tasks.find((task, index) => index > 0 && project.tasks[index - 1].id === task.id);
  if (duplicate !== undefined) fail("duplicate-task-id", `Two Tasks have the id ${duplicate.id}.`);
}

const STATUS_NAMES: Record<TaskStatus, string> = { "to-do": "To Do", "in-progress": "In Progress", done: "Done" };

function checkSupportedYet(project: Project): void {
  // By id only: the name rules run later, in validateProject, so the name may not be fit to show yet.
  for (const task of project.tasks) {
    if (task.status !== "to-do") {
      fail(
        "task-status-not-supported-yet",
        `Task ${task.id} is ${STATUS_NAMES[task.status]}, and this version of the app can import only To Do Tasks.`,
      );
    }
    if (task.completionDate !== undefined) {
      fail(
        "task-status-not-supported-yet",
        `Task ${task.id} has a completion date, and this version of the app cannot import completion dates yet.`,
      );
    }
  }
}

function importProject(data: unknown): Project {
  if (!isObject(data)) notAProject(`it must hold a JSON object, not ${jsonType(data)}`);
  checkVersion(data);
  checkStartAndFinish(data);
  const project = normalise(readProject(data));
  checkUniqueIds(project);
  checkSupportedYet(project);
  const error = validateProject(project);
  if (error !== undefined) fail(error.rule, error.message);
  return project;
}

/**
 * The project a version-0.1 file holds, or the first error that stops it from
 * being imported. An accepted project holds every model invariant (unique Task
 * ids in ascending order, sorted and unique predecessors, `nextTaskId` above
 * every id) and no Validation Error; it may hold Validation Warnings.
 */
export function parseProjectFile(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { rule: "file-not-json", message: `The file is not valid JSON: ${detail}` } };
  }
  try {
    return { ok: true, project: importProject(data) };
  } catch (error) {
    if (error instanceof ImportRejection) return { ok: false, error: error.importError };
    throw error;
  }
}
