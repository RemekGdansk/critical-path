<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Render Crash Recovery

- **Plan**: context/changes/render-crash-recovery/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

## Findings

### F1 — Validation Error shown in the Validation Warning colour

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/RenderCrashFallback.tsx:53
- **Detail**: The "This project contains a Validation Error" line uses `text-warning`. `global.css` reserves `--warning` for Validation Warnings, "kept apart from --destructive (Validation Errors)", and every other Validation Error in the planner uses `text-destructive` (NewTaskForm, ProjectControls, StartPanel, TaskPanel). The two domain terms look the same on this screen.
- **Fix**: Change `text-warning` to `text-destructive`.
- **Decision**: FIXED

### F2 — Plan and comments still say the boundary is keyed by `replacements`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/render-crash-recovery/plan.md:31, :50, :149; src/components/planner/RenderErrorBoundary.tsx:19-21; src/hooks/useProject.ts:43
- **Detail**: During Phase 3 the user approved keying the boundary by a `goBacks` counter (Planner.tsx:56-88), because keying it by `replacements` remounted the whole view on every import and dropped focus from New Task (failed e2e/project-file.spec.ts:151). The deviation leaves no functional hole: while the fallback is shown, Go back is the only way to change the project, and it increments `goBacks`. But the plan's Key Discoveries, Critical Implementation Details and Phase 2 contract still say `key={replacements}`. The boundary's JSDoc says to key it by something "that changes when the project is replaced". `useProject.ts:43` says `replacements` counts only `replaceProject`, though `restorePreviousProject` now increments it too.
- **Fix**: Add an addendum to the plan recording the `goBacks` key and why, and reword the two comments.
- **Decision**: FIXED

### F3 — Success criterion: e2e re-run blocked by a dev server on port 4321

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A
- **Detail**: During this review, every unit check passed again: the two scoped Vitest files (49 tests), lint, `astro check` (0 errors, 0 warnings), `npm test` (366 tests), build and `check:csp`. `npm run test:e2e` failed 6/6 because an `astro dev` process was listening on port 4321, and `playwright.config.ts` reuses an existing server. Dev mode has no CSP; the seed test's egress probe returned `sent`, not `blocked`. The whole e2e suite passed 6/6 at 00:03 on 2026-10-14, on source identical to HEAD (the later commit 3503454 changes only plan.md and change.md).
- **Fix**: Stop `npm run dev`, then re-run `npm run test:e2e`.
- **Decision**: FIXED (re-run with port 4321 free: 6 passed)

### F4 — The fallback's own render can throw

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/RenderCrashFallback.tsx:39
- **Detail**: `validateProject(project)` runs during the fallback's render with no guard. A throw there has no outer boundary, so the root would unmount and the page would go blank, the outcome this change exists to prevent. The code path is throw-free for a well-typed `Project`: `findCycle` is iterative, so the 2,500-Task chain is safe, and the e2e test proves it. Only a malformed runtime shape, from an import-parser bug, could trigger it. `logRenderCrash` already guards its serialization the same way.
- **Fix**: Wrap the `validateProject` call in try/catch. On a throw, show "The project could not be checked for Validation Errors." and keep Export.
- **Decision**: FIXED (checkProject shows the checker's own error in the alert; red-first jsdom case in Planner.test.ts)

### F5 — Focus falls to `<body>` after Go back

- **Severity**: 💬 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Planner.tsx:68-71
- **Detail**: Go back unmounts the fallback, including the focused button, and remounts `PlannerView`, so a keyboard user lands on `<body>`. Delete Task and Import both send focus to New Task for this reason (Planner.tsx handleDeleteTask, handleReplaceProject). The plan does not cover focus after Go back.
- **Fix**: Have `PlannerView` take a `focusNewTaskOnMount` flag, set when `goBacks > 0`, and focus the New Task input in a mount effect.
  - Strength: Matches the existing rule that an action removing the focused control sends focus to New Task.
  - Tradeoff: One more prop and effect on the island, and a jsdom test to pin it.
  - Confidence: MED — the remount by key makes a mount effect the natural hook, but this hasn't been tried in the browser.
  - Blind spot: React Flow's `fitView` on mount may also move focus; not checked.
- **Decision**: FIXED (PlannerView focusNewTaskOnMount; red-first toBeFocused in e2e/render-crash.spec.ts, since no jsdom path reaches a crash with a previous project)

### F6 — Go back discards the crashed project without confirmation

- **Severity**: 💬 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Planner.tsx:68-71; src/hooks/useProject.ts:134-140
- **Detail**: After Go back, the project the render crashed on is gone from memory, unless it was exported first (Export is offered first and focused) or copied from the console line. A crash not caused by the latest project change (one caused by a selection or a draft) would also revert a good edit. The button copy is accurate and the user chooses, so this is acceptable for now. It overlaps with S-08's "confirm before losing unexported changes" rule.
- **Fix**: Make no code change now. Note in the S-08 (start-new-project) plan that Go back on the crash fallback is another action that replaces the project, and should get the same unexported-changes confirmation.
  - Strength: Keeps this change in scope ("No general undo"), and gives the confirmation rule a single implementation.
  - Tradeoff: Until S-08 lands, Go back can discard an unexported crashed project in one click.
  - Confidence: HIGH — S-08 already owns "unexported changes" detection.
  - Blind spot: None significant.
- **Decision**: FIXED (noted in roadmap S-08 Risk; no code change)

### F7 — `break-words` where sibling components use `wrap-break-word`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/RenderCrashFallback.tsx:50
- **Detail**: The error line uses `break-words`. ProjectControls.tsx:209 and TaskPanel.tsx:283 use `wrap-break-word`, the Tailwind 4 name.
- **Fix**: Change `break-words` to `wrap-break-word`.
- **Decision**: FIXED
