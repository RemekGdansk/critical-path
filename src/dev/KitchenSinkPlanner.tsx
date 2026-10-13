// The real Planner on a fixture, for the dev-only kitchen sink. Astro can pass
// only serializable props to an island, so the page names a fixture and the
// project is built here, through the edit functions, so it never holds a
// Validation Error (the one exception is the "render-crash" fixture). No
// Tailwind classes: global.css excludes src/dev.
import { useState } from "react";

import { Planner } from "@/components/planner/Planner";
import type { Selection } from "@/hooks/useProject";
import {
  addPredecessor,
  createEmptyProject,
  createTask,
  type EditResult,
  setDayCountingMode,
  setDuration,
  setProjectName,
  setStartDate,
} from "@/lib/services/project";
import type { Project, TaskId } from "@/types";

function accepted(result: EditResult): Project {
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
function smallProject(): Project {
  let project = accepted(setProjectName(createEmptyProject(), "Website relaunch"));
  for (const name of ["Design", "Build", "Test", "Write docs"]) project = accepted(createTask(project, name));
  project = accepted(addPredecessor(project, BUILD, DESIGN));
  project = accepted(addPredecessor(project, TEST, BUILD));
  project = accepted(addPredecessor(project, WRITE_DOCS, DESIGN));
  for (const [taskId, days] of [
    [DESIGN, "3"],
    [BUILD, "5"],
    [TEST, "2"],
    [WRITE_DOCS, "2"],
  ] as const) {
    project = accepted(setDuration(project, taskId, days));
  }
  return project;
}

/** Design alone: no other Task can become its predecessor. */
function onlyTaskProject(): Project {
  return accepted(createTask(createEmptyProject(), "Design"));
}

/** The small project with Test's Duration cleared: a Validation Warning withholds the forecast. */
function warnedProject(): Project {
  return accepted(setDuration(smallProject(), TEST, ""));
}

/** The small project with a START date fixed in the past, so the forecast starts from today. */
function pastStartProject(): Project {
  return accepted(setStartDate(smallProject(), "2020-01-01"));
}

/**
 * The small project counting weekdays, with START on Saturday 2999-01-05 (far
 * ahead of any real today): the forecast moves it to Monday 2999-01-07.
 */
function weekdaysWeekendStartProject(): Project {
  return accepted(setStartDate(accepted(setDayCountingMode(smallProject(), "weekdays")), "2999-01-05"));
}

/**
 * "Cyclic plan": A (1) depends on B (2) and B on A. Unlike every other fixture,
 * it is built by hand and deliberately bypasses the edit functions, which would
 * reject the cycle: no project they can build crashes the render at fixture
 * size. `forecast()` throws "The project contains a cycle." on it, so the
 * Planner shows its render crash fallback, as after the long imported chain of
 * observability audit A1.
 */
function renderCrashProject(): Project {
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
  };
}

const FIXTURES = {
  /** Build selected: one predecessor to remove, one Task to add and one that would create a cycle. */
  "selected-task": { project: smallProject, initialSelection: BUILD },
  /** The only Task, selected: the picker has nothing to offer. */
  "only-task": { project: onlyTaskProject, initialSelection: DESIGN },
  /** Test has no Duration and is selected: warned node, withheld strip. */
  "validation-warning": { project: warnedProject, initialSelection: TEST },
  /** START selected with a past START date: the forecasting-from-today notes. */
  "start-selected": { project: pastStartProject, initialSelection: "start" },
  /** START selected on a weekdays project whose START date is a Saturday: the weekend notes and weekday units. */
  "weekdays-weekend-start": { project: weekdaysWeekendStartProject, initialSelection: "start" },
  empty: { project: createEmptyProject, initialSelection: null },
  /** A cyclic project the render throws on: the crash fallback, with nothing to go back to. */
  "render-crash": { project: renderCrashProject, initialSelection: null },
} satisfies Record<string, { project: () => Project; initialSelection: Selection }>;

export type KitchenSinkFixture = keyof typeof FIXTURES;

export function KitchenSinkPlanner({ fixture }: { fixture: KitchenSinkFixture }) {
  const { project: build, initialSelection } = FIXTURES[fixture];
  // Built once: the Planner reads its initial project on the first render only.
  const [project] = useState(build);
  return <Planner initialProject={project} initialSelection={initialSelection} />;
}
