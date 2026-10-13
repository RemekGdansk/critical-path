# Render Crash Recovery Implementation Plan

## Overview

Lift the project state above a React error boundary, so a throw during render no longer blanks the page and destroys the only copy of the project. The boundary's fallback names the error, offers "Export the project as it was" and "Go back to the project before the last change", and logs the error, the component stack and the serialized project to the console. This closes audit finding B1 and contains A1 (an imported 1,800+ Task chain crashes dagre in the first render) and C1 (date parsing during render) from `context/audits/observability/2026-10-13_project-file-edit-render-weekdays.md`.

## Current State Analysis

- `Planner` (`src/components/planner/Planner.tsx:37-58`) is the single island. It calls `useProject` and runs `forecast()` in the same render. `Diagram.tsx:37` (`layoutDiagram`), `StartPanel.tsx:46` (`forecastBaseDate`) and `TaskPanel.tsx:67` (`predecessorCandidates`) run more throwing domain code during render.
- There is no error boundary anywhere in `src/`. `@astrojs/react` mounts with a bare `createRoot` (`node_modules/@astrojs/react/dist/client.js:96`), and React 19's production `defaultOnUncaughtError` unmounts the root and drops the component stack (`react-dom-client.production.js:6182-6184`). The result is a white page and one minified `Uncaught …` line.
- `useProject` (`src/hooks/useProject.ts`) holds the committed project in `useState` plus a `latest` ref (`:52`). `replaceProject` (`:99-104`) commits an imported project before the render that lays it out, so in A1 the project open before the import is already gone when the render throws. The hook keeps no earlier project.
- Export already exists as pure pieces: `serializeProject` and `projectFileName` (`src/lib/services/project-file.ts:65`, `:91`) and `downloadTextFile` (`src/lib/download.ts:7`). `validateProject` (`src/lib/services/project.ts:278`) returns the first Validation Error or `undefined`.
- `src/` has no `console.*` calls. ESLint sets `no-console: "warn"` (`eslint.config.js:26`), and `npm run lint` (`eslint .`) has no `--max-warnings`.
- Tests: `Planner.test.ts` renders the real `Planner` in jsdom with React Flow's shim (§6.2 of `context/foundation/test-plan.md`). `useProject.test.ts` has a rejected-edit table (`:174-228`) asserting that project, selection and replacements are unchanged. `e2e/project-file.spec.ts` drives export and import in the built app under the CSP.

## Desired End State

When any component below the island root throws during render:

- The page shows a fallback (`role="alert"`) in place of the planner. The fallback reads that the planner stopped because of an internal error, shows `<error name>: <error message>`, and says the project is still here and can be exported.
- **Export the project as it was** downloads `serializeProject(<committed project>)` as `projectFileName(name)`, or as `critical-path-recovered.json` when the project has no name. If `validateProject` reports a Validation Error, the fallback still offers Export, and says the file holds a Validation Error, quotes its message, and warns that Import will reject the file until it is fixed by hand.
- **Go back to the project before the last change** appears only when the hook holds a previous project. It restores that project, selects nothing and remounts the planner view. In A1, this brings back the project that the crashing import replaced.
- The console gets one `console.error` line with the error object, React's component stack and the serialized project. Nothing leaves the device.

Verify with the jsdom red test (cyclic project → fallback, message, export contents, console line), the hook tests for `previousProject`, and a Playwright run on build + preview that imports a 2,500-Task chain, sees the fallback, downloads the file and goes back to the earlier project.

### Key Discoveries:

- A boundary inside `Planner` can't catch `Planner`'s own `forecast()` throw (`Planner.tsx:58`), and a boundary outside it would hold no project to export. The state must sit in a component above the boundary, and every throwing derivation must sit below it (audit §4, root cause 1).
- `Planner` accepts `initialProject` without validating it (`Planner.tsx:54`), so a hand-built cyclic project makes the real `forecast()` throw `"The project contains a cycle."` (`task-graph.ts:178`) during render. That gives a deterministic red test with no mock of the domain.
- `replacements` already serves as a remount key for views holding drafts of the old project (`useProject.ts:37`, `Planner.tsx:116`). Keying the boundary by it gives the reset after "go back" for free.
- `index.astro`, `src/dev/KitchenSinkPlanner.tsx` and `Planner.test.ts` import `Planner` by name, so it stays the exported island component.

## What We're NOT Doing

- B2 (the cycle error names no Task), A3 (catching errors in the async import handler), A4 and A5 (export confirmation, the dropped DOMException), and P1 (hydration-failure screen) are separate audit fixes.
- No import bound on Task count or chain depth (audit fix 2 for A1 and A2). This change only contains A1; the e2e reproduction will be rewritten when that bound lands.
- No general undo. "Go back" exists only on the crash fallback and only one step back.
- No "Try again" that re-renders the same project: every known throw is deterministic.
- No `onUncaughtError` through a custom Astro mount, and no global `window.onerror` or `unhandledrejection` listener.
- No `react-error-boundary` dependency.
- No change to the "never in an exported file" guardrail outside the crash fallback. Normal Export is unchanged.

