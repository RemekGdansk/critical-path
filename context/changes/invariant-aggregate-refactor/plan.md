# Invariant Aggregate Refactor Implementation Plan

## Overview

Make the Project aggregate (`src/lib/services/project.ts`) the only place that decides whether a Project is acceptable, and make it decide on the whole resulting Project, never on the edit. `accept`, already the only producer of an accepted `EditResult`, becomes the guardian: every edit builds a candidate, the guardian checks it against one rule list, and only a candidate with no Validation Error is returned. A `CheckedProject` type then closes the session's entry points. This is the PRD Guardrail "a project never contains a Validation Error" (`prd.md:66`) and FR-019's "directly or indirectly" (`prd.md:158`), done before roadmap S-07 so the Done rules become list entries instead of checks written into five functions.

Upstream design: `context/domain/02-invariant-aggregate-refactor.md` (invariant I-01, ranking items RK-01, RK-05, RK-06 of `context/domain/01-domain-distillation.md`). This plan implements its Phases 0–4 (here numbered 1–5); its Phase 5 (the Done rules) stays S-07's first step.

## Current State Analysis

- Every edit checks only the rule it knows it can break, then calls `accept` (`src/lib/services/project.ts:36-38`), which accepts any project: `createTask` and `renameTask` call `checkName` (`:137`, `:149`), `setProjectName` (`:209`), `setDuration` checks digits and `isPositiveWholeDays` (`:240`), `setStartDate` checks `isIsoDate` (`:254`), `addPredecessor` uses `cyclePathFor` as the verdict (`:179`). `deleteTask`, `removePredecessor` and `setDayCountingMode` check nothing about the result.
- `validateProject` (`:278-307`) is a second, import-only checker. No edit calls it. It reports the first error Task by Task (name, Duration, predecessor ids, for each Task in array order), then the START date, the project name and last the cycle; `src/lib/services/project.test.ts:555-573` pins that order. Its messages carry a `Task N:` prefix that the edit messages do not (`"Task 3: A Task name cannot be empty."` vs `"A Task name cannot be empty."`).
- The import pipeline (`src/lib/services/project-file.ts:369-379`) establishes the model shape (normalise `:323-339`, unique ids `:343-347`), holds the not-yet-built Done rules vacuously (`checkSupportedYet`, `:351-367`), then calls `validateProject`. The id ceiling `MAX_NEXT_TASK_ID` (`:251-255`) is known only here; `createTask` has none (`project.ts:140-141`), so a Task created at the cap exports a file that cannot be re-imported (DR-06).
- The session trusts three inputs: `replaceProject` takes any `Project` "that `parseProjectFile` accepted" by comment (`src/hooks/useProject.ts:25-29`, `:123-130`), `restorePreviousProject` re-commits by induction (`:134-140`), and the initial project is any `Project` (`:56-57`; `Planner` prop `src/components/planner/Planner.tsx:33`, `:64`; the kitchen sink `src/dev/KitchenSinkPlanner.tsx:121`).
- `forecast()` relies on the Done rules by comment (`src/lib/services/forecast.ts:76-80`).
- The edit path itself is sound: `apply` commits only `ok` results, as one value, through `latest` (`useProject.ts:72-86`).

## Desired End State

- `accept` is the only producer of `{ ok: true }`, and it runs the guardian on the whole candidate. An edit holds only addressing (`unknown-task` for a missing Task id), input parsing (trim; Duration text is ASCII digits) and, for a cycle, the wording of the message. The verdict is always the guardian's.
- One rule list in `project.ts`: per-Task checks, then whole-Project checks. `validateProject`, every edit and import all use it. A new rule is one entry there.
- Every rejected edit returns the same rule id and the same message as today. The hook rejection table (`src/hooks/useProject.test.ts:56`) and every message assertion in `project.test.ts` pass unchanged.
- `EditResult`, `ImportResult`, `useProject` (initial, `replaceProject`, `previousProject`) and `forecast` carry `CheckedProject`. A plain `Project` there fails `npx astro check`. Casting to `CheckedProject` outside `project.ts`, `*.test.ts` and `src/dev/**` fails `npm run lint`.
- At the id ceiling, `createTask` is rejected with the new Validation Error `task-id-limit-reached`, and `2_147_483_647` appears in one module.
- A property test applies random edit sequences and holds: after each accepted edit the Project has no Validation Error and the model shape holds; after each rejected edit the input is unchanged.

