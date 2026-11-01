import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { downloadTextFile } from "@/lib/download";
import { todayIsoDate } from "@/lib/services/calendar-date";
import { projectFileName, serializeProject } from "@/lib/services/project-file";
import { validateProject } from "@/lib/services/project";
import type { Project } from "@/types";

/** The file name of a recovered project that has no name of its own. */
const RECOVERED_FILE_NAME = "critical-path-recovered.json";

interface RenderCrashFallbackProps {
  /** What the render threw. */
  error: unknown;
  /** The committed project the render threw on. */
  project: Project;
  /** The project before the last accepted edit or replacement, if any. */
  previousProject: Project | undefined;
  onGoBack: () => void;
  /** Asked when Go back is clicked, never while rendering. */
  hasUnexportedChanges: () => boolean;
  /** Called with the exported project once its download has started. */
  onExported: (project: Project) => void;
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * `validateProject` on the project the render threw on. Nothing catches a throw
 * from this fallback, so a project too malformed to check (a shape only an
 * import-parser bug could produce) yields the checker's own error, shown in
 * the alert, instead of blanking the page.
 */
function inspectCrashedProject(
  project: Project,
): { validationError: ReturnType<typeof validateProject> } | { checkError: unknown } {
  try {
    return { validationError: validateProject(project, { today: todayIsoDate(new Date()) }) };
  } catch (checkError) {
    return { checkError };
  }
}

/**
 * Shown in place of the planner after a render throw. The project is still in
 * memory, so it stays one click from a file and, when there is one, the
 * previous project one click from the planner. Renders nothing that derives
 * from the project beyond its serialization and `inspectCrashedProject`; the
 * unexported-changes check runs only when Go back is clicked. Go back acts at
 * once when the project it stopped on has no unexported changes, and otherwise
 * only after the user confirms discarding them; Cancel or Escape changes
 * nothing and returns focus to Go back. Export makes the exported project the
 * export baseline.
 */
export function RenderCrashFallback({
  error,
  project,
  previousProject,
  onGoBack,
  hasUnexportedChanges,
  onExported,
}: RenderCrashFallbackProps) {
  const exportRef = useRef<HTMLButtonElement>(null);
  const goBackRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  // On mount, so a keyboard user lands on the action that keeps the project.
  useEffect(() => {
    exportRef.current?.focus();
  }, []);

  const check = inspectCrashedProject(project);

  function handleExport() {
    const fileName = project.name === undefined ? RECOVERED_FILE_NAME : projectFileName(project.name);
    downloadTextFile(fileName, serializeProject(project), "application/json");
    onExported(project);
  }

  function handleGoBack() {
    if (hasUnexportedChanges()) {
      setConfirming(true);
      return;
    }
    onGoBack();
  }

  // The modal dialog makes everything outside it inert, so it is unmounted
  // synchronously before focus moves out of it.
  function closeDialog() {
    flushSync(() => {
      setConfirming(false);
    });
  }

  function handleConfirm() {
    closeDialog();
    onGoBack();
  }

  function handleCancel() {
    closeDialog();
    goBackRef.current?.focus();
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div role="alert" className="bg-card text-card-foreground flex max-w-xl flex-col gap-3 rounded-lg border p-6">
        <h2 className="text-destructive text-lg font-semibold">The planner stopped because of an internal error.</h2>
        <p className="font-mono text-sm wrap-break-word">{describeError(error)}</p>
        <p className="text-muted-foreground text-sm">Your project is still here and can be exported.</p>
        {"checkError" in check ? (
          <p className="text-destructive text-sm wrap-break-word">
            The project could not be checked for Validation Errors: {describeError(check.checkError)}. Import may reject
            the file until it is fixed by hand.
          </p>
        ) : (
          check.validationError !== undefined && (
            <p className="text-destructive text-sm">
              This project contains a Validation Error: {check.validationError.message} Import will reject the file
              until it is fixed by hand.
            </p>
          )
        )}
        <div className="flex flex-wrap gap-3">
          <Button ref={exportRef} type="button" onClick={handleExport}>
            Export the project as it was
          </Button>
          {previousProject !== undefined && (
            <Button ref={goBackRef} type="button" variant="outline" onClick={handleGoBack}>
              Go back to the project before the last change
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Discard unexported changes?"
        description="The project the planner stopped on has changes that were not exported. Going back discards them. Export it first to keep them."
        confirmLabel="Discard and go back"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
