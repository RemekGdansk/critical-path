import { useEffect, useId, useRef, useState } from "react";

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
 * in the past. The date commits on every change: a native date input fires one
 * per complete date (also while the year is typed digit by digit), and picking
 * from the calendar popup does not blur the input. Emptying a segment fires an
 * empty value, which clears the date until it is complete again; the forecast
 * falls back to today meanwhile.
 */
export function StartPanel({ project, today, setStartDate, focusRequest }: StartPanelProps) {
  const dateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusRequest !== undefined) dateRef.current?.focus();
  }, [focusRequest]);

  const [error, setError] = useState<string | undefined>(undefined);
  const headingId = useId();
  const dateId = useId();
  const errorId = useId();
  const noteId = useId();

  const date = project.start.date;
  const note =
    date === undefined
      ? `Not set: the forecast starts from today, ${today}.`
      : compareIsoDates(date, today) < 0
        ? `This date is in the past: the forecast starts from today, ${today}.`
        : undefined;

  function commit(value: string) {
    const result = setStartDate(value);
    setError(result.ok ? undefined : result.error.message);
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-sm font-semibold tracking-widest">
        START
      </h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor={dateId}>START date</Label>
        <div className="flex gap-2">
          <Input
            ref={dateRef}
            id={dateId}
            type="date"
            min={MIN_ISO_DATE}
            max={MAX_ISO_DATE}
            value={date ?? ""}
            onChange={(event) => {
              commit(event.target.value);
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
