---
date: 2026-09-27T22:42:37+0200
researcher: Claude (for RemekGdansk)
git_commit: 25844fc
branch: capture-task-graph
repository: critical-path
topic: "Compatibility of @xyflow/react and @dagrejs/dagre with the codebase, and other areas S-01 needs researched"
tags: [research, codebase, s-01, capture-task-graph, xyflow, dagre, csp, tailwind, domain-model]
status: complete
last_updated: 2026-09-27
last_updated_by: Claude (for RemekGdansk)
---

# Research: library compatibility and open areas for S-01

**Date**: 2026-09-27T22:42:37+0200
**Researcher**: Claude (for RemekGdansk)
**Git Commit**: 25844fc (working tree: only the untracked `context/changes/capture-task-graph/` folder differs)
**Branch**: capture-task-graph
**Repository**: critical-path

## Research Question

Review the current codebase and assess whether the libraries in `docs-xyflow-dagre.md` (`@xyflow/react`, `@dagrejs/dagre`) are compatible with it. Look for any other areas of roadmap slice S-01 (`capture-task-graph`, FR-001, FR-002, FR-003, FR-008) that need research.

## Summary

**Compatible, no blockers.** `@xyflow/react` 12.12.0 and `@dagrejs/dagre` 3.1.1 (current latest per `npm view` on 2026-09-27) fit React 19, TypeScript 6 with `astro/tsconfigs/strict`, Vite/Vitest and the static build. Five friction points must be handled by the plan:

1. **The island must be `client:only="react"`.** The built CSP `style-src` has hashes and `'self'` but no `'unsafe-inline'` (`dist/index.html` meta, verified), so `style="…"` attributes in build-time-rendered HTML are blocked. React Flow renders inline styles (wrapper, viewport transform, node positions), so any server-rendered hydration directive would ship a broken first paint. Styles set later by React/d3 via the CSSOM are not blocked.
2. **Type dagre's generics.** `Graph` and `layout` default their generics to `any` (`@dagrejs/dagre` `dist/types/lib/graph-lib.d.ts:2-3`), which trips `strictTypeChecked` (`eslint.config.js:17`). Always write `new Graph<GraphLabel, NodeLabel, EdgeLabel>()` and use `import type` for type-only symbols (`verbatimModuleSyntax`). Both libraries export a type named `Edge` — alias one.
3. **Derive diagram state; don't sync it in an effect.** `react-hooks` `recommended-latest` (`eslint.config.js:44`) includes the React Compiler rules; the docs' `useNodesState` + `useEffect(setNodes(layout()))` pattern trips `react-hooks/set-state-in-effect`. Compute nodes/edges with `useMemo` from the project model and pass them as controlled props.
4. **CSS layering and dark mode.** React Flow's `style.css` is unlayered, so it beats Tailwind's layered utilities on built-in node classes; import it into a layer (`@import "@xyflow/react/dist/style.css" layer(components);`) or use `base.css` with custom Tailwind-styled nodes. React Flow's `colorMode="dark"|"system"` adds a `.dark` class on its root, which switches on the app's shadcn `.dark` tokens inside the canvas only (`src/styles/global.css:13,50`), while the page itself never sets `.dark`. Use `colorMode="light"` or drive both from one source.
5. **Attribution link.** React Flow renders an outbound `<a href="https://reactflow.dev?utm_source=attribution">` (verified in the 12.12.0 bundle). It is navigation, not a connection, so the CSP permits it, but hiding it via `proOptions.hideAttribution` is tied to a Pro subscription. This is a product decision, not a technical blocker.

**Other S-01 areas needing decisions** (not code research — the PRD leaves them open): whether S-01 must already reject cycles given that merging to `main` auto-deploys, whether START/FINISH are stored or implicit, Task-name rules, the id format, delete semantics, and how same-named Tasks are distinguished in the predecessor picker. See Open Questions.

## Detailed Findings

### Package metadata and module resolution

