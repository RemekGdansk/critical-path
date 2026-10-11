// Stop: before the agent hands back, sweep every file this turn changed in every
// checkout the session touched — lint on the changed files (which also catches files
// rewritten through a shell command, never seen by a per-edit hook), the whole unit
// suite and `astro check`, the CI type gate — plus the agent-hook tests, which `npm test`
// leaves out, when the turn changed scripts/agent-hooks/. "This turn" is measured against the
// baseline turn-start.ts records, so uncommitted work from before the turn (the user's
// own, or an earlier turn's) never sends the agent back. One retry: once this hook has
// sent the agent back, the next stop goes through and the commit gate and CI catch
// what is left.
import { block, changedFiles, checkoutsToSweep, LINTED, readPayload, runLocalBin } from "./hook-lib.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";

const payload = readPayload();
// loop_count covers Cursor, which imports hooks from .claude/settings*.json.
const looping = typeof payload.loop_count === "number" && payload.loop_count > 0;
if (payload.stop_hook_active === true || looping) process.exit(0);

const roots = checkoutsToSweep(payload);
if (roots.length === 0) {
  // Not silent: the user sees why nothing was checked.
  process.stdout.write(
    `${JSON.stringify({ systemMessage: "end-of-turn.ts: no git checkout in the session, nothing checked." })}\n`,
  );
  process.exit(0);
}

// Every tool run shares one budget, 15 s under the hook's 120 s timeout in hooks.json, so a
// slow run ends as a failure the agent reads rather than a harness kill it never sees.
const deadline = Date.now() + 105_000;
const budget = () => Math.max(1_000, deadline - Date.now());

const failures: string[] = [];
for (const root of roots) {
  const changed = changedFiles(payload, root);
  if (changed.length === 0) continue;

  const linted = changed.filter((f) => LINTED.test(f) && existsSync(join(root, f)));
  if (linted.length > 0) {
    const lint = runLocalBin(root, "eslint", ["--quiet", ...linted], budget());
    if (!lint.ok) failures.push(`ESLint errors in changed files (${root}):\n${lint.output}`);
  }
  const tests = runLocalBin(root, "vitest", ["run"], budget());
  if (!tests.ok) failures.push(`Unit tests fail (${root}):\n${tests.output}`);
  const hookConfig = "scripts/agent-hooks/vitest.config.ts";
  if (changed.some((f) => f.startsWith("scripts/agent-hooks/")) && existsSync(join(root, hookConfig))) {
    const hookTests = runLocalBin(root, "vitest", ["run", "--config", hookConfig], budget());
    if (!hookTests.ok) failures.push(`Agent-hook tests fail (${root}):\n${hookTests.output}`);
  }
  const types = runLocalBin(root, "astro", ["check"], budget());
  if (!types.ok) failures.push(`astro check fails (${root}):\n${types.output}`);
}

if (failures.length > 0) block(`Fix these before you finish:\n\n${failures.join("\n\n")}`);
