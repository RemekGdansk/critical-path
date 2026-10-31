# Critical Path Highlight — Plan Brief

> Full plan: `context/changes/critical-path-highlight/plan.md`

## What & Why

Roadmap slice S-05 (FR-010, FR-011). The planner should see which chain(s) of remaining work bound the Resource-Unconstrained Project Finish Date, highlighted on the diagram. Next to the two Project Finish Dates, they should see the critical-path time and the total-work time of the remaining work. The critical path is what the product is named after, and today it is computed and thrown away.

## Starting Point

`forecast()` already walks the remaining work and computes both lengths, but keeps neither, and keeps no per-Task start or finish, so it cannot say which Tasks are critical. The domain Diagram already derives per-node state (the Validation Warning flag and accessible name), and its design reserved a `critical` flag. `--warning` set the pattern for adding a highlight role.

## Desired End State

With every not-Done Task estimated:

- Every Task on any longest chain of remaining work has a border in a new `--critical-path` colour and is announced ", on the critical path".
- Every edge on such a chain, from START to FINISH, is drawn thicker in that colour, with a matching arrowhead.
- One header line reads "Critical-path time 8 days · Total-work time 11 days", with a colour swatch that explains the highlight.

While a Validation Warning exists, the highlight and the line disappear along with both Project Finish Dates.

## Key Decisions Made

| Decision                 | Choice                                                                                                                                                                                                                                                                      | Why (1 sentence)                                                                                                  | Source          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------- |
| Ties                     | Every equal-length critical path is highlighted                                                                                                                                                                                                                             | The roadmap's S-05 Risk line requires it.                                                                         | Roadmap         |
| Done Tasks               | Never critical, never counted in the times                                                                                                                                                                                                                                  | FR-010 and FR-011 count remaining work only.                                                                      | PRD             |
| While warned             | No highlight and no times                                                                                                                                                                                                                                                   | No longest chain exists without Durations, and the PRD highlights the warned Tasks "instead".                     | PRD             |
| One calculation          | New `remainingWork()`, and `forecast()` is rebuilt on it                                                                                                                                                                                                                    | RK-02: a second longest-path calculation could disagree with the forecast.                                        | Domain docs     |
| Which edges              | Only edges on a longest chain, including the START and FINISH edges; not every edge between two critical Tasks                                                                                                                                                              | The chain reads unbroken, and no dependency is claimed critical when delaying it changes nothing.                 | Plan            |
| Colour                   | New `--critical-path` token, hue away from amber and red                                                                                                                                                                                                                    | Red means Validation Error here, and `--primary` is the selection colour.                                         | Plan            |
| Node cue                 | Border + ring in the critical colour, thicker critical edges, and ", on the critical path" at the end of the accessible name                                                                                                                                                | Colour is never the only cue (WCAG 1.4.1), the node box keeps its size, and tests can assert the name.            | Plan            |
| Times placement          | One line under the dates, with a swatch acting as the legend                                                                                                                                                                                                                | Adds a single line and uses the PRD's terms verbatim.                                                             | Plan            |
| Where criticality lives  | Computed in `projectDiagram`, inside the existing layout memo                                                                                                                                                                                                               | It depends only on the Tasks, not on the START date or today, so date edits still skip layout.                    | Plan (research) |
| Arrowhead colour         | `markerEnd.color: "var(--critical-path)"`, a documented exception                                                                                                                                                                                                           | React Flow arrowheads are shared SVG markers that CSS on the edge cannot reach, and the value is still the token. | Plan (research) |
| Huge sums                | A time above the safe-integer limit reads "Too large to count" and nothing is highlighted                                                                                                                                                                                   | Mirrors "Beyond year 9999": never show an imprecise value.                                                        | Plan            |
| Parallel-work boundaries | S-05 stays in the forecast service, the diagram and `ForecastSummary`. No edits to `Planner.tsx`, `useProject.ts` or S-08's files (`ProjectControls`, `RenderCrashFallback`, the "exported" marker). Shared test, kitchen-sink and test-plan files get additive edits only. | S-08 runs in parallel, and the two changes must merge without conflicts.                                          | User            |
| File format              | Unchanged: `serializeProject`, the golden files and the version are not touched                                                                                                                                                                                             | The times and the highlight are derived, never saved, so the format has no reason to change.                      | User            |

## Scope

**In scope:**

- `remaining-work.ts`, and `forecast()` rebuilt on it with the two times;
- the critical flags and accessible names in the domain Diagram;
- the `--critical-path` token and `tokens.md`;
- the React Flow edge class, arrowhead and Task border;
- a kitchen-sink cell;
- the times line in `ForecastSummary`;
- tests at the domain, adapter, static-render and `Planner` layers;
- updates to test-plan Risk #6 and the glossary.

**Out of scope:**

- per-Task slack;
- an "on the critical path" line in the Task panel;
- near-critical highlighting;
- all-Done copy (S-07);
- any change to the file format (`serializeProject`, golden files, version);
- edits to `Planner.tsx`, `useProject.ts`, `ProjectControls.tsx`, `RenderCrashFallback.tsx` or the state's "exported" marker (S-08 runs in parallel);
- Playwright;
- a dark-mode toggle.

## Architecture / Approach

`remainingWork(project)` runs a forward pass and a backward pass over the remaining work, in topological order. It returns:

- the critical-path time and the total-work time;
- the zero-slack Tasks;
- the dependency links where the predecessor finishes on the day the successor starts.

`forecast()` adds the base date to the two times to get both Project Finish Dates. `projectDiagram()` turns the sets into `critical` flags on nodes and edges. `flow-elements.ts` maps those flags to a `critical-path` class, which `global.css` themes through `--xy-edge-stroke`, and to a coloured marker. `ForecastSummary` formats the times with `formatDuration`.

## Phases at a Glance

| Phase                                 | What it delivers                                                              | Key risk                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1. Remaining-work schedule            | One longest-path calculation, and the forecast returns both times             | A wrong critical-link rule (the A→C case), and oracle rows derived with production code |
| 2. Critical path on the diagram       | Highlighted Tasks and edges, accessible names, the token, a kitchen-sink cell | Arrowhead colour and size, and keeping critical distinct from selection and warning     |
| 3. Remaining-work times in the header | The times line with a legend swatch, the Risk #6 `Planner` row, doc updates   | Header height at 1024 wide                                                              |

**Prerequisites:** S-04 (done). Nothing else.
**Estimated effort:** about 2–3 sessions across 3 phases.

## Open Risks & Assumptions

- The arrowhead marker id contains `var(--critical-path)`. React Flow builds the id from the marker object and references it with a quoted `url('#…')`, which should resolve. Verify in the kitchen sink.
- Done Tasks cannot be set through an edit until S-07. Done behaviour is proven with hand-built projects only, and S-07 decides the all-Done copy.

## Success Criteria (Summary)

- With every Task estimated, the user sees every critical chain highlighted from START to FINISH, and only those.
- The two times, which match the two Project Finish Dates, appear in the header.
- While any Task lacks a Duration, no highlight, time or Project Finish Date is shown. Once it is fixed, all three return with fresh values.