Verify with `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`, plus `npm run test:e2e` (the import alert text in `e2e/project-file.spec.ts:192` must not change).

### Key Discoveries:

- Error order is per Task, not per rule: `project.test.ts:563-569` expects Task 1's Duration error before Task 2's name error. A flat list of whole-Project checks (`taskNames, durations, …`, as sketched in §4.3 of the upstream design) would break it. The list is therefore two lists: per-Task checks run Task by Task, then whole-Project checks. S-07's five Done rules are all per-Task.
- A `unique symbol` brand survives object spread (checked with `tsc` 6.0.3): `take({ ...checked, tasks: [] })` compiles where `take` wants the brand. The type seal stops plain Projects and casts, not a spread-forged Project. Decided: document the limit, add no runtime registry.
- Two fixtures are deliberately cyclic and must keep reaching the view unchecked: `cyclicProject` (`src/components/planner/Planner.test.ts:156`) and `renderCrashProject` (`src/dev/KitchenSinkPlanner.tsx:85`). So the seal is by type only, never a runtime check in `useProject`, and the cast ban exempts `*.test.ts` and `src/dev/**`.
- Every other fixture is built through edits (`src/lib/services/fixtures.ts:21`, `KitchenSinkPlanner.tsx:37-75`), so it comes out checked once the edits return `CheckedProject`. `createEmptyProject` returns `CheckedProject` too, so S-08's New needs no cast.
- `no-restricted-syntax` is already configured for `src/components/planner/**` (`eslint.config.js:81-92`). A later flat-config block replaces a rule's options instead of merging them (the reason for the comment at `eslint.config.js:96`), so the cast-ban selector must be added to that block as well as to a new `src/**` block.
- Import's shape stage rejects `nextTaskId` above the cap before the guardian runs (`project-file.ts:311`, messages at `project-file.test.ts:652-669`), so `task-id-limit-reached` is reachable only by `createTask`.

## What We're NOT Doing

- The Done rules, `setStatus`, `setCompletionDate`, and removing `checkSupportedYet`. That is roadmap S-07's first step (upstream Phase 5).
- A `today` argument on edits (`EditContext`), on the hook (`options.today`) or on the guardian. Deferred to S-07, where the first rule reads it.
- A runtime registry of checked Projects. A spread-forged `CheckedProject` (`{ ...project, tasks }`) still compiles. The `CheckedProject` doc comment states this limit.
- Branding the other readers (`diagram`, `validationWarnings`, `topologicalOrder`, views, `serializeProject`). They keep `Project`; a checked one still fits. The readers' tolerance of unknown ids (`src/lib/services/task-graph.ts:2-3`) stays, since the guardian runs them on unchecked import candidates.
- Changing the crash screen's export of an unchecked Project (DR-01) or the `topologicalOrder` backstop throw (`task-graph.ts:177-178`).
- Moving duplicate Task ids into the guardian (Q-05). They stay a file rule (`duplicate-task-id`).
- A test-only rule seam in production code. The proof that every edit reaches the guardian uses a forged Project in a test instead.
- A seeded `(ok, rule)` outcome snapshot. The existing message tables already pin behaviour.
- Editing the PRD or re-running `/10x-domain-distillation`. The domain map is refreshed by its own skill.

## Implementation Approach

Pin today's behaviour first with a property test, then restructure without changing behaviour: one rule list behind the unchanged `validateProject`, then route every edit through a guardian `accept` that reuses that list in edit wording. Only after behaviour is proven identical are the types tightened, so a type error never hides a behaviour change. The only behaviour change, the id ceiling, comes last, followed by the docs. Every phase ends green on the full gate. Phases 1, 2, 3 and 5 suit `/10x-tdd` (test first). Phase 4 is type-driven: its failing "tests" are `@ts-expect-error` lines checked by `npx astro check`.

## Critical Implementation Details

