import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";

import { Diagram } from "@/components/planner/Diagram";
import { NewTaskForm } from "@/components/planner/NewTaskForm";
import { StartPanel } from "@/components/planner/StartPanel";
import { TaskPanel } from "@/components/planner/TaskPanel";
import { useProject, type Selection } from "@/hooks/useProject";
import { todayIsoDate } from "@/lib/services/calendar-date";
import { createPerfProject } from "@/lib/services/fixtures";
import { createEmptyProject } from "@/lib/services/project";
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

/** The single React island: toolbar across the top, diagram filling the rest, side panel on the right. */
export function Planner({ initialProject: givenProject, initialSelection }: PlannerProps = {}) {
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
  } = useProject(givenProject ?? initialProject, initialSelection);

  // Read on every render, so any edit after midnight picks up the new day.
  const today = todayIsoDate(new Date());

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

  return (
    // useReactFlow() in Diagram throws without a provider above it.
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <header className="border-b px-4 py-3">
          <NewTaskForm ref={newTaskInputRef} createTask={createTask} />
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <Diagram project={project} selection={selection} onSelect={handleSelect} onEdit={handleEdit} />
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
