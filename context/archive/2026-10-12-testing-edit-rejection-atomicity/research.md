---
date: 2026-10-12T22:57:55+0200
researcher: Claude (Opus 5.5) for RemekGdansk
git_commit: b0e240c531a3b4eddf44e5bb7ed5b88f9ced722a
branch: main
repository: RemekGdansk/critical-path
topic: "Ground test-plan rollout Phase 2 (risks #5 and #6): edit-rejection atomicity and the withheld forecast"
tags: [research, testing, useProject, Planner, ForecastSummary, TaskPanel, jsdom, testing-library]
status: complete
last_updated: 2026-10-12
last_updated_by: Claude (Opus 5.5) for RemekGdansk
---

# Research: Ground test-plan rollout Phase 2 (risks #5 and #6)

**Date**: 2026-10-12T22:57:55+0200
**Researcher**: Claude (Opus 5.5) for RemekGdansk
**Git Commit**: b0e240c (working tree: `context/foundation/test-plan.md` modified, Phase 2 row only; this change folder untracked)
**Branch**: main
**Repository**: RemekGdansk/critical-path

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md` (§3 row 2, risks #5 and #6 of §2). For each risk: find the real failure path in code, quote the relevant lines, verify or correct the Risk Response Guidance (§2, rows #5 and #6), locate existing tests, name the cheapest useful test layer, and flag speculative risks or misleading hot-spot evidence. Choose the DOM environment and hook renderer for the new integration layer (Vitest 5.0.x, Node environment, Europe/Warsaw, "today" passed in).

## Summary

- **Risk #5 lives in the hook's commit step, not the domain.** `useProject.apply` (`src/hooks/useProject.ts:54-61`) is the only place an `EditResult` becomes React state: it writes `latest.current` and calls `setProject` only when `result.ok`. Nothing tests it: no test file imports `@/hooks/useProject` (grep over `src/`, `e2e/`; the only importers are the planner components and `src/dev/KitchenSinkPlanner.tsx`). The domain half of "state is untouched" is already proven: `project.test.ts:24-45` runs every edit on a deep-frozen input and checks it deep-equal afterwards. So the challenge "the domain returned an error, so state is untouched" is right to make, but the gap it points at is narrow: whether the hook commits, sets the `latest` ref, or touches `selection`/`replacements` on a rejection, and whether a later edit in the same event applies to the pre-rejection project.
- **Correction to the #5 edit-kind list.** Two of the six kinds the guidance names cannot be produced by any edit. "START predecessor" and "depending on FINISH" are unrepresentable in the model (`src/types.ts:1-3`, `src/lib/services/project.ts:22-25`) and only an imported file can spell them (`project-file.ts:203`, `:216`); the PRD says the same (`prd.md:157`: they "cannot arise in a project inside the app; they remain Validation Error checks applied to imported files"). They are already covered by the import rejection table (`project-file.test.ts`, §6.3) and `e2e/project-file.spec.ts:161-199`. The guidance also misses two edit-reachable kinds: the project-name rules (`setProjectName`, `project.ts:202-212`) and `unknown-task` (`project.ts:48-50`, reachable through the hook API but not through the UI). The edit-reachable set is in the table under "Rejected edit kinds".
- **Risk #6: withholding is decided once, in the domain, and the static render is already tested. The open gap is the `Planner` glue.** `forecast()` returns `{ kind: "withheld" }` whenever `validationWarnings` is non-empty (`forecast.ts:41-42`), and `ForecastSummary` renders dates only in its `kind === "forecast"` branch (`ForecastSummary.tsx:73-93`). Both are covered (`forecast.test.ts`; `ForecastSummary.test.ts:65-82` for withheld and restored markup). The forecast is memoised in `Planner`, not in the hook: `useMemo(() => forecast(project, today), [project, today])` (`Planner.tsx:56-57`). A "hook-level check" therefore cannot see a stale memo, because `useProject` never computes a forecast. The cheapest layer that can is a `Planner` render in a DOM environment.
- **Correction to the #6 wording.** The "remaining-work times" (critical-path time, total-work time; FR-011) do not exist: roadmap S-05 is `proposed` (`roadmap.md:49`), and `Forecast` carries only the two Project Finish Dates and the base date (`forecast.ts:13-22`). That half of the #6 guidance cannot be tested now. S-05 owns it.
- **Stale memo is unlikely today, but worth one test.** The memo is stale only if an accepted edit changes the content of `project` while keeping its identity. In the inspected edit functions (`project.ts:135-256`), every accepted change returns a new object. The deep-freeze tests forbid in-place mutation. The two same-reference accepts change nothing: adding a predecessor that is already present (`:178`) and removing one that is absent (`:194`). The only recorded stale case is a tab left open past midnight, and `e2e/forecast-today.spec.ts` covers it (Risk #4). A `Planner` test still earns its place: it is the only check against a future change to the memo's dependency list, and Phase 1 handed exactly that to Phase 2 (`testing-forecast-dates/plan-brief.md:26`).
- **Hot-spot evidence overstates current likelihood.** The 36 file-changes in `src/components/planner/` over 30 days come from UI, design-token, a11y and kitchen-sink commits (`git log -- src/components/planner/`). `src/hooks/useProject.ts` has 4 commits in total, each adding actions for a slice. `apply` and the `latest` ref have been unchanged since S-01 (`git log -S"latest.current"`: 381a02d, 7947701). The real likelihood driver is ahead: roadmap S-07's indirect rejections (test-plan §6.5 refresh note, `test-plan.md:168`). A compound action, such as Status then completion date as two `apply` calls, would be the first path where one part commits and the next part is rejected. No handler today calls two state actions in sequence (inspected: `NewTaskForm`, `TaskPanel`, `StartPanel`, `ProjectControls`, `Planner`).
- **Tooling choice:** **jsdom**, plus **`@testing-library/react`** with its required peer `@testing-library/dom`. Use a per-file `// @vitest-environment jsdom` comment and an explicit `afterEach(cleanup)`, because `globals` is off in `vitest.config.ts`. Apply React Flow's documented jsdom shim only in the `Planner` test file. None of these packages is installed.

