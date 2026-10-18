import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import type { FinishNodeProps } from "@/components/planner/diagram/flow-elements";
import { TerminalNode } from "@/components/planner/TerminalNode";

// Handles only anchor edges: never connectable, and not drawn.
function FinishNodeComponent(_props: FinishNodeProps) {
  return (
    <TerminalNode label="FINISH" interactive={false}>
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0" />
    </TerminalNode>
  );
}

export const FinishNode = memo(FinishNodeComponent);
