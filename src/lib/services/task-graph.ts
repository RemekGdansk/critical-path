// Pure structural queries over the task graph. "A → B" means A is a
// predecessor of B.
import type { Project, Task, TaskId } from "@/types";

/**
 * True when making `predecessorId` a predecessor of `taskId` would close a
 * cycle: `predecessorId` is `taskId` itself, or already depends on `taskId`
 * directly or transitively.
 */
export function wouldCreateCycle(project: Project, taskId: TaskId, predecessorId: TaskId): boolean {
  if (predecessorId === taskId) return true;

  const predecessorsById = new Map(project.tasks.map((task) => [task.id, task.predecessors]));
  const visited = new Set<TaskId>();
  const pending: TaskId[] = [predecessorId];

  // Walk the ancestors of `predecessorId`; reaching `taskId` means it depends on `taskId`.
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (visited.has(id)) continue;
    visited.add(id);
    for (const ancestorId of predecessorsById.get(id) ?? []) {
      if (ancestorId === taskId) return true;
      pending.push(ancestorId);
    }
  }
  return false;
}

/**
 * Tasks that can become a predecessor of `taskId`: every Task except itself,
 * its current predecessors and those that would close a cycle, in ascending
 * id order. Empty when `taskId` is not in the project.
 */
export function eligiblePredecessors(project: Project, taskId: TaskId): Task[] {
  const task = project.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) return [];

  const current = new Set(task.predecessors);
  return project.tasks
    .filter((candidate) => !current.has(candidate.id) && !wouldCreateCycle(project, taskId, candidate.id))
    .toSorted((a, b) => a.id - b.id);
}

/** Ids of the Tasks that have `taskId` as a predecessor, in creation order. */
export function successorsOf(project: Project, taskId: TaskId): TaskId[] {
  return project.tasks.filter((task) => task.predecessors.includes(taskId)).map((task) => task.id);
}
