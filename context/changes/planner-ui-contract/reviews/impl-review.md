<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Planner UI Contract Implementation Plan

- **Plan**: context/changes/planner-ui-contract/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-04
- **Verdict**: NEEDS ATTENTION (at review time; after triage: F1, F2, F3, F4 and F6 fixed, F5 and F7 skipped)
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

## Automated checks (re-run 2026-10-04, at 8bc916d)

- `npm run lint`: pass. `npx astro check`: 0 errors, 0 warnings, 0 hints. `npm test`: 52/52 pass. `npm run build`: pass, 2 pages (`index.html`, `404.html`).
- `dist/`: no `kitchen-sink` file, and the sitemap lists only `/`. The built CSS contains `--xy-edge-stroke:var(--muted-foreground)` and no `bg-cosmic`. `dist/index.html` contains the skeleton markup and the `<noscript>` line.
- Hardcoded-value scan over `src/components/planner/*` and `src/pages/index.astro`: 0 hits. `package.json` and `package-lock.json`: no diff against `main`.

## Findings

### F1 — Focusable Task nodes are announced with wrong instructions and no name

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Diagram.tsx:78-97, src/lib/services/diagram-layout.ts:57-64
- **Detail**: Phase 3 made Task nodes focusable, which brings in React Flow's hidden node description (`aria-describedby`). With keyboard a11y on, React Flow uses `node.a11yDescription.keyboardDisabled` (`@xyflow/system` dist/esm/index.mjs:31): "…You can then use the arrow keys to move the node around. Press delete to remove it…". Neither works here (`nodesDraggable={false}`, `deleteKeyCode={null}`). The node also has `role="group"` with `aria-roledescription="node"` and no `aria-label`, so a screen reader announces an unnamed "node" with nothing to say that Enter edits it. Verified in `@xyflow/react` dist/esm/index.mjs:91-95.
- **Fix**: Pass `ariaLabelConfig={{ "node.a11yDescription.keyboardDisabled": "Press Enter or Space to edit this Task." }}` on `<ReactFlow>`. Set `ariaLabel: task.name` (and `ariaRole: "button"`) on Task nodes in `diagram-layout.ts`, with a test assertion.
- **Decision**: FIXED. `ariaLabelConfig` is a module-scope constant in `Diagram.tsx`. Task nodes carry `ariaLabel: task.name` and `ariaRole: "button"`, and the test asserts both. Lint, astro check and 52/52 tests pass.

### F2 — The literal-value lint rule is narrower than the UI rule it enforces

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: eslint.config.js:71-76
- **Detail**: `PROJECT_RULES.md` → UI says "No literal colours …, Tailwind palette classes … or arbitrary values" and that `npm run lint` rejects them. The rule copies the `/10x-ui` scan regex, as the plan asked, so these gaps are inherited, not drift. Probed through ESLint on a planner path, the rule misses:
  - arbitrary values that are not px/rem lengths: `w-[50%]`, `h-[10vh]`, `bg-[var(--x)]`, `grid-cols-[1fr_2fr]`;
  - palette classes on prefixed utilities: `border-t-red-500`, `ring-offset-white`, and the `caret-`, `accent-` and `decoration-` variants;
  - Tailwind 4.2's `mauve`, `olive`, `mist` and `taupe` palettes;
  - the `lab(`, `oklab(`, `lch(`, `hwb(` and `color(` functions;
  - named colours in `style={{ color: "red" }}`.

  It also rejects legitimate strings such as `"Task #123"` and `href="#facade"`.

- **Fix A ⭐ Recommended**: Widen the patterns: arbitrary values `-\[[^\]]+\]`, a prefix group `(border-[xytrblse]|ring-offset|decoration|accent|caret)`, the four new palettes, `\b(ok)?(lab|lch)\(|\bhwb\(|\bcolor\(`, and a `JSXAttribute[name.name='style']` ban. Anchor hex to `(^|[\s\[:'"])#`.
  - Strength: the lint then enforces what the rule text promises, and the Phase 6 probes stay valid.
  - Tradeoff: diverges from the `/10x-ui` scan regex, so the two checks can disagree. A broad arbitrary-value ban may flag a future legitimate `grid-cols-[…]`.
  - Confidence: HIGH — each gap was reproduced by probe.
  - Blind spot: no existing planner file was linted against the wider pattern. Run it before committing.
- **Fix B**: Keep the regex and narrow the `PROJECT_RULES.md` wording to what the lint actually checks.
  - Strength: no config churn, and parity with the scan.
  - Tradeoff: the guard stays weaker than the intent, and the next agent can use `w-[50%]` or `border-t-red-500` silently.
  - Confidence: MED — honest, but it weakens the contract the change exists to establish.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A, with these patterns:
  - hex anchored to the start or to `[`, `(`, `:` or `,`, and limited to 3/4/6/8 digits;
  - `hwb`, `lab`, `oklab`, `lch`, `oklch` and `color` added;
  - every arbitrary value `-\[[^\]]+\](?!:)`, so variants such as `data-[…]:` still pass;
  - prefixed palette utilities and the mauve, olive, mist and taupe palettes added;
  - a `JSXAttribute[name.name='style']` ban.

  A temporary probe file (since deleted) showed all 25 expected rejections and 7 expected passes (`"Task #123"`, `data-[state=open]:`, `aria-[invalid=true]:`, token classes). Full `npm run lint` passes.

