import { useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ProjectActions } from "@/hooks/useProject";
import { downloadTextFile } from "@/lib/download";
import { parseProjectFile, projectFileName, serializeProject } from "@/lib/services/project-file";
import { DAY_COUNTING_MODES, isDayCountingMode, PROJECT_NAME_MAX_LENGTH } from "@/lib/services/project";
import type { DayCountingMode, Project } from "@/types";

/** 5 MB, far above any real project: a 100-Task file is about 15–100 KB. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const DAY_COUNTING_MODE_LABELS: Record<DayCountingMode, string> = {
  "calendar-days": "Calendar days",
  weekdays: "Weekdays (Mon–Fri)",
};

interface ProjectControlsProps {
  /** The committed project name; undefined while unset. */
  name: string | undefined;
  setProjectName: ProjectActions["setProjectName"];
  /** Called with an imported project only after `parseProjectFile` accepted it. */
  replaceProject: (project: Project) => void;
  /** The committed mode: the select follows the project, so an import shows the imported mode. */
  dayCountingMode: DayCountingMode;
  setDayCountingMode: ProjectActions["setDayCountingMode"];
}

/**
 * The project name, Export, Import and Day counting, in the header. Mount it with
 * `key={replacements}` so the name draft starts over from an imported name.
 * The name draft commits on Enter or blur, and Escape restores the committed
 * name. Export commits the draft first and exports the project that commit
 * returns, so typing a name and clicking Export downloads in one click.
 */
export function ProjectControls({
  name,
  setProjectName,
  replaceProject,
  dayCountingMode,
  setDayCountingMode,
}: ProjectControlsProps) {
  const [draft, setDraft] = useState(name ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const nameErrorId = useId();
  const modeId = useId();

  function commitName() {
    if (draft === (name ?? "")) {
      setNameError(undefined);
      return;
    }
    const result = setProjectName(draft);
    if (result.ok) {
      // Shows the name as stored: trimmed, or empty when cleared.
      setDraft(result.project.name ?? "");
      setNameError(undefined);
    } else {
      setNameError(result.error.message);
    }
  }

  // The CSP's form-action 'none' blocks native submission; the form never navigates.
  function handleNameSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    commitName();
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setDraft(name ?? "");
      setNameError(undefined);
    }
  }

  function handleExport() {
    // The returned project is the hook's latest committed one, never a stale render's.
    const result = setProjectName(draft);
    if (!result.ok) {
      setNameError(result.error.message);
      nameRef.current?.focus();
      return;
    }
    const exported = result.project;
    setDraft(exported.name ?? "");
    if (exported.name === undefined) {
      setNameError("Name the project to export it.");
      nameRef.current?.focus();
      return;
    }
    setNameError(undefined);
    setFileError(undefined);
    downloadTextFile(projectFileName(exported.name), serializeProject(exported), "application/json");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    // Read now: React clears currentTarget once the handler has run.
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    if (file.size > MAX_IMPORT_BYTES) {
      // Checked before reading: a huge file would freeze or crash the tab and lose the unexported project.
      input.value = "";
      setFileError(`${file.name} was not imported. The file is larger than 5 MB.`);
      return;
    }
    // Cleared before the read, so a repeated rejection re-mounts the alert and is announced again.
    setFileError(undefined);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setFileError(`${file.name} could not be read.`);
      return;
    } finally {
      // So picking the same file again fires `change` again.
      input.value = "";
    }
    const result = parseProjectFile(text);
    if (!result.ok) {
      // The current project stays as it was.
      setFileError(`${file.name} was not imported. ${result.error.message}`);
      return;
    }
    setNameError(undefined);
    setFileError(undefined);
    replaceProject(result.project);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <form onSubmit={handleNameSubmit} className="flex items-start gap-3">
          <Label htmlFor={nameId} className="h-9 shrink-0">
            Project name
          </Label>
          <div className="flex w-56 flex-col gap-1">
            <Input
              ref={nameRef}
              id={nameId}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onBlur={commitName}
              onKeyDown={handleNameKeyDown}
              maxLength={PROJECT_NAME_MAX_LENGTH}
              autoComplete="off"
              aria-invalid={nameError !== undefined}
              aria-describedby={nameError === undefined ? undefined : nameErrorId}
            />
            {nameError !== undefined && (
              <p id={nameErrorId} role="alert" className="text-destructive text-sm">
                {nameError}
              </p>
            )}
          </div>
        </form>
        <Button type="button" variant="outline" onClick={handleExport}>
          Export
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            fileRef.current?.click();
          }}
        >
          Import
        </Button>
        {/* Opened by the Import button; `hidden` keeps it out of the tab order and the accessibility tree. */}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            void handleFileChange(event);
          }}
        />
        <div className="flex items-center gap-3">
          <Label htmlFor={modeId} className="shrink-0">
            Day counting
          </Label>
          {/* Every mode is valid for every project, so a change commits at once and is never rejected. */}
          <NativeSelect
            id={modeId}
            value={dayCountingMode}
            onChange={(event) => {
              if (isDayCountingMode(event.target.value)) setDayCountingMode(event.target.value);
            }}
          >
            {DAY_COUNTING_MODES.map((mode) => (
              <NativeSelectOption key={mode} value={mode}>
                {DAY_COUNTING_MODE_LABELS[mode]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      {fileError !== undefined && (
        <p role="alert" className="text-destructive max-w-md text-sm wrap-break-word">
          {fileError}
        </p>
      )}
    </div>
  );
}
