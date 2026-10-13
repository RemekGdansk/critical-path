// The only way to change a project. Every edit is a pure function that returns
// either the new project or the Validation Error the edit would create; the
// input project is never mutated, so a rejected edit leaves it as it was.
import { isIsoDate, MAX_ISO_DATE, MIN_ISO_DATE } from "@/lib/services/calendar-date";
import { cyclePathFor, findCycle } from "@/lib/services/task-graph";
import type { DayCountingMode, Project, Task, TaskId } from "@/types";

export const TASK_NAME_MAX_LENGTH = 200;
export const PROJECT_NAME_MAX_LENGTH = TASK_NAME_MAX_LENGTH;

export type ValidationErrorRule =
  | "task-name-empty"
  | "task-name-too-long"
  | "task-name-malformed"
  | "task-name-control-character"
  | "project-name-empty"
  | "project-name-too-long"
  | "project-name-malformed"
  | "project-name-control-character"
  | "unknown-task"
  | "cycle"
  // The model cannot hold these two (START and FINISH are never Tasks), so only
  // a file that spells them out can: the project file import reports them.
  | "start-has-predecessor"
  | "task-depends-on-finish"
  | "duration-not-positive-whole-number"
  | "start-date-not-a-date";

export interface ValidationError {
  rule: ValidationErrorRule;
  message: string;
}

export type EditResult = { ok: true; project: Project } | { ok: false; error: ValidationError };

function accept(project: Project): EditResult {
  return { ok: true, project };
}

function reject(rule: ValidationErrorRule, message: string): EditResult {
  return { ok: false, error: { rule, message } };
}

function rejectWith(error: ValidationError): EditResult {
  return { ok: false, error };
}

function unknownTask(taskId: TaskId): EditResult {
  return reject("unknown-task", `There is no Task with id ${taskId} in the project.`);
}

function findTask(project: Project, taskId: TaskId): Task | undefined {
  return project.tasks.find((task) => task.id === taskId);
}

/** "7: Name" — the id prefix tells apart Tasks that share a name. */
export function taskLabel(task: Task): string {
  return `${task.id}: ${task.name}`;
}

/** "1: A → 2: B → 1: A" — one lookup map, so labelling a long path stays linear. */
function pathLabel(project: Project, path: TaskId[]): string {
  const tasksById = new Map(project.tasks.map((task) => [task.id, task]));
  return path
    .map((id) => {
      const task = tasksById.get(id);
      return task === undefined ? String(id) : taskLabel(task);
    })
    .join(" → ");
}

// Anything but whitespace and invisible format characters (zero-width space,
// joiners, BOM…): a name without one looks empty. Searching for one character
// never backtracks, so a name of millions of invisible characters (from an
// imported file) cannot exhaust the regexp stack as an anchored `^[…]*$` does.
const VISIBLE_CHARACTER = /[^\p{White_Space}\p{Cf}]/u;
// Control characters (tab, line feed…) plus the Unicode line and paragraph separators.
const CONTROL_CHARACTER = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/** The four name rules for one kind of name, and the subject their messages open with. */
interface NameRules {
  subject: string;
  maxLength: number;
  empty: ValidationErrorRule;
  tooLong: ValidationErrorRule;
  malformed: ValidationErrorRule;
  controlCharacter: ValidationErrorRule;
}

const TASK_NAME_RULES: NameRules = {
  subject: "A Task name",
  maxLength: TASK_NAME_MAX_LENGTH,
  empty: "task-name-empty",
  tooLong: "task-name-too-long",
  malformed: "task-name-malformed",
  controlCharacter: "task-name-control-character",
};

const PROJECT_NAME_RULES: NameRules = {
  subject: "A project name",
  maxLength: PROJECT_NAME_MAX_LENGTH,
  empty: "project-name-empty",
  tooLong: "project-name-too-long",
  malformed: "project-name-malformed",
  controlCharacter: "project-name-control-character",
};

/** Returns the Validation Error a trimmed name would create, if any. */
function checkName(name: string, rules: NameRules): ValidationError | undefined {
  const { subject, maxLength } = rules;
  if (!VISIBLE_CHARACTER.test(name)) return { rule: rules.empty, message: `${subject} cannot be empty.` };
  if (name.length > maxLength) {
    return { rule: rules.tooLong, message: `${subject} can be at most ${maxLength} characters.` };
  }
  if (!name.isWellFormed()) {
    return { rule: rules.malformed, message: `${subject} must be well-formed Unicode.` };
  }
  if (CONTROL_CHARACTER.test(name)) {
    return {
      rule: rules.controlCharacter,
      message: `${subject} cannot contain a line break or other control character.`,
    };
  }
  return undefined;
}

function replaceTask(project: Project, updated: Task): Project {
  return { ...project, tasks: project.tasks.map((task) => (task.id === updated.id ? updated : task)) };
}

export function createEmptyProject(): Project {
  return { start: {}, finish: {}, dayCountingMode: "calendar-days", nextTaskId: 1, tasks: [] };
}

export function createTask(project: Project, name: string): EditResult {
  const trimmed = name.trim();
  const nameError = checkName(trimmed, TASK_NAME_RULES);
  if (nameError) return rejectWith(nameError);

  const task: Task = { id: project.nextTaskId, name: trimmed, predecessors: [], status: "to-do" };
  return accept({ ...project, nextTaskId: project.nextTaskId + 1, tasks: [...project.tasks, task] });
}

export function renameTask(project: Project, taskId: TaskId, name: string): EditResult {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);

  const trimmed = name.trim();
  const nameError = checkName(trimmed, TASK_NAME_RULES);
  if (nameError) return rejectWith(nameError);

  return accept(replaceTask(project, { ...task, name: trimmed }));
}

