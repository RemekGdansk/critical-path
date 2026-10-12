<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Test-Plan Refresh (2026-10-12)

- **Plan**: context/changes/test-plan-refresh-2026-10-12/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

Evidence summary: 30 of 32 planned items match their Contract. `npx prettier --check` passes; the `setSystemTime`, `after §3 Phase (3|5)`, `TBD — see §3 Phase 3` and `For the next --refresh` greps find nothing; §6.2 still reads TBD; every §4 versioned row and all four grounding lines carry `checked: 2026-10-12`; §8 shows 2026-10-12 three times. §2 is byte-identical except the two Source cells, §7 is unchanged, and no code, test, config or roadmap file changed. Churn counts (36/36/8/8/5/4/4, 20 commits), versions (Vitest 5.0.3, Playwright 1.64.0, Stryker 10.0.0, parse5 8.0.1, jsx-a11y 6.10.2), commits `8606e65` and `ed0ba7e`, hook budgets, Stryker scope and every cited path were checked against the repo.

## Findings

### F1 — §6.3 says the edit rules use `validateProject`; they do not

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/foundation/test-plan.md:126
- **Detail**: "Import validates through the same `validateProject` the edit rules use, so a rule is written once and tested at both ends." `validateProject` (`src/lib/services/project.ts:265`) is called only from `src/lib/services/project-file.ts:388`. The edit functions do not call it; it reuses their helpers (`checkName`, `isPositiveWholeDays`, `isIsoDate`, `findCycle`) and messages. The sentence is outside the plan's Contract, and a future S-07 author could add a Done-rule check to `validateProject` believing the edit path picks it up.
- **Fix**: Reword to "Import validates through `validateProject` (`src/lib/services/project.ts`), which reuses the edit rules' checks and messages, so a rule is written once and tested at both ends; a new rule must be added to the edit function and to `validateProject`."
- **Decision**: FIXED — §6.3 Location reworded: `validateProject` reuses the edit rules' checks but is not called by them; a new rule is wired into both

### F2 — The M-1 version bump residual has no owner

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:59, 130–131, 167
- **Detail**: Phase 3 is now `complete`, and risk #1's core protection (older-version import, documented defaults for absent fields) is handed to "the M-1 version bump". In `roadmap.md` the bump appears only inside the S-06 and S-07 Risk lines ("stays `0.1` until M-1 closes and then becomes `1`"); no slice and not the M-1 "Done when" owns doing it or testing it. The obligation now lives only in §6.3 prose, which nobody is routed to when M-1 closes. The plan deliberately left `roadmap.md` alone (it re-syncs GitHub issues), so this is a plan gap, not drift.
- **Fix A ⭐ Recommended**: Queue a follow-up to add the version bump (with its golden-file and absent-field-default rows per §6.3) to the M-1 "Done when" in `roadmap.md`, in its own reviewed commit.
  - Strength: The milestone close is the moment the bump happens; making it a Done-when condition puts the check where `/10x-roadmap` will look.
  - Tradeoff: A roadmap edit re-syncs issues; small, but it is a separate change.
  - Confidence: HIGH — roadmap S-06/S-07 Risk lines already name the bump; only the owner is missing.
  - Blind spot: Whether the maintainer wants the bump as its own slice instead.
- **Fix B**: Note in the §6.5 Refresh 2026-10-12 "Watch" bullet that the bump has no roadmap owner yet.
  - Strength: Stays inside this change's "documentation of test-plan only" scope.
  - Tradeoff: The next refresh, not the milestone close, is what reads it; can still be missed.
  - Confidence: MED — depends on a refresh running before M-1 closes.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — queued in `follow-ups/review-fixes.md` (roadmap M-1 "Done when" to own the version bump, own reviewed commit)

### F3 — §5 gate-order paragraph rewritten despite "unchanged"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/test-plan.md:94–103
- **Detail**: The plan says "Gate-order paragraph unchanged (research confirmed it matches `ci.yml` and deploy-plan step 7)". Commit 83001f5 replaced the one-line paragraph with a 9-step list that adds `npx playwright install --with-deps chromium` and the `playwright-report` upload kept 7 days. The content is accurate today, but the schema's Forbidden content says "No CI YAML, hook scripts, or MCP install commands" — these steps mirror `ci.yml` and will drift from it. The old paragraph already said everything the guide needs.
- **Fix**: Restore main's one-line gate-order paragraph (`astro sync` → lint → `astro check` → `npm test` → `npm run build` → `npm run check:csp`; then `npm run test:e2e` in GitHub Actions only).
- **Decision**: FIXED — §5 gate-order list replaced with main's one-line paragraph, as the plan specified

