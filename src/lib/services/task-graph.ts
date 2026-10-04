// Pure structural queries over the task graph. "A → B" means A is a
// predecessor of B. Predecessor ids that match no Task are ignored throughout,
// so every query terminates on an imported file that holds them or a cycle.
import type { Project, Task, TaskId } from "@/types";

/**
 * Each Task's successors in ascending id order, keyed by Task id in ascending
 * id order.
 */
function successorsById(project: Project): Map<TaskId, TaskId[]> {
  const tasks = project.tasks.toSorted((a, b) => a.id - b.id);
  const successors = new Map<TaskId, TaskId[]>(tasks.map((task) => [task.id, []]));
  for (const task of tasks) {
    for (const predecessorId of task.predecessors) successors.get(predecessorId)?.push(task.id);
  }
  return successors;
}

/** Ids of the Tasks reachable from `taskId` along successor edges, `taskId` excluded unless it lies on a cycle. */
function descendantsOf(successors: Map<TaskId, TaskId[]>, taskId: TaskId): Set<TaskId> {
  const reached = new Set<TaskId>();
  const pending = [...(successors.get(taskId) ?? [])];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (reached.has(id)) continue;
    reached.add(id);
    pending.push(...(successors.get(id) ?? []));
  }
  return reached;
}

/**
 * The cycle that making `predecessorId` a predecessor of `taskId` would close,
 * or undefined when it closes none. The cycle is the closed path
 * `[taskId, …, predecessorId, taskId]` in dependency direction: the shortest
 * path from `taskId` to `predecessorId` along successor edges, the one with the
 * lexicographically smallest ids on a tie, followed by `taskId`.
 */
export function cyclePathFor(project: Project, taskId: TaskId, predecessorId: TaskId): TaskId[] | undefined {
  if (predecessorId === taskId) return [taskId, taskId];

  const successors = successorsById(project);
  // Steps from each Task to `predecessorId`, found by walking its ancestors breadth-first.
  const predecessorsById = new Map(project.tasks.map((task) => [task.id, task.predecessors]));
  const distance = new Map<TaskId, number>([[predecessorId, 0]]);
  const queue: TaskId[] = [predecessorId];
  // for…of also visits the ids pushed while it runs.
  for (const id of queue) {
    const steps = (distance.get(id) ?? 0) + 1;
    for (const ancestorId of predecessorsById.get(id) ?? []) {
      if (!successors.has(ancestorId) || distance.has(ancestorId)) continue;
      distance.set(ancestorId, steps);
      queue.push(ancestorId);
    }
  }
  if (!distance.has(taskId)) return undefined;

  // Walk forward from `taskId`, always to the lowest-id successor one step closer.
  const path: TaskId[] = [taskId];
  for (let id = taskId, steps = distance.get(taskId) ?? 0; id !== predecessorId; steps--) {
    const next = successors.get(id)?.find((successorId) => distance.get(successorId) === steps - 1);
    if (next === undefined) return undefined;
    path.push(next);
    id = next;
  }
  path.push(taskId);
  return path;
}

/** `[a, …, a]` rotated to start and end at its lowest id. */
function rotateToLowestId(cycle: TaskId[]): TaskId[] {
  const open = cycle.slice(0, -1);
  const start = open.indexOf(Math.min(...open));
  const rotated = [...open.slice(start), ...open.slice(0, start)];
  return [...rotated, open[start]];
}

/**
 * A cycle the project already holds, or undefined when it holds none: the
 * closed path `[a, …, a]` in dependency direction, rotated to start and end at
 * its lowest id. Deterministic: depth-first over Tasks in ascending id order,
 * following successors in ascending id order, returning the first cycle
 * closed. A Task that is its own predecessor returns `[a, a]`.
 */
export function findCycle(project: Project): TaskId[] | undefined {
  const successors = successorsById(project);
  const finished = new Set<TaskId>();

  for (const rootId of successors.keys()) {
    if (finished.has(rootId)) continue;
    // The current depth-first path, each Task's position on it, and the next successor to try at each depth.
    const path: TaskId[] = [rootId];
    const positions = new Map<TaskId, number>([[rootId, 0]]);
    const nextIndex: number[] = [0];

    while (path.length > 0) {
      const depth = path.length - 1;
      const id = path[depth];
      const nextId = successors.get(id)?.[nextIndex[depth]];
      nextIndex[depth]++;

      if (nextId === undefined) {
        path.pop();
        nextIndex.pop();
        positions.delete(id);
        finished.add(id);
        continue;
      }
      const position = positions.get(nextId);
      if (position !== undefined) return rotateToLowestId([...path.slice(position), nextId]);
      if (finished.has(nextId)) continue;
      positions.set(nextId, path.length);
      path.push(nextId);
      nextIndex.push(0);
    }
  }
  return undefined;
}

export interface PredecessorCandidate {
  task: Task;
  /** True when making this Task a predecessor would close a cycle: it depends on the Task, directly or transitively. */
  closesCycle: boolean;
}

/**
 * Tasks the picker may offer as a predecessor of `taskId`: every Task except
 * itself and its current predecessors, in ascending id order, each flagged
 * when it would close a cycle. Empty when `taskId` is not in the project.
 */
export function predecessorCandidates(project: Project, taskId: TaskId): PredecessorCandidate[] {
  const task = project.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) return [];

  const descendants = descendantsOf(successorsById(project), taskId);
  const current = new Set(task.predecessors);
  return project.tasks
    .filter((candidate) => candidate.id !== taskId && !current.has(candidate.id))
    .toSorted((a, b) => a.id - b.id)
    .map((candidate) => ({ task: candidate, closesCycle: descendants.has(candidate.id) }));
}

/** Ids of the Tasks that have `taskId` as a predecessor, in creation order. */
export function successorsOf(project: Project, taskId: TaskId): TaskId[] {
  return project.tasks.filter((task) => task.predecessors.includes(taskId)).map((task) => task.id);
}
