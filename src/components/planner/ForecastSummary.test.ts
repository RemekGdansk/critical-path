import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ForecastSummary } from "@/components/planner/ForecastSummary";
import { forecast } from "@/lib/services/forecast";
import {
  addPredecessor,
  createEmptyProject,
  createTask,
  type EditResult,
  setDayCountingMode,
  setDuration,
  setStartDate,
} from "@/lib/services/project";
import type { DayCountingMode, Project, TaskId } from "@/types";

function accepted(result: EditResult): Project {
  if (!result.ok) throw new Error(`Expected the edit to be accepted, got ${result.error.rule}`);
  return result.project;
}

/** Adds `predecessorId → taskId` for each pair. */
function withDependencies(project: Project, ...pairs: [TaskId, TaskId][]): Project {
  return pairs.reduce(
    (current, [predecessorId, taskId]) => accepted(addPredecessor(current, taskId, predecessorId)),
    project,
  );
}

/** US-02 AC 1: START 2026-09-01, A (5) → B (3) → C (2) and A → D → C, with D (id 4) not yet estimated. */
function us02WithoutDDuration(): Project {
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
function singleTask(mode: DayCountingMode): Project {
  const withA = accepted(createTask(createEmptyProject(), "A"));
  return accepted(setDayCountingMode(accepted(setDuration(withA, 1, "5")), mode));
}

/** The static markup of `ForecastSummary` for the project, forecast as of `today` (by default 2026-08-20, before START). */
function renderedMarkup(project: Project, today = "2026-08-20"): string {
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
});
