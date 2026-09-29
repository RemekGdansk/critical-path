import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { TerminalNode } from "@/components/planner/TerminalNode";
import type { FinishNodeType } from "@/lib/services/diagram-layout";

// Handles only anchor edges: never connectable, and not drawn.
function FinishNodeComponent(_props: NodeProps<FinishNodeType>) {
  return (
    <TerminalNode label="FINISH">
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0" />
    </TerminalNode>
  );
}

export const FinishNode = memo(FinishNodeComponent);
