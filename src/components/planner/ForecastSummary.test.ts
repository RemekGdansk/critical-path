import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ForecastSummary } from "@/components/planner/ForecastSummary";
import { forecast } from "@/lib/services/forecast";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  type EditResult,
  setDayCountingMode,
  setDuration,
  setStartDate,
} from "@/lib/services/project";
import type { DayCountingMode, TaskId } from "@/types";

function accepted(result: EditResult): CheckedProject {
  if (!result.ok) throw new Error(`Expected the edit to be accepted, got ${result.error.rule}`);
  return result.project;
}

/** Adds `predecessorId → taskId` for each pair. */
function withDependencies(project: CheckedProject, ...pairs: [TaskId, TaskId][]): CheckedProject {
  return pairs.reduce(
    (current, [predecessorId, taskId]) => accepted(addPredecessor(current, taskId, predecessorId)),
    project,
  );
}

/** US-02 AC 1: START 2026-09-01, A (5) → B (3) → C (2) and A → D → C, with D (id 4) not yet estimated. */
function us02WithoutDDuration(): CheckedProject {
  const chain: [string, string][] = [
    ["A", "5"],
    ["B", "3"],
    ["C", "2"],
  ];
  const tasks = chain.reduce((current, [name, duration]) => {
    const created = accepted(createTask(current, name));
    return accepted(setDuration(created, created.nextTaskId - 1, duration));
  }, createEmptyProject());
  const withD = accepted(createTask(accepted(setStartDate(tasks, "2026-09-01")), "D"));
  return withDependencies(withD, [1, 2], [2, 3], [1, 4], [4, 3]);
}

/** A (id 1, 5 days or weekdays) alone, in the given mode. */
function singleTask(mode: DayCountingMode): CheckedProject {
  const withA = accepted(createTask(createEmptyProject(), "A"));
  return accepted(setDayCountingMode(accepted(setDuration(withA, 1, "5")), mode));
}

/** The static markup of `ForecastSummary` for the project, forecast as of `today` (by default 2026-08-20, before START). */
function renderedMarkup(project: CheckedProject, today = "2026-08-20"): string {
  return renderToStaticMarkup(
    createElement(ForecastSummary, {
      forecast: forecast(project, today),
      tasks: project.tasks,
      startDate: project.start.date,
    }),
  );
}

