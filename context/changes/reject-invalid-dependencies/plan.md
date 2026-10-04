# Reject Invalid Dependencies Implementation Plan

## Overview

Deliver roadmap slice S-02 (US-01, FR-003, FR-019): a user who tries to add a predecessor that would close a cycle is refused, the project stays unchanged, and the message names the cycle — for the PRD's MVP step 3, "Adding 3: C as a predecessor of 1: A would create the cycle 1: A → 2: B → 3: C → 1: A." The predecessor picker stops hiding cycle-closing Tasks: it offers them with a "(would create a cycle)" suffix, so the user can actually try the edit and read why it is refused. The cycle search that produces the path also runs over a whole project (`findCycle`), so S-03 import reuses the same rule check instead of writing a second one that could disagree.

## Current State Analysis

S-01 already keeps cycles out of the project, but silently and in two places that do not explain anything:

- The picker withholds every Task that would close a cycle: `eligiblePredecessors` (`src/lib/services/task-graph.ts:34-42`) filters candidates through `wouldCreateCycle`, and `TaskPanel` builds its options from it (`src/components/planner/TaskPanel.tsx:57`, `:189-193`). A user can never try C → A, so MVP step 3 and US-01 cannot be exercised.
- `addPredecessor` keeps a defensive rejection (`src/lib/services/project.ts:110-112`) with a generic message, "Adding this predecessor would create a cycle." — no path.
- `wouldCreateCycle` (`task-graph.ts:10-27`) answers yes/no for one proposed edge. It cannot report a path and cannot find a cycle already present in a loaded project, which S-03 import needs (S-01 follow-up F1, `context/archive/2026-09-27-capture-task-graph/follow-ups/review-fixes.md:7-13`).
- `eligiblePredecessors` calls `wouldCreateCycle` once per candidate, rebuilding the predecessor map each time: O(n·(n+e)) per render of the panel (follow-up F4, `review-fixes.md:17-19`).
- START with a predecessor and a Task depending on FINISH are unrepresentable: START and FINISH are not Tasks and a Task's `predecessors` hold Task ids only (`src/types.ts:1-3`, `:19-20`); neither node is selectable nor offered in the picker.
- The Task label "7: Name" that tells same-named Tasks apart lives privately in the view (`TaskPanel.tsx:27-30`).
- The dev kitchen sink's "disabled" cell relies on Design having no eligible predecessor (`src/dev/KitchenSinkPlanner.tsx:34-35`, `src/dev/kitchen-sink.astro` "disabled" figure). Once cycle-closing Tasks are offered, Design's picker is no longer disabled.

## Desired End State

- With START → A → B → C → FINISH, selecting A shows "2: B (would create a cycle)" and "3: C (would create a cycle)" in "Add predecessor". Picking 3: C and pressing Add shows "Adding 3: C as a predecessor of 1: A would create the cycle 1: A → 2: B → 3: C → 1: A." under the picker; the diagram, the predecessor list and the project are unchanged.
- When a predecessor closes several cycles, the message names the shortest one, preferring the lowest ids on a tie.
- `findCycle(project)` returns a cycle already present in a project, or `undefined`; a test proves it agrees with the per-edge check, and the picker's cycle flag agrees with both, on every pair of Tasks of the 100-Task fixture.
- The picker is disabled only when no other Task can be offered (no other Task exists, or every other Task is already a predecessor), with a note saying which.
- START/FINISH rules stay unrepresentable in the UI; their import-time checks, and the rest of S-01 follow-up F1, are recorded in the S-03 roadmap entry (Phase 2 §4).

Verify with the full gate (`npm run lint && npx astro check && npm test && npm run build`) and the MVP step 3 walkthrough under `npm run build && npm run preview`.

### Key Discoveries:

- Every edit is a pure function returning `EditResult`; `useProject.apply` commits only `ok` results (`src/hooks/useProject.ts:40-47`), so a rejection already leaves the project unchanged — S-02 changes only the message and what the picker offers.
- `TaskPanel` already renders the predecessor error as `<p role="alert">` (`TaskPanel.tsx:205-209`) and resolves a stale picked value to the placeholder (`:61-63`); the picked value now stays valid for cycle-closing Tasks too.
- The PRD itself says START/FINISH path problems "cannot arise in a project inside the app; they remain Validation Error checks applied to imported files" (`context/foundation/prd.md:157`), and FR-003's Socrates resolution accepts making them "impossible to break in the UI" (`prd.md:132`).
- The existing termination test for dangling ids and pre-existing cycles (`src/lib/services/task-graph.test.ts:47-61`) is the import-time scenario; it carries over to the new functions.
- The 100-Task fixture `createPerfProject` (`src/lib/services/fixtures.ts:20`) is built through the edit functions, so it is acyclic and usable for the cross-check.