## Detailed Findings

### Risk #5 — the commit path

The hook (`src/hooks/useProject.ts`):

```ts
// :1-3
// Project and selection state for the planner island. Every action applies one
// pure edit function and commits the result only when it is accepted, so a
// rejected edit leaves the project exactly as it was.

// :49-61
// The latest committed project, so two edits in one event (a rename committed
// on blur, then a click) never apply to a stale render's project.
const latest = useRef(project);
const [replacements, setReplacements] = useState(0);

const apply = useCallback((edit: (current: Project) => EditResult): EditResult => {
  const result = edit(latest.current);
  if (result.ok) {
    latest.current = result.project;
    setProject(result.project);
  }
  return result;
}, []);
```

- Each of the 8 edit actions (`:66-90`) goes through `apply`. `select` (`:63-65`) and `replaceProject` (`:94-99`) do not. `replaceProject` takes only a project that `parseProjectFile` accepted (`:23-27`). It is not an edit and has no rejection path in the hook.
- **Ways the hook could break atomicity.** No current code does any of these; they are the regressions a hook test should catch:
  1. Commit on both branches, for example `setProject(result.ok ? result.project : current)`, where `current` is a rebuilt copy. The project would stay deep-equal but lose its identity. That would rerun the forecast memo and the dagre layout memo (`Diagram.tsx:36`, keyed on `tasks`), so the `toBe` check matters.
  2. Advance `latest.current` before checking `ok`, which would poison the next edit in the same event.
  3. Clear or change `selection`, or bump `replacements`, on a rejection. `replacements` is the `key` that remounts `ProjectControls` (`Planner.tsx:116`) and the `fitKey` that refits the diagram (`Planner.tsx:129`), so a bump would visibly drop drafts and move the view.
  4. Return a different `EditResult` than the edit produced, which would lose the rule or message the views display.
