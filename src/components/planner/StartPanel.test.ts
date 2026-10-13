import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StartPanel } from "@/components/planner/StartPanel";
import {
  createEmptyProject,
  createTask,
  type EditResult,
  setDayCountingMode,
  setStartDate,
} from "@/lib/services/project";
import type { DayCountingMode, Project } from "@/types";

function accepted(result: EditResult): Project {
  if (!result.ok) throw new Error(`Expected the edit to be accepted, got ${result.error.rule}`);
  return result.project;
}

/** A alone, without a Duration: the note does not wait for the forecast, which this project withholds. */
function project(mode: DayCountingMode, startDate?: string): Project {
  const withA = accepted(setDayCountingMode(accepted(createTask(createEmptyProject(), "A")), mode));
  return startDate === undefined ? withA : accepted(setStartDate(withA, startDate));
}

/** The panel's text as of `today`, tags replaced by spaces. */
function renderedText(planned: Project, today: string): string {
  const markup = renderToStaticMarkup(
    createElement(StartPanel, {
      project: planned,
      today,
      setStartDate: () => {
        throw new Error("Not edited in a static render.");
      },
    }),
  );
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("StartPanel note", () => {
  it("names a weekend START date and the Monday the weekdays forecast starts on", () => {
    expect(renderedText(project("weekdays", "2026-10-17"), "2026-10-01")).toContain(
      "2026-10-17 is a Saturday: counting weekdays, the forecast starts on Monday, 2026-10-19.",
    );
  });

  it("names the real today when START is unset and today is a weekend, then the Monday", () => {
    expect(renderedText(project("weekdays"), "2026-10-18")).toContain(
      "Not set: the forecast starts from today, 2026-10-18. 2026-10-18 is a Sunday: counting weekdays, the forecast starts on Monday, 2026-10-19.",
    );
  });

  it("keeps the calendar-days wording, with no weekend sentence", () => {
    const text = renderedText(project("calendar-days", "2026-09-01"), "2026-10-17");

    expect(text).toContain("This date is in the past: the forecast starts from today, 2026-10-17.");
    expect(text).not.toContain("counting weekdays");
  });
});
