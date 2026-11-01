import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StartPanel } from "@/components/planner/StartPanel";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  type EditContext,
  type EditResult,
  setCompletionDate,
  setDayCountingMode,
  setStartDate,
  setStatus,
} from "@/lib/services/project";
import type { DayCountingMode, Project } from "@/types";

const TODAY = "2026-09-05";
const CONTEXT: EditContext = { today: TODAY };

function accepted(result: EditResult): CheckedProject {
  if (!result.ok) throw new Error(`Expected the edit to be accepted, got ${result.error.rule}`);
  return result.project;
}

/** A alone, without a Duration: the note does not wait for the forecast, which this project withholds. */
function project(mode: DayCountingMode, startDate?: string): Project {
  const withA = accepted(
    setDayCountingMode(accepted(createTask(createEmptyProject(CONTEXT), "A", CONTEXT)), mode, CONTEXT),
  );
  return startDate === undefined ? withA : accepted(setStartDate(withA, startDate, CONTEXT));
}

/**
 * START 2026-09-01 (or unset), A (id 1) Done on 2026-09-03 → B (id 2), To Do or
 * Done on 2026-09-04; as of TODAY, after both completion dates.
 */
function doneProject(startDate: string | undefined, bDone: boolean): Project {
  const created = accepted(
    addPredecessor(
      accepted(createTask(accepted(createTask(createEmptyProject(CONTEXT), "A", CONTEXT)), "B", CONTEXT)),
      2,
      1,
      CONTEXT,
    ),
  );
  const dated = startDate === undefined ? created : accepted(setStartDate(created, startDate, CONTEXT));
  const doneA = accepted(setCompletionDate(accepted(setStatus(dated, 1, "done", CONTEXT)), 1, "2026-09-03", CONTEXT));
  return bDone
    ? accepted(setCompletionDate(accepted(setStatus(doneA, 2, "done", CONTEXT)), 2, "2026-09-04", CONTEXT))
    : doneA;
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

  it("says the past START date no longer matters once the Tasks that follow it are Done", () => {
    const text = renderedText(doneProject("2026-09-01", false), TODAY);

    expect(text).toContain(
      "The Tasks that follow START are Done, so this date no longer affects the forecast: it starts from today, 2026-09-05.",
    );
    expect(text).not.toContain("This date is in the past");
  });

  it("says a set START date no longer matters once every Task is Done", () => {
    const text = renderedText(doneProject("2026-09-01", true), TODAY);

    expect(text).toContain("Every Task is Done, so this date no longer affects the forecast.");
    expect(text).not.toContain("starts from today");
  });

  it("says an unset START date does not matter once every Task is Done", () => {
    const text = renderedText(doneProject(undefined, true), TODAY);

    expect(text).toContain("Not set. Every Task is Done, so the START date does not affect the forecast.");
    expect(text).not.toContain("starts from today");
  });

  it("keeps the calendar-days wording, with no weekend sentence", () => {
    const text = renderedText(project("calendar-days", "2026-09-01"), "2026-10-17");

    expect(text).toContain("This date is in the past: the forecast starts from today, 2026-10-17.");
    expect(text).not.toContain("counting weekdays");
  });
});
