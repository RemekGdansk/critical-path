# Invariant Aggregate Refactor — Plan Brief

> Full plan: `context/changes/invariant-aggregate-refactor/plan.md`
> Upstream design: `context/domain/02-invariant-aggregate-refactor.md`

## What & Why

The PRD's strictest Guardrail is that a project never contains a Validation Error, "directly or indirectly" (`prd.md:66`, FR-019). Today it holds only as a sum of local checks: each edit checks the one rule it knows it can break, import runs a second checker, and the session accepts replaced, restored and initial Projects on trust. That stops working with roadmap S-07, whose Done rules are indirect by nature. This change makes the Project aggregate the single guardian of the whole resulting state before S-07 lands.

## Starting Point

`accept` in `src/lib/services/project.ts` accepts any project it is given. `validateProject` runs only on import. `useProject`'s `replaceProject` trusts its caller by a comment. The id ceiling exists only in the file module, so a Task created at the cap exports a file that cannot be re-imported (DR-06).

## Desired End State

Every edit builds a candidate, and `accept` checks it against one rule list (per-Task checks, then whole-Project checks). A rule written once is therefore enforced on every edit and on import, with the same messages users see today. The session, the import result and the forecast hold `CheckedProject` only, so an unchecked Project cannot reach them by type. At the id ceiling, `createTask` is refused with a named Validation Error.

## Key Decisions Made

| Decision                   | Choice                                                                                                                  | Why (1 sentence)                                                                                             | Source   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Invariant to own           | I-01 "never a Validation Error", via a guardian `accept`                                                                | Fixes the structure once, so S-07's Done rules become list entries instead of checks in five functions.      | Upstream |
| Scope                      | Upstream Phases 0–4 (plan Phases 1–5); Done rules stay in S-07                                                          | Closes RK-01, RK-05 and RK-06 in one change without taking on S-07's rule work.                              | Plan     |
| Id ceiling (Q-06)          | `createTask` refuses with new rule `task-id-limit-reached`                                                              | Raising the cap only moves the edge; a user can reach it, so it is a rejected edit, not a breach.            | Plan     |
| `today` in edit signatures | Deferred to S-07                                                                                                        | No rule reads it yet; avoids an unused parameter threaded through ~130 call sites.                           | Plan     |
| Property-test tool         | fast-check (dev only), fixed seed; no outcome snapshot                                                                  | Shrinking yields the shortest failing edit sequence; the existing message tables already pin behaviour.      | Plan     |
| Brand reach                | `EditResult`, `ImportResult`, `useProject` doors, `forecast`; ESLint cast ban outside `project.ts`, tests, `src/dev/**` | Seals every way into the session and the one reader that relies on the rules, with a small ripple.           | Plan     |
| Spread-forged brand        | Document the limit; no runtime registry                                                                                 | `{ ...project, tasks }` keeps the brand, but a registry would add mutable module state and still be partial. | Plan     |
| Rule list shape            | Two lists: `TASK_CHECKS` per Task, then `PROJECT_CHECKS`                                                                | Keeps today's first-error order, which tests pin; S-07's Done rules are per-Task.                            | Plan     |
| Rejected edit vs bug       | `{ ok: false, error }` for users; thrown `ProjectInvariantBreach` for a broken model shape                              | Callers are event handlers that show the message; a shape fault is a code bug and must surface at once.      | Upstream |

## Scope

**In scope:**

- A property test over random edit sequences (fast-check)
- One rule list with edit and file wording; `assertModelShape`; `ProjectInvariantBreach`
- A guardian `accept` for every edit, with the local rule checks removed
- `CheckedProject`, `checkProject`, `toCheckedProject`, typed doors, an ESLint cast ban and type tests
- The id ceiling in the aggregate, the new rule `task-id-limit-reached`, and updates to the test-plan process line and the glossary

**Out of scope:**

- The Done rules, `setStatus`, `setCompletionDate` and removing `checkSupportedYet` (S-07)
- `today` on edits, the hook or the guardian (S-07)
- A runtime checked-Project registry, and branding the diagram, warnings or view readers
- The crash screen's unchecked export (DR-01), and duplicate ids as a Validation Error (Q-05)

## Architecture / Approach

Edit (addressing + parsing) → candidate Project → `accept`: `assertModelShape` (throws on a code bug) → `TASK_CHECKS` for each Task, then `PROJECT_CHECKS`, in edit wording → the edit may reword the found rule (only the cycle path) → `{ ok: true, project: CheckedProject }` or `{ ok: false, error }`. Import ends in `checkProject` (the same lists, file wording). Because the Project before an edit already passed the guardian, any error in the candidate came from that edit, directly or indirectly.

## Phases at a Glance

| Phase                          | What it delivers                                                        | Key risk                                             |
| ------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| 1. Safety net                  | A property test green on today's code                                   | Generators too narrow to reach the interesting edits |
| 2. One rule list               | Per-Task and whole-Project lists behind the unchanged `validateProject` | Changing the first-error order                       |
| 3. accept becomes the guardian | Every edit decided by the guardian; local checks gone; perf measured    | Edit messages drifting from today's wording          |
| 4. Seal the entry points       | `CheckedProject` at every door; cast ban; type tests                    | Type ripple through fixtures and test helpers        |
| 5. Id ceiling and docs         | `task-id-limit-reached`; the cap in one module; test-plan and glossary  | A new user-visible rule the PRD does not list        |

**Prerequisites:** branch `invariant-aggregate-refactor` at or after `3b309b7`; full gate green before starting.
**Estimated effort:** ~3–4 sessions across 5 phases (Phase 4 is the most mechanical, touching about 12 test helpers).

## Open Risks & Assumptions

- The brand is a type-level seal only: a spread-forged Project compiles. Review S-08's New and any later caller of `replaceProject` for it.
- `task-id-limit-reached` is a Validation Error the PRD does not list. It is reachable only through a hand-edited file at the cap.
- The guardian's cost per edit is assumed small (linear, the same work as one import). Phase 3 measures it before relying on it.

## Success Criteria (Summary)

- Users see exactly the same rejections and messages as today, on every edit and on import.
- A property test shows that random edit sequences never leave the Project holding a Validation Error.
- S-07 can add each Done rule as one list entry, with no code in `setStartDate` or `addPredecessor`.
