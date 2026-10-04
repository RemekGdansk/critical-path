---
date: 2026-10-04T18:41:22+0200
researcher: Claude (Opus 5.5) for RemekGdansk
git_commit: 5f61d7c
branch: main
repository: critical-path
topic: "/10x-ui audit of the Planner view at / — charges against the design-system contract"
tags: [research, ui, design-system, planner, react-flow, shadcn, tokens, accessibility]
status: complete
last_updated: 2026-10-04
last_updated_by: Claude (Opus 5.5)
---

# Research: /10x-ui audit of the Planner view at `/`

**Date**: 2026-10-04T18:41:22+0200
**Researcher**: Claude (Opus 5.5) for RemekGdansk
**Git Commit**: 5f61d7c
**Branch**: main
**Repository**: critical-path

## Research Question

Audit the one view this change works against — the Planner at `/` (`src/pages/index.astro` → `src/components/planner/*`) — in both directions (token source → view, view → token source), check the agent rules for UI instructions, and produce 3–5 charges, each with a file, a line and its effect on the user, under the `/10x-ui` categories: missing tokens, missing shared component, accidental architecture.

## Summary

The Planner already sits on the repo's shadcn design system: the hardcoded-value scan finds 1 hit in the 10 view files (`TaskPanel.tsx:171`), and every colour class in `src/components/planner/*.tsx` is a token class. The contract variant is **existing design system**: extend `src/styles/global.css` and `src/components/ui/`, and run no second `shadcn init`.

The drift is not literal colours in the components. It sits where the view leaves the contract:

1. **C1 (missing shared component):** the predecessor `<select>` is hand-built from copied `Input` classes.
2. **C2 (missing tokens):** the diagram canvas — edges, background dots, zoom controls, and the node-on-canvas surface — is painted by React Flow's built-in hex defaults or by two tokens that resolve to the same white, not by roles in the token source.
3. **C3 (accidental architecture):** there is no keyboard path into the side panel, so rename, predecessors and delete are mouse-only.
4. **C4 (accidental architecture):** the first-run empty project gives no hint where to start.
5. **C5 (accidental architecture):** the `client:only` island has no fallback, so the loading state is a blank page.

C3 reverses a scope decision S-01 made deliberately (`context/archive/2026-09-27-capture-task-graph/plan.md:39`). Whether it is in this change is a user decision; see Open Questions.

No screenshot was taken during this research. The visual effects stated for C2 are derived from CSS values, not observed renders, and the first implementation phase should confirm them with a screenshot.

## Charges