- **Rejected edits in the same event.** The `latest` ref exists so that, for example, a rejected rename committed on blur followed by an "Add" click applies the second edit to the last committed project (`:49-50`). A hook test can call two actions inside one `act` and assert that the result equals the accepted edit applied to the original project alone.

### Risk #5 — rejected edit kinds (edit-reachable set)

| Kind (guidance wording)                          | Hook action → domain rule(s)                                                                                                    | Reachable from the UI?                                                                                                                                                                                                                                                                   | Domain test today                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| cycle                                            | `addPredecessor` → `cycle` (`project.ts:179-185`, message names the path)                                                       | yes: the picker offers cycle-closing candidates labelled "(would create a cycle)" (`TaskPanel.tsx:265-268`)                                                                                                                                                                              | `project.test.ts:211-245`                  |
| invalid name (Task)                              | `createTask`, `renameTask` → `task-name-empty`, `-too-long`, `-malformed`, `-control-character` (`project.ts:109-125, 135-153`) | empty and whitespace-only: yes. Too long: no, because `maxLength={200}` (`NewTaskForm.tsx:49`, `TaskPanel.tsx:169`). Malformed or control characters: unlikely by typing                                                                                                                 | `project.test.ts:88-177`                   |
| invalid name (project) — _missing from guidance_ | `setProjectName` → `project-name-*` (`project.ts:202-212`)                                                                      | yes, via the name field and Export (`ProjectControls.tsx:39-52, 67-74`)                                                                                                                                                                                                                  | `project.test.ts:362-409`                  |
| invalid Duration                                 | `setDuration` → `duration-not-positive-whole-number` (`project.ts:229-244`)                                                     | yes: a free-text input (`TaskPanel.tsx:184-198`)                                                                                                                                                                                                                                         | `project.test.ts:289-322`                  |
| invalid START date                               | `setStartDate` → `start-date-not-a-date` (`project.ts:247-256`)                                                                 | narrowly: a native `type="date"` input (`StartPanel.tsx:84`) sanitises malformed strings to `""`, which is accepted as "clear". A browser date string with a 5-digit year (e.g. `10000-01-01`) passes sanitisation and is rejected (inferred from the HTML date-string grammar, not run) | `project.test.ts:338-360`                  |
| unknown id — _missing from guidance_             | every Task-addressed action → `unknown-task` (`project.ts:48-50`)                                                               | no through the inspected UI: the panels act only on the mounted, existing Task                                                                                                                                                                                                           | `project.test.ts:174, 206, 259, 284, 319`  |
| START predecessor                                | none: not representable (`types.ts:1-3`, `project.ts:22-25`)                                                                    | no, import only (`project-file.ts:203`)                                                                                                                                                                                                                                                  | import table `project-file.test.ts` (§6.3) |
| depending on FINISH                              | none: not representable                                                                                                         | no, import only (`project-file.ts:216`)                                                                                                                                                                                                                                                  | import table `project-file.test.ts` (§6.3) |

Recommendation for the hook test: one row per edit-reachable rule group in the first six rows, called through the hook API, which reaches the rules the UI cannot (too-long, unknown id). Drop the last two rows from the Phase 2 scope, because they belong to the import contract that Phase 3 delivered. Each row asserts:

- the returned `EditResult` has `ok: false`, the exact `rule`, and a message containing the rule-specific fragment and none of "invalid", "conflict" or "blocked". This mirrors `expectRejected` in `project.test.ts:52-56`.
- `result.current.project` is `toBe` the reference from before the edit, and `toStrictEqual` a `structuredClone` taken before.
- `selection`, `selectedTask` and `replacements` are unchanged.
- the next accepted edit, in the same `act` or the next one, applies to the pre-rejection project.

Pass the initial project deep-frozen into `useProject(...)`, so an in-place write anywhere in the hook throws (strict mode). Build it through the real edit functions, as `ForecastSummary.test.ts:17-43` does. Use no mocks.

### Risk #5 — "shown as changed" (the view half)