/** The markup's text, tags replaced by spaces, so a label and its value read as one phrase. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("ForecastSummary", () => {
  it("shows the Validation Warning and no Project Finish Date while a Task lacks a Duration (US-02 AC 1)", () => {
    const markup = renderedMarkup(us02WithoutDDuration());
    const text = textOf(markup);

    expect(text).toContain("Validation Warning");
    expect(text).toContain("Forecast not possible");
    expect(text).not.toContain("Project Finish Date");
    // Over the whole markup, so a date in an attribute such as `dateTime` counts too.
    expect(markup).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("shows both Project Finish Dates once the Duration is set (US-02 AC 2)", () => {
    const text = textOf(renderedMarkup(accepted(setDuration(us02WithoutDDuration(), 4, "4"))));

    expect(text).toContain("Resource-Unconstrained Project Finish Date 2026-09-12");
    expect(text).toContain("Resource-Constrained Project Finish Date 2026-09-15");
    expect(text).not.toContain("Forecast not possible");
  });

  it("names a weekend START date and the Monday the weekdays forecast starts on", () => {
    // START Sat 2026-10-17, today Thu 2026-10-01: A (5 weekdays) runs Mon 10-19 to Mon 10-26.
    const project = accepted(setStartDate(singleTask("weekdays"), "2026-10-17"));
    const text = textOf(renderedMarkup(project, "2026-10-01"));

    expect(text).toContain("Resource-Unconstrained Project Finish Date 2026-10-26");
    expect(text).toContain("2026-10-17 is a Saturday: counting weekdays, the forecast starts on Monday, 2026-10-19.");
    expect(text).not.toContain("forecasting from today");
  });

  it("names the real today when START is unset and today is a weekend, then the Monday the forecast starts on", () => {
    // Today Sun 2026-10-18: the base date moves to Mon 10-19, and A (5 weekdays) finishes Mon 10-26.
    const text = textOf(renderedMarkup(singleTask("weekdays"), "2026-10-18"));

    expect(text).toContain("Resource-Unconstrained Project Finish Date 2026-10-26");
    expect(text).toContain(
      "START date not set: forecasting from today, 2026-10-18. 2026-10-18 is a Sunday: counting weekdays, the forecast starts on Monday, 2026-10-19.",
    );
  });

  it("adds no weekend sentence in calendar-days mode, even when today is a weekend", () => {
    // Today Sat 2026-10-17, calendar days: A (5) finishes Thu 10-22.
    const text = textOf(renderedMarkup(singleTask("calendar-days"), "2026-10-17"));

    expect(text).toContain("Resource-Unconstrained Project Finish Date 2026-10-22");
    expect(text).toContain("START date not set: forecasting from today, 2026-10-17.");
    expect(text).not.toContain("Saturday");
    expect(text).not.toContain("counting weekdays");
  });

  it("shows the critical-path time and the total-work time under the Project Finish Dates (FR-011)", () => {
    // A (5) → B (3) → C (2) and A → D (4) → C: the longest chain is A → D → C, 5 + 4 + 2 = 11; all work is 5 + 3 + 2 + 4 = 14.
    const markup = renderedMarkup(accepted(setDuration(us02WithoutDDuration(), 4, "4")));
    const text = textOf(markup);

    expect(text).toContain("Critical-path time 11 days · Total-work time 14 days");
    expect(text.indexOf("Resource-Constrained Project Finish Date")).toBeLessThan(text.indexOf("Critical-path time"));
    expect(markup).toMatch(/<span aria-hidden="true" class="[^"]*\bbg-critical-path\b[^"]*"><\/span>/);
    // Each time is bound to its own label, as each Project Finish Date is.
    expect(markup).toMatch(/Critical-path time<\/dt><dd[^>]*>11 days<\/dd>/);
    expect(markup).toMatch(/Total-work time<\/dt><dd[^>]*>14 days<\/dd>/);
  });

  it("counts both times in weekdays in weekdays mode", () => {
    const project = accepted(setDayCountingMode(accepted(setDuration(us02WithoutDDuration(), 4, "4")), "weekdays"));
    const text = textOf(renderedMarkup(project));

    expect(text).toContain("Critical-path time 11 weekdays · Total-work time 14 weekdays");
    expect(text).not.toContain("11 days");
    expect(text).not.toContain("14 days");
  });

  it("reads a time past the largest safe integer as too large to count, with no legend swatch", () => {
    // A → B, each 9007199254740991 days: both the chain and the sum pass the largest safe integer,
    // so the diagram highlights nothing and the swatch would explain a colour that is not drawn.
    const max = String(Number.MAX_SAFE_INTEGER);
    const withA = accepted(setDuration(accepted(createTask(createEmptyProject(), "A")), 1, max));
    const withB = accepted(setDuration(accepted(createTask(withA, "B")), 2, max));
    const markup = renderedMarkup(withDependencies(withB, [1, 2]));

    expect(textOf(markup)).toContain("Critical-path time Too large to count · Total-work time Too large to count");
    expect(markup).not.toContain("bg-critical-path");
  });

  it("shows neither time while a Validation Warning withholds the forecast", () => {
    const text = textOf(renderedMarkup(us02WithoutDDuration()));

    expect(text).toContain("Validation Warning");
    expect(text).not.toContain("Critical-path time");
    expect(text).not.toContain("Total-work time");
  });

  it("shows neither time for an empty project", () => {
    const markup = renderedMarkup(createEmptyProject());
    const text = textOf(markup);

    expect(text).toContain("Add Tasks to see a forecast.");
    expect(text).not.toContain("Critical-path time");
    expect(text).not.toContain("Total-work time");
    expect(markup).not.toContain("bg-critical-path");
  });
});
