---
change_id: capture-task-graph
topic: Diagram rendering and auto-layout libraries for S-01
kind: external
date: 2026-09-27
sources: exa.ai web search
---

# External research: diagram rendering and auto-layout libraries

## Question

Which libraries should render the S-01 auto-arranged Task diagram (Tasks without predecessors hang off START, Tasks without successors feed FINISH) while staying compatible with `context/foundation/tech-stack.md` — Astro 7 static output, a single client-only React 19 island, TypeScript, Tailwind 4 — and the CSP in `astro.config.mjs` (`connect-src 'none'`, `worker-src 'none'`, Astro-managed hashed `script-src` / `style-src`)?

## Recommendation

**`@xyflow/react` (React Flow 12) for rendering + `@dagrejs/dagre` for layout.** This is the pairing `tech-stack.md` already anticipates, and nothing found conflicts with the static build or the CSP.

| Library                                | Role                                                    | Evidence                                                                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@xyflow/react` 12.11.x (MIT)          | Diagram rendering, pan/zoom, custom React nodes / edges | ~11M weekly downloads; peer deps `react >=17`. React 19 peer issue (#5229, zustand) resolved via zustand 4.5.6. xyflow updated its UI components for React 19 + Tailwind 4 + shadcn/ui. No built-in layout — by design, bring your own.    |
| `@dagrejs/dagre` 3.0.0 (MIT, Mar 2026) | Layered layout of a directed graph                      | Maintained fork (the unscoped `dagre` is unmaintained). v3 is a full TypeScript rewrite with bundled types and standardised ESM/CJS exports for Vite. Synchronous, small, speed-focused; xyflow docs call it "largely a drop-in solution". |

### Why it fits the constraints

- **CSP, styles.** React Flow has not injected CSS since v11; the app must import it. With Tailwind 4, xyflow instructs importing `@xyflow/react/dist/style.css` in `global.css` after `@import "tailwindcss"`. In a production build it ships as a same-origin stylesheet (covered by Astro's `style-src`). Node positioning uses React `style` props, which are applied via the CSSOM and are not blocked by CSP.
- **CSP, workers and network.** dagre runs synchronously on the main thread — no Web Worker (`worker-src 'none'`), no fetch (`connect-src 'none'`), no runtime CDN.
- **Layout is never stored** (PRD non-goal "Manual layout"). A synchronous layout function lets positions be derived from the Task graph on every change, outside the project model and the file format.
- **Static output.** Both libraries are client-only and live inside the one React island; no server features.

## Alternatives considered

| Option                           | Verdict                                 | Reason                                                                                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `elkjs` 0.12.0                   | Fallback only                           | Best layered layout and edge routing, but: its Web Worker mode is blocked by `worker-src 'none'`, so it must use `elkjs/lib/elk.bundled.js` on the main thread; ~1.3 MB minified (GWT-transpiled Java); async API; EPL-2.0 / GPL-3.0 licence. xyflow docs: "We don't often recommend elkjs". |
| `d3-dag`                         | Fallback if dagre layouts are cluttered | TypeScript-first, a fraction of elkjs's size, exposes a dagre-compatible API and adds better crossing minimisation (Sugiyama with quality levels, Zherebko, Grid).                                                                                                                           |
| `d3-hierarchy`                   | Rejected                                | Requires a single root and equal node sizes; a Task graph is a DAG, not a tree.                                                                                                                                                                                                              |
| Cytoscape.js + `cytoscape-dagre` | Rejected                                | Canvas rendering and an imperative API; nodes are not React components, so shadcn/Tailwind cannot be reused and React state integration needs a wrapper.                                                                                                                                     |
| Reaflow                          | Rejected                                | ELK built in, but stale (no release for 9+ months at time of source).                                                                                                                                                                                                                        |
| reagraph, Sigma.js, AntV G6      | Rejected                                | WebGL/canvas network visualisation aimed at large graphs; heavy and a poor fit for small, labelled, editable DAGs.                                                                                                                                                                           |

## Caveats for `/10x-plan`

1. **Licence trap.** reactflow.dev's "Auto Layout" example (reusable `useAutoLayout` hook) is under the paid xyflow Pro licence. The free "Dagre Tree" and "Elkjs Tree" examples and the "Layouting overview" page are fine to follow.
2. **Node dimensions.** dagre needs each node's width and height. Either use fixed-size Task nodes or lay out after React Flow measures them (`node.measured`). Fixed sizes are simpler and cheaper for the 200 ms NFR.
3. **START / FINISH.** Model them as ordinary nodes in the layout graph with synthetic edges (START → every Task without predecessors, every Task without successors → FINISH). dagre handles multiple roots, unlike d3-hierarchy.
4. **200 ms NFR is unverified.** The roadmap lists "auto-layout plus re-render of a 100-Task diagram within 200 ms" as an open S-01 Unknown. dagre is the fastest option here, but the plan should include a quick measurement.
5. **CSP verification.** CSP is not applied under `npm run dev`; confirm the diagram renders with no console CSP violations via `npm run build && npm run preview`.

## Sources

- React Flow, Layouting overview — https://reactflow.dev/learn/layouting/layouting
- React Flow, Dagre Tree example — https://reactflow.dev/examples/layout/dagre
- React Flow, Elkjs Tree example — https://reactflow.dev/examples/layout/elkjs
- React Flow, Auto Layout (Pro) — https://reactflow.dev/examples/layout/auto-layout
- React Flow, What's new (React 19 + Tailwind 4, CSS import in `global.css`) — https://reactflow.dev/whats-new
- `@xyflow/react` on npm — https://www.npmjs.com/package/@xyflow/react
- xyflow issue #5229, React 19 support — https://github.com/xyflow/xyflow/issues/5229
- xyflow issue #3520, React Flow and CSP — https://github.com/wbkd/react-flow/issues/3520
- React Flow v11 migration, "We are not injecting CSS anymore" — https://github.com/xyflow/web/blob/main/sites/reactflow.dev/src/content/learn/troubleshooting/migrate-to-v11.mdx
- xyflow discussion #2788, non-tree layouts — https://github.com/xyflow/xyflow/discussions/2788
- dagre changelog (3.0.0 TypeScript rewrite) — https://github.com/dagrejs/dagre/blob/master/changelog.md
- `@dagrejs/dagre` 3.0.0 — https://npmx.dev/package/@dagrejs/dagre
- elkjs README / npm — https://github.com/kieler/elkjs, https://www.npmjs.com/package/elkjs
- elkjs issue #82, bundled version has no worker — https://github.com/kieler/elkjs/issues/82
- elkjs issue #6, bundle size — https://github.com/kieler/elkjs/issues/6
- d3-dag — https://registry.npmjs.org/d3-dag
- Library comparison (React Flow, Cytoscape.js, G6, Reaflow, …) — https://github.com/amah/smart-data-dico/issues/5
