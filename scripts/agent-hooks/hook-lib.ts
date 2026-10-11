// Shared plumbing for the Claude Code hooks in this directory. scripts/agent-hooks/hooks.json
// is the hook config to merge into .claude/settings.local.json (gitignored, per machine);
// agent-hooks.test.ts runs its commands. Claude Code reads a hook's stderr only when it
// exits 2; any other non-zero code shows the user "hook error" and Claude nothing.
// So every failure the agent should fix, including a missing tool, ends in
// `block()`, and exit 0 means "checked and clean" or "nothing to check".
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/** What the linter covers: eslint.config.js lints JS and TS, React views and .astro files. */
export const LINTED = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/;

export type Payload = Record<string, unknown>;

/** The hook payload from stdin. Empty, unparseable or non-object input is an empty payload, never a failure. */
export function readPayload(): Payload {
  try {
    const parsed: unknown = JSON.parse(readFileSync(0, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Payload) : {};
  } catch {
    return {};
  }
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** The payload cwd: the session's checkout, which follows EnterWorktree ($CLAUDE_PROJECT_DIR does not). */
export function sessionCwd(payload: Payload): string {
  return text(payload.cwd) ?? process.cwd();
}

/** The session id, reduced to characters safe in a file name. */
function sessionId(payload: Payload): string | undefined {
  return text(payload.session_id)?.replace(/[^A-Za-z0-9_-]/g, "");
}

function gitRaw(cwd: string, args: string[]): string | undefined {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return result.status === 0 ? result.stdout : undefined;
}

function git(cwd: string, args: string[]): string | undefined {
  return gitRaw(cwd, args)?.trim();
}

/**
 * The checkout (worktree root) holding `dir` and its repository (the git dir every worktree
 * of it shares), from one git call; undefined outside git.
 */
function locate(dir: string): { root: string; repository: string } | undefined {
  if (!existsSync(dir)) return undefined;
  const lines = git(dir, ["rev-parse", "--show-toplevel", "--path-format=absolute", "--git-common-dir"])?.split("\n");
  const [root, repository] = lines ?? [];
  return root && repository ? { root, repository } : undefined;
}

/** The checkout (worktree root) holding `dir`, or undefined outside git. */
export function checkoutOf(dir: string): string | undefined {
  return locate(dir)?.root;
}

/**
 * The edited file and its checkout, or undefined when there is nothing to check:
 * no path in the payload, a type `covered` rejects, a file that no longer exists,
 * or a file of another repository (~/.claude, another project). Any worktree of the
 * session's repository counts, and is registered so the Stop hook sweeps it too.
 */
export function editedFile(payload: Payload, covered: RegExp): { file: string; root: string } | undefined {
  const input = payload.tool_input;
  const path = text(field(input, "file_path"));
  if (path === undefined) return undefined;
  const cwd = sessionCwd(payload);
  const file = isAbsolute(path) ? path : resolve(cwd, path);
  if (!covered.test(file) || !existsSync(file)) return undefined;

  const location = locate(dirname(file));
  if (location === undefined || location.repository !== locate(cwd)?.repository) return undefined;
  const { root } = location;
  // git prints the real path (/private/var on macOS for /var), so compare against the file's.
  recordBaseline(payload, root, relative(root, realpathSync(file)));
  return { file, root };
}

/**
 * Per-session turn state: one baseline file per checkout the turn touched, holding a
 * fingerprint of every file that was already uncommitted before the agent changed it.
 * The Stop hook checks only files whose fingerprint differs, so the user's own work in
 * progress never sends the agent back. The set of baseline files is also the set of
 * checkouts to sweep.
 */
function turnDir(payload: Payload): string | undefined {
  const sid = sessionId(payload);
  return sid === undefined ? undefined : join(tmpdir(), "claude-hooks", sid);
}

function baselinePath(dir: string, root: string): string {
  return join(dir, `${createHash("sha1").update(root).digest("hex")}.json`);
}

interface Baseline {
  root: string;
  files: Record<string, string>;
}

/** Content fingerprint of a path in a checkout; a deleted file or a directory gets a marker instead. */
function fingerprint(root: string, file: string): string {
  try {
    return createHash("sha1")
      .update(readFileSync(join(root, file)))
      .digest("hex");
  } catch {
    return "unreadable";
  }
}

/**
 * Records which files of `root` are already uncommitted, unless this turn has a baseline for
 * it. `except` (the file the agent just edited) is left out, so it still counts as changed.
 * The exclusive create lets the two parallel per-edit hooks race safely: one writes, the other skips.
 */
function recordBaseline(payload: Payload, root: string, except?: string): void {
  const dir = turnDir(payload);
  if (dir === undefined) return;
  const path = baselinePath(dir, root);
  if (existsSync(path)) return;
  const files: Record<string, string> = {};
  for (const file of dirtyFiles(root)) if (file !== except) files[file] = fingerprint(root, file);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify({ root, files } satisfies Baseline), { flag: "wx" });
  } catch {
    // Already written by the parallel hook, or not writable: without a baseline, every uncommitted file counts.
  }
}

