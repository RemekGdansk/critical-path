import { useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type SubmitEvent } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ProjectActions } from "@/hooks/useProject";
import { downloadTextFile } from "@/lib/download";
import { parseProjectFile, projectFileName, serializeProject } from "@/lib/services/project-file";
import {
  type CheckedProject,
  createEmptyProject,
  DAY_COUNTING_MODES,
  isDayCountingMode,
  PROJECT_NAME_MAX_LENGTH,
} from "@/lib/services/project";
import type { DayCountingMode } from "@/types";

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
  replaceProject: ProjectActions["replaceProject"];
  /** The committed mode: the select follows the project, so an import shows the imported mode. */
  dayCountingMode: DayCountingMode;
  setDayCountingMode: ProjectActions["setDayCountingMode"];
  /** Asked before New project or an accepted Import replaces the project. */
  hasUnexportedChanges: ProjectActions["hasUnexportedChanges"];
  /** Called with the exported project once its download has started. */
  markExported: ProjectActions["markExported"];
}

/** The replacement waiting for the user to confirm discarding unexported changes. */
type PendingReplacement = { kind: "new" } | { kind: "import"; fileName: string; project: CheckedProject } | null;

const UNEXPORTED_TITLE = "Discard unexported changes?";

/**
 * The project name, New project, Export, Import and Day counting, in the header.
 * Mount it with `key={replacements}` so the name draft starts over from an
 * imported name. The name draft commits on Enter or blur, and Escape restores
 * the committed name. Export commits the draft first and exports the project
 * that commit returns, so typing a name and clicking Export downloads in one
 * click; the exported project becomes the export baseline. New project and an
 * Import that `parseProjectFile` accepted replace the project at once when it
 * has no unexported changes, and otherwise only after the user confirms
 * discarding them; Cancel or Escape changes nothing and returns focus to the
 * button that started the action. A rejected file never asks.
 */
export function ProjectControls({
  name,
  setProjectName,
  replaceProject,
  dayCountingMode,
  setDayCountingMode,
  hasUnexportedChanges,
  markExported,
}: ProjectControlsProps) {
  const [draft, setDraft] = useState(name ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const newProjectRef = useRef<HTMLButtonElement>(null);
  const importRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<PendingReplacement>(null);
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
    markExported(exported);
  }

  // The modal dialog makes everything outside it inert, so it is unmounted
  // synchronously before focus moves out of it (to New Task on a replacement).
  function closeDialog() {
    flushSync(() => {
      setPending(null);
    });
  }

  function replaceWith(project: CheckedProject) {
    setNameError(undefined);
    setFileError(undefined);
    replaceProject(project);
  }

  // Reads the hook's latest commit, so a name committed by this click's blur counts.
  function handleNewProject() {
    if (hasUnexportedChanges()) {
      setPending({ kind: "new" });
      return;
    }
    replaceWith(createEmptyProject());
  }

  function handleConfirm() {
    const confirmed = pending;
    if (confirmed === null) return;
    closeDialog();
    replaceWith(confirmed.kind === "new" ? createEmptyProject() : confirmed.project);
  }

  // Focus goes back explicitly: the Import button may not hold focus after the file picker.
  function handleCancel() {
    const returnTo = pending?.kind === "import" ? importRef : newProjectRef;
    closeDialog();
    returnTo.current?.focus();
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
    if (hasUnexportedChanges()) {
      setPending({ kind: "import", fileName: file.name, project: result.project });
      return;
    }
    replaceWith(result.project);
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
        <Button ref={newProjectRef} type="button" variant="outline" onClick={handleNewProject}>
          New project
        </Button>
        <Button type="button" variant="outline" onClick={handleExport}>
          Export
        </Button>
        <Button
          ref={importRef}
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
      <ConfirmDialog
        open={pending !== null}
        title={UNEXPORTED_TITLE}
        description={
          pending?.kind === "import"
            ? `The current project has changes that were not exported. Importing ${pending.fileName} replaces the project and discards them.`
            : "The current project has changes that were not exported. Starting a new project discards them."
        }
        confirmLabel={pending?.kind === "import" ? "Discard and import" : "Discard and start a new project"}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