/**
 * Removes the Task and its id from every other Task's predecessors. Its
 * predecessors are not bridged to its successors, and `nextTaskId` is kept so
 * the id is never reused.
 */
export function deleteTask(project: Project, taskId: TaskId): EditResult {
  if (findTask(project, taskId) === undefined) return unknownTask(taskId);

  const tasks = project.tasks
    .filter((task) => task.id !== taskId)
    .map((task) =>
      task.predecessors.includes(taskId)
        ? { ...task, predecessors: task.predecessors.filter((id) => id !== taskId) }
        : task,
    );
  return accept({ ...project, tasks });
}

export function addPredecessor(project: Project, taskId: TaskId, predecessorId: TaskId): EditResult {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);
  const predecessor = findTask(project, predecessorId);
  if (predecessor === undefined) return unknownTask(predecessorId);
  if (task.predecessors.includes(predecessorId)) return accept(project);
  const cycle = cyclePathFor(project, taskId, predecessorId);
  if (cycle !== undefined) {
    return reject(
      "cycle",
      `Adding ${taskLabel(predecessor)} as a predecessor of ${taskLabel(task)} would create the cycle ${pathLabel(project, cycle)}.`,
    );
  }

  const predecessors = [...task.predecessors, predecessorId].toSorted((a, b) => a - b);
  return accept(replaceTask(project, { ...task, predecessors }));
}

export function removePredecessor(project: Project, taskId: TaskId, predecessorId: TaskId): EditResult {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);
  if (!task.predecessors.includes(predecessorId)) return accept(project);

  return accept(
    replaceTask(project, { ...task, predecessors: task.predecessors.filter((id) => id !== predecessorId) }),
  );
}

/** Sets the project name, trimmed, under the project name rules (the Task name rules, worded for the project); empty input clears it by removing the field. */
export function setProjectName(project: Project, input: string): EditResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    const cleared = { ...project };
    delete cleared.name;
    return accept(cleared);
  }
  const nameError = checkName(trimmed, PROJECT_NAME_RULES);
  if (nameError) return rejectWith(nameError);
  return accept({ ...project, name: trimmed });
}

const DURATION_MESSAGE = "A Duration must be a positive whole number of days.";
const START_DATE_MESSAGE = `The START date must be a calendar date from ${MIN_ISO_DATE} to ${MAX_ISO_DATE}.`;

/** True for a Duration the project may hold: a positive whole number of days, exact as a JavaScript number. */
export function isPositiveWholeDays(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

const DIGITS_ONLY = /^[0-9]+$/;

/**
 * Sets the Task's Duration from what the user typed: trimmed, ASCII digits
 * only, a positive whole number of days. Empty input clears the Duration,
 * which is allowed and raises a Validation Warning instead.
 */
export function setDuration(project: Project, taskId: TaskId, input: string): EditResult {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);

  const trimmed = input.trim();
  if (trimmed === "") {
    const cleared = { ...task };
    delete cleared.duration;
    return accept(replaceTask(project, cleared));
  }
  const duration = Number(trimmed);
  if (!DIGITS_ONLY.test(trimmed) || !isPositiveWholeDays(duration)) {
    return reject("duration-not-positive-whole-number", DURATION_MESSAGE);
  }
  return accept(replaceTask(project, { ...task, duration }));
}

/** Sets the START date from an ISO date (yyyy-mm-dd); empty input clears it, so the forecast starts from today. */
export function setStartDate(project: Project, input: string): EditResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    const start = { ...project.start };
    delete start.date;
    return accept({ ...project, start });
  }
  if (!isIsoDate(trimmed)) return reject("start-date-not-a-date", START_DATE_MESSAGE);
  return accept({ ...project, start: { ...project.start, date: trimmed } });
}

/** Sets how Durations count: calendar days or weekdays (Mon–Fri). Any mode suits any project, so it never rejects. */
export function setDayCountingMode(project: Project, mode: DayCountingMode): EditResult {
  if (project.dayCountingMode === mode) return accept(project);
  return accept({ ...project, dayCountingMode: mode });
}

/**
 * The first Validation Error the project already holds, or undefined when it
 * holds none: each Task in array order (its name, its Duration, then each
 * predecessor id), the START date, the project name, and last the cycle, since
 * `findCycle` ignores unknown ids. Assumes the model invariants (unique
 * ascending ids, sorted and unique predecessors); import establishes them first.
 */
export function validateProject(project: Project): ValidationError | undefined {
  const taskIds = new Set(project.tasks.map((task) => task.id));
  for (const task of project.tasks) {
    // By id only: the label would repeat the rejected name inside the message.
    const nameError = checkName(task.name, TASK_NAME_RULES);
    if (nameError) return { rule: nameError.rule, message: `Task ${task.id}: ${nameError.message}` };
    if (task.duration !== undefined && !isPositiveWholeDays(task.duration)) {
      return { rule: "duration-not-positive-whole-number", message: `Task ${taskLabel(task)}: ${DURATION_MESSAGE}` };
    }
    const unknownId = task.predecessors.find((id) => !taskIds.has(id));
    if (unknownId !== undefined) {
      return {
        rule: "unknown-task",
        message: `Task ${taskLabel(task)} depends on Task ${unknownId}, which is not in the project.`,
      };
    }
  }
  if (project.start.date !== undefined && !isIsoDate(project.start.date)) {
    return { rule: "start-date-not-a-date", message: START_DATE_MESSAGE };
  }
  if (project.name !== undefined) {
    const nameError = checkName(project.name, PROJECT_NAME_RULES);
    if (nameError) return nameError;
  }
  const cycle = findCycle(project);
  if (cycle !== undefined) {
    return { rule: "cycle", message: `The project contains the cycle ${pathLabel(project, cycle)}.` };
  }
  return undefined;
}
