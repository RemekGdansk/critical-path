import type { ReactNode } from "react";

// START and FINISH share one pill shape, visibly different from the rectangular Task nodes.
// Clicking them selects nothing, so the pointer cursor React Flow gives selectable nodes is reset.
export function TerminalNode({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-primary text-primary-foreground flex h-full w-full cursor-default items-center justify-center rounded-full text-xs font-semibold tracking-widest">
      {label}
      {children}
    </div>
  );
}