## What We're NOT Doing

- START/FINISH rules in the UI or the domain: they stay unrepresentable (FR-003 Socrates). S-03 adds their import-time Validation Errors together with the file format, where a hand-edited file can actually express them.
- The rest of follow-up F1 — `validateProject`, an exported `checkTaskName`, dangling-predecessor and id invariants (`nextTaskId`, unique ids, sorted predecessors). S-03 composes those with `findCycle` once the file format exists.
- Naming every cycle, or counting the other paths, when one edge closes several.
- Highlighting the cycle on the diagram.
- Making START or FINISH selectable (S-04 makes START selectable for its date).
- Drawing dependencies on the diagram (FR-018, parked).
- Component or browser tests — Vitest covers pure domain logic only (`PROJECT_RULES.md` Testing).

## Implementation Approach

Domain first, UI second. Phase 1 replaces the yes/no cycle check with a path-reporting one in `src/lib/services/task-graph.ts`, adds the whole-project `findCycle` beside it, and computes picker candidates with their cycle flag in one linear pass. `addPredecessor` builds its message from the path using the shared `taskLabel`, so the message and the picker label Tasks identically. The view keeps working unchanged through a thin `eligiblePredecessors` kept for one phase. Phase 2 switches the picker to offer, flag and explain, deletes the transitional function, and updates the kitchen sink fixtures so every state cell stays honest.

## Critical Implementation Details

**Cycle direction and choice.** "A → B" means A is a predecessor of B. Adding `predecessorId` P to `taskId` T adds the edge P → T; the cycle it closes is a path T → … → P along successor edges, followed by T. Among the shortest such paths, the one whose id sequence is lexicographically smallest is named — BFS with ascending neighbours alone does not guarantee that, so compute distances to P first and then walk forward from T taking the lowest-id successor that is one step closer (or an equivalent method). Diamond 1 → 2, 1 → 3, 2 → 4, 3 → 4, adding 4 as a predecessor of 1, names `[1, 2, 4, 1]`.

## Phase 1: Path-reporting cycle check

### Overview

The domain names the cycle a refused predecessor would close, can find a cycle in a whole project, and offers picker candidates with a cycle flag. No user-visible change except the wording of a rejection the current UI cannot reach.

### Changes Required:

#### 1. Cycle path for a proposed predecessor

**File**: `src/lib/services/task-graph.ts`

**Intent**: Replace the yes/no `wouldCreateCycle` with a function that returns the cycle a proposed predecessor would close, so the rejection can name it.

**Contract**: `cyclePathFor(project: Project, taskId: TaskId, predecessorId: TaskId): TaskId[] | undefined`. Returns `undefined` when making `predecessorId` a predecessor of `taskId` closes no cycle. Otherwise returns the closed path `[taskId, …, predecessorId, taskId]` in dependency direction: the shortest path from `taskId` to `predecessorId` along successor edges, lexicographically smallest by id on a tie, with `taskId` appended. `predecessorId === taskId` returns `[taskId, taskId]`. Linear in Tasks plus dependencies; terminates on dangling predecessor ids and on a project that already holds a cycle. `wouldCreateCycle` is removed.

#### 2. Cycle in a whole project

**File**: `src/lib/services/task-graph.ts`

**Intent**: Give S-03 import the same rule check over a loaded project, built on the same successor relation as the per-edge check.

