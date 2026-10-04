import { TriangleAlertIcon } from "lucide-react";

import type { Forecast, ForecastDate } from "@/lib/services/forecast";

interface ForecastSummaryProps {
  forecast: Forecast;
  taskCount: number;
  /** The START date as set, named in the note when the forecast starts from today instead. */
  startDate: string | undefined;
}

/** How many withheld warnings the strip names before summing up the rest. */
const NAMED_WARNINGS = 3;

function ForecastDateValue({ value }: { value: ForecastDate }) {
  return value.kind === "date" ? <time dateTime={value.date}>{value.date}</time> : <>Beyond year 9999</>;
}

function withheldText(forecast: Extract<Forecast, { kind: "withheld" }>): string {
  const named = forecast.warnings.slice(0, NAMED_WARNINGS).map((warning) => warning.message);
  const more = forecast.warnings.length - named.length;
  const rest = more === 0 ? [] : [more === 1 ? "1 more Task has no Duration." : `${more} more Tasks have no Duration.`];
  return [...named, ...rest, "Both Project Finish Dates are withheld until every Task has one."].join(" ");
}

/**
 * Both Project Finish Dates, or why they are withheld, at the right of the
 * header: always visible whatever is selected, and announced politely on
 * every change.
 */
export function ForecastSummary({ forecast, taskCount, startDate }: ForecastSummaryProps) {
  return (
    <div role="status" className="flex max-w-xl flex-col items-end gap-1 text-right text-sm">
      {taskCount === 0 ? (
        <p className="text-muted-foreground">Add Tasks to see a forecast.</p>
      ) : forecast.kind === "withheld" ? (
        <p className="text-warning flex items-start gap-2">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Validation Warning:</span> {withheldText(forecast)}
          </span>
        </p>
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
