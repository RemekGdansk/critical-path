import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import type { TaskNodeType } from "@/lib/services/diagram-layout";
import { cn } from "@/lib/utils";

// Handles only anchor edges: never connectable, and not drawn.
// Focus lands on React Flow's node wrapper, which removes its outline, so the
// focus ring is drawn here from the wrapper's focus (in-focus-visible), in the
// same colour and weight as Input's. It is an outline outside the border, so it
// never hides the selected style, which is a border and a ring.
// React Flow's hover shadow covers only its built-in node types, so hover is
// drawn here too; a selected node keeps its own border instead.
function TaskNodeComponent({ data, selected }: NodeProps<TaskNodeType>) {
  return (
    <div
      title={data.name}
      className={cn(
        "bg-card text-card-foreground flex h-full w-full items-center rounded-md border px-3 text-sm shadow-xs transition-colors",
        "in-focus-visible:outline-ring/50 in-focus-visible:outline-3 in-focus-visible:outline-offset-2",
        selected ? "border-primary ring-primary/30 ring-2" : "hover:border-ring",
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0" />
      <span className="truncate">{data.name}</span>
      <Handle type="source" position={Position.Right} isConnectable={false} className="opacity-0" />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
