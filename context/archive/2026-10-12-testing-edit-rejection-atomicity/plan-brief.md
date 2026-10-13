# Edit-Rejection Atomicity and the Withheld Forecast — Plan Brief

> Full plan: `context/changes/testing-edit-rejection-atomicity/plan.md`
> Research: `context/changes/testing-edit-rejection-atomicity/research.md`

## What & Why

Rollout Phase 2 of the test plan covers two High-impact risks. #5: an edit rejected as a Validation Error still leaves the planner's state partly changed, or shown as changed. #6: a Project Finish Date, or a stale one, stays visible while a Validation Warning exists. The domain already refuses bad edits and withholds the forecast, but nothing tests the React glue that turns those results into what the user sees.

## Starting Point

`useProject.apply` (`src/hooks/useProject.ts:54-61`) is the single commit point, and no test imports it. The forecast is memoised in `Planner` (`Planner.tsx:57`), which no test renders. Vitest runs in Node only; jsdom and Testing Library are not installed. The domain's no-mutation guarantee and the static `ForecastSummary` render are already tested.

## Desired End State

`npm test` includes two jsdom test files. A hook table proves that every edit-reachable rejection leaves the project (same reference, deep-equal), the selection and the replacement counter unchanged, and names its rule. A `Planner` render proves dates → withheld (no date, node warned) → new dates, and that a rejected Duration changes no committed view. Each check has been seen red under a deliberate break. The test plan's §6.2 holds the pattern, and `vitest related` now selects these tests on edits to the hook and the planner.

## Key Decisions Made

| Decision                  | Choice                                                                                                           | Why (1 sentence)                                                                                                          | Source   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| DOM tooling               | jsdom + `@testing-library/react` + `@testing-library/dom`; `fireEvent`, no user-event; per-file env comment      | Smallest set giving `renderHook`, `render` and `findBy*`; jsdom is what the React Flow shim targets; Node tests untouched | Plan     |
| #5 edit kinds             | Edit-reachable set: cycle, Task name, project name, Duration, START date, unknown id (per Task-addressed action) | START-predecessor and depending-on-FINISH cannot come from an edit and are covered by the import contract                 | Research |
| #5 layer                  | `renderHook(useProject)` on a deep-frozen fixture, real domain, no mocks                                         | The gap is `apply` itself; views render from `project` only                                                               | Research |
| #5 view half              | One `Planner` case: rejected Duration `"0"`, node and dates unchanged                                            | A per-rule matrix at view level would repeat the hook table at higher cost                                                | Research |
| #6 layer                  | `Planner` render, not a hook check                                                                               | The hook never computes the forecast, so only `Planner` can see a stale memo                                              | Research |
| Stale-memo detection      | START `2999-01-01`; restore the cleared Duration with a different value (dates 2999-01-06/09 → 2999-01-08/11)    | A replayed forecast fails, and the clock read in `Planner` cannot affect the expected dates                               | Research |
| React Flow under jsdom    | Documented shim; if no nodes render, size a test wrapper explicitly and keep the node assertions                 | The FR-009 highlight belongs to the same rule as the withheld forecast                                                    | Plan     |
| Corrections and hand-offs | Test plan only (§2 cells, §3, §4, §6.2, §6.5); remaining-work times handed to roadmap S-05; roadmap untouched    | One source of truth for the test strategy                                                                                 | Plan     |

## Scope

**In scope:**

- Dev dependencies for jsdom and Testing Library
- `src/hooks/useProject.test.ts` and `src/components/planner/Planner.test.ts`
- Deliberate breaks 1–5, each red then green
- Test-plan §2/§3/§4/§6.2/§6.5 updates and one `PROJECT_RULES.md` Testing sentence

**Out of scope:**

- Any production code change
- Import-only rules (START predecessor, depending on FINISH)
- Remaining-work times (S-05)
- S-07 compound rejections
- user-event, happy-dom, Vitest `setupFiles`/`projects`, new e2e specs, fake timers

## Architecture / Approach

The hook test calls actions through `renderHook` on the real domain and asserts identity, deep equality, selection and the counter after each rejection, plus one rejected-then-accepted pair inside one `act` to cover the `latest` ref. The `Planner` test renders the real island with React Flow's shim, selects Task A via `initialSelection`, drives the Duration field with `fireEvent.change` + `blur`, and reads the forecast's `role="status"` region and the node's accessible name.

## Phases at a Glance

| Phase                                 | What it delivers                                                   | Key risk                                                             |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1. DOM harness + `useProject` table   | jsdom toolset; every edit-reachable rejection proven atomic        | Type-checked lint rules on async Testing Library calls               |
| 2. `Planner` withheld/restored render | No stale or visible date while warned; rejected Duration not shown | React Flow not rendering nodes in jsdom (spike first, sized wrapper) |
| 3. Test plan and project rules        | §6.2 pattern, corrected §2 guidance, Phase 2 note, rules sentence  | Docs drifting from what the tests actually do                        |

**Prerequisites:** none beyond `npm install` access to the npm registry.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- React Flow under jsdom inside `Planner`'s unsized flex layout has not been run; the spike decides whether a sized wrapper is needed.
- jsdom startup adds time to the per-edit `vitest related` run (50 s budget); Phase 2 verifies it.
- React Flow may add its own live region, so the forecast's `role="status"` must be singled out unambiguously.

## Success Criteria (Summary)

- A regression in `apply` (unconditional commit, early `latest` advance, selection or counter change) turns `npm test` red.
- A narrowed forecast memo or swapped withheld branch turns `npm test` red.
- The next planner-state test can follow §6.2 without rediscovering the harness.
