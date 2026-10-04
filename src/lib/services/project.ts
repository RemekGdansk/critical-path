// The only way to change a project. Every edit is a pure function that returns
// either the new project or the Validation Error the edit would create; the
// input project is never mutated, so a rejected edit leaves it as it was.
import { cyclePathFor } from "@/lib/services/task-graph";
import type { Project, Task, TaskId } from "@/types";

export const TASK_NAME_MAX_LENGTH = 200;

export type ValidationErrorRule =
  | "task-name-empty"
  | "task-name-too-long"
  | "task-name-malformed"
  | "task-name-control-character"
  | "unknown-task"
  | "cycle";

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

// Whitespace and invisible format characters (zero-width space, joiners, BOM…):
// a name made only of these looks empty.
const INVISIBLE_ONLY = /^[\p{White_Space}\p{Cf}]*$/u;
// Control characters (tab, line feed…) plus the Unicode line and paragraph separators.
const CONTROL_CHARACTER = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/** Returns the Validation Error a trimmed Task name would create, if any. */
function checkTaskName(name: string): EditResult | undefined {
  if (INVISIBLE_ONLY.test(name)) return reject("task-name-empty", "A Task name cannot be empty.");
  if (name.length > TASK_NAME_MAX_LENGTH) {
    return reject("task-name-too-long", `A Task name can be at most ${TASK_NAME_MAX_LENGTH} characters.`);
  }
  if (!name.isWellFormed()) return reject("task-name-malformed", "A Task name cannot contain an incomplete character.");
  if (CONTROL_CHARACTER.test(name)) {
    return reject("task-name-control-character", "A Task name cannot contain a line break or other control character.");
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
  const nameError = checkTaskName(trimmed);
  if (nameError) return nameError;

  const task: Task = { id: project.nextTaskId, name: trimmed, predecessors: [], status: "to-do" };
  return accept({ ...project, nextTaskId: project.nextTaskId + 1, tasks: [...project.tasks, task] });
}

export function renameTask(project: Project, taskId: TaskId, name: string): EditResult {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);

  const trimmed = name.trim();
  const nameError = checkTaskName(trimmed);
  if (nameError) return nameError;

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
