// The only way to change a project. Every edit is a pure function that returns
// either the new project or the Validation Error the edit would create; the
// input project is never mutated, so a rejected edit leaves it as it was.
// Which Validation Errors a project holds is decided by one rule list,
// `TASK_CHECKS` and `PROJECT_CHECKS` at the end of this module. Only this module
// mints a `CheckedProject`: through an accepted edit, `createEmptyProject`, or
// the two doors for a project no edit built, `checkProject` and `toCheckedProject`.
import { isIsoDate, MAX_ISO_DATE, MIN_ISO_DATE } from "@/lib/services/calendar-date";
import { cyclePathFor, findCycle } from "@/lib/services/task-graph";
import type { DayCountingMode, Project, Task, TaskId } from "@/types";

export const TASK_NAME_MAX_LENGTH = 200;
export const PROJECT_NAME_MAX_LENGTH = TASK_NAME_MAX_LENGTH;

// The largest nextTaskId a project may hold, with every Task id below it. Far below
// Number.MAX_SAFE_INTEGER: a file at that edge would be accepted with an inexact
// nextTaskId, re-export a file it cannot import, and let createTask mint one id twice.
export const MAX_NEXT_TASK_ID = 2_147_483_647;
export const MAX_TASK_ID = MAX_NEXT_TASK_ID - 1;

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
  | "task-id-limit-reached"
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

declare const checked: unique symbol;

/**
 * A Project the guardian found free of Validation Errors. Only this module mints one.
 * Limit: the brand survives a spread, so `{ ...project, tasks }` still type-checks as checked.
 */
export type CheckedProject = Project & { readonly [checked]: true };

export type EditResult = { ok: true; project: CheckedProject } | { ok: false; error: ValidationError };

/**
 * What an edit or door needs from outside the project: today, as an ISO date
 * (yyyy-mm-dd) of the local day. Passed in, never read from the clock here.
 */
export interface EditContext {
  today: string;
}

/** Words a rule's message for the edit that broke it; undefined keeps the rule's own message. */
type Explanations = Partial<Record<ValidationErrorRule, () => string | undefined>>;

/**
 * The guardian, and the only way an edit is accepted: it checks the whole
 * candidate project, not the rule the edit expects to break. The input of the
 * edit held no Validation Error, so the first one the candidate holds is the
 * edit's doing. Throws ProjectInvariantBreach on a broken model shape.
 */
function accept(
  candidate: Project,
  context: EditContext,
  explain?: Explanations,
  wording: Wording = "edit",
): EditResult {
  assertModelShape(candidate);
  const error = firstValidationError(candidate, context, wording);
  if (error === undefined) return { ok: true, project: candidate as CheckedProject };
  return rejectWith({ ...error, message: explain?.[error.rule]?.() ?? error.message });
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

export function createEmptyProject(context: EditContext): CheckedProject {
  return toCheckedProject(
    { start: {}, finish: {}, dayCountingMode: "calendar-days", nextTaskId: 1, tasks: [] },
    context,
  );
}

/**
 * Import's door: the guardian on a project no edit built, in file wording.
 * Throws ProjectInvariantBreach on a broken model shape.
 */
export function checkProject(project: Project, context: EditContext): EditResult {
  return accept(project, context, undefined, "file");
}

/** For hand-built fixtures: throws ProjectInvariantBreach unless the guardian accepts the project. */
export function toCheckedProject(project: Project, context: EditContext): CheckedProject {
  const result = checkProject(project, context);
  if (!result.ok) throw new ProjectInvariantBreach(result.error);
  return result.project;
}

export function createTask(project: CheckedProject, name: string, context: EditContext): EditResult {
  const task: Task = { id: project.nextTaskId, name: name.trim(), predecessors: [], status: "to-do" };
  return accept({ ...project, nextTaskId: project.nextTaskId + 1, tasks: [...project.tasks, task] }, context);
}

export function renameTask(project: CheckedProject, taskId: TaskId, name: string, context: EditContext): EditResult {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);

  return accept(replaceTask(project, { ...task, name: name.trim() }), context);
}

/**
 * Removes the Task and its id from every other Task's predecessors. Its
 * predecessors are not bridged to its successors, and `nextTaskId` is kept so
 * the id is never reused.
 */
export function deleteTask(project: CheckedProject, taskId: TaskId, context: EditContext): EditResult {
  if (findTask(project, taskId) === undefined) return unknownTask(taskId);

  const tasks = project.tasks
    .filter((task) => task.id !== taskId)
    .map((task) =>
      task.predecessors.includes(taskId)
        ? { ...task, predecessors: task.predecessors.filter((id) => id !== taskId) }
        : task,
    );
  return accept({ ...project, tasks }, context);
}

