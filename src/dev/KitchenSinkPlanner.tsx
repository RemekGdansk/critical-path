// The real Planner on a fixture, for the dev-only kitchen sink. Astro can pass
// only serializable props to an island, so the page names a fixture and the
// project is built here, through the edit functions, so it never holds a
// Validation Error (the one exception is the "render-crash" fixture). No
// Tailwind classes: global.css excludes src/dev.
import { useState } from "react";

import { Planner } from "@/components/planner/Planner";
import type { Selection } from "@/hooks/useProject";
import { todayIsoDate } from "@/lib/services/calendar-date";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  type EditContext,
  type EditResult,
  setCompletionDate,
  setDayCountingMode,
  setDuration,
  setProjectName,
  setStartDate,
  setStatus,
} from "@/lib/services/project";
import type { TaskId } from "@/types";

function accepted(result: EditResult): CheckedProject {
  if (!result.ok) throw new Error(`Fixture edit was rejected (${result.error.rule}): ${result.error.message}`);
  return result.project;
}

const DESIGN: TaskId = 1;
const BUILD: TaskId = 2;
const TEST: TaskId = 3;
const WRITE_DOCS: TaskId = 4;

/**
 * "Website relaunch": Design (3) → Build (5) → Test (2), and Design → Write
 * docs (2): every other Task depends on Design. No START date, so it forecasts
 * from today.
 */
function smallProject(context: EditContext): CheckedProject {
  let project = accepted(setProjectName(createEmptyProject(context), "Website relaunch", context));
  for (const name of ["Design", "Build", "Test", "Write docs"]) project = accepted(createTask(project, name, context));
  project = accepted(addPredecessor(project, BUILD, DESIGN, context));
  project = accepted(addPredecessor(project, TEST, BUILD, context));
  project = accepted(addPredecessor(project, WRITE_DOCS, DESIGN, context));
  for (const [taskId, days] of [
    [DESIGN, "3"],
    [BUILD, "5"],
    [TEST, "2"],
    [WRITE_DOCS, "2"],
  ] as const) {
    project = accepted(setDuration(project, taskId, days, context));
  }
  return project;
}

/** Design alone: no other Task can become its predecessor. */
function onlyTaskProject(context: EditContext): CheckedProject {
  return accepted(createTask(createEmptyProject(context), "Design", context));
}

/** The small project with Test's Duration cleared: a Validation Warning withholds the forecast. */
function warnedProject(context: EditContext): CheckedProject {
  return accepted(setDuration(smallProject(context), TEST, "", context));
}

/** The small project with a START date fixed in the past, so the forecast starts from today. */
function pastStartProject(context: EditContext): CheckedProject {
  return accepted(setStartDate(smallProject(context), "2020-01-01", context));
}

/**
 * The small project counting weekdays, with START on Saturday 2999-01-05 (far
 * ahead of any real today): the forecast moves it to Monday 2999-01-07.
 */
function weekdaysWeekendStartProject(context: EditContext): CheckedProject {
  return accepted(
    setStartDate(accepted(setDayCountingMode(smallProject(context), "weekdays", context)), "2999-01-05", context),
  );
}

/**
 * "Launch plan", for the critical path: Design (3) → Build (1) → Ship (3) and
 * Research (4) → Prototype (3) are two equal 7-day chains, both critical end to
 * end. Design → Ship joins two critical Tasks but is not on a longest chain
 * (Ship starts on day 4, after Build), and Design → Write docs (2) is a shorter
 * branch: neither is highlighted.
 */
function criticalPathProject(context: EditContext): CheckedProject {
  const [design, build, ship, research, prototype, writeDocs] = [1, 2, 3, 4, 5, 6] as const;
  let project = accepted(setProjectName(createEmptyProject(context), "Launch plan", context));
  for (const name of ["Design", "Build", "Ship", "Research", "Prototype", "Write docs"])
    project = accepted(createTask(project, name, context));
  for (const [taskId, predecessorId] of [
    [build, design],
    [ship, build],
    [ship, design],
    [prototype, research],
    [writeDocs, design],
  ] as const) {
    project = accepted(addPredecessor(project, taskId, predecessorId, context));
  }
  for (const [taskId, days] of [
    [design, "3"],
    [build, "1"],
    [ship, "3"],
    [research, "4"],
    [prototype, "3"],
    [writeDocs, "2"],
  ] as const) {
    project = accepted(setDuration(project, taskId, days, context));
  }
  return project;
}

/**
 * Marks the Task Done (today, the edit's default) and backdates it to
 * `completionDate`: two edits, as in the panel.
 */
function doneOn(project: CheckedProject, taskId: TaskId, completionDate: string, context: EditContext): CheckedProject {
  return accepted(
    setCompletionDate(accepted(setStatus(project, taskId, "done", context)), taskId, completionDate, context),
  );
}

/** The START date of the progress fixtures: in the past, so every completion date below is too. */
const PROGRESS_START_DATE = "2026-09-01";

/** The progress project's ids: its own three Tasks, not the small project's DESIGN … WRITE_DOCS. */
const PROGRESS_DESIGN: TaskId = 1;
const PROGRESS_BUILD: TaskId = 2;
const PROGRESS_WRITE_DOCS: TaskId = 3;

