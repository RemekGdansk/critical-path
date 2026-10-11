// PostToolUse (Write|Edit): lint the file the agent just edited, that file only.
// No --fix: rewriting the file under the agent makes its next Edit fail as stale.
import { block, editedFile, LINTED, readPayload, runLocalBin } from "./hook-lib.ts";

const edited = editedFile(readPayload(), LINTED);
if (edited !== undefined) {
  const { ok, output } = runLocalBin(edited.root, "eslint", ["--quiet", edited.file], 25_000); // hook timeout: 30 s
  if (!ok) block(`ESLint reported errors in ${edited.file}:\n${output}`);
}
