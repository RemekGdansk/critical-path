// Proof that the Claude Code hooks reach the agent: each case pipes a hook payload
// into the real script and asserts the exit code and stderr, the only channel Claude
// reads (exit 2). Every case runs in a throwaway git repo holding a copy of the
// scripts, with ESLint, Vitest and Astro replaced by stubs in node_modules/.bin that
// flag a marker (LINT_ERROR, TEST_FAIL, TYPE_ERROR), so git and the scripts stay real
// and the developer's tree is never touched.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const hooksDir = fileURLToPath(new URL(".", import.meta.url));

interface HookConfig {
  hooks: Record<string, { matcher?: string; hooks: { type: string; command: string; timeout: number }[] }[]>;
}
const hookConfig = JSON.parse(readFileSync(join(hooksDir, "hooks.json"), "utf8")) as HookConfig;

const stubs: Record<string, string> = {
  // eslint [--quiet] <file>…: an error for every file holding LINT_ERROR.
  eslint: `rc=0; for a in "$@"; do case "$a" in --*) ;; *) if grep -q LINT_ERROR "$a"; then echo "$a 1:1 error LINT_ERROR marker (stub)"; rc=1; fi ;; esac; done; exit $rc`,
  // vitest related <file> --run | vitest run --config <hooks config> | vitest run: fails on TEST_FAIL
  // in the file, in scripts/agent-hooks/, or anywhere in src/. SLOW in the related file hangs it.
  vitest: `if [ "$1" = related ]; then grep -q SLOW "$2" && exec sleep 5; grep -q TEST_FAIL "$2" && { echo "FAIL $2 TEST_FAIL (stub)"; exit 1; }; exit 0; fi; d=src; [ "$2" = --config ] && d=scripts/agent-hooks; f=$(grep -rl TEST_FAIL $d 2>/dev/null) && { echo "FAIL $f TEST_FAIL (stub)"; exit 1; }; exit 0`,
  // astro check: a type error for every file in src/ holding TYPE_ERROR.
  astro: `f=$(grep -rl TYPE_ERROR src 2>/dev/null) && { echo "$f - error ts(2322): TYPE_ERROR (stub)"; exit 1; }; exit 0`,
};

let sandbox: string;
let repo: string;
let registryTmp: string;
let stubLog: string;

function sh(cwd: string, command: string): void {
  const result = spawnSync("sh", ["-c", command], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
}

/** A git repo with the hook scripts, the tool stubs, one clean module and a README, all committed. */
function makeRepo(dir: string): void {
  mkdirSync(join(dir, "scripts", "agent-hooks"), { recursive: true });
  const files = readdirSync(hooksDir, { withFileTypes: true }).filter(
    (f) => f.isFile() && !f.name.endsWith(".test.ts"),
  );
  for (const { name: file } of files) {
    copyFileSync(join(hooksDir, file), join(dir, "scripts", "agent-hooks", file));
  }
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  for (const [bin, body] of Object.entries(stubs)) {
    const path = join(dir, "node_modules", ".bin", bin);
    writeFileSync(path, `#!/bin/sh\necho "${bin} $*" >>"$STUB_LOG"\n${body}\n`);
    chmodSync(path, 0o755);
  }
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "clean.ts"), "export const clean = 1;\n");
  writeFileSync(join(dir, "README.md"), "# Sandbox\n");
  writeFileSync(join(dir, ".gitignore"), "node_modules/\n.claude/\n");
  sh(dir, "git init -q && git add -A && git -c user.name=t -c user.email=t@t commit -qm init");
}

