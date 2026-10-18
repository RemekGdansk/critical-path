// How a Duration reads on screen: a positive whole number of days, counted as
// calendar days or weekdays (Mon–Fri) by the project's dayCountingMode. Kept
// apart from the diagram layout, so a view that only shows a Duration never
// loads dagre.
import type { DayCountingMode } from "@/types";

/** The unit a Duration counts in, singular: "day" in calendar-days mode, "weekday" in weekdays mode. */
export function durationUnit(mode: DayCountingMode): string {
  return mode === "weekdays" ? "weekday" : "day";
}

/** "1 day", "5 days" in calendar-days mode; "1 weekday", "5 weekdays" in weekdays mode. */
export function formatDuration(days: number, mode: DayCountingMode): string {
  const unit = durationUnit(mode);
  return days === 1 ? `1 ${unit}` : `${days} ${unit}s`;
}
