// Project and selection state for the planner island. Every action applies one
// pure edit function and commits the result only when it is accepted, so a
// rejected edit leaves the project exactly as it was. Each commit also keeps the
// project it superseded, so a view that crashed on the new one can go back.
import { useCallback, useRef, useState } from "react";

import * as edits from "@/lib/services/project";
import type { CheckedProject, EditResult } from "@/lib/services/project";
import type { DayCountingMode, Task, TaskId } from "@/types";

/** What the side panel edits: a Task, START, or nothing. */
export type Selection = TaskId | "start" | null;

export interface ProjectActions {
  select: (target: Selection) => void;
  createTask: (name: string) => EditResult;
  renameTask: (taskId: TaskId, name: string) => EditResult;
  deleteTask: (taskId: TaskId) => EditResult;
  addPredecessor: (taskId: TaskId, predecessorId: TaskId) => EditResult;
  removePredecessor: (taskId: TaskId, predecessorId: TaskId) => EditResult;
  setDuration: (taskId: TaskId, input: string) => EditResult;
  setStartDate: (input: string) => EditResult;
  setDayCountingMode: (mode: DayCountingMode) => EditResult;
  setProjectName: (input: string) => EditResult;
  /**
   * Replaces the whole project and selects nothing. Takes a `CheckedProject`,
   * such as one `parseProjectFile` accepted or a new empty project.
   */
  replaceProject: (project: CheckedProject) => void;
  /**
   * Commits `previousProject` again, clears it, selects nothing and counts as a
   * replacement. A no-op when there is no previous project.
   */
  restorePreviousProject: () => void;
}

export interface ProjectState extends ProjectActions {
  project: CheckedProject;
  /** As selected: a deleted Task's id is kept here, and `selectedTask` resolves it to undefined. */
  selection: Selection;
  /** The selected Task, or undefined when none is selected or the selected one was deleted. */
  selectedTask: Task | undefined;
  /** How many times `replaceProject` or `restorePreviousProject` has run; a key that resets views holding drafts of the old project. */
  replacements: number;
  /**
   * The project the latest accepted edit or replacement superseded. Undefined until
   * the first commit and after a restore; a rejected edit leaves it unchanged.
   */
  previousProject: CheckedProject | undefined;
}

/**
 * `initial` may be a lazy initializer, as with `useState`, so a costly project is built once.
 * `initialSelection` is what is selected on first render; nothing by default.
 */
export function useProject(
  initial?: CheckedProject | (() => CheckedProject),
  initialSelection: Selection = null,
): ProjectState {
  const [project, setProject] = useState<CheckedProject>(initial ?? edits.createEmptyProject);
  // Stored as given and resolved on read: a deleted Task simply resolves to
  // "nothing selected", and a START selection survives every Task edit.
  const [selection, setSelection] = useState<Selection>(initialSelection);
  // The latest committed project, so two edits in one event (a rename committed
  // on blur, then a click) never apply to a stale render's project.
  const latest = useRef(project);
  const [replacements, setReplacements] = useState(0);
  // The project the latest commit superseded, mirrored in a ref for the same
  // reason as `latest`: a restore reads it in the event that calls it.
  const [previousProject, setPreviousProject] = useState<CheckedProject | undefined>(undefined);
  const previous = useRef<CheckedProject | undefined>(undefined);

  // Every commit goes through here, recording what it supersedes before
  // overwriting `latest`.
  const commit = useCallback((next: CheckedProject, superseded: CheckedProject | undefined) => {
    previous.current = superseded;
    setPreviousProject(superseded);
    latest.current = next;
    setProject(next);
  }, []);

  const apply = useCallback(
    (edit: (current: CheckedProject) => EditResult): EditResult => {
      const result = edit(latest.current);
      if (result.ok) commit(result.project, latest.current);
      return result;
    },
    [commit],
  );

  const select = useCallback((target: Selection) => {
    setSelection(target);
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

  const setDuration = useCallback(
    (taskId: TaskId, input: string) => apply((current) => edits.setDuration(current, taskId, input)),
    [apply],
  );
  const setStartDate = useCallback((input: string) => apply((current) => edits.setStartDate(current, input)), [apply]);
  const setProjectName = useCallback(
    (input: string) => apply((current) => edits.setProjectName(current, input)),
    [apply],
  );
  const setDayCountingMode = useCallback(
    (mode: DayCountingMode) => apply((current) => edits.setDayCountingMode(current, mode)),
    [apply],
  );

  // Commits through the latest ref like every edit. The selection is cleared,
  // not kept: a stored Task id would resolve to an unrelated imported Task.
  const replaceProject = useCallback(
    (replacement: CheckedProject) => {
      commit(replacement, latest.current);
      setSelection(null);
      setReplacements((count) => count + 1);
    },
    [commit],
  );

  // Clears the previous project rather than swapping it in, so a second crash
  // offers no "go back". Counts as a replacement, so views keyed by it remount.
  const restorePreviousProject = useCallback(() => {
    const restored = previous.current;
    if (restored === undefined) return;
    commit(restored, undefined);
    setSelection(null);
    setReplacements((count) => count + 1);
  }, [commit]);

  const selectedTask = typeof selection === "number" ? project.tasks.find((task) => task.id === selection) : undefined;

  return {
    project,
    selection,
    selectedTask,
    replacements,
    previousProject,
    select,
    createTask,
    renameTask,
    deleteTask,
    addPredecessor,
    removePredecessor,
    setDuration,
    setStartDate,
    setDayCountingMode,
    setProjectName,
    replaceProject,
    restorePreviousProject,
  };
}