### F3 — Some Progress items marked done lack evidence in the repo

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/planner-ui-contract/plan.md:402, 410, 423, 442, 457
- **Detail**:
  - Items 1.6, 2.5, 3.9 and 4.7 call for before/after or state screenshots at 1440, but only `screenshots/kitchen-sink-{1440,1024}.png` were saved. `research.md` mentions a "first Phase 1 screenshot", so they were probably taken but not kept.
  - Item 1.1 ("package.json … unchanged by the shadcn add") is literally false. Commit f45aa7d says the CLI added the `cn` package, and the implementer reverted it and rewrote the import. The plan said to stop if the CLI added anything to `package.json`. The end state is clean, and the CLI quirk is now recorded in `PROJECT_RULES.md`.
- **Fix**: Add a note under the Phase 1–4 Progress blocks: the per-phase screenshots were viewed and not kept, and in 1.1 the CLI added `cn`, which was reverted. Alternatively, retake and save the four screenshots.
- **Decision**: FIXED. The Progress format keeps step titles immutable, so dated "Evidence note" paragraphs were added after the Implementation Note of plan Phases 1–4 instead of to Progress.

### F4 — Benign unplanned additions not recorded in the plan

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/planner/TaskNode.tsx:19-21, src/components/planner/TaskPanel.tsx:156, src/components/planner/TaskPanel.tsx:216, src/styles/global.css:148-150, src/pages/index.astro:9
- **Detail**: Unplanned additions, all small, commented and token-only:
  - hover states the Phase 5 gate surfaced: `hover:border-ring` and `transition-colors` on Task nodes, a hover on the remove (×) button, and `hover:bg-destructive/80` on Delete Task;
  - the `.react-flow__attribution a` colour rule (recorded in `tokens.md`);
  - `<main>` changed to `flex h-dvh flex-col` for the skeleton;
  - a new deferred charge C6 in `research.md`.
- **Fix**: Add a short "Addenda" note to the plan listing them.
- **Decision**: FIXED. A `## Addenda` section before `## Progress` in plan.md lists each addition with its commit, plus the F1/F2 review fixes.

### F5 — Escape on a focused, selected node drops focus to body

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Diagram.tsx:58-61
- **Detail**: Selection stays in sync, as criterion 3.8 asks. However, React Flow's `handleNodeClick` unselect path calls `requestAnimationFrame(() => nodeRef.current.blur())` (`@xyflow/react` index.mjs:1656-1670) when the node is selected, and the node is selected by app state. A keyboard user who presses Escape loses the visible focus.
- **Fix**: Accept it as-is: the browser keeps the sequential-navigation point, and the code comment already describes the behaviour. Or, in `handleKeyDown`, refocus the target in a `requestAnimationFrame` after Escape.
- **Decision**: SKIPPED

### F6 — The loading fallback gives assistive technology no status and never times out

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/PlannerSkeleton.astro:11
- **Detail**: The skeleton is entirely `aria-hidden="true"`, which is right for its boxes. But nothing in the fallback says the planner is loading, so a screen reader hears an empty `<main>`. If the island fails while JavaScript is on (a script error or a CSP hash mismatch), the skeleton pulses forever with no message, because `<noscript>` covers only JavaScript being off.
- **Fix**: Add a visually hidden `<p role="status">Loading the planner…</p>` inside the fallback, outside the `aria-hidden` subtree. Astro removes the whole fallback on hydration.
- **Decision**: FIXED. `<p class="sr-only" role="status">Loading the planner…</p>` was added before the `aria-hidden` frame in `PlannerSkeleton.astro`, and the header comment was updated. The built `dist/index.html` carries it in the rendered fallback; the second copy sits in Astro's inert fallback `<template>`, which was already there before. Lint and astro check pass.

### F7 — The kitchen-sink screenshots carry capture artifacts

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/planner-ui-contract/screenshots/kitchen-sink-1440.png
- **Detail**: In the 1440 capture:
  - the Astro dev toolbar overlays the focus-visible cell;
  - a stray text selection highlights "Choose a Task…" and "Delete Task" in the error cell and the "empty" heading;
  - the empty cell shows START zoomed to maximum with FINISH clipped. That is the deferred C6 (`fitView` in a narrow canvas), so the gate image does not show what a first-run user sees at full width.
- **Fix**: Retake both screenshots with the dev toolbar hidden and no text selected, and note under the empty cell that the clipping is C6.
- **Decision**: SKIPPED
