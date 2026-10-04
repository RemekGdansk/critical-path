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
import type { Project, TaskId } from "@/types";

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

describe("forecast", () => {
  it("forecasts the PRD example: START 1 Sep, A (5) → B (3) → 9 Sep", () => {
    const project = withDependencies(projectWith("2026-09-01", ["A", "5"], ["B", "3"]), [1, 2]);
    const result = forecast(project, "2026-08-20");

    expect(finishDates(result)).toEqual(["2026-09-09", "2026-09-09"]);
    expect(result).toMatchObject({ baseDate: "2026-09-01", baseDateReason: "start-date" });
  });

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

  it("forecasts from today when the START date is in the past", () => {
    const project = withDependencies(projectWith("2026-09-01", ["A", "5"], ["B", "3"]), [1, 2]);
    const result = forecast(project, "2026-09-05");

    expect(result).toMatchObject({ baseDate: "2026-09-05", baseDateReason: "start-date-in-past" });
    expect(finishDates(result)).toEqual(["2026-09-13", "2026-09-13"]);
  });

  it("forecasts from a START date equal to today, and from today when START has no date", () => {
    const project = withDependencies(projectWith("2026-09-05", ["A", "5"], ["B", "3"]), [1, 2]);
    expect(forecast(project, "2026-09-05")).toMatchObject({ baseDate: "2026-09-05", baseDateReason: "start-date" });

    const unset = accepted(setStartDate(project, ""));
    const result = forecast(unset, "2026-10-01");
    expect(result).toMatchObject({ baseDate: "2026-10-01", baseDateReason: "start-date-unset" });
    expect(finishDates(result)).toEqual(["2026-10-09", "2026-10-09"]);
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

  describe("with Done Tasks (built by hand: no edit sets Done yet)", () => {
    /** START 2026-09-01, A (5) → B (3), with A Done on `completionDate`. */
    function aDoneOn(completionDate: string, aDuration?: number): Project {
      return {
        ...createEmptyProject(),
        start: { date: "2026-09-01" },
        nextTaskId: 3,
        tasks: [
          {
            id: 1,
            name: "A",
            predecessors: [],
            status: "done",
            completionDate,
            ...(aDuration === undefined ? {} : { duration: aDuration }),
          },
          { id: 2, name: "B", predecessors: [1], status: "to-do", duration: 3 },
        ],
      };
    }

    it("forecasts the PRD Done examples", () => {
      expect(finishDates(forecast(aDoneOn("2026-09-03", 5), "2026-09-03"))).toEqual(["2026-09-06", "2026-09-06"]);
      expect(finishDates(forecast(aDoneOn("2026-09-08", 5), "2026-09-08"))).toEqual(["2026-09-11", "2026-09-11"]);
      expect(finishDates(forecast(aDoneOn("2026-09-03", 5), "2026-09-05"))).toEqual(["2026-09-08", "2026-09-08"]);
    });

    it("forecasts, rather than withholding, with a Done Task that has no Duration", () => {
      expect(finishDates(forecast(aDoneOn("2026-09-03"), "2026-09-03"))).toEqual(["2026-09-06", "2026-09-06"]);
    });
  });
});
