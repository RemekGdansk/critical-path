import { XIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type SubmitEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ProjectActions } from "@/hooks/useProject";
import { MIN_ISO_DATE } from "@/lib/services/calendar-date";
import { durationUnit } from "@/lib/services/duration";
import {
  completionDateNotADate,
  TASK_NAME_MAX_LENGTH,
  TASK_STATUSES,
  taskLabel,
  taskStatusName,
} from "@/lib/services/project";
import { predecessorCandidates } from "@/lib/services/task-graph";
import type { Project, Task, TaskStatus } from "@/types";

type TaskPanelActions = Pick<
  ProjectActions,
  | "renameTask"
  | "deleteTask"
  | "addPredecessor"
  | "removePredecessor"
  | "setDuration"
  | "setStatus"
  | "setCompletionDate"
>;

interface TaskPanelProps {
  task: Task;
  project: Project;
  /** ISO yyyy-mm-dd: the latest completion date the field offers. */
  today: string;
  actions: TaskPanelActions;
  /**
   * Set when this Task was selected by keyboard: each new value puts focus in
   * "Task name", on mount and on a repeat request for the same Task alike.
   * Undefined for a mouse selection, which leaves focus where it is.
   */
  focusRequest?: number;
}

/** The Duration as the field shows it; empty when unset. */
function durationText(task: Task): string {
  return task.duration === undefined ? "" : String(task.duration);
}

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.some((status) => status === value);
}

/**
 * Edits the selected Task. Mount it with `key={task.id}` so the rename and
 * Duration drafts start over whenever another Task is selected.
 *
 * The Completion date field, shown for a Done Task only, behaves as StartPanel's
 * START date: typing edits a draft that commits on Enter or blur, Escape
 * restores it, and a pick from the calendar popup commits at once. An
 * impossible or partly filled date reads as an empty value with
 * `validity.badInput` set: committed, it keeps the date and names the
 * completion date rule. It has no Clear button: a Done Task needs its date.
 */
