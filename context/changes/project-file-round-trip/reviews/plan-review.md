<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Project File Round-Trip Implementation Plan

- **Plan**: context/changes/project-file-round-trip/plan.md
- **Mode**: Deep
- **Date**: 2026-10-11
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

11/11 existing paths ✓ (`playwright.config.ts` and `.prettierignore` correctly absent: the plan creates them), 7/7 symbols ✓, brief↔plan ✓, Progress↔Phase ✓ (24/24 items).

Verified against the code: `findCycle` returns `[a, a]` for a Task that is its own predecessor and skips ids that point to no Task; `topologicalOrder` throws on a cycle or on duplicate ids, and `addDays` throws on a malformed date; `Diagram` refits only when `taskIdsKey` changes; `apply` and `latest` work the way the Export sequencing assumes; nothing switches over `ValidationErrorRule`; `tsconfig` includes `**/*`, so `e2e/` and `playwright.config.ts` get type-checked and linted with types; running Prettier on an ignored directory exits 0, and the 0.1 shape is already Prettier-stable.

## Findings

### F1 — Name-rule errors repeat the bad name in the label

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §2 — validateProject contract
- **Detail**: `taskLabel(task)` is `${id}: ${name}` (`project.ts:44`), so for the four name rules the prefix holds the name the rule just rejected. An empty name gives "Task 3: : A Task name cannot be empty.", a line break or lone surrogate ends up inside the `role="alert"` text, and an over-long name is repeated in full.
- **Fix**: For the four `task-name-*` rules, prefix with "Task <id>" only. Keep `taskLabel` for the Duration, unknown-task and cycle messages.
- **Decision**: FIXED

### F2 — E2E test 2 depends on test 1's download

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 §2 — Export and import tests
- **Detail**: Test 2 imports "that file", the one test 1 downloaded. That breaks the CLAUDE.md hard rule that each test runs standalone. With Playwright's parallel workers or a `--grep` run, test 2 has no file.
- **Fix**: Test 2 builds its own project, exports it in context A and imports it into a new context B, all inside one test.
- **Decision**: FIXED

### F3 — Edge cases the import rules don't decide

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 — Parse and version rules; Normalisation
- **Detail**: A lower version (`"0.0"`) is neither accepted nor newer. `"00.1"` and `"0.01"` equal 0.1 as integers but are not exactly `"0.1"`. For a project name of `"   "`, the plan doesn't say whether trimming runs before the `"" → absent` rule.
- **Fix**: Accept only the exact string `"0.1"`. A well-formed `major.minor` that is greater gives `file-version-newer`. Any other string, lower or written differently, gives `file-not-a-project`. Trim the project name first, then treat `""` as absent. Rejection and normalisation rows are added for these cases.
- **Decision**: FIXED

### F4 — Phase 4's new dependency and test-plan row not mentioned

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §1; criterion 2.4
- **Detail**: `/10x-e2e-setup` adds the `@playwright/test` devDependency, but criterion 2.4 ("no new dependency") reads as if it covers the whole slice. Row e2e of `test-plan.md` §3 still says "none / Not planned".
- **Fix**: Phase 4 names `@playwright/test` as the one devDependency this slice adds, scopes 2.4 to Phase 2, and updates the test-plan e2e row (unless `/10x-e2e-setup` already did).
- **Decision**: FIXED

### F5 — Unclear where the name draft lives for Export

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §3–§4
- **Detail**: Export reads the name draft, but Planner was told to key "ProjectControls' name field" by `replacements`. A parent can only key a component it renders itself. If the field is a separately keyed child, Export, which sits in `ProjectControls`, cannot read the child's draft.
- **Fix**: Planner keys the whole `<ProjectControls key={replacements}>`. A successful import clears its alert anyway, so the draft and Export stay in one component.
- **Decision**: FIXED