**Contract**: `findCycle(project: Project): TaskId[] | undefined`. Returns `undefined` for an acyclic project; otherwise one closed path `[a, …, a]` in dependency direction, rotated to start and end at its lowest id. Deterministic: depth-first over Tasks in ascending id order, following successors in ascending id order, returning the first cycle closed. A self-dependency returns `[a, a]`. Predecessor ids that match no Task are ignored (they are S-03's unknown-id rule). Linear in Tasks plus dependencies.

#### 3. Picker candidates with a cycle flag

**File**: `src/lib/services/task-graph.ts`

**Intent**: One linear pass gives the picker every Task it may offer and which of them would close a cycle (follow-up F4), replacing per-candidate cycle checks.

**Contract**: `interface PredecessorCandidate { task: Task; closesCycle: boolean }` and `predecessorCandidates(project: Project, taskId: TaskId): PredecessorCandidate[]` — every Task except `taskId` and its current predecessors, in ascending id order; `closesCycle` is true exactly for the Tasks reachable from `taskId` along successor edges (its descendants). Empty when `taskId` is not in the project. `eligiblePredecessors` stays for this phase only, re-implemented as the candidates with `closesCycle === false`, so `TaskPanel` keeps working until Phase 2 deletes it.

#### 4. Shared Task label and the cycle message

**File**: `src/lib/services/project.ts`, `src/components/planner/TaskPanel.tsx`

**Intent**: Name the cycle in the rejection using the same "N: Name" label as the picker, so same-named Tasks stay distinguishable, and define that label once.

**Contract**: Export `taskLabel(task: Task): string` returning `` `${task.id}: ${task.name}` `` from `project.ts`; `TaskPanel` imports it and drops its private copy. `addPredecessor` uses `cyclePathFor`; on a path it rejects with rule `"cycle"` and message `Adding <label of predecessor> as a predecessor of <label of Task> would create the cycle <labels of the path joined by " → ">.` — e.g. "Adding 3: C as a predecessor of 1: A would create the cycle 1: A → 2: B → 3: C → 1: A." and, for itself, "Adding 1: A as a predecessor of 1: A would create the cycle 1: A → 1: A." The order of checks in `addPredecessor` is unchanged (unknown ids, then existing predecessor, then cycle). `ValidationError`'s shape is unchanged.

#### 5. Tests

**File**: `src/lib/services/task-graph.test.ts`, `src/lib/services/project.test.ts`

**Intent**: Pin the path choice, the whole-project check, the candidates and the exact message, and prove the edge check and the whole-project check agree.

**Contract**: See Testing Strategy. The existing `wouldCreateCycle` and `eligiblePredecessors` cases move to `cyclePathFor` and `predecessorCandidates`; the existing `addPredecessor` message assertion (`project.test.ts:212`) changes to the new text.

### Success Criteria:

#### Automated Verification:

- Domain tests pass, including the new `cyclePathFor`, `findCycle`, `predecessorCandidates` and cross-check cases: `npm test`
- `grep -rn wouldCreateCycle src` returns nothing
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build`

#### Manual Verification:

- In `npm run dev`, adding and removing predecessors and deleting Tasks behave exactly as before (the picker still hides cycle-closing Tasks until Phase 2)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Picker offers, flags and explains

### Overview

The user can try a cycle-closing predecessor: the picker offers it with a warning suffix, Add is refused with the message naming the cycle, and the project stays unchanged. The kitchen sink shows the new states.

### Changes Required:

#### 1. Predecessor picker

**File**: `src/components/planner/TaskPanel.tsx`

**Intent**: Offer every candidate, flag the ones that would close a cycle, and let Add show the domain's explanation, so MVP step 3 and US-01 can be exercised.

**Contract**:

- Options come from `predecessorCandidates(project, task.id)` (memoized on `project` and `task.id` as now); a cycle-closing option's text is `` `${taskLabel(candidate.task)} (would create a cycle)` ``. Ascending id order, placeholder "Choose a Task…" unchanged.
- Add calls `addPredecessor` as now. On rejection the message shows in the existing `role="alert"` paragraph and the picked option stays selected, so the user sees which Task was refused; on success the picker resets to the placeholder as now.
- The predecessor error clears when the user picks another option, on any successful add or remove, and on a successful rename of the Task (the message would otherwise show its old label).
- The select's `aria-describedby` points at the error paragraph while it shows, and at the note while the picker is disabled.
- The picker and Add are disabled only when there are no candidates. The note reads "No other Task exists yet." when the project holds only this Task, and "No Task is available: every other Task is already a predecessor." otherwise.

#### 2. Remove the transitional query

**File**: `src/lib/services/task-graph.ts`, `src/lib/services/task-graph.test.ts`

**Intent**: Nothing uses `eligiblePredecessors` any more; leave one query for picker candidates.

**Contract**: `eligiblePredecessors` and its tests are deleted.

#### 3. Kitchen sink states

**File**: `src/dev/KitchenSinkPlanner.tsx`, `src/dev/kitchen-sink.astro`

**Intent**: Keep every state cell truthful now that Design's picker is no longer disabled, and show how to reach the cycle explanation.

**Contract**: The `no-eligible-predecessor` fixture is replaced by `only-task`: a project with the single Task "Design", selected. The "disabled" cell uses it, and its caption says the only Task is selected so Add predecessor and Add are disabled and the note says why. The "error" cell's action adds: pick "3: Test (would create a cycle)" and press Add — "Adding 3: Test as a predecessor of 2: Build would create the cycle 2: Build → 3: Test → 2: Build." shows under the picker. The "default" cell's caption still holds (Build selected). The `selected-task` fixture's comment becomes "Build selected: one predecessor to remove, one Task to add and one that would create a cycle."

#### 4. Hand S-03 what this slice defers

**File**: `context/foundation/roadmap.md`

**Intent**: Make S-03 planning start from what S-02 leaves to it, instead of from an archived follow-up file.

**Contract**: The S-03 entry's **Risk** line gains one sentence: import must compose `findCycle` with the START/FINISH Validation Errors (START with a predecessor, a Task depending on FINISH) and with the rest of S-01 follow-up F1 (`context/archive/2026-09-27-capture-task-graph/follow-ups/review-fixes.md`): exported `checkTaskName`, unknown predecessor ids, unique Task ids, no duplicate or unsorted predecessors, and `nextTaskId` above every Task id. No other roadmap field changes.

### Success Criteria:

#### Automated Verification:

- `grep -rn "eligiblePredecessors\|no-eligible-predecessor" src` returns nothing
- `grep -n "findCycle" context/foundation/roadmap.md` finds the S-03 entry
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build`

#### Manual Verification:

- MVP step 3 under `npm run build && npm run preview`: create A, B, C and set A → B, B → C; select A; the picker shows "2: B (would create a cycle)" and "3: C (would create a cycle)"; pick 3: C and press Add; the message reads "Adding 3: C as a predecessor of 1: A would create the cycle 1: A → 2: B → 3: C → 1: A."; A's predecessor list, the diagram and every Task are unchanged
- After the rejection, picking another option clears the message; adding a predecessor that closes no cycle succeeds and resets the picker
- Two Tasks named "Review" in a cycle are told apart in the message by their "N: " prefixes
- With a single Task, the picker and Add are disabled and the note reads "No other Task exists yet."; with every other Task already a predecessor, the note reads "No Task is available: every other Task is already a predecessor."
- `npm run dev` → `/kitchen-sink`: the "disabled" cell shows the single selected Task with the disabled picker and its note; following the "error" cell's action shows the Build → Test cycle message
- In `npm run dev` with `?fixture=perf100`, a successful Add and a refused Add on a cycle-closing candidate each finish rendering in under 200 ms in the React Profiler
- Browser console under `npm run preview` shows zero CSP violations or errors during the whole flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `task-graph.test.ts` — `cyclePathFor`: self → `[2, 2]`; direct (diamond, adding 2 as a predecessor of 1 → `[1, 2, 1]`); transitive (adding 4 to 1 → `[1, 2, 4, 1]`, the lowest-id one of two equal-length paths); a longer path loses to a shorter one regardless of ids (e.g. 1 → 9 → 3 beside 1 → 2 → 5 → 3, adding 3 to 1 → `[1, 9, 3, 1]`); unrelated, ancestor and sibling → `undefined`; terminates and stays correct on a dangling predecessor id and on a project that already holds a cycle.
- `task-graph.test.ts` — `findCycle`: acyclic diamond → `undefined`; two-Task cycle → rotated to start at its lowest id; self-dependency → `[a, a]`; two disjoint cycles → the one the ascending-id search closes first; a dangling predecessor id is ignored.
- `task-graph.test.ts` — `predecessorCandidates`: excludes the Task and its current predecessors; flags exactly its descendants (diamond: Task 1 → 2, 3, 4 flagged, 5 not); ascending numeric id order (2 before 10); empty for an unknown Task.
- `task-graph.test.ts` — cross-check on `createPerfProject()`: for every ordered pair of Task ids (t, p) where p is not already a predecessor of t, `cyclePathFor(project, t, p) !== undefined` exactly when `findCycle` of the project with p added to t's predecessors is not `undefined`; every returned path starts and ends at t and each consecutive pair is a dependency in that extended project; and for every Task t, each of `predecessorCandidates(project, t)` has `closesCycle` exactly when `cyclePathFor(project, t, candidate.task.id) !== undefined`, so the picker's suffix and the Add rejection never disagree.
- `task-graph.test.ts` — the no-mutation test calls the new queries on frozen input.
- `project.test.ts` — `addPredecessor` on A → B → C rejects C as a predecessor of A with rule `cycle` and the exact MVP message; self rejection message; two Tasks named "Review" in a cycle produce id-prefixed labels; every rejection leaves the input deep-equal (existing pattern); `taskLabel` returns "7: Name".

### Manual Testing Steps:

1. `npm run build && npm run preview`; create A, B, C; set A → B and B → C in the panel.
2. Select A; confirm B and C carry "(would create a cycle)"; pick C, press Add; read the message; confirm nothing changed on the diagram or in the list.
3. Pick another option; the message clears. Create D, add D as a predecessor of A; it succeeds.
4. Create a single-Task project (reload) and confirm the disabled note.
5. Walk the kitchen sink "disabled" and "error" cells.

## Performance Considerations

`predecessorCandidates` replaces an O(n·(n+e)) computation with one O(n+e) pass, recomputed only when the project or the selected Task changes. `cyclePathFor` runs once per Add. Both stay well inside the 200 ms NFR at 100 Tasks; the Phase 2 manual check confirms it on the perf fixture.

## Migration Notes

None: no persisted data exists yet (S-03 introduces the file).

## References

- Roadmap: `context/foundation/roadmap.md` (S-02, and its risk note on S-03 reusing the rule check)
- PRD: `context/foundation/prd.md` — MVP flow step 3, US-01, FR-003, FR-009 note, FR-019
- S-01 follow-ups F1 and F4: `context/archive/2026-09-27-capture-task-graph/follow-ups/review-fixes.md`
- S-01 plan (FR-003 split with S-02): `context/archive/2026-09-27-capture-task-graph/plan.md:33`
- Current cycle check: `src/lib/services/task-graph.ts:10-42`; rejection: `src/lib/services/project.ts:105-116`; picker: `src/components/planner/TaskPanel.tsx:57-63`, `:170-209`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Path-reporting cycle check

#### Automated

- [x] 1.1 Domain tests pass, including the new `cyclePathFor`, `findCycle`, `predecessorCandidates` and cross-check cases: `npm test` — efced48
- [x] 1.2 `grep -rn wouldCreateCycle src` returns nothing — efced48
- [x] 1.3 Full gate passes: `npm run lint && npx astro check && npm test && npm run build` — efced48

#### Manual

- [x] 1.4 In `npm run dev`, adding and removing predecessors and deleting Tasks behave exactly as before (the picker still hides cycle-closing Tasks until Phase 2) — efced48

### Phase 2: Picker offers, flags and explains

#### Automated

- [x] 2.1 `grep -rn "eligiblePredecessors\|no-eligible-predecessor" src` returns nothing — 46e5765
- [x] 2.2 `grep -n "findCycle" context/foundation/roadmap.md` finds the S-03 entry — 46e5765
- [x] 2.3 Full gate passes: `npm run lint && npx astro check && npm test && npm run build` — 46e5765

#### Manual

- [x] 2.4 MVP step 3 under `npm run build && npm run preview`: create A, B, C and set A → B, B → C; select A; the picker shows "2: B (would create a cycle)" and "3: C (would create a cycle)"; pick 3: C and press Add; the message reads "Adding 3: C as a predecessor of 1: A would create the cycle 1: A → 2: B → 3: C → 1: A."; A's predecessor list, the diagram and every Task are unchanged — 46e5765
- [x] 2.5 After the rejection, picking another option clears the message; adding a predecessor that closes no cycle succeeds and resets the picker — 46e5765
- [x] 2.6 Two Tasks named "Review" in a cycle are told apart in the message by their "N: " prefixes — 46e5765
- [x] 2.7 With a single Task, the picker and Add are disabled and the note reads "No other Task exists yet."; with every other Task already a predecessor, the note reads "No Task is available: every other Task is already a predecessor." — 46e5765
- [x] 2.8 `npm run dev` → `/kitchen-sink`: the "disabled" cell shows the single selected Task with the disabled picker and its note; following the "error" cell's action shows the Build → Test cycle message — 46e5765
- [x] 2.9 In `npm run dev` with `?fixture=perf100`, a successful Add and a refused Add on a cycle-closing candidate each finish rendering in under 200 ms in the React Profiler — 46e5765
- [x] 2.10 Browser console under `npm run preview` shows zero CSP violations or errors during the whole flow — 46e5765