## Implementation Approach

Three layers, each tested before it is built. First the hook learns which project was committed before the latest one and how to restore it. Then `Planner` splits into the island root (`useProject` + boundary + fallback) and `PlannerView` (everything that derives from the project and may throw). A small local class boundary catches the throw, logs it and renders `RenderCrashFallback` with the root's committed project. Last, a Playwright case proves the whole path in React's production build under the CSP, and the kitchen sink gets the crash state for the visual check.

## Critical Implementation Details

- **State sequencing:** `previousProject` must be updated in the same commit as the project, from `latest.current` before it is overwritten, in both `apply` (accepted edits only) and `replaceProject`. A rejected edit must leave it untouched. `restorePreviousProject` sets the project to the previous one, clears `previousProject` (a second crash offers no "go back"), sets selection to `null` and increments `replacements`, so the boundary keyed by `replacements` remounts with no error.
- **Logging:** log from `componentDidCatch`, where React provides `componentStack`, not from the fallback's render, so the line is written once per crash. Serialize the project for the log inside a `try`. If serialization itself throws, log the error without the project and with that second error, so the logging never throws out of the boundary.

## Phase 1: The hook remembers the previous project

### Overview

`useProject` keeps the project committed before the latest commit and can restore it. Test-first, at hook level.

### Changes Required:

#### 1. Previous project in the state hook

**File**: `src/hooks/useProject.ts`

**Intent**: Remember the project that each accepted edit or replacement superseded, so the crash fallback can bring it back. A rejected edit changes nothing, including this.

**Contract**: `ProjectState` gains `previousProject: Project | undefined` (undefined until the first commit, and after a restore). `ProjectActions` gains `restorePreviousProject: () => void`, which is a no-op when there is no previous project. Otherwise it commits the previous project through `latest`, clears `previousProject`, selects nothing and increments `replacements`. Update the module and interface comments to say so.

#### 2. Hook tests

**File**: `src/hooks/useProject.test.ts`

**Intent**: Pin the new state at the commit boundary. A rejected edit still commits nothing, and an accepted edit or an import records what it replaced.

**Contract**: The existing rejected-edit `it.each` (`:175`) also asserts that `previousProject` is unchanged (`undefined` on the fresh fixture). New cases:

- an accepted edit sets `previousProject` `toBe` the fixture
- two accepted edits in one `act` leave the first edit's result as previous
- `replaceProject` sets the replaced project as previous
- `restorePreviousProject` after `replaceProject` brings back the fixture (`toBe`), selects nothing, increments `replacements` and clears `previousProject`
- `restorePreviousProject` with no previous project changes nothing

### Success Criteria:

#### Automated Verification:

- New hook tests fail before the hook change and pass after it: `npx vitest run src/hooks/useProject.test.ts`
- Whole suite passes: `npm test`
- Lint and type check pass: `npm run lint && npx astro check`

**Implementation Note**: After automated verification passes, continue to Phase 2. This phase has no manual check.

---

## Phase 2: Error boundary and crash fallback

### Overview

Split `Planner` so the state sits above a boundary. Add the fallback with Export, the Validation Error warning, the recovery file name, Go back and the console line. The jsdom red test comes first.

### Changes Required:

#### 1. Red test: a render crash shows the fallback and keeps the project exportable

**File**: `src/components/planner/Planner.test.ts`

**Intent**: Reproduce B1 in jsdom on the real domain. Today this test fails, because the render throws out of `render()` and nothing is on screen.

**Contract**: A new `describe("Planner: a render crash keeps the project exportable")`. Its fixture is a hand-built `Project` (not through the edit functions, which would reject it), named, with Tasks A (id 1, predecessor 2) and B (id 2, predecessor 1) and START `2999-01-01`. `forecast()` throws `"The project contains a cycle."` for it. Set up `console.error` with `vi.spyOn` (silenced, restored in `afterEach`), plus stubs of `URL.createObjectURL`/`revokeObjectURL` and `HTMLAnchorElement.prototype.click` that capture the Blob and the `download` name (browser APIs, not the domain). Assertions:

- a `role="alert"` region contains `Error: The project contains a cycle.`
- the planner (the "New Task" textbox) is gone
- clicking "Export the project as it was" downloads `<name>.json` whose text is `toBe(serializeProject(fixture))`
- the fallback states the file holds a Validation Error and quotes `validateProject(fixture)`'s message, with none of "invalid", "conflict" or "blocked"
- "Go back to the project before the last change" is absent (no previous project)
- `console.error` was called with the error and a string containing `serializeProject(fixture)`

