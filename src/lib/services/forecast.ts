// The forecast: the Resource-Unconstrained Project Finish Date (the end of the
// longest path through the remaining work, unlimited parallelism) and the
// Resource-Constrained Project Finish Date (all remaining work one after
// another, parallelism 1), or neither while a Validation Warning exists.
// Durations count calendar days or weekdays (Mon–Fri), per the project's
// dayCountingMode; in weekdays mode a base date on a weekend moves to Monday.
import { addDays, addWeekdays, compareIsoDates, dayOfWeek, nextWeekday } from "@/lib/services/calendar-date";
import { topologicalOrder } from "@/lib/services/task-graph";
import { type ValidationWarning, validationWarnings } from "@/lib/services/validation-warnings";
import type { DayCountingMode, Project, Task, TaskId } from "@/types";

export type ForecastDate = { kind: "date"; date: string } | { kind: "beyond-year-9999" };

export interface ForecastBaseDate {
  /** The day remaining work starts on, after any move off a weekend. */
  baseDate: string;
  /** Why baseDate was chosen: the START date, or today because START has no date or its date is in the past. */
  baseDateReason: "start-date" | "start-date-unset" | "start-date-in-past";
  /** In weekdays mode only: the Saturday or Sunday that was chosen and moved to the following Monday. */
  movedFromWeekend?: string;
}

export type Forecast =
  | { kind: "withheld"; warnings: ValidationWarning[] }
  | ({
      kind: "forecast";
      dayCountingMode: DayCountingMode;
      resourceUnconstrainedProjectFinishDate: ForecastDate;
      resourceConstrainedProjectFinishDate: ForecastDate;
    } & ForecastBaseDate);

/**
 * The base date of the forecast, whether or not a Validation Warning withholds
 * it: no remaining work starts before today, so the START date unless it is
 * unset or in the past, and then today. In weekdays mode a Saturday or Sunday
 * moves to the following Monday.
 */
export function forecastBaseDate(project: Project, today: string): ForecastBaseDate {
  const startDate = project.start.date;
  const [chosen, baseDateReason] =
    startDate === undefined
      ? [today, "start-date-unset" as const]
      : compareIsoDates(startDate, today) < 0
        ? [today, "start-date-in-past" as const]
        : [startDate, "start-date" as const];

  if (project.dayCountingMode === "calendar-days" || dayOfWeek(chosen) < 5) return { baseDate: chosen, baseDateReason };
  return { baseDate: nextWeekday(chosen), baseDateReason, movedFromWeekend: chosen };
}

/**
 * The sentence naming a base date's move off a weekend, e.g. "2026-10-17 is a
 * Saturday: counting weekdays, the forecast starts on Monday, 2026-10-19."
 */
export function weekendMoveNote({
  baseDate,
  movedFromWeekend,
}: {
  baseDate: string;
  movedFromWeekend: string;
}): string {
  const dayName = dayOfWeek(movedFromWeekend) === 5 ? "Saturday" : "Sunday";
  return `${movedFromWeekend} is a ${dayName}: counting weekdays, the forecast starts on Monday, ${baseDate}.`;
}

function forecastDate(mode: DayCountingMode, baseDate: string, days: number): ForecastDate {
  const date = mode === "weekdays" ? addWeekdays(baseDate, days) : addDays(baseDate, days);
  return date === undefined ? { kind: "beyond-year-9999" } : { kind: "date", date };
}

/**
 * Both Project Finish Dates from the graph, the Durations, the START date and
 * `today` (ISO yyyy-mm-dd, injected so tests control it).
 *
 * The base date comes from forecastBaseDate. A Task starts on the day
 * its last predecessor finishes and finishes Duration days (or weekdays) later,
 * counted as whole-day offsets from the base date. A Done Task
 * is not remaining work: it counts as finishing on the base date, which the
 * Done rules make exact (a completion date is never after today nor before the
 * START date, so the base date is today whenever a Task is Done).
 */
export function forecast(project: Project, today: string): Forecast {
  const warnings = validationWarnings(project);
  if (warnings.length > 0) return { kind: "withheld", warnings };

  const base = forecastBaseDate(project, today);
  const mode = project.dayCountingMode;

  const tasksById = new Map<TaskId, Task>(project.tasks.map((task) => [task.id, task]));
  // Day sums stay plain numbers until one conversion each, so an overflow anywhere becomes "beyond year 9999".
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
    dayCountingMode: mode,
    ...base,
    resourceUnconstrainedProjectFinishDate: forecastDate(mode, base.baseDate, latestFinishDay),
    resourceConstrainedProjectFinishDate: forecastDate(mode, base.baseDate, totalRemainingDays),
  };
}
