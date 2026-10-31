<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Critical Path Highlight (round 3, after the rebase onto S-08)

- **Plan**: context/changes/critical-path-highlight/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-31
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations
- **Previous rounds**: `reviews/impl-review-round-1.md` (7 findings, all fixed) and `reviews/impl-review-round-2.md` (5 fixed, 1 accepted). This round reviews the branch rebased onto `main` 34f564c, which now holds S-08 (`start-new-project`), and the post-rebase commit b7f6cbd.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence on HEAD b7f6cbd. The six targeted Vitest files pass (108 tests). `npx astro sync && npm run lint && npx astro check && npm test && npm run build && npm run check:csp` pass (463 tests, 0 errors, CSP check passed on 2 pages). `npm run test:e2e` passes 8/8, including S-08's `unexported-changes` and `render-crash` specs. `startDay + duration` appears in one non-test line. The built CSS holds every critical-path rule. The diff against `main` is empty for `Planner.tsx`, `useProject.ts`, `ProjectControls.tsx`, `RenderCrashFallback.tsx`, `project-file.ts` and the golden files.

The files both slices touched merged coherently:

- `glossary.md`: S-05's three rows and S-08's two, no duplicates;
- `global.css`: `--critical-path` and S-08's `--overlay` side by side in `:root`, `.dark` and `@theme inline`;
- `Planner.test.ts`: every S-05 assertion and S-08 test present;
- `roadmap.md`: S-05 `in-progress` and S-08 `done`, plus the S-07 Unknown.

How S-05 and S-08 interact:

- S-08's recovery paths stay outside what S-05 can throw from. The render-crash fallback, Export and "Go back to the project before the last change" call neither `remainingWork` nor `projectDiagram`.
- S-08's `markExported` changes no memo key.
- Playwright's substring name matching keeps every e2e Task lookup valid, and the e2e absence checks use anchored regexes.
- b7f6cbd is correct fixture by fixture: A is the only critical Task in the base fixture, before and after the edit to 7 days, and "Imported" in the imported file. Its three `toBeNull()` checks are meaningful again.

Out of S-05's scope, noted for whoever owns them:

- Export always commits `setProjectName`, which returns a new project object, so the forecast memo, and with it `remainingWork`, re-runs on every Export (negligible at 100 Tasks; S-03/S-08 code).
- The kitchen sink has no cell with `ConfirmDialog` open (S-08).
- The roadmap's S-08 Risk line still says New/Import/Go back happen "in one click" (S-08's text on `main`).

Manual Progress rows are all checked. Rows 3.3 and 3.5 were re-checked by the user in the preview build after round 2.

## Findings

### F1 — Test plan's example Task name is no longer a real name

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:116
- **Detail**: §6.2, the `Planner` render pattern that new jsdom tests copy, gives `findByRole("button", { name: "A, 5 days" })` as its example. In the fixture it refers to, A is critical, so its real name is "A, 5 days, on the critical path". Copied into a `queryByRole(…).toBeNull()` check, the example passes vacuously, which is exactly the bug b7f6cbd had to fix in S-08's tests after the rebase. Phase 3 asked for the test plan to stay true once the highlight exists.
- **Fix**: Change the example to `"A, 5 days, on the critical path"`, and add that an absence check should match a name prefix (`/^A, /`) so it cannot pass vacuously.
- **Decision**: FIXED — §6.2 example now uses "A, 5 days, on the critical path" and says absence checks match an anchored name prefix

### F2 — S-08's tests depend on the critical-path wording

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/Planner.test.ts:358-512
- **Detail**: b7f6cbd made the unexported-changes tests look Tasks up by their full critical-path names ("A, 5 days, on the critical path", "Imported, 2 days, on the critical path"). Those 10 tests are not about the critical path, but the next change to that wording, or to which Task is critical, would break them. `e2e/unexported-changes.spec.ts` avoids the coupling with `/^Imported,/`.
- **Fix**: In the S-08 describe, look Tasks up with anchored prefix regexes (`/^A, 5 days/`, `/^A, 7 days/`, `/^Imported, 2 days/`). Keep the exact critical-path names in the "forecast follows the committed project" describe, which is where they are being tested.
- **Decision**: FIXED — S-08 describe uses anchored prefixes: presence lookups `/^A, 5 days/`, `/^A, 7 days/`, `/^Imported, 2 days/`; the three absence checks `/^A, /` and `/^Imported, /` (any name of that Task); 20/20 Planner tests pass

### F3 — Plan's Parallel work section predates the rebase

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/critical-path-highlight/plan.md:59-64
- **Detail**: The section still says this change "runs alongside S-08", and the addendum lists only the three original `Planner.test.ts` tests. S-08 has merged (34f564c), the branch was rebased with one manual roadmap conflict, and b7f6cbd added the suffix to 10 lookups in S-08's describe.
- **Fix**: Append one addendum sentence recording the rebase onto 34f564c, how the roadmap conflict was resolved, and b7f6cbd.
- **Decision**: FIXED — rebase addendum under Parallel work: 34f564c, roadmap conflict resolution, b7f6cbd and the F2 prefix lookups

### F4 — "Throws on a cycle" holds only without a Validation Warning

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/remaining-work.ts:66, src/lib/services/diagram.ts:251
- **Detail**: Both doc comments say the function throws on a cycle. `remainingWork` returns `withheld` before it calls `topologicalOrder` when a Validation Warning exists, so a cyclic project with a missing Duration renders without throwing. This is not a regression (the old `forecast()` behaved the same way), and every cyclic fixture has all its Durations, but the comments overstate it.
- **Fix**: Change both to "Throws … on a cycle, unless the schedule is withheld for a Validation Warning".
- **Decision**: FIXED — both doc comments now say the throw happens unless the schedule is withheld for a Validation Warning

## Triage summary

- Fixed: F1, F2, F3, F4 (4)
- After triage, `npx astro sync && npm run lint && npx astro check && npm test && npm run build && npm run check:csp && npm run test:e2e` pass (463 unit tests, 8 e2e tests).