- **Edit wording must reproduce today's messages exactly.** In edit wording, a Task name error is `${subject} …` without the `Task N:` prefix, a Duration error is `DURATION_MESSAGE` alone, and START date and project name errors match the file text. A cycle found by `addPredecessor` is explained by its `cyclePathFor` path on the input project (shortest path, starting at the Task, as US-01 asks), not by `findCycle` on the candidate. Rules with no edit message of their own (`unknown-task` from the rule list, a cycle with no explanation) fall back to the file text; no edit reaches them from a checked Project.
- **"The Project before the edit was clean" is what makes an indirect break attributable to the edit.** So edits take `CheckedProject` (Phase 4), and the guardian reports the first error of the candidate. Do not short-circuit the guardian for edits that "cannot break anything" (`removePredecessor`, `setDayCountingMode`, no-op returns): every `{ ok: true }` must come from `accept`, so a search for `ok: true` in `project.ts` finds it only there.
- **A `ProjectInvariantBreach` thrown from `accept` happens in an event handler**, which React's error boundary does not catch. It propagates out of the hook action, nothing is committed, and the browser console shows it. That is intended: it is a code bug, never a user mistake.

## Phase 1: Safety net

### Overview

Pin today's behaviour before anything moves: a property test over random edit sequences that must pass on the current code. This is RK-01's first "done when".

### Changes Required:

#### 1. fast-check as a dev dependency

**File**: `package.json`, `package-lock.json`

**Intent**: Add the property-testing library used to generate and shrink edit sequences. Dev only: it never reaches `dist/`, so the CSP and the no-egress rule are unaffected.

**Contract**: `devDependencies["fast-check"]: "^4.10.2"`, installed with `npm install -D`.

#### 2. Property test over edit sequences

**File**: `src/lib/services/project.property.test.ts` (new, colocated; discovered by the `src/**/*.test.ts` glob)

**Intent**: From `createEmptyProject()`, apply random sequences of every exported edit with random arguments: names from a pool of valid and invalid ones (empty, invisible, 201 code units, control character, lone surrogate), Durations (`""`, `"0"`, `"3"`, `"1.5"`, `"1e3"`, `"-2"`, a 20-digit string), START dates (valid, `""`, `"2026-02-30"`), both day-counting modes, and Task ids drawn from a small range so that both known and unknown ids occur. After each accepted edit, `validateProject(result.project)` is `undefined`. After each rejected edit, the input is deep-equal to a copy taken before the call, and the sequence continues from it.

**Contract**: One `fc.assert(fc.property(...))` with a fixed `seed` and an explicit `numRuns`, so the gate is deterministic; a comment says how to explore locally with a random seed. Sequences are bounded (e.g. ≤ 40 edits) so the file runs in well under a second.

### Success Criteria:

#### Automated Verification:

- The property test passes on the unchanged production code: `npx vitest run src/lib/services/project.property.test.ts`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual Verification:

- Temporarily breaking one edit (e.g. removing the `checkName` call in `renameTask`) makes the property test fail with a shrunk sequence that names the edit; revert afterwards

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: One rule list

### Overview

Restructure `validateProject` into one rule list without changing what it returns, and add the model-shape assertion and the breach error the guardian will use.

### Changes Required:

#### 1. The rule list and wording

**File**: `src/lib/services/project.ts`

**Intent**: Replace the body of `validateProject` with two lists: per-Task checks (Task name, Duration, known predecessor ids), run for each Task in array order, then whole-Project checks (START date, project name, cycle). Each check takes a wording, so the same rule can produce today's edit message or today's file message. `validateProject(project)` keeps its exported signature and file wording, so the crash screen (`src/components/planner/RenderCrashFallback.tsx:36`), import and the existing tests see no change.

