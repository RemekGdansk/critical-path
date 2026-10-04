// The real Planner on a fixture, for the dev-only kitchen sink. Astro can pass
// only serializable props to an island, so the page names a fixture and the
// project is built here, through the edit functions, so it never holds a
// Validation Error. No Tailwind classes: global.css excludes src/dev.
import { useState } from "react";

import { Planner } from "@/components/planner/Planner";
import { addPredecessor, createEmptyProject, createTask, type EditResult } from "@/lib/services/project";
import type { Project, TaskId } from "@/types";

function accepted(result: EditResult): Project {
  if (!result.ok) throw new Error(`Fixture edit was rejected (${result.error.rule}): ${result.error.message}`);
  return result.project;
}

const DESIGN: TaskId = 1;
const BUILD: TaskId = 2;
const TEST: TaskId = 3;
const WRITE_DOCS: TaskId = 4;

/** Design → Build → Test, and Design → Write docs: every other Task depends on Design. */
function smallProject(): Project {
  let project = createEmptyProject();
  for (const name of ["Design", "Build", "Test", "Write docs"]) project = accepted(createTask(project, name));
  project = accepted(addPredecessor(project, BUILD, DESIGN));
  project = accepted(addPredecessor(project, TEST, BUILD));
  project = accepted(addPredecessor(project, WRITE_DOCS, DESIGN));
  return project;
}

/** Design alone: no other Task can become its predecessor. */
function onlyTaskProject(): Project {
  return accepted(createTask(createEmptyProject(), "Design"));
}

const FIXTURES = {
  /** Build selected: one predecessor to remove, one Task to add and one that would create a cycle. */
  "selected-task": { project: smallProject, selectedTaskId: BUILD },
  /** The only Task, selected: the picker has nothing to offer. */
  "only-task": { project: onlyTaskProject, selectedTaskId: DESIGN },
  empty: { project: createEmptyProject, selectedTaskId: undefined },
} satisfies Record<string, { project: () => Project; selectedTaskId: TaskId | undefined }>;

export type KitchenSinkFixture = keyof typeof FIXTURES;

export function KitchenSinkPlanner({ fixture }: { fixture: KitchenSinkFixture }) {
  const { project: build, selectedTaskId } = FIXTURES[fixture];
  // Built once: the Planner reads its initial project on the first render only.
  const [project] = useState(build);
  return <Planner initialProject={project} initialSelectedTaskId={selectedTaskId} />;
}