function readBaseline(payload: Payload, root: string): Baseline | undefined {
  const dir = turnDir(payload);
  if (dir === undefined) return undefined;
  try {
    return JSON.parse(readFileSync(baselinePath(dir, root), "utf8")) as Baseline;
  } catch {
    return undefined;
  }
}

/** Turn start: drop the previous turn's state and record what is already uncommitted in the session's checkout. */
export function startTurn(payload: Payload): void {
  const dir = turnDir(payload);
  if (dir === undefined) return;
  rmSync(dir, { recursive: true, force: true });
  const own = checkoutOf(sessionCwd(payload));
  if (own !== undefined) recordBaseline(payload, own);
}

/** The session's checkout plus every checkout this turn recorded a baseline for. */
export function checkoutsToSweep(payload: Payload): string[] {
  const roots = new Set<string>();
  const own = checkoutOf(sessionCwd(payload));
  if (own !== undefined) roots.add(own);
  const dir = turnDir(payload);
  if (dir !== undefined && existsSync(dir)) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
      try {
        const { root } = JSON.parse(readFileSync(join(dir, name), "utf8")) as Baseline;
        if (typeof root === "string" && existsSync(root)) roots.add(root);
      } catch {
        // A half-written or foreign file names no checkout.
      }
    }
  }
  return [...roots].toSorted();
}

/** Uncommitted files in a checkout, relative to it: `git diff HEAD` plus untracked, not ignored files. */
function dirtyFiles(root: string): string[] {
  const tracked =
    gitRaw(root, ["diff", "--name-only", "-z", "HEAD"]) ?? gitRaw(root, ["diff", "--name-only", "-z"]) ?? "";
  const untracked = gitRaw(root, ["ls-files", "-o", "--exclude-standard", "-z"]) ?? "";
  return [...new Set(`${tracked}\0${untracked}`.split("\0").filter((f) => f !== ""))].toSorted();
}

/**
 * Files this turn changed in a checkout: uncommitted files that were clean at the turn's
 * baseline, or have changed since. Without a baseline (no turn-start hook ran), every
 * uncommitted file counts.
 */
export function changedFiles(payload: Payload, root: string): string[] {
  const dirty = dirtyFiles(root);
  const baseline = readBaseline(payload, root);
  if (baseline === undefined) return dirty;
  return dirty.filter((file) => baseline.files[file] !== fingerprint(root, file));
}

const MAX_OUTPUT = 12_000;

/**
 * `bin` from the nearest node_modules/.bin at or above `root`, the way Node resolves
 * packages, so a worktree nested in the main checkout (.claude/worktrees/…) uses the
 * main checkout's install.
 */
function localBin(root: string, bin: string): string | undefined {
  for (let dir = root; ; dir = dirname(dir)) {
    const path = join(dir, "node_modules", ".bin", bin);
    if (existsSync(path)) return path;
    if (dirname(dir) === dir) return undefined;
  }
}

/**
 * Runs a binary from the checkout's node_modules/.bin (or an enclosing one), never a
 * global install and never through npx, which could download it. A missing binary is
 * a failure with a reason, so an uninstalled tool can never pass for a clean result.
 *
 * `timeoutMs` must leave the hook room under its own `timeout` in hooks.json: when the
 * harness kills a hook, the agent sees nothing and the tool keeps running. Here the tool
 * is killed instead, and the timeout is a failure the agent reads.
 * AGENT_HOOKS_TOOL_TIMEOUT_MS lowers it (for the tests).
 */
export function runLocalBin(
  root: string,
  bin: string,
  args: string[],
  timeoutMs: number,
): { ok: boolean; output: string } {
  const path = localBin(root, bin);
  if (path === undefined) return { ok: false, output: `${bin} is not installed in ${root} (run npm ci).` };
  const cap = Number(process.env.AGENT_HOOKS_TOOL_TIMEOUT_MS);
  const timeout = cap > 0 ? Math.min(cap, timeoutMs) : timeoutMs;
  const result = spawnSync(path, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    timeout,
    // A tool that traps SIGTERM must not outlive the budget; Vitest's workers exit when it does.
    killSignal: "SIGKILL",
    // Read by a model, not a terminal: no colour codes. CI is unset so the tools keep their local defaults.
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  const timedOut = result.error !== undefined && "code" in result.error && result.error.code === "ETIMEDOUT";
  const output = `${result.stdout}${result.stderr}`.trim() || (timedOut ? "" : (result.error?.message ?? ""));
  const clipped = output.length > MAX_OUTPUT ? `…(clipped)\n${output.slice(-MAX_OUTPUT)}` : output;
  if (timedOut) {
    const notice = `${bin} ${args.join(" ")} timed out after ${timeout / 1000}s, the hook's time budget, and was stopped. Run it yourself to see the result.`;
    return { ok: false, output: clipped === "" ? notice : `${notice}\nOutput so far:\n${clipped}` };
  }
  return { ok: result.status === 0, output: clipped };
}

/**
 * Sends `message` to Claude: stderr with exit code 2. Sets the exit code and lets Node
 * flush stderr before it exits; process.exit() here drops piped stderr past 64 KB on
 * macOS. So it does not stop the script: call it last.
 */
export function block(message: string): void {
  process.exitCode = 2;
  process.stderr.write(`${message}\n`);
}
