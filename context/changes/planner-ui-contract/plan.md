# Planner UI Contract Implementation Plan

## Overview

Put the Planner at `/` on its design-system contract: close the five charges raised in `research.md` (C1–C5) in the `/10x-ui` order (environment → token values → view → states), prove every cell of the 7-state matrix on a dev-only kitchen-sink page, and leave a rule plus lint checks so the next agent stays on the tokens and components.

## Current State Analysis

The Planner already reads the repo's shadcn system: one hardcoded-value scan hit in 10 view files (`TaskPanel.tsx:171`, `ring-[3px]`), and every colour class in `src/components/planner/*.tsx` is a token class. The drift sits where the view leaves the contract:

- **C1** — the "Add predecessor" control is a hand-built `<select>` copying `Input` classes, without `aria-invalid`, `transition` or dark styling (`TaskPanel.tsx:161-173`).
- **C2** — the diagram canvas (edges, arrowheads, background dots, zoom controls, attribution) is painted by React Flow's built-in hex defaults (`node_modules/@xyflow/react/dist/style.css:6-47`); edges at `#b1b1b7` are ~2.1:1 against white, under the 3:1 non-text floor. Task nodes (`bg-card`) and the page (`bg-background`) are both `oklch(1 0 0)`.
- **C3** — `nodesFocusable={false}` (`Diagram.tsx:63-65`): a keyboard user can create Tasks but never reach rename, predecessors or Delete Task.
- **C4** — an empty project shows START → FINISH and "Select a Task on the diagram to edit it." with no Task to select (`Planner.tsx:43-44`).
- **C5** — `<Planner client:only="react" />` has no fallback (`index.astro:9`): blank page until (or if never) the island runs.

## Desired End State

- The predecessor picker is the shared `NativeSelect` from `src/components/ui/`, sharing `Input`'s focus, error and disabled states.
- Every colour the canvas draws comes from a role in `src/styles/global.css`; changing `--muted-foreground`, `--border`, `--muted` or `--card` moves edges, arrowheads, dots and controls with it. The canvas is a muted surface; Task nodes read as white cards on it.
- A keyboard user can Tab to any Task node (not START/FINISH), sees a `--ring` focus ring, presses Enter or Space to select it and lands in "Task name"; after Delete Task, focus returns to the New Task input. The Delete key on the diagram does nothing.
- A first-run empty project tells the user to start in the New Task field; a slow or failed load shows a token-styled skeleton, and no-JavaScript shows a one-line explanation.
- `npm run dev` serves `/kitchen-sink` with every 7-state cell shown or marked N/A with a reason; `npm run build` emits no kitchen-sink page and byte-identical CSS whether or not the kitchen-sink files exist.
- `PROJECT_RULES.md` carries a UI block; `npm run lint` fails on a literal colour, palette class or arbitrary value in the planner views, and runs jsx-a11y on `.tsx`.

Verify with: the hardcoded-value scan returning 0 hits on the view files, `npm run lint && npx astro check && npm test && npm run build`, the kitchen-sink screenshots at 1440 and 1024, and the probes listed per phase.

### Key Discoveries:

