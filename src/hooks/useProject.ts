// Project and selection state for the planner island. Every action applies one
// pure edit function and commits the result only when it is accepted, so a
// rejected edit leaves the project exactly as it was. Each commit also keeps the
// project it superseded, so a view that crashed on the new one can go back.
// It also keeps the export baseline: the project last exported, imported or
// started new, against which `hasUnexportedChanges` compares the file text.
import { useCallback, useRef, useState } from "react";

import { todayIsoDate } from "@/lib/services/calendar-date";
import * as edits from "@/lib/services/project";
import type { CheckedProject, EditContext, EditResult } from "@/lib/services/project";
import { serializeProject } from "@/lib/services/project-file";
import type { DayCountingMode, Project, Task, TaskId } from "@/types";

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
   * such as one `parseProjectFile` accepted or a new empty project. Also resets
   * the export baseline to the replacement, so it has no unexported changes.
   */
  replaceProject: (project: CheckedProject) => void;
  /**
   * Commits `previousProject` again, clears it, selects nothing and counts as a
   * replacement. A no-op when there is no previous project.
   */
  restorePreviousProject: () => void;
  /**
   * Whether the latest project's file text differs from the export baseline's:
   * the project last exported, imported or started new, initially the one the
   * planner opened with. True when either cannot be serialized, so the user is
   * asked rather than losing work silently. Reads the latest commit, so an edit
   * committed earlier in the same event counts.
   */
  hasUnexportedChanges: () => boolean;
  /** Moves the export baseline to `project`, the one just written to a file. */
  markExported: (project: Project) => void;
}

export interface UseProjectOptions {
  /** Today as an ISO date (yyyy-mm-dd), read when each edit is applied; the local day from the clock by default. */
  today?: () => string;
}

function clockToday(): string {
  return todayIsoDate(new Date());
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
 * `options.today` is read on first render only, so every action stays stable.
 */
export function useProject(
  initial?: CheckedProject | (() => CheckedProject),
  initialSelection: Selection = null,
  options?: UseProjectOptions,
): ProjectState {
  const [today] = useState(() => options?.today ?? clockToday);
  const [project, setProject] = useState<CheckedProject>(
    initial ?? (() => edits.createEmptyProject({ today: today() })),
  );
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
  // The export baseline. A ref only, never state: nothing renders it, and the
  // check reads it on demand in event handlers. Accepted edits and a restore
  // leave it where it is.
  const baseline = useRef<Project>(project);

  // Every commit goes through here, recording what it supersedes before
  // overwriting `latest`.
  const commit = useCallback((next: CheckedProject, superseded: CheckedProject | undefined) => {
    previous.current = superseded;
    setPreviousProject(superseded);
    latest.current = next;
    setProject(next);
  }, []);

  // Today is read when the edit is applied, not when the action was created.
  const apply = useCallback(
    (edit: (current: CheckedProject, context: EditContext) => EditResult): EditResult => {
      const result = edit(latest.current, { today: today() });
      if (result.ok) commit(result.project, latest.current);
      return result;
    },
    [commit, today],
  );

  const select = useCallback((target: Selection) => {
    setSelection(target);
  }, []);
  const createTask = useCallback(
    (name: string) => apply((current, context) => edits.createTask(current, name, context)),
    [apply],
  );
  const renameTask = useCallback(
    (taskId: TaskId, name: string) => apply((current, context) => edits.renameTask(current, taskId, name, context)),
    [apply],
  );
  const deleteTask = useCallback(
    (taskId: TaskId) => apply((current, context) => edits.deleteTask(current, taskId, context)),
    [apply],
  );
  const addPredecessor = useCallback(
    (taskId: TaskId, predecessorId: TaskId) =>
      apply((current, context) => edits.addPredecessor(current, taskId, predecessorId, context)),
    [apply],
  );
  const removePredecessor = useCallback(
    (taskId: TaskId, predecessorId: TaskId) =>
      apply((current, context) => edits.removePredecessor(current, taskId, predecessorId, context)),
    [apply],
  );

  const setDuration = useCallback(
    (taskId: TaskId, input: string) => apply((current, context) => edits.setDuration(current, taskId, input, context)),
    [apply],
  );
  const setStartDate = useCallback(
    (input: string) => apply((current, context) => edits.setStartDate(current, input, context)),
    [apply],
  );
  const setProjectName = useCallback(
    (input: string) => apply((current, context) => edits.setProjectName(current, input, context)),
    [apply],
  );
  const setDayCountingMode = useCallback(
    (mode: DayCountingMode) => apply((current, context) => edits.setDayCountingMode(current, mode, context)),
    [apply],
  );

  // Commits through the latest ref like every edit. The selection is cleared,
  // not kept: a stored Task id would resolve to an unrelated imported Task.
  const replaceProject = useCallback(
    (replacement: CheckedProject) => {
      commit(replacement, latest.current);
      baseline.current = replacement;
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

  // Short-circuits on identity, so a project untouched since the baseline costs
  // nothing; otherwise compares the file text, so a rename and back is clean.
  const hasUnexportedChanges = useCallback(() => {
    const current = latest.current;
    if (current === baseline.current) return false;
    try {
      return serializeProject(current) !== serializeProject(baseline.current);
    } catch {
      return true;
    }
  }, []);

  const markExported = useCallback((exported: Project) => {
    baseline.current = exported;
  }, []);

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
    hasUnexportedChanges,
    markExported,
  };
}
