import { Handle, Position } from "@xyflow/react";
import { CheckIcon, CircleDashedIcon, TriangleAlertIcon } from "lucide-react";
import { memo } from "react";

import type { TaskNodeProps } from "@/components/planner/diagram/flow-elements";
import { taskStatusName } from "@/lib/services/project";
import { cn } from "@/lib/utils";

// Handles only anchor edges: never connectable, and not drawn.
// Focus lands on React Flow's node wrapper, which removes its outline, so the
// focus ring is drawn here from the wrapper's focus (in-focus-visible), in the
// same colour and weight as Input's. It is an outline outside the border, so it
// never hides the selected style, which is a border and a ring.
// React Flow's hover shadow covers only its built-in node types, so hover is
// drawn here too, on a plain node only.
// The border says what the Task is, in one colour per state, in this order:
// warned (a Validation Warning: a missing Duration) --warning, critical
// --critical-path (a 1px ring as well), Done --done, otherwise the plain
// border. A warned Task is never critical, and a Done Task is neither.
// Selection keeps that colour and thickens it: a 3px ring in the same colour
// (--primary on a plain node), outside the border, so the box keeps its size.
// A warned Task also gets a "No Duration" line. A Done Task's second line is a
// --done check and "Done" with its completion date in place of the Duration.
// An In Progress Task keeps its Duration (or "No Duration") line, marked by a
// dashed circle rather than the words, which do not fit beside a weekdays
// Duration; without a warning the line is in --foreground, not muted, so it
// reads apart from To Do on any border. A warned line keeps its warning icon
// first and its colour, which outrank the Status, as the border does. The words
// "In Progress" are in the tooltip and in the accessible name (the domain's
// taskAccessibleName). Either way the node keeps its two lines and its size
// (TASK_NODE_SIZE): the second line truncates rather than wraps.
// The Duration text and the completion date come ready from the domain node;
// nothing is formatted here.

/** Each border state, unselected and selected; whole class names, so Tailwind finds them. */
const BORDER = {
  warned: { idle: "border-warning", selected: "border-warning ring-warning ring-3" },
  critical: {
    idle: "border-critical-path ring-critical-path ring-1",
    selected: "border-critical-path ring-critical-path ring-3",
  },
  done: { idle: "border-done", selected: "border-done ring-done ring-3" },
  plain: { idle: "hover:border-ring", selected: "border-primary ring-primary ring-3" },
} as const;

function TaskNodeComponent({ data: { node }, selected }: TaskNodeProps) {
  const done = node.status === "done";
  const inProgress = node.status === "in-progress";
  const inProgressIcon = inProgress && <CircleDashedIcon aria-hidden="true" className="size-3 shrink-0" />;
  const border = BORDER[node.durationMissing ? "warned" : node.critical ? "critical" : done ? "done" : "plain"];
  return (
    <div
      title={inProgress ? `${node.name} — ${taskStatusName("in-progress")}` : node.name}
      className={cn(
        "bg-card text-card-foreground flex h-full w-full flex-col justify-center rounded-md border px-3 text-sm shadow-xs transition-colors",
        "in-focus-visible:outline-ring/50 in-focus-visible:outline-3 in-focus-visible:outline-offset-2",
        selected ? border.selected : border.idle,
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0" />
      <span className="truncate">{node.name}</span>
      {done ? (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <CheckIcon aria-hidden="true" className="text-done size-3 shrink-0" />
          <span className="truncate">
            {taskStatusName("done")}
            {node.completionDate !== undefined && ` ${node.completionDate}`}
          </span>
        </span>
      ) : node.durationMissing ? (
        <span className="text-warning flex items-center gap-1 text-xs">
          <TriangleAlertIcon aria-hidden="true" className="size-3 shrink-0" />
          {inProgressIcon}
          <span className="truncate">No Duration</span>
        </span>
      ) : (
        node.durationText !== undefined && (
          <span
            className={cn("flex items-center gap-1 text-xs", inProgress ? "text-foreground" : "text-muted-foreground")}
          >
            {inProgressIcon}
            <span className="truncate">{node.durationText}</span>
          </span>
        )
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} className="opacity-0" />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
