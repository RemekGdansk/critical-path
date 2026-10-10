/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // One zone on every machine and in both CI gates: local "today" checks and dates stay deterministic, and the zone has DST.
    env: { TZ: "Europe/Warsaw" },
  },
});
