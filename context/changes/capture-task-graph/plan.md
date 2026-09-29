# Capture the Task Graph (S-01) Implementation Plan

## Overview

Deliver roadmap slice S-01 (FR-001, FR-002, FR-003, FR-008): the user creates Tasks by name, renames and deletes them, adds and removes predecessors in a side panel, and sees the project as an auto-arranged left-to-right diagram in which Tasks without predecessors hang off START and Tasks without successors feed FINISH. The project model is plain data edited only through pure functions in `src/lib/services/`; the diagram is a pure projection of it laid out by dagre and rendered by React Flow in one `client:only` React island. Edits that would create a Validation Error never reach the project: START/FINISH violations are unrepresentable, and cycle-closing Tasks are withheld from the predecessor picker (the explanation naming the cycle is S-02).

## Current State Analysis

- The app is a placeholder: `src/pages/index.astro:5-9` renders a `<main>` with a heading; no `client:*` island exists anywhere under `src/`. `src/layouts/Layout.astro:24-31` gives `html, body` full height.
- No domain code exists beyond the F-01 smoke test (`src/lib/services/smoke.test.ts`); `src/types.ts` and `src/hooks/` do not exist yet although `PROJECT_RULES.md` and `components.json:18` designate them.
- Only one shadcn primitive is installed (`src/components/ui/button.tsx`, variants `destructive`/`ghost`, size `icon`).
- Neither `@xyflow/react` nor `@dagrejs/dagre` is installed (`package.json`). Research (`research.md`) confirmed compatibility of 12.12.0 / 3.1.1 on paper but did not install or build them.
- The CSP (`astro.config.mjs:22-36`) has hashed `style-src` without `'unsafe-inline'`, `connect-src 'none'`, `form-action 'none'`, and is only in effect under `npm run build && npm run preview`.

## Desired End State

Opening the app shows a toolbar with a "New Task" input and an empty diagram START → FINISH. Typing names and pressing Enter adds Task nodes that each hang between START and FINISH; the input stays focused for the next name. Clicking a Task node selects it and opens the side panel, where the user can rename it, see its predecessors (each with a remove button), add a predecessor from a select listing only eligible Tasks as "7: Name" in id order, and delete it. The diagram re-arranges on every structural edit; nodes cannot be dragged or connected by hand. An empty or over-long name is refused with a message naming the rule and the project stays unchanged. The build passes the full gate and shows zero CSP violations under `npm run preview`.

Verify by: the full gate (`npx astro sync && npm run lint && npx astro check && npm test && npm run build`), the unit tests listed per phase, and the manual checks in Phase 4 (MVP flow steps 1–2, 200 ms at 100 Tasks, CSP under preview).

### Key Discoveries:

- React Flow renders inline `style` attributes; build-time-rendered HTML with them is blocked by the CSP, so the island must be `client:only="react"` (`research.md` Summary 1; `dist/index.html` meta).
- dagre's `Graph`/`layout` generics default to `any` (`@dagrejs/dagre` `dist/types/lib/graph-lib.d.ts:2-3`), which trips `strictTypeChecked` (`eslint.config.js:17`); both libraries export a type named `Edge`.
- `react-hooks` `recommended-latest` (`eslint.config.js:44`) flags the docs' `useNodesState` + `useEffect(setNodes(...))` pattern; nodes/edges must be derived with `useMemo`.
- React Flow's `style.css` is unlayered and would beat Tailwind's layered utilities; its `colorMode="dark"|"system"` toggles the app's `.dark` tokens inside the canvas only (`src/styles/global.css:13,50-82`).
- dagre returns node **centres**; React Flow positions by **top-left** (`docs-xyflow-dagre.md`). A fresh `Graph` per layout call is required, or deleted Tasks leak.
- Tests: Vitest discovers only `src/**/*.test.ts` in the `node` environment (`vitest.config.ts:5`); modules under test must import React Flow symbols as `import type` only.
- Lessons: "Verify the artifact, not the config" — CSP compliance is checked in the built preview; "Pin the build's input set" — importing React Flow CSS does not widen Tailwind's `@source` scan (`global.css:5-11`).

