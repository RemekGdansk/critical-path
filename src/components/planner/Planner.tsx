import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useMemo, useRef, useState } from "react";

import { Diagram } from "@/components/planner/Diagram";
import { ForecastSummary } from "@/components/planner/ForecastSummary";
import { NewTaskForm } from "@/components/planner/NewTaskForm";
import { ProjectControls } from "@/components/planner/ProjectControls";
import { RenderCrashFallback } from "@/components/planner/RenderCrashFallback";
import { RenderErrorBoundary } from "@/components/planner/RenderErrorBoundary";
import { StartPanel } from "@/components/planner/StartPanel";
import { TaskPanel } from "@/components/planner/TaskPanel";
import { useProject, type ProjectState, type Selection } from "@/hooks/useProject";
import { todayIsoDate } from "@/lib/services/calendar-date";
import { createPerfProject } from "@/lib/services/fixtures";
import { forecast } from "@/lib/services/forecast";
import { createEmptyProject } from "@/lib/services/project";
import { serializeProject } from "@/lib/services/project-file";
import type { Project, TaskId } from "@/types";

/**
 * The project the planner starts from. In dev only, `?fixture=perf100` loads the
 * 100-Task fixture for the 200 ms check; `import.meta.env.DEV` is `false` in the
 * production build, so the branch and the fixture module are eliminated from it.
 */
function initialProject(): Project {
  if (import.meta.env.DEV) {
    if (new URLSearchParams(window.location.search).get("fixture") === "perf100") return createPerfProject();
  }
  return createEmptyProject();
}

interface PlannerProps {
  /** Starts from this project instead of the default one; the dev-only kitchen sink passes its fixtures here. */
  initialProject?: Project;
  /** What is selected on first render; nothing by default. */
  initialSelection?: Selection;
}

/**
 * The only signal of a render crash, since nothing may leave the device: the
 * error, React's component stack and the project as its file text, so the
 * project can be rebuilt from the console. Never throws: if serializing fails
 * too, it logs that second error in place of the project.
 */
function logRenderCrash(project: Project, error: unknown, componentStack: string): void {
  let details: { componentStack: string; project: string } | { componentStack: string; serializationError: unknown };
  try {
    details = { componentStack, project: serializeProject(project) };
  } catch (serializationError) {
    details = { componentStack, serializationError };
  }
  // eslint-disable-next-line no-console -- the only signal of a render crash; nothing may leave the device
  console.error("Critical Path: the planner crashed while rendering.", error, details);
}

/**
 * The single React island. It holds the project state above an error boundary,
 * so a throw while rendering the project shows a fallback that can still export
 * it, instead of a blank page that loses it. The boundary is keyed by a count
 * of go-backs, so it starts over with the restored project. It is not keyed by
 * `replacements`: an import would then remount the whole view, and the focus
 * that `handleReplaceProject` moves to New Task would land on an unmounted input.
 */
export function Planner({ initialProject: givenProject, initialSelection }: PlannerProps = {}) {
  const state = useProject(givenProject ?? initialProject, initialSelection);
  const { project, previousProject, restorePreviousProject } = state;
  const [goBacks, setGoBacks] = useState(0);
  const handleGoBack = useCallback(() => {
    restorePreviousProject();
    setGoBacks((count) => count + 1);
  }, [restorePreviousProject]);
  const handleError = useCallback(
    (error: unknown, componentStack: string) => {
      logRenderCrash(project, error, componentStack);
    },
    [project],
  );

  return (
    <RenderErrorBoundary
      key={goBacks}
      onError={handleError}
      fallback={(error) => (
        <RenderCrashFallback
          error={error}
          project={project}
          previousProject={previousProject}
          onGoBack={handleGoBack}
        />
      )}
    >
      <PlannerView state={state} />
    </RenderErrorBoundary>
  );
}

/**
 * Everything that derives from the project, and so may throw while rendering:
 * toolbar across the top, diagram filling the rest, side panel on the right.
 */
