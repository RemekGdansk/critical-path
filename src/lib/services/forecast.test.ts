import { describe, expect, it } from "vitest";

import { type Forecast, forecast, forecastBaseDate, type ForecastBaseDate } from "@/lib/services/forecast";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  type EditContext,
  type EditResult,
  setCompletionDate,
  setDuration,
  setStartDate,
  setStatus,
} from "@/lib/services/project";
import type { TaskId, TaskStatus } from "@/types";

const TODAY = "2026-09-05";
const CONTEXT: EditContext = { today: TODAY };

function accepted(result: EditResult): CheckedProject {
  if (!result.ok) throw new Error(`Expected the edit to be accepted, got ${result.error.rule}`);
  return result.project;
}

/** A project with one Task per [name, Duration] pair, ids 1..n; an empty Duration leaves it unset. */
function projectWith(startDate: string, ...tasks: [string, string][]): CheckedProject {
  const project = tasks.reduce((current, [name, duration]) => {
    const created = accepted(createTask(current, name, CONTEXT));
    return accepted(setDuration(created, created.nextTaskId - 1, duration, CONTEXT));
  }, createEmptyProject(CONTEXT));
  return accepted(setStartDate(project, startDate, CONTEXT));
}

/** Adds `predecessorId → taskId` for each pair. */
function withDependencies(project: CheckedProject, ...pairs: [TaskId, TaskId][]): CheckedProject {
  return pairs.reduce(
    (current, [predecessorId, taskId]) => accepted(addPredecessor(current, taskId, predecessorId, CONTEXT)),
    project,
  );
}

/** Both Project Finish Dates as plain strings, for compact assertions. */
function finishDates(result: Forecast): [string, string] {
  if (result.kind !== "forecast") throw new Error("Expected a forecast, got withheld");
  const show = (date: typeof result.resourceConstrainedProjectFinishDate) =>
    date.kind === "date" ? date.date : "beyond-year-9999";
  return [show(result.resourceUnconstrainedProjectFinishDate), show(result.resourceConstrainedProjectFinishDate)];
}

/**
 * START 2026-09-01, A → B (3) with B To Do and A's Status, completion date and
 * Duration as given, built through the edits. A Done Task is marked on its
 * completion date, so that date is today for the edits.
 */
function aWithStatus(status: TaskStatus, completionDate: string | undefined, aDuration?: number): CheckedProject {
  const project = withDependencies(projectWith("2026-09-01", ["A", String(aDuration ?? "")], ["B", "3"]), [1, 2]);
  const context: EditContext = { today: completionDate ?? TODAY };
  const withStatus = accepted(setStatus(project, 1, status, context));
  return completionDate === undefined
    ? withStatus
    : accepted(setCompletionDate(withStatus, 1, completionDate, context));
}

/**
 * `project` with each [Task id, completion date] pair marked Done in turn,
 * each on its completion date, so that date is today for its edit.
 */
function withDone(project: CheckedProject, ...done: [TaskId, string][]): CheckedProject {
  return done.reduce(
    (current, [taskId, completionDate]) => accepted(setStatus(current, taskId, "done", { today: completionDate })),
    project,
  );
}

/** START → A (5) → B (3), both To Do, built through the edit functions; an empty START date leaves it unset. */
function aThenB(startDate: string): CheckedProject {
  return withDependencies(projectWith(startDate, ["A", "5"], ["B", "3"]), [1, 2]);
}

/** `project` counting weekdays (Mon–Fri) instead of calendar days. */
function inWeekdays(project: CheckedProject): CheckedProject {
  return { ...project, dayCountingMode: "weekdays" };
}

interface PrdExample {
  /** The PRD source of the row; also the test name. */
  rule: string;
  project: CheckedProject;
  today: string;
  baseDate: string;
  baseDateReason: ForecastBaseDate["baseDateReason"];
  resourceUnconstrainedProjectFinishDate: string;
  resourceConstrainedProjectFinishDate: string;
  /** Days of the longest chain of remaining work, derived by hand. */
  criticalPathTime: number;
  /** Days of all remaining work one after another, derived by hand. */
  totalWorkTime: number;
  /** The weekend date the base date moved from in weekdays mode; absent when it did not move. */
  movedFromWeekend?: string;
}