### F4 — Progress 2.5 cites `npx vitest list`, which reports 149, not 284

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/test-plan-refresh-2026-10-12/plan.md:152, 292
- **Detail**: The §4 unit row says "10 files, 284 tests", which matches `npx vitest run` (10 files, 284 tests). `npx vitest list` prints 149 entries over the same 10 files, so the checked criterion "Test counts in the unit row match `npx vitest list`" is literally false; the number is right, the stated method is not.
- **Fix**: Amend plan.md success criterion 2.5 and its Progress row to say `npx vitest run`, so the next refresh measures the same way.
- **Decision**: FIXED — plan.md :111, :152, :249 and Progress 2.5 now name `npx vitest run` (10 files, 284 tests)

### F5 — §4 AI-native cell misstates hook order and budget

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/foundation/test-plan.md:72
- **Detail**: "ESLint on the edited file, then `vitest related <file> --run` … 50 s budget under the hook's 60 s timeout". In `scripts/agent-hooks/hooks.json` lint and related-tests are two separate `PostToolUse` hooks (timeouts 30 s and 60 s), which Claude Code runs in parallel; the 50 s budget applies to the vitest hook only. The cell is also ~150 words and repeats the §6.5 Phase 5 note almost verbatim, where the schema wants a short "when NOT to use".
- **Fix**: Replace "then" with "and, as a separate hook," and say the 50 s/60 s budget is the related-tests hook's; optionally trim the mechanics to a pointer to §6.5.
- **Decision**: FIXED — §4 cell now names two separate per-edit hooks with their own budgets (lint 25 s/30 s, related tests 50 s/60 s)

### F6 — Phase 4 note still says row 4 "moves to complete when archived"

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/foundation/test-plan.md:162
- **Detail**: The change is archived (`context/archive/2026-10-11-testing-csp-artifact-check/`) and §3 row 4 already reads `complete`; the sentence is stale, the same class of text the refresh removed elsewhere.
- **Fix**: Drop "; §3 row 4 moves to `complete` when the change is archived".
- **Decision**: FIXED — stale "row 4 moves to complete" clause dropped from the §6.5 Phase 4 note

### F7 — Strategy sections well over the schema's length budget; Stryker caveat repeated

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/test-plan.md:65–103
- **Detail**: The schema budgets §1–§5 at 300–600 words. They were ~1,890 before this change and are ~2,380 now; §4 grew from ~346 to ~667 words, mostly the hook and mutation rows. The Vitest 5 runner false-result caveat appears in §4 (:71), §5 (:92) and §6.1 (:117), plus PROJECT_RULES.
- **Fix**: Keep the caveat once in §4 and point to it from §5 and §6.1 (they already say "§4"; drop the restated explanation), and move hook mechanics out of the §4 cell into §6.5 (see F5).
  - Strength: Fewer copies of a fact that will change when the runner is fixed.
  - Tradeoff: Trimming prose already reviewed by the maintainer.
  - Confidence: MED — the budget was already exceeded before this change, so this only stops further growth.
  - Blind spot: Whether the maintainer treats the schema budget as binding.
- **Decision**: FIXED — §4 AI-native cell trimmed to a pointer plus "When NOT to use"; per-edit and end-of-turn mechanics and budgets now live only in the §6.5 Phase 5 Landed bullet

### F8 — §6.3 "one golden file per shipped version" vs one per slice at 0.1

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/test-plan.md:127, 130
- **Detail**: The bullet heading says "per shipped version", but the next bullet has S-06 and S-07 each add a golden file while the version stays `"0.1"`; "add one hand-written golden file" does not say one in total or one per slice, nor how to name it. The roadmap says one per slice.
- **Fix**: Say one golden file per slice, named after the version and the field set (e.g. `project-file-0.1-weekdays.json`), and reword the heading to "Golden file per shipped version or field set".
- **Decision**: FIXED — §6.3 heading now "per shipped version or field set"; lifting bullet says one golden file per slice, named `project-file-0.1-weekdays.json` (S-06) and `project-file-0.1-statuses.json` (S-07)

### F9 — §5 introduces a `never a gate` Required value

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/test-plan.md:91–92
- **Detail**: The schema's §5 lists gates that must pass, with Required? values `required` / `required after §3 Phase N` / `recommended` / `optional`. The two new rows (agent-hook tests, mutation testing) use `never a gate`, which no parser reads but which lists non-gates in the gates table. The plan's Contract asked for exactly this, so it is deliberate.
- **Fix**: Accept as deliberate (the plan specified it), or switch both to `optional` and keep "never a gate" in Catches.
- **Decision**: FIXED — both §5 rows now `optional`, with "never a gate" leading their Catches cell
