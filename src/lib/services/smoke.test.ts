// F-01 gate smoke check: proves Vitest runs, TypeScript compiles and the `@/`
// alias resolves. The probe class `bg-fuchsia-950` appears nowhere else in
// src/, so finding it in dist/ would mean test files leaked into Tailwind's
// build input.
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting Tailwind classes, keeping the last one", () => {
    expect(cn("p-2 bg-slate-100", "bg-fuchsia-950")).toBe("p-2 bg-slate-100");
  });
});
