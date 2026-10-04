// The real Planner on a fixture, for the dev-only kitchen sink. Astro can pass
// only serializable props to an island, so the page names a fixture and the
// project is built here, through the edit functions, so it never holds a
// Validation Error. No Tailwind classes: global.css excludes src/dev.
import { useState } from "react";

import { Planner } from "@/components/planner/Planner";
import type { Selection } from "@/hooks/useProject";
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
  if (!result.ok) throw new Error(`Fixture edit was rejected (${result.error.rule}): ${result.error.message}`);
  return result.project;
}

const DESIGN: TaskId = 1;
const BUILD: TaskId = 2;
const TEST: TaskId = 3;
const WRITE_DOCS: TaskId = 4;

/**
 * Design (3) → Build (5) → Test (2), and Design → Write docs (2): every other
 * Task depends on Design. No START date, so it forecasts from today.
 */
function smallProject(): Project {
  let project = createEmptyProject();
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

const FIXTURES = {
  /** Build selected: one predecessor to remove, one Task to add and one that would create a cycle. */
  "selected-task": { project: smallProject, initialSelection: BUILD },
  /** The only Task, selected: the picker has nothing to offer. */
  "only-task": { project: onlyTaskProject, initialSelection: DESIGN },
  /** Test has no Duration and is selected: warned node, withheld strip, Duration note. */
  "validation-warning": { project: warnedProject, initialSelection: TEST },
  /** START selected with a past START date: the forecasting-from-today notes. */
  "start-selected": { project: pastStartProject, initialSelection: "start" },
  empty: { project: createEmptyProject, initialSelection: null },
} satisfies Record<string, { project: () => Project; initialSelection: Selection }>;

export type KitchenSinkFixture = keyof typeof FIXTURES;

export function KitchenSinkPlanner({ fixture }: { fixture: KitchenSinkFixture }) {
  const { project: build, initialSelection } = FIXTURES[fixture];
  // Built once: the Planner reads its initial project on the first render only.
  const [project] = useState(build);
  return <Planner initialProject={project} initialSelection={initialSelection} />;
}
