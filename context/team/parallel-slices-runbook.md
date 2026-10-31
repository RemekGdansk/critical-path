# Runbook: two roadmap slices in parallel

How to build two roadmap slices at the same time, each in its own git worktree with its own agent session. Written from the S-05 + S-08 trial (`context/team/parallel-slice-trial.md`), which saved time over building them one after the other.

## When to use it

- **Two slices, not more.** A third brings diminishing returns: one developer reviews every plan and every set of commits, and each extra branch adds a rebase on top of the ones already merged.
- **They are "Parallel with" each other** in `context/foundation/roadmap.md`, and the Prerequisites of both are `done`.
- **Each gets an approved plan** before implementation (the hard rule in `CLAUDE.md`). Planning can itself run in parallel, one session per worktree.

## 1. Prepare `main`

```bash
cd critical-path
git switch main && git pull --ff-only
gh issue list --label roadmap   # note each slice's issue number for "Closes #N"
```

## 2. Create the worktrees

One worktree per slice, next to the main checkout, on a branch named after the slice's change ID:

```bash
git worktree add -b <change-id-a> ../critical-path-<a> main
git worktree add -b <change-id-b> ../critical-path-<b> main
```

## 3. Bootstrap each worktree

In each worktree:

```bash
cp -R ../critical-path/.claude ../critical-path/CLAUDE.md ../critical-path/AGENTS.md ../critical-path/.10x-cli.json .
npm ci
npx astro sync
npm run lint && npx astro check && npm test && npm run build && npm run check:csp
```

- **The copy is required.** These four are gitignored, so a fresh worktree has no skills, no Claude Code settings and no project rules (`AGENTS.md` imports `PROJECT_RULES.md`). Nothing warns you if they are missing. They are snapshots: re-copy them if the toolkit is updated during the run.
- **The blocked install scripts are expected.** `npm ci` reports that the `esbuild` and `workerd` postinstall scripts were not run (`allowScripts`); the gate passes without them.
- **The husky pre-commit hook needs nothing.** `npm ci` runs `prepare`, and `core.hooksPath` is relative, so each worktree gets its own hook.
- **A green baseline comes first.** A failure after the first change should never be a failure that was already on `main`.

## 4. Split the ports

Leave 4321 free for the main checkout.

| Worktree | Dev                          | E2E                              |
| -------- | ---------------------------- | -------------------------------- |
| A        | `npm run dev -- --port 4322` | `E2E_PORT=4332 npm run test:e2e` |
| B        | `npm run dev -- --port 4323` | `E2E_PORT=4333 npm run test:e2e` |

Playwright reuses any server already listening on its port, so an E2E run without `E2E_PORT` can test the other slice's build and pass or fail for the wrong reason.

## 5. Tell each session about the other

Start one Claude Code session per worktree, each in its own herdr workspace. Open each session with a note like this one, before planning:

```text
Another session is building <other slice ID and title> in parallel, in ../critical-path-<other>, branch <other change ID>. It will probably change <its likely files>. Avoid changing those files; if this slice needs one, keep the edit small and say so in the plan. Editing this slice's own lines in context/foundation/roadmap.md is fine.
```

- **Expect overlap in the shared files, not the obvious ones.** In the trial the two slices kept apart in `Planner.tsx` and `useProject.ts`, but both changed `Planner.test.ts`, `src/styles/global.css` (new tokens), `context/domain/glossary.md` and `roadmap.md`.
- **`roadmap.md` needs no special rule.** Each branch edits its own slice's lines (status rows, Done entry), so the rebase is easy.
- **Neither slice changes the project file format** (`serializeProject`, golden files, the file version) unless its roadmap entry says so; if both would, do not run them in parallel.

## 6. Plan, then implement

In each worktree: `/10x-new <change-id>` → `/10x-research` → `/10x-plan` → `/10x-plan-review`, then `/10x-implement`, or `/goal <finish state and turn limit>` with `/10x-goal-implement <change-id>` for an unattended run. Review each plan before its implementation starts; with two sessions, reviews are the bottleneck.

## 7. Merge one slice at a time

1. Review the first finished slice (its commits and its manual checklist), push it, open a PR with `Closes #N` and merge it once CI is green, E2E included.
2. In the other worktree, `git fetch && git rebase origin/main`, resolve the conflicts, then rerun the full gate and `npm run test:e2e` with its `E2E_PORT`. Push and merge.

`strict: true` on `main` forces the second CI run. It is the guard against two slices that pass the gates alone but break when combined.

**Check every PR title before a squash merge**, archive PRs included. The title becomes the commit on `main`, and the skills write Conventional Commits prefixes (`chore(archive): …` in the trial) that `PROJECT_RULES.md` forbids.

## 8. Close out

- Run `/10x-archive` for each change and mark each slice `done` in `roadmap.md`, if the branches did not already.
- Remove the worktrees and their branches, from the main checkout:

```bash
git worktree remove ../critical-path-<a>
git worktree remove ../critical-path-<b>
```

Then delete the two branches with `/repo-refresh`. The slices were squash-merged, so `git branch -d` refuses to delete them as unmerged; `/repo-refresh` recognises squash merges and asks before deleting.
