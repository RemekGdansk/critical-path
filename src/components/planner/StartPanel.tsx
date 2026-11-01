import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectActions } from "@/hooks/useProject";
import { MAX_ISO_DATE, MIN_ISO_DATE } from "@/lib/services/calendar-date";
import { forecastBaseDate, weekendMoveNote } from "@/lib/services/forecast";
import { startDateNotADate } from "@/lib/services/project";
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
 * in the past, and moved to Monday from a weekend when counting weekdays. A native date input fires `change` for every complete date, also
 * while the year is typed digit by digit (0002, 0020, 0202, 2026), so typing
 * edits a draft that commits on Enter or blur, and Escape restores it. Picking
 * from the calendar popup does not blur the input, so a change that follows no
 * key press in the field commits at once. Emptying every segment empties the
 * value; committed, that clears the date, as the browsers' own clear control
 * does. An impossible or partly filled date also reads as an empty value, but
 * with `validity.badInput` set: committed, it keeps the date and names the
 * START date rule.
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

  // From the forecast's own base date, so the note agrees with the summary even while the forecast is withheld.
  const base = forecastBaseDate(project, today);
  const notes = [
    base.baseDateReason === "start-date-unset" ? `Not set: the forecast starts from today, ${today}.` : undefined,
    base.baseDateReason === "start-date-in-past"
      ? `This date is in the past: the forecast starts from today, ${today}.`
      : undefined,
    base.baseDateReason === "start-successors-done"
      ? `The Tasks that follow START are Done, so this date no longer affects the forecast: it starts from today, ${today}.`
      : undefined,
    // Decided before start-date-unset, so it also says when the date is not set.
    base.baseDateReason === "all-tasks-done"
      ? date === undefined
        ? "Not set. Every Task is Done, so the START date does not affect the forecast."
        : "Every Task is Done, so this date no longer affects the forecast."
      : undefined,
    base.movedFromWeekend === undefined
      ? undefined
      : weekendMoveNote({ baseDate: base.baseDate, movedFromWeekend: base.movedFromWeekend }),
  ].filter((sentence) => sentence !== undefined);
  const note = notes.length === 0 ? undefined : notes.join(" ");

  function commit(value: string) {
    // Before the unchanged-value return: with START unset, an unreadable date is "" too.
    if (value === "" && dateRef.current?.validity.badInput === true) {
      setError(startDateNotADate().message);
      return;
    }
    if (value === (date ?? "")) {
      setError(undefined);
      return;
    }
    const result = setStartDate(value);
    setError(result.ok ? undefined : result.error.message);
  }

  // Enter is handled here, not by a form: a date input does not submit its form.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      typing.current = false;
      commit(event.currentTarget.value);
    } else if (event.key === "Escape") {
      typing.current = false;
      // Through the DOM too: React skips a value equal to the DOM's, and an unreadable date's is "".
      if (dateRef.current) dateRef.current.value = date ?? "";
      setDraft(date ?? "");
      setError(undefined);
    } else {
      typing.current = true;
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-sm font-semibold tracking-widest">START</h2>
      <div className="flex flex-col gap-2">
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
                // Empties unreadable segments too, so `badInput` no longer holds the date.
                if (dateRef.current) dateRef.current.value = "";
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
      </div>
    </section>
  );
}