A second case uses the same fixture without a name and expects `critical-path-recovered.json`.

#### 2. Fallback view

**File**: `src/components/planner/RenderCrashFallback.tsx` (new)

**Intent**: The screen shown in place of the planner after a render throw. It keeps the user's project one click from a file and, when possible, one click from the previous project.

**Contract**: Props are `error: unknown`, `project: Project`, `previousProject: Project | undefined` and `onGoBack: () => void`. It renders a `role="alert"` region with a heading ("The planner stopped because of an internal error."), `<name>: <message>` for an `Error` (or `String(error)` otherwise), and a line that the project is still here and can be exported. It runs `validateProject(project)`, and if that returns a Validation Error, adds the warning: "This project contains a Validation Error: <message> Import will reject the file until it is fixed by hand."

Buttons (shadcn `Button`):

- "Export the project as it was": calls `downloadTextFile(name === undefined ? "critical-path-recovered.json" : projectFileName(name), serializeProject(project), "application/json")`
- "Go back to the project before the last change": rendered only when `previousProject !== undefined`, calls `onGoBack`

The Export button takes focus on mount. Use token classes only (`text-destructive`, `bg-card`, `text-muted-foreground`…), with no literal colours, per the planner lint rule.

#### 3. Error boundary

**File**: `src/components/planner/RenderErrorBoundary.tsx` (new)

**Intent**: Catch render throws below the island root and hand them to a fallback. It is a class component because React 19 has no hook for this.

**Contract**: `RenderErrorBoundary` takes props `children`, `fallback: (error: unknown) => ReactNode` and `onError: (error: unknown, componentStack: string) => void`, with state `{ error: unknown; failed: boolean }`. A `failed` flag is needed because a thrown value may be `undefined`. `getDerivedStateFromError` sets the error, `componentDidCatch(error, info)` calls `onError(error, info.componentStack ?? "")`, and it renders `fallback(error)` when failed. Reset is by remount (`key`), not by a reset method.

#### 4. Lift the state above the boundary

**File**: `src/components/planner/Planner.tsx`

**Intent**: The exported `Planner` keeps only the state and the boundary. Everything that derives from the project, and may throw, moves into `PlannerView` below the boundary.

**Contract**: `Planner(props)` calls `useProject(...)`, then renders `<RenderErrorBoundary key={replacements} onError={logRenderCrash} fallback={(error) => <RenderCrashFallback error={error} project={project} previousProject={previousProject} onGoBack={restorePreviousProject} />}><PlannerView state={…} /></RenderErrorBoundary>`. `PlannerView` (module-private, same file) holds the current body unchanged: `today`, the `forecast` memo, the focus request, the handlers and the `ReactFlowProvider` markup. It receives the hook's `ProjectState`.

`logRenderCrash(error, componentStack)` calls `console.error("Critical Path: the planner crashed while rendering.", error, { componentStack, project: <serialized> })`, behind a single `// eslint-disable-next-line no-console -- the only signal of a render crash; nothing may leave the device`. Serialization follows the try rule in Critical Implementation Details.

### Success Criteria:

#### Automated Verification:

- The red test fails on the current `Planner` (render throws, no alert) before the split: `npx vitest run src/components/planner/Planner.test.ts`
- The red test and the existing `Planner` tests pass after it: `npx vitest run src/components/planner/Planner.test.ts`
- Whole suite passes: `npm test`
- Lint passes with no new warnings, and the type check passes: `npm run lint && npx astro check`
- Build and CSP check pass: `npm run build && npm run check:csp`

#### Manual Verification:

- In `npm run preview`, the planner looks and behaves as before for a normal project (no visible change)

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Browser proof and docs

### Overview

Prove the fix in the production build under the CSP through the real A1 path, make the crash state visible in the kitchen sink, and document the test pattern.

### Changes Required:

#### 1. E2E: an import that crashes the first render is recoverable

**File**: `e2e/render-crash.spec.ts` (new)

