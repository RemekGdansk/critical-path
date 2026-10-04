// Deterministic projects for tests and the dev-only 200 ms check. Built only
// through the edit functions, so a fixture never holds a Validation Error.
import { addPredecessor, createEmptyProject, createTask, type EditResult, setDuration } from "@/lib/services/project";
import type { Project, TaskId } from "@/types";

// Tasks per layer, repeated until the Task count is reached.
const LAYER_SIZES = [3, 5, 4, 6, 5, 7, 4, 6, 5, 3];

function accepted(result: EditResult): Project {
  if (!result.ok) throw new Error(`Fixture edit was rejected (${result.error.rule}): ${result.error.message}`);
  return result.project;
}

/**
 * A layered project of `taskCount` Tasks named "Task 1", "Task 2", …: the
 * first layer hangs off START; every later Task depends on one Task of the
 * previous layer (branches), every odd-positioned one on a second (joins), and
 * every fifth one also on a Task two layers back (links that skip a layer).
 * Every Task has a Duration of 1–5 days, so the project forecasts.
 */
export function createPerfProject(taskCount = 100): Project {
  let project = createEmptyProject();
  const layers: TaskId[][] = [];

  for (let layerIndex = 0; project.tasks.length < taskCount; layerIndex++) {
    const size = Math.min(LAYER_SIZES[layerIndex % LAYER_SIZES.length], taskCount - project.tasks.length);
    const previous = layerIndex >= 1 ? layers[layerIndex - 1] : [];
    const twoBack = layerIndex >= 2 ? layers[layerIndex - 2] : [];
    const layer: TaskId[] = [];

    for (let position = 0; position < size; position++) {
      const taskId = project.nextTaskId;
      project = accepted(createTask(project, `Task ${taskId}`));
      project = accepted(setDuration(project, taskId, String((taskId % 5) + 1)));
      layer.push(taskId);

      const predecessorIds = new Set<TaskId>();
      if (previous.length > 0) {
        predecessorIds.add(previous[position % previous.length]);
        if (position % 2 === 1) predecessorIds.add(previous[(position + 1) % previous.length]);
      }
      if (twoBack.length > 0 && position % 5 === 0) predecessorIds.add(twoBack[position % twoBack.length]);
      for (const predecessorId of predecessorIds) project = accepted(addPredecessor(project, taskId, predecessorId));
    }
    layers.push(layer);
  }
  return project;
}