function PlannerView({ state }: { state: ProjectState }) {
  const {
    project,
    selection,
    selectedTask,
    select,
    createTask,
    renameTask,
    deleteTask,
    addPredecessor,
    removePredecessor,
    setDuration,
    setStartDate,
    setDayCountingMode,
    setProjectName,
    replaceProject,
    replacements,
  } = state;

  // Read on every render, so any edit after midnight picks up the new day.
  const today = todayIsoDate(new Date());
  const projectForecast = useMemo(() => forecast(project, today), [project, today]);

  // A keyboard selection asks the panel to focus its first field ("Task name"
  // or "START date"). The request names its target and carries a fresh number
  // each time, so the panel honours it on mount and when the same target is
  // selected again by keyboard; a mouse selection clears it, so a click never
  // moves focus.
  const [focusRequest, setFocusRequest] = useState<{ target: TaskId | "start"; id: number } | null>(null);
  const handleSelect = useCallback(
    (target: Selection) => {
      select(target);
      setFocusRequest(null);
    },
    [select],
  );
  const handleEdit = useCallback(
    (target: TaskId | "start") => {
      select(target);
      setFocusRequest((previous) => ({ target, id: (previous?.id ?? 0) + 1 }));
    },
    [select],
  );

  // After Delete Task the panel is gone, so focus goes back to the New Task
  // input instead of falling to <body>. Moving it before the panel unmounts is
  // safe: the removed button no longer holds focus.
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const handleDeleteTask = useCallback(
    (taskId: TaskId) => {
      const result = deleteTask(taskId);
      if (result.ok) newTaskInputRef.current?.focus();
      return result;
    },
    [deleteTask],
  );

  // An imported project replaces the old one whole: the hook selects nothing,
  // which unmounts the panels and drops their drafts, and a pending focus
  // request would otherwise point at an unrelated imported Task. Focus goes to
  // the New Task input, as after Delete Task: the remount keyed by
  // `replacements` removes the Import button, which would drop it to <body>.
  const handleReplaceProject = useCallback(
    (imported: Project) => {
      replaceProject(imported);
      setFocusRequest(null);
      newTaskInputRef.current?.focus();
    },
    [replaceProject],
  );

  return (
    // useReactFlow() in Diagram throws without a provider above it.
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        {/* Wraps instead of overlapping when the three groups do not fit one line; the forecast stays right-aligned. */}
        <header className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b px-4 py-3">
          <NewTaskForm ref={newTaskInputRef} createTask={createTask} />
          {/* Keyed by the replacement count, so the name draft starts over from an imported name. */}
          <ProjectControls
            key={replacements}
            name={project.name}
            setProjectName={setProjectName}
            replaceProject={handleReplaceProject}
            dayCountingMode={project.dayCountingMode}
            setDayCountingMode={setDayCountingMode}
          />
          <div className="ml-auto">
            <ForecastSummary forecast={projectForecast} tasks={project.tasks} startDate={project.start.date} />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <Diagram
              project={project}
              fitKey={replacements}
              selection={selection}
              onSelect={handleSelect}
              onEdit={handleEdit}
            />
          </div>
          <aside
            aria-label={selection === "start" ? "START" : "Selected Task"}
            className="border-sidebar-border bg-sidebar text-sidebar-foreground w-80 shrink-0 overflow-y-auto border-l p-4"
          >
            {selection === "start" ? (
              <StartPanel
                project={project}
                today={today}
                setStartDate={setStartDate}
                focusRequest={focusRequest?.target === "start" ? focusRequest.id : undefined}
              />
            ) : project.tasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No Tasks yet. Type a name in New Task above and press Enter.
              </p>
            ) : selectedTask === undefined ? (
              <p className="text-muted-foreground text-sm">Select START or a Task on the diagram to edit it.</p>
            ) : (
              <TaskPanel
                key={selectedTask.id}
                task={selectedTask}
                project={project}
                actions={{ renameTask, deleteTask: handleDeleteTask, addPredecessor, removePredecessor, setDuration }}
                focusRequest={focusRequest?.target === selectedTask.id ? focusRequest.id : undefined}
              />
            )}
          </aside>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