- `@xyflow/react` 12.12.0 peers `react`, `react-dom`, `@types/react`, `@types/react-dom` at `>=17`; repo has `react ^19.2.6` and `@types/react ^19.2.14` (`package.json:23-24,32-33`). Dependencies: `zustand ^4.4.0` (resolves 4.5.7 → `use-sync-external-store` 1.6.0, which peers React `^19`), `classcat`, `@xyflow/system` 0.0.83. No `engines` field, so Node 24.21.0 (`.nvmrc`) is unconstrained.
- `@xyflow/react` exports ESM with types bundled and explicitly exports `./dist/style.css` and `./dist/base.css`.
- `@dagrejs/dagre` 3.1.1 is `"type": "module"` with `import → dist/dagre.esm.js` and bundled types. On this inspected build, the ESM bundle has no `import` statements (graphlib is inlined) and exposes `Graph`, `graphlib`, `layout` and a default export. Types import `@dagrejs/graphlib` 4.0.5, a real dependency.
- `tsconfig.json:2` extends `astro/tsconfigs/strict` (`moduleResolution: "Bundler"`, `verbatimModuleSyntax: true`, `strict`); `tsconfig.json:6-7` set `jsx: react-jsx`. Both default and named dagre imports resolve; named imports (`import { Graph, layout } from "@dagrejs/dagre"`) are preferable.
- **Corrections to `docs-xyflow-dagre.md`:** version numbers are now 12.12.0 / 3.1.1 (the note says 12.11.x / 3.0.0); prefer named imports over the default `dagre` import shown there; add explicit generics on `Graph` (the note's snippet `new dagre.graphlib.Graph()` is untyped).

### CSP (`astro.config.mjs:22-36`)

- Directives: `default-src 'none'`, `connect-src 'none'`, `img-src 'self' data:`, `font-src 'self' data:`, `worker-src 'none'`, `form-action 'none'`; Astro supplies hashed `script-src` / `style-src`. `public/_headers:19-23` adds only `frame-ancestors` and non-CSP headers.
- In the 12.12.0 / 0.0.83 bundles, the compatibility worker found no `<style>` injection, `insertRule`, `adoptedStyleSheets`, `cssText`, `Worker`, `fetch` or `eval`; `style.css` has no `url(`; Background, MiniMap and Controls are inline SVG DOM. dagre is pure computation. So `connect-src`, `worker-src` and `img-src` are unaffected.
- The blocking case is build-time HTML with `style` attributes (Summary point 1), which `client:only` avoids.
- `form-action 'none'` blocks native form submission; side-panel forms must handle `onSubmit` with `preventDefault` and never rely on navigation.
- CSP applies only to `npm run build && npm run preview` (`astro.config.mjs:21`); per `context/foundation/lessons.md` ("Verify the artifact, not the config"), the island must be checked there for zero CSP console violations.

### Tailwind and styles (`src/styles/global.css`)

- `global.css:5` `@import "tailwindcss" source(none)`, `:8` `@source "../**/*.{astro,ts,tsx}"`, `:11` excludes `*.test.ts`. Imported CSS is processed regardless of `@source`, so importing React Flow's CSS does not widen the scanned input set (the "Pin the build's input set" lesson stays intact). The `@import` must sit with the other imports at `:5-6`.
- `:40-47` and `:112-119` already define `--sidebar-*` tokens, usable for the side panel.
- `:13` `@custom-variant dark (&:is(.dark *))` and `:50-82` `.dark` tokens exist; `src/layouts/Layout.astro:12` sets no theme class, so the app is light-only today.

### Island mounting (`src/pages/index.astro`, `src/layouts/Layout.astro`)

- `index.astro:5-9` renders a placeholder `<main>`; no `client:*` directive exists anywhere under `src/` (inspected: `src/**`). `README.md:7` states the whole app is one client-only React island.
- `Layout.astro:24-31` sets `html, body { height: 100% }`. React Flow needs a parent with explicit height, so the island root needs `h-screen`/`h-dvh`; `min-h-screen` alone (as on the current placeholder) is insufficient.
- `@astrojs/react` is used with no options (`astro.config.mjs:14`).

### Lint (`eslint.config.js`)

- `:17` `strictTypeChecked` + `stylisticTypeChecked` — see the dagre `any` issue; React Flow's callbacks are well typed. Legacy APIs (`onEdgeUpdate`, `updateEdge`) would trip `no-deprecated`; use `onReconnect` / `reconnectEdge` if needed.
- `:44` react-hooks `recommended-latest` — see the effect/setState issue; mutating node objects trips `react-hooks/immutability`.
- `:85` jsx-a11y applies only to `.astro` files, so `.tsx` components get no accessibility lint.
- Unconfirmed: `react/prop-types` (via `:55`) may false-positive on props typed as `NodeProps<TaskNode>`; a lint probe during implementation settles it.

### Tests (`vitest.config.ts`)

- `vitest.config.ts:5` includes only `src/**/*.test.ts`, default `node` environment, `@/` alias via `getViteConfig`. `src/lib/services/smoke.test.ts:5-13` is the pattern.
- A pure layout function in `src/lib/services/` that imports dagre is testable. Keep React Flow imports in that module `import type` so tests don't load React or d3. Component tests (`.test.tsx`, jsdom, testing-library) are outside the current setup.

### Conventions and missing pieces

- `src/types.ts` and `src/hooks/` do not exist; `PROJECT_RULES.md:39` and `components.json:18` designate them.
- shadcn: only `src/components/ui/button.tsx` is installed (`new-york`, `components.json:3`; lucide icons, `:20`); `button.tsx:7-33` has `destructive`/`ghost` variants and an `icon` size. A side panel will likely need `input`, `label`, and some multi-select for predecessors (`command` + `popover`, or `checkbox`), possibly `alert-dialog` for delete, `scroll-area`, `separator`, `badge`. Each adds Radix/cmdk packages; all are bundled, so zero-egress holds.
- Class merging must use `cn()` (`src/lib/utils.ts:4-6`, `PROJECT_RULES.md:37`).

### S-01 requirements (PRD)

- FR-001 (`prd.md:118-119`): create a Task by name only; auto-generated constant id, not prominently displayed; dependencies stored by id; names need not be unique.
- FR-002 (`prd.md:120-121`): rename and delete; renames don't touch references; dependents left without predecessors fall back to START.
- FR-003 (`prd.md:122-123`): add/remove predecessors; a cycle, START with a predecessor, or depending on FINISH is a Validation Error rejected at input with an explanation (naming the cycle).
- FR-008 (`prd.md:132-133`): auto-arranged diagram, select a Task, edit in a side panel. Drawing edges on the diagram is FR-018 (`prd.md:134`), parked.
- Business logic inputs (`prd.md:177`): each Task has an id, name, predecessors, Duration, Status (To Do / In Progress / Done), completion date when Done; plus START date and day-counting mode. Structural rules: START has no predecessors; nothing depends on FINISH; a Task without predecessors depends on START; a Task without successors feeds FINISH; no cycles.
- Validation Errors list (`prd.md:181`) includes "a dependency on an unknown id"; the app rejects any edit that would create a Validation Error "directly or indirectly".
- NFR (`prd.md:169`): up to 100 Tasks, validation results, forecast and re-arranged diagram reflect an edit within 200 ms. No device/browser for measurement is named.
- Non-goal (`prd.md:197`): no manual layout — users cannot position nodes; layout is never stored. Implies disabling node dragging (`nodesDraggable={false}`).
- No accessibility or keyboard requirements exist in the PRD or roadmap (inspected: `prd.md`, `roadmap.md`).

### Constraints later slices place on the S-01 model

- S-03 / US-03 (`prd.md:94`, `roadmap.md:128`): the file must carry Tasks, dependencies, Durations, Statuses, completion dates, START date, project name, day-counting mode, and the format should cover all of them from the start. The S-01 types should therefore already include optional `duration`, `status`, `completionDate` per Task and `name`, `startDate`, `dayCountingMode` per project, even if S-01's UI only sets `id`, `name`, `predecessors`.
- Ids must survive export/import unchanged and stay stable across exports (`prd.md:160`).
- S-02 (`roadmap.md:115`): import must reuse the same rule check as editing. This argues for plain-data project state and pure edit functions in `src/lib/services/` returning either a new project or a rejection — validate-then-commit, project unchanged on rejection (US-01, `prd.md:74`).
- S-07 / FR-005 (`prd.md:126`): add-predecessor must later also check Status/completion date, so the edit function should accept additional rules without restructuring.
- S-04 / S-05 (`prd.md:145,151`): nodes and edges need room for highlight states (Validation Warning, critical path).

## Code References

- `astro.config.mjs:14` — `react()` integration, no options
- `astro.config.mjs:22-36` — CSP directives
- `dist/index.html` (from an earlier build) — rendered `style-src` without `'unsafe-inline'`
- `src/styles/global.css:5-11` — Tailwind import and pinned sources
- `src/styles/global.css:13,50-82` — class-based dark variant and tokens
- `src/pages/index.astro:5-9` — placeholder page, island mount point
- `src/layouts/Layout.astro:12,24-31` — no theme class; full-height html/body
- `eslint.config.js:17,44,55,85` — type-checked rules, react-hooks, react recommended, a11y scope
- `vitest.config.ts:5` — test discovery pattern
- `src/lib/services/smoke.test.ts:5-13` — domain test pattern
- `src/components/ui/button.tsx:7-50` — shadcn component pattern
- `context/foundation/prd.md:118-123,132-134,169,177,181,197` — S-01 requirements and rules

## Architecture Insights

- The project model is the single source of truth; the diagram is a pure projection: `project → (nodes, edges with START/FINISH synthetic links) → dagre layout → React Flow props`. This satisfies the "layout never stored" non-goal, the React Compiler lint rules, and keeps the layout function unit-testable in Node.
- One pure rule-check module serves editing now and import later (S-02/S-03).
- START/FINISH exist in the diagram regardless of how the model stores them; whether they are stored entities is the key model decision (Open Question 2).

## Historical Context (from prior changes)

- `context/archive/2026-09-26-domain-test-gate/` — F-01 established Vitest for pure domain logic in `src/lib/services/` and wired it into CI and the Workers Builds command; S-01's domain code is its first real consumer.
- `context/foundation/lessons.md` — "Verify the artifact, not the config" (CSP must be checked under `npm run preview`) and "Pin the build's input set" (Tailwind sources; unaffected by importing React Flow CSS).
- `context/foundation/shape-notes.md:25,41` — drawing edges on the diagram was first in scope, then split out (now FR-018, parked).

## Related Research

- `context/changes/capture-task-graph/research-diagram-libraries.md` — library selection (external, exa.ai)
- `context/changes/capture-task-graph/docs-xyflow-dagre.md` — API docs (external, Context7); see corrections above

## Open Questions

For `/10x-plan` (product/design decisions; no further code research needed):

1. **FR-003 split between S-01 and S-02.** S-01 lists FR-003, but S-02 owns explained rejections. Merges to `main` auto-deploy, so an S-01 without cycle rejection would ship a build that can hold a Validation Error (Guardrail, `prd.md:62`). Option: S-01 makes START/FINISH violations impossible by construction and blocks cycles (e.g. excluding candidates that would close a cycle from the predecessor picker); S-02 adds the explanation naming the cycle.
2. **START/FINISH: stored or implicit?** Stored entities with ids (MVP step "START → A", `prd.md:43`; import errors "START with a predecessor", `prd.md:181`) vs purely derived from empty predecessor/successor sets (`prd.md:146,177`). Affects the file format and whether a Task may list START explicitly alongside other predecessors.
3. **Task-name rules.** Empty/whitespace names, trimming, max length — unspecified. Rejection copy must avoid "invalid". Also: how the predecessor picker distinguishes same-named Tasks when ids are "not prominently displayed".
4. **Id format.** Random UUID (`crypto.randomUUID()`, available offline) vs short sequential ids (`t1`, `t2`) — matters for diff-friendly, hand-editable files in S-03.
5. **Delete semantics.** Confirm: dependents fall back to START only; the deleted Task's predecessors are not bridged to its successors. Confirmation dialog or not.
6. **START/FINISH selectable in S-01?** Nothing to edit until S-04 adds the START date; they must be protected from rename/delete.
7. **Default Status** of a new Task (presumably To Do) and whether S-01's types include Duration/Status/completion date now (recommended, per S-03 risk).
8. **Keyboard/accessibility.** No requirement; decide a baseline for side-panel controls and diagram selection.
9. **200 ms measurement.** Which browser/machine; S-01 has no forecast yet, so it measures edit → validation → layout → render.
10. **Diagram presentation.** Direction (LR suggested), zoom/pan, refit after each edit, how a new Task is created (toolbar vs panel), deselection, and `colorMode`.
11. **React Flow attribution link.** Keep it (default) or hide it (Pro subscription).
12. **Unverified toolchain points.** Not installed or built during research: Vite 8 (Rolldown) handling zustand's CJS `use-sync-external-store/shim/with-selector` under Astro 7, and the possible `react/prop-types` false positive. The first implementation phase should install, run the full gate (`astro sync` → lint → `astro check` → test → build) and check `npm run preview` for CSP violations.
