# Reject Invalid Dependencies — Plan Brief

> Full plan: `context/changes/reject-invalid-dependencies/plan.md`

## What & Why

Roadmap slice S-02 (US-01, FR-003, FR-019): a user who tries to add a predecessor that would close a cycle is refused, the project stays unchanged, and the message names the cycle — "Adding 3: C as a predecessor of 1: A would create the cycle 1: A → 2: B → 3: C → 1: A." It comes before the north star (S-03) so that import reuses this same cycle check instead of a second one that could disagree.

## Starting Point

S-01 already keeps cycles out of the project, silently: the picker hides every cycle-closing Task (`eligiblePredecessors`), and `addPredecessor` keeps a defensive rejection with a generic message. The yes/no `wouldCreateCycle` cannot report a path or find a cycle in a loaded project. START/FINISH violations are unrepresentable: START and FINISH are not Tasks.

## Desired End State

Selecting A in START → A → B → C → FINISH, the picker offers "3: C (would create a cycle)"; pressing Add shows the message naming A → B → C → A, and nothing changes. A whole-project `findCycle` exists for S-03 import and provably agrees with the per-edge check. The picker is disabled only when no other Task can be offered.

## Key Decisions Made

| Decision                    | Choice                                                                   | Why (1 sentence)                                                                          |
| --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| How the user "tries"        | Offer cycle-closing Tasks with "(would create a cycle)"; Add is refused  | Meets MVP step 3 literally, warning before the attempt and explaining after it            |
| Which cycle to name         | Shortest; lexicographically smallest ids on a tie                        | Deterministic, short and linear-time; other paths are not listed                          |
| Label format in the message | "N: Name", the picker's label, defined once in the domain                | Duplicate names (FR-001) stay distinguishable and match what the picker shows             |
| START/FINISH rules          | Stay unrepresentable; S-03 adds their import-time checks with the format | PRD FR-003 Socrates and FR-009 note: impossible in the UI, checks on imported files       |
| Scope of follow-up F1       | Path-reporting cycle check only (`cyclePathFor` + `findCycle`)           | Gives S-03 the shared rule check without speculative id/name invariants before the format |
| Candidate computation (F4)  | One linear pass flags descendants                                        | Replaces an O(n·(n+e)) per-render cost while the panel is open                            |
| Message wording             | "Adding X as a predecessor of Y would create the cycle Y → … → X → Y."   | Names the rule and the cycle; avoids "invalid", "conflict" and "blocked" per domain terms |

## Scope

**In scope:** `cyclePathFor`, `findCycle`, `predecessorCandidates` in `task-graph.ts`; exported `taskLabel` and the new cycle message in `project.ts`; picker offering flagged candidates with the error and disabled-note behaviour; kitchen-sink fixture and captions; unit tests including a 100-Task cross-check.

**Out of scope:** START/FINISH rules (S-03 import); `validateProject`, `checkTaskName` export and id invariants (S-03); naming every cycle; highlighting the cycle on the diagram; selectable START/FINISH (S-04); drawing edges (FR-018); component tests.

## Architecture / Approach

Pure domain first: one successor relation feeds the per-edge path search (shortest path from the Task to the proposed predecessor), the whole-project search (ascending-id depth-first, rotated to the lowest id) and the candidate flags (descendants of the Task). `addPredecessor` turns the path into the message with `taskLabel`; `useProject` already commits only accepted edits, so the UI change is limited to what the picker offers and how the error clears.

## Phases at a Glance

| Phase                                | What it delivers                                                        | Key risk                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Path-reporting cycle check        | Cycle path, whole-project check, flagged candidates, new message, tests | Tie-breaking: BFS alone does not give the lexicographically smallest path  |
| 2. Picker offers, flags and explains | MVP step 3 works in the UI; kitchen sink cells stay truthful            | A refused option must stay selected and the error must clear on a new pick |

**Prerequisites:** S-01 done (it is); no new dependencies.
**Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- US-01 AC2 (START/FINISH "rejected with an explanation") is not demonstrable in the UI until S-03 adds import checks; this follows the PRD's own resolution.
- A long cycle of long names (up to 200 characters each) makes a long message; it wraps in the 320 px panel and is not truncated.
- The picker now offers options that always fail; the suffix is the only advance warning.

## Success Criteria (Summary)

- A user trying C → A in the MVP flow is refused with the message naming A → B → C → A, and the project stays unchanged.
- The edit-time cycle check and the whole-project `findCycle` agree on every pair of Tasks of the 100-Task fixture.
- The full gate passes and the built preview shows no CSP errors.
