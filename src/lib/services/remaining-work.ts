// The schedule of the remaining (not-Done) work: the single longest-path
// calculation, shared by the forecast and the diagram, so the highlighted
// critical path, the critical-path and total-work times and the
// Resource-Unconstrained Project Finish Date can never disagree.
import { topologicalOrder } from "@/lib/services/task-graph";
import { validationWarnings } from "@/lib/services/validation-warnings";
import type { Project, Task, TaskId } from "@/types";

/** Whole days (or weekdays) from the base date, or too large to count exactly. */
export type RemainingWorkTime = { kind: "days"; days: number } | { kind: "too-large" };

/** `predecessorId->taskId`: one dependency between two Tasks. */
export type TaskLinkId = `${TaskId}->${TaskId}`;

/** The one way a dependency's TaskLinkId is spelled, predecessor first. */
export function taskLinkId(predecessorId: TaskId, taskId: TaskId): TaskLinkId {
  return `${predecessorId}->${taskId}`;
}

export type RemainingWork =
  | { kind: "withheld" }
  | {
      kind: "scheduled";
      /** The length of the longest chain of remaining work. */
      criticalPathTime: RemainingWorkTime;
      /** All remaining work one after another. */
      totalWorkTime: RemainingWorkTime;
      /** The not-Done Tasks with zero slack: on some longest chain. */
      criticalTaskIds: ReadonlySet<TaskId>;
      /** Each dependency on some longest chain. */
      criticalLinks: ReadonlySet<TaskLinkId>;
    };

interface ScheduledTask {
  task: Task;
  duration: number;
  startDay: number;
  finishDay: number;
}

/** A sum past Number.MAX_SAFE_INTEGER has lost precision, so it is never shown as a count. */
function remainingWorkTime(days: number): RemainingWorkTime {
  return Number.isSafeInteger(days) ? { kind: "days", days } : { kind: "too-large" };
}

/**
 * The schedule of the remaining work from the graph, the Durations and the
 * Statuses, or withheld while a Validation Warning exists. Days are whole-day
 * offsets from the base date in the project's unit; the base date is not an
 * input, since it shifts every remaining Task by the same offset.
 *
 * A Task starts on the day its last predecessor finishes and finishes Duration
 * days later. A Done Task is not remaining work: it counts as finishing on the
 * base date (offset 0), which the Done rules make exact (a completion date is
 * never after today nor before the START date, so the base date is today
 * whenever a Task is Done). Those rules join the aggregate's rule list in S-07;
 * until then a `CheckedProject` does not vouch for them. A Done Task is never
 * critical.
 *
 * A Task is critical when its earliest start equals its latest start (zero
 * slack). A dependency `u → v` is critical only when both Tasks are critical
 * and `u` finishes on the day `v` starts: two critical endpoints are not
 * enough. When the critical-path time is too large to count, no Task or link
 * is critical, since the day comparisons are no longer exact.
 *
 * Throws "The project contains a cycle." on a cycle, as `topologicalOrder`
 * does; a `CheckedProject` never holds one.
 */
export function remainingWork(project: Pick<Project, "tasks">): RemainingWork {
  if (validationWarnings(project).length > 0) return { kind: "withheld" };

  const tasksById = new Map<TaskId, Task>(project.tasks.map((task) => [task.id, task]));
  // Forward pass, in topological order. Day sums stay plain numbers until one conversion each.
  const finishDayById = new Map<TaskId, number>();
  const scheduled: ScheduledTask[] = [];
  let latestFinishDay = 0;
  let totalWorkDays = 0;

  for (const taskId of topologicalOrder(project)) {
    const task = tasksById.get(taskId);
    if (task === undefined) continue;
    if (task.status === "done") {
      finishDayById.set(taskId, 0);
      continue;
    }
    // validationWarnings withheld the schedule for any not-Done Task without one.
    const duration = task.duration;
    if (duration === undefined) throw new Error(`Task ${taskId} has no Duration.`);

    let startDay = 0;
    for (const predecessorId of task.predecessors) startDay = Math.max(startDay, finishDayById.get(predecessorId) ?? 0);
    const finishDay = startDay + duration;
    finishDayById.set(taskId, finishDay);
    scheduled.push({ task, duration, startDay, finishDay });
    latestFinishDay = Math.max(latestFinishDay, finishDay);
    totalWorkDays += duration;
  }

  const criticalPathTime = remainingWorkTime(latestFinishDay);
  const totalWorkTime = remainingWorkTime(totalWorkDays);
  const criticalTaskIds = new Set<TaskId>();
  const criticalLinks = new Set<TaskLinkId>();

  if (criticalPathTime.kind === "days") {
    const scheduledById = new Map<TaskId, ScheduledTask>(scheduled.map((entry) => [entry.task.id, entry]));
    // Backward pass, in reverse topological order: every successor is done before its predecessors.
    // A Task without remaining successors may finish as late as the critical-path time.
    const latestFinishDayById = new Map<TaskId, number>();
    for (const { task, duration, startDay } of scheduled.toReversed()) {
      const latestStartDay = (latestFinishDayById.get(task.id) ?? criticalPathTime.days) - duration;
      if (latestStartDay === startDay) criticalTaskIds.add(task.id);
      for (const predecessorId of task.predecessors) {
        if (!scheduledById.has(predecessorId)) continue;
        latestFinishDayById.set(
          predecessorId,
          Math.min(latestFinishDayById.get(predecessorId) ?? latestStartDay, latestStartDay),
        );
      }
    }

    for (const { task, startDay } of scheduled) {
      if (!criticalTaskIds.has(task.id)) continue;
      for (const predecessorId of task.predecessors) {
        if (criticalTaskIds.has(predecessorId) && scheduledById.get(predecessorId)?.finishDay === startDay)
          criticalLinks.add(taskLinkId(predecessorId, task.id));
      }
    }
  }

  return { kind: "scheduled", criticalPathTime, totalWorkTime, criticalTaskIds, criticalLinks };
}
