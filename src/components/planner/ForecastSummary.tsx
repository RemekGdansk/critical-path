import { TriangleAlertIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Forecast, ForecastDate } from "@/lib/services/forecast";
import { taskLabel } from "@/lib/services/project";
import type { Task } from "@/types";

interface ForecastSummaryProps {
  forecast: Forecast;
  tasks: readonly Task[];
  /** The START date as set, named in the note when the forecast starts from today instead. */
  startDate: string | undefined;
}

function ForecastDateValue({ value }: { value: ForecastDate }) {
  return value.kind === "date" ? <time dateTime={value.date}>{value.date}</time> : <>Beyond year 9999</>;
}

/**
 * The Validation Warning as a count, so the header keeps its height however
 * many Tasks lack a Duration; hovering or focusing it lists them.
 */
function WithheldWarning({
  forecast,
  tasks,
}: {
  forecast: Extract<Forecast, { kind: "withheld" }>;
  tasks: readonly Task[];
}) {
  const count = forecast.warnings.length;
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const labels = forecast.warnings.map((warning) => {
    const task = tasksById.get(warning.taskId);
    return { taskId: warning.taskId, label: task === undefined ? String(warning.taskId) : taskLabel(task) };
  });
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-warning focus-visible:ring-ring flex items-start gap-2 rounded-sm text-right underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2"
          >
            <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-medium">Validation Warning:</span> {count} {count === 1 ? "Task" : "Tasks"} without
              Duration.
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-h-64 overflow-y-auto text-left">
          <ul>
            {labels.map(({ taskId, label }) => (
              <li key={taskId}>{label}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Both Project Finish Dates, or why they are withheld, at the right of the
 * header: always visible whatever is selected, and announced politely on
 * every change.
 */
export function ForecastSummary({ forecast, tasks, startDate }: ForecastSummaryProps) {
  return (
    <div role="status" className="flex max-w-xl flex-col items-end gap-1 text-right text-sm">
      {tasks.length === 0 ? (
        <p className="text-muted-foreground">Add Tasks to see a forecast.</p>
      ) : forecast.kind === "withheld" ? (
        <>
          <WithheldWarning forecast={forecast} tasks={tasks} />
          <p className="text-warning">Forecast not possible until every Task has one.</p>
        </>
      ) : (
        <>
          <dl className="flex flex-col gap-0.5">
            <div className="flex justify-end gap-3">
              <dt className="text-muted-foreground">Resource-Unconstrained Project Finish Date</dt>
              <dd className="font-medium tabular-nums">
                <ForecastDateValue value={forecast.resourceUnconstrainedProjectFinishDate} />
              </dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-muted-foreground">Resource-Constrained Project Finish Date</dt>
              <dd className="font-medium tabular-nums">
                <ForecastDateValue value={forecast.resourceConstrainedProjectFinishDate} />
              </dd>
            </div>
          </dl>
          {forecast.baseDateReason === "start-date-in-past" && startDate !== undefined && (
            <p className="text-muted-foreground text-xs">
              START date {startDate} is in the past: forecasting from today, {forecast.baseDate}.
            </p>
          )}
          {forecast.baseDateReason === "start-date-unset" && (
            <p className="text-muted-foreground text-xs">
              START date not set: forecasting from today, {forecast.baseDate}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
