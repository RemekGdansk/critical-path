import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { TerminalNode } from "@/components/planner/TerminalNode";
import type { StartNodeType } from "@/lib/services/diagram-layout";

// Handles only anchor edges: never connectable, and not drawn.
function StartNodeComponent({ selected }: NodeProps<StartNodeType>) {
  return (
    <TerminalNode label="START" interactive selected={selected}>
      <Handle type="source" position={Position.Right} isConnectable={false} className="opacity-0" />
    </TerminalNode>
  );
}

export const StartNode = memo(StartNodeComponent);
