# Test-Plan Refresh (2026-10-12) — Plan Brief

> Full plan: `context/changes/test-plan-refresh-2026-10-12/plan.md`
> Research: `context/changes/test-plan-refresh-2026-10-12/research.md`

## What & Why

`context/foundation/test-plan.md` was last reviewed on 2026-10-10. Since then roadmap S-03 (project file round-trip), Playwright E2E, the Claude Code agent hooks and Stryker have landed, and the guide now misstates its own rollout: two phases show `not started` although their goals are met, and §4–§6 describe a test base that no longer exists. This refresh makes the guide true again so `/10x-test-plan` routes to the real gap, §3 Phase 2.

## Starting Point

§3 shows Phases 1 and 4 `complete`, Phases 2, 3, 5 `not started`. Research found S-03 proved risks #1–#3 for format 0.1, the agent hooks meet Phase 5's mechanism, Phase 2 is still open (no hook-level DOM test), and §4/§5/§6 hold 19 stale or partial facts.

## Desired End State

§3 shows Phases 1, 3, 4, 5 `complete` and Phase 2 `not started`; §4 and §5 match the repository with `checked: 2026-10-12`; §6.3 tells S-06, S-07 and the M-1 version bump exactly which golden files and rejection rows to add; §6.5 records each closed phase and this refresh; §8 is dated 2026-10-12.

## Key Decisions Made

| Decision                       | Choice                                                                                                                            | Why (1 sentence)                                                                                                                   | Source   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| §3 Phase 3 status              | `complete`, Change folder `project-file-round-trip`                                                                               | S-03 proved #1–#3 for 0.1; the residuals need unbuilt features, and S-03's archive has a fully checked Progress the parser accepts | Plan     |
| §3 Phase 5 status              | `complete`, Change folder `— (commit 8606e65)`, §6.5 note                                                                         | The hooks need no change; their planner-state half starts checking once Phase 2's test imports the state hook                      | Plan     |
| §1/§2 scope                    | Churn evidence only: §1 hot-spot line, §2 Source counts for #4 and #5                                                             | Research found no risk to raise or retire; the refresh may not rewrite §1/§2 beyond what the user directs                          | Plan     |
| Where residuals go             | §6.3 and §6.5 only; roadmap untouched                                                                                             | S-06/S-07 Risk lines already require a golden file each, and roadmap edits re-sync GitHub issues                                   | Plan     |
| Status cell wording            | Parser literals only; qualifiers in Change folder or §6.5                                                                         | `/10x-test-plan` parses §3 Status literally                                                                                        | Research |
| Stryker and `test:hooks` in §5 | Listed, each `never a gate`                                                                                                       | Both exist and are run locally; PROJECT_RULES forbids gating on them                                                               | Research |
| Version-bump trap              | Recorded in §6.3: at `"0.1"` → `"1"`, the byte-for-byte export assertion moves to the new golden file; old files keep import only | Otherwise the bump reads as a broken old-file test                                                                                 | Research |
| Mutation guidance              | One bullet in §6.1 pointing to PROJECT_RULES, not a new §6 section                                                                | No change has used Stryker yet; the procedure already lives in PROJECT_RULES                                                       | Plan     |

## Scope

**In scope:**

- `context/foundation/test-plan.md`: header, §1 hot-spot line, §2 Source counts (#4, #5), §3 rows 3 and 5 and order rationale, §4 table and grounding note, §5 table, §6.1, §6.3, §6.4 re-audit, §6.5 notes, §8 dates

**Out of scope:**

- Any test, script, config or app code (Phase 2 stays its own rollout change)
- §2 risk wording, ratings, Response Guidance; §7
- `context/foundation/roadmap.md`
- Tests for the > 5 MB and file-read-failure import branches
- Vitest 5.0.4 bump; the stale archive path in the `scripts/csp/check-page.ts:6` comment

## Architecture / Approach

Three top-to-bottom passes over one file, one commit each, every new fact traced to `research.md` or a file read during implementation. §2 Source cells stay evidence-only (directories with counts). Markdown per PROJECT_RULES: no hard line breaks, `prettier --write` aligns tables.

## Phases at a Glance

| Phase                                   | What it delivers                                                                              | Key risk                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Strategy evidence and rollout status | Fresh churn counts in §1/§2; §3 Phases 3 and 5 `complete`; rationale rewritten                | A non-literal Status cell breaks the orchestrator's routing                   |
| 2. Stack and quality gates              | §4 rows corrected, Stryker row added, grounding re-dated; §5 live gates and never-a-gate rows | Test counts drift between research and implementation — re-measured at commit |
| 3. Cookbook, ledger and close-out       | §6.1 mutation bullet, §6.3 filled, §6.4 re-audited, §6.5 notes, §8 dated                      | §6.3 over-prescribes S-06/S-07 design instead of stating the test obligations |

**Prerequisites:** branch `test-plan-refresh-2026-10-12`; research complete.
**Estimated effort:** one short session across 3 phases.

## Open Risks & Assumptions

- Marking Phase 5 `complete` shows coverage that is empty for planner-state code until Phase 2 lands; the §6.5 note and the §4 AI-native row say so.
- The risk-#1 old-file check exists only as a §6.3 rule until M-1 closes; nothing gates it before then.

## Success Criteria (Summary)

- `/10x-test-plan --status` names §3 Phase 2 as the current phase.
- Every fact in §4–§6 matches the repository on 2026-10-12, with no live gate deferred to a finished phase.
- Someone planning S-07 or the M-1 version bump can find in §6.3 what to add to the file-contract tests.
