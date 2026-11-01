// The forecast: the Resource-Unconstrained Project Finish Date (the end of the
// longest path through the remaining work, unlimited parallelism) and the
// Resource-Constrained Project Finish Date (all remaining work one after
// another, parallelism 1), or neither while a Validation Warning exists.
// Durations count calendar days or weekdays (Mon–Fri), per the project's
// dayCountingMode; in weekdays mode a base date on a weekend moves to Monday.
// Once every Task is Done, both are the latest completion date.
import { addDays, addWeekdays, compareIsoDates, dayOfWeek, nextWeekday } from "@/lib/services/calendar-date";
import type { CheckedProject } from "@/lib/services/project";
import { remainingWork, type RemainingWorkTime } from "@/lib/services/remaining-work";
import { type ValidationWarning, validationWarnings } from "@/lib/services/validation-warnings";
import type { DayCountingMode, Project, Task } from "@/types";

export type ForecastDate = { kind: "date"; date: string } | { kind: "beyond-year-9999" };

export interface ForecastBaseDate {
  /** The day remaining work starts on, after any move off a weekend; once every Task is Done, the day the project finished. */
  baseDate: string;
  /**
   * Why baseDate was chosen: the latest completion date because every Task is
   * Done (`all-tasks-done`); otherwise today because START has no date
   * (`start-date-unset`), because START's direct successors are all Done and
   * its past date no longer matters (`start-successors-done`) or because its
   * date is in the past (`start-date-in-past`); otherwise the START date.
   */
  baseDateReason: "start-date" | "start-date-unset" | "start-date-in-past" | "start-successors-done" | "all-tasks-done";
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
      /** The length of the longest chain of remaining work, from remainingWork. */
      criticalPathTime: RemainingWorkTime;
      /** All remaining work one after another, from remainingWork. */
      totalWorkTime: RemainingWorkTime;
    } & ForecastBaseDate);

/**
 * The latest completion date of `tasks`, all Done. Throws on a Done Task
 * without a completion date, which a `CheckedProject` never holds.
 */
function latestCompletionDate(tasks: readonly Task[]): string {
  let latest: string | undefined;
  for (const { id, completionDate } of tasks) {
    if (completionDate === undefined) throw new Error(`Task ${id} is Done without a completion date.`);
    if (latest === undefined || compareIsoDates(completionDate, latest) > 0) latest = completionDate;
  }
  if (latest === undefined) throw new Error("The project has no Tasks.");
  return latest;
}

/**
 * The base date of the forecast, whether or not a Validation Warning withholds
 * it. Once every Task is Done (and there is at least one), the project
 * finished on the latest completion date, which is kept as it is, even on a
 * weekend. Otherwise no remaining work starts before today, so the START date
 * unless it is unset or in the past, and then today; a past START date whose
 * direct successors (the Tasks without predecessors) are all Done no longer
 * matters, and says so. In weekdays mode a Saturday or Sunday chosen this way
 * moves to the following Monday.
 */
export function forecastBaseDate(project: Project, today: string): ForecastBaseDate {
  const { tasks } = project;
  if (tasks.length > 0 && tasks.every((task) => task.status === "done")) {
    return { baseDate: latestCompletionDate(tasks), baseDateReason: "all-tasks-done" };
  }

  const startDate = project.start.date;
  const startSuccessors = tasks.filter((task) => task.predecessors.length === 0);
  const [chosen, baseDateReason] =
    startDate === undefined
      ? [today, "start-date-unset" as const]
      : compareIsoDates(startDate, today) >= 0
        ? [startDate, "start-date" as const]
        : startSuccessors.length > 0 && startSuccessors.every((task) => task.status === "done")
          ? [today, "start-successors-done" as const]
          : [today, "start-date-in-past" as const];

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

function forecastDate(mode: DayCountingMode, baseDate: string, time: RemainingWorkTime): ForecastDate {
  if (time.kind === "too-large") return { kind: "beyond-year-9999" };
  const date = mode === "weekdays" ? addWeekdays(baseDate, time.days) : addDays(baseDate, time.days);
  return date === undefined ? { kind: "beyond-year-9999" } : { kind: "date", date };
}

/**
 * Both Project Finish Dates and the two remaining-work times from the graph,
 * the Durations, the START date and `today` (ISO yyyy-mm-dd, injected so tests
 * control it).
 *
 * The base date comes from forecastBaseDate, and the schedule of the remaining
 * work from remainingWork: the Resource-Unconstrained Project Finish Date is
 * the base date plus the critical-path time, the Resource-Constrained Project
 * Finish Date the base date plus the total-work time, each counted in the
 * project's unit. A time too large to count is beyond year 9999. Once every
 * Task is Done, both are the base date, the latest completion date, with no
 * day counting: in weekdays mode that date may be a Saturday or Sunday.
 *
 * Takes a `CheckedProject`: the guardian has ruled out a cycle and a malformed
 * START date, the two things this would otherwise throw on.
 */
export function forecast(project: CheckedProject, today: string): Forecast {
  const schedule = remainingWork(project);
  // remainingWork is withheld exactly while validationWarnings finds one.
  if (schedule.kind === "withheld") return { kind: "withheld", warnings: validationWarnings(project) };

  const base = forecastBaseDate(project, today);
  const mode = project.dayCountingMode;
  const { criticalPathTime, totalWorkTime } = schedule;

  if (base.baseDateReason === "all-tasks-done") {
    // No remaining work, so both times are 0 days; never counted, since addWeekdays throws on a weekend date.
    return {
      kind: "forecast",
      dayCountingMode: mode,
      ...base,
      resourceUnconstrainedProjectFinishDate: { kind: "date", date: base.baseDate },
      resourceConstrainedProjectFinishDate: { kind: "date", date: base.baseDate },
      criticalPathTime,
      totalWorkTime,
    };
  }

  return {
    kind: "forecast",
    dayCountingMode: mode,
    ...base,
    resourceUnconstrainedProjectFinishDate: forecastDate(mode, base.baseDate, criticalPathTime),
    resourceConstrainedProjectFinishDate: forecastDate(mode, base.baseDate, totalWorkTime),
    criticalPathTime,
    totalWorkTime,
  };
}
