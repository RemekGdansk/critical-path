import { ReactFlowProvider } from "@xyflow/react";

import { Diagram } from "@/components/planner/Diagram";
import { NewTaskForm } from "@/components/planner/NewTaskForm";
import { TaskPanel } from "@/components/planner/TaskPanel";
import { useProject } from "@/hooks/useProject";
import { createPerfProject } from "@/lib/services/fixtures";
import { createEmptyProject } from "@/lib/services/project";
import type { Project } from "@/types";

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

/** The single React island: toolbar across the top, diagram filling the rest, side panel on the right. */
export function Planner() {
  const { project, selectedTask, select, createTask, renameTask, deleteTask, addPredecessor, removePredecessor } =
    useProject(initialProject);

  return (
    // useReactFlow() in Diagram throws without a provider above it.
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <header className="border-b px-4 py-3">
          <NewTaskForm createTask={createTask} />
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <Diagram project={project} selectedTaskId={selectedTask?.id} onSelect={select} />
          </div>
          <aside
            aria-label="Selected Task"
            className="border-sidebar-border bg-sidebar text-sidebar-foreground w-80 shrink-0 overflow-y-auto border-l p-4"
          >
            {selectedTask === undefined ? (
              <p className="text-muted-foreground text-sm">Select a Task on the diagram to edit it.</p>
            ) : (
              <TaskPanel
                key={selectedTask.id}
                task={selectedTask}
                project={project}
                actions={{ renameTask, deleteTask, addPredecessor, removePredecessor }}
              />
            )}
          </aside>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
