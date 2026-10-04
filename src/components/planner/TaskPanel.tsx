import { XIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type SubmitEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ProjectActions } from "@/hooks/useProject";
import { TASK_NAME_MAX_LENGTH, taskLabel } from "@/lib/services/project";
import { eligiblePredecessors } from "@/lib/services/task-graph";
import type { Project, Task } from "@/types";

type TaskPanelActions = Pick<ProjectActions, "renameTask" | "deleteTask" | "addPredecessor" | "removePredecessor">;

interface TaskPanelProps {
  task: Task;
  project: Project;
  actions: TaskPanelActions;
  /**
   * Set when this Task was selected by keyboard: each new value puts focus in
   * "Task name", on mount and on a repeat request for the same Task alike.
   * Undefined for a mouse selection, which leaves focus where it is.
   */
  focusRequest?: number;
}

/**
 * Edits the selected Task. Mount it with `key={task.id}` so the rename draft
 * starts over whenever another Task is selected.
 */
export function TaskPanel({ task, project, actions, focusRequest }: TaskPanelProps) {
  const { renameTask, deleteTask, addPredecessor, removePredecessor } = actions;

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusRequest !== undefined) nameRef.current?.focus();
  }, [focusRequest]);

  // The rename draft commits on Enter or blur, not per keystroke, so an
  // intermediate empty name is never rejected while the user is typing.
  const [draft, setDraft] = useState(task.name);
  const [renameError, setRenameError] = useState<string | undefined>(undefined);
  const [predecessorError, setPredecessorError] = useState<string | undefined>(undefined);

  const nameId = useId();
  const nameErrorId = useId();
  const predecessorsHeadingId = useId();
  const pickerId = useId();
  const pickerNoteId = useId();

  const tasksById = useMemo(() => new Map(project.tasks.map((candidate) => [candidate.id, candidate])), [project]);
  const eligible = useMemo(() => eligiblePredecessors(project, task.id), [project, task.id]);

  // The picker only chooses; "Add" commits. A closed select fires `change` on arrow
  // keys and type-ahead, so adding on change would add Tasks the user only browsed past.
  const [pickedValue, setPickedValue] = useState("");
  // A choice that another edit made ineligible resolves to the placeholder.
  const picked = eligible.some((candidate) => String(candidate.id) === pickedValue) ? pickedValue : "";

  function commitRename() {
    if (draft === task.name) {
      setRenameError(undefined);
      return;
    }
    const result = renameTask(task.id, draft);
    if (result.ok) {
      setDraft(result.project.tasks.find((candidate) => candidate.id === task.id)?.name ?? draft);
      setRenameError(undefined);
    } else {
      setRenameError(result.error.message);
    }
  }

  // The CSP's form-action 'none' blocks native submission; the form never navigates.
  function handleRenameSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    commitRename();
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setDraft(task.name);
      setRenameError(undefined);
    }
  }

  // The CSP's form-action 'none' blocks native submission; the form never navigates.
  function handleAddPredecessor(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (picked === "") return;
    const result = addPredecessor(task.id, Number(picked));
    if (result.ok) setPickedValue("");
    setPredecessorError(result.ok ? undefined : result.error.message);
  }

  function handleRemovePredecessor(predecessorId: number) {
    const result = removePredecessor(task.id, predecessorId);
    setPredecessorError(result.ok ? undefined : result.error.message);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleRenameSubmit} className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Task name</Label>
        <Input
          ref={nameRef}
          id={nameId}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={commitRename}
          onKeyDown={handleRenameKeyDown}
          maxLength={TASK_NAME_MAX_LENGTH}
          autoComplete="off"
          className="bg-background"
          aria-invalid={renameError !== undefined}
          aria-describedby={renameError === undefined ? undefined : nameErrorId}
        />
        {renameError !== undefined && (
          <p id={nameErrorId} role="alert" className="text-destructive text-sm">
            {renameError}
          </p>
        )}
      </form>

      <section className="flex flex-col gap-2" aria-labelledby={predecessorsHeadingId}>
        <h2 id={predecessorsHeadingId} className="text-sm font-medium">
          Predecessors
        </h2>
        {task.predecessors.length === 0 ? (
          <p className="text-muted-foreground text-sm">None — this Task hangs off START.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {task.predecessors.map((predecessorId) => {
              const predecessor = tasksById.get(predecessorId);
              const label = predecessor === undefined ? String(predecessorId) : taskLabel(predecessor);
              return (
                <li
                  key={predecessorId}
                  className="bg-sidebar-accent text-sidebar-accent-foreground flex items-center gap-2 rounded-md py-1 pr-1 pl-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate" title={label}>
                    {label}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    // The ghost hover surface (--accent) equals this row's --sidebar-accent, so it would not show.
                    className="hover:bg-background size-7"
                    aria-label={`Remove predecessor ${label}`}
                    onClick={() => {
                      handleRemovePredecessor(predecessorId);
                    }}
                  >
                    <XIcon />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <Label htmlFor={pickerId} className="mt-2">
          Add predecessor
        </Label>
        <form onSubmit={handleAddPredecessor} className="flex gap-2">
          {/* NativeSelect's wrapper is w-fit and takes no className, so this one fills the row. */}
          <div className="min-w-0 flex-1 *:w-full">
            <NativeSelect
              id={pickerId}
              value={picked}
              onChange={(event) => {
                setPickedValue(event.target.value);
              }}
              disabled={eligible.length === 0}
              aria-describedby={eligible.length === 0 ? pickerNoteId : undefined}
              className="bg-background"
            >
              <NativeSelectOption value="" disabled>
                Choose a Task…
              </NativeSelectOption>
              {eligible.map((candidate) => (
                <NativeSelectOption key={candidate.id} value={candidate.id}>
                  {taskLabel(candidate)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" variant="outline" disabled={picked === ""}>
            Add
          </Button>
        </form>
        {eligible.length === 0 && (
          <p id={pickerNoteId} className="text-muted-foreground text-sm">
            No Task is available: every other Task is already a predecessor or would create a cycle.
          </p>
        )}
        {predecessorError !== undefined && (
          <p role="alert" className="text-destructive text-sm">
            {predecessorError}
          </p>
        )}
      </section>

      <Button
        type="button"
        variant="destructive"
        // The variant's hover (destructive at 90%) is not visible on the near-white panel.
        className="hover:bg-destructive/80 self-start"
        onClick={() => {
          deleteTask(task.id);
        }}
      >
        Delete Task
      </Button>
    </div>
  );
}
