// UserPromptSubmit: before the agent starts, record which files are already uncommitted,
// so end-of-turn.ts checks only what this turn changes. Silent by contract: on this event
// stdout is added to the prompt and exit 2 discards the prompt. A crash exits 1, a hook
// error the user sees; the Stop hook then falls back to every uncommitted file.
import { readPayload, startTurn } from "./hook-lib.ts";

startTurn(readPayload());
