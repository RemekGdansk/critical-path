import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { TerminalNode } from "@/components/planner/TerminalNode";
import type { StartNodeType } from "@/lib/services/diagram-layout";

// Handles only anchor edges: never connectable, and not drawn.
// The second line is the START date, or "today" when it is unset.
function StartNodeComponent({ data, selected }: NodeProps<StartNodeType>) {
  return (
    <TerminalNode label="START" detail={data.date ?? "today"} interactive selected={selected}>
      <Handle type="source" position={Position.Right} isConnectable={false} className="opacity-0" />
    </TerminalNode>
  );
}

export const StartNode = memo(StartNodeComponent);
