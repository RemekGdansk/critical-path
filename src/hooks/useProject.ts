// Project and selection state for the planner island. Every action applies one
// pure edit function and commits the result only when it is accepted, so a
// rejected edit leaves the project exactly as it was.
import { useCallback, useRef, useState } from "react";

import * as edits from "@/lib/services/project";
import type { EditResult } from "@/lib/services/project";
import type { Project, Task, TaskId } from "@/types";

export interface ProjectActions {
  select: (taskId: TaskId | null) => void;
  createTask: (name: string) => EditResult;
  renameTask: (taskId: TaskId, name: string) => EditResult;
  deleteTask: (taskId: TaskId) => EditResult;
  addPredecessor: (taskId: TaskId, predecessorId: TaskId) => EditResult;
  removePredecessor: (taskId: TaskId, predecessorId: TaskId) => EditResult;
}

export interface ProjectState extends ProjectActions {
  project: Project;
  /** The selected Task, or undefined when none is selected or the selected one was deleted. */
  selectedTask: Task | undefined;
}

/** `initial` may be a lazy initializer, as with `useState`, so a costly project is built once. */
export function useProject(initial?: Project | (() => Project)): ProjectState {
  const [project, setProject] = useState<Project>(initial ?? edits.createEmptyProject);
  // Stored as given and resolved on read: a deleted Task simply resolves to "nothing selected".
  const [selectedTaskId, setSelectedTaskId] = useState<TaskId | null>(null);
  // The latest committed project, so two edits in one event (a rename committed
  // on blur, then a click) never apply to a stale render's project.
  const latest = useRef(project);

  const apply = useCallback((edit: (current: Project) => EditResult): EditResult => {
    const result = edit(latest.current);
    if (result.ok) {
      latest.current = result.project;
      setProject(result.project);
    }
    return result;
  }, []);

  const select = useCallback((taskId: TaskId | null) => {
    setSelectedTaskId(taskId);
  }, []);
  const createTask = useCallback((name: string) => apply((current) => edits.createTask(current, name)), [apply]);
  const renameTask = useCallback(
    (taskId: TaskId, name: string) => apply((current) => edits.renameTask(current, taskId, name)),
    [apply],
  );
  const deleteTask = useCallback((taskId: TaskId) => apply((current) => edits.deleteTask(current, taskId)), [apply]);
  const addPredecessor = useCallback(
    (taskId: TaskId, predecessorId: TaskId) => apply((current) => edits.addPredecessor(current, taskId, predecessorId)),
    [apply],
  );
  const removePredecessor = useCallback(
    (taskId: TaskId, predecessorId: TaskId) =>
      apply((current) => edits.removePredecessor(current, taskId, predecessorId)),
    [apply],
  );

  const selectedTask = selectedTaskId === null ? undefined : project.tasks.find((task) => task.id === selectedTaskId);

  return { project, selectedTask, select, createTask, renameTask, deleteTask, addPredecessor, removePredecessor };
}
