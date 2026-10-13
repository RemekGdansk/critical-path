# Render Crash Recovery — Plan Brief

> Full plan: `context/changes/render-crash-recovery/plan.md`
> Audit (research input): `context/audits/observability/2026-10-13_project-file-edit-render-weekdays.md`

## What & Why

Today, any throw during render unmounts the planner island. The page goes white, the console gets one minified line, and the unexported project, which is its only copy, is lost (audit B1). This can already happen through Import: an 1,800+ Task chain passes validation, then crashes dagre on the first render, after the project open before the import was already replaced (A1). This change lifts the project state above an error boundary, so a crash becomes a visible, recoverable screen.

## Starting Point

`Planner` is the single island. It owns `useProject` and also runs `forecast()` in its own render, and its children run more throwing domain code (`layoutDiagram`, `forecastBaseDate`, `predecessorCandidates`). There is no error boundary, Astro mounts with a bare `createRoot`, `useProject` keeps no earlier project, and `src/` has no `console.*` calls.

## Desired End State

A render throw shows a fallback naming the error (`<name>: <message>`) with two actions. "Export the project as it was" downloads the committed project. "Go back to the project before the last change" restores what the last edit or import replaced. The console gets one line with the error, the component stack and the serialized project. Importing the A1 chain no longer costs the user anything: they can export it, or go back to the project they had.

## Key Decisions Made

| Decision                                       | Choice                                                                                           | Why (1 sentence)                                                                                  | Source           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------- |
| Where the state lives                          | Island root holds `useProject` and the boundary; `PlannerView` below it                          | A boundary can't catch its own component's throw, and one outside the state has nothing to export | Research (audit) |
| Recovery actions                               | Export, plus "go back one step" (only when a previous project exists)                            | Recovers the project that a crashing import replaced, without a reload                            | Plan             |
| Export of a project holding a Validation Error | Export anyway, and warn, quoting the Validation Error and saying Import will reject it           | No data loss, and no silent break of the "never in an exported file" guardrail                    | Plan             |
| File name when unnamed                         | `critical-path-recovered.json`; named projects use `projectFileName(name)`                       | One click, no input on a screen shown after a failure                                             | Plan             |
| Tests                                          | jsdom red test (cyclic `initialProject`) + Playwright A1 on build + preview                      | Fast deterministic oracle, plus proof in React's production build under the CSP                   | Plan             |
| Scope                                          | B1 only (contains A1 and C1)                                                                     | One reviewable change; B2, A3, P1 and the import bound get their own red tests                    | Plan             |
| Boundary implementation                        | Small local class component, reset by `key={replacements}`                                       | React 19 has no hook boundary; no new dependency; `replacements` already keys draft resets        | Plan             |
| Console line                                   | One `console.error` from `componentDidCatch`, with error, component stack and serialized project | The only on-device reproduction; logged once per crash, never throws                              | Research (audit) |

## Scope

**In scope:**

- `useProject`: `previousProject` and `restorePreviousProject()`
- the `Planner` split into root and `PlannerView`
- `RenderErrorBoundary` and `RenderCrashFallback`
- the console line
- jsdom, hook and e2e tests
- a kitchen-sink crash state
- a test-plan §6.2 note

**Out of scope:**

- B2 (cycle message naming Tasks)
- A3, A4 and A5 (import and export handler errors and confirmation)
- P1 (hydration failure)
- the import bound on Task count and depth (audit fix 2)
- a general undo
- "Try again"
- a custom Astro mount with `onUncaughtError`
- `react-error-boundary`

## Architecture / Approach

`Planner` (the exported island) calls `useProject` and renders `RenderErrorBoundary key={replacements}`. Inside it, `PlannerView` runs everything that may throw: the forecast, the diagram and the panels. On a throw, the boundary logs through `onError` and renders `RenderCrashFallback` with the root's committed project and previous project. "Go back" calls `restorePreviousProject`, which bumps `replacements`, so the boundary remounts clean.

## Phases at a Glance

| Phase                                      | What it delivers                                                                         | Key risk                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. The hook remembers the previous project | `previousProject` and `restorePreviousProject`, test-first                               | `previousProject` updated on a rejected edit, or out of step with `latest`                    |
| 2. Error boundary and crash fallback       | Lifted state, boundary, fallback (Export, warning, recovery name, Go back), console line | A throwing derivation left above the boundary, so it still blanks the page                    |
| 3. Browser proof and docs                  | Playwright A1 case, kitchen-sink crash state, test-plan note                             | The A1 trigger depends on Chromium's stack depth; it is rewritten when the import bound lands |

**Prerequisites:** none. The branch `render-crash-recovery` is already open.
**Estimated effort:** about 1–2 sessions across 3 phases.

## Open Risks & Assumptions

- A 2,500-Task chain is assumed to overflow Chromium's stack in dagre. The audit measured a failure at 1,800 in Node only. If Chromium survives it, the e2e fails visibly and the size must be raised.
- The fallback's Export can produce a file holding a Validation Error. This is a deliberate, stated exception limited to the crash screen.
- Only one step back is kept. A crash whose previous project also crashes (for example, one caused by the clock) leaves only Export.

## Success Criteria (Summary)

- A render throw never blanks the page. The user sees what failed and can export the project in one click.
- After a crashing import, "Go back" returns the project the user had before.
- The console holds enough to reproduce the crash (error, component stack, project), and nothing leaves the device.
