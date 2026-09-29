import { useId, useState, type SubmitEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TASK_NAME_MAX_LENGTH, type EditResult } from "@/lib/services/project";

/**
 * The always-visible "New Task" input. Enter creates the Task and clears the
 * input, which keeps focus for the next name; the selection is left as it is.
 * A rejected name stays in the input with the rule shown beneath it.
 */
export function NewTaskForm({ createTask }: { createTask: (name: string) => EditResult }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const inputId = useId();
  const errorId = useId();

  // The CSP's form-action 'none' blocks native submission; the form never navigates.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createTask(name);
    if (result.ok) {
      setName("");
      setError(undefined);
    } else {
      setError(result.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-3">
      <Label htmlFor={inputId} className="h-9 shrink-0">
        New Task
      </Label>
      <div className="flex w-80 flex-col gap-1">
        <Input
          id={inputId}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          maxLength={TASK_NAME_MAX_LENGTH}
          placeholder="Task name, then Enter"
          autoComplete="off"
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : errorId}
        />
        {error !== undefined && (
          <p id={errorId} role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