export function addPredecessor(
  project: CheckedProject,
  taskId: TaskId,
  predecessorId: TaskId,
  context: EditContext,
): EditResult {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);
  const predecessor = findTask(project, predecessorId);
  if (predecessor === undefined) return unknownTask(predecessorId);
  if (task.predecessors.includes(predecessorId)) return accept(project, context);

  const predecessors = [...task.predecessors, predecessorId].toSorted((a, b) => a - b);
  return accept(replaceTask(project, { ...task, predecessors }), context, {
    // The shortest cycle through the new dependency, starting at the Task (US-01).
    cycle: () => {
      const cycle = cyclePathFor(project, taskId, predecessorId);
      return cycle === undefined
        ? undefined
        : `Adding ${taskLabel(predecessor)} as a predecessor of ${taskLabel(task)} would create the cycle ${pathLabel(project, cycle)}.`;
    },
  });
}

export function removePredecessor(
  project: CheckedProject,
  taskId: TaskId,
  predecessorId: TaskId,
  context: EditContext,
): EditResult {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);
  if (!task.predecessors.includes(predecessorId)) return accept(project, context);

  return accept(
    replaceTask(project, { ...task, predecessors: task.predecessors.filter((id) => id !== predecessorId) }),
    context,
  );
}

/** Sets the project name, trimmed, under the project name rules (the Task name rules, worded for the project); empty input clears it by removing the field. */
export function setProjectName(project: CheckedProject, input: string, context: EditContext): EditResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    const cleared = { ...project };
    delete cleared.name;
    return accept(cleared, context);
  }
  return accept({ ...project, name: trimmed }, context);
}

const DURATION_MESSAGE = "A Duration must be a positive whole number of days.";
const START_DATE_MESSAGE = `The START date must be a calendar date from ${MIN_ISO_DATE} to ${MAX_ISO_DATE}.`;

/** The Validation Error for a START date that is not a date; the view also shows it for a date the browser cannot read. */
export function startDateNotADate(): ValidationError {
  return { rule: "start-date-not-a-date", message: START_DATE_MESSAGE };
}

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
export function setDuration(project: CheckedProject, taskId: TaskId, input: string, context: EditContext): EditResult {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);

  const trimmed = input.trim();
  if (trimmed === "") {
    const cleared = { ...task };
    delete cleared.duration;
    return accept(replaceTask(project, cleared), context);
  }
  // Parsing only: "0" or a 20-digit number parse, and the rule list rejects them.
  if (!DIGITS_ONLY.test(trimmed)) return reject("duration-not-positive-whole-number", DURATION_MESSAGE);
  return accept(replaceTask(project, { ...task, duration: Number(trimmed) }), context);
}

/** Sets the START date from an ISO date (yyyy-mm-dd); empty input clears it, so the forecast starts from today. */
export function setStartDate(project: CheckedProject, input: string, context: EditContext): EditResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    const start = { ...project.start };
    delete start.date;
    return accept({ ...project, start }, context);
  }
  return accept({ ...project, start: { ...project.start, date: trimmed } }, context);
}

/** Every day-counting mode, in the order the planner's Day counting control lists them. */
export const DAY_COUNTING_MODES: readonly DayCountingMode[] = ["calendar-days", "weekdays"];

export function isDayCountingMode(value: string): value is DayCountingMode {
  return DAY_COUNTING_MODES.some((mode) => mode === value);
}

/** Sets how Durations count: calendar days or weekdays (Mon–Fri). Any mode suits any project. */
export function setDayCountingMode(project: CheckedProject, mode: DayCountingMode, context: EditContext): EditResult {
  if (project.dayCountingMode === mode) return accept(project, context);
  return accept({ ...project, dayCountingMode: mode }, context);
}

/** A model invariant the project breaks, named for the first violation found. */
interface ModelShapeFault {
  rule: "model-shape";
  message: string;
}

/**
 * Thrown when a project breaks a model invariant (unique ascending Task ids,
 * sorted predecessors, `nextTaskId` above every id) or holds a Validation Error
 * where the aggregate was promised none. A code bug, never a user mistake.
 */
export class ProjectInvariantBreach extends Error {
  override readonly name = "ProjectInvariantBreach";
  readonly fault: ValidationError | ModelShapeFault;

  constructor(fault: ValidationError | ModelShapeFault) {
    super(fault.message);
    this.fault = fault;
  }
}

function modelShapeBreach(message: string): ProjectInvariantBreach {
  return new ProjectInvariantBreach({ rule: "model-shape", message });
}

/**
 * Throws ProjectInvariantBreach unless the model invariants no user action can
 * break hold: Task ids and each Task's predecessors strictly ascending (so
 * unique), and `nextTaskId` above every Task id.
 */
