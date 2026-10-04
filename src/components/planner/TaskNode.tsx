import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TriangleAlertIcon } from "lucide-react";
import { memo } from "react";

import { formatDuration, type TaskNodeType } from "@/lib/services/diagram-layout";
import { cn } from "@/lib/utils";

// Handles only anchor edges: never connectable, and not drawn.
// Focus lands on React Flow's node wrapper, which removes its outline, so the
// focus ring is drawn here from the wrapper's focus (in-focus-visible), in the
// same colour and weight as Input's. It is an outline outside the border, so it
// never hides the selected style, which is a border and a ring.
// React Flow's hover shadow covers only its built-in node types, so hover is
// drawn here too; a selected node keeps its own border instead.
// A Task missing its Duration (a Validation Warning) gets a --warning border and
// a "No Duration" line; selected, it keeps the line, so it still reads as warned.
function TaskNodeComponent({ data, selected }: NodeProps<TaskNodeType>) {
  return (
    <div
      title={data.name}
      className={cn(
        "bg-card text-card-foreground flex h-full w-full flex-col justify-center rounded-md border px-3 text-sm shadow-xs transition-colors",
        "in-focus-visible:outline-ring/50 in-focus-visible:outline-3 in-focus-visible:outline-offset-2",
        selected
          ? "border-primary ring-primary/30 ring-2"
          : data.durationMissing
            ? "border-warning"
            : "hover:border-ring",
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0" />
      <span className="truncate">{data.name}</span>
      {data.durationMissing ? (
        <span className="text-warning flex items-center gap-1 text-xs">
          <TriangleAlertIcon aria-hidden="true" className="size-3 shrink-0" />
          No Duration
        </span>
      ) : (
        data.duration !== undefined && (
          <span className="text-muted-foreground text-xs">{formatDuration(data.duration)}</span>
        )
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} className="opacity-0" />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
