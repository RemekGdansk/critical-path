// The agent-hook tests alone, run by `npm run test:hooks` and by end-of-turn.ts when a turn
// changes this directory. Kept out of `npm test` (see the root vitest.config.ts): they need
// git worktrees and child processes, and the hooks they prove are registered per machine.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Paths from the repo root, where npm and end-of-turn.ts run it. No `root` here: Vite would
    // keep its cache in scripts/agent-hooks/node_modules instead of the repo's.
    include: ["scripts/agent-hooks/*.test.ts"],
    // Every case spawns several node and git processes; leave room on a loaded machine.
    testTimeout: 20_000,
  },
});
