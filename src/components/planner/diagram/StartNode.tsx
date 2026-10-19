import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import type { StartNodeProps } from "@/components/planner/diagram/flow-elements";
import { TerminalNode } from "@/components/planner/TerminalNode";

// Handles only anchor edges: never connectable, and not drawn.
// The second line is the START date, or "today" when it is unset.
function StartNodeComponent({ data: { node }, selected }: StartNodeProps) {
  return (
    <TerminalNode label="START" detail={node.date ?? "today"} interactive selected={selected}>
      <Handle type="source" position={Position.Right} isConnectable={false} className="opacity-0" />
    </TerminalNode>
  );
}

export const StartNode = memo(StartNodeComponent);