function run(script: string, input: unknown, cwd = repo, env: Record<string, string> = {}) {
  const result = spawnSync("node", [join(repo, "scripts", "agent-hooks", script)], {
    cwd,
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, TMPDIR: registryTmp, STUB_LOG: stubLog, CLAUDE_PROJECT_DIR: repo, ...env },
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

const edit = (file: string, cwd = repo, extra: Record<string, unknown> = {}) => ({
  session_id: "s1",
  cwd,
  hook_event_name: "PostToolUse",
  tool_name: "Edit",
  tool_input: { file_path: file },
  ...extra,
});
const stop = (cwd = repo, extra: Record<string, unknown> = {}) => ({
  session_id: "s1",
  cwd,
  hook_event_name: "Stop",
  stop_hook_active: false,
  ...extra,
});
/** A worktree of the sandbox repo, with its own copy of the tool stubs unless `tools` is false. */
function addWorktree(path: string, tools = true): void {
  sh(repo, `git worktree add -q "${path}"`);
  if (!tools) return;
  mkdirSync(join(path, "node_modules", ".bin"), { recursive: true });
  for (const bin of Object.keys(stubs))
    copyFileSync(join(repo, "node_modules", ".bin", bin), join(path, "node_modules", ".bin", bin));
}
const turnStart = (cwd = repo) => ({ session_id: "s1", cwd, hook_event_name: "UserPromptSubmit", prompt: "go" });
const stubCalls = () => (existsSync(stubLog) ? readFileSync(stubLog, "utf8") : "");

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "agent-hooks-"));
  repo = join(sandbox, "repo");
  registryTmp = join(sandbox, "tmp");
  stubLog = join(sandbox, "stub.log");
  mkdirSync(repo);
  mkdirSync(registryTmp);
  makeRepo(repo);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe.each(["lint-edited-file.ts", "related-tests.ts"])("per edit: %s", (script) => {
  const marker = script === "lint-edited-file.ts" ? "LINT_ERROR" : "TEST_FAIL";

  it("blocks a broken edited file with exit 2, naming the file and the problem on stderr", () => {
    const file = join(repo, "src", "broken.ts");
    writeFileSync(file, `export const broken = "${marker}";\n`);
    const result = run(script, edit(file));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(file);
    expect(result.stderr).toContain(marker);
  });

  it("passes a clean file silently", () => {
    const result = run(script, edit(join(repo, "src", "clean.ts")));
    expect(result).toMatchObject({ status: 0, stderr: "" });
  });

  it("checks only the edited file, not other broken files", () => {
    writeFileSync(join(repo, "src", "other.ts"), `export const other = "${marker}";\n`);
    expect(run(script, edit(join(repo, "src", "clean.ts"))).status).toBe(0);
  });

  it.each([
    ["an uncovered type", () => edit(join(repo, "README.md"))],
    ["a nonexistent file", () => edit(join(repo, "src", "missing.ts"))],
    ["an empty payload", () => ({})],
    ["a tool call without a path", () => ({ cwd: repo, tool_name: "Bash", tool_input: { command: "ls" } })],
  ])("has nothing to check for %s", (_name, payload) => {
    expect(run(script, payload()).status).toBe(0);
  });

  it("has nothing to check for unparseable or empty stdin", () => {
    expect(run(script, "not json").status).toBe(0);
    expect(run(script, "").status).toBe(0);
  });

  it("resolves a relative path against the payload cwd", () => {
    writeFileSync(join(repo, "src", "broken.ts"), `export const broken = "${marker}";\n`);
    const result = run(script, edit("src/broken.ts"), sandbox);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(join(repo, "src", "broken.ts"));
  });

  it("skips a broken file of another repository", () => {
    const other = join(sandbox, "other");
    mkdirSync(other);
    makeRepo(other);
    writeFileSync(join(other, "src", "broken.ts"), `export const broken = "${marker}";\n`);
    expect(run(script, edit(join(other, "src", "broken.ts"))).status).toBe(0);
  });

  it("checks the session's checkout, not a stale $CLAUDE_PROJECT_DIR holding an error", () => {
    const other = join(sandbox, "other");
    mkdirSync(other);
    makeRepo(other);
    writeFileSync(join(other, "src", "clean.ts"), `export const clean = "${marker}";\n`);
    expect(run(script, edit(join(repo, "src", "clean.ts")), repo, { CLAUDE_PROJECT_DIR: other }).status).toBe(0);
  });

  it("fails visibly when the tool is not installed", () => {
    rmSync(join(repo, "node_modules", ".bin", script === "lint-edited-file.ts" ? "eslint" : "vitest"));
    const result = run(script, edit(join(repo, "src", "clean.ts")));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("is not installed");
  });
});

