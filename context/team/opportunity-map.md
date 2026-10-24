# Opportunity Map

## Context

- **Project / context**: Critical Path, a single-developer project built with AI agents. The frictions come from the development workflow (agents, Dependabot, mutation testing), not from the product.
- **Data constraint**: Mock / local / read-only / non-sensitive: this repository, its public GitHub PR metadata and CI results.
- **Date**: 2026-10-24

## Map

| Signal                                                                            | Existing / default response                                                                             | Thin complement                                                                | First useful version                                             | Data risk                              | Direction if valuable               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------- | ----------------------------------- |
| Roadmap slices that could run in parallel ran one at a time                       | git worktrees (Claude Code can start an agent in its own worktree); the roadmap's "Parallel with" field | Runbook: worktree and `npm ci` per slice, separate dev port, shared-file rules | One S-05 + S-08 trial in two worktrees, noting what collided     | Local                                  | Wait; runbook if the trial pays off |
| Weekly Dependabot PRs need merge, branch update and a CI re-run one after another | One npm group (plus `applies-to: security-updates`) and auto-merge (`gh pr merge --auto`)               | GitHub's `dependabot/fetch-metadata` auto-merge workflow (adopted, not built)  | `dependabot.yml` change, then count PRs and clicks for 2–3 weeks | Read-only; supply chain if auto-merged | Config change, no build             |
| Stryker reports ~0% until `node_modules` is patched by hand                       | Upstream fix: `@stryker-mutator/vitest-runner` 10.1.1 (2026-10-23)                                      | None                                                                           | Bump to 10.1.1 + one verification run                            | Local                                  | No build; done 2026-10-24 (#72)     |

## Recommended First Candidate

No build candidate. None of the signals combines two sources or two roles, and each one already has an existing response that is cheaper than any tool. The only signal still worth validating is parallel agent work, and its first version is an experiment, not software:

```text
Candidate:
Parallel-slice trial (no tooling)

Reads:
context/foundation/roadmap.md ("Parallel with" fields), two git worktrees, the developer's notes from the trial

Returns:
A short written note on what collided (files, port 4321, node_modules, hooks, review attention) and whether two slices finished sooner than one after the other

Does not do:
No orchestration script, no agent scheduler, no automatic roadmap merging, no changes to CI or the deploy build

Data risk:
Local only. The real risk is a broken main: two slices that each pass the gates alone but break when merged together. Branch protection with `strict: true` and the deploy build's own gates already catch that.

Direction if it proves valuable:
Wait. If the trial saves time, write a runbook in context/ (and maybe a rule in PROJECT_RULES.md). Build nothing.
```

Existing responses to apply first, independent of validation:

1. **Stryker (done 2026-10-24, #72; a mutation run on `duration.ts` killed 13 of 13 mutants):** bump `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` to 10.1.1 (the `^10.0.0` range already allows it; only the lockfile holds 10.0.0), run `npm ci` (the local `vitest` 5.0.3 no longer matches `^5.0.5`), confirm one mutation run reports a non-zero score, then remove the "Known false result" paragraph from PROJECT_RULES.md.
2. **Dependabot:** merge the `production-dependencies` and `development-dependencies` groups into one and turn on auto-merge for Dependabot PRs. Keep `strict: true` on main. Accept that a single group is all-or-nothing, as the TypeScript `ignore` comment in `.github/dependabot.yml` already explains.

## Why This Candidate

- **Stryker** is fixed upstream, as of yesterday. Fix PR stryker-js #6214 merged on 2026-10-23, and the 10.1.1 package switches to the `' > '` separator when it detects Vitest 5 (`dist/src/vitest-test-runner.js`). Any helper would be wasted work.
- **Dependabot** is real and recurring (PR pairs and triples #68/#69, #61/#62/#63, #45/#46/#47, one batch a week). The cause is configuration: `strict: true` on main's required checks, plus two npm groups that both touch `package-lock.json`. GitHub's own settings fix it.
- **Parallel agent work** has no past behavior behind it. It was never tried, and the stated blockers (shared files, port 4321, one working copy, not knowing how) are guesses about what would go wrong. Some of the cost is essential: every slice really does edit `roadmap.md`, the golden files and `Planner.tsx`, and one developer can review only so much at once. It is the only signal with an open question, so it goes to validation. Only 3 slices remain in M-1 (S-05, S-07, S-08), so the window to learn from it in this milestone is short.

## Next Direction If Valuable

Validate the parallel-agent signal with `/10x-mom-test`, asking about past behavior: how long did the last two slices that were marked "Parallel with" each other take one after another, and where did that time go (agent work vs. waiting on review vs. CI)? If the trial shows a real saving, shape a runbook with `/10x-shape`. It stays a document and a rule, not a tool, unless repeated trials show cross-slice coordination that a document cannot carry.