- All four panels keep the rejected text as a draft and show the rule message in a `role="alert"` paragraph, with `aria-invalid` set on the field:
  - `NewTaskForm.tsx:25-33`, `:55-59`.
  - `TaskPanel.tsx:89-97`, `:118-126`, `:146-148`.
  - `StartPanel.tsx:51-58`.
  - `ProjectControls.tsx:44-50`.
- A refused predecessor stays picked (`TaskPanel.tsx:71-73`). Keeping the draft is a recorded design decision (`capture-task-graph/plan.md:53`: "On rejection, the draft stays and the message naming the rule is shown under the field"). It is not a defect. A test must not assert that the field reverts.
- What must **not** show the rejected value is every committed view. Each of these renders from `project` alone, never from a draft:
  - the diagram nodes (`Diagram.tsx:34-52`; `TaskNode.tsx:32-41` shows the name, the Duration or "No Duration").
  - the predecessor list (`TaskPanel.tsx:210-242`).
  - the forecast (`Planner.tsx:122`).
  - the START note (`StartPanel.tsx:44-49`).

  So the view half follows from the hook half plus the static structure: a view could only show a rejected value if it read a draft, and none does. One `Planner`-level case adds real signal: a rejected Duration, where the alert names the rule, the node still reads its old Duration, and the forecast still shows the old dates. It can share the harness with risk #6. A full per-kind matrix at `Planner` level would repeat the hook table at higher cost.

### Risk #6 — where withholding is decided

```ts
// src/lib/services/forecast.ts:40-42
export function forecast(project: Project, today: string): Forecast {
  const warnings = validationWarnings(project);
  if (warnings.length > 0) return { kind: "withheld", warnings };

// src/lib/services/validation-warnings.ts:17-20
export function validationWarnings(project: Pick<Project, "tasks">): ValidationWarning[] {
  return project.tasks
    .filter((task) => task.status !== "done" && task.duration === undefined)

// src/components/planner/Planner.tsx:55-57
  // Read on every render, so any edit after midnight picks up the new day.
  const today = todayIsoDate(new Date());
  const projectForecast = useMemo(() => forecast(project, today), [project, today]);
```

- `ForecastSummary` (`ForecastSummary.tsx:68-107`) holds no state. Its branch order is: no Tasks, then `withheld` (warning plus "Forecast not possible…"), then dates. It cannot show a stale date unless it receives a stale `forecast` prop.
- **Existing coverage.**
  - Domain: `forecast.test.ts` (the PRD table).
  - Static render from a real domain result: `ForecastSummary.test.ts:65-74` checks that no "Project Finish Date" text appears and no ISO date appears anywhere in the markup, attributes included. `:76-82` checks that both dates reappear with the US-02 values.
  - Diagram highlight: `diagram-layout.test.ts` (`durationMissing`).
  - Neither file renders `Planner`, so the `useMemo` and the prop wiring at `Planner.tsx:57, 122` are unexercised. No e2e spec clears a Duration and checks that the dates disappear and come back. The `no Duration` hits in `e2e/` (`seed.spec.ts:24`, `project-file.spec.ts:35, 39, 194`, `forecast-today.spec.ts:32`) only locate a freshly created Task.
- **Ways it could break**, and whether a `Planner` test would catch them:
  1. Memo dependencies narrowed, e.g. `[project.start.date, today]` or `[today]`. Clearing a Duration would keep the old dates. A `Planner` test catches it; the hook test and the static test cannot.
  2. A forecast cached in state or a ref, updated only on some edits. Same as 1.
  3. `ForecastSummary` branch order changed. Already caught by `ForecastSummary.test.ts`.
  4. Diagram highlight not following the Duration. `TaskNode` is `memo`ised (`TaskNode.tsx:48`), and `layoutDiagram` is memoised on `tasks` (`Diagram.tsx:36`). Both receive new objects on every accepted Duration change (`project.ts:127-129` rebuilds `tasks`). The FR-009 highlight is part of the same rule ("affected Tasks highlighted"), so asserting the node's accessible name ("…, no Duration") in the same `Planner` test is cheap.
