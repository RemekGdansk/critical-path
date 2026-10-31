# Parallel-slice trial: S-05 + S-08

The trial proposed in `context/team/opportunity-map.md` (Recommended First Candidate): two roadmap slices marked "Parallel with" each other, each built in its own git worktree, noting what collided and whether the two finished sooner than they would have one after the other. No tooling was built. The runbook that came out of it is `context/team/parallel-slices-runbook.md`.

## Setup

- **Run:** 2026-10-31, from `main` at `7cea67e`.
- **Slices:** S-05 `critical-path-highlight` (issue #19) and S-08 `start-new-project` (issue #22).
- **Worktrees:** `../critical-path-s05` on branch `critical-path-highlight` and `../critical-path-s08` on branch `start-new-project`, created with `git worktree add -b <change-id> <path> main`.
- **Ports:** 4321 stayed free. S-05 used 4322 for dev and 4332 for E2E (`E2E_PORT`); S-08 used 4323 and 4333.
- **Baseline:** both worktrees passed the full gate before any change (lint, `astro check` with 0 errors, 411 of 411 tests, build, `check:csp` on 2 pages). E2E was not run.
- **Coordination:** each session was told about the other and asked to avoid files the other session might change. `context/foundation/roadmap.md` was not ruled out.

## What collided

| Area                    | What happened                                                                                                                                                                                                                          | Cost                                                     | Fix in the runbook                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Gitignored agent setup  | `.claude/`, `CLAUDE.md`, `AGENTS.md` and `.10x-cli.json` are gitignored, so a new worktree has no skills, no Claude Code settings and no project rules (`AGENTS.md` is what imports `PROJECT_RULES.md`).                               | One `cp -R` per worktree; easy to miss, silent if missed | Copy them as part of creating the worktree. The copies are snapshots: re-copy after a toolkit update. |
| `node_modules`          | Each worktree needs its own `npm ci` and `npx astro sync`.                                                                                                                                                                             | One install per worktree (time and disk not measured)    | Part of worktree setup.                                                                               |
| Blocked install scripts | `npm ci` skipped the `esbuild` and `workerd` postinstall scripts (not covered by `allowScripts`). The gate passed without them, so they were left blocked. Not specific to worktrees, but it surfaced here as an install-time warning. | None                                                     | Noted, so the warning is not mistaken for a broken install.                                           |
| Plans                   | `context/changes/` had no plan for either slice, so both slices started with research and planning.                                                                                                                                    | Planning and plan review for two slices at once          | Plan inside each worktree; the plans live in different folders and never conflict.                    |
| Shared files            | Both PRs changed `context/domain/glossary.md`, `context/foundation/roadmap.md`, `src/components/planner/Planner.test.ts` and `src/styles/global.css` (S-08 changed 19 files, S-05 27). S-05 was rebased onto S-08.                     | One rebase                                               | Tell each session about the other; merge one slice at a time and rerun the gates after the rebase.    |
| `roadmap.md`            | Both branches edited it, on different lines (each slice's own status rows and Done entry). The rebase was easy.                                                                                                                        | None worth avoiding                                      | Let each branch edit its own slice's lines; no need to defer roadmap edits to `main`.                 |
| Commit style            | The two archive PRs landed on `main` as `chore(archive): close start-new-project (#88)` and `chore(archive): close critical-path-highlight (#90)`, with the Conventional Commits prefix `PROJECT_RULES.md` forbids.                    | Two off-style subjects on `main`                         | Check every PR title before a squash merge, archive PRs included.                                     |

**Worked without action:** the husky pre-commit hook (`core.hooksPath` is the relative `.husky/_`, and `npm ci` ran `prepare`, so each worktree has its own working hook), and the port split (no collision reported).

**Expected but did not happen:** a conflict in `src/components/planner/Planner.tsx` or `src/hooks/useProject.ts`. Only S-08 changed them; S-05 kept to the forecast service, the diagram and `ForecastSummary`. The overlap came instead from the shared test file, the token stylesheet and the two context documents every slice updates.

## Timing

Worktrees were created at about 12:21 UTC; the PR times below are from GitHub. Agent, review and CI time were not recorded separately.

| Slice | PR  | Opened (UTC)     | Merged (UTC)     | Archive PR |
| ----- | --- | ---------------- | ---------------- | ---------- |
| S-08  | #87 | 2026-10-31 14:26 | 2026-10-31 14:28 | #88        |
| S-05  | #89 | 2026-10-31 14:58 | 2026-10-31 15:00 | #90        |

Both slices went from new worktree to merged in under three hours, planning included.

## Verdict

Running the two slices in parallel saved time. A third parallel slice would likely bring diminishing returns: one developer reviews every plan and every set of commits, and each extra branch adds a rebase on top of the ones already merged. The next step from the opportunity map is taken: a runbook, `context/team/parallel-slices-runbook.md`, and no tooling.