describe("end of turn: end-of-turn.ts", () => {
  it("passes without running any check when nothing changed", () => {
    expect(run("end-of-turn.ts", stop())).toMatchObject({ status: 0, stderr: "" });
    expect(stubCalls()).toBe("");
  });

  it("blocks a lint error written to disk without a per-edit payload (a shell rewrite)", () => {
    writeFileSync(join(repo, "src", "clean.ts"), 'export const clean = "LINT_ERROR";\n');
    const result = run("end-of-turn.ts", stop());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("src/clean.ts");
    expect(result.stderr).toContain("LINT_ERROR");
  });

  it("blocks a red test in a module the turn did not edit, and a type error, in one message", () => {
    writeFileSync(join(repo, "README.md"), "# Changed\n");
    writeFileSync(join(repo, "src", "clean.ts"), "export const clean = 1; // TYPE_ERROR\n");
    sh(repo, "git add src && git -c user.name=t -c user.email=t@t commit -qm types");
    writeFileSync(join(repo, "src", "red.test.ts"), "// TEST_FAIL\n");
    const result = run("end-of-turn.ts", stop());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Unit tests fail");
    expect(result.stderr).toContain("astro check fails");
  });

  it("passes a clean change", () => {
    writeFileSync(join(repo, "src", "clean.ts"), "export const clean = 2;\n");
    expect(run("end-of-turn.ts", stop())).toMatchObject({ status: 0, stderr: "" });
    expect(stubCalls()).toContain("eslint --quiet src/clean.ts");
  });

  it("lets the agent finish on the retry, with the error still present", () => {
    writeFileSync(join(repo, "src", "clean.ts"), 'export const clean = "LINT_ERROR";\n');
    expect(run("end-of-turn.ts", stop(repo, { stop_hook_active: true })).status).toBe(0);
    expect(run("end-of-turn.ts", stop(repo, { loop_count: 1 })).status).toBe(0);
  });

  it("has nothing to check for an empty or unparseable payload outside git", () => {
    const outside = join(sandbox, "plain");
    mkdirSync(outside);
    for (const input of ["{}", "not json"]) {
      const result = run("end-of-turn.ts", input, outside);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("nothing checked");
    }
  });

  it("sweeps a sibling worktree the session edited, not only its own cwd", () => {
    const worktree = join(sandbox, "wt");
    addWorktree(worktree);
    const file = join(worktree, "src", "clean.ts");
    writeFileSync(file, 'export const clean = "LINT_ERROR";\n');
    expect(run("lint-edited-file.ts", edit(file)).status).toBe(2);
    const result = run("end-of-turn.ts", stop());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(worktree);
  });

  it("fails visibly when the typechecker is not installed", () => {
    writeFileSync(join(repo, "src", "clean.ts"), "export const clean = 2;\n");
    rmSync(join(repo, "node_modules", ".bin", "astro"));
    const result = run("end-of-turn.ts", stop());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("astro is not installed");
  });

  it("runs the agent-hook tests when the turn changed scripts/agent-hooks/", () => {
    writeFileSync(join(repo, "scripts", "agent-hooks", "turn-start.ts"), "// TEST_FAIL\n", { flag: "a" });
    const result = run("end-of-turn.ts", stop());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Agent-hook tests fail");
    expect(result.stderr).toContain("scripts/agent-hooks/turn-start.ts");
  });

  it("leaves the agent-hook tests out of a turn that did not change them", () => {
    writeFileSync(join(repo, "src", "clean.ts"), "export const clean = 2;\n");
    expect(run("end-of-turn.ts", stop()).status).toBe(0);
    expect(stubCalls()).toContain("vitest run\n");
    expect(stubCalls()).not.toContain("--config");
  });

  it("lints a changed file whose name git would quote and escape", () => {
    writeFileSync(join(repo, "src", 'Zadanié "x".ts'), 'export const x = "LINT_ERROR";\n');
    const result = run("end-of-turn.ts", stop());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('src/Zadanié "x".ts');
  });

  it("uses the main checkout's tools from a nested worktree without node_modules", () => {
    const worktree = join(repo, ".claude", "worktrees", "x");
    addWorktree(worktree, false);
    writeFileSync(join(worktree, "src", "clean.ts"), 'export const clean = "LINT_ERROR";\n');
    const result = run("end-of-turn.ts", stop(worktree), worktree);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("LINT_ERROR marker (stub)");
    expect(result.stderr).not.toContain("is not installed");
  });
});

