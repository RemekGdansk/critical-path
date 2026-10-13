<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Edit-Rejection Atomicity and the Withheld Forecast

- **Plan**: context/changes/testing-edit-rejection-atomicity/plan.md
- **Scope**: Phase 1 of 3
- **Reviewed phases**: 1
- **Date**: 2026-10-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Evidence

- Commit `2aa2087`: `package.json` (+3 devDependencies: jsdom ^30.1.2, @testing-library/react ^16.3.3, @testing-library/dom ^10.4.2), `package-lock.json` (42 packages added, none removed), `src/hooks/useProject.test.ts` (new), plan and change bookkeeping. `vitest.config.ts` unchanged; no production code changed.
- All 18 planned rows are present: cycle (message holds the path `1: A → 2: B → 1: A`), task-name ×4 via `renameTask` plus `createTask`, project-name ×4, Duration, START date, and `unknown-task` via each Task-addressed action, including an unknown predecessor. Each row asserts the rule, the message fragment, the absence of `/invalid|conflict|blocked/i`, `toBe` and `toStrictEqual` on the project, `selection`, `selectedTask` (`toBe`) and `replacements === 0`. A same-event case runs for every row.
- Automated criteria re-run: hook test 36/36; `npm test` 11 files / 320 tests; lint clean; `astro check` 0/0/0; `vitest related src/hooks/useProject.ts` selects the new file. No `act(...)` warnings on stderr.
- Manual criteria 1.6–1.8: the deliberate breaks were run in session; each went red (18, 18 and 36/36 failures) and was restored with `git checkout`.
- `npm audit` reports 4 vulnerabilities (fast-uri, http-cache-semantics, qs). None comes from the new dependencies: `npm ls` shows none under jsdom or Testing Library, and the phase's lockfile diff adds none of them. They predate this change.

## Findings

### F1 — Accepted-then-accepted in one event is not covered

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/hooks/useProject.test.ts:195
- **Detail**: Probe: deleting `latest.current = result.project;` from `apply` (`src/hooks/useProject.ts:57`) leaves all 36 tests green. The same-event case runs a rejected edit and then an accepted one, so `latest` never has to advance. The ref exists so that two accepted edits in one event (a rename committed on blur, then a click) never apply to a stale project. Losing it would silently drop the first edit. This is outside the plan's rejection scope, but it is this file's only uncovered path through `apply`.
- **Fix**: Add one case: inside one `act`, `setDuration(1, "6")` then `setDuration(2, "4")`; expect the project to `toStrictEqual` both domain edits applied in sequence.
- **Decision**: FIXED — added "two accepted edits in one event apply in sequence" (37/37 green; red with `latest.current = result.project;` removed, restored)