- `npx shadcn view native-select` lists only `cn` as a registry dependency and imports `lucide-react` (already installed): no new package. Its `className` lands on the `<select>`; the wrapper is `relative w-fit`.
- React Flow markers take their colour from the `defaultMarkerColor` prop (default `'#b1b1b7'`, applied as an inline style); `null` makes them fall back to `--xy-edge-stroke` (`@xyflow/react/dist/esm/types/component-props.d.ts:449-453`, `style.css:193-198`).
- Enter/Space/Escape on a focused node go through React Flow's `handleNodeClick` → `addSelectedNodes`, which only reaches the app through `onNodesChange` (`@xyflow/react/dist/esm/index.mjs:2299-2311`, `:1656-1671`) — the same route a mouse click takes, so it cannot tell keyboard from mouse. A focused node also removes its own outline (`style.css:450-453`) and auto-pans into view on focus (`index.mjs:2331-2343`).
- Astro shows a `slot="fallback"` child of a `client:only` component until it renders (Astro docs, directives reference, via Context7).
- `astro:config:setup` receives `command: 'dev' | 'build' | 'preview' | 'sync'` and `injectRoute` (`node_modules/astro/dist/types/public/integrations.d.ts:321-327`).
- `global.css:10` sources `src/**/*.{astro,ts,tsx}`: any class used only on a kitchen-sink file would compile into production CSS (lesson "Pin the build's input set").
- `eslint-plugin-jsx-a11y` 6.10.2 is a direct devDependency exporting `flatConfigs`; today it applies to `.astro` only (`eslint.config.js:85`). lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}`.

## What We're NOT Doing

- Dark mode — `.dark` values exist but nothing sets the class; stays deferred (as in S-01). `colorMode="light"` is kept: `"dark"`/`"system"` would switch the app's dark tokens inside the canvas only.
- Mobile / small-screen layout — PRD Non-Goal. The mobile-width screenshot is N/A; the gate uses 1440 and 1024.
- Editing vendored `src/components/ui/button.tsx` (`destructive` uses `text-white`, upstream shadcn) — deferred.
- Arrow-key navigation between nodes, selecting START/FINISH, focusable edges, delete confirmation.
- Shipping the kitchen sink to production, or running it under `npm run preview`.
- Installing a screenshot-testing tool (Playwright, Storybook) or any new dependency.
- Any server-side feature, network call or CSP change.

## Implementation Approach

One charge per phase, so each phase's screenshot shows one change and a regression points at one phase. Contract before pixels: the shared component and token mapping land before the keyboard and state work that renders on top of them. The kitchen sink comes after the states exist so it shows real components, and the guard comes last so it locks in the finished view rather than blocking work in progress.

## Critical Implementation Details

- **Arrowheads**: mapping `--xy-edge-stroke` alone recolours the edge lines but not the arrowheads; `Diagram` must also pass `defaultMarkerColor={null}`.
- **Keyboard vs mouse selection**: catch Enter/Space with a keydown handler on the `<ReactFlow>` wrapper (it spreads extra props onto its root `div`; the event bubbles from the focused node wrapper, which carries `data-id` and the `react-flow__node-task` class). Keep `onNodeClick` as the mouse path and do not add `onNodesChange`, so React Flow's own selection changes stay inert and only the keyboard path requests the focus handoff. Holding Space is also React Flow's `panActivationKeyCode`; check that a Space press on a node selects without leaving the canvas in pan mode.
- **Focus handoff timing**: `TaskPanel` is remounted per Task (`key={task.id}`), so focusing "Task name" must happen after mount, and must also work when the already-selected Task is re-selected by keyboard (no remount) — carry the request as a changing value, not a boolean.
- **Kitchen-sink input set**: exclude the kitchen-sink folder from `global.css`'s `@source`, so its own layout cannot use Tailwind classes; give it an Astro scoped `<style>` that reads tokens through `var(--…)`. Prove it with the `dist/` probe, not by reading the config.

## Phase 1: Shared component (C1)

### Overview

Replace the hand-built predecessor `<select>` with shadcn's `NativeSelect`, added through the stack's own path.

### Changes Required:

#### 1. Add the component

**File**: `src/components/ui/native-select.tsx` (new, generated)

**Intent**: Add the shared native-select primitive so the picker shares `Input`'s state classes; a native `<select>` keeps S-01's reasons (no dependency, keyboard-accessible, "7: Name" labels).

**Contract**: `npx shadcn@latest add native-select`; exports `NativeSelect`, `NativeSelectOption`, `NativeSelectOptGroup`. Stop if the CLI adds anything to `package.json` or touches `global.css`/`components.json`; commit the file as generated (Prettier/ESLint fixes only).

#### 2. Use it in the panel

**File**: `src/components/planner/TaskPanel.tsx`

**Intent**: Swap the `<select>` and `<option>`s at `:161-183` for `NativeSelect`/`NativeSelectOption`, keeping every behaviour (placeholder option, "Add" commits, disabled when no Task is eligible, `aria-describedby` note).

**Contract**: Same `id`, `value`, `onChange`, `disabled`, `aria-describedby`; the `bg-background` surface stays (panel sits on `bg-sidebar`). The wrapper is `w-fit`, so the `flex-1 min-w-0` sizing in the "Add" row must reach the wrapper (an enclosing element), not only the `<select>`. `cn` import is removed if unused.

### Success Criteria:

#### Automated Verification:

- `package.json` and `package-lock.json` unchanged by the shadcn add
- Hardcoded-value scan on the view files returns 0 hits
- `npm run lint && npx astro check && npm test && npm run build` pass

#### Manual Verification:

- Picker fills the row beside "Add" and shows the chevron; focus ring matches the "Task name" input; disabled state (Task with no eligible predecessor) looks disabled and shows the note
- Adding and removing predecessors works as before, including arrow-key browsing that does not add a Task until "Add"
- Screenshot at 1440 of the panel with a Task selected, before/after

**Implementation Note**: After automated verification passes, pause for manual confirmation before the next phase.

---

## Phase 2: Token values (C2)

### Overview

Route every colour React Flow draws through roles in `global.css`, give the canvas a muted surface, and remove the dead literal palette.

### Changes Required:

#### 1. Map React Flow onto the tokens

**File**: `src/styles/global.css`

**Intent**: Override React Flow's `--xy-*` variables with `var(--token)` values so the canvas follows the same palette as the rest of the view, and the edges clear 3:1.

**Contract**: A block (scoped to `.react-flow`, after the React Flow import so it wins) with a comment naming React Flow's theming route. Mapping: edge stroke → `--muted-foreground`; selected edge → `--foreground`; canvas background (`--xy-background-color`) → `--muted`; dot pattern → `--border` (decorative, no contrast floor); controls button background/hover/border/colour → `--card`/`--accent`/`--border`/`--foreground`; attribution background → a `--muted`-based role. Only existing tokens; no new `:root` values. If an existing token proves unreadable on the screenshot, record the reason and the replacement token in `tokens.md` before choosing a different one.

#### 2. Arrowheads follow the edge token

**File**: `src/components/planner/Diagram.tsx`

**Intent**: Make edge markers read `--xy-edge-stroke` instead of their hard-coded default.

**Contract**: `defaultMarkerColor={null}` on `<ReactFlow>`; `colorMode="light"` stays.

#### 3. Remove the dead palette

**File**: `src/styles/global.css`

**Intent**: Delete the unused `bg-cosmic` utility (`:124-126`), the only literal palette inside the token source.

**Contract**: `grep -rn bg-cosmic src` returns nothing afterwards.

#### 4. Deposit the values

**File**: `context/changes/planner-ui-contract/tokens.md` (new)

**Intent**: Record the `--xy-*` → token mapping, the React Flow defaults each replaced, and the contrast figure for the edge colour, so a later session does not reinvent them.

**Contract**: One table: React Flow variable, default (with `style.css` line), token used, reason.

### Success Criteria:

#### Automated Verification:

- Hardcoded-value scan on the view files returns 0 hits
- `grep -rn bg-cosmic src` returns nothing
- `npm run lint && npx astro check && npm test && npm run build` pass
- Built CSS in `dist/` contains the `--xy-*` overrides as `var(--…)` references (read the artifact, not `global.css`)

#### Manual Verification:

- Screenshot at 1440, before/after, with a small project: canvas is muted, Task nodes read as white cards, edges and arrowheads share one colour and are clearly visible, dots and zoom controls match the palette
- Temporarily changing `--muted-foreground` in devtools recolours edges and arrowheads together
- `npm run preview`: no CSP errors in the console

**Implementation Note**: After automated verification passes, pause for manual confirmation before the next phase.

---

## Phase 3: Keyboard path (C3)

### Overview

Make Task nodes reachable and selectable by keyboard and hand focus to the panel, so rename, predecessors and Delete Task no longer need a mouse. This lifts the S-01 exclusion "Keyboard selection of diagram nodes" (`context/archive/2026-09-27-capture-task-graph/plan.md:39`); there is still no PRD requirement — it is the view's focus-visible state.

### Changes Required:

#### 1. Focusable Task nodes only

**Files**: `src/lib/services/diagram-layout.ts`, `src/lib/services/diagram-layout.test.ts`

**Intent**: START and FINISH select nothing, so they must not be tab stops; Task nodes must be.

**Contract**: START and FINISH nodes carry `focusable: false` and `selectable: false`; Task nodes leave both unset. A test asserts both properties on the terminal nodes and their absence on Task nodes.

#### 2. Keyboard selection and diagram settings

**File**: `src/components/planner/Diagram.tsx`

**Intent**: Enable node focus and turn Enter/Space on a focused Task node into a selection that also asks for the focus handoff; keep the mouse path unchanged; make the Delete key inert.

**Contract**: `nodesFocusable` on (replacing the S-01 comment at `:63-65` with the new reason); `deleteKeyCode={null}`; a keydown handler on `<ReactFlow>` that, for Enter or Space on a Task node, calls a new prop `onEdit(taskId)`. `onSelect` keeps serving clicks. See Critical Implementation Details for why this is not `onNodesChange`.

#### 3. Visible focus on Task nodes

**File**: `src/components/planner/TaskNode.tsx`

**Intent**: React Flow removes the focused node's outline, so the node draws its own focus ring from `--ring`, distinct from the selected style.

**Contract**: A focus-visible ring driven by the node wrapper's focus (e.g. a `group`/`in-focus-visible` style or a `.react-flow__node:focus-visible` rule in `global.css` using `--ring`), matching `Input`'s ring weight; token classes only.

#### 4. Focus handoff

**Files**: `src/components/planner/Planner.tsx`, `src/components/planner/TaskPanel.tsx`, `src/components/planner/NewTaskForm.tsx`

**Intent**: Keyboard selection lands in "Task name"; after Delete Task, focus returns to the New Task input instead of `<body>`. Mouse selection does not move focus.

**Contract**: `Planner` handles `onEdit` by selecting the Task and recording a focus request that `TaskPanel` honours on mount and on change (see Critical Implementation Details). `NewTaskForm` accepts a ref to its input (React 19 ref-as-prop); `Planner` focuses it after `deleteTask` succeeds — `TaskPanel`'s delete action reports back through the existing `actions` object, not a new global.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the new `diagram-layout` assertions
- Hardcoded-value scan on the view files returns 0 hits
- `npm run lint && npx astro check && npm run build` pass

#### Manual Verification:

- From the New Task input, Tab reaches each Task node in turn, never START or FINISH; each focused node shows the `--ring` focus ring and scrolls into view on a large project (`?fixture=perf100` in dev)
- Enter and Space on a focused node select it and put the caret in "Task name"; re-selecting the same Task by keyboard also focuses it
- Clicking a node selects it without moving focus to the panel
- Delete Task (by keyboard or mouse) returns focus to the New Task input; the Delete and Backspace keys on a focused node do nothing
- Escape on a focused selected node does not leave the panel and the diagram out of sync
- Screenshot at 1440 with a focused (not selected) and a selected Task

**Implementation Note**: After automated verification passes, pause for manual confirmation before the next phase.

---

## Phase 4: Empty and loading states (C4, C5)

### Overview

Give the first-run empty project a real empty state, and the `client:only` island a loading fallback.

### Changes Required:

#### 1. Empty project

**File**: `src/components/planner/Planner.tsx`

**Intent**: When the project has no Tasks, the panel names the starting point instead of asking the user to select a Task that does not exist.

**Contract**: Branch on `project.tasks.length === 0` before the no-selection copy; text uses PRD terms ("Task", "New Task") and points at the New Task field above; `text-muted-foreground` and other token classes only. The non-empty, nothing-selected copy stays.

#### 2. Loading fallback

**Files**: `src/components/planner/PlannerSkeleton.astro` (new), `src/pages/index.astro`

**Intent**: Show the planner's frame (toolbar, canvas, panel) while the island loads, so the page is never blank and nothing jumps when the island renders; tell no-JavaScript users the planner needs JavaScript.

**Contract**: A static Astro component reproducing the `Planner` layout boxes (header height, `w-80` panel, `bg-sidebar`/`border-sidebar-border`, muted canvas) with token classes only and no inline `style` (CSP), passed as `<PlannerSkeleton slot="fallback" />` to `<Planner client:only="react">`. A `<noscript>` line in `<main>`.

### Success Criteria:

#### Automated Verification:

- `dist/index.html` contains the skeleton markup and the `<noscript>` line (read the built file)
- Hardcoded-value scan on the view files (now including `PlannerSkeleton.astro`) returns 0 hits
- `npm run lint && npx astro check && npm test && npm run build` pass

#### Manual Verification:

- First load shows the empty-state copy pointing at New Task; creating a Task switches to the "Select a Task" copy
- With network throttled in `npm run preview`, the skeleton shows and the swap to the live planner causes no visible layout jump
- With JavaScript disabled, the page shows the skeleton and the `<noscript>` line, no CSP errors
- Screenshot at 1440 of empty state and of the skeleton

**Implementation Note**: After automated verification passes, pause for manual confirmation before the next phase.

---

## Phase 5: Visual gate — dev-only kitchen sink

### Overview

One page under `npm run dev` showing the Planner in every 7-state cell, screenshotted at 1440 and 1024, and absent from the production build.

### Changes Required:

#### 1. Dev-only route

**File**: `astro.config.mjs`

**Intent**: Register `/kitchen-sink` only when Astro runs in dev, so production ships nothing extra (no page, no sitemap entry).

**Contract**: An inline integration whose `astro:config:setup` calls `injectRoute({ pattern: "/kitchen-sink", entrypoint: … })` only when `command === "dev"`. No change to `security.csp`.

#### 2. The page and its fixtures

**Files**: `src/dev/kitchen-sink.astro` (new), `src/dev/*.tsx` (new, as needed), `src/components/planner/Planner.tsx`

**Intent**: Render the real components in each state with fixture projects built through the edit functions, every cell labelled, so the gate shows the view rather than a copy of it.

**Contract**: `Planner` accepts an optional initial project (and, if needed, an initial selected Task) passed through to `useProject`; the index page keeps its current behaviour. Cells: default (small project), hover, focus-visible, disabled (Task with no eligible predecessor), error (rename to an empty name shows the rule message), empty (no Tasks), loading (`PlannerSkeleton`). Cells whose state lives in component state (hover, focus-visible, error) carry a one-line instruction for the single action that reveals them. Each cell states the 7-state cell it covers; anything N/A says why.

#### 3. Pin the input set

**File**: `src/styles/global.css`

**Intent**: Keep kitchen-sink-only class names out of the production CSS.

**Contract**: `@source not "../dev/**"` beside the existing test exclusion, with a comment; the kitchen sink's own layout lives in its Astro scoped `<style>` using `var(--…)` tokens.

### Success Criteria:

#### Automated Verification:

- `npm run build` emits no `kitchen-sink` file in `dist/` and no `/kitchen-sink` URL in the sitemap
- Probe: the CSS files in `dist/` are byte-identical between a build with `src/dev/` and one with it temporarily removed
- `npm run lint && npx astro check && npm test` pass

#### Manual Verification:

- `npm run dev` → `/kitchen-sink` shows all seven cells, each shown or N/A with a reason; mobile width marked N/A (PRD Non-Goal)
- Screenshots of the kitchen sink at 1440 and 1024 saved to `context/changes/planner-ui-contract/screenshots/`

**Implementation Note**: After automated verification passes, pause for manual confirmation before the next phase.

---

## Phase 6: Guard

### Overview

Leave a rule and two lint checks that keep the next agent on the contract, then record the charges' outcome.

### Changes Required:

#### 1. UI rule

**File**: `PROJECT_RULES.md`

**Intent**: Tell the next agent where tokens and components live and forbid literals in views.

**Contract**: A short "UI" block under Conventions (not in `AGENTS.md`/`CLAUDE.md`): token values in `:root`/`.dark` of `src/styles/global.css`, published via `@theme inline`, referenced by role; React Flow colours through the `--xy-*` mapping there; check `src/components/ui/` before creating a component, add missing ones with `npx shadcn@latest add <name>`; no literal colours, palette classes or arbitrary values in views; the kitchen sink at `/kitchen-sink` under `npm run dev`. Fold the existing `cn()`/shadcn lines in rather than duplicating them.

#### 2. Lint checks

**File**: `eslint.config.js`

**Intent**: Make the rule fail in pre-commit, CI and the deploy build.

**Contract**: (a) jsx-a11y's recommended flat config applied to `**/*.tsx`, reusing the installed plugin; fix any findings in the planner views in this phase. (b) A literal-value check (e.g. `no-restricted-syntax` on string and template literals) scoped to `src/components/planner/**` that rejects the same patterns as the hardcoded-value scan (hex, `rgb`/`hsl`/`oklch(`, arbitrary `-[Npx|rem]` values, palette colour classes), with a message pointing at the UI rule. No new dependency.

#### 3. Charge outcomes

**File**: `context/changes/planner-ui-contract/research.md`

**Intent**: Close the loop on the charge list.

**Contract**: `## Charges` Status column: C1–C5 → `fixed (Phase N)`; the deferred observations (`button.tsx` `text-white`, dark mode) stay listed as deferred with their reasons; `bg-cosmic` noted as removed in Phase 2.

### Success Criteria:

#### Automated Verification:

- `npm run lint && npx astro check && npm test && npm run build` pass
- Probe: a temporary `bg-blue-500`, `#fff` and `p-[13px]` in a planner `.tsx` file each make `npm run lint` fail; removing them makes it pass
- Probe: a temporary `<div onClick={…}>` without a key handler in a planner `.tsx` file makes `npm run lint` fail
- `package.json` dependencies unchanged

#### Manual Verification:

- `PROJECT_RULES.md` UI block reads correctly and contradicts no existing rule
- `research.md` charge statuses match what landed
- `/10x-ui` merge checklist (`.claude/skills/10x-ui/references/ui-quality-checklist.md`) walked; `/10x-impl-review` run next

**Implementation Note**: After automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- `diagram-layout.test.ts`: START/FINISH carry `focusable: false` and `selectable: false`; Task nodes do not.
- No component tests: outside the F-01 setup (Vitest runs pure domain logic); UI is verified through the kitchen sink and manual steps.

### Integration Tests:

- None added. The build-level probes (`dist/` CSS byte comparison, kitchen sink absent from `dist/`, skeleton present in `dist/index.html`, lint probes) carry the integration checks.

### Manual Testing Steps:

1. Keyboard only, from page load: create two Tasks, Tab to the second, Enter, rename it, add the first as predecessor via the select, Delete Task — focus ends in New Task.
2. Mouse: click a node, confirm focus stays put; click the pane, panel returns to "Select a Task".
3. `npm run preview` with throttling and with JavaScript off: skeleton, `<noscript>`, no CSP console errors.
4. `/kitchen-sink` at 1440 and 1024: every cell shown or N/A.

## Performance Considerations

The keydown handler and focus request add no work per render; the 200 ms NFR check (`?fixture=perf100`) should be re-run once after Phase 3, since focusable nodes add a tab stop per Task.

## References

- Research and charges: `context/changes/planner-ui-contract/research.md`
- S-01 plan (keyboard exclusion, `colorMode` choice): `context/archive/2026-09-27-capture-task-graph/plan.md:37-39`
- `/10x-ui` contract and 7-state matrix: `.claude/skills/10x-ui/SKILL.md`
- Lessons: `context/foundation/lessons.md` ("Verify the artifact, not the config", "Pin the build's input set")
- React Flow theming variables: `node_modules/@xyflow/react/dist/style.css:6-47`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared component (C1)

#### Automated

- [x] 1.1 `package.json` and `package-lock.json` unchanged by the shadcn add — f45aa7d
- [x] 1.2 Hardcoded-value scan on the view files returns 0 hits — f45aa7d
- [x] 1.3 `npm run lint && npx astro check && npm test && npm run build` pass — f45aa7d

#### Manual

- [x] 1.4 Picker fills the row beside "Add" and shows the chevron; focus ring matches the "Task name" input; disabled state (Task with no eligible predecessor) looks disabled and shows the note — f45aa7d
- [x] 1.5 Adding and removing predecessors works as before, including arrow-key browsing that does not add a Task until "Add" — f45aa7d
- [x] 1.6 Screenshot at 1440 of the panel with a Task selected, before/after — f45aa7d

### Phase 2: Token values (C2)

#### Automated

- [x] 2.1 Hardcoded-value scan on the view files returns 0 hits — aeb0347
- [x] 2.2 `grep -rn bg-cosmic src` returns nothing — aeb0347
- [x] 2.3 `npm run lint && npx astro check && npm test && npm run build` pass — aeb0347
- [x] 2.4 Built CSS in `dist/` contains the `--xy-*` overrides as `var(--…)` references (read the artifact, not `global.css`) — aeb0347

#### Manual

- [x] 2.5 Screenshot at 1440, before/after, with a small project: canvas is muted, Task nodes read as white cards, edges and arrowheads share one colour and are clearly visible, dots and zoom controls match the palette — aeb0347
- [x] 2.6 Temporarily changing `--muted-foreground` in devtools recolours edges and arrowheads together — aeb0347
- [x] 2.7 `npm run preview`: no CSP errors in the console — aeb0347

### Phase 3: Keyboard path (C3)

#### Automated

- [x] 3.1 `npm test` passes, including the new `diagram-layout` assertions — 2c06759
- [x] 3.2 Hardcoded-value scan on the view files returns 0 hits — 2c06759
- [x] 3.3 `npm run lint && npx astro check && npm run build` pass — 2c06759

#### Manual

- [x] 3.4 From the New Task input, Tab reaches each Task node in turn, never START or FINISH; each focused node shows the `--ring` focus ring and scrolls into view on a large project (`?fixture=perf100` in dev) — 2c06759
- [x] 3.5 Enter and Space on a focused node select it and put the caret in "Task name"; re-selecting the same Task by keyboard also focuses it — 2c06759
- [x] 3.6 Clicking a node selects it without moving focus to the panel — 2c06759
- [x] 3.7 Delete Task (by keyboard or mouse) returns focus to the New Task input; the Delete and Backspace keys on a focused node do nothing — 2c06759
- [x] 3.8 Escape on a focused selected node does not leave the panel and the diagram out of sync — 2c06759
- [x] 3.9 Screenshot at 1440 with a focused (not selected) and a selected Task — 2c06759

### Phase 4: Empty and loading states (C4, C5)

#### Automated

- [x] 4.1 `dist/index.html` contains the skeleton markup and the `<noscript>` line (read the built file) — d212c61
- [x] 4.2 Hardcoded-value scan on the view files (now including `PlannerSkeleton.astro`) returns 0 hits — d212c61
- [x] 4.3 `npm run lint && npx astro check && npm test && npm run build` pass — d212c61

#### Manual

- [x] 4.4 First load shows the empty-state copy pointing at New Task; creating a Task switches to the "Select a Task" copy — d212c61
- [x] 4.5 With network throttled in `npm run preview`, the skeleton shows and the swap to the live planner causes no visible layout jump — d212c61
- [x] 4.6 With JavaScript disabled, the page shows the skeleton and the `<noscript>` line, no CSP errors — d212c61
- [x] 4.7 Screenshot at 1440 of empty state and of the skeleton — d212c61

### Phase 5: Visual gate — dev-only kitchen sink

#### Automated

- [x] 5.1 `npm run build` emits no `kitchen-sink` file in `dist/` and no `/kitchen-sink` URL in the sitemap — 2ec3315
- [x] 5.2 Probe: the CSS files in `dist/` are byte-identical between a build with `src/dev/` and one with it temporarily removed — 2ec3315
- [x] 5.3 `npm run lint && npx astro check && npm test` pass — 2ec3315

#### Manual

- [x] 5.4 `npm run dev` → `/kitchen-sink` shows all seven cells, each shown or N/A with a reason; mobile width marked N/A (PRD Non-Goal) — 2ec3315
- [x] 5.5 Screenshots of the kitchen sink at 1440 and 1024 saved to `context/changes/planner-ui-contract/screenshots/` — 2ec3315

### Phase 6: Guard

#### Automated

- [x] 6.1 `npm run lint && npx astro check && npm test && npm run build` pass
- [x] 6.2 Probe: a temporary `bg-blue-500`, `#fff` and `p-[13px]` in a planner `.tsx` file each make `npm run lint` fail; removing them makes it pass
- [x] 6.3 Probe: a temporary `<div onClick={…}>` without a key handler in a planner `.tsx` file makes `npm run lint` fail
- [x] 6.4 `package.json` dependencies unchanged

#### Manual

- [x] 6.5 `PROJECT_RULES.md` UI block reads correctly and contradicts no existing rule
- [x] 6.6 `research.md` charge statuses match what landed
- [x] 6.7 `/10x-ui` merge checklist (`.claude/skills/10x-ui/references/ui-quality-checklist.md`) walked; `/10x-impl-review` run next