**Intent**: The user-visible bug from audit A1. Today, importing a long chain blanks the page and loses the project that was open before. Header comment in the style of `e2e/project-file.spec.ts`: the risk (audit B1/A1, test-plan risk #3 "never throws or blanks") and a note that audit fix 2 (an import bound) will turn this file into a rejection and must rewrite this case.

**Contract**: Open the planner (same `openPlanner` check that the CSP is served) and add a Task "Keep me". Generate a file in the test: version `"0.1"`, name "Long chain", 2,500 Tasks where each Task's predecessor is the one before it, written with `JSON.stringify` (about 185 KB, under the 5 MB guard). Import it with `setInputFiles` using a buffer, then expect:

- the alert containing `RangeError`
- "Export the project as it was" to produce a download with `suggestedFilename()` "Long chain.json", whose parsed JSON has 2,500 Tasks
- a console error starting with "Critical Path: the planner crashed while rendering."
- "Go back to the project before the last change" to bring back the planner with the "Keep me" node visible and no alert

#### 2. Kitchen-sink crash state

**Files**: `src/dev/KitchenSinkPlanner.tsx`, `src/dev/kitchen-sink.astro`

**Intent**: Show the fallback in the visual gate, as PROJECT_RULES asks for every planner state.

**Contract**: A `"render-crash"` fixture that is a hand-built cyclic project. Its comment says it deliberately bypasses the edit functions, unlike every other fixture, because no valid project crashes in a small fixture. Add one kitchen-sink section rendering it.

#### 3. Test-plan cookbook note

**File**: `context/foundation/test-plan.md`

**Intent**: Record the pattern so the next render-time throw gets the same kind of test.

**Contract**: In §6.2, add a "Render crash" bullet covering:

- a hand-built project that the real domain throws on during render (no mock), passed as `initialProject`
- `console.error` spied and silenced
- download captured by stubbing `URL.createObjectURL` and the anchor `click`
- assertions on the alert, the exported text (`toBe(serializeProject(...))`) and that the planner is gone
- going back is proven at hook level and in `e2e/render-crash.spec.ts`

Do not insert line breaks in prose.

### Success Criteria:

#### Automated Verification:

- The e2e case fails on the Phase 1-only build and passes now: `npm run test:e2e -- e2e/render-crash.spec.ts`
- Whole e2e suite passes: `npm run test:e2e`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual Verification:

- `/kitchen-sink` under `npm run dev` shows the crash fallback state: readable, token colours, Export focused, no Go back button
- In `npm run preview`, importing the long-chain file shows the fallback. Export saves a file holding all 2,500 Tasks. Go back restores the earlier project, and DevTools shows one "Critical Path: the planner crashed while rendering." line with the component stack

**Implementation Note**: After automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- `useProject`: `previousProject` set by accepted edits and `replaceProject`, unchanged by every rejected-edit row, restored and cleared by `restorePreviousProject`, and a no-op restore when there is none.

### Integration Tests:

- jsdom `Planner` (red first): a cyclic `initialProject` covers the fallback, the error text, the exported bytes and name (named and unnamed), the Validation Error warning, no Go back, and the console line.
- Playwright on build + preview: the A1 import crash, the fallback, the download, the console line and Go back.

### Manual Testing Steps:

1. `npm run dev`, open `/kitchen-sink`, and check the crash state.
2. `npm run build && npm run preview`, add a Task, import a 2,500-Task chain file, and check the fallback, Export, the console line and Go back.
3. Use the planner normally (create, link, export, import a small file) and check that nothing changed.

## Performance Considerations

None for the normal path. The boundary adds one component layer, and `previousProject` is one more reference to an immutable project. Serializing the project for the log runs only after a crash.

## Migration Notes

None. There is no file-format or stored-state change.

## References

- Audit: `context/audits/observability/2026-10-13_project-file-edit-render-weekdays.md` (B1, A1, C1; §6 fix 1)
- Change identity: `context/changes/render-crash-recovery/change.md`
- Test patterns: `context/foundation/test-plan.md` §6.2, §6.3
- State hook: `src/hooks/useProject.ts:52-104`
- Island: `src/components/planner/Planner.tsx:37-168`
- Export pieces: `src/lib/services/project-file.ts:65`, `:91`; `src/lib/download.ts:7`
- E2E pattern: `e2e/project-file.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The hook remembers the previous project

#### Automated

- [x] 1.1 New hook tests fail before the hook change and pass after it — 23b4b45
- [x] 1.2 Whole suite passes — 23b4b45
- [x] 1.3 Lint and type check pass — 23b4b45

### Phase 2: Error boundary and crash fallback

#### Automated

- [x] 2.1 The red test fails on the current Planner before the split — 1192a9d
- [x] 2.2 The red test and the existing Planner tests pass after it — 1192a9d
- [x] 2.3 Whole suite passes — 1192a9d
- [x] 2.4 Lint passes with no new warnings, and the type check passes — 1192a9d
- [x] 2.5 Build and CSP check pass — 1192a9d

#### Manual

- [x] 2.6 In npm run preview, the planner looks and behaves as before for a normal project — 1192a9d

### Phase 3: Browser proof and docs

#### Automated

- [x] 3.1 The e2e case fails on the Phase 1-only build and passes now
- [x] 3.2 Whole e2e suite passes
- [x] 3.3 Full gate passes

#### Manual

- [x] 3.4 Kitchen sink shows the crash fallback state
- [x] 3.5 In npm run preview, the long-chain import shows the fallback, and Export, Go back and the console line work
