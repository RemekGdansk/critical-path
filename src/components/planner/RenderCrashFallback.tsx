import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { downloadTextFile } from "@/lib/download";
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
    return { validationError: validateProject(project) };
  } catch (checkError) {
    return { checkError };
  }
}

/**
 * Shown in place of the planner after a render throw. The project is still in
 * memory, so it stays one click from a file and, when there is one, the
 * previous project one click from the planner. Renders nothing that derives
 * from the project beyond its serialization and `inspectCrashedProject`.
 */
export function RenderCrashFallback({ error, project, previousProject, onGoBack }: RenderCrashFallbackProps) {
  const exportRef = useRef<HTMLButtonElement>(null);
  // On mount, so a keyboard user lands on the action that keeps the project.
  useEffect(() => {
    exportRef.current?.focus();
  }, []);

  const check = inspectCrashedProject(project);

  function handleExport() {
    const fileName = project.name === undefined ? RECOVERED_FILE_NAME : projectFileName(project.name);
    downloadTextFile(fileName, serializeProject(project), "application/json");
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
            <Button type="button" variant="outline" onClick={onGoBack}>
              Go back to the project before the last change
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