export function TaskPanel({ task, project, today, actions, focusRequest }: TaskPanelProps) {
  const { renameTask, deleteTask, addPredecessor, removePredecessor, setDuration, setStatus, setCompletionDate } =
    actions;

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusRequest !== undefined) nameRef.current?.focus();
  }, [focusRequest]);

  // The rename draft commits on Enter or blur, not per keystroke, so an
  // intermediate empty name is never rejected while the user is typing.
  const [draft, setDraft] = useState(task.name);
  const [renameError, setRenameError] = useState<string | undefined>(undefined);
  const [predecessorError, setPredecessorError] = useState<string | undefined>(undefined);
  // The Duration draft commits the same way, on Enter or blur.
  const [durationDraft, setDurationDraft] = useState(durationText(task));
  const [durationError, setDurationError] = useState<string | undefined>(undefined);
  const [statusError, setStatusError] = useState<string | undefined>(undefined);
  const committedDate = task.completionDate ?? "";
  const [completionDateDraft, setCompletionDateDraft] = useState(committedDate);
  const [completionDateError, setCompletionDateError] = useState<string | undefined>(undefined);
  // The draft follows the committed date: marking the Task Done commits today's
  // date, and leaving Done removes it, so a draft from before would be stale.
  // Reset during render when either changes, so no frame shows the old draft.
  const [synced, setSynced] = useState({ status: task.status, completionDate: task.completionDate });
  if (synced.status !== task.status || synced.completionDate !== task.completionDate) {
    setSynced({ status: task.status, completionDate: task.completionDate });
    setCompletionDateDraft(committedDate);
    setCompletionDateError(undefined);
    if (synced.status !== task.status) setStatusError(undefined);
  }
  const completionDateRef = useRef<HTMLInputElement>(null);
  // Set by a key press in the field and cleared by a pointer press on it, so a
  // change that arrives while it is false came from the calendar popup.
  const typingCompletionDate = useRef(false);
  // The completion date the Task had when it last left Done in this panel. A closed
  // select fires `change` on arrow keys, so browsing past Done and back would replace a
  // backdated date with today; going back to Done restores it instead. Panel state only:
  // the project never holds a completion date on a Task that is not Done.
  const dateBeforeLeavingDone = useRef<string | undefined>(undefined);

  const nameId = useId();
  const nameErrorId = useId();
  const statusId = useId();
  const statusErrorId = useId();
  const completionDateId = useId();
  const completionDateErrorId = useId();
  const durationId = useId();
  const durationErrorId = useId();
  const predecessorsHeadingId = useId();
  const pickerId = useId();
  const pickerNoteId = useId();
  const predecessorErrorId = useId();

  const tasksById = useMemo(() => new Map(project.tasks.map((candidate) => [candidate.id, candidate])), [project]);
  const candidates = useMemo(() => predecessorCandidates(project, task.id), [project, task.id]);

  // The picker only chooses; "Add" commits. A closed select fires `change` on arrow
  // keys and type-ahead, so adding on change would add Tasks the user only browsed past.
  const [pickedValue, setPickedValue] = useState("");
  // A choice that another edit removed from the candidates resolves to the placeholder.
  // A refused choice stays picked, so the user sees which Task was refused.
  const picked = candidates.some((candidate) => String(candidate.task.id) === pickedValue) ? pickedValue : "";
  const pickerNote =
    candidates.length > 0
      ? undefined
      : project.tasks.length === 1
        ? "No other Task exists yet."
        : "No Task is available: every other Task is already a predecessor.";
  // Never both: a refusal needs a picked candidate, and the note shows only when there is none.
  const pickerDescribedBy =
    predecessorError !== undefined ? predecessorErrorId : pickerNote !== undefined ? pickerNoteId : undefined;

  function commitRename() {
    if (draft === task.name) {
      setRenameError(undefined);
      return;
    }
    const result = renameTask(task.id, draft);
    if (result.ok) {
      setDraft(result.project.tasks.find((candidate) => candidate.id === task.id)?.name ?? draft);
      setRenameError(undefined);
      // A shown predecessor, Status or completion date error names this Task by its old label.
      setPredecessorError(undefined);
      setStatusError(undefined);
      setCompletionDateError(undefined);
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

  function commitDuration() {
    if (durationDraft === durationText(task)) {
      setDurationError(undefined);
      return;
    }
    const result = setDuration(task.id, durationDraft);
    if (result.ok) {
      // Shows the Duration as stored: "05" becomes "5", " 3 " becomes "3".
      const updated = result.project.tasks.find((candidate) => candidate.id === task.id);
      setDurationDraft(updated === undefined ? durationDraft : durationText(updated));
      setDurationError(undefined);
    } else {
      setDurationError(result.error.message);
    }
  }

  // The CSP's form-action 'none' blocks native submission; the form never navigates.
  function handleDurationSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    commitDuration();
  }

  function handleDurationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setDurationDraft(durationText(task));
      setDurationError(undefined);
    }
  }

  // Commits on change: every choice is one whole edit, unlike a typed draft.
  function handleStatusChange(value: string) {
    if (!isTaskStatus(value)) return;
    const leavingDate = task.status === "done" && value !== "done" ? task.completionDate : undefined;
    const result = setStatus(task.id, value);
    if (!result.ok) {
      setStatusError(result.error.message);
      return;
    }
    setStatusError(undefined);
    if (leavingDate !== undefined) {
      dateBeforeLeavingDone.current = leavingDate;
    } else if (value === "done" && dateBeforeLeavingDone.current !== undefined) {
      const restored = dateBeforeLeavingDone.current;
      dateBeforeLeavingDone.current = undefined;
      // Through the guardian like any edit; if a Done rule now refuses it, today's date stays.
      setCompletionDate(task.id, restored);
    }
  }

  function commitCompletionDate(value: string) {
    // Before the unchanged-value return: an unreadable date is "" too, as an emptied one is.
    if (value === "" && completionDateRef.current?.validity.badInput === true) {
      setCompletionDateError(completionDateNotADate().message);
      return;
    }
    if (value === committedDate) {
      setCompletionDateError(undefined);
      return;
    }
    const result = setCompletionDate(task.id, value);
    setCompletionDateError(result.ok ? undefined : result.error.message);
  }

  // The CSP's form-action 'none' blocks native submission; the form never navigates.
  function handleCompletionDateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    typingCompletionDate.current = false;
    commitCompletionDate(completionDateDraft);
  }

  // Enter is handled here too, as in StartPanel: a date input does not submit its form in every browser.
  function handleCompletionDateKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      typingCompletionDate.current = false;
      commitCompletionDate(event.currentTarget.value);
    } else if (event.key === "Escape") {
      typingCompletionDate.current = false;
      // Through the DOM too: React skips a value equal to the DOM's, and an unreadable date's is "".
      if (completionDateRef.current) completionDateRef.current.value = committedDate;
      setCompletionDateDraft(committedDate);
      setCompletionDateError(undefined);
    } else {
      typingCompletionDate.current = true;
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

      <div className="flex flex-col gap-2">
        <Label htmlFor={statusId}>Status</Label>
        {/* NativeSelect's wrapper is w-fit and takes no className, so this one fills the row. */}
        <div className="*:w-full">
          {/* Shows the committed Status, so a refused choice falls back to it. */}
          <NativeSelect
            id={statusId}
            value={task.status}
            onChange={(event) => {
              handleStatusChange(event.target.value);
            }}
            aria-invalid={statusError !== undefined}
            aria-describedby={statusError === undefined ? undefined : statusErrorId}
            className="bg-background"
          >
            {TASK_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {taskStatusName(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {statusError !== undefined && (
          <p id={statusErrorId} role="alert" className="text-destructive text-sm wrap-break-word">
            {statusError}
          </p>
        )}
      </div>

      {task.status === "done" && (
        <form onSubmit={handleCompletionDateSubmit} className="flex flex-col gap-2">
          <Label htmlFor={completionDateId}>Completion date</Label>
          <Input
            ref={completionDateRef}
            id={completionDateId}
            type="date"
            min={project.start.date ?? MIN_ISO_DATE}
            max={today}
            value={completionDateDraft}
            onChange={(event) => {
              setCompletionDateDraft(event.target.value);
              if (!typingCompletionDate.current) commitCompletionDate(event.target.value);
            }}
            onKeyDown={handleCompletionDateKeyDown}
            onPointerDown={() => {
              typingCompletionDate.current = false;
            }}
            onBlur={() => {
              typingCompletionDate.current = false;
              commitCompletionDate(completionDateDraft);
            }}
            className="bg-background"
            aria-invalid={completionDateError !== undefined}
            aria-describedby={completionDateError === undefined ? undefined : completionDateErrorId}
          />
          {completionDateError !== undefined && (
            <p id={completionDateErrorId} role="alert" className="text-destructive text-sm wrap-break-word">
              {completionDateError}
            </p>
          )}
        </form>
      )}

      <form onSubmit={handleDurationSubmit} className="flex flex-col gap-2">
        <Label htmlFor={durationId}>Duration ({durationUnit(project.dayCountingMode)}s)</Label>
        <Input
          id={durationId}
          type="text"
          inputMode="numeric"
          value={durationDraft}
          onChange={(event) => {
            setDurationDraft(event.target.value);
          }}
          onBlur={commitDuration}
          onKeyDown={handleDurationKeyDown}
          autoComplete="off"
          className="bg-background"
          aria-invalid={durationError !== undefined}
          aria-describedby={durationError === undefined ? undefined : durationErrorId}
        />
        {durationError !== undefined && (
          <p id={durationErrorId} role="alert" className="text-destructive text-sm">
            {durationError}
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
                setPredecessorError(undefined);
              }}
              disabled={pickerNote !== undefined}
              aria-invalid={predecessorError !== undefined}
              aria-describedby={pickerDescribedBy}
              className="bg-background"
            >
              <NativeSelectOption value="" disabled>
                Choose a Task…
              </NativeSelectOption>
              {candidates.map(({ task: candidate, closesCycle }) => (
                <NativeSelectOption key={candidate.id} value={candidate.id}>
                  {closesCycle ? `${taskLabel(candidate)} (would create a cycle)` : taskLabel(candidate)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" variant="outline" disabled={picked === ""}>
            Add
          </Button>
        </form>
        {pickerNote !== undefined && (
          <p id={pickerNoteId} className="text-muted-foreground text-sm">
            {pickerNote}
          </p>
        )}
        {predecessorError !== undefined && (
          <p id={predecessorErrorId} role="alert" className="text-destructive text-sm wrap-break-word">
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
