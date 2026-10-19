<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Invariant Aggregate Refactor

- **Plan**: context/changes/invariant-aggregate-refactor/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

Evidence re-run for this review: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` pass (17 files, 406 tests, CSP check on 2 pages); `npm run test:e2e` passes (6/6); `grep -rn "2_147_483_647" src` lists only `src/lib/services/project.ts:18`; the only `ok: true` in `project.ts` is in `accept` (`:67`); `checkName`, `isPositiveWholeDays` and `isIsoDate` are called only from the rule list; a temporary `as CheckedProject` in `Planner.tsx` and in `useProject.ts` fails lint (probed through `eslint --stdin`, no file changed). No `ProjectInvariantBreach` is reachable from an edit, an import or the go-back path: import's shape stage (`normalise`, `checkUniqueIds`) establishes everything `assertModelShape` checks before `checkProject` runs. Nothing in "What We're NOT Doing" was built.

## Findings

### F1 — The cast ban misses qualified, aliased and wrapped casts

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: eslint.config.js:94
- **Detail**: The selector `:matches(TSAsExpression, TSTypeAssertion) > TSTypeReference.typeAnnotation[typeName.name='CheckedProject']` matches only the bare name as the direct cast type. Probed by `eslint --stdin` in `src/hooks/useProject.ts` and `ProjectControls.tsx`, these compile and are not flagged: `p as edits.CheckedProject` (`useProject.ts` already has `import * as edits`), `import { type CheckedProject as CP }` then `p as CP`, `type C = CheckedProject; p as C`, `p as CheckedProject | undefined`, `p as Readonly<CheckedProject>`, `[p] as CheckedProject[]`, and `({ ok: true, project: p }) as EditResult` (same for `ImportResult`). The plan's end state says a cast to `CheckedProject` outside `project.ts`, tests and `src/dev/**` fails `npm run lint`; the plan's own check (4.2) used the bare form only, so it passed.
- **Fix A ⭐ Recommended**: Widen the selector to any `CheckedProject`/`EditResult`/`ImportResult` reference inside a cast type, by name or qualified name, and ban renaming the import
  - Selector (verified by probe to catch every case above): `":matches(TSAsExpression, TSTypeAssertion) > .typeAnnotation :matches(TSTypeReference[typeName.name=/^(CheckedProject|EditResult|ImportResult)$/], TSTypeReference[typeName.right.name=/^(CheckedProject|EditResult|ImportResult)$/])"`, kept next to the existing direct-child selector, plus `ImportSpecifier[imported.name="CheckedProject"][local.name!="CheckedProject"]`.
  - Strength: Makes the plan's end-state sentence true for every spelling a reasonable author would reach for, including the namespace form already available in `useProject.ts`.
  - Tradeoff: A more complex selector to maintain; a local `type C = CheckedProject` alias and `as typeof x` still pass, so the seal stays best-effort.
  - Confidence: HIGH — probed against both files with no false positives on the current source.
  - Blind spot: Whether the wider `EditResult` match flags any legitimate existing `as EditResult` in non-test code (none found by the probe, but re-run `npm run lint` after the change).
- **Fix B**: Keep the selector and document its limits next to the spread limit
  - Strength: No config churn; the `CheckedProject` doc comment (`project.ts:49`) already admits a spread-forged Project, so this extends an accepted stance.
  - Tradeoff: The plan's end-state claim stays partly false, and the qualified form is one keystroke away in the hook.
  - Confidence: MED — relies on review discipline rather than a gate.
  - Blind spot: S-07 adds more edits and fixtures, which raises the chance of a cast slipping in.
- **Decision**: FIXED via Fix A — `eslint.config.js` now matches the three type names by plain or qualified name, as the cast type or nested in it, and bans renaming the `CheckedProject` import. Re-probed in `useProject.ts`: bare, qualified, union, `Readonly<>`, array, `as unknown as`, angle-bracket and `as edits.EditResult` casts and an aliased import are all flagged; `as edits.Project` is not. Full gate green.

### F2 — The property test's main oracle is the guardian's own rule list

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/project.property.test.ts:100
- **Detail**: Since Phase 3, `accept` returns `ok` only when `firstValidationError(candidate)` is undefined, and the test asserts `validateProject(result.project)` is undefined, which runs the same `firstValidationError`. That assertion can no longer fail: a rule dropped from `TASK_CHECKS`/`PROJECT_CHECKS` or a weakened `assertModelShape` would pass the property test. The plan asked Phase 3 to "strengthen the property test with the shape assertion"; the implementation changed only a comment and the `it` title (:88-90) and relies on `accept` throwing. "Input unchanged after a rejection" and "never throws" still give independent signal. The rules themselves stay pinned by the `validateProject` tables and the hook rejection table.
- **Fix**: After each accepted edit, also assert `parseProjectFile(serializeProject(result.project))` is ok and `toStrictEqual(result.project)`.
  - Strength: The file module's shape stage (`normalise`, `checkUniqueIds`, the id caps) is a second, independent implementation of the model shape and the ceiling, and the round-trip also pins the serializer for every reachable Project.
  - Tradeoff: Validation Error rules are still the shared rule list on both sides, so a dropped rule would still pass; slightly slower runs (300 runs × ≤40 edits).
  - Confidence: MED — independent for shape and serialization, not for rules.
  - Blind spot: Run time with the round-trip not measured; check it stays well under a second.
- **Decision**: FIXED — each accepted edit now also asserts `parseProjectFile(serializeProject(result.project))` `toStrictEqual` `{ ok: true, project: result.project }`. The property test passes (file 173 ms); full gate green.

### F3 — Mutation review ticked with no recorded result

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/invariant-aggregate-refactor/change.md
- **Detail**: Progress 5.5 is `[x]`. The local, gitignored `reports/mutation/mutation.html` (2026-10-19 20:19) covers `project.ts` with 85 Killed and 7 Survived, but neither the commit nor `change.md` records the mutated line range, the score, or how the 7 survivors were judged, so the review cannot be checked later.
- **Fix**: Add a `### Phase 5: mutation review` note to `change.md` with the line range, 85/7, and one line per survivor (equivalent, or not user-visible).
- **Decision**: FIXED — `change.md` Notes now holds the run and a verdict per survivor (5 equivalent, 1 unreachable from a `CheckedProject`). Survivor #33 (duplicate predecessor) is now killed by a new row in the guardian's model-shape table in `project.test.ts`, checked by applying the mutant by hand.

### F4 — Phase 3 manual criterion rewritten without a marker

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/invariant-aggregate-refactor/plan.md:208
- **Detail**: The "START date `2026-02-30`" panel step was replaced in place. The reason and the replacement coverage are stated in the same bullet and in `change.md` Notes, but unlike the Phase 2 note (`plan.md:123`) it has no "Changed during implementation (date)" marker, so the original criterion survives only in git history.
- **Fix**: Prefix the bullet's second sentence with "**Changed during implementation (2026-10-19):**".
- **Decision**: FIXED — `plan.md:208` now marks the dropped START date step as changed during implementation.

### F5 — Minor unannounced drift from the plan's contracts

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/project.ts:64; context/domain/glossary.md; context/foundation/test-plan.md
- **Detail**: `accept` gained a third parameter `wording = "edit"` so `checkProject` can reuse it, and explanations return `string | undefined` (a missing `cyclePathFor` path falls back to the rule list's message). `task-id-limit-reached` got its own "Task id limit" glossary row rather than going under Validation Error. `test-plan.md` gained two consistent lines beyond the planned `:124` change (§6.2 and §6.3). All are reasonable; none is recorded in the plan.
- **Fix**: Add one "Changed during implementation" line to the plan's Phase 3 §1 contract for the `accept` signature; leave the docs as they are.
- **Decision**: FIXED — `plan.md` Phase 3 §1 now records the `accept` signature and the `string | undefined` explanation as changed during implementation; the glossary and test-plan lines stay.

### F6 — "valid"/"invalid" in two test comments

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project.property.test.ts:29, src/lib/services/project.test.ts:81
- **Detail**: "Mostly valid names" and "built by hand so invalid values can be held". The glossary this change extended marks "valid/invalid project" as "don't call it", and PROJECT_RULES.md forbids "invalid" as a synonym for a Validation Error.
- **Fix**: Reword to "Mostly names the rules accept" and "built by hand so it can hold values that break a Validation Error rule".
- **Decision**: FIXED — both comments reworded as proposed.

### F7 — Commit 913852a has its body run into the subject

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: commit 913852a
- **Detail**: No blank line after the subject, so git's subject is "Seal the session's entry points with CheckedProject Phase 4 of invariant-aggregate-refactor, test-first where a test can lead." PROJECT_RULES.md asks for short imperative subjects.
- **Fix**: Leave history as is and rely on the PR's squash title, or reword it in an interactive rebase before pushing if the branch is not yet pushed.
- **Decision**: SKIPPED
