// PostToolUse (Write|Edit): run the Vitest tests that depend on the edited file
// (test-plan §3 Phase 5). `vitest related` exits 0 when no test depends on it, which
// includes this directory: its tests are outside `npm test`, and end-of-turn.ts runs them.
import { block, editedFile, LINTED, readPayload, runLocalBin } from "./hook-lib.ts";

const edited = editedFile(readPayload(), LINTED);
if (edited !== undefined) {
  const { ok, output } = runLocalBin(edited.root, "vitest", ["related", edited.file, "--run"], 50_000); // hook timeout: 60 s
  if (!ok) block(`Tests related to ${edited.file} fail:\n${output}`);
}