// The PRD worked examples as one list: later slices (S-05, S-06, S-07) add their rows here.
// Expected dates are literals derived by hand from the PRD, never computed.
const prdExamples: PrdExample[] = [
  {
    rule: "Business Logic / US-04 Given: START 1 Sep, A (5) → B (3) → 9 Sep",
    project: aThenB("2026-09-01"),
    today: "2026-08-20",
    baseDate: "2026-09-01",
    baseDateReason: "start-date",
    resourceUnconstrainedProjectFinishDate: "2026-09-09",
    resourceConstrainedProjectFinishDate: "2026-09-09",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    rule: "Business Logic / US-04 AC: a START date in the past is replaced by today",
    project: aThenB("2026-09-01"),
    today: "2026-09-05",
    baseDate: "2026-09-05",
    baseDateReason: "start-date-in-past",
    resourceUnconstrainedProjectFinishDate: "2026-09-13",
    resourceConstrainedProjectFinishDate: "2026-09-13",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    rule: "Business Logic: a START date equal to today is kept",
    project: aThenB("2026-09-05"),
    today: "2026-09-05",
    baseDate: "2026-09-05",
    baseDateReason: "start-date",
    resourceUnconstrainedProjectFinishDate: "2026-09-13",
    resourceConstrainedProjectFinishDate: "2026-09-13",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    rule: "Business Logic: the START date is today if not set",
    project: aThenB(""),
    today: "2026-10-01",
    baseDate: "2026-10-01",
    baseDateReason: "start-date-unset",
    resourceUnconstrainedProjectFinishDate: "2026-10-09",
    resourceConstrainedProjectFinishDate: "2026-10-09",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    // START's only direct successor A is Done, so the base is today, 3 Sep; B (3) runs 4–6 Sep → 6 Sep.
    rule: "US-04 Given / Business Logic: A Done on 3 Sep, today 3 Sep → 6 Sep",
    project: aWithStatus("done", "2026-09-03", 5),
    today: "2026-09-03",
    baseDate: "2026-09-03",
    baseDateReason: "start-successors-done",
    resourceUnconstrainedProjectFinishDate: "2026-09-06",
    resourceConstrainedProjectFinishDate: "2026-09-06",
    criticalPathTime: 3,
    totalWorkTime: 3,
  },
  {
    // A Done, so the base is today, 8 Sep; B (3) runs 9–11 Sep → 11 Sep.
    rule: "US-04 AC / Business Logic: A Done on 8 Sep, today 8 Sep → 11 Sep",
    project: aWithStatus("done", "2026-09-08", 5),
    today: "2026-09-08",
    baseDate: "2026-09-08",
    baseDateReason: "start-successors-done",
    resourceUnconstrainedProjectFinishDate: "2026-09-11",
    resourceConstrainedProjectFinishDate: "2026-09-11",
    criticalPathTime: 3,
    totalWorkTime: 3,
  },
  {
    // A Done 3 Sep, but B cannot start before today: base 5 Sep; B (3) runs 6–8 Sep → 8 Sep.
    rule: "US-04 AC / Business Logic: A Done on 3 Sep, today 5 Sep, B not Done → 8 Sep",
    project: aWithStatus("done", "2026-09-03", 5),
    today: "2026-09-05",
    baseDate: "2026-09-05",
    baseDateReason: "start-successors-done",
    resourceUnconstrainedProjectFinishDate: "2026-09-08",
    resourceConstrainedProjectFinishDate: "2026-09-08",
    criticalPathTime: 3,
    totalWorkTime: 3,
  },
  {
    // As the 3 Sep row with A's Duration unset: base today, 3 Sep; B (3) runs 4–6 Sep → 6 Sep.
    rule: "Business Logic: a Done Task needs no Duration, so the forecast is not withheld",
    project: aWithStatus("done", "2026-09-03"),
    today: "2026-09-03",
    baseDate: "2026-09-03",
    baseDateReason: "start-successors-done",
    resourceUnconstrainedProjectFinishDate: "2026-09-06",
    resourceConstrainedProjectFinishDate: "2026-09-06",
    criticalPathTime: 3,
    totalWorkTime: 3,
  },
  {
    // Differs from the Done row for the same day (6 Sep), so treating In Progress as Done fails here.
    rule: "US-04 AC / Business Logic: In Progress is treated exactly like To Do",
    project: aWithStatus("in-progress", undefined, 5),
    today: "2026-09-03",
    baseDate: "2026-09-03",
    baseDateReason: "start-date-in-past",
    resourceUnconstrainedProjectFinishDate: "2026-09-11",
    resourceConstrainedProjectFinishDate: "2026-09-11",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    // Same as the Given row (START 1 Sep, today before it) except A's Status: START 1 Sep;
    // A (5) runs 2–6 Sep, B (3) 7–9 Sep → 9 Sep, as if A were To Do.
    rule: "US-04 AC: marking A In Progress does not change the forecast → 9 Sep",
    project: aWithStatus("in-progress", undefined, 5),
    today: "2026-08-20",
    baseDate: "2026-09-01",
    baseDateReason: "start-date",
    resourceUnconstrainedProjectFinishDate: "2026-09-09",
    resourceConstrainedProjectFinishDate: "2026-09-09",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    // Independent A (5) and B (3) both follow START; A Done 3 Sep, B not, so START's direct
    // successors are not all Done: the past START date is replaced by today, 5 Sep; B runs 6–8 Sep → 8 Sep.
    rule: "US-04 AC: a past START date whose direct successors are not all Done is replaced by today",
    project: withDone(projectWith("2026-09-01", ["A", "5"], ["B", "3"]), [1, "2026-09-03"]),
    today: "2026-09-05",
    baseDate: "2026-09-05",
    baseDateReason: "start-date-in-past",
    resourceUnconstrainedProjectFinishDate: "2026-09-08",
    resourceConstrainedProjectFinishDate: "2026-09-08",
    criticalPathTime: 3,
    totalWorkTime: 3,
  },
  // FR-017 / Business Logic, weekdays mode. October 2026: Fri 16, Sat 17, Sun 18, Mon 19.
  {
    rule: "FR-017: in weekdays mode, START Mon 19 Oct, A (5) → B (3) skips the weekend → 29 Oct",
    project: inWeekdays(aThenB("2026-10-19")),
    today: "2026-10-01",
    baseDate: "2026-10-19",
    baseDateReason: "start-date",
    resourceUnconstrainedProjectFinishDate: "2026-10-29",
    resourceConstrainedProjectFinishDate: "2026-10-29",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    rule: "FR-017: the same project in calendar days → 27 Oct",
    project: aThenB("2026-10-19"),
    today: "2026-10-01",
    baseDate: "2026-10-19",
    baseDateReason: "start-date",
    resourceUnconstrainedProjectFinishDate: "2026-10-27",
    resourceConstrainedProjectFinishDate: "2026-10-27",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    rule: "FR-017: in weekdays mode, independent A (5) and B (3) from Mon 19 Oct → 26 Oct and 29 Oct",
    project: inWeekdays(projectWith("2026-10-19", ["A", "5"], ["B", "3"])),
    today: "2026-10-01",
    baseDate: "2026-10-19",
    baseDateReason: "start-date",
    resourceUnconstrainedProjectFinishDate: "2026-10-26",
    resourceConstrainedProjectFinishDate: "2026-10-29",
    criticalPathTime: 5,
    totalWorkTime: 8,
  },
  {
    rule: "FR-017: in weekdays mode, one weekday from Fri 16 Oct is Mon 19 Oct",
    project: inWeekdays(projectWith("2026-10-16", ["A", "1"])),
    today: "2026-10-01",
    baseDate: "2026-10-16",
    baseDateReason: "start-date",
    resourceUnconstrainedProjectFinishDate: "2026-10-19",
    resourceConstrainedProjectFinishDate: "2026-10-19",
    criticalPathTime: 1,
    totalWorkTime: 1,
  },
  {
    rule: "Business Logic: in weekdays mode, a START date on Saturday moves to Monday",
    project: inWeekdays(aThenB("2026-10-17")),
    today: "2026-10-01",
    baseDate: "2026-10-19",
    baseDateReason: "start-date",
    movedFromWeekend: "2026-10-17",
    resourceUnconstrainedProjectFinishDate: "2026-10-29",
    resourceConstrainedProjectFinishDate: "2026-10-29",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    rule: "Business Logic: in calendar days, a START date on Saturday is kept",
    project: aThenB("2026-10-17"),
    today: "2026-10-01",
    baseDate: "2026-10-17",
    baseDateReason: "start-date",
    resourceUnconstrainedProjectFinishDate: "2026-10-25",
    resourceConstrainedProjectFinishDate: "2026-10-25",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    rule: "Business Logic: in weekdays mode, a START date on Sunday moves to Monday",
    project: inWeekdays(aThenB("2026-10-18")),
    today: "2026-10-01",
    baseDate: "2026-10-19",
    baseDateReason: "start-date",
    movedFromWeekend: "2026-10-18",
    resourceUnconstrainedProjectFinishDate: "2026-10-29",
    resourceConstrainedProjectFinishDate: "2026-10-29",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    rule: "Business Logic: in weekdays mode, an unset START date with today on Saturday moves to Monday",
    project: inWeekdays(aThenB("")),
    today: "2026-10-17",
    baseDate: "2026-10-19",
    baseDateReason: "start-date-unset",
    movedFromWeekend: "2026-10-17",
    resourceUnconstrainedProjectFinishDate: "2026-10-29",
    resourceConstrainedProjectFinishDate: "2026-10-29",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
  {
    rule: "Business Logic: in weekdays mode, a past START date with today on Sunday moves to Monday",
    project: inWeekdays(aThenB("2026-09-01")),
    today: "2026-10-18",
    baseDate: "2026-10-19",
    baseDateReason: "start-date-in-past",
    movedFromWeekend: "2026-10-18",
    resourceUnconstrainedProjectFinishDate: "2026-10-29",
    resourceConstrainedProjectFinishDate: "2026-10-29",
    criticalPathTime: 8,
    totalWorkTime: 8,
  },
];

// Every Task Done: the PRD gives no example, so these follow the S-07 decision that the project
// finished on its latest completion date. Expected dates are literals derived by hand, never computed.
const allTasksDoneExamples: PrdExample[] = [
  {
    // No remaining work; the latest completion date is B's, 6 Sep, so both dates are 6 Sep.
    rule: "every Task Done: A Done 3 Sep, B Done 6 Sep, today 20 Sep → both 6 Sep",
    project: withDone(aThenB("2026-09-01"), [1, "2026-09-03"], [2, "2026-09-06"]),
    today: "2026-09-20",
    baseDate: "2026-09-06",
    baseDateReason: "all-tasks-done",
    resourceUnconstrainedProjectFinishDate: "2026-09-06",
    resourceConstrainedProjectFinishDate: "2026-09-06",
    criticalPathTime: 0,
    totalWorkTime: 0,
  },
  {
    // START unset, independent A and B, marked Done in date order; A, the first Task, has the latest completion date, 6 Sep.
    rule: "every Task Done with the START date unset → the latest completion date, not today",
    project: withDone(projectWith("", ["A", "5"], ["B", "3"]), [2, "2026-09-03"], [1, "2026-09-06"]),
    today: "2026-09-20",
    baseDate: "2026-09-06",
    baseDateReason: "all-tasks-done",
    resourceUnconstrainedProjectFinishDate: "2026-09-06",
    resourceConstrainedProjectFinishDate: "2026-09-06",
    criticalPathTime: 0,
    totalWorkTime: 0,
  },
  {
    // October 2026: Fri 16, Sat 17. B, Done last, on Saturday 17 Oct; the date stays a Saturday, never moved to Monday.
    rule: "every Task Done in weekdays mode, latest completion on Saturday → both that Saturday",
    project: inWeekdays(withDone(aThenB("2026-10-01"), [1, "2026-10-16"], [2, "2026-10-17"])),
    today: "2026-10-20",
    baseDate: "2026-10-17",
    baseDateReason: "all-tasks-done",
    resourceUnconstrainedProjectFinishDate: "2026-10-17",
    resourceConstrainedProjectFinishDate: "2026-10-17",
    criticalPathTime: 0,
    totalWorkTime: 0,
  },
];

/** Asserts the whole forecast for one row, strictly, so a row without movedFromWeekend proves the forecast carries none. */
function expectForecast({
  project,
  today,
  baseDate,
  baseDateReason,
  movedFromWeekend,
  resourceUnconstrainedProjectFinishDate,
  resourceConstrainedProjectFinishDate,
  criticalPathTime,
  totalWorkTime,
}: PrdExample): void {
  expect(forecast(project, today)).toStrictEqual({
    kind: "forecast",
    dayCountingMode: project.dayCountingMode,
    baseDate,
    baseDateReason,
    ...(movedFromWeekend === undefined ? {} : { movedFromWeekend }),
    resourceUnconstrainedProjectFinishDate: { kind: "date", date: resourceUnconstrainedProjectFinishDate },
    resourceConstrainedProjectFinishDate: { kind: "date", date: resourceConstrainedProjectFinishDate },
    criticalPathTime: { kind: "days", days: criticalPathTime },
    totalWorkTime: { kind: "days", days: totalWorkTime },
  });
}

describe("forecast", () => {
  describe("PRD worked examples", () => {
    it.each(prdExamples)("$rule", expectForecast);

    it("follows US-02: equal dates for a chain, withheld while D has no Duration, then different", () => {
      const chain = withDependencies(projectWith("2026-09-01", ["A", "5"], ["B", "3"], ["C", "2"]), [1, 2], [2, 3]);
      expect(finishDates(forecast(chain, "2026-08-20"))).toEqual(["2026-09-11", "2026-09-11"]);

      // A → D → C next to A → B → C.
      const withD = withDependencies(accepted(createTask(chain, "D", CONTEXT)), [1, 4], [4, 3]);
      expect(forecast(withD, "2026-08-20")).toEqual({
        kind: "withheld",
        warnings: [{ rule: "duration-missing", taskId: 4, message: "D has no Duration." }],
      });

      // A (5) → D (4) → C (2) is now the longest chain, 11 days against 10 through B; all four Tasks take 14.
      const estimated = forecast(accepted(setDuration(withD, 4, "4", CONTEXT)), "2026-08-20");
      expect(finishDates(estimated)).toEqual(["2026-09-12", "2026-09-15"]);
      expect(estimated).toMatchObject({
        criticalPathTime: { kind: "days", days: 11 },
        totalWorkTime: { kind: "days", days: 14 },
      });
    });
  });

  it("gives the same dates whichever of two dependent Tasks was created first", () => {
    // B (3) depends on A (5) in both, but here B is created first.
    const reversed = withDependencies(projectWith("2026-09-01", ["B", "3"], ["A", "5"]), [2, 1]);
    expect(finishDates(forecast(reversed, "2026-08-20"))).toEqual(["2026-09-09", "2026-09-09"]);
  });

  it("follows the longer of two parallel chains for the Resource-Unconstrained Project Finish Date", () => {
    // A (2) → B (2) and C (1) → D (7): the second chain is longer.
    const project = withDependencies(
      projectWith("2026-09-01", ["A", "2"], ["B", "2"], ["C", "1"], ["D", "7"]),
      [1, 2],
      [3, 4],
    );
    expect(finishDates(forecast(project, "2026-08-20"))).toEqual(["2026-09-09", "2026-09-13"]);
  });

  describe("every Task Done", () => {
    it.each(allTasksDoneExamples)("$rule", expectForecast);
  });

  it("gives the base date for both when there are no Tasks", () => {
    expect(finishDates(forecast(projectWith("2026-09-01"), "2026-08-20"))).toEqual(["2026-09-01", "2026-09-01"]);
    // No Tasks is not every Task Done, and a past START date with no direct successors is still replaced by today.
    expect(forecastBaseDate(projectWith("2026-09-01"), "2026-09-05")).toStrictEqual({
      baseDate: "2026-09-05",
      baseDateReason: "start-date-in-past",
    });
  });

  it("reports dates after 9999-12-31 as beyond year 9999", () => {
    expect(finishDates(forecast(projectWith("9999-12-01", ["A", "30"]), "2026-08-20"))).toEqual([
      "9999-12-31",
      "9999-12-31",
    ]);
    expect(finishDates(forecast(projectWith("9999-12-01", ["A", "31"]), "2026-08-20"))).toEqual([
      "beyond-year-9999",
      "beyond-year-9999",
    ]);
    const huge = projectWith("2026-09-01", ["A", String(Number.MAX_SAFE_INTEGER)], ["B", "1"]);
    expect(finishDates(forecast(huge, "2026-08-20"))).toEqual(["beyond-year-9999", "beyond-year-9999"]);
  });

  it("reports dates after 9999-12-31 as beyond year 9999 in weekdays mode", () => {
    // 9999-12-24 is a Friday; 9999-12-31, five weekdays later, is the last one.
    expect(finishDates(forecast(inWeekdays(projectWith("9999-12-24", ["A", "5"])), "2026-08-20"))).toEqual([
      "9999-12-31",
      "9999-12-31",
    ]);
    expect(finishDates(forecast(inWeekdays(projectWith("9999-12-24", ["A", "6"])), "2026-08-20"))).toEqual([
      "beyond-year-9999",
      "beyond-year-9999",
    ]);
    const huge = inWeekdays(projectWith("2026-09-01", ["A", String(Number.MAX_SAFE_INTEGER)]));
    expect(finishDates(forecast(huge, "2026-08-20"))).toEqual(["beyond-year-9999", "beyond-year-9999"]);
  });
});

describe("forecastBaseDate", () => {
  it("moves a weekend base date even while the forecast is withheld", () => {
    const withheld = inWeekdays(projectWith("2026-10-17", ["A", ""]));
    expect(forecast(withheld, "2026-10-01").kind).toBe("withheld");
    expect(forecastBaseDate(withheld, "2026-10-01")).toStrictEqual({
      baseDate: "2026-10-19",
      baseDateReason: "start-date",
      movedFromWeekend: "2026-10-17",
    });
  });

  it("keeps a weekend base date in calendar days", () => {
    expect(forecastBaseDate(projectWith("", ["A", ""]), "2026-10-17")).toStrictEqual({
      baseDate: "2026-10-17",
      baseDateReason: "start-date-unset",
    });
  });
});
