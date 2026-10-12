# Test-Plan Refresh (2026-10-12) Implementation Plan

## Overview

Bring `context/foundation/test-plan.md` up to date with what landed since its last strategy review (2026-10-10): roadmap S-03's project file round-trip, Playwright E2E, the Claude Code agent hooks and Stryker. §3 Phase 3 is recorded as `complete`, delivered by S-03, and §3 Phase 5 as `complete`, delivered by the agent hooks; §1/§2 change only in their churn evidence; §4–§6 and §8 are corrected to match the repository; the residuals of risk #1–#3 that need features not yet built are written into the §6 cookbook. §3 Phase 2 (edit-rejection atomicity) remains the next rollout phase. Documentation only: no test, script or app code changes.

## Current State Analysis

The research (`context/changes/test-plan-refresh-2026-10-12/research.md`) is the baseline; its findings are not repeated here beyond what each phase needs.

- **§3 Phase 3 (#1–#3)** is `not started`, but S-03 proved its response guidance for format 0.1: hand-written golden file, exact export → import → re-export, `nextTaskId`, one rejection row per `ValidationErrorRule`, and the e2e cycle-import spec (research §1). Unproven only because the features are unbuilt: older-version import after the version bump, documented defaults for absent fields, round-trip of non-To-Do Statuses, completion dates and `weekdays`, the PRD Done-rule rejection rows; plus two minor untested browser branches (file > 5 MB, file read failure).
- **§3 Phase 5** is `not started`, but `scripts/agent-hooks/` (commit `8606e65`) runs `vitest related` on every edited JS/TS/Astro file and the whole suite plus `astro check` at end of turn. For planner-state files it finds no test until Phase 2 adds one that statically imports the hook (research §2).
- **§3 Phase 2** is still open: no hook-level (DOM) test, no DOM library installed (research §3).
- **§4/§5/§6** hold 19 stale or partial facts (research §4 table, rows 1–19).
- **The §3 parser** in `.claude/skills/10x-test-plan/SKILL.md` ("Phase 5 — Read the guide") routes to the first row whose Status is not `complete`, and accepts only the literals `not started`, `change opened`, `researched`, `planned`, `implementing`, `complete` (`.claude/skills/10x-test-plan/references/test-plan-schema.md`, §3). Any qualifier must go in the Change-folder cell or §6.5, never in the Status cell.
- **Refresh rule:** a refresh "never rewrites §1/§2 without explicit user direction" (SKILL.md, `--refresh` mode). Direction given in planning: evidence counts only.

## Desired End State

`test-plan.md` reads true against the repository on 2026-10-12: §3 shows Phases 1, 3, 4, 5 `complete` and Phase 2 `not started`, so `/10x-test-plan` routes to Phase 2; §4 and §5 describe the test base, gates and tools that exist, each with a fresh `checked:` date; §6.3 tells the next format change (S-06, S-07, the M-1 version bump) exactly what to add; §6.5 carries a note per newly closed phase and one refresh note; §8 is dated 2026-10-12. Verified by the Progress checks below and by running `/10x-test-plan --status`.

### Key Discoveries:

- `context/archive/2026-10-11-project-file-round-trip/plan.md` Progress is fully `[x]` (24 rows), so `project-file-round-trip` is a valid Change-folder value for a `complete` row.
- `scripts/agent-hooks/related-tests.ts:1-3` already cites "test-plan §3 Phase 5"; `scripts/agent-hooks/hooks.json` is the template merged into the gitignored `.claude/settings.local.json` (`hook-lib.ts:1-3`).
- `stryker.config.json:6` mutates `src/lib/services/**/*.ts` minus tests and `fixtures.ts`; `:8` `break: null`. The Vitest-runner false result still applies (research §4 row 11; PROJECT_RULES.md "Mutation testing").
- `e2e/` holds `seed.spec.ts`, `project-file.spec.ts`, `forecast-today.spec.ts`; the last covers the clock → forecast glue that §6.5's Phase 1 note handed to Phase 2.
- The golden-file test asserts both "imports to the hand-written project" and "is what `serializeProject` writes, byte for byte" (`src/lib/services/project-file.test.ts:150-170`); the second holds only while 0.1 is the current version (research §1, planning note).
- `scripts/csp/check-page.ts` emits violations numbered rule 1–7 (`:108-176`); §6.4's prose list was not re-audited against it (research Open Questions).

## What We're NOT Doing

- Writing or changing any test, script, config or app code (Phase 2 stays its own rollout change).
- Changing §2 risk wording, Impact/Likelihood ratings or Risk Response Guidance; changing §7.
- Editing `context/foundation/roadmap.md` (its S-06/S-07 Risk lines already require a golden file each; edits re-sync GitHub issues).
- Adding tests for the > 5 MB and file-read-failure import branches — recorded as residuals only.
- Bumping Vitest 5.0.3 → 5.0.4 (the plan says 5.0.x, which stays true).
- Fixing the stale path in the `scripts/csp/check-page.ts:6` comment (it cites `context/changes/testing-csp-artifact-check/plan.md`, now archived) — code, out of scope; noted for a later change.
- Adding a speculative §2 risk row for S-08's unexported-work data loss (feature unbuilt).

## Implementation Approach

Edit `test-plan.md` top to bottom in three passes, one commit each, so each diff covers one section group. Every new fact must trace to research.md or a file read during implementation; the §2 Source column stays evidence-only (directories with churn counts, never files). Status cells use only the parser literals. Markdown follows PROJECT_RULES: no hard line breaks inside paragraphs or bullets, table alignment left to `prettier --write`.

## Phase 1: Strategy evidence and rollout status

### Overview

Refresh the churn evidence in §1/§2 (counts only) and record §3 Phases 3 and 5 as complete, with the order rationale rewritten to match.

### Changes Required:

#### 1. Header and §1 hot-spot line

**File**: `context/foundation/test-plan.md`

**Intent**: Bump "Last updated" and replace the §1 hot-spot sentence with the 2026-10-12 scan, so likelihood evidence matches the scope the refresh used.

**Contract**: Header `> Last updated: 2026-10-12`. §1 last paragraph: scope `src/` (excluding `src/dev/`), `scripts/`, `e2e/`; 30-day churn `src/lib/services/` 36 file-changes, `src/components/planner/` 36, `src/styles/` 8, `scripts/agent-hooks/` 8, `src/components/ui/` 5, `src/pages/` 4, `src/hooks/` 4 (20 commits). Principles and the oracle sentence unchanged.

#### 2. §2 Source counts

**File**: `context/foundation/test-plan.md`

**Intent**: Update only the churn numbers cited as evidence; nothing else in §2 moves.

**Contract**: Row #4 Source `hot-spot dir src/lib/services/ (36 file-changes/30d)`; row #5 Source `hot-spot dirs src/components/planner/ (36/30d), src/hooks/ (4/30d)`. Risk text, Impact, Likelihood and every Risk Response Guidance cell byte-identical to before.

#### 3. §3 rows 3 and 5, and the order rationale

**File**: `context/foundation/test-plan.md`

**Intent**: Record that Phase 3 was delivered by S-03 and Phase 5 by the agent hooks, so the orchestrator routes to Phase 2; explain why in the rationale paragraph.

**Contract**: Row 3 Status `complete`, Change folder `project-file-round-trip`; row 3 Goal drops "(after roadmap S-03 merges)". Row 5 Status `complete`, Change folder `— (commit 8606e65)`. Rows 1, 2, 4 unchanged. The "Order rationale" paragraph states: Phase 3 was delivered by roadmap S-03, which adopted the #1–#3 guidance, and its residuals for unbuilt features are handed to S-06/S-07 and the M-1 version bump (§6.3, §6.5); Phase 5 was delivered by the agent hooks, whose planner-state half starts checking once Phase 2 adds a test importing the state hook; Phase 2 is therefore next. Only parser literals appear in Status cells.

### Success Criteria:

#### Automated Verification:

- Formatting passes: `npx prettier --check context/foundation/test-plan.md`
- §3 Status cells hold only parser literals and route to Phase 2: the first §3 row whose Status is not `complete` is row 2 (`not started`), and rows 1, 3, 4, 5 read `complete`
- §2 diff touches only the two Source cells: `git diff context/foundation/test-plan.md` shows no change to risk text, ratings or Risk Response Guidance rows
- No file anchor enters §2: the §2 Source cells cite directories only

#### Manual Verification:

- `/10x-test-plan --status` lists Phase 2 as the current phase and Phases 3 and 5 as `complete`
- The rewritten order-rationale paragraph reads correctly to the maintainer

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Stack and quality gates

### Overview

Make §4 and §5 describe the test base, tools and gates that exist today, each tool line with a 2026-10-12 `checked:` date.

### Changes Required:

#### 1. §4 Stack table

**File**: `context/foundation/test-plan.md`

**Intent**: Correct the rows research marked stale or partial (research §4 rows 2–12) and add the missing mutation row.

**Contract**:

- **unit:** test base 10 files, 284 tests in `npm test` — 8 domain files in `src/lib/services/` (incl. `smoke.test.ts`), 1 component render (`ForecastSummary.test.ts`), 1 build tooling (`scripts/csp/check-page.test.ts`); discovery adds the `scripts/agent-hooks/**` exclusion; "today" is injected and the suite's time zone pinned to Europe/Warsaw (§6.1), replacing the `vi.setSystemTime` claim. Re-count at implementation time with `npx vitest run` and use the measured numbers.
- **integration (hooks):** unchanged ("none yet — see §3 Phase 2").
- **contract (file format):** Vitest + the committed golden file `src/lib/services/golden/project-file-0.1.json` and the rejection table in `src/lib/services/project-file.test.ts`, inside `npm test`; delivered by roadmap S-03; pattern §6.3. Version `n/a`.
- **built artifact:** re-dated (`parse5` 8.0.1 = latest); `checked: 2026-10-12`.
- **e2e:** adds `e2e/forecast-today.spec.ts` (local "today" and midnight rollover in the built app, the browser side of #4); version 1.64.x; `checked: 2026-10-12`.
- **accessibility:** re-dated only.
- **mutation (selective):** new row — Stryker (`@stryker-mutator/core` + `vitest-runner`) 10.0.x; `npm run test:mutation`, scope per `stryker.config.json`; selective on code touched by a change or by a §2 risk, never a gate; known false result with Vitest 5 (runner 10.0.0 runs no test, every mutant reported Survived; upstream stryker-js #6210; workaround in PROJECT_RULES "Mutation testing"); `checked: 2026-10-12`.
- **(optional) AI-native:** Claude Code agent hooks (`scripts/agent-hooks/`, template `hooks.json`, registered per machine in the gitignored `.claude/settings.local.json`) — per edit: lint + `vitest related` on every linted file, 50 s budget; end of turn: lint, whole `vitest run`, `astro check`, measured against a turn-start baseline; proven by `npm run test:hooks`. "When NOT to use" rewritten to the real limits: never a CI or deploy gate, only as good as the import graph (planner-state edits check nothing until §3 Phase 2), per-machine so a fresh clone has none. `checked: 2026-10-12`.

#### 2. §4 Stack grounding note

**File**: `context/foundation/test-plan.md`

**Intent**: Re-date the four grounding lines with what this refresh actually checked.

**Contract**: Docs — Context7 checked Vitest 5.0.3 (`vitest related`, per-file DOM environments), Stryker (`vitest-runner` options), Playwright 1.63 docs; checked 2026-10-12. Search — Exa available, not needed. Runtime/browser — `playwright-cli` skill wired for E2E (`context/foundation/test-stack.md`); Claude in Chrome for manual checks; drop "no Playwright MCP". Provider — Cloudflare MCP available, no gate role. All `checked: 2026-10-12`.

#### 3. §5 Quality Gates

**File**: `context/foundation/test-plan.md`

**Intent**: Mark the gates that are live as live and add the two never-a-gate rows (research §4 rows 13–17).

**Contract**:

- unit + integration: Required `required`; Catches "forecast and file-contract regressions; edit-rejection once §3 Phase 2 lands".
- golden-file contract tests: Required `required` (no longer "after §3 Phase 3").
- E2E: Catches adds the forecast's local "today" in the built app.
- post-edit hook → "agent hooks (per edit + end of turn)": Where `local (agent loop), per machine`; Required `recommended`; Catches forecast/file regressions at edit time, planner-state once §3 Phase 2 lands.
- New row: agent-hook tests (`npm run test:hooks`) — local, run by the end-of-turn hook when `scripts/agent-hooks/` changes; `never a gate`; catches a hook that stops reporting failures.
- New row: mutation testing (`npm run test:mutation`) — local, selective; `never a gate`; catches assertions too weak to notice a changed rule (subject to the known runner false result, §4).
- Gate-order paragraph unchanged (research confirmed it matches `ci.yml` and deploy-plan step 7).

### Success Criteria:

#### Automated Verification:

- Formatting passes: `npx prettier --check context/foundation/test-plan.md`
- The superseded clock claim is gone: `grep -n "setSystemTime controls" context/foundation/test-plan.md` finds nothing
- No live gate is still deferred to a done phase: `grep -nE "after §3 Phase (3|5)" context/foundation/test-plan.md` finds nothing
- Every §4 tool row with a version carries `checked: 2026-10-12`
- Test counts in the unit row match `npx vitest run` on the implementation commit

#### Manual Verification:

- §4 and §5 read as an accurate description of the current test base to the maintainer

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Cookbook, ledger and close-out

### Overview

Fill §6.3 from the S-03 pattern, add the mutation bullet to §6.1, re-check §6.4 against the checker, rewrite §6.5's refresh notes, and date §8.

### Changes Required:

#### 1. §6.1 mutation bullet

**File**: `context/foundation/test-plan.md`

**Intent**: Tell the next author of a domain test when and how to run Stryker, without duplicating PROJECT_RULES.

**Contract**: One bullet before "Run": optional, on the lines the change touched (`npm run test:mutation -- --mutate "path:start-end"`), review survivors one by one, add an assertion only for a user-visible or business-relevant mutant, never chase the score; a near-zero score is the known runner false result (§4), not weak tests — pointer to PROJECT_RULES "Mutation testing".

#### 2. §6.3 file-format change or new import rule

**File**: `context/foundation/test-plan.md`

**Intent**: Replace "TBD — see §3 Phase 3" with the pattern S-03 delivered, plus the rules the next format events need, so S-06, S-07 and the M-1 bump inherit them.

**Contract**: Bullets for:

- **Location / reference:** `src/lib/services/project-file.test.ts` next to `project-file.ts`; golden files in `src/lib/services/golden/`.
- **Golden file per shipped version:** hand-written, never generated by the exporter; Prettier-ignored (`.prettierignore`); read as raw bytes; compared with `toStrictEqual` to a hand-written expected project; expected next Task id asserted.
- **Round-trip:** `expectRoundTrip` — `toStrictEqual` on the project and `toBe` on the re-exported text, deep-frozen inputs, no normalizer; a new field gets a row in `fullProject()` or its own hand-built project.
- **Rejection table:** one row per `ValidationErrorRule` value, each asserting the rule, a message fragment and the no-synonym check (no "invalid/conflict/blocked"); file-shape rows separate. A new Validation Error (e.g. S-07's Done rules) adds its rows here and in the edit rules at once.
- **Lifting a not-supported-yet rejection** (S-06 `day-counting-mode-not-supported-yet`, S-07 `task-status-not-supported-yet`): replace the rejection rows with round-trip rows and add one hand-written golden file holding the new values next to the 0.1 one; the version stays `"0.1"` until M-1 closes.
- **Version bump** (`"0.1"` → `"1"` at M-1 close): the parser must still accept every shipped version; the byte-for-byte "is what `serializeProject` writes" assertion moves to the new version's golden file, and older golden files keep only their import assertions, so the bump does not read as a broken old-file test; absent fields in an older file get documented defaults, each with its own row.
- **Browser side:** `e2e/project-file.spec.ts` (round-trip across two contexts; cycle file rejected, current project unchanged); add an e2e case only for behaviour no unit test reaches (download, file picker, CSP).
- **Run:** `npx vitest run src/lib/services/project-file.test.ts`; `npm run test:e2e`.

#### 3. §6.4 re-audit

**File**: `context/foundation/test-plan.md`

**Intent**: Confirm §6.4's seven rule descriptions still match the violations `scripts/csp/check-page.ts` emits; correct the prose only where they differ.

**Contract**: Rule numbers and short names in §6.4 match the `rule N (short name)` strings in `check-page.ts:108-176`. No change if they already match.

#### 4. §6.5 notes

**File**: `context/foundation/test-plan.md`

**Intent**: Fold the two obsolete "For the next `--refresh`" bullets into §4 (done in Phase 2), correct what Phase 1 handed to Phase 2, and add notes for Phases 3 and 5 and for this refresh.

**Contract**:

- Phase 1 note: "Left to §3 Phase 2" keeps only the stale/memoized forecast after an edit; the clock → forecast glue is marked covered by `e2e/forecast-today.spec.ts` (commit `ed0ba7e`). Its "For the next `--refresh`" bullet is removed.
- Phase 4 note: its "For the next `--refresh`" bullet is removed.
- New **§3 Phase 3 — Project file contract** note (delivered by roadmap S-03, change `project-file-round-trip`, 2026-10-11): what landed (golden 0.1, exact round-trip incl. the 100-Task generated project, `nextTaskId`, one rejection row per `ValidationErrorRule`, e2e round-trip and cycle-import); handed off to S-06/S-07 and the M-1 bump: older-version import, absent-field defaults, Status/completion-date/`weekdays` round-trip, Done-rule rejection rows (pattern §6.3); untested minor branches: file > 5 MB, file read failure.
- New **§3 Phase 5 — Agent-loop feedback** note (delivered outside the rollout by commit `8606e65`, 2026-10-11): what the hooks do, per-machine registration, `npm run test:hooks`; the planner-state half checks nothing until §3 Phase 2 adds a test that statically imports the state hook (`vitest related` follows static imports only), and needs no hook change then.
- New **Refresh 2026-10-12** note: scope and trigger (S-03, E2E, hooks, Stryker); no §2 risk raised or retired, §7 unchanged; watch for the next refresh: roadmap S-07 (Done rules, indirect-edit rejections) raises #5; S-08 (confirm before New project or Import replaces unexported work) adds a data-loss scenario once built — not a risk row yet.

#### 5. §8 Freshness Ledger

**File**: `context/foundation/test-plan.md`

**Intent**: Record that strategy, stack and AI-native references were all reviewed today.

**Contract**: All three dates `2026-10-12`; refresh triggers unchanged.

### Success Criteria:

#### Automated Verification:

- Formatting passes: `npx prettier --check context/foundation/test-plan.md`
- No placeholder is left for a delivered phase: `grep -n "TBD — see §3 Phase 3" context/foundation/test-plan.md` finds nothing, and §6.2 still reads "TBD — see §3 Phase 2"
- The obsolete refresh notes are gone: `grep -n "For the next \`--refresh\`" context/foundation/test-plan.md` finds nothing
- §6.4's rule numbers and short names match the `rule N (…)` strings in `scripts/csp/check-page.ts`
- Every path cited in §4–§6 exists on disk
- §8 shows 2026-10-12 on all three lines

#### Manual Verification:

- §6.3 is enough for someone planning roadmap S-07 to know which golden file and which rejection rows to add, and what moves at the version bump
- Asking a fresh agent session "Read PROJECT_RULES.md and `context/foundation/test-plan.md`. What should I test first for a new import rule, and why?" yields §6.3, `project-file.test.ts` and the unit layer

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None added or changed. `npm test` must stay green, which it will since no code changes; the Phase 2 count check runs `npx vitest run` only to measure.

### Manual Testing Steps:

1. Run `/10x-test-plan --status` and confirm Phase 2 is the current phase.
2. Read §3–§6 against `research.md` §4's 19-row table and confirm each row is addressed or deliberately left (row 5 still valid; row 9 re-dated only).
3. Run the fresh-session smoke question from Phase 3.

## References

- Research: `context/changes/test-plan-refresh-2026-10-12/research.md`
- Refresh brief: `context/changes/test-plan-refresh-2026-10-12/change.md`
- Guide schema and §3 parser: `.claude/skills/10x-test-plan/references/test-plan-schema.md`, `.claude/skills/10x-test-plan/SKILL.md` (Phase 5, `--refresh` mode)
- S-03 archive: `context/archive/2026-10-11-project-file-round-trip/plan.md` (`:49` adopts #1–#3 guidance; `:58`, `:62` leave §6.3 to Phase 3; `:299` golden file per S-06/S-07)
- Agent hooks: `scripts/agent-hooks/hooks.json`, `related-tests.ts`, `end-of-turn.ts`, `hook-lib.ts`
- Mutation: `stryker.config.json`, PROJECT_RULES.md "Mutation testing"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Strategy evidence and rollout status

#### Automated

- [x] 1.1 Formatting passes: `npx prettier --check context/foundation/test-plan.md` — 95cdffe
- [x] 1.2 §3 Status cells hold only parser literals and route to Phase 2 — 95cdffe
- [x] 1.3 §2 diff touches only the two Source cells — 95cdffe
- [x] 1.4 No file anchor enters §2 — 95cdffe

#### Manual

- [x] 1.5 `/10x-test-plan --status` lists Phase 2 as current and Phases 3 and 5 as `complete` — 95cdffe
- [x] 1.6 The rewritten order-rationale paragraph reads correctly to the maintainer — 95cdffe

### Phase 2: Stack and quality gates

#### Automated

- [x] 2.1 Formatting passes: `npx prettier --check context/foundation/test-plan.md` — 95cdffe
- [x] 2.2 The superseded clock claim is gone — 95cdffe
- [x] 2.3 No live gate is still deferred to a done phase — 95cdffe
- [x] 2.4 Every §4 tool row with a version carries `checked: 2026-10-12` — 95cdffe
- [x] 2.5 Test counts in the unit row match `npx vitest run` — 95cdffe

#### Manual

- [x] 2.6 §4 and §5 read as an accurate description of the current test base — 95cdffe

### Phase 3: Cookbook, ledger and close-out

#### Automated

- [x] 3.1 Formatting passes: `npx prettier --check context/foundation/test-plan.md` — 95cdffe
- [x] 3.2 No placeholder is left for a delivered phase; §6.2 still TBD — 95cdffe
- [x] 3.3 The obsolete refresh notes are gone — 95cdffe
- [x] 3.4 §6.4's rule numbers and short names match `scripts/csp/check-page.ts` — 95cdffe
- [x] 3.5 Every path cited in §4–§6 exists on disk — 95cdffe
- [x] 3.6 §8 shows 2026-10-12 on all three lines — 95cdffe

#### Manual

- [x] 3.7 §6.3 is enough to plan S-07's golden file, rejection rows and the version-bump move — 95cdffe
- [x] 3.8 A fresh agent session routes a new import rule to §6.3 and the unit layer — 95cdffe