- **Clock.** `Planner` reads the clock (`Planner.tsx:56`), and there is no prop to inject "today". To keep §6.1's rule (no fake timers, no clock in the expected values) without changing production code, use a START date far in the future. The base date is then the START date whatever today is (`forecast.ts:45-50`), and the expected dates can be derived by hand from the PRD convention. `e2e/project-file.spec.ts` uses 2030 dates the same way. A larger year avoids a time bomb.
- **Stale-detecting sequence.** Restoring the cleared Duration with a different value than before forces new expected dates, so a memo that replays the earlier forecast fails. The sequence: all Durations set → dates X; clear one → withheld, no ISO date in the `role="status"` region, node reads "no Duration"; set it to a different value → dates Y ≠ X.

### Test layer and tooling

- **Installed (verified with `npm ls`):** vitest 5.0.3, react and react-dom **19.3.0** (`package.json` declares `^19.2.6`), `@xyflow/react` 12.12.0, `@radix-ui/react-tooltip` 1.3.0.
- **Not installed:** `jsdom`, `happy-dom` and every `@testing-library/*` package.
- **npm latest (worker check, `npm view`):** jsdom 30.1.2 (engines include `^24.15.0`; `.nvmrc` is 24.21.0), happy-dom 21.0.1, `@testing-library/react` 16.3.3 (peers: react and react-dom `^18 || ^19`, and a required `@testing-library/dom ^10`), `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.7.
- **Vitest 5 (Context7 `/vitest-dev/vitest/v5.0.3`).**
  - The per-file `// @vitest-environment jsdom` comment overrides the global `node` environment.
  - The environment package must be installed separately.
  - `environmentMatchGlobs` is gone; `test.projects` replaces it. How `projects` composes with Astro's `getViteConfig` was not verified, and the per-file comment avoids the question.
  - Nothing changes in `include` (`src/**/*.test.ts`), so the files stay `.test.ts` with `createElement`, as `PROJECT_RULES.md` requires.
- **Testing Library (Context7 `/testing-library/testing-library-docs`).**
  - `render` and `renderHook` wrap work in `act` and set `IS_REACT_ACT_ENVIRONMENT`.
  - Auto-cleanup needs a global `afterEach`. `vitest.config.ts` sets no `globals`, so each DOM test file must call `afterEach(() => { cleanup(); })`, or the config adds a `setupFiles` entry.
  - A setup file would load for every test file, including the Node-only ones, so a per-file call is the narrower choice.
- **React Flow in jsdom (Context7 `/websites/reactflow_dev`, "testing").**
  - The documented shim covers four things: a `ResizeObserver` that fires once, a `DOMMatrixReadOnly` with `m22` (used at `@xyflow/react/dist/esm/index.js:1874`), `offsetWidth`/`offsetHeight` read from `style`, and `SVGElement.prototype.getBBox`.
  - Edges appear only after nodes are measured, so wait with `findBy*`.
  - `Diagram` already sets `nodesDraggable={false}` (`Diagram.tsx:103`).
  - Selecting a Task does not require a diagram click: `Planner` accepts `initialSelection` (`Planner.tsx:32-33, 53`).
  - The Radix tooltip in `WithheldWarning` uses `ResizeObserver` only when its content opens, and these tests do not need to open it.
- **jsdom versus happy-dom.** jsdom is the environment the React Flow shim and the Testing Library docs are written against, and it is stricter. happy-dom is faster, but its event and focus fidelity is lower, and it would still need the React Flow shim. Recommendation: jsdom.
- **Hook renderer.** Use `renderHook` from `@testing-library/react`. `react-test-renderer` is deprecated for React 19. A hand-rolled probe component with `createRoot` and `act` from `react` would work without Testing Library (`IS_REACT_ACT_ENVIRONMENT` must then be set by hand), but the `Planner` test needs `render`, `screen` and the `findBy*` queries anyway. `@testing-library/user-event` is optional: `fireEvent.change` plus `fireEvent.submit` or `fireEvent.blur` drive the draft fields.
- **Agent-hook side effect.** A test file that statically imports `@/hooks/useProject` makes `vitest related` select it on edits to `useProject.ts`. A file that imports `@/components/planner/Planner` also selects it on edits to `Planner.tsx`, `TaskPanel.tsx`, `Diagram.tsx` and the rest of its static import graph. This closes the gap noted in test-plan §6.5 (Phase 5, "Stated limit") with no hook change (`archive/2026-10-12-test-plan-refresh-2026-10-12/research.md:83`).