**Contract**: Internal types `TaskCheck = (task: Task, index: ProjectIndex, wording: Wording) => ValidationError | undefined` and `ProjectCheck = (project: Project, wording: Wording) => ValidationError | undefined`, with `type Wording = "edit" | "file"` and `interface ProjectIndex { project: Project; tasksById: ReadonlyMap<TaskId, Task> }`, built once per walk so a per-Task check never rebuilds a lookup (the known-predecessor check stays linear, and S-07's Done rules can read predecessor statuses from it). Constants `TASK_CHECKS: readonly TaskCheck[]` and `PROJECT_CHECKS: readonly ProjectCheck[]`, each with a doc comment saying that a new Validation Error rule is one entry here, in reporting order. An internal `firstValidationError(project, wording)` walks both lists. The header comment of `project.ts` and the doc comment of `validateProject` are updated to say it is the aggregate's one rule list.

#### 2. Model shape and the breach error

**File**: `src/lib/services/project.ts`

**Intent**: Name the model invariants that no user action can break (today only "assumed" at `:275-276`) and give them an assertion that throws instead of tolerating a broken shape.

**Contract**: `export class ProjectInvariantBreach extends Error` carrying `readonly fault: ValidationError | { rule: "model-shape"; message: string }`, with `name` set so a console trace reads "ProjectInvariantBreach". Internal `assertModelShape(project: Project): void`: Task ids strictly ascending, each `predecessors` list strictly ascending, `nextTaskId` greater than every Task id. It throws `ProjectInvariantBreach` with a `model-shape` fault that names the first violation.

**Moved during implementation (2026-10-19):** `assertModelShape` lands in Phase 3 §1 with `accept`, its only caller. Added here with no caller, it fails `npm run lint` (`no-unused-vars`). Phase 2 adds `ProjectInvariantBreach` only.

#### 3. Tests

**File**: `src/lib/services/project.test.ts`

**Intent**: Prove the split changed nothing and the assertion catches each shape fault. Since `assertModelShape` stays internal until Phase 3 exposes it through `accept` and `toCheckedProject`, its tests land with those (Phase 3 §3 and Phase 4 §6). This phase adds the first-error-order cases the split could break: a Task's own rules before the next Task's, then the START date, project name and cycle.

**Contract**: The existing `describe("validateProject")` block (`:428-574`) and the import rejection tables (`src/lib/services/project-file.test.ts:282` onwards) stay green unchanged. New `it` rows are added only where an ordering case is not yet covered.

### Success Criteria:

#### Automated Verification:

- Existing `validateProject` and import tests pass unchanged: `npx vitest run src/lib/services/project.test.ts src/lib/services/project-file.test.ts`
- The property test still passes: `npx vitest run src/lib/services/project.property.test.ts`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: `accept` becomes the guardian

### Overview

Route every edit through a guardian `accept` that checks the whole candidate, and delete the local rule checks. Behaviour stays the same: same rule ids, same messages.

### Changes Required:

#### 1. The guardian `accept`

**File**: `src/lib/services/project.ts`

**Intent**: `accept` asserts the model shape, finds the first Validation Error of the candidate in edit wording, lets the edit reword it for that rule if the edit supplied an explanation, and only otherwise returns `{ ok: true }`.

**Contract**:

```ts
function accept(candidate: Project, explain?: Partial<Record<ValidationErrorRule, () => string>>): EditResult; // assertModelShape → firstValidationError(candidate, "edit") → explain?.[rule]?.() ?? message
```

`reject`/`rejectWith` remain for addressing and parsing rejections only.

#### 2. Every edit through the guardian

**File**: `src/lib/services/project.ts`

**Intent**: Each edit keeps addressing and parsing and builds the candidate. The rule checks move out: `checkName` calls leave `createTask`, `renameTask` and `setProjectName`; `isPositiveWholeDays` leaves `setDuration` (the ASCII-digits test stays as parsing, so `"0"` and a 20-digit string now reach the guardian); `isIsoDate` leaves `setStartDate`; `addPredecessor` no longer decides on `cyclePathFor`, it passes it as the `cycle` explanation. No-op returns (`addPredecessor` of an existing predecessor, `removePredecessor` of an absent one, `setDayCountingMode` to the current mode) also go through `accept`.

**Contract**: Exported edit signatures unchanged in this phase. Every `{ ok: true }` in `project.ts` comes from `accept`.

#### 3. Tests

**File**: `src/lib/services/project.test.ts`, `src/lib/services/project.property.test.ts`

**Intent**: Prove that every edit reaches the guardian and that a broken shape throws. Strengthen the property test with the shape assertion.

**Contract**:

- A cyclic Project built by hand (A ⇄ B plus an unrelated Task C) passed to `setDuration(project, 3, "5")` is rejected with rule `cycle`; the same for `renameTask`, `setProjectName` and `setDayCountingMode`. A local check could not see this, so it proves the whole-state check. Until Phase 4 the hand-built Project needs no cast; from Phase 4 it is cast to `CheckedProject` in the test.
- A hand-built Project with duplicate ids (or unsorted predecessors, or `nextTaskId` not above every id) passed to `createTask` throws `ProjectInvariantBreach` with a `model-shape` fault.
- The property test also asserts that no accepted edit throws, which now covers `assertModelShape`.
- The hook rejection table (`src/hooks/useProject.test.ts:56`) and every existing `project.test.ts` message assertion pass unchanged.

#### 4. Performance measurement

**File**: none committed. The result is recorded in `context/changes/invariant-aggregate-refactor/change.md` under `## Notes`.

**Intent**: The guardian now runs every check on every edit. Measure one `setDuration` on `createPerfProject()` (100 Tasks), median of many runs (a scratch script or a temporary `it` with `performance.now()`), and record it against the 200 ms NFR (`prd.md:182`).

**Contract**: No incremental checking unless the measured edit exceeds a small fraction of the budget (well under 20 ms).

### Success Criteria:

#### Automated Verification:

- Domain and hook tests pass with the forged-project and breach tests added: `npx vitest run src/lib/services/ src/hooks/`
- No `checkName`, `isPositiveWholeDays` or `isIsoDate` call remains inside an edit function; each appears only in the rule list: `grep -n "checkName(\|isPositiveWholeDays(\|isIsoDate(" src/lib/services/project.ts`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E passes, including the unchanged import alert text: `npm run test:e2e`

#### Manual Verification:

- One edit on the 100-Task project is measured and recorded in `change.md` Notes, well inside the 200 ms NFR
- In `npm run dev`, a rejected edit in each panel (empty Task name, Duration `0`, a cycle-closing predecessor, a project name with only invisible characters) shows the same message as before the change. The START date `2026-02-30` cannot be typed into the panel: the native date input reports `""` for it, which clears the date (pre-existing, recorded as a follow-up in `change.md` Notes); `start-date-not-a-date` is covered by the hook rejection table instead

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Seal the entry points

### Overview

Introduce `CheckedProject` and require it at every way into the session and at the forecast, so a Project that did not pass the guardian cannot reach them by type.

### Changes Required:

#### 1. The brand and its doors

**File**: `src/lib/services/project.ts`

**Intent**: Only this module mints a `CheckedProject`. `accept` is its one cast. `createEmptyProject` returns one (it is clean by construction). Import and hand-built fixtures enter through two exported functions that run the same guardian in file wording.

**Contract**:

```ts
declare const checked: unique symbol;
/** A Project the guardian found free of Validation Errors. Only project.ts mints one.
 *  Limit: the brand survives a spread, so `{ ...project, tasks }` still type-checks as checked. */
export type CheckedProject = Project & { readonly [checked]: true };
export type EditResult = { ok: true; project: CheckedProject } | { ok: false; error: ValidationError };

export function createEmptyProject(): CheckedProject;
/** Import's door: the guardian in file wording. Throws ProjectInvariantBreach on a broken shape. */
export function checkProject(project: Project): EditResult;
/** For hand-built fixtures: throws ProjectInvariantBreach unless the guardian accepts the Project. */
export function toCheckedProject(project: Project): CheckedProject;
```

Every exported edit takes `project: CheckedProject` as its first parameter.

#### 2. Import returns a checked Project

**File**: `src/lib/services/project-file.ts`

**Intent**: The last stage calls `checkProject` instead of `validateProject`, so `parseProjectFile` returns a `CheckedProject`. The file module keeps what only it knows (JSON shape, version, START/FINISH spellings, normalisation, duplicate ids, the not-supported-yet limits). Update the header comment's stage list.

**Contract**: `ImportResult = { ok: true; project: CheckedProject } | { ok: false; error: ImportError }`. Messages unchanged.

#### 3. The session and the forecast

**File**: `src/hooks/useProject.ts`, `src/lib/services/forecast.ts`, `src/lib/services/fixtures.ts`

**Intent**: The hook holds only checked Projects, so `replaceProject`, restore and the initial project are safe by type rather than by comment. The forecast's reliance on the rules becomes a type.

**Contract**:

- `useProject(initial?: CheckedProject | (() => CheckedProject), initialSelection?)`; `ProjectState.project: CheckedProject`; `previousProject: CheckedProject | undefined`; `replaceProject: (project: CheckedProject) => void`; `apply`'s edit parameter takes `CheckedProject`. The `replaceProject` doc comment (`:25-29`) drops "the hook does not validate it again" and names the type.
- `forecast(project: CheckedProject, today: string)`. Its doc comment cites the guardian for what the type guarantees today (no cycle, a well-formed START date, the two things `forecast` would otherwise throw on). The Done-rules sentence at `:76-80` says those rules join the rule list in S-07: until then a `CheckedProject` does not vouch for them (`toCheckedProject` accepts `aWithStatus`).
- `createPerfProject(): CheckedProject`.

#### 4. Views, kitchen sink and test helpers

**File**: `src/components/planner/Planner.tsx`, `src/components/planner/ProjectControls.tsx`, `src/dev/KitchenSinkPlanner.tsx`, test files with an `accepted` helper (`project.test.ts`, `forecast.test.ts`, `useProject.test.ts`, `ForecastSummary.test.ts`, `StartPanel.test.ts`, `Planner.test.ts`, `diagram.test.ts`, `flow-elements.test.ts`, `layout-engine.test.ts`, `validation-warnings.test.ts`, `project-file.test.ts`, whichever the type checker flags)

**Intent**: Thread the type through the props that feed the doors: `PlannerProps.initialProject`, `initialProject()`, `handleReplaceProject`, `ProjectControls`' `replaceProject` prop. Test helpers return `CheckedProject`. Hand-built fixtures that the guardian accepts go through `toCheckedProject` (e.g. `aWithStatus` in `forecast.test.ts:45`). The deliberately broken render-crash fixtures (`Planner.test.ts:156` `cyclicProject`, `KitchenSinkPlanner.tsx:85` `renderCrashProject`) are cast with a comment saying why. In `src/components/planner/RenderCrashFallback.tsx`, the local `checkProject` (`:32`, a throw-tolerant `validateProject` on an unchecked Project) is renamed `inspectCrashedProject`, so `checkProject` names only the aggregate's import door.

**Contract**: No other view prop changes type; views that only read keep `Project`.

#### 5. Cast ban

**File**: `eslint.config.js`

**Intent**: Forbid minting a `CheckedProject` by cast outside the aggregate, the tests and the dev-only kitchen sink.

**Contract**: A `no-restricted-syntax` selector for `TSAsExpression` and `TSTypeAssertion` whose type is `CheckedProject`, with a message pointing at `checkProject`/`toCheckedProject`. It is applied in a new block on `src/**/*.{ts,tsx,astro}` that ignores `src/lib/services/project.ts`, `src/**/*.test.ts` and `src/dev/**`, and is spread into the existing planner block (`eslint.config.js:81-92`) as well, since that block's `no-restricted-syntax` would otherwise replace it. That block also matches planner test files, where `Planner.test.ts` casts `cyclicProject` (§4), so the literal-value selectors move into their own array: the planner block gets the literal selectors plus the cast ban and `ignores: ["src/components/planner/**/*.test.ts"]`, and a new block after it, on `src/components/planner/**/*.test.ts`, restates only the literal selectors.

#### 6. Type tests

**File**: `src/hooks/useProject.test.ts`, `src/lib/services/project.test.ts`

**Intent**: Prove the doors are closed by type (RK-06's "done when", with a plain `Project` literal in place of `createEmptyProject()`, which is now legitimately checked), and that the fixture door refuses a broken Project.

**Contract**: In `project.test.ts`, `toCheckedProject` of a hand-built cyclic Project throws `ProjectInvariantBreach` whose fault is the `cycle` Validation Error, and of a duplicate-id Project throws with a `model-shape` fault. In `useProject.test.ts`, inside a test, `@ts-expect-error` lines show that `replaceProject` with a plain `Project` literal and `useProject` with a plain `Project` initial do not compile, while `replaceProject` with a `parseProjectFile` result (after narrowing `ok`) and with `createEmptyProject()` do. Checked by `npx astro check`, which covers test files (`tsconfig.json` includes `**/*`). Each directive carries a description of at least 10 characters, e.g. `// @ts-expect-error -- a plain Project is not checked`: `strictTypeChecked` sets `ban-ts-comment` with `minimumDescriptionLength: 10`, so a bare one fails `npm run lint`.

### Success Criteria:

#### Automated Verification:

- Type check passes, including the `@ts-expect-error` lines: `npx astro check`
- Lint passes, and a temporary `as CheckedProject` in `src/components/planner/Planner.tsx` and in `src/hooks/useProject.ts` each makes `npm run lint` fail (revert afterwards)
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E passes: `npm run test:e2e`

#### Manual Verification:

- The kitchen sink (`npm run dev`, `/kitchen-sink`) shows every fixture as before, including the render-crash fallback
- `?fixture=perf100` still loads the 100-Task project in `npm run dev`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Id ceiling and docs

### Overview

Move the id ceiling into the aggregate and make `createTask` refuse at it (Q-06, RK-05), then update the documented process and the glossary.

### Changes Required:

#### 1. The ceiling as a Validation Error

**File**: `src/lib/services/project.ts`, `src/lib/services/project-file.ts`

**Intent**: The cap is a model rule a user can reach (import a hand-edited file at the cap, then create a Task), so it is a rejected edit, not a breach. Raising the cap would only move the edge, so the cap stays and `createTask` refuses at it. The file module imports the constants instead of owning them. Import's shape stage keeps its "must be at most …" messages.

**Contract**: `export const MAX_NEXT_TASK_ID = 2_147_483_647` and `export const MAX_TASK_ID = MAX_NEXT_TASK_ID - 1` move from `project-file.ts:251-255` (with their comment) to `project.ts`. New `ValidationErrorRule` member `"task-id-limit-reached"`. New whole-Project check (after the project name, before the cycle): `nextTaskId ≤ MAX_NEXT_TASK_ID`, message "Task ids go up to 2147483646 and this project has reached that limit, so no more Tasks can be created." (same in both wordings; no "invalid", "conflict" or "blocked"), with the number interpolated from `MAX_TASK_ID`, never written out, so the cap has one spelling in the source.

#### 2. Tests

**File**: `src/lib/services/project.test.ts`, `src/lib/services/project-file.test.ts`, `src/hooks/useProject.test.ts`

**Intent**: RK-05's "done when", plus the per-rule rows test-plan §6.2 asks for.

**Contract**:

- `parseProjectFile` of a file with `nextTaskId` 2147483647, then `createTask` → rejected `task-id-limit-reached`, project unchanged. Re-importing that project's export gives the same Project (the existing cap round-trip at `project-file.test.ts:821-827` stays).
- `validateProject` of a hand-built Project with `nextTaskId` 2147483648 → `task-id-limit-reached` with the exact message.
- One separate `it` next to the hook rejection table (`useProject.test.ts:56`), not a row in it: a row is one action on `fixture()`, and the table asserts `replacements` 0 and `previousProject` undefined (`:188-193`, `:214`). The test renders `useProject()`, calls `replaceProject` with a parsed file at the cap in its own `act`, then `createTask` is rejected with `task-id-limit-reached` and the project is unchanged.
- No file row in `validationErrorRows` (`project-file.test.ts:301`): import's shape stage rejects such a file first, and the existing rows at `:652-669` already pin that.

#### 3. Docs

**File**: `context/foundation/test-plan.md`, `context/domain/glossary.md`

**Intent**: The documented process stops requiring every rule to be written twice, and the new load-bearing names enter the ubiquitous language.

**Contract**:

- `test-plan.md:124`: replace "a new rule is wired into its edit function and into `validateProject`, and tested at both ends" with: a new Validation Error rule is one entry in `TASK_CHECKS` or `PROJECT_CHECKS` in `src/lib/services/project.ts`, tested once in the `validateProject` table, plus one edit row (the hook rejection table) and one file row when a file can hold it.
- `glossary.md`: add Checked project (`CheckedProject`, `checkProject`, `toCheckedProject`), the rule list (`TASK_CHECKS`, `PROJECT_CHECKS`), `ProjectInvariantBreach` (a code bug, never a user mistake), and `task-id-limit-reached` under Validation Error. Add "don't call it" entries: "valid/invalid project", and "validator" for the guardian (it is the Project aggregate's own check).

### Success Criteria:

#### Automated Verification:

- The ceiling tests pass: `npx vitest run src/lib/services/project.test.ts src/lib/services/project-file.test.ts src/hooks/useProject.test.ts`
- The cap literal lives in one module: `grep -rn "2_147_483_647" src` lists only `src/lib/services/project.ts`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E passes: `npm run test:e2e`
- Mutation testing on the guardian's lines in `src/lib/services/project.ts` is reviewed (selective, not a gate; mind the known Vitest 5 runner false result in `PROJECT_RULES.md`): `npm run test:mutation -- --mutate "src/lib/services/project.ts:<guardian lines>"`

#### Manual Verification:

- The `test-plan.md:124` and glossary wording reads correctly and uses the glossary's own terms (Validation Error, not "invalid")

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- Property test (Phase 1, strengthened in Phase 3): random edit sequences. After each accepted edit there is no Validation Error, the model shape holds and nothing throws; after each rejected edit the input is unchanged.
- The rule list (Phase 2): the existing `validateProject` table, the first-error order across Tasks and whole-Project rules, and model-shape faults.
- The guardian (Phase 3): a forged cyclic Project makes unrelated edits reject with `cycle`, and a broken shape throws `ProjectInvariantBreach`. All existing edit message assertions stay.
- The ceiling (Phase 5): `createTask` at the cap, and `validateProject` above it.

### Integration Tests:

- The hook rejection table (`useProject.test.ts:56`) stays unchanged, plus one separate `task-id-limit-reached` test next to it; type tests on the doors.
- Import tables in `project-file.test.ts` stay unchanged; `parseProjectFile` returns `CheckedProject`.
- E2E (`e2e/project-file.spec.ts`, `e2e/render-crash.spec.ts`) stays green with unchanged alert text.

### Manual Testing Steps:

1. In `npm run dev`, trigger each rejected edit in the panels and compare the message with `main`.
2. Open `/kitchen-sink` and check every fixture, including the render-crash fallback.
3. Load `?fixture=perf100` and edit a Duration. The update feels instant, and the recorded measurement is well under 200 ms.

## Performance Considerations

The guardian runs every check on every edit: the name regexps per Task, one pass over the predecessors, `assertModelShape` and one `findCycle`, all linear in Tasks plus dependencies. That is the same work import already does once per file. Phase 3 measures one edit on the 100-Task fixture against the 200 ms NFR (`prd.md:182`). No incremental checking is planned unless that measurement calls for it.

## Migration Notes

No data migration. The file format and version (`"0.1"`) are unchanged, and every file that imports today imports identically. A project at the id ceiling can no longer gain a Task; before, the new Task produced an export that could not be re-imported.

## References

- Upstream design: `context/domain/02-invariant-aggregate-refactor.md`
- Domain map: `context/domain/01-domain-distillation.md` (INV-01, DR-06, RK-01, RK-05, RK-06, Q-05, Q-06)
- Glossary: `context/domain/glossary.md`
- Test patterns: `context/foundation/test-plan.md` §6.1–§6.3
- PRD: `context/foundation/prd.md:66` (Guardrail), `:158` (FR-019), `:182` (NFR)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Safety net

#### Automated

- [x] 1.1 The property test passes on the unchanged production code — 2e47fac
- [x] 1.2 Full gate passes — 2e47fac

#### Manual

- [x] 1.3 Temporarily breaking one edit makes the property test fail with a shrunk sequence — 2e47fac

### Phase 2: One rule list

#### Automated

- [x] 2.1 Existing validateProject and import tests pass unchanged — b1a7816
- [x] 2.2 The property test still passes — b1a7816
- [x] 2.3 Full gate passes — b1a7816

### Phase 3: accept becomes the guardian

#### Automated

- [x] 3.1 Domain and hook tests pass with the forged-project and breach tests added
- [x] 3.2 No checkName, isPositiveWholeDays or isIsoDate call remains inside an edit function
- [x] 3.3 Full gate passes
- [x] 3.4 E2E passes, including the unchanged import alert text

#### Manual

- [x] 3.5 One edit on the 100-Task project is measured and recorded in change.md Notes
- [x] 3.6 A rejected edit in each panel shows the same message as before the change

### Phase 4: Seal the entry points

#### Automated

- [ ] 4.1 Type check passes, including the @ts-expect-error lines
- [ ] 4.2 Lint passes, and a temporary as CheckedProject in a view and in the hook makes lint fail
- [ ] 4.3 Full gate passes
- [ ] 4.4 E2E passes

#### Manual

- [ ] 4.5 The kitchen sink shows every fixture as before, including the render-crash fallback
- [ ] 4.6 ?fixture=perf100 still loads the 100-Task project

### Phase 5: Id ceiling and docs

#### Automated

- [ ] 5.1 The ceiling tests pass
- [ ] 5.2 The cap literal lives in one module
- [ ] 5.3 Full gate passes
- [ ] 5.4 E2E passes
- [ ] 5.5 Mutation testing on the guardian's lines is reviewed

#### Manual

- [ ] 5.6 The test-plan and glossary wording reads correctly and uses the glossary's own terms
