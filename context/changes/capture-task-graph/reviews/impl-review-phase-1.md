<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Capture the Task Graph (S-01)

- **Plan**: context/changes/capture-task-graph/plan.md
- **Scope**: Phase 1 of 4
- **Reviewed phases**: 1
- **Date**: 2026-09-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Pre-commit hook is inactive; roadmap committed unformatted

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/roadmap.md:45 (symptom); package.json scripts (cause)
- **Detail**: `PROJECT_RULES.md` says pre-commit runs `eslint --fix` and `prettier --write` via husky + lint-staged, and `.husky/pre-commit` exists, but in this clone `core.hooksPath` is unset and `.git/hooks/` has no pre-commit hook. `package.json` has never had a `"prepare": "husky"` script, so `npm install`/`npm ci` never activates it. Commit 15fd1c2 therefore ran no hook: the S-01 row in the At-a-glance table (`in-progress |`) is wider than its column, and `npx prettier --check context/foundation/roadmap.md` fails. All other files in the commit pass Prettier and ESLint. The missing `prepare` script predates this change; CI does not run Prettier, so nothing catches it.
- **Fix A ⭐ Recommended**: Add `"prepare": "husky"` to `package.json` scripts, run `npm install` once to activate the hook, and reformat `roadmap.md` with `npx prettier --write`.
  - Strength: Makes the documented hook real for every clone; husky 9's `prepare` is its documented setup and no-ops when `.git` is absent.
  - Tradeoff: `npm ci` in CI and in Cloudflare Workers Builds now also runs `husky`; it only sets `core.hooksPath` (or skips outside a git work tree), but it touches deploy-build behaviour.
  - Confidence: MED — standard husky 9 setup; not yet verified in Workers Builds.
  - Blind spot: Whether the Workers Builds checkout is a git work tree.
- **Fix B**: Run `npx husky` locally once and reformat `roadmap.md`; leave `package.json` alone.
  - Strength: Zero effect on CI and deploy builds.
  - Tradeoff: Every fresh clone silently loses the hook again — the same gap will recur.
  - Confidence: HIGH — local-only change.
  - Blind spot: Other clones or contributors.
- **Decision**: FIXED (Fix A) — added `"prepare": "husky"`, ran `npm install` (core.hooksPath = .husky/_), reformatted roadmap.md with Prettier

### F2 — Controls padlock can re-enable node dragging

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/planner/Planner.tsx:31
- **Detail**: `<Controls />` shows the interactive toggle, which writes `nodesDraggable`/`nodesConnectable`/`elementsSelectable` straight into the React Flow store (`@xyflow/react` esm `index.mjs:4613-4619`), overriding `nodesDraggable={false}`. Harmless in Phase 1 (controlled nodes, no `onNodesChange`, no project data), but it contradicts the PRD non-goal "Manual layout" if it survives. Plan Phase 4 already specifies `<Controls showInteractive={false}>`.
- **Fix**: None now; confirm `showInteractive={false}` lands in Phase 4's `Diagram.tsx`.
- **Decision**: SKIPPED — left to Phase 4, whose Diagram.tsx contract already specifies `<Controls showInteractive={false}>`

### F3 — Internal HTML comment ships in the built page

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/index.astro:8
- **Detail**: The `<!-- client:only is the only permitted directive … -->` comment is emitted verbatim into `dist/index.html` (verified). Harmless, but it ships developer notes to every visitor and adds bytes.
- **Fix**: Turn it into an Astro expression comment `{/* … */}`, which is stripped at build.
- **Decision**: FIXED — switched to an Astro `{/* … */}` comment; dist/index.html now has no HTML comments

### F4 — Unplanned Shiki config change

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: astro.config.mjs:15-17
- **Detail**: `markdown: { syntaxHighlight: false }` is not in the plan. It was approved by the user during Phase 1 manual verification, silences Astro's `warnIfCspWithShiki` build warning, tightens rather than loosens the CSP, and is documented in the commit body. Benign EXTRA.
- **Fix**: None — already documented in commit 15fd1c2.
- **Decision**: SKIPPED

### F5 — shadcn CLI generates imports that break repo conventions

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/input.tsx:3, src/components/ui/label.tsx:2-4
- **Detail**: `npx shadcn@latest add input label` wrote `import { cn } from "cn"`, installed the npm package `cn`, and used the `radix-ui` umbrella package, despite `components.json` pointing `utils` at `@/lib/utils`. The implementer corrected both files and the lockfile (0 `cn`/`radix-ui` entries, verified). Every future `shadcn add` (the plan and later slices will add more) will reproduce this.
- **Fix**: Record as a lesson: after `shadcn add`, re-point `cn` to `@/lib/utils`, use per-primitive `@radix-ui/react-*` packages, and check the lockfile.
- **Decision**: SKIPPED