| ID  | Category                 | Where                                                                                                                                                                                                    | Effect on the user                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Proposed fix                                                                                                                                                                                                                                                                                 | Status                                         |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| C1  | Missing shared component | `src/components/planner/TaskPanel.tsx:161-173`                                                                                                                                                           | The "Add predecessor" select sits under the rename field and beside the Add button, but does not share their control states. It has no `aria-invalid` styling, no `transition` and no `dark:` background (compare `src/components/ui/input.tsx:10-12`), and it is the view's only arbitrary value (`ring-[3px]`, `:171`). Any change to `Input` focus, error or disabled styling will skip this control.                                                                                                                                                 | `npx shadcn@latest add native-select` (a native `<select>` wrapper, so the S-01 reasons for a native control still hold), then replace the hand-rolled element.                                                                                                                              | open                                           |
| C2  | Missing tokens           | `src/components/planner/Diagram.tsx:67-71` (React Flow defaults from `node_modules/@xyflow/react/dist/style.css:6,24,42-47`); `src/components/planner/TaskNode.tsx:13`; `src/styles/global.css:19,21,34` | The arrows are the dependency information in a dependency planner. They are drawn in React Flow's `#b1b1b7`, about 2.1:1 against the white canvas, under the 3:1 non-text contrast floor. Task nodes are `bg-card` (`oklch(1 0 0)`, `global.css:21`) on a `bg-background` page (`oklch(1 0 0)`, `global.css:19`), separated only by a `--border` of `oklch(0.922 0 0)` (`global.css:34`) and `shadow-xs`. Changing `--primary` or `--border` moves the nodes but not the edges, dots or controls (`#fefefe`/`#eee`), so the canvas follows two palettes. | Map React Flow's `--xy-*` variables onto existing roles in `global.css` (edge stroke, selected edge, background dots, controls, attribution), and give the canvas a surface distinct from the card, both chosen from the existing tokens. Keep `colorMode="light"` (see Historical Context). | open                                           |
| C3  | Accidental architecture  | `src/components/planner/Diagram.tsx:63-66` (`nodesFocusable={false}`)                                                                                                                                    | A keyboard user can create Tasks through the "New Task" field (`NewTaskForm.tsx:36`) but cannot select one, so the whole side panel is unreachable: rename, predecessors and Delete Task (`Planner.tsx:43-52`). Pressing Tab moves from the New Task field to the zoom controls and the attribution link, never to a Task; with nothing selected, the panel holds no focusable control.                                                                                                                                                                  | Make Task nodes (not START/FINISH) focusable and selectable with Enter/Space, and draw a focus ring from `--ring` in `TaskNode`. See the implementation risks under Detailed Findings → C3.                                                                                                  | open: needs a scope decision (Open Question 1) |
| C4  | Accidental architecture  | `src/lib/services/diagram-layout.ts:65` (an empty project → START → FINISH only); `src/components/planner/Planner.tsx:43-44`                                                                             | On first load, the canvas shows two pills and one arrow, and the panel says "Select a Task on the diagram to edit it." when there is no Task to select. Nothing points at the "New Task" field, which is the only way to start.                                                                                                                                                                                                                                                                                                                          | A real empty state when `project.tasks.length === 0`: panel copy that names the New Task field, and optionally a canvas hint. Copy uses the PRD terms.                                                                                                                                       | open                                           |
| C5  | Accidental architecture  | `src/pages/index.astro:6-10`                                                                                                                                                                             | `<Planner client:only="react" />` has no fallback, so `<main>` is empty until the island's JavaScript runs. A slow load shows a blank white page, and a load that fails or has JavaScript disabled shows a blank page permanently, with no explanation. This is the **loading** cell of the 7-state matrix.                                                                                                                                                                                                                                              | A static `<div slot="fallback">` skeleton (the toolbar and panel frame, token classes only), which Astro shows until a `client:only` component renders. A `<noscript>` line that says the planner needs JavaScript.                                                                          | open                                           |

**Observations not raised as charges** (no direct user effect on this view, or outside its scope):

- `src/styles/global.css:124-126`: the `bg-cosmic` utility contains three hex literals, and no file in `src/` uses it (searched: `grep -rn bg-cosmic src` matches only its definition). It is dead starter code with no user effect today, but it is a literal palette inside the token source. Recommend deleting it in the token phase (zero risk), or listing it as deferred.
- `src/components/ui/button.tsx:13-14`: the `destructive` variant uses `text-white` because this shadcn version ships no `--destructive-foreground` token. It is a vendored primitive used unchanged, as upstream ships it. **Deferred**: editing the vendored primitive drifts from upstream, and the "Delete Task" contrast is upstream shadcn's.
- **Dark mode:** `.dark` values exist (`global.css:52-84`), but nothing sets the class (`src/layouts/Layout.astro:12`). Out of scope here, as it was in S-01 (`context/archive/2026-09-27-capture-task-graph/plan.md:37`). **Deferred**. C2's `--xy-*` mapping makes a future dark mode a token change rather than a component change.

## Detailed Findings

### Source → view (who reads the contract)

