import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import type { TaskNodeType } from "@/lib/services/diagram-layout";
import { cn } from "@/lib/utils";

// Handles only anchor edges: never connectable, and not drawn.
function TaskNodeComponent({ data, selected }: NodeProps<TaskNodeType>) {
  return (
    <div
      title={data.name}
      className={cn(
        "bg-card text-card-foreground flex h-full w-full items-center rounded-md border px-3 text-sm shadow-xs",
        selected && "border-primary ring-primary/30 ring-2",
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0" />
      <span className="truncate">{data.name}</span>
      <Handle type="source" position={Position.Right} isConnectable={false} className="opacity-0" />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