function assertModelShape(project: Project): void {
  let lastId: TaskId | undefined;
  for (const task of project.tasks) {
    if (lastId !== undefined && task.id <= lastId) {
      throw modelShapeBreach(`Task ids must be strictly ascending: Task ${task.id} follows Task ${lastId}.`);
    }
    lastId = task.id;
  }
  for (const task of project.tasks) {
    const unsorted = task.predecessors.findIndex((id, i) => i > 0 && id <= task.predecessors[i - 1]);
    if (unsorted !== -1) {
      throw modelShapeBreach(
        `The predecessors of Task ${task.id} must be strictly ascending: ${task.predecessors[unsorted]} follows ${task.predecessors[unsorted - 1]}.`,
      );
    }
  }
  if (lastId !== undefined && project.nextTaskId <= lastId) {
    throw modelShapeBreach(
      `nextTaskId must be above every Task id: it is ${project.nextTaskId}, and Task ${lastId} exists.`,
    );
  }
}

/**
 * Who reads the message. An edit already points at its Task, so its messages
 * name the rule alone; a file's messages also name the Task they found.
 */
type Wording = "edit" | "file";

/** The project under check, its Task lookup and today, built once per walk. */
interface ProjectIndex {
  project: Project;
  tasksById: ReadonlyMap<TaskId, Task>;
  today: string;
}

type TaskCheck = (task: Task, index: ProjectIndex, wording: Wording) => ValidationError | undefined;
type ProjectCheck = (index: ProjectIndex, wording: Wording) => ValidationError | undefined;

/**
 * The rules about one Task, run Task by Task in array order. A new Validation
 * Error rule about a Task is one entry here, in reporting order.
 */
const TASK_CHECKS: readonly TaskCheck[] = [
  (task, _index, wording) => {
    const error = checkName(task.name, TASK_NAME_RULES);
    // By id only: the label would repeat the rejected name inside the message.
    return error && wording === "file" ? { ...error, message: `Task ${task.id}: ${error.message}` } : error;
  },
  (task, _index, wording) =>
    task.duration === undefined || isPositiveWholeDays(task.duration)
      ? undefined
      : {
          rule: "duration-not-positive-whole-number",
          message: wording === "file" ? `Task ${taskLabel(task)}: ${DURATION_MESSAGE}` : DURATION_MESSAGE,
        },
  (task, { tasksById }) => {
    const unknownId = task.predecessors.find((id) => !tasksById.has(id));
    return unknownId === undefined
      ? undefined
      : {
          rule: "unknown-task",
          message: `Task ${taskLabel(task)} depends on Task ${unknownId}, which is not in the project.`,
        };
  },
];

/**
 * The rules about the whole project, run after every Task passed. A new
 * Validation Error rule about the project is one entry here, in reporting order.
 */
const PROJECT_CHECKS: readonly ProjectCheck[] = [
  ({ project }) =>
    project.start.date === undefined || isIsoDate(project.start.date) ? undefined : startDateNotADate(),
  ({ project }) => (project.name === undefined ? undefined : checkName(project.name, PROJECT_NAME_RULES)),
  // Only createTask reaches it: import's shape stage rejects a file above the ceiling first.
  ({ project }) =>
    project.nextTaskId <= MAX_NEXT_TASK_ID
      ? undefined
      : {
          rule: "task-id-limit-reached",
          message: `Task ids go up to ${MAX_TASK_ID} and this project has reached that limit, so no more Tasks can be created.`,
        },
  // Last, since `findCycle` ignores the unknown ids the Task checks report.
  ({ project }) => {
    const cycle = findCycle(project);
    return cycle === undefined
      ? undefined
      : { rule: "cycle", message: `The project contains the cycle ${pathLabel(project, cycle)}.` };
  },
];

function firstValidationError(project: Project, context: EditContext, wording: Wording): ValidationError | undefined {
  const index: ProjectIndex = {
    project,
    tasksById: new Map(project.tasks.map((task) => [task.id, task])),
    today: context.today,
  };
  for (const task of project.tasks) {
    for (const check of TASK_CHECKS) {
      const error = check(task, index, wording);
      if (error) return error;
    }
  }
  for (const check of PROJECT_CHECKS) {
    const error = check(index, wording);
    if (error) return error;
  }
  return undefined;
}

/**
 * The first Validation Error the project already holds, worded for a file, or
 * undefined when it holds none. It walks the aggregate's one rule list:
 * `TASK_CHECKS` for each Task in array order, then `PROJECT_CHECKS`. Assumes
 * the model invariants (unique ascending ids, sorted and unique predecessors);
 * import establishes them first.
 */
export function validateProject(project: Project, context: EditContext): ValidationError | undefined {
  return firstValidationError(project, context, "file");
}
