import { Handle, Position } from "@xyflow/react";
import { TriangleAlertIcon } from "lucide-react";
import { memo } from "react";

import type { TaskNodeProps } from "@/components/planner/diagram/flow-elements";
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
// A Task on the critical path gets a --critical-path border and ring: a ring,
// not a wider border, so the box keeps its size. Selected, it keeps the
// selection style; a warned Task is never critical. Order: selected, warned,
// critical, hover.
// The Duration text comes ready from the domain node; nothing is formatted here.
function TaskNodeComponent({ data: { node }, selected }: TaskNodeProps) {
  return (
    <div
      title={node.name}
      className={cn(
        "bg-card text-card-foreground flex h-full w-full flex-col justify-center rounded-md border px-3 text-sm shadow-xs transition-colors",
        "in-focus-visible:outline-ring/50 in-focus-visible:outline-3 in-focus-visible:outline-offset-2",
        selected
          ? "border-primary ring-primary/30 ring-2"
          : node.durationMissing
            ? "border-warning"
            : node.critical
              ? "border-critical-path ring-critical-path ring-1"
              : "hover:border-ring",
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0" />
      <span className="truncate">{node.name}</span>
      {node.durationMissing ? (
        <span className="text-warning flex items-center gap-1 text-xs">
          <TriangleAlertIcon aria-hidden="true" className="size-3 shrink-0" />
          No Duration
        </span>
      ) : (
        node.durationText !== undefined && <span className="text-muted-foreground text-xs">{node.durationText}</span>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} className="opacity-0" />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