describe("this turn only: turn-start.ts + end-of-turn.ts", () => {
  const broken = (name: string) => {
    writeFileSync(join(repo, "src", name), `export const x = "LINT_ERROR";\n`);
  };

  it("is silent and never blocks the prompt, whatever the payload", () => {
    for (const input of [turnStart(), {}, "not json", ""]) {
      expect(run("turn-start.ts", input)).toMatchObject({ status: 0, stdout: "", stderr: "" });
    }
  });

  it("leaves uncommitted work from before the turn alone, and runs no check when the turn changed nothing", () => {
    broken("wip.ts");
    run("turn-start.ts", turnStart());
    expect(run("end-of-turn.ts", stop())).toMatchObject({ status: 0, stderr: "" });
    expect(stubCalls()).toBe("");
  });

  it("checks a file the turn created, even through a shell, but not the older work beside it", () => {
    broken("wip.ts");
    run("turn-start.ts", turnStart());
    broken("new.ts");
    const result = run("end-of-turn.ts", stop());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("src/new.ts");
    expect(result.stderr).not.toContain("wip.ts");
  });

  it("checks an already uncommitted file once the turn changes it again", () => {
    writeFileSync(join(repo, "src", "wip.ts"), "export const wip = 1;\n");
    run("turn-start.ts", turnStart());
    broken("wip.ts");
    expect(run("end-of-turn.ts", stop()).status).toBe(2);
  });

  it("in a worktree first edited mid-turn, checks the edited file but not the work already there", () => {
    const worktree = join(sandbox, "wt");
    addWorktree(worktree);
    writeFileSync(join(worktree, "src", "wip.ts"), 'export const wip = "LINT_ERROR";\n');
    run("turn-start.ts", turnStart());
    const file = join(worktree, "src", "clean.ts");
    writeFileSync(file, 'export const clean = "LINT_ERROR";\n');
    run("lint-edited-file.ts", edit(file));
    const result = run("end-of-turn.ts", stop());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("src/clean.ts");
    expect(result.stderr).not.toContain("wip.ts");
  });

  it("forgets the previous turn's worktrees at the next prompt", () => {
    const worktree = join(sandbox, "wt");
    addWorktree(worktree);
    const file = join(worktree, "src", "clean.ts");
    writeFileSync(file, 'export const clean = "LINT_ERROR";\n');
    run("lint-edited-file.ts", edit(file));
    run("turn-start.ts", turnStart());
    expect(run("end-of-turn.ts", stop())).toMatchObject({ status: 0, stderr: "" });
  });
});