### Recommended layering (cheapest that gives signal)

| Risk half                                                | Layer                                                                                             | Why not cheaper                                                                                         | Why not dearer                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| #5 state: no commit, ref, selection or counter change    | `renderHook(useProject)` in jsdom, table-driven over the edit-reachable rules, real domain        | the domain tests already pass; the gap is `apply` itself, and React state needs a client renderer (DOM) | the `Planner` view adds nothing per rule (views read `project` only) |
| #5 view: rejected value never shown as committed         | one `Planner` render case (rejected Duration), shared harness with #6                             | the static render has no state, so it cannot show "after a rejection"                                   | e2e would duplicate it at CI-only cost, outside `npm test`           |
| #6 withheld then restored, no stale memo, node highlight | `Planner` render in jsdom with the React Flow shim, far-future START, restore with a new Duration | `useProject` does not compute the forecast; `ForecastSummary.test.ts` gets the forecast passed in       | e2e runs only in GitHub Actions and is invisible to `vitest related` |

Deliberate breaks to verify the tests, one at a time and reverted:

- (#5) commit unconditionally in `apply`.
- (#5) set `latest.current` before the `ok` check.
- (#5) `setSelection(null)` on a rejection.
- (#6) change the `useMemo` dependencies at `Planner.tsx:57` to `[today]`.
- (#6) swap the `withheld` and dates branches in `ForecastSummary`. The existing static test should also go red on this one.

## Code References

- `src/hooks/useProject.ts:49-61`: the `latest` ref and `apply`, which commits only on `ok`.
- `src/hooks/useProject.ts:94-99`: `replaceProject`, the only path that changes `replacements` and clears `selection`.
- `src/lib/services/project.ts:11-27`: the `ValidationErrorRule` set, including the two rules only import can produce (`:22-25`).
- `src/lib/services/project.ts:135-256`: the edit functions. Every accepted change builds a new object.
- `src/lib/services/project.test.ts:24-56`: `deepFreeze`, the `edit` wrapper (no mutation) and `expectRejected` (rule plus wording).
- `src/components/planner/Planner.tsx:55-57`: the clock read and the forecast `useMemo`.
- `src/components/planner/Planner.tsx:114-123`: `ProjectControls key={replacements}` and the `ForecastSummary` props.
- `src/components/planner/TaskPanel.tsx:84-154`: the draft, commit and error handling for rename, Duration and predecessors.
- `src/components/planner/StartPanel.tsx:51-58, 84-99`: START date draft and commit, on a native date input.
- `src/components/planner/NewTaskForm.tsx:25-33`: a rejected name stays in the field.
- `src/components/planner/ProjectControls.tsx:39-85`: name commit and Export, both through `setProjectName`.
- `src/components/planner/ForecastSummary.tsx:68-107`: the stateless branch, withheld or dates.
- `src/components/planner/ForecastSummary.test.ts:65-82`: the existing static withheld and restored checks.
- `src/lib/services/forecast.ts:40-42`: the single withhold decision.
- `src/components/planner/Diagram.tsx:36, 103`: the layout memo on `tasks`, and `nodesDraggable={false}`.
- `vitest.config.ts:5-14`: `include`, no `globals`, no `environment`, `TZ` pinned.

## Architecture Insights

- **Validate, then commit.** Validation lives in pure functions, and React state changes in exactly one place (`apply`). This is why a small hook test closes most of risk #5: there is one commit point to test, not one per view.
- **Drafts are view-local by design.** Views keep the rejected text and show the rule, and the committed views render from `project` only. A `Planner`-level assertion should therefore check the committed views (node label, forecast, predecessor list), not the field value.
- **Memoisation is keyed on object identity.** The forecast memo is keyed on `project`, and the layout memo on `tasks`. Correctness depends on the domain never mutating, which the deep-freeze tests guard, and on accepted edits returning new objects. The second condition holds on the inspected path (`project.ts:135-256`) and has no dedicated assertion beyond the deep-freeze plus `toEqual` checks.

## Historical Context (from prior changes)

Each item below gives a verdict on the historical claim.

- `context/archive/2026-09-27-capture-task-graph/plan.md:276`: "commits the new project only on `ok: true`, returning the `EditResult`". **Supported** by `useProject.ts:54-61`. It was verified manually only; no hook test was planned (component and jsdom tests were declared out of scope, `plan.md:43`).
- `context/archive/2026-10-04-reject-invalid-dependencies/plan.md:31`: "a rejection already leaves the project unchanged". **Supported** for `project` on the inspected path. Selection and `replacements` were not discussed (agent sweep, no hit). The cited line range `useProject.ts:40-47` has since drifted to `:54-61`.
- `context/archive/2026-10-10-testing-forecast-dates/research.md:70`: "a stale forecast … would need `project` identity to stay unchanged across a real change — no inspected edit path does that". **Supported** today. Its anchors have drifted (`Planner.tsx:53` is now `:57`; `useProject.ts:45-52` is now `:54-61`).
- `context/archive/2026-10-10-testing-forecast-dates/plan-brief.md:26`: "Stale/memoized forecast | Left to test-plan Phase 2 | Needs the DOM harness Phase 2 introduces." **Supported.** It is the reason for the `Planner`-level #6 test.
- `context/archive/2026-10-12-test-plan-refresh-2026-10-12/research.md:99`: no e2e spec drives a rejected edit. **Supported.** The only rejection in `e2e/` is the cycle file import (`project-file.spec.ts:161-199`).
- `context/foundation/test-plan.md:44`, #6 "Likely cheapest layer: unit + one hook-level check". **Partially contradicted.** The unit half exists. The hook level cannot see the forecast, so the check belongs at `Planner` level.
- `context/foundation/test-plan.md:43`, #5 "integration at hook level (DOM environment)". **Supported.** The edit-kind list is corrected in the table above.

## Related Research

- `context/archive/2026-10-10-testing-forecast-dates/research.md`: Phase 1, the forecast oracle and the static `ForecastSummary` render.
- `context/archive/2026-10-12-test-plan-refresh-2026-10-12/research.md`: the test-base inventory, and why no test imports the hook.
- `context/archive/2026-10-11-project-file-round-trip/`: the import-side Validation Errors, including START and FINISH.

## Open Questions

1. **React Flow under jsdom with the documented shim, inside `Planner`'s unsized flex container.** This has not been run. The plan's first step should be a spike: render `Planner` with a fixture and read the `role="status"` text and one node's accessible name. If `ReactFlow` renders no nodes there, either give the test container an explicit size or limit the `Planner` assertions to the header and panel, leaving out node names.
2. **jsdom's `type="date"` value sanitisation for 5-digit years.** This matters only if the plan drives the START date through the field. The hook test calls `setStartDate` directly and does not depend on it.
3. **Lint on DOM test files.** Type-checked ESLint rules (for example floating promises around `await act(...)` or `findBy*`) apply to `.test.ts` files. This was not inspected; the plan should run `npm run lint` on the first file.
4. **The year for the far-future START date in the `Planner` test.** This is a plan choice. Any date beyond the project's lifetime works, and the expected dates must be derived by hand.
5. **Future scope (not Phase 2).** S-07's compound or indirect rejections should reuse this hook harness. If S-07 implements a user action as more than one `apply` call, atomicity across those calls becomes a new failure path that the current single-edit `apply` does not cover.
