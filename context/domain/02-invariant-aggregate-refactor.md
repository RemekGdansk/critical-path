---
title: 'Invariant aggregate refactor: the Project as the guardian of "never a Validation Error"'
created: 2026-10-18
type: refactor-plan
---

# Invariant aggregate refactor: the Project as the guardian of "never a Validation Error"

A refactoring plan, not an implementation. It changes no production code; the change happens later through `/10x-plan` → `/10x-implement` (or `/10x-tdd` for the test-first phases). Terms follow `context/domain/glossary.md`. Every `file:line` below was checked against branch `invariant-aggregate-refactor` at `b9533b0`. Invariant ids `INV-NN`, drift ids `DR-NN` and ranking ids `RK-NN` refer to `context/domain/01-domain-distillation.md`.

## Step 0: Context

**Documents read.** `context/foundation/prd.md` (v1: Success Criteria → Guardrails, US-01–US-04, FR-001–FR-019, Business Logic), `context/foundation/roadmap.md` (M-1, slices S-01–S-08), `context/foundation/test-plan.md` (§6.1–§6.3, the test patterns), `context/foundation/lessons.md`, `PROJECT_RULES.md`, and the domain map and glossary in `context/domain/`.

**Stack.** Astro 7 with `output: "static"`, one React 19 island, TypeScript, Vitest 5 (`PROJECT_RULES.md`). There is no server, no API route, no database and no auth, and `PROJECT_RULES.md` forbids adding any ("Never add server-only features"). The CSP's `connect-src 'none'` also makes a remote store impossible.

**Layers that hold business logic**, and what plays each role from the generic DDD template in this app:

