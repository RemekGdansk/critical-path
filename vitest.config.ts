import { getViteConfig } from "astro/config";
// Also loads Vitest's `test` typing for the config below.
import { configDefaults } from "vitest/config";

export default getViteConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // The agent-hook tests spawn git, sh and node and guard a local, per-machine tool: they
    // run through `npm run test:hooks` (scripts/agent-hooks/vitest.config.ts), never in the
    // CI or deploy gates that `npm test` belongs to.
    exclude: [...configDefaults.exclude, "scripts/agent-hooks/**"],
    // One zone on every machine and in both CI gates: local "today" checks and dates stay deterministic, and the zone has DST.
    env: { TZ: "Europe/Warsaw" },
  },
});
