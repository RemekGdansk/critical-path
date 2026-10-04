import { useEffect, useId, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectActions } from "@/hooks/useProject";
import { compareIsoDates, MAX_ISO_DATE, MIN_ISO_DATE } from "@/lib/services/calendar-date";
import type { Project } from "@/types";

interface StartPanelProps {
  project: Project;
  /** ISO yyyy-mm-dd, the date the forecast falls back to. */
  today: string;
  setStartDate: ProjectActions["setStartDate"];
  /** Set when START was selected by keyboard: each new value puts focus in "START date". */
  focusRequest?: number;
}

/**
 * Edits START: its date, which the forecast starts from unless it is unset or
 * in the past. A native date input fires `change` for every complete date, also
 * while the year is typed digit by digit (0002, 0020, 0202, 2026), so typing
 * edits a draft that commits on Enter or blur, and Escape restores it. Picking
 * from the calendar popup does not blur the input, so a change that follows no
 * key press in the field commits at once. Emptying a segment empties the value;
 * committed, that clears the date, as the browsers' own clear control does.
 */
export function StartPanel({ project, today, setStartDate, focusRequest }: StartPanelProps) {
  const dateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusRequest !== undefined) dateRef.current?.focus();
  }, [focusRequest]);

  const [error, setError] = useState<string | undefined>(undefined);
  const date = project.start.date;
  const [draft, setDraft] = useState(date ?? "");
  // Set by a key press in the field and cleared by a pointer press on it, so a
  // change that arrives while it is false came from the calendar popup.
  const typing = useRef(false);
  const dateId = useId();
  const errorId = useId();
  const noteId = useId();

  const note =
    date === undefined
      ? `Not set: the forecast starts from today, ${today}.`
      : compareIsoDates(date, today) < 0
        ? `This date is in the past: the forecast starts from today, ${today}.`
        : undefined;

  function commit(value: string) {
    if (value === (date ?? "")) {
      setError(undefined);
      return;
    }
    const result = setStartDate(value);
    setError(result.ok ? undefined : result.error.message);
  }

  // The CSP's form-action 'none' blocks native submission; the form never navigates.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    commit(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      typing.current = false;
      setDraft(date ?? "");
      setError(undefined);
    } else if (event.key !== "Enter") {
      typing.current = true;
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-sm font-semibold tracking-widest">START</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Label htmlFor={dateId}>START date</Label>
        <div className="flex gap-2">
          <Input
            ref={dateRef}
            id={dateId}
            type="date"
            min={MIN_ISO_DATE}
            max={MAX_ISO_DATE}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (!typing.current) commit(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            onPointerDown={() => {
              typing.current = false;
            }}
            onBlur={() => {
              typing.current = false;
              commit(draft);
            }}
            className="bg-background"
            aria-invalid={error !== undefined}
            aria-describedby={error !== undefined ? errorId : note !== undefined ? noteId : undefined}
          />
          {date !== undefined && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft("");
                commit("");
                // The button unmounts with the date, so focus would otherwise fall to <body>.
                dateRef.current?.focus();
              }}
            >
              Clear
            </Button>
          )}
        </div>
        {error !== undefined && (
          <p id={errorId} role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {note !== undefined && (
          <p id={noteId} className="text-muted-foreground text-sm">
            {note}
          </p>
        )}
      </form>
    </section>
  );
}