| Generic role             | In this app                                                                                                      | Files                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Domain (aggregate)       | Pure edit functions over an immutable `Project` value; each returns `EditResult`                                 | `src/lib/services/project.ts`, `src/types.ts`, `src/lib/services/task-graph.ts`       |
| Domain service           | The forecast, a pure function of `Project` and today                                                             | `src/lib/services/forecast.ts`, `src/lib/services/validation-warnings.ts`             |
| Persistence / repository | The Project file (load = `parseProjectFile`, save = `serializeProject`) and the in-memory session (`useProject`) | `src/lib/services/project-file.ts`, `src/hooks/useProject.ts`                         |
| API / route              | The hook's actions, called from React event handlers that parse DOM input and show the rejection message         | `src/hooks/useProject.ts`, `src/components/planner/*Panel.tsx`, `ProjectControls.tsx` |
| Client-only guards       | Advisory UI hints (the predecessor picker's "(would create a cycle)" label, input `maxLength`)                   | `src/components/planner/TaskPanel.tsx`                                                |

So "move enforcement from the client to the server" has no literal meaning here. Its counterpart in this codebase is moving enforcement from many per-edit checks plus a separate import checker into one domain guardian, and making the session refuse any project that did not pass it.

## Step 1: Business invariants

Each invariant is drawn from the documents, the code, or both. The cross-reference column points at the matching entry of the domain map.

| ID   | Invariant                                                                                                                                                                                             | Source                                                                                                                 | Map    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| I-01 | A Project never holds a Validation Error, not while editing, not in an exported file, not after import; every edit that would create one, **directly or indirectly**, is rejected and names the rule. | Guardrail `prd.md:66`; FR-019 `prd.md:158`; Business Logic `prd.md:194`; code header `src/lib/services/project.ts:1-3` | INV-01 |
| I-02 | No cycle; the rejection names the cycle.                                                                                                                                                              | FR-003 `prd.md:131`; US-01 `prd.md:75`                                                                                 | INV-04 |
| I-03 | START has no predecessor; no Task depends on FINISH.                                                                                                                                                  | US-01 AC `prd.md:80`; `src/types.ts:1-3`                                                                               | INV-05 |
| I-04 | Predecessors hold known Task ids only, unique and ascending.                                                                                                                                          | `prd.md:194` ("a dependency on an unknown id"); `src/types.ts:19-20`                                                   | INV-03 |
| I-05 | Task ids are unique, constant, never reused; `nextTaskId` is above every id.                                                                                                                          | FR-001 note `prd.md:128`; `src/types.ts:5-6`, `:44-45`                                                                 | INV-02 |
| I-06 | Task and project names follow the four name rules.                                                                                                                                                    | `prd.md:194`; `src/types.ts:14-18`                                                                                     | INV-06 |
| I-07 | A Duration is a positive whole number of days.                                                                                                                                                        | FR-004 `prd.md:133`                                                                                                    | INV-07 |
| I-08 | A set START date is a real calendar date.                                                                                                                                                             | Code only: `src/lib/services/project.ts:27`, `:254`                                                                    | INV-08 |
| I-09 | Done rules: Done needs a completion date and all predecessors Done; a completion date is ≤ today, ≥ the START date, ≥ every predecessor's completion date; indirect breaks are rejected too.          | FR-005 `prd.md:135`; US-04 AC `prd.md:107-119`; `prd.md:194`                                                           | INV-09 |
| I-10 | Deleting a Task never creates a Validation Error; its dependents fall back to START.                                                                                                                  | FR-002 note `prd.md:130`                                                                                               | INV-10 |
| I-11 | A rejected edit leaves the Project (and the Selection) exactly as it was.                                                                                                                             | MVP flow `prd.md:45`; US-01 AC `prd.md:79`                                                                             | INV-23 |
| I-12 | While any Validation Warning exists, neither Project Finish Date is shown.                                                                                                                            | Guardrail `prd.md:67`; FR-009 `prd.md:156`                                                                             | INV-11 |
| I-13 | Export then import yields exactly the same Project.                                                                                                                                                   | Guardrail `prd.md:65`; US-03 AC `prd.md:101`                                                                           | INV-18 |
| I-14 | New, Import and Go back ask for confirmation over unexported changes.                                                                                                                                 | FR-016 `prd.md:144`                                                                                                    | INV-22 |

I-02 to I-09 are the individual Validation Error rules; I-01 is the policy that binds them to every path into the Project. That distinction drives the choice below.

## Step 2: Classification and choice

Axis (a) is how core the rule is to the product's purpose ("a dependency graph is only valuable when the tool validates it", `prd.md:24`). Axis (b) counts the places the rule lives. Axis (c) uses the domain map's status words: **enforced**, **declared** (relied on but not checked where relied on), **ignored**.

| ID   | (a) Core?                               | (b) Spread                                                                                                                                  | (c) Enforcement                                                                                   |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| I-01 | Highest: a Guardrail and FR-019         | Every edit function (9), `validateProject`, the import pipeline, three session entry points, the forecast's assumptions: 4 layers, ~6 files | Enforced rule by rule; **no single place decides**; three session entry points trust their caller |
| I-02 | Core (US-01, the MVP flow step 3)       | 3 computations in `task-graph.ts`, 2 call sites in `project.ts`, the picker flag in `TaskPanel.tsx`                                         | Enforced; all three computations are tested for agreement                                         |
| I-03 | Core                                    | Model shape + one import stage                                                                                                              | Enforced by construction                                                                          |
| I-04 | Core                                    | `addPredecessor`, `deleteTask`, import normalisation, `validateProject`                                                                     | Enforced; ordering/uniqueness only declared in `validateProject`                                  |
| I-05 | Supporting                              | `createTask`, `deleteTask`, import                                                                                                          | Enforced, except the id ceiling, which only import knows (DR-06)                                  |
| I-06 | Supporting                              | One shared `checkName`, 5 call sites                                                                                                        | Enforced                                                                                          |
| I-07 | Core (forecast input)                   | `setDuration`, `validateProject`                                                                                                            | Enforced                                                                                          |
| I-08 | Supporting                              | `setStartDate`, `validateProject`                                                                                                           | Enforced                                                                                          |
| I-09 | Core (US-04, the forecast relies on it) | Would need `setStatus`, completion-date edit, `addPredecessor`, `setStartDate`, `deleteTask`?, import: ≥ 5 places                           | **Ignored** in edits; held only vacuously by an import block; **declared** by `forecast()`        |
| I-10 | Supporting                              | `deleteTask`                                                                                                                                | Enforced by an argument, never checked                                                            |
| I-11 | Core-protecting                         | `useProject.apply`                                                                                                                          | Enforced and tested                                                                               |
| I-12 | Core                                    | One place, `forecast.ts:83-84`                                                                                                              | Enforced                                                                                          |
| I-13 | Core (the north star, S-03)             | `project-file.ts`                                                                                                                           | Enforced, except at the id ceiling (DR-06)                                                        |
| I-14 | Supporting                              | Three buttons                                                                                                                               | Ignored (planned, S-08)                                                                           |

**Choice: I-01, "a Project never holds a Validation Error", specifically its "directly or indirectly" clause.**

- **Most core.** It is the PRD's strictest Guardrail (`prd.md:66`) and the reason the product exists instead of a whiteboard (`prd.md:24`). FR-019 (`prd.md:158`) was added to "gather into one place" the rejections of FR-003, FR-004 and FR-005, but the code never gathered them.
- **Most weakly enforced, structurally.** Each individual rule I-02 to I-08 is enforced, so I-01 holds today. But it holds as a sum of local checks: each edit checks only the rule it knows it can break, `validateProject` is a second, import-only checker, and the session accepts three kinds of project without any check. Nothing verifies the _resulting_ Project after an edit. The documented process even requires every new rule to be written twice: "a new rule is wired into its edit function and into `validateProject`, and tested at both ends" (`context/foundation/test-plan.md:124`).
- **About to break.** I-09 (the Done rules) is the densest rule set in the PRD (`roadmap.md:177`) and is indirect by definition: reverting A to To Do breaks B; moving the START date breaks any completion date; adding a predecessor to a Done Task breaks it. A local check in `setStartDate` cannot see completion dates unless someone remembers to add it there, and in `addPredecessor`, and in import. Meanwhile `forecast()` already relies on these rules (`src/lib/services/forecast.ts:76-80`).
- **Why not I-09 alone?** Fixing I-09 inside today's structure means writing the Done rules into five functions. Choosing I-01 fixes the structure once, after which I-09 is a list entry. This matches RK-01, the domain map's first-ranked item.

## Step 3: Diagnosis of I-01

### 3.1 Domain layer: each edit checks only its own local rule

| Edit                 | Lines                                 | What it checks                                                                         | What it cannot see                                                                                        |
| -------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `createTask`         | `src/lib/services/project.ts:135-142` | Name rules (`:137`)                                                                    | Id ceiling (DR-06): `nextTaskId + 1` is unbounded (`:141`)                                                |
| `renameTask`         | `src/lib/services/project.ts:144-153` | Addressing, name rules (`:149`)                                                        | —                                                                                                         |
| `deleteTask`         | `src/lib/services/project.ts:160-171` | Addressing only                                                                        | Nothing checks the result; I-10 holds by argument (`:155-159`). With Done rules, still safe, but unproven |
| `addPredecessor`     | `src/lib/services/project.ts:173-189` | Addressing (`:175`, `:177`), cycle via `cyclePathFor` (`:179`)                         | Done rules: adding a not-Done predecessor to a Done Task (FR-005, `prd.md:135`)                           |
| `removePredecessor`  | `src/lib/services/project.ts:191-199` | Addressing only                                                                        | —                                                                                                         |
| `setProjectName`     | `src/lib/services/project.ts:202-212` | Project name rules (`:209`)                                                            | —                                                                                                         |
| `setDuration`        | `src/lib/services/project.ts:229-244` | Input digits + `isPositiveWholeDays` (`:240`)                                          | —                                                                                                         |
| `setStartDate`       | `src/lib/services/project.ts:247-256` | `isIsoDate` (`:254`)                                                                   | Done rules: "moving the START date after a completion date" (`prd.md:135`)                                |
| `setDayCountingMode` | `src/lib/services/project.ts:266-269` | Nothing: "it never rejects" (`:265`)                                                   | —                                                                                                         |
| (none yet)           | —                                     | No edit sets a Status or a completion date; `createTask` hard-codes `"to-do"` (`:140`) | All of I-09                                                                                               |

Every `{ ok: true }` result is produced by `accept` (`src/lib/services/project.ts:36-38`), which accepts any project it is given. The guard is a convention: "remember to check before calling `accept`".

### 3.2 A second checker for import

`validateProject` (`src/lib/services/project.ts:278-307`) re-checks names (`:282`), Durations (`:284-286`), known predecessor ids (`:287-293`), the START date (`:295-297`), the project name (`:298-301`) and cycles (`:302-305`). No edit calls it. It also only _declares_ the model shape: "Assumes the model invariants (unique ascending ids, sorted and unique predecessors); import establishes them first" (`:275-276`). Those are established in the file module, not the domain: normalisation (`src/lib/services/project-file.ts:323-339`) and the duplicate-id check (`:343-347`). The id ceiling lives only there too (`:251-255`).

The import pipeline (`src/lib/services/project-file.ts:369-379`) holds I-09 vacuously by rejecting every non-To-Do Status and every completion date (`checkSupportedYet`, `:351-367`). Once S-07 lifts that block, import is safe only if someone adds the Done rules to `validateProject` as well as to each edit.

### 3.3 Session layer: three entry points with no guard

- `replaceProject` (`src/hooks/useProject.ts:123-130`) commits whatever it is given; its contract is a comment: "Takes only a project that `parseProjectFile` accepted: the hook does not validate it again" (`:25-29`). Its one caller today honours it (`src/components/planner/ProjectControls.tsx:126-134` → `src/components/planner/Planner.tsx:169-175`), but nothing makes a second caller (S-08's New project) do the same.
- `restorePreviousProject` (`src/hooks/useProject.ts:134-140`) re-commits the previous project without a check. It is safe by induction only: the previous project was itself committed through a guarded path.
- The initial project (`src/hooks/useProject.ts:56-57`) is any `Project`. `Planner` takes one as a prop (`src/components/planner/Planner.tsx:34`, `:64-65`); the kitchen sink passes its fixtures (`src/dev/KitchenSinkPlanner.tsx:121`), and the dev-only `?fixture=perf100` builds one by hand (`src/components/planner/Planner.tsx:25-30`).

The edit path itself is sound: `apply` commits only `ok` results (`src/hooks/useProject.ts:79-86`), as one value, through `latest` (`:72-77`), so a rejected edit changes nothing (I-11).

### 3.4 Where a broken invariant is swallowed or surfaces late

- **Swallowed in the readers.** "Predecessor ids that match no Task are ignored throughout" (`src/lib/services/task-graph.ts:2-3`); `topologicalOrder` drops them (`:158-159`), and the forecast skips them (`src/lib/services/forecast.ts:97`, `:107` `?? 0`). The tolerance exists so that the import checker terminates on a bad file, but it means a dangling id that slipped past a trusted entry point (3.3) would silently drop a dependency and show an earlier Project Finish Date instead of stopping.
- **Declared, then relied on.** The forecast counts every Done Task as finishing on the base date, "which the Done rules make exact" (`src/lib/services/forecast.ts:76-80`, `:98-100`). No code enforces those Done rules (DR-05).
- **Fails late, at render.** A cycle that got in is not rejected; it throws "The project contains a cycle." from `topologicalOrder` (`src/lib/services/task-graph.ts:177-178`) during render (`src/components/planner/Planner.tsx:121-122`), and the user sees the crash screen. The crash screen checks `validateProject` after the fact (`src/components/planner/RenderCrashFallback.tsx:27-38`) and exports anyway (`:55-60`). That export is a deliberate, stated exception (DR-01), kept by this plan.

### 3.5 Is the UI ever the only guard?

No, and this plan keeps it that way. The predecessor picker labels a cycle-closing Task "(would create a cycle)" (`src/components/planner/TaskPanel.tsx:266-268`) but leaves it selectable; the domain refuses it and the panel shows the message (`:144-150`). The picker flag (`descendantsOf`, `src/lib/services/task-graph.ts:20-29`, used at `:134`) is tested for agreement with `cyclePathFor` (`src/lib/services/task-graph.test.ts:234-243`), and `cyclePathFor` with `findCycle` (`:215-232`). _Correction to the domain map:_ DR-07 says only the first two are tested for agreement; all three are.

### 3.6 Summary of the diagnosis

The weakness is not a missing check but a missing **owner**. Rules are enforced where someone remembered to put them; the resulting state is never checked after an edit; the session trusts three inputs by comment; readers tolerate broken state instead of stopping. That was enough while every rule was local to one field. It will not be enough for the Done rules.

## Step 4: Design of the guardian aggregate

### 4.1 Principle

**The Project aggregate is the only place that decides whether a Project is acceptable, and it decides on the whole resulting state, never on the edit.** An edit only builds a candidate Project; the guardian checks the candidate against every Validation Error rule; only a candidate with none becomes the new Project.

Because the Project before an edit already passed the guardian, any Validation Error found in the candidate was introduced by that edit, directly or indirectly. That single fact is what makes the indirect Done rules free: `setStartDate` does not need to know completion dates exist.

### 4.2 Two kinds of failure, both fail-fast

| Failure                      | Cause                                                                                                                                   | How it stops                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Rejected edit**            | The user asked for an illegal operation (a cycle, a bad Duration, B Done before A).                                                     | Returns `{ ok: false, error: ValidationError }` with a named `rule`. Nothing is committed. The view shows the message. Not logged, not retried.                    |
| **`ProjectInvariantBreach`** | Code handed the aggregate something no user action can produce: a broken model shape, or an unchecked Project at a trusted entry point. | Thrown (`class ProjectInvariantBreach extends Error`, carrying the `ValidationError` or shape fault). It is a bug; it surfaces at once instead of being tolerated. |

Rejected edits stay values, not exceptions, on purpose: every caller is a React event handler that shows the message (`src/components/planner/TaskPanel.tsx:91-97`, `:120-126`, `:148-149`; `StartPanel.tsx:64`; `NewTaskForm.tsx:28-32`), the hook's rejection table asserts on `result.error.rule` (`src/hooks/useProject.test.ts:56`), and a throw during render blanks the island. The named domain error is `ValidationError.rule` (`ValidationErrorRule`, `src/lib/services/project.ts:11-27`). Fail-fast holds either way: an illegal operation stops and leaves the Project unchanged.

### 4.3 Types and signatures

```ts
// src/lib/services/project.ts — the Project aggregate

/** What a check needs besides the Project. `today` is passed in, never read from the clock. */
export interface CheckContext {
  today: string; // ISO yyyy-mm-dd
  /** "edit": "… would …" for a rejected edit; "file": "The project contains …" for import. */
  wording: "edit" | "file";
}

/** A Project the guardian found free of Validation Errors. Only this module mints one. */
declare const checked: unique symbol;
export type CheckedProject = Project & { readonly [checked]: true };

export type EditResult =
  | { ok: true; project: CheckedProject }
  | { ok: false; error: ValidationError };

/** One Validation Error rule over the whole Project. */
type ValidationErrorCheck = (project: Project, context: CheckContext) => ValidationError | undefined;

/** Every rule, in reporting order. S-07 adds the Done rules here and nowhere else. */
const VALIDATION_ERROR_CHECKS: readonly ValidationErrorCheck[] = [
  taskNames, durations, knownPredecessors, startDate, projectName, noCycle,
  // S-07: doneNeedsCompletionDate, doneNeedsPredecessorsDone, completionDateNotAfterToday,
  //       completionDateNotBeforeStartDate, completionDateNotBeforePredecessors
];

/** The guardian. The first Validation Error the Project holds, or undefined. */
export function validateProject(project: Project, context: CheckContext): ValidationError | undefined;

/** For trusted entry points (fixtures, the perf project): throws ProjectInvariantBreach unless clean. */
export function toCheckedProject(project: Project, today: string): CheckedProject;

export class ProjectInvariantBreach extends Error {
  constructor(readonly fault: ValidationError | { rule: "model-shape"; message: string });
}
```

Every edit gains a `context` argument (`today`), so S-07 does not change every signature a second time:

```ts
export function createTask(project: CheckedProject, name: string, context: EditContext): EditResult;
export function setStartDate(project: CheckedProject, input: string, context: EditContext): EditResult;
// … the same for every edit; EditContext = { today: string }
// S-07 adds, with no rule logic of their own:
export function setStatus(
  project: CheckedProject,
  taskId: TaskId,
  status: TaskStatus,
  context: EditContext,
): EditResult;
export function setCompletionDate(
  project: CheckedProject,
  taskId: TaskId,
  input: string,
  context: EditContext,
): EditResult;
```

### 4.4 The single exit: `accept` becomes the guardian

Today `accept` (`src/lib/services/project.ts:36-38`) wraps any project. After the refactor it is still the only producer of `{ ok: true }`, but it checks first:

```ts
function accept(
  candidate: Project,
  context: EditContext,
  explain?: Partial<Record<ValidationErrorRule, () => string>>,
): EditResult {
  assertModelShape(candidate); // unique ascending ids, sorted unique predecessors, nextTaskId above every id
  // → throws ProjectInvariantBreach: no user action can break these
  const error = validateProject(candidate, { ...context, wording: "edit" });
  if (error !== undefined) {
    const message = explain?.[error.rule]?.() ?? error.message;
    return { ok: false, error: { rule: error.rule, message } }; // stop; nothing committed
  }
  return { ok: true, project: candidate as CheckedProject }; // the only cast in the codebase
}
```

Edits keep only what is not a Project invariant: **addressing** (is there a Task with this id, `unknown-task`), **input parsing** (trim; Duration text must be ASCII digits, `src/lib/services/project.ts:222`, `:240`), and an optional **explanation** for a rule the guardian found. The verdict is always the guardian's.

```ts
export function addPredecessor(project: CheckedProject, taskId: TaskId, predecessorId: TaskId, context: EditContext) {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId); // addressing
  const predecessor = findTask(project, predecessorId);
  if (predecessor === undefined) return unknownTask(predecessorId); // addressing
  if (task.predecessors.includes(predecessorId)) return { ok: true, project }; // no-op, already checked

  const predecessors = [...task.predecessors, predecessorId].toSorted((a, b) => a - b);
  return accept(replaceTask(project, { ...task, predecessors }), context, {
    // The guardian decides there is a cycle; this only words it as US-01 asks (shortest, starting at the Task).
    cycle: () =>
      `Adding ${taskLabel(predecessor)} as a predecessor of ${taskLabel(task)} would create the cycle ${pathLabel(
        project,
        cyclePathFor(project, taskId, predecessorId) ?? [],
      )}.`,
    // S-07: a Done Task given a not-Done predecessor is reported by the guardian with no code here.
  });
}

export function setStartDate(project: CheckedProject, input: string, context: EditContext) {
  const trimmed = input.trim();
  const start = trimmed === "" ? withoutDate(project.start) : { ...project.start, date: trimmed };
  return accept({ ...project, start }, context);
  // isIsoDate and (S-07) "completion date before the START date" are both guardian checks.
}

export function setDuration(project: CheckedProject, taskId: TaskId, input: string, context: EditContext) {
  const task = findTask(project, taskId);
  if (task === undefined) return unknownTask(taskId);
  const trimmed = input.trim();
  if (trimmed === "") return accept(replaceTask(project, withoutDuration(task)), context);
  if (!DIGITS_ONLY.test(trimmed)) return reject("duration-not-positive-whole-number", DURATION_MESSAGE); // parsing
  return accept(replaceTask(project, { ...task, duration: Number(trimmed) }), context); // "0" → guardian
}
```

A guardian-found rejection for an indirect rule names the Task that would break, in the edit wording. Example for S-07: with A and B Done, `setStatus(A, "to-do")` → `{ rule: "task-done-predecessor-not-done", message: "This change would leave Task 2: B Done while its predecessor 1: A is not Done." }`.

### 4.5 Atomicity

There is no database transaction to open. The Project is an immutable value, so atomicity comes from the shape of the operation: the edit builds the whole candidate, the guardian checks the whole candidate, and the session commits it as one value in one call (`commit`, `src/hooks/useProject.ts:72-77`), reading the latest committed Project through `latest` so two edits in one event never apply to a stale one (`:61-63`). An edit that touches many Tasks at once (`deleteTask` strips an id from every successor, `src/lib/services/project.ts:163-169`) is checked as a whole, never Task by Task. A rejected edit never reaches `commit` (I-11).

### 4.6 Repositories: load and save only through the guardian

**Project file (persistent repository).** `parseProjectFile` keeps its pipeline (`src/lib/services/project-file.ts:369-379`): parse, version, START/FINISH spellings, shape, normalise, duplicate ids, then the guardian with `wording: "file"` and the injected `today`, and returns `ImportResult = { ok: true; project: CheckedProject } | …`. The file module keeps what only it knows (JSON shape, version, normalisation, the "not supported yet" limits); it no longer holds a model invariant. The id ceiling (`:251-255`) moves into the aggregate (Phase 4). `serializeProject` keeps accepting any `Project`, because the crash screen's export of an unchecked Project is a stated exception (DR-01).

**Session (in-memory repository).** `useProject` holds `CheckedProject` only:

```ts
export function useProject(
  initial?: CheckedProject | (() => CheckedProject),
  initialSelection?: Selection,
  options?: { today?: () => string }, // default: () => todayIsoDate(new Date()); tests inject a fixed date
): ProjectState;

replaceProject: (project: CheckedProject) => void;   // a plain Project no longer compiles
previousProject: CheckedProject | undefined;        // restore re-commits a checked value by type
```

The kitchen sink fixtures and the dev-only perf project go through `toCheckedProject(project, today)`, which throws `ProjectInvariantBreach` on a broken fixture instead of letting it reach the view. `forecast` takes `CheckedProject`, which turns its reliance on the Done rules (`src/lib/services/forecast.ts:76-80`) from a comment into a type. The readers' tolerance of unknown ids (`src/lib/services/task-graph.ts:2-3`) stays, because the guardian itself uses them on an unchecked import candidate; it simply can no longer be reached with a session Project.

### 4.7 The thin "route": the hook action and its handler

```ts
// src/hooks/useProject.ts — one line per action, unchanged in shape
const setStartDate = useCallback(
  (input: string) => apply((current) => edits.setStartDate(current, input, { today: today() })),
  [apply, today],
);

// src/components/planner/StartPanel.tsx — parse the DOM input, call the action, map the error to the view
const result = setStartDate(value);
setError(result.ok ? undefined : result.error.message);
```

The handler adds nothing to the rule. The picker's "(would create a cycle)" label stays an advisory hint.

### 4.8 Cost

The guardian runs every check on every edit: name regexes per Task, one pass over predecessors, one `findCycle`, all linear in Tasks + dependencies. The NFR budget is 200 ms for 100 Tasks (`prd.md:182`). Phase 2 measures an edit on `createPerfProject()` (`src/lib/services/fixtures.ts:21`) and records the time; no incremental checking is planned unless that measurement says so.

### 4.9 Today's value and monotonicity

With S-07, validity depends on today ("a completion date after today"). Today only moves forward, and that rule only gets easier to satisfy as it does, so a Project checked yesterday is still clean today and the "the Project before the edit was clean" argument (4.1) holds. If the clock moves backwards (a time-zone change mid-session), an unrelated edit may be rejected naming another Task's completion date; the message names that Task, so the user can see why. A file from a colleague whose today is ahead of the importer's is rejected as "a completion date after today", which the PRD requires.

## Step 5: Before/after, phased plan, tests

### 5.1 Before/after for every place the rule lives today

| #   | Place                                                                                            | Before                                                                  | After                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | `accept`, `src/lib/services/project.ts:36-38`                                                    | Wraps any project as `ok`                                               | The guardian: model-shape assertion, `validateProject`, optional explanation; mints `CheckedProject`                          |
| 2   | `createTask`, `:135-142`                                                                         | Local `checkName`, unbounded `nextTaskId`                               | Trim, build candidate, `accept`; id ceiling owned here (Phase 4)                                                              |
| 3   | `renameTask`, `:144-153`                                                                         | Addressing + local `checkName`                                          | Addressing, trim, `accept`                                                                                                    |
| 4   | `deleteTask`, `:160-171`                                                                         | Addressing; result unchecked, I-10 by argument                          | Addressing, `accept`: I-10 is now checked on every delete                                                                     |
| 5   | `addPredecessor`, `:173-189`                                                                     | Addressing + `cyclePathFor` as verdict                                  | Addressing, `accept`; `cyclePathFor` only words the message                                                                   |
| 6   | `removePredecessor`, `:191-199`                                                                  | Addressing; result unchecked                                            | Addressing, `accept`                                                                                                          |
| 7   | `setProjectName`, `:202-212`                                                                     | Local `checkName`                                                       | Trim, `accept`                                                                                                                |
| 8   | `setDuration`, `:229-244`                                                                        | Digits + `isPositiveWholeDays`                                          | Digits (parsing) only; positive whole is the guardian's                                                                       |
| 9   | `setStartDate`, `:247-256`                                                                       | `isIsoDate` only; no Done rule                                          | `accept`; the date rule and (S-07) completion dates are the guardian's                                                        |
| 10  | `setDayCountingMode`, `:266-269`                                                                 | "Never rejects"                                                         | `accept` (no rule today; a future one needs no edit change)                                                                   |
| 11  | `validateProject`, `:271-307`                                                                    | Import-only second checker; model shape "assumed"                       | The one rule list, used by `accept` and by import; takes `CheckContext`                                                       |
| 12  | Import pipeline, `src/lib/services/project-file.ts:369-379`                                      | `validateProject` without today; returns `Project`                      | Same stages; guardian with `wording: "file"` and today; returns `CheckedProject`                                              |
| 13  | `checkSupportedYet`, `project-file.ts:351-367`                                                   | Holds I-09 vacuously                                                    | Unchanged until Phase 5, then removed (the Done rules are in the guardian)                                                    |
| 14  | `MAX_NEXT_TASK_ID`, `project-file.ts:251-255`                                                    | Ceiling known only to import                                            | Owned by the aggregate (Phase 4, after Q-06)                                                                                  |
| 15  | `apply`, `src/hooks/useProject.ts:79-86`                                                         | Commits `ok` results                                                    | Same; passes `today`                                                                                                          |
| 16  | `replaceProject`, `useProject.ts:25-29`, `:123-130`                                              | Any `Project`, trusted by comment                                       | `CheckedProject` only, by type                                                                                                |
| 17  | `restorePreviousProject`, `useProject.ts:134-140`                                                | Safe by induction                                                       | `previousProject: CheckedProject`, safe by type                                                                               |
| 18  | Initial project, `useProject.ts:56-57`; `Planner.tsx:25-30`, `:34`; `KitchenSinkPlanner.tsx:121` | Any `Project`                                                           | `CheckedProject`; fixtures through `toCheckedProject` (throws on a broken one)                                                |
| 19  | `forecast`, `src/lib/services/forecast.ts:76-80`, `:82`                                          | Relies on unenforced Done rules by comment                              | Takes `CheckedProject`; the comment cites the guardian                                                                        |
| 20  | Picker flag, `TaskPanel.tsx:266-268`                                                             | Advisory                                                                | Unchanged, still advisory                                                                                                     |
| 21  | `topologicalOrder` throw, `task-graph.ts:177-178`                                                | Backstop                                                                | Unchanged backstop                                                                                                            |
| 22  | Crash screen export, `RenderCrashFallback.tsx:27-38`, `:55-60`                                   | Exports an unchecked Project (DR-01)                                    | Unchanged, deliberate exception                                                                                               |
| 23  | Process, `context/foundation/test-plan.md:124`                                                   | "a new rule is wired into its edit function and into `validateProject`" | "a new rule is one entry in `VALIDATION_ERROR_CHECKS`, tested once in the guardian table, plus one edit row and one file row" |

### 5.2 Phased plan

The project has a test runner with a test-first discipline (`/10x-tdd`, `context/foundation/test-plan.md` §6.1–§6.3). Phases marked **test-first** start with a failing test. Each phase ends green on `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`.

**Phase 0: Safety net (test-first; no production change).**

- Add `fast-check` as a dev dependency (never shipped; its shrinking reduces a failing edit sequence to the shortest one).
- Property test in `src/lib/services/project.test.ts`: from `createEmptyProject()`, apply random sequences of every exported edit with random arguments (valid and invalid names, Durations, dates, ids in and out of range). After each **accepted** edit, `validateProject(result.project)` is `undefined`. After each **rejected** edit, the project is `toBe` the one before. This is RK-01's "done when" and must pass on today's code: it pins today's behaviour before anything moves.
- Record a characterisation snapshot: for a fixed seed, the sequence of `(ok, rule)` outcomes. Phase 2 must reproduce it exactly.

**Phase 1: One rule list (test-first; behaviour-preserving).**

- Split `validateProject` into the `VALIDATION_ERROR_CHECKS` list and add `CheckContext` (with `today`, unused by today's rules).
- Add `assertModelShape` and `ProjectInvariantBreach`; tests: a hand-built Project with duplicate ids or unsorted predecessors throws.
- Existing `validateProject` tests (`src/lib/services/project.test.ts:428`) and the import rejection tables (`src/lib/services/project-file.test.ts:301`, `:401`, `:706`) stay green unchanged.

**Phase 2: `accept` becomes the guardian (test-first).**

- First a new failing test: an edit that only the whole-state check can catch. Before S-07 no real rule is indirect, so the test registers a test-only rule through an internal seam (for example "no two Tasks may both be named `X`") and asserts that `setDuration` on an unrelated Task is rejected with it. This proves every edit runs the guardian.
- Route every edit through the new `accept`; delete the local rule checks listed in 5.1 rows 2–10; keep addressing and parsing; keep `cyclePathFor` as the cycle explanation.
- The hook rejection table (`src/hooks/useProject.test.ts:56`) and every `project.test.ts` message assertion stay green with the same rule ids and message fragments. The Phase 0 snapshot is reproduced.
- Pass `today` from the hook (`options.today`, default the clock); the hook tests inject a fixed date.
- Measure one edit on `createPerfProject()` and record it against the 200 ms NFR.

**Phase 3: Seal the entry points (test-first, as type tests).**

- `CheckedProject` brand; `EditResult` and `ImportResult` carry it; `useProject` initial, `replaceProject` and `previousProject` require it; `forecast` takes it; `toCheckedProject` for the kitchen sink and perf fixtures.
- Type tests checked by `npx astro check`: `replaceProject(createEmptyProject())` fails under `@ts-expect-error`; `replaceProject` with a `parseProjectFile` result compiles (RK-06's "done when").
- An ESLint `no-restricted-syntax` rule forbids `as CheckedProject` outside `src/lib/services/project.ts` and `*.test.ts`. The render-crash fixture (`src/components/planner/Planner.test.ts:219`) casts on purpose, since it tests what happens when an invalid project gets in.

**Phase 4: Id ceiling owned by the aggregate (test-first; blocked on Q-06).**

- Move `MAX_NEXT_TASK_ID` to `src/lib/services/project.ts`; `createTask` at the ceiling either rejects or the file cap rises, as Q-06 decides. Test from RK-05: import a file with `nextTaskId` 2147483647, create one Task, then either see it rejected or re-import its export unchanged.

**Phase 5: The Done rules (test-first; this is roadmap S-07's first step, not part of this refactor's merge).**

- Add the five Done checks to `VALIDATION_ERROR_CHECKS` and their rule ids to `ValidationErrorRule`; add `setStatus` and `setCompletionDate` as addressing + parsing + `accept`, nothing more.
- Remove `checkSupportedYet`; replace its rejection rows with round-trip rows and the `project-file-0.1-statuses.json` golden file (`context/foundation/test-plan.md` §6.3).
- The acceptance test of the design: a search for each Done rule id finds it produced in exactly one function (RK-01's second "done when"), and `setStartDate` and `addPredecessor` have no Done-rule code yet reject the indirect cases below.

### 5.3 Test cases for the invariant

**Existing rules (Phases 0–2; most already exist and must stay green).**

| Operation                                                | Expected                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `createTask("A")`                                        | Accepted; id 1; `nextTaskId` 2                                                                             |
| `createTask("   ")`, `createTask("​")`                   | Rejected `task-name-empty`                                                                                 |
| `renameTask(1, "x".repeat(201))`                         | Rejected `task-name-too-long`; project `toBe` the one before                                               |
| `renameTask(1, "a\nb")`                                  | Rejected `task-name-control-character`                                                                     |
| A → B, then `addPredecessor(A, B)`                       | Rejected `cycle`, message names `1: A → 2: B → 1: A` (US-01)                                               |
| `addPredecessor(A, A)`                                   | Rejected `cycle`, `1: A → 1: A`                                                                            |
| `addPredecessor(A, 99)`                                  | Rejected `unknown-task`                                                                                    |
| A → B, `deleteTask(A)`                                   | Accepted; B has no predecessors (hangs off START); guardian finds nothing (I-10 checked)                   |
| `setDuration(A, "0")`, `"1.5"`, `"1e3"`, `"-2"`          | Rejected `duration-not-positive-whole-number`                                                              |
| `setDuration(A, "")`                                     | Accepted; a Validation Warning, not a Validation Error                                                     |
| `setStartDate("2026-02-30")`                             | Rejected `start-date-not-a-date`                                                                           |
| `setStartDate("")`                                       | Accepted; the forecast uses today                                                                          |
| `setDayCountingMode("weekdays")`                         | Accepted                                                                                                   |
| Random edit sequences (property)                         | After each accepted edit `validateProject` is undefined; after each rejected edit the project is unchanged |
| Test-only whole-state rule + unrelated edit (Phase 2)    | Rejected with the test rule: proves every edit reaches the guardian                                        |
| `toCheckedProject(cyclicProject)`                        | Throws `ProjectInvariantBreach` naming the cycle                                                           |
| `replaceProject(createEmptyProject())`                   | Does not compile                                                                                           |
| Hand-built Project with duplicate ids passed to `accept` | Throws `ProjectInvariantBreach` (`model-shape`)                                                            |

**Done rules (Phase 5, S-07).** Fixture from US-04 (`prd.md:107`): calendar days, START date 2026-09-01, A (5) → B (3).

| Operation                                                                       | today      | Expected                                                           |
| ------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| A Done on 2026-09-03                                                            | 2026-09-03 | Accepted                                                           |
| A In Progress                                                                   | 2026-09-03 | Accepted; forecast unchanged (`prd.md:115`)                        |
| A Done on 2026-09-01 (= START date), B Done on 2026-09-01 (= A's), both = today | 2026-09-01 | Accepted (all three boundaries equal)                              |
| A Done with no completion date                                                  | 2026-09-03 | Rejected `task-done-without-completion-date` (`prd.md:116`)        |
| B Done while A To Do                                                            | 2026-09-03 | Rejected `task-done-predecessor-not-done` (`prd.md:118`)           |
| A Done on 2026-09-04                                                            | 2026-09-03 | Rejected `completion-date-after-today`                             |
| A Done on 2026-08-31                                                            | 2026-09-03 | Rejected `completion-date-before-start-date`                       |
| A Done 2026-09-03, B Done 2026-09-02                                            | 2026-09-05 | Rejected `completion-date-before-predecessor`                      |
| A, B Done; set A to To Do (indirect)                                            | 2026-09-05 | Rejected `task-done-predecessor-not-done`, naming B (`prd.md:119`) |
| A Done 2026-09-03; `setStartDate("2026-09-04")` (indirect)                      | 2026-09-05 | Rejected `completion-date-before-start-date`, naming A             |
| A, B Done; new To Do Task C; `addPredecessor(B, C)` (indirect)                  | 2026-09-05 | Rejected `task-done-predecessor-not-done`, naming B                |
| A Done; clear A's completion date (indirect)                                    | 2026-09-05 | Rejected `task-done-without-completion-date`                       |
| A, B Done; `deleteTask(A)`                                                      | 2026-09-05 | Accepted: B Done with no predecessors breaks no rule               |
| A, B Done; `removePredecessor(B, A)`                                            | 2026-09-05 | Accepted                                                           |
| Each rejected Done row above as a hand-edited file                              | as above   | Import rejected with the same rule, file wording                   |
| `project-file-0.1-statuses.json` golden file                                    | 2026-10-18 | Imports to its hand-written Project; round-trips byte for byte     |

Each new Done rule also gets one row in the hook rejection table (`src/hooks/useProject.test.ts:56`) and one in `validationErrorRows` (`src/lib/services/project-file.test.ts:301`), per test-plan §6.2 and §6.3. Mutation testing: run Stryker on the guardian's lines only, mindful of the known runner false result in `PROJECT_RULES.md`.

### 5.4 Load-bearing names to register

The repository has no contract registry (a search of the non-archived Markdown found none); `context/domain/glossary.md` is the closest thing, and the names below should be added there when the change lands.

| Name                                                                                                                                                                            | Meaning                                                                                 | Phase |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----- |
| Checked project / `CheckedProject`                                                                                                                                              | A Project the guardian found free of Validation Errors; the only kind the session holds | 3     |
| `VALIDATION_ERROR_CHECKS`                                                                                                                                                       | The one list of Validation Error rules; a new rule is one entry here                    | 1     |
| `CheckContext`, `EditContext`                                                                                                                                                   | What a check needs besides the Project: `today`, and the wording (edit or file)         | 1, 2  |
| `ProjectInvariantBreach`                                                                                                                                                        | Thrown when code (never a user) hands the aggregate an impossible or unchecked Project  | 1     |
| `toCheckedProject`                                                                                                                                                              | The trusted entry for fixtures; throws instead of admitting a broken Project            | 3     |
| `setStatus`, `setCompletionDate`                                                                                                                                                | The S-07 edits; addressing and parsing only                                             | 5     |
| `task-done-without-completion-date`, `task-done-predecessor-not-done`, `completion-date-after-today`, `completion-date-before-start-date`, `completion-date-before-predecessor` | The Done rule ids (`ValidationErrorRule`)                                               | 5     |

"Don't call it": a "valid project" or "invalid project" (the PRD's word is Validation Error, `PROJECT_RULES.md`), and a "validator" for the guardian when talking about the domain (it is the Project aggregate's own check).

### 5.5 Open decisions this plan depends on

| Question                                                                                                                                                                                           | Blocks                             | Owner         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------- |
| Q-06: at the id ceiling, should `createTask` refuse, or should the file cap rise?                                                                                                                  | Phase 4                            | Developer     |
| Q-05: is a duplicate Task id a Validation Error or a file-format error? (Today the file module owns it, and this plan keeps it there.)                                                             | Nothing; changes one row's rule id | Product owner |
| Is `fast-check` acceptable as a dev dependency, or should Phase 0 use a seeded hand-written generator?                                                                                             | Phase 0                            | Developer     |
| Does "a completion date before the START date" apply when the START date is unset? This plan assumes not: an unset START date means today for the forecast, and no completion date is after today. | Phase 5                            | Product owner |

## Summary

The chosen invariant is the PRD's strictest Guardrail, "a Project never holds a Validation Error", in its "directly or indirectly" form (FR-019). Each individual rule is enforced today, but only as a local check inside the edit that can break it, plus a second checker that runs only on import, so nothing ever checks the Project an edit produces, and the session accepts replaced, restored and initial Projects on trust. The weakness is a missing owner rather than a missing check, and it becomes a real gap with roadmap S-07: the Done rules are indirect by nature, would have to be written into at least five places, and `forecast()` already depends on them. The design makes `accept`, already the single producer of an accepted edit, the guardian: it checks the whole candidate against one list of rules, so a rule written once is enforced on every edit and on import, and an indirect break is caught without the edit knowing the rule exists. User mistakes stop as named `ValidationError` results that leave the Project unchanged, and impossible states (a broken model shape, an unchecked Project at a trusted door) throw `ProjectInvariantBreach` instead of being tolerated. A `CheckedProject` type closes the session's entry points, so `replaceProject`, `restorePreviousProject`, the initial Project and the forecast can only receive what the guardian accepted. The work runs in five phases, four of them test-first: a property-test safety net, one rule list, the guardian `accept`, the sealed entry points, then the id ceiling once Q-06 is decided; the Done rules follow as S-07's first step and prove the design by needing no code in `setStartDate` or `addPredecessor`. No server, API or persistence layer is added, in line with the static-only hard rule.
