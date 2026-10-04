// The forecast: the Resource-Unconstrained Project Finish Date (the end of the
// longest path through the remaining work, unlimited parallelism) and the
// Resource-Constrained Project Finish Date (all remaining work one after
// another, parallelism 1), or neither while a Validation Warning exists.
// Calendar days only; the weekdays mode is S-06.
import { addDays, compareIsoDates } from "@/lib/services/calendar-date";
import { topologicalOrder } from "@/lib/services/task-graph";
import { type ValidationWarning, validationWarnings } from "@/lib/services/validation-warnings";
import type { Project, Task, TaskId } from "@/types";

export type ForecastDate = { kind: "date"; date: string } | { kind: "beyond-year-9999" };

export type Forecast =
  | { kind: "withheld"; warnings: ValidationWarning[] }
  | {
      kind: "forecast";
      baseDate: string;
      /** Why baseDate was chosen: the START date, or today because START has no date or its date is in the past. */
      baseDateReason: "start-date" | "start-date-unset" | "start-date-in-past";
      resourceUnconstrainedProjectFinishDate: ForecastDate;
      resourceConstrainedProjectFinishDate: ForecastDate;
    };

function forecastDate(baseDate: string, days: number): ForecastDate {
  const date = addDays(baseDate, days);
  return date === undefined ? { kind: "beyond-year-9999" } : { kind: "date", date };
}

/**
 * Both Project Finish Dates from the graph, the Durations, the START date and
 * `today` (ISO yyyy-mm-dd, injected so tests control it).
 *
 * No remaining work starts before today, so the base date is the START date
 * unless it is unset or in the past, and then today. A Task starts on the day
 * its last predecessor finishes and finishes Duration days later. A Done Task
 * is not remaining work: it counts as finishing on the base date, which the
 * Done rules make exact (a completion date is never after today nor before the
 * START date, so the base date is today whenever a Task is Done).
 */
export function forecast(project: Project, today: string): Forecast {
  const warnings = validationWarnings(project);
  if (warnings.length > 0) return { kind: "withheld", warnings };

  const startDate = project.start.date;
  const [baseDate, baseDateReason] =
    startDate === undefined
      ? [today, "start-date-unset" as const]
      : compareIsoDates(startDate, today) < 0
        ? [today, "start-date-in-past" as const]
        : [startDate, "start-date" as const];

  const tasksById = new Map<TaskId, Task>(project.tasks.map((task) => [task.id, task]));
  // Day sums stay plain numbers until one addDays each, so an overflow anywhere becomes "beyond year 9999".
  const finishDay = new Map<TaskId, number>();
  let latestFinishDay = 0;
  let totalRemainingDays = 0;

  for (const taskId of topologicalOrder(project)) {
    const task = tasksById.get(taskId);
    if (task === undefined) continue;
    if (task.status === "done") {
      finishDay.set(taskId, 0);
      continue;
    }
    // validationWarnings withheld the forecast for any not-Done Task without one.
    const duration = task.duration;
    if (duration === undefined) throw new Error(`Task ${taskId} has no Duration.`);

    let startDay = 0;
    for (const predecessorId of task.predecessors) startDay = Math.max(startDay, finishDay.get(predecessorId) ?? 0);
    const taskFinishDay = startDay + duration;
    finishDay.set(taskId, taskFinishDay);
    latestFinishDay = Math.max(latestFinishDay, taskFinishDay);
    totalRemainingDays += duration;
  }

  return {
    kind: "forecast",
    baseDate,
    baseDateReason,
    resourceUnconstrainedProjectFinishDate: forecastDate(baseDate, latestFinishDay),
    resourceConstrainedProjectFinishDate: forecastDate(baseDate, totalRemainingDays),
  };
}
