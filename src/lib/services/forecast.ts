// The forecast: the Resource-Unconstrained Project Finish Date (the end of the
// longest path through the remaining work, unlimited parallelism) and the
// Resource-Constrained Project Finish Date (all remaining work one after
// another, parallelism 1), or neither while a Validation Warning exists.
// Durations count calendar days or weekdays (Mon–Fri), per the project's
// dayCountingMode; in weekdays mode a base date on a weekend moves to Monday.
import { addDays, addWeekdays, compareIsoDates, dayOfWeek, nextWeekday } from "@/lib/services/calendar-date";
import type { CheckedProject } from "@/lib/services/project";
import { remainingWork, type RemainingWorkTime } from "@/lib/services/remaining-work";
import { type ValidationWarning, validationWarnings } from "@/lib/services/validation-warnings";
import type { DayCountingMode, Project } from "@/types";

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
      /** The length of the longest chain of remaining work, from remainingWork. */
      criticalPathTime: RemainingWorkTime;
      /** All remaining work one after another, from remainingWork. */
      totalWorkTime: RemainingWorkTime;
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
 * project's unit. A time too large to count is beyond year 9999.
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