- Token values live in `src/styles/global.css:17-84` (`:root` / `.dark`) and are published in `:86-122` via `@theme inline`. Values are not written directly into `@theme inline`, so dark-mode breakage is not a risk.
- Shared components: `src/components/ui/{button,input,label}.tsx`. shadcn "new-york" variant, `components.json:3`.
- Per-file read of the contract across the 10 view files (counts from this audit's scan):

  | File                                                                            | Scan hits | Token colour classes | `@/components/ui` imports |
  | ------------------------------------------------------------------------------- | --------- | -------------------- | ------------------------- |
  | `TaskPanel.tsx`                                                                 | 1         | 9                    | 3                         |
  | `TaskNode.tsx`                                                                  | 0         | 4                    | 0                         |
  | `TerminalNode.tsx`                                                              | 0         | 2                    | 0                         |
  | `NewTaskForm.tsx`                                                               | 0         | 1                    | 2                         |
  | `Planner.tsx`                                                                   | 0         | 1                    | 0                         |
  | `Diagram.tsx`, `StartNode.tsx`, `FinishNode.tsx`, `index.astro`, `Layout.astro` | 0         | 0                    | 0                         |

  `Planner.tsx:41` uses the `--sidebar-*` tokens, per the S-01 plan contract (`context/archive/2026-09-27-capture-task-graph/plan.md:310`). The token count for `Planner.tsx` counts `text-muted-foreground` only; the `sidebar-*` classes fell outside the counting regex but are tokens too.

- `Diagram.tsx` reads no token: everything it draws besides the custom nodes comes from React Flow's stylesheet, imported at `global.css:8` into `layer(components)`.

### View → source (what each literal should have been)

- The single scan hit, `TaskPanel.tsx:171`, is `focus-visible:ring-[3px]`. It is copied verbatim from `input.tsx:11` and `button.tsx:8`, so it is upstream shadcn's ring width, not an invented value. It goes away when C1 replaces the select with a shared component. It is not an independent token charge.
- React Flow literals that reach the screen in this view (it renders `<Background />` with dots, `<Controls showInteractive={false} />`, edges and the attribution link; `Diagram.tsx:70-71`):
  - edge stroke `#b1b1b7` and selected edge `#555`: `style.css:6,8`
  - background dots `#91919a`: `style.css:24`
  - control button background `#fefefe`, hover `#f4f4f4`, border `#eee`, shadow `rgba(0,0,0,0.08)`: `style.css:42-47`
  - attribution background `rgba(255,255,255,0.5)`: `style.css:13`
- The theming route React Flow documents is to override these `--xy-*` variables (reactflow.dev "Theming", via Context7 `/websites/reactflow_dev`). Overriding them with `var(--token)` values in `global.css` keeps one source of values.
- Contrast figure: `#b1b1b7` has a relative luminance of about 0.442, which gives about 2.1:1 against `oklch(1 0 0)` white. This is calculated, not measured on a render.

### C3: what making nodes focusable touches (planning risks, not decisions)

- `style.css:450-453` sets `outline: none` on `.react-flow__node.selectable:focus-visible`, so a focusable node has **no** visible focus until `TaskNode` draws one. Use `--ring` (`global.css:36`), as `input.tsx:11` does.
- The S-01 comment at `Diagram.tsx:63-64` records why focus was disabled: Enter on a focused node is delivered through `onNodesChange`, which is not passed. A keyboard path needs either an `onNodesChange` handler that maps `select` changes to `onSelect` (and ignores the rest), or per-node key handling.
- React Flow's default delete key would emit `remove` changes for a selected node. They are inert without a handler, but `deleteKeyCode={null}` makes that explicit, since Delete Task has no confirmation (`TaskPanel.tsx:200-209`).
- START/FINISH must stay unfocusable (they select nothing, `Diagram.tsx:45-46`). React Flow supports a per-node `focusable` override (docs: "This option can be overridden by individual nodes by setting their `focusable` prop").
- React Flow pans to a focused node by default (`autoPanOnNodeFocus`), which helps on a 100-Task diagram.

### Agent rules

- `PROJECT_RULES.md` is the only rules file with content. `AGENTS.md` imports it, and `CLAUDE.md` adds the `/10x-ui` pointer; there are no `.cursor/rules`, `.windsurfrules` or `copilot-instructions.md`. UI instructions today: `PROJECT_RULES.md:37` (`cn()`) and `:38` (shadcn path). **No rule invites one-off values**, so there is no accidental-architecture charge against the rules. There is also no rule naming the token source or forbidding literals. That is the "Make it stick" work (router step 6), not a charge.
- `eslint.config.js:85` applies `jsx-a11y` to `.astro` files only (block at `:61`). The `.tsx` view components get no accessibility lint. This is relevant to the guard step: a `jsx-a11y` rule for `.tsx` would add no dependency, since the plugin is already installed through `eslint-plugin-astro`'s config, but whether it is wanted is the user's decision.

### Visual-gate tooling

- No screenshot-testing tool is installed (`package.json` has no `playwright` or `storybook` entries). Per `/10x-ui`, the gate is a kitchen-sink page plus manual screenshots, not a new dependency.
- This is a static build (`astro.config.mjs` `output: "static"`): a kitchen-sink page under `src/pages/` would be built into `dist/` and deployed, unless the plan excludes it. See Open Question 2.

## Code References

- `src/pages/index.astro:6-10`: `<main>` with the `client:only` island and no fallback (C5)
- `src/components/planner/Planner.tsx:31-55`: layout (toolbar, diagram, `aside` panel); `:43-44` no-selection copy (C4)
- `src/components/planner/Diagram.tsx:55-72`: React Flow configuration; `:63-66` focus disabled (C3); `:67` `colorMode="light"`; `:70-71` Background and Controls (C2)
- `src/components/planner/TaskNode.tsx:13-14`: node surface and selected ring (C2, C3 focus ring)
- `src/components/planner/TerminalNode.tsx:7`: START/FINISH pill, `bg-primary`
- `src/components/planner/TaskPanel.tsx:161-187`: hand-rolled select and Add button (C1)
- `src/components/planner/NewTaskForm.tsx:31-54`: toolbar input with inline error (already token- and component-based)
- `src/components/ui/input.tsx:10-12`: the state classes the select lacks (C1)
- `src/styles/global.css:8` (React Flow CSS layer), `:19,21,34,36` (background, card, border, ring), `:124-126` (`bg-cosmic`)
- `src/lib/services/diagram-layout.ts:65`: empty project renders START → FINISH (C4)
- `node_modules/@xyflow/react/dist/style.css:6-47` (`--xy-*-default` values), `:450-453` (node focus outline removed); version 12.12.0

## Architecture Insights

- The S-01 build kept every component on tokens. The gaps are at the boundary with a third-party stylesheet (React Flow) and in states the happy path never exercises: keyboard, empty, loading. This matches `/10x-ui`'s note that disabled, error and focus-visible states drift first.
- `TaskPanel` and `NewTaskForm` already implement the **error** state with `text-destructive`, `role="alert"` and `aria-describedby` (`TaskPanel.tsx:110-116`, `NewTaskForm.tsx:45-51`). **Disabled** exists for the select and the Add button (`TaskPanel.tsx:167,184`). These cells of the 7-state matrix need showing in the kitchen sink, not building.

## Historical Context (from prior changes)

- `context/archive/2026-09-27-capture-task-graph/plan-brief.md:28`: the native `<select>` was chosen for "no new dependencies, keyboard-accessible, duplicate names distinguishable". **Still holds** under C1: `native-select` wraps the same native element. Whether `npx shadcn add native-select` adds a runtime package was not verified; see Open Question 3.
- `context/archive/2026-09-27-capture-task-graph/research.md:33`: `colorMode="dark"|"system"` adds `.dark` to React Flow's root only, switching the app's dark tokens inside the canvas while the page stays light; `colorMode="light"` was chosen. **Still correct** (`global.css:15` scopes `dark:` to `.dark *`). C2 keeps `colorMode="light"`.
- `context/archive/2026-09-27-capture-task-graph/plan.md:39`: "Keyboard selection of diagram nodes and accessibility beyond native form controls (no PRD requirement)" was out of scope for S-01. **The premise still holds**: there is still no PRD keyboard requirement (S-01 `research.md:96`). C3 reopens it as a UI-quality decision, not a PRD requirement.
- `context/archive/2026-09-27-capture-task-graph/plan.md:37`: dark mode and MiniMap were out of scope. Dark mode stays deferred here.
- `context/archive/2026-09-27-capture-task-graph/research.md:72`: "jsx-a11y applies only to `.astro` files". **Still true** (`eslint.config.js:61,85`).

## Related Research

- `context/archive/2026-09-27-capture-task-graph/research.md`: S-01 codebase research (React Flow layering, CSP constraints on forms)
- `context/archive/2026-09-27-capture-task-graph/research-diagram-libraries.md`: React Flow selection

## Open Questions

1. **Is C3 (keyboard selection of Task nodes) in this change?** Recommended: yes. It is the focus-visible cell for the largest part of the view, and without it the panel's states cannot be reached by keyboard at all. Deferring it is a legitimate choice, since the PRD has no requirement, and it would then be listed as deferred with that reason. Owner: user.
2. **Where does the kitchen sink live in a static build?** Options: a page under `src/pages/` that ships to production (it shows only fixture data, so zero-egress holds), or a page excluded from the build (e.g. served only under `astro dev`). Decide in `/10x-plan`. Owner: user.
3. **Does `npx shadcn@latest add native-select` add a runtime package?** It likely needs only `lucide-react` (already installed, `package.json:26`), but this was not verified without running the CLI. Check in the plan's environment phase, and stop if it pulls a new dependency.
4. **The canvas surface for C2:** a distinct token for the canvas (e.g. `muted`) versus a stronger node border. This is a visual choice for the token phase, best made from a before/after screenshot.
