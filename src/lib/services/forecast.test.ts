import { describe, expect, it } from "vitest";

import { type Forecast, forecast } from "@/lib/services/forecast";
import {
  addPredecessor,
  createEmptyProject,
  createTask,
  type EditResult,
  setDuration,
  setStartDate,
} from "@/lib/services/project";
import type { Project, TaskId, TaskStatus } from "@/types";

function accepted(result: EditResult): Project {
  if (!result.ok) throw new Error(`Expected the edit to be accepted, got ${result.error.rule}`);
  return result.project;
}

/** A project with one Task per [name, Duration] pair, ids 1..n; an empty Duration leaves it unset. */
function projectWith(startDate: string, ...tasks: [string, string][]): Project {
  const project = tasks.reduce((current, [name, duration]) => {
    const created = accepted(createTask(current, name));
    return accepted(setDuration(created, created.nextTaskId - 1, duration));
  }, createEmptyProject());
  return accepted(setStartDate(project, startDate));
}

/** Adds `predecessorId → taskId` for each pair. */
function withDependencies(project: Project, ...pairs: [TaskId, TaskId][]): Project {
  return pairs.reduce(
    (current, [predecessorId, taskId]) => accepted(addPredecessor(current, taskId, predecessorId)),
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

/** START 2026-09-01, A → B (3) with B To Do and A's Status, completion date and Duration as given: built by hand, since no edit sets a Status yet. */
function aWithStatus(status: TaskStatus, completionDate: string | undefined, aDuration?: number): Project {
  return {
    ...createEmptyProject(),
    start: { date: "2026-09-01" },
    nextTaskId: 3,
    tasks: [
      {
        id: 1,
        name: "A",
        predecessors: [],
        status,
        ...(completionDate === undefined ? {} : { completionDate }),
        ...(aDuration === undefined ? {} : { duration: aDuration }),
      },
      { id: 2, name: "B", predecessors: [1], status: "to-do", duration: 3 },
    ],
  };
}

/** START → A (5) → B (3), both To Do, built through the edit functions; an empty START date leaves it unset. */
function aThenB(startDate: string): Project {
  return withDependencies(projectWith(startDate, ["A", "5"], ["B", "3"]), [1, 2]);
}

interface PrdExample {
  /** The PRD source of the row; also the test name. */
  rule: string;
  project: Project;
  today: string;
  baseDate: string;
  baseDateReason: "start-date" | "start-date-unset" | "start-date-in-past";
  resourceUnconstrainedProjectFinishDate: string;
  resourceConstrainedProjectFinishDate: string;
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
  },
  {
    rule: "Business Logic / US-04 AC: a START date in the past is replaced by today",
    project: aThenB("2026-09-01"),
    today: "2026-09-05",
    baseDate: "2026-09-05",
    baseDateReason: "start-date-in-past",
    resourceUnconstrainedProjectFinishDate: "2026-09-13",
    resourceConstrainedProjectFinishDate: "2026-09-13",
  },
  {
    rule: "Business Logic: a START date equal to today is kept",
    project: aThenB("2026-09-05"),
    today: "2026-09-05",
    baseDate: "2026-09-05",
    baseDateReason: "start-date",
    resourceUnconstrainedProjectFinishDate: "2026-09-13",
    resourceConstrainedProjectFinishDate: "2026-09-13",
  },
  {
    rule: "Business Logic: the START date is today if not set",
    project: aThenB(""),
    today: "2026-10-01",
    baseDate: "2026-10-01",
    baseDateReason: "start-date-unset",
    resourceUnconstrainedProjectFinishDate: "2026-10-09",
    resourceConstrainedProjectFinishDate: "2026-10-09",
  },
  {
    rule: "US-04 Given / Business Logic: A Done on 3 Sep, today 3 Sep → 6 Sep",
    project: aWithStatus("done", "2026-09-03", 5),
    today: "2026-09-03",
    baseDate: "2026-09-03",
    baseDateReason: "start-date-in-past",
    resourceUnconstrainedProjectFinishDate: "2026-09-06",
    resourceConstrainedProjectFinishDate: "2026-09-06",
  },
  {
    rule: "US-04 AC / Business Logic: A Done on 8 Sep, today 8 Sep → 11 Sep",
    project: aWithStatus("done", "2026-09-08", 5),
    today: "2026-09-08",
    baseDate: "2026-09-08",
    baseDateReason: "start-date-in-past",
    resourceUnconstrainedProjectFinishDate: "2026-09-11",
    resourceConstrainedProjectFinishDate: "2026-09-11",
  },
  {
    rule: "US-04 AC / Business Logic: A Done on 3 Sep, today 5 Sep, B not Done → 8 Sep",
    project: aWithStatus("done", "2026-09-03", 5),
    today: "2026-09-05",
    baseDate: "2026-09-05",
    baseDateReason: "start-date-in-past",
    resourceUnconstrainedProjectFinishDate: "2026-09-08",
    resourceConstrainedProjectFinishDate: "2026-09-08",
  },
  {
    rule: "Business Logic: a Done Task needs no Duration, so the forecast is not withheld",
    project: aWithStatus("done", "2026-09-03"),
    today: "2026-09-03",
    baseDate: "2026-09-03",
    baseDateReason: "start-date-in-past",
    resourceUnconstrainedProjectFinishDate: "2026-09-06",
    resourceConstrainedProjectFinishDate: "2026-09-06",
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
  },
];

describe("forecast", () => {
  describe("PRD worked examples", () => {
    it.each(prdExamples)(
      "$rule",
      ({
        project,
        today,
        baseDate,
        baseDateReason,
        resourceUnconstrainedProjectFinishDate,
        resourceConstrainedProjectFinishDate,
      }) => {
        expect(forecast(project, today)).toEqual({
          kind: "forecast",
          baseDate,
          baseDateReason,
          resourceUnconstrainedProjectFinishDate: { kind: "date", date: resourceUnconstrainedProjectFinishDate },
          resourceConstrainedProjectFinishDate: { kind: "date", date: resourceConstrainedProjectFinishDate },
        });
      },
    );

    it("follows US-02: equal dates for a chain, withheld while D has no Duration, then different", () => {
      const chain = withDependencies(projectWith("2026-09-01", ["A", "5"], ["B", "3"], ["C", "2"]), [1, 2], [2, 3]);
      expect(finishDates(forecast(chain, "2026-08-20"))).toEqual(["2026-09-11", "2026-09-11"]);

      // A → D → C next to A → B → C.
      const withD = withDependencies(accepted(createTask(chain, "D")), [1, 4], [4, 3]);
      expect(forecast(withD, "2026-08-20")).toEqual({
        kind: "withheld",
        warnings: [{ rule: "duration-missing", taskId: 4, message: "D has no Duration." }],
      });

      const estimated = accepted(setDuration(withD, 4, "4"));
      expect(finishDates(forecast(estimated, "2026-08-20"))).toEqual(["2026-09-12", "2026-09-15"]);
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

  it("gives the base date for both when there are no Tasks", () => {
    expect(finishDates(forecast(projectWith("2026-09-01"), "2026-08-20"))).toEqual(["2026-09-01", "2026-09-01"]);
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
});