## What We're NOT Doing

- Explaining a refused cycle (naming A → B → C → A) — S-02. S-01 only withholds cycle-closing candidates and keeps a defensive rejection in the domain function.
- Export/import, project name UI, file format — S-03 (the model already carries every field the file will need).
- START date, Durations, Statuses, completion dates UI, forecasts, Validation Warnings, critical-path highlight — S-04 to S-07. The types include these fields as optional/defaulted; no UI sets them.
- Selecting or editing START/FINISH on the diagram — nothing to edit until S-04.
- Drawing dependencies on the diagram (FR-018, parked), dragging nodes (PRD non-goal "Manual layout"), MiniMap, dark mode.
- Undo, delete confirmation, bridging a deleted Task's predecessors to its successors.
- Keyboard selection of diagram nodes and accessibility beyond native form controls (no PRD requirement).
- Persisting work across refresh (FR-015, parked).
- Hiding React Flow's attribution link — kept as shipped.
- Using `graphlib.alg` for cycle detection — domain rules stay in pure, tested TypeScript independent of the layout library.
- Component tests (jsdom / testing-library) — outside the F-01 setup; UI is verified manually.

## Implementation Approach

Retire the toolchain unknowns first (Rolldown handling zustand's CJS shim, `react/prop-types` behaviour, CSS layering, CSP) with a minimal island, before any feature code depends on them. Then build the domain in two pure, unit-tested layers — the project model with its edit functions, and the diagram projection with dagre layout — so every rule is checked in Node. The UI phase only wires those functions to React state: one `useProject` hook holds the project and the selected Task id, every user action calls an edit function, and a rejection is shown to the user while the project stays unchanged (validate-then-commit, US-01). The same edit functions become the rule check S-02 extends and S-03 reuses on import.

## Critical Implementation Details

**State sequencing** — Layout must be memoized on the project alone and selection applied in a second, cheap pass; otherwise every click re-runs dagre. The selected Task id is stored as given and resolved against the current project on read (a deleted Task simply resolves to "nothing selected") — do not clear it from an effect.

**User experience spec** — The panel's rename field keeps a local draft and commits on Enter or blur, not per keystroke (committing per keystroke would reject every intermediate empty name). On rejection, the draft stays and the message naming the rule is shown under the field; Escape restores the committed name. All forms call `preventDefault` in `onSubmit`: the CSP's `form-action 'none'` blocks native submission.

**Performance constraints** — PRD NFR: edit → validation → layout → render within 200 ms at 100 Tasks. Fixed node sizes allow a single synchronous layout pass (no wait for measurement).

## Phase 1: Toolchain Probe

### Overview

Install the diagram libraries and the two shadcn primitives, wire React Flow's CSS into the Tailwind layers, and mount a minimal `client:only` island that renders a static START → FINISH diagram. Prove the full gate and the built preview are clean before feature work begins.

### Changes Required:

#### 1. Dependencies

**File**: `package.json`, `package-lock.json`

**Intent**: Add the diagram and layout libraries, plus the shadcn `input` and `label` primitives the side panel and toolbar need.

**Contract**: `@xyflow/react@^12.12.0` and `@dagrejs/dagre@^3.1.1` in `dependencies`; `npx shadcn@latest add input label` creates `src/components/ui/input.tsx` and `src/components/ui/label.tsx` (new-york variant, adds `@radix-ui/react-label`).

#### 2. React Flow styles

**File**: `src/styles/global.css`

**Intent**: Load React Flow's required styles inside a cascade layer so Tailwind utilities on custom nodes win over them.

**Contract**: One `@import "@xyflow/react/dist/style.css" layer(components);` placed with the existing imports at `global.css:5-6`. `@source` pins stay untouched.

#### 3. Planner island shell

**File**: `src/components/planner/Planner.tsx` (new)

**Intent**: The single React island root; in this phase it renders `<ReactFlow>` with two hard-coded nodes (START, FINISH) and one edge, `colorMode="light"`, `nodesDraggable={false}`, `nodesConnectable={false}`, `fitView`, plus `<Background>` and `<Controls>`, wrapped in `ReactFlowProvider`.

**Contract**: default-less named export `Planner`, no props. Replaced by the real content in Phase 4.

#### 4. Page mount

**File**: `src/pages/index.astro`

**Intent**: Replace the placeholder with the island in a full-viewport container (React Flow needs an explicit-height parent; `min-h-screen` is insufficient).

**Contract**: `<Planner client:only="react" />` inside a container with `h-dvh`; no other hydration directive is permitted (CSP blocks server-rendered inline styles).

### Success Criteria:

#### Automated Verification:

- Full gate passes: `npx astro sync && npm run lint && npx astro check && npm test && npm run build`
- The island is client-only in the built page: `grep -q 'client="only"' dist/index.html` succeeds (no server-rendered React Flow markup with inline styles)

#### Manual Verification:

- `npm run build && npm run preview`: the page shows START → FINISH with zoom controls and a background grid, and the browser console shows zero CSP violations or other errors
- Tailwind utilities still apply (toolbar/heading styling unchanged) and React Flow's controls are styled correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. If lint reports a `react/prop-types` false positive on typed node props, disable that rule for `.tsx` in `eslint.config.js` with a comment citing TypeScript prop checking, and note it in the phase commit.

---

## Phase 2: Domain Model and Edit Functions

### Overview

Define the project model and the pure edit functions that are the only way to change it. Each function returns either the new project or a rejection naming the rule; the input project is never mutated.

### Changes Required:

#### 1. Shared types

**File**: `src/types.ts` (new)

**Intent**: The project model that every later slice and the S-03 file format build on. START and FINISH are distinct entities, never Tasks, so no Task can reference them.

**Contract**:

```ts
type TaskId = number; // positive integer, assigned sequentially from 1, never reused within a project
type TaskStatus = "to-do" | "in-progress" | "done";
type DayCountingMode = "calendar-days" | "weekdays";

interface Task {
  id: TaskId;
  name: string; // trimmed, 1..200 chars
  predecessors: TaskId[]; // Task ids only, no duplicates, ascending id order
  duration?: number; // S-04
  status: TaskStatus; // "to-do" on creation; S-07
  completionDate?: string; // ISO yyyy-mm-dd; S-07
}

interface Start {
  date?: string; // ISO yyyy-mm-dd; S-04
}
type Finish = Record<string, never>; // placeholder for future attributes

interface Project {
  name?: string; // S-03
  start: Start;
  finish: Finish;
  dayCountingMode: DayCountingMode; // "calendar-days" by default; S-06
  nextTaskId: TaskId; // id the next created Task gets
  tasks: Task[]; // creation order
}
```

`Finish` must not be `{}` or an empty interface (`@typescript-eslint/no-empty-object-type` under `strictTypeChecked`).

#### 2. Validation Error vocabulary and edit result

**File**: `src/lib/services/project.ts` (new)

**Intent**: A single result shape for every edit, using the PRD term Validation Error, so S-02/S-07 add rules without restructuring and S-03 import reuses the same checks.

**Contract**: `ValidationError { rule: ValidationErrorRule; message: string }`, with `ValidationErrorRule` = `"task-name-empty" | "task-name-too-long" | "unknown-task" | "cycle"`; `EditResult = { ok: true; project: Project } | { ok: false; error: ValidationError }`. Messages name the rule and never use "invalid", "conflict" or "blocked" (e.g. "A Task name cannot be empty.", "A Task name can be at most 200 characters.", "Adding this predecessor would create a cycle.").

#### 3. Edit functions

**File**: `src/lib/services/project.ts`

**Intent**: FR-001/FR-002/FR-003 as pure functions.

**Contract**:

- `createEmptyProject(): Project` — no tasks, `nextTaskId: 1`, `start: {}`, `finish: {}`, `dayCountingMode: "calendar-days"`.
- `createTask(project, name): EditResult` — trims and checks the name; appends `{ id: nextTaskId, name, predecessors: [], status: "to-do" }`; increments `nextTaskId`.
- `renameTask(project, taskId, name): EditResult` — same name rules; `unknown-task` if the id is absent; references are untouched.
- `deleteTask(project, taskId): EditResult` — removes the Task and removes its id from every other Task's predecessors; does not bridge predecessors to successors; does not change `nextTaskId`.
- `addPredecessor(project, taskId, predecessorId): EditResult` — `unknown-task` if either id is absent; `cycle` if `wouldCreateCycle`; adding an existing predecessor returns the project unchanged (`ok: true`); otherwise inserts the id so `predecessors` stays in ascending id order.
- `removePredecessor(project, taskId, predecessorId): EditResult` — `unknown-task` if the Task is absent; removing a non-predecessor returns the project unchanged.
- `TASK_NAME_MAX_LENGTH = 200` exported for the inputs' `maxLength`.

#### 4. Graph queries

**File**: `src/lib/services/task-graph.ts` (new)

**Intent**: Pure structural queries used by the edit functions, the picker and the projection.

**Contract**:

- `wouldCreateCycle(project, taskId, predecessorId): boolean` — true when `predecessorId === taskId` or `predecessorId` transitively depends on `taskId`.
- `eligiblePredecessors(project, taskId): Task[]` — every Task except itself, its current predecessors and those for which `wouldCreateCycle` is true; in ascending id order.
- `successorsOf(project, taskId): TaskId[]`.

#### 5. Tests

**File**: `src/lib/services/project.test.ts`, `src/lib/services/task-graph.test.ts` (new)

**Intent**: Pin every rule above; the input project must be deep-equal before and after every call (no mutation), and unchanged on every rejection.

**Contract**: see Testing Strategy → Unit Tests.

### Success Criteria:

#### Automated Verification:

- Domain tests pass: `npm test`
- Full gate passes: `npx astro sync && npm run lint && npx astro check && npm test && npm run build`

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3 (no manual checks in this phase).

---

## Phase 3: Diagram Projection and Layout

### Overview

Turn a project into React Flow nodes and edges — including the synthetic START/FINISH links — and position them with dagre. Pure and unit-tested in Node.

### Changes Required:

#### 1. Projection and layout

**File**: `src/lib/services/diagram-layout.ts` (new)

**Intent**: The one place that knows how the model becomes a diagram: START (`id: "start"`) and FINISH (`id: "finish"`) nodes always exist; every Task becomes a node; each predecessor link becomes an edge; a Task with no predecessors gets an edge from START; a Task with no successors gets an edge to FINISH; an empty project gets a single START → FINISH edge. Layout is dagre `rankdir: "LR"` with fixed node sizes.

**Contract**: `layoutDiagram(project: Project): { nodes: DiagramNode[]; edges: DiagramEdge[] }`, where `DiagramNode` is a React Flow `Node` union of `Node<{ name: string; taskId: TaskId }, "task">`, `Node<Record<string, never>, "start">` and `Node<Record<string, never>, "finish">` with top-level `width`/`height` set, `position` converted from dagre's centre to top-left, `targetPosition: "left"`, `sourcePosition: "right"`; edges have deterministic ids `"<source>-><target>"` and a closed arrow marker. Node ids: `"start"`, `"finish"`, and `String(task.id)` for Tasks (React Flow ids are strings; no collision since Task ids are numeric); click handling reads `data.taskId`, never parses the node id. A fresh `new Graph<GraphLabel, NodeLabel, EdgeLabel>()` per call; named imports from `@dagrejs/dagre`; React Flow symbols imported with `import type` only; alias one of the two `Edge` types. Exported size constants (Task node ~180×44, START/FINISH nodes ~96×40).

#### 2. Performance fixture

**File**: `src/lib/services/fixtures.ts` (new)

**Intent**: A deterministic 100-Task project (layered, with branches and joins) used by tests and by the dev-only 200 ms check in Phase 4.

**Contract**: `createPerfProject(taskCount = 100): Project`, built only through the Phase 2 edit functions so it is guaranteed free of Validation Errors.

#### 3. Tests

**File**: `src/lib/services/diagram-layout.test.ts` (new)

**Intent**: Pin the projection rules and the coordinate conversion; see Testing Strategy.

### Success Criteria:

#### Automated Verification:

- Layout tests pass: `npm test`
- Full gate passes: `npx astro sync && npm run lint && npx astro check && npm test && npm run build`

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4 (no manual checks in this phase).

---

## Phase 4: Planner UI

### Overview

Wire the domain to the island: project and selection state, the toolbar "New Task" input, custom nodes, click selection, and the side panel for rename, predecessors and delete.

### Changes Required:

#### 1. Project state hook

**File**: `src/hooks/useProject.ts` (new)

**Intent**: Holds the project and the selected Task id; exposes one action per edit function. An action applies the edit function and commits the new project only on `ok: true`, returning the `EditResult` so the caller can show the rejection.

**Contract**: `useProject(initial?: Project)` → `{ project, selectedTask: Task | undefined, select(id | null), createTask(name), renameTask(id, name), deleteTask(id), addPredecessor(id, predId), removePredecessor(id, predId) }`; edit actions return `EditResult`. `selectedTask` is resolved from the stored id against the current project on each render.

#### 2. Custom nodes

**File**: `src/components/planner/TaskNode.tsx`, `src/components/planner/StartNode.tsx`, `src/components/planner/FinishNode.tsx` (new)

**Intent**: Tailwind-styled, `memo`-wrapped nodes; Task node shows the name truncated with the full name in `title` and a distinct style when `selected`; StartNode and FinishNode show "START" and "FINISH" in a shape visibly different from Task nodes, sharing their styling via a small common class set or wrapper in the same folder. Handles are hidden from interaction (`isConnectable={false}`): TaskNode has a target handle on the left and a source handle on the right; StartNode has only a source handle (right); FinishNode has only a target handle (left).

**Contract**: `NodeProps<TaskNodeType>` / `NodeProps<StartNodeType>` / `NodeProps<FinishNodeType>` using the types from `diagram-layout.ts`; `nodeTypes = { task: TaskNode, start: StartNode, finish: FinishNode }` defined at module scope. Classes merged with `cn()`.

#### 3. Diagram

**File**: `src/components/planner/Diagram.tsx` (new)

**Intent**: Renders the laid-out project: `useMemo(() => layoutDiagram(project), [project])`, then a second `useMemo` marking the selected Task node `selected: true`. `onNodeClick` selects Task nodes only (START and FINISH ignored); `onPaneClick` clears selection. Refit the view when the set of Task ids changes (create/delete), not on rename or selection.

**Contract**: props `{ project, selectedTaskId, onSelect }`; `<ReactFlow>` with `nodeTypes`, controlled `nodes`/`edges`, no `onNodesChange`, `nodesDraggable={false}`, `nodesConnectable={false}`, `colorMode="light"`, `fitView`, `<Background>`, `<Controls showInteractive={false}>`; handlers wrapped in `useCallback`. Attribution link left as shipped.

#### 4. Toolbar

**File**: `src/components/planner/NewTaskForm.tsx` (new)

**Intent**: Always-visible labelled "New Task" input; Enter creates the Task, clears the input and keeps focus; the current selection is unchanged and the new Task is not selected. A rejection (empty or too long) is shown inline under the input and the text is kept.

**Contract**: `<form onSubmit>` with `preventDefault`; shadcn `Input` + `Label`; `maxLength={TASK_NAME_MAX_LENGTH}`; calls `createTask` and reads the `EditResult`.

#### 5. Side panel

**File**: `src/components/planner/TaskPanel.tsx` (new)

**Intent**: Shown when a Task is selected (otherwise a short hint to select a Task). Contains: a rename field (draft, commit on Enter/blur, rejection message, Escape restores — see Critical Implementation Details); the predecessor list in ascending id order (the order of `task.predecessors`), each entry "7: Name" and a ghost icon button with an accessible label to remove it; a native `<select>` "Add predecessor" whose options are `eligiblePredecessors` in ascending id order, labelled "7: Name", which adds on change and resets to its placeholder (disabled with a note when no Task is eligible); a destructive "Delete Task" button that deletes immediately, with no confirmation.

**Contract**: props `{ task, project, actions }`; uses the `--sidebar-*` tokens (`global.css:40-47`); remounted per selected Task (`key={task.id}`) so the rename draft resets on selection change.

#### 6. Planner composition

**File**: `src/components/planner/Planner.tsx`

**Intent**: Replace the Phase 1 shell: toolbar across the top, diagram filling the rest, side panel on the right; all state from `useProject`. In dev only, `?fixture=perf100` starts from `createPerfProject()` for the 200 ms check.

**Contract**: the fixture branch is guarded by `import.meta.env.DEV` so it is dead-code-eliminated from the production build.

### Success Criteria:

#### Automated Verification:

- Full gate passes: `npx astro sync && npm run lint && npx astro check && npm test && npm run build`
- Dev fixture is absent from the build: `grep -rl "perf100" dist/` returns nothing

#### Manual Verification:

- MVP flow steps 1–2 under `npm run build && npm run preview`: create A, B, C via the toolbar without leaving the input; set A → B, B → C in the panel; the diagram shows START → A → B → C → FINISH
- With A → B → C, selecting A shows neither B nor C in "Add predecessor"; selecting C offers no Task that would close a cycle; START and FINISH never appear as options
- Two Tasks named "Design" are distinguishable in the picker and predecessor list by their "N: " id prefix
- Submitting an empty/whitespace name or renaming to empty shows a message naming the rule and leaves the project unchanged; Escape restores the old name
- Deleting B (with A → B → C) leaves C hanging off START and A feeding FINISH, clears the panel, and a newly created Task gets a fresh id (not B's)
- Nodes cannot be dragged or connected; clicking the pane deselects; clicking START/FINISH selects nothing
- 200 ms NFR: in `npm run dev` with `?fixture=perf100` in Chrome on the development Mac, adding and removing a predecessor and deleting a Task each commit in under 200 ms in the React Profiler / Performance panel
- Browser console under `npm run preview` shows zero CSP violations or errors during the whole flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `project.test.ts`: `createEmptyProject` shape; `createTask` trims, assigns ids 1, 2, … and increments the counter; empty, whitespace-only and 201-char names are rejected with the right rule while 200 chars are accepted; duplicate names allowed; rename keeps id and predecessors of dependents; rename/delete/add/remove on an unknown id → `unknown-task`; delete removes the id from all dependents, does not bridge (A → B → C, delete B → C has no predecessors, A has no successors), and does not decrement `nextTaskId` (delete Task 3 of three, create → id 4); `addPredecessor` rejects self and a transitive cycle (A → B → C, add C as predecessor of A) with `cycle`, is idempotent for an existing predecessor, and keeps `predecessors` in ascending id order (add 5 then 2 → `[2, 5]`); every rejection leaves the input deep-equal and every call leaves the input unmutated.
- `task-graph.test.ts`: `wouldCreateCycle` for self, direct, transitive and unrelated cases in a diamond graph; `eligiblePredecessors` excludes self, existing predecessors and all descendants, returns Tasks in ascending numeric id order (2 before 10).
- `diagram-layout.test.ts`: empty project → START, FINISH, one START → FINISH edge; a lone Task → START → node `"1"` → FINISH; A → B yields START → A, A → B, B → FINISH and no START → B or A → FINISH; node count = tasks + 2 and no edge references a deleted Task; START is left of every Task and FINISH right of every Task; positions are top-left (dagre centre minus half size); edge ids are deterministic; the 100-Task fixture lays out without overlapping node rectangles.

### Integration Tests:

- None automated (no component-test setup in F-01). The Phase 4 manual checks cover the island end to end.

### Manual Testing Steps:

1. `npm run build && npm run preview`, open the page with DevTools console open.
2. Create A, B, C from the toolbar; link A → B → C in the panel; confirm the diagram.
3. Try every refusal: empty name, cycle candidates missing from the picker, duplicate names distinguishable.
4. Delete B; confirm fallback to START/FINISH and fresh ids afterwards.
5. `npm run dev`, open `/?fixture=perf100`, profile three edits against the 200 ms budget.

## Performance Considerations

dagre layout of ~100 nodes is a single synchronous pass; memoizing it on the project (not on selection) keeps selection clicks cheap. Custom nodes are `memo`-wrapped and `nodeTypes` is module-scoped so React Flow does not re-mount nodes. Measurement is in dev mode (slower than production), which makes a pass conservative.

## Migration Notes

None — no persisted data exists yet. The model shape is the starting point for S-03's file format.

## References

- Research: `context/changes/capture-task-graph/research.md`
- Library docs: `context/changes/capture-task-graph/docs-xyflow-dagre.md`
- Library selection: `context/changes/capture-task-graph/research-diagram-libraries.md`
- PRD: `context/foundation/prd.md` (FR-001–FR-003, FR-008, NFR 200 ms, Non-Goals "Manual layout")
- Roadmap: `context/foundation/roadmap.md` (S-01, S-02, S-03 risk notes)
- Test pattern: `src/lib/services/smoke.test.ts:5-13`
- shadcn pattern: `src/components/ui/button.tsx:7-50`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Toolchain Probe

#### Automated

- [ ] 1.1 Full gate passes: `npx astro sync && npm run lint && npx astro check && npm test && npm run build`
- [ ] 1.2 The island is client-only in the built page: `grep -q 'client="only"' dist/index.html` succeeds (no server-rendered React Flow markup with inline styles)

#### Manual

- [ ] 1.3 `npm run build && npm run preview`: the page shows START → FINISH with zoom controls and a background grid, and the browser console shows zero CSP violations or other errors
- [ ] 1.4 Tailwind utilities still apply (toolbar/heading styling unchanged) and React Flow's controls are styled correctly

### Phase 2: Domain Model and Edit Functions

#### Automated

- [ ] 2.1 Domain tests pass: `npm test`
- [ ] 2.2 Full gate passes: `npx astro sync && npm run lint && npx astro check && npm test && npm run build`

### Phase 3: Diagram Projection and Layout

#### Automated

- [ ] 3.1 Layout tests pass: `npm test`
- [ ] 3.2 Full gate passes: `npx astro sync && npm run lint && npx astro check && npm test && npm run build`

### Phase 4: Planner UI

#### Automated

- [ ] 4.1 Full gate passes: `npx astro sync && npm run lint && npx astro check && npm test && npm run build`
- [ ] 4.2 Dev fixture is absent from the build: `grep -rl "perf100" dist/` returns nothing

#### Manual

- [ ] 4.3 MVP flow steps 1–2 under `npm run build && npm run preview`: create A, B, C via the toolbar without leaving the input; set A → B, B → C in the panel; the diagram shows START → A → B → C → FINISH
- [ ] 4.4 With A → B → C, selecting A shows neither B nor C in "Add predecessor"; selecting C offers no Task that would close a cycle; START and FINISH never appear as options
- [ ] 4.5 Two Tasks named "Design" are distinguishable in the picker and predecessor list by their "N: " id prefix
- [ ] 4.6 Submitting an empty/whitespace name or renaming to empty shows a message naming the rule and leaves the project unchanged; Escape restores the old name
- [ ] 4.7 Deleting B (with A → B → C) leaves C hanging off START and A feeding FINISH, clears the panel, and a newly created Task gets a fresh id (not B's)
- [ ] 4.8 Nodes cannot be dragged or connected; clicking the pane deselects; clicking START/FINISH selects nothing
- [ ] 4.9 200 ms NFR: in `npm run dev` with `?fixture=perf100` in Chrome on the development Mac, adding and removing a predecessor and deleting a Task each commit in under 200 ms in the React Profiler / Performance panel
- [ ] 4.10 Browser console under `npm run preview` shows zero CSP violations or errors during the whole flow