describe("plumbing: hook-lib.ts", () => {
  it("delivers a long block message whole, with exit 2", () => {
    // process.exit right after a large write to piped stderr drops all but the first 64 KB on macOS.
    const lib = join(repo, "scripts", "agent-hooks", "hook-lib.ts");
    const code = `import { block } from ${JSON.stringify(lib)}; block("x".repeat(200_000));`;
    const result = spawnSync("node", ["--input-type=module", "-e", code], { encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr.length).toBe(200_001);
  });

  it("stops a tool at its time budget and tells the agent, instead of being killed silently by the harness", () => {
    const file = join(repo, "src", "slow.ts");
    writeFileSync(file, "export const slow = 1; // SLOW\n");
    const started = Date.now();
    const result = run("related-tests.ts", edit(file), repo, { AGENT_HOOKS_TOOL_TIMEOUT_MS: "500" });
    expect(Date.now() - started).toBeLessThan(4_000);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("timed out after 0.5s");
  });
});

describe("hook config: scripts/agent-hooks/hooks.json", () => {
  const commands = Object.entries(hookConfig.hooks).flatMap(([event, groups]) =>
    groups.flatMap((group) => group.hooks.map((hook) => ({ event, matcher: group.matcher, ...hook }))),
  );
  // The hooks that report to the agent; UserPromptSubmit only records the turn's baseline.
  const checks = commands
    .filter((c) => c.event !== "UserPromptSubmit")
    .map((c): [string, string] => [/[\w-]+\.ts/.exec(c.command)?.[0] ?? c.event, c.command]);

  /** Runs a hook command the way Claude Code does: `sh -c` in the session's cwd, the payload on stdin. */
  function runCommand(command: string, cwd: string, input: unknown, projectDir: string) {
    return spawnSync("sh", ["-c", command], {
      cwd,
      input: JSON.stringify(input),
      encoding: "utf8",
      env: { ...process.env, TMPDIR: registryTmp, STUB_LOG: stubLog, CLAUDE_PROJECT_DIR: projectDir },
    });
  }

  it("registers the turn start, per-edit hooks on Write|Edit and the end of turn, with timeouts in seconds", () => {
    expect(commands.map((c) => [c.event, c.matcher, c.timeout])).toEqual([
      ["UserPromptSubmit", undefined, 10],
      ["PostToolUse", "Write|Edit", 30],
      ["PostToolUse", "Write|Edit", 60],
      ["Stop", undefined, 120],
    ]);
  });

  it.each(checks)("reaches the script from a worktree with a nonexistent $CLAUDE_PROJECT_DIR: %s", (_name, command) => {
    const worktree = join(sandbox, "wt");
    addWorktree(worktree);
    const file = join(worktree, "src", "clean.ts");
    writeFileSync(file, 'export const clean = "LINT_ERROR TEST_FAIL TYPE_ERROR";\n');
    const result = runCommand(
      command,
      worktree,
      { ...edit(file, worktree), ...stop(worktree) },
      join(sandbox, "nonexistent"),
    );
    // Exit 2 with the marker: the command found the worktree's script and the script ran its check.
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(worktree);
  });

  it.each(checks)(
    "falls back to $CLAUDE_PROJECT_DIR's script and tools from a nested worktree with neither: %s",
    (_name, command) => {
      // A worktree of a branch where scripts/agent-hooks is not committed, made by EnterWorktree under .claude/worktrees.
      const worktree = join(repo, ".claude", "worktrees", "x");
      addWorktree(worktree, false);
      rmSync(join(worktree, "scripts"), { recursive: true });
      const file = join(worktree, "src", "clean.ts");
      writeFileSync(file, 'export const clean = "LINT_ERROR TEST_FAIL TYPE_ERROR";\n');
      const result = runCommand(command, worktree, { ...edit(file, worktree), ...stop(worktree) }, repo);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain(worktree);
      expect(result.stderr).not.toContain("is not installed");
    },
  );

  it.each(commands.map((c) => [c.event, c.command]))(
    "fails as a hook error, never a pass, when the script is nowhere: %s",
    (_event, command) => {
      const outside = join(sandbox, "plain");
      mkdirSync(outside);
      const result = runCommand(command, outside, stop(outside), join(sandbox, "nonexistent"));
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("is in neither this checkout nor");
    },
  );

  it("records the turn's baseline through the configured command, silently", () => {
    const [command] = commands.filter((c) => c.event === "UserPromptSubmit").map((c) => c.command);
    writeFileSync(join(repo, "src", "wip.ts"), 'export const wip = "LINT_ERROR";\n');
    expect(runCommand(command, repo, turnStart(), repo)).toMatchObject({ status: 0, stdout: "", stderr: "" });
    expect(run("end-of-turn.ts", stop()).status).toBe(0);
  });
});
