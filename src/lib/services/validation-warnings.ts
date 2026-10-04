// The single definition of a Validation Warning: a state the project may hold,
// export and import, but that withholds both Project Finish Dates while present.
import type { Project, TaskId } from "@/types";

export type ValidationWarningRule = "duration-missing";

export interface ValidationWarning {
  rule: ValidationWarningRule;
  taskId: TaskId;
  message: string;
}

/**
 * One warning per not-Done Task without a Duration, in creation order. A Done
 * Task needs no Duration: only remaining work is forecast.
 */
export function validationWarnings(project: Pick<Project, "tasks">): ValidationWarning[] {
  return project.tasks
    .filter((task) => task.status !== "done" && task.duration === undefined)
    .map((task) => ({ rule: "duration-missing", taskId: task.id, message: `${task.name} has no Duration.` }));
}