/**
 * "Website relaunch", in progress: Design (3) → Build (5), and Write docs (2)
 * on its own. START 2026-09-01; Design Done on 2026-09-03, Build In Progress
 * and critical (5 days against Write docs' 2), Write docs To Do. Write docs
 * still follows START, so the past START date is "in the past".
 */
function progressProject(context: EditContext): CheckedProject {
  let project = accepted(setProjectName(createEmptyProject(context), "Website relaunch", context));
  for (const name of ["Design", "Build", "Write docs"]) project = accepted(createTask(project, name, context));
  project = accepted(addPredecessor(project, PROGRESS_BUILD, PROGRESS_DESIGN, context));
  for (const [taskId, days] of [
    [PROGRESS_DESIGN, "3"],
    [PROGRESS_BUILD, "5"],
    [PROGRESS_WRITE_DOCS, "2"],
  ] as const) {
    project = accepted(setDuration(project, taskId, days, context));
  }
  project = accepted(setStartDate(project, PROGRESS_START_DATE, context));
  project = doneOn(project, PROGRESS_DESIGN, "2026-09-03", context);
  return accepted(setStatus(project, PROGRESS_BUILD, "in-progress", context));
}

/**
 * The progress project with Write docs after Design too: Design, START's only
 * successor, is Done, so the past START date no longer affects the forecast.
 */
function startSuccessorsDoneProject(context: EditContext): CheckedProject {
  return accepted(addPredecessor(progressProject(context), PROGRESS_WRITE_DOCS, PROGRESS_DESIGN, context));
}

/**
 * The small project with START 2026-09-01 and every Task Done, each on or after
 * its predecessors: both Project Finish Dates are the latest completion date,
 * 2026-09-10 (Test).
 */
function allDoneProject(context: EditContext): CheckedProject {
  let project = accepted(setStartDate(smallProject(context), PROGRESS_START_DATE, context));
  for (const [taskId, completionDate] of [
    [DESIGN, "2026-09-03"],
    [BUILD, "2026-09-08"],
    [TEST, "2026-09-10"],
    [WRITE_DOCS, "2026-09-05"],
  ] as const) {
    project = doneOn(project, taskId, completionDate, context);
  }
  return project;
}

/**
 * "Cyclic plan": A (1) depends on B (2) and B on A. Unlike every other fixture,
 * it is built by hand and deliberately bypasses the edit functions, which would
 * reject the cycle: no project they can build crashes the render at fixture
 * size. `forecast()` and `projectDiagram()` throw "The project contains a
 * cycle." on it, so the Planner shows its render crash fallback, as after the
 * long imported chain of observability audit A1.
 */
function renderCrashProject(): CheckedProject {
  // A cast, not toCheckedProject: the guardian would refuse the cycle this fixture exists to hold.
  return {
    name: "Cyclic plan",
    start: {},
    finish: {},
    dayCountingMode: "calendar-days",
    nextTaskId: 3,
    tasks: [
      { id: 1, name: "A", predecessors: [2], duration: 5, status: "to-do" },
      { id: 2, name: "B", predecessors: [1], duration: 3, status: "to-do" },
    ],
  } as CheckedProject;
}

const FIXTURES = {
  /** Build selected: one predecessor to remove, one Task to add and one that would create a cycle. */
  "selected-task": { project: smallProject, initialSelection: BUILD },
  /** The only Task, selected: the picker has nothing to offer. */
  "only-task": { project: onlyTaskProject, initialSelection: DESIGN },
  /** Test has no Duration and is selected: warned node, withheld strip. */
  "validation-warning": { project: warnedProject, initialSelection: TEST },
  /** Two equal critical chains, a shorter branch and a non-critical link between critical Tasks; Build (critical) selected. */
  "critical-path": { project: criticalPathProject, initialSelection: 2 },
  /** START selected with a past START date: the forecasting-from-today notes. */
  "start-selected": { project: pastStartProject, initialSelection: "start" },
  /** START selected on a weekdays project whose START date is a Saturday: the weekend notes and weekday units. */
  "weekdays-weekend-start": { project: weekdaysWeekendStartProject, initialSelection: "start" },
  /** Design Done (selected, with its Completion date), Build In Progress and critical, Write docs To Do. */
  progress: { project: progressProject, initialSelection: PROGRESS_DESIGN },
  /** Every Task Done: both Project Finish Dates are the latest completion date, with no swatch. */
  "all-done": { project: allDoneProject, initialSelection: null },
  /** START selected while its only successor is Done: the START date no longer affects the forecast. */
  "start-successors-done": { project: startSuccessorsDoneProject, initialSelection: "start" },
  empty: { project: createEmptyProject, initialSelection: null },
  /** A cyclic project the render throws on: the crash fallback, with nothing to go back to. */
  "render-crash": { project: renderCrashProject, initialSelection: null },
} satisfies Record<string, { project: (context: EditContext) => CheckedProject; initialSelection: Selection }>;

export type KitchenSinkFixture = keyof typeof FIXTURES;

export function KitchenSinkPlanner({ fixture }: { fixture: KitchenSinkFixture }) {
  const { project: build, initialSelection } = FIXTURES[fixture];
  // Built once: the Planner reads its initial project on the first render only.
  const [project] = useState(() => build({ today: todayIsoDate(new Date()) }));
  return <Planner initialProject={project} initialSelection={initialSelection} />;
}
