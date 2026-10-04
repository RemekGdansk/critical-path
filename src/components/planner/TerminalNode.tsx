import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TerminalNodeProps {
  label: string;
  children: ReactNode;
  /** START opens its panel; FINISH has nothing to edit. */
  interactive: boolean;
  selected?: boolean;
}

// START and FINISH share one pill shape, visibly different from the rectangular Task nodes.
// The interactive one (START) draws hover, focus ring and selected ring the way TaskNode
// does; the inert one (FINISH) resets the pointer cursor React Flow gives selectable nodes.
export function TerminalNode({ label, children, interactive, selected = false }: TerminalNodeProps) {
  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground flex h-full w-full items-center justify-center rounded-full text-xs font-semibold tracking-widest transition-colors",
        interactive
          ? cn(
              "in-focus-visible:outline-ring/50 in-focus-visible:outline-3 in-focus-visible:outline-offset-2",
              selected ? "ring-primary/30 ring-4" : "hover:bg-primary/80",
            )
          : "cursor-default",
      )}
    >
      {label}
      {children}
    </div>
  );
}
