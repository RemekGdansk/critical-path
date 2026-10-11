---
date: 2026-10-11T17:46:50+0200
researcher: Claude (Opus 5.5) with RemekGdansk
git_commit: 0fdf0a7
branch: project-file-round-trip
repository: critical-path
topic: "S-03 project-file-round-trip — what export/import must build on, validate and avoid"
tags: [research, codebase, s-03, export, import, file-format, validation, csp, useProject, yaml, json]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Follow-up: YAML vs JSON file-format decision research (Context7, web, local experiments); supersedes the js-yaml 4.3.2 transitive/bundle note and the node_modules environment note"
---

# Research: S-03 project file round-trip

**Date**: 2026-10-11T17:46:50+0200
**Researcher**: Claude (Opus 5.5) with RemekGdansk
**Git Commit**: 0fdf0a7 (working tree clean at start)
**Branch**: project-file-round-trip
**Repository**: critical-path

## Research Question

Ground roadmap slice S-03 (`context/foundation/roadmap.md:120-130`; PRD US-03, FR-007, FR-013, FR-014). The user sets the project name, exports the project to a human-readable plain-text file named after it, and imports that file in another browser to get exactly the same project back. A file with a Validation Error is rejected with a clear error. A file with only Validation Warnings imports and shows them. Settle:

- what the model and edit code already provide;
- which checks import needs and which exist;
- what in the render path throws on a malformed project;
- how file save and file read behave under the no-egress CSP;
- where the UI controls and the "replace project" state change fit;
- which decisions earlier changes and the test plan already made or deferred to S-03.

## Summary

- **There is no whole-project validator yet.** The checks are spread across the per-edit functions. The pieces an importer can use:
  - exported: `findCycle` (`src/lib/services/task-graph.ts:84`), `isIsoDate` (`src/lib/services/calendar-date.ts:46`), `isPositiveWholeDays` (`src/lib/services/project.ts:153`), `taskLabel` (`project.ts:44`);
  - module-private: `checkTaskName` (`project.ts:66`) and `pathLabel` (`project.ts:49`).

  Follow-up F1 (`context/archive/2026-09-27-capture-task-graph/follow-ups/review-fixes.md:7-13`) asked for a shared `validateProject`. S-02 delivered only its cycle bullet (`findCycle`). Its name-rule and id-invariant bullets are explicitly deferred to S-03 (`context/archive/2026-10-04-reject-invalid-dependencies/plan.md:39-40`).

- **Import must validate shape and types before any rule.** The domain code trusts the `Project` type. Traced by hand, not executed:
  - A non-array `tasks` or `predecessors`, or a missing `start`, throws a TypeError during render (`validation-warnings.ts:18`, `forecast.ts:44`).
  - A JSON `null` Duration hides the missing-Duration warning, because the check is `=== undefined` (`validation-warnings.ts:19`), and is then forecast as 0 days.
  - A string id never matches numeric predecessors, so its edges silently vanish.
  - A string `nextTaskId` makes `createTask` compute `"3" + 1`, which is `"31"` (`project.ts:91`).
- **Two render-time throws blank the planner, and nothing catches them.**
  - `addDays` throws on a non-ISO base date (`calendar-date.ts:55-56`). It is reached when a malformed START date compares at or after today (`forecast.ts:44-50`).
  - `topologicalOrder` throws "The project contains a cycle." (`task-graph.ts:178`) on a cycle, a self-predecessor, or duplicate Task ids (a false positive).

  `forecast` runs in `useMemo` during render (`src/components/planner/Planner.tsx:53`). No error boundary exists: a grep for `ErrorBoundary`, `componentDidCatch` and `getDerivedStateFromError` in `src/` found none. The S-04 review chose "validate on import" over an error boundary (`context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:29-51`, Fix A). So import must fully validate inside the event handler and commit only a project that passes.

- **Invariants a file can break that the PRD list does not name.** All are deferred to S-03 by F1:
  - unique positive-integer Task ids;
  - predecessors with no duplicates, in ascending order;
  - `nextTaskId` greater than every Task id.

  Without these, `createTask` can mint a duplicate id, and `replaceTask` (`project.ts:78-80`) then rewrites every Task with that id. That is silent data loss (test-plan risk #2).

  Two more invariants are assumed by the code and unchecked:
  - Tasks are in creation order. Since ids are sequential and never reused, this is strictly ascending id order.
  - Names are already trimmed.

- **"START with a predecessor" and "a Task depending on FINISH" cannot be represented in the in-memory model.** `Start` is `{ date? }`, `Finish` is `Record<string, never>`, and predecessors are numeric Task ids (`src/types.ts:20,29-35`). Whether a file can express them depends on the file shape S-03 picks. S-02 deferred both rules to S-03 "where a hand-edited file can actually express them" (`reject-invalid-dependencies/plan.md:39`).
- **Format: undecided. JSON is the cheaper fit on the evidence.** _(Expanded in [Follow-up: YAML or JSON](#follow-up-2026-10-11-yaml-or-json-file-format): evidence favours JSON with a hand-written serializer.)_
  - No document settles YAML vs JSON (`context/foundation/shape-notes.md:285`; `roadmap.md:127`, owner: user, decide during planning).
  - No format library is a direct dependency. `yaml`, `js-yaml` and `zod` are in `node_modules` only as build or dev transitives (`npm ls`). _(Superseded in part: after the 17:58 reinstall, `js-yaml` is no longer in `node_modules`, and its current release is 5.4.3, not 4.3.2. See the follow-up.)_
  - Measured gzip cost on a `Planner` chunk of 108,493 B gzip:

    | Library                          | Added gzip | Increase |
    | -------------------------------- | ---------- | -------- |
    | `yaml@2.9.1` (parse + stringify) | +30,627 B  | ≈+28%    |
    | `js-yaml@4.3.2`                  | +14,361 B  | ≈+13%    |
    | `JSON.parse` / `JSON.stringify`  | 0 B        | 0%       |

  - zod 4 probes `new Function` unless `jitless`. Under the strict CSP that would log a violation and break the zero-console-error R4 gate (`context/deployment/deploy-plan.md:126`).
- **File I/O under the CSP.**
  - Reading via `<input type="file">` plus `File.text()` makes no fetch, so it needs no CSP allowance.
  - Saving via `URL.createObjectURL(blob)` plus `<a download>` at top level is treated as a navigation by Chromium and Firefox, so `connect-src 'none'` does not block it (whatwg/html#5548). The spec text, read literally, would map it to `connect-src`, which is a known open spec bug.
  - `npm run check:csp` rejects adding `blob:` to any directive (`scripts/csp/check-page.ts:30`). The design therefore has to rely on downloads not needing it.
  - Safari/WebKit behaviour is **unverified**. It needs an empirical check under `npm run preview`, where the CSP is in effect; it is not applied under dev (`astro.config.mjs` comment).
  - `showSaveFilePicker` and `showOpenFilePicker` are Chromium-only. The PRD targets Chrome, Edge, Firefox and Safari (`context/foundation/prd.md:183`).
- **State and UI.**
  - `useProject` has no "replace project" action.
  - A new action must commit through the `latest` ref (`src/hooks/useProject.ts:41-52`) and reset `selection`. Otherwise a stored TaskId resolves to an unrelated imported Task with the same id (`useProject.ts:79`), and `TaskPanel`, keyed only by Task id (`Planner.tsx:120`), keeps the old project's drafts.
  - The header (`Planner.tsx:93-96`) is the only toolbar, and the natural home for the name, Export and Import controls.

## Detailed Findings

### Model and edit functions (what the file must carry)

- **`Project`** (`src/types.ts:37-48`): `name?`, `start: { date? }`, `finish: {}`, `dayCountingMode: "calendar-days" | "weekdays"`, `nextTaskId`, `tasks`.
- **`Task`** (`types.ts:12-27`): `id`, `name`, `predecessors` (Task ids only, no duplicates, ascending), `duration?`, `status: "to-do" | "in-progress" | "done"`, `completionDate?`.
- **Fields US-03 requires to round-trip** (`prd.md:101`): Tasks, dependencies, Durations, Statuses, completion dates, START date, project name and day-counting setting. `nextTaskId` and Task ids are also needed for an exact round-trip and for id non-reuse (test-plan risk #2, `context/foundation/test-plan.md:28,40`).
- **Representation of "unset".** "Absent, not undefined": clearing a Duration or the START date removes the key (`setDuration` `project.ts:169-172`, `setStartDate` `project.ts:183-187`; decision at `context/archive/2026-10-04-forecast-finish-dates/plan.md:53`). Export and import must keep one representation of "unset".
- **Fields no edit sets yet.**
  - `status` stays `"to-do"` and `completionDate` is never set until S-07; `completionDate` is not read anywhere in `src/`.
  - `dayCountingMode` stays `"calendar-days"` until S-06. `forecast` ignores the mode ("Calendar days only", `forecast.ts:5`), so a `"weekdays"` file would silently get calendar-day dates. The roadmap says reject `"weekdays"` until S-06 (`roadmap.md:128`).
- **Project name.** `Project.name` exists (`types.ts:38`) and nothing reads it yet. The PRD gives no rules for it: its Validation Error list covers Task names only (`prd.md:194`).
- **Edit result style.**
  - `EditResult = { ok: true; project } | { ok: false; error: { rule, message } }` (`project.ts:20-25`).
  - `ValidationErrorRule` has 8 members (`project.ts:10-18`).
  - Messages are one sentence in domain terms, e.g. "A Duration must be a positive whole number of days." Tasks are named with `taskLabel`, e.g. "7: Name".
  - The existing cycle message is edit-phrased ("Adding … would create the cycle …", `project.ts:132-135`). An import message needs new wording.

### Import check inventory (PRD Validation Errors → code)

| Check                                                                                                         | Existing code                                                                                                                                                                                                                                            | Exported | Gap for import                                                                         |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| Cycle, incl. self-predecessor                                                                                 | `findCycle(project): TaskId[] \| undefined`, `task-graph.ts:84-117`. Closed path rotated to its lowest id; `[a, a]` for a self-loop; dangling ids ignored; iterative, fixed for 200k+ Tasks (`reject-invalid-dependencies/reviews/impl-review.md:40-42`) | yes      | Label the path with `pathLabel` (`project.ts:49`, private)                             |
| START with a predecessor / Task depending on FINISH                                                           | none; cannot be represented in the model (`types.ts:29-35`)                                                                                                                                                                                              | —        | Depends on the file shape (see Open Questions)                                         |
| Dependency on an unknown id                                                                                   | per edit only: `unknownTask` (`project.ts:35`), rule `unknown-task`. Elsewhere dangling ids are silently ignored (`task-graph.ts:159`, `forecast.ts:70`)                                                                                                 | —        | New whole-project check                                                                |
| Task name: empty or invisible-only, >200 UTF-16 units, not well-formed, control char                          | `checkTaskName(trimmed)`, `project.ts:66-76`; 4 rules                                                                                                                                                                                                    | **no**   | Export it (F1). It assumes a trimmed string, and a non-string throws at `isWellFormed` |
| Duration not a positive whole number                                                                          | `isPositiveWholeDays(n)`, `project.ts:153` (`Number.isSafeInteger && > 0`)                                                                                                                                                                               | yes      | Rule and message live inside `setDuration` (`project.ts:175-176`)                      |
| START date not a date                                                                                         | `isIsoDate`, `calendar-date.ts:46`; rule `start-date-not-a-date` in `setStartDate` (`project.ts:189-193`)                                                                                                                                                | yes      | Reuse                                                                                  |
| Done rules                                                                                                    | none (S-07)                                                                                                                                                                                                                                              | —        | See Open Questions                                                                     |
| Unique ids, ascending order, sorted and deduplicated predecessors, `nextTaskId` > max id, enums, trimmed name | none                                                                                                                                                                                                                                                     | —        | New (F1)                                                                               |

Notes on the last row:

- Duplicate ids make `topologicalOrder` throw a false "cycle" error. Example: `[{1,[]},{1,[2]},{2,[]}]`.
- Duplicate predecessors give duplicate React keys (`TaskPanel.tsx:219`) and duplicate edge ids (`diagram-layout.ts:57`).
- Unsorted predecessors break byte-identical re-export.
- One check, Task ids strictly ascending in file order, covers both uniqueness and creation order. This follows from sequential, never-reused ids (`context/archive/2026-09-27-capture-task-graph/plan-brief.md:24`).

### Render-path failure modes (why validation must precede commit)

- **Malformed START date.**
  - `forecast` picks the base date with `compareIsoDates(startDate, today)` (`forecast.ts:44-50`). `addDays` throws on an unparseable base date (`calendar-date.ts:55-56`).
  - A malformed date that sorts at or after today (e.g. `"2027-02-30"`) throws, and the planner goes blank.
  - One that sorts before today is silently replaced by today.
- **Cycle or duplicate ids.** `topologicalOrder` throws (`task-graph.ts:178`), reached from `forecast.ts:58`.
- **Defensive throws with no known trigger.**
  - `forecast.ts:67` ("Task N has no Duration.") is unreachable: `validationWarnings` withholds the forecast first on the same condition. A `null` Duration slips past both checks rather than throwing.
  - `diagram-layout.ts:144` (dagre did not position a node): no known trigger.
- **The island and error handling.** The island is mounted `client:only="react"` (`src/pages/index.astro:15`). A throw during render (`Planner.tsx:53`, `Diagram.tsx:34`) with no boundary unmounts it. A throw inside an event handler does not unmount it. This React 19 behaviour is stated from model knowledge, not re-checked against docs.
- **Warnings need no new code.** An imported project with only warnings displays them without any new code: `validationWarnings` (`validation-warnings.ts:17-25`) feeds `forecast` → `ForecastSummary` (`ForecastSummary.tsx:23-61`) and the diagram's `durationMissing` flag (`diagram-layout.ts:63,84-86`).

### Browser file I/O under the CSP

- **The CSP.** `astro.config.mjs` sets `default-src 'none'`, `connect-src 'none'` and `form-action 'none'`, among others. The checker requires `'none'` on `default-src`, `connect-src`, `worker-src` and `form-action` (`scripts/csp/check-page.ts:28`). It allows only `'self'`, `'none'`, `data:` and hashes as sources (`check-page.ts:30-31`).
- **Reading.** `<input type="file">` plus `File.text()` (Chrome 76+, Firefox 69+, Safari 14+, per MDN browser-compat-data) or `FileReader` makes no fetch. Do not read with `fetch(URL.createObjectURL(file))`: destination "" maps to `connect-src`, which blocks it.
- **Saving.**
  - The HTML spec's "download the hyperlink" issues a fetch with destination "". CSP3 maps that to `connect-src` (HTML "Downloading resources"; CSP3 §6.8.1). This is a known open spec inconsistency: [whatwg/html#5548](https://github.com/whatwg/html/issues/5548) records that Chromium treats downloads as navigations; see also [whatwg/html#7718](https://github.com/whatwg/html/issues/7718).
  - Firefox's only reported CSP interference is `frame-src` for downloads inside an iframe ([bug 1862553](https://bugzilla.mozilla.org/show_bug.cgi?id=1862553)). The app is never framed (`frame-ancestors 'none'`, `public/_headers`).
  - Revoke the object URL after a tick, not synchronously ([Firefox bug 1282407](https://bugzilla.mozilla.org/show_bug.cgi?id=1282407), fixed in Firefox 50).
  - **WebKit: no primary source found either way.** This is an empirical check for `npm run preview` across Chromium, Firefox and WebKit.
- **File System Access API.** `showSaveFilePicker` and `showOpenFilePicker` are Chrome and Edge 86+ only. Firefox and Safari have `version_added: false` (MDN browser-compat-data `api/Window.json`), so the API could be a progressive enhancement at most.
- **The built-HTML check.** `check:csp` sees only built HTML (`check-page.ts:133-172`). An anchor created at runtime is invisible to it.

### UI integration

- **Where the controls go.** The header (`Planner.tsx:93-96`) holds `NewTaskForm` and `ForecastSummary`, separated by `justify-between`. A third group for the name, Export and Import fits there. `ForecastSummary` is `role="status"` (`ForecastSummary.tsx:70`), so import errors should not go inside it.
- **How errors are shown today.** Every edit error renders as a `<p role="alert" className="text-destructive text-sm">` under its field, with `aria-invalid` and `aria-describedby`. Instances:
  - `NewTaskForm.tsx:52-58`
  - `StartPanel.tsx:101-102,119-123`
  - `TaskPanel.tsx:172-178`, `:196-202`, `:258-259`, `:281-285`

  Forms call `preventDefault` because `form-action 'none'` blocks native submission (`NewTaskForm.tsx:24`).

- **State to reset on import.**
  - `useProject` commits through `apply` (`useProject.ts:45-52`). `replaceProject` must also set `latest.current`.
  - The selection persists (`useProject.ts:38-40,79`).
  - `TaskPanel` is keyed by Task id (`Planner.tsx:120`), and its drafts sit in `useState` (`TaskPanel.tsx:49-54`).
  - `StartPanel` is not keyed, and its draft is initialised once (`StartPanel.tsx:36`).
  - Also reset: `focusRequest` (`Planner.tsx:60`) and the `NewTaskForm` error.
  - The diagram refits only when the Task-id list changes (`Diagram.tsx:55-58`), so importing a project with the same ids does not refit.
- **The name prompt (FR-013).** Installed shadcn components: `button`, `input`, `label`, `native-select`, `tooltip` (`src/components/ui/`).
  - **shadcn `dialog` / `alert-dialog`.** These pull in `@radix-ui/react-dialog` → `react-remove-scroll` → `react-style-singleton`. That injects a `<style>` element without a nonce, which the hash-only `style-src` would block (from the upstream `react-style-singleton@2.2.3` source; not installed here, not run). It would log a violation each time the dialog opens, failing the R4 gate.
  - **Native `<dialog>`** or an inline header name field with an error on Export avoids injected styles.
  - **`window.prompt()`** is CSP-safe but cannot use the app's inline-error pattern.
- **Kitchen sink.** The kitchen sink (`src/dev/kitchen-sink.astro`, `src/dev/KitchenSinkPlanner.tsx:65-75`) builds fixtures through the real edit functions (`accepted()`, `:19-22`). It therefore cannot hold an invalid project. An import-error state must be action-driven, for example a sample invalid file under `src/dev/`, or an injected initial error.

## Code References

- `src/types.ts:5-48` — Project/Task model; id, predecessor and order invariants as comments
- `src/lib/services/project.ts:10-25` — `ValidationErrorRule`, `ValidationError`, `EditResult`
- `src/lib/services/project.ts:44-57` — `taskLabel` (exported), `pathLabel` (private)
- `src/lib/services/project.ts:66-76` — `checkTaskName` (private)
- `src/lib/services/project.ts:78-93` — `replaceTask`, `createEmptyProject`, `createTask` (id minting from `nextTaskId`)
- `src/lib/services/project.ts:153` — `isPositiveWholeDays`
- `src/lib/services/project.ts:182-196` — `setStartDate`, rule `start-date-not-a-date`
- `src/lib/services/task-graph.ts:84-117` — `findCycle`
- `src/lib/services/task-graph.ts:155-180` — `topologicalOrder`, throws on cycle / duplicate ids
- `src/lib/services/calendar-date.ts:46,55-56` — `isIsoDate`; `addDays` throws on a non-ISO date
- `src/lib/services/forecast.ts:40-70` — base-date choice, topological walk, defensive throw
- `src/lib/services/validation-warnings.ts:17-25` — `validationWarnings` (`duration === undefined` check)
- `src/hooks/useProject.ts:36-93` — state, `latest` ref, `apply`, selection
- `src/components/planner/Planner.tsx:53,93-96,120` — forecast in render, header, TaskPanel key
- `scripts/csp/check-page.ts:28-31` — required-`'none'` directives, source allowlist
- `src/dev/KitchenSinkPlanner.tsx:19-22,65-75` — fixture construction

## Architecture Insights

- **Pure domain plus a hook commit.** Every edit is a pure function returning `EditResult`. The hook commits only `ok` results (`useProject.ts:1-3,45-52`). Import fits as a pure `parseProjectFile(text): { ok, project } | { ok: false, error }` in `src/lib/services/`, alongside a pure `serializeProject(project): string`. The hook gains one `replaceProject`. Both functions can be unit-tested in Vitest under the existing `src/**/*.test.ts` convention.
- **Layered validation.** Parsing and shape/type checks come first. The model invariants (F1) and PRD Validation Errors (names, Durations, START date, unknown ids, cycle) come next. Only then is the project committed. Ordering matters because `findCycle` assumes well-typed arrays, and `checkTaskName` assumes a trimmed string.
- **Test-plan contract (adopt in the plan, locked in by Phase 3)** (`test-plan.md:39-41,55,59`):
  - risk #1: committed golden files per shipped format version, with documented defaults for absent fields; no regenerating goldens from the exporter;
  - risk #2: every US-03 field plus ids and `nextTaskId` survive; a double export is byte-identical; a Task created after import never reuses an id;
  - risk #3: one table row per PRD Validation Error, plus malformed input; the current project is unchanged and the planner never blanks.

  §6.3 of the test plan is still "TBD" (`test-plan.md:109-111`).

- **Oracle rule.** Expected values come from the PRD or a hand-written fixture, never from the code under test (`test-plan.md:17`).

## Historical Context (from prior changes)

- `context/archive/2026-09-27-capture-task-graph/plan-brief.md:22,24` — decided that START and FINISH are separate entities, not Tasks. Task ids are sequential from `nextTaskId` and never reused, "for a diff-friendly file".
- `context/archive/2026-09-27-capture-task-graph/plan.md:164,208` — decided intent that "S-03 import reuses the same checks". The Task-name rules were added to the PRD so that import inherits them.
- `context/archive/2026-09-27-capture-task-graph/reviews/plan-review.md:63-66` — the name limit counts UTF-16 code units, and names must be well-formed. Saving as UTF-8 round-trips any well-formed string exactly. Only lone surrogates would be replaced, and the well-formedness rule rejects those first.
- `context/archive/2026-09-27-capture-task-graph/follow-ups/review-fixes.md:7-13` — F1, whole-project validation. Bullet 1 (`findCycle`) is done in S-02. Bullets 2 and 3 are open for S-03. Its line anchors predate later edits:

  | Function        | F1 anchor | Current location |
  | --------------- | --------- | ---------------- |
  | `checkTaskName` | `:36`     | `project.ts:66`  |
  | `replaceTask`   | `:46`     | `project.ts:78`  |
  | `createTask`    | `:58`     | `project.ts:86`  |

- `context/archive/2026-10-04-reject-invalid-dependencies/plan.md:39-40,77` — the START/FINISH import errors and the rest of F1 were deferred to S-03. `findCycle` ignores dangling ids, which are S-03's unknown-id rule.
- `context/archive/2026-10-04-forecast-finish-dates/plan.md:40,53,70,78` — import validation of the START date and Durations was deferred to S-03. "Unset" means an absent key. The ISO date range is 0001-01-01 to 9999-12-31. `isPositiveWholeDays` was exported for S-03.
- `context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:29-51` — Fix A was adopted: import validates, and `"weekdays"` is rejected until S-06. Fix B, an error boundary, is an unadopted defence in depth.
- `context/archive/2026-10-04-forecast-finish-dates/plan.md:37` — the forecast counts a Done Task as 0 days, so a Done Task without a Duration (possible through a pre-S-07 import) produces no NaN.

## Related Research

- `context/archive/2026-09-27-capture-task-graph/research.md` — CSP `style-src` without `'unsafe-inline'` (`:30`) and why the island is `client:only`
- `context/archive/2026-10-10-testing-forecast-dates/research.md` — forecast throws and the "validate on import" choice
- `context/archive/2026-10-11-testing-csp-artifact-check/research.md` — what the built CSP contains, and the checker

## Open Questions

Genuine choices for `/10x-plan`; the owner is the user unless noted.

1. **YAML or JSON?** _(Researched in the follow-up below; still the user's decision.)_ JSON costs 0 B and needs no dependency. YAML is friendlier to hand-edit but costs 14–31 KB gzip. The PRD's tie-breaker persona keeps plans in version control and wins conflicts (`prd.md:30`). What are the key-order, indentation and trailing-newline rules for a byte-identical re-export? What is the file extension?
2. **Format version field.** Should the file carry one? Test-plan risk #1 asks this explicitly. The roadmap wants all US-03 fields present from the start (`roadmap.md:128`), which reduces but does not remove the need. What are the defaults for absent fields?
3. **Statuses and completion dates before S-07.** The roadmap says only "reject `weekdays` until S-06". The PRD makes the Done rules Validation Errors (`prd.md:194`), and S-03 cannot check them yet. Options:
   - reject `status !== "to-do"` and any `completionDate` until S-07, by analogy with `weekdays`;
   - accept them unchecked, which would let a project hold a Validation Error, against the guardrail at `prd.md:66`.
4. **START/FINISH errors in the file shape.** Should the file allow a representation (for example `start.predecessors`, or `"START"`/`"FINISH"` tokens in predecessor lists) so these rules have something to reject? Or should a strict schema reject any unknown key or non-integer predecessor, so the errors become "unknown field" or "not a Task id"? The PRD names them as import rejections (FR-014, `prd.md:174`).
5. **Strictness.** How should unknown or extra keys, untrimmed names, unsorted or duplicate predecessors, and out-of-order Tasks be handled: rejected, or normalised? Normalising weakens "exactly the same project". Rejecting is stricter for hand edits.
6. **Project name rules.** None exist. Decide whether to reuse the Task-name rules, how to sanitise a filename (path separators, reserved characters), and how the name is requested when unset: an inline field with an error, native `<dialog>`, or `window.prompt`. A shadcn/Radix dialog risks CSP violations (see UI integration).
7. **Import with unexported changes.** Does import replace the current project silently? Confirmation for "unexported changes" is S-08's scope for New Project (FR-016); the PRD does not address import.
8. **Error boundary.** Should S-03 add one as defence in depth (Fix B, still open)?

**Unverified facts for the plan to close**

- Top-level blob `<a download>` under this CSP in **WebKit/Safari**. Also re-confirm Chromium and Firefox under `npm run preview`, the only mode where the CSP is in effect. This may justify promoting an E2E download check, as `test-plan.md:69` anticipates for "the file picker path".
- Whether Radix Dialog with `modal={false}` avoids the style injection.

**Environment note.** _(Superseded: `node_modules` was reinstalled at 2026-10-11 17:58, and `npm ls` now reports `astro@7.3.7` and `@astrojs/react@7.0.1`.)_ At first research, `node_modules` was out of sync with `package.json`: `npm ls` reports `astro@7.3.5` (`^7.3.7` required) and `@astrojs/react@7.0.0` (`^7.0.1` required). Commit `0ed6cb3` bumped the versions without a reinstall. Run `npm ci` before implementing.

## Follow-up 2026-10-11: YAML or JSON file format

**Question.** Should S-03 use YAML or JSON for the exported project file? This is roadmap Unknown `roadmap.md:127` (owner: user).

**Method.**

- Context7 docs: `/websites/eemeli_yaml` and `/nodeca/js-yaml` (README, migrate_v4_to_v5.md, safety.md).
- Package sources: `yaml@2.9.1` from the repo's `node_modules`; `js-yaml@4.3.2` and `5.4.3` installed into a scratchpad, outside the repo.
- Web primary sources: YAML 1.2.2 spec, MDN, V8 `message-template.h`, WebKit `LiteralParser.cpp`, and project sites.
- GitHub Advisory Database (`gh api /advisories`).
- Four local Node 24.21.0 experiments (V8; scripts in the session scratchpad, not in the repo).

Exa search was requested but not usable: only its authenticate tool was exposed, so WebSearch/WebFetch were used instead. Nothing in the repo was changed except this file.

### Answer

The evidence favours **JSON written by a small hand-written serializer**, read with `JSON.parse` plus the strict validator this change needs anyway. The format is still the user's decision.

The deciding points are the S-03 guarantees, "exactly the same project", byte-identical re-export and a clear rejection (`prd.md:65-66,173-174`; `test-plan.md:39-41`):

- **YAML has hand edits that silently change data and that no validator can see.** Some of these are only stopped by pinning parser options. JSON turns the same mistakes into a parse error.
- **JSON's output is fully under the app's control.** YAML's output depends on a library version that promises no stability.

YAML's readability advantages are real but smaller than they look for this app:

- **Comments.** A comment in a hand-edited file is lost on the next export with either format, because the app re-serializes from its model.
- **Diff size.** The measured difference is 0–3 changed lines per typical edit.

### Evidence

**1. Hand edits that are valid but change data.** Observed in local experiment `exp1`/`exp3` unless noted. Plain, unquoted YAML value → parsed result:

| Hand edit                                 | `yaml` 2.9.1 default (1.2 core)                       | `js-yaml` 4.3.2 default                   | `js-yaml` 5.4.3 default | JSON equivalent                                                        |
| ----------------------------------------- | ----------------------------------------------------- | ----------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `name: QA #1`                             | `"QA"`, text after ` #` silently dropped as a comment | same                                      | same                    | `"QA #1"` (must be quoted)                                             |
| `name: 007` / `name: 1.10` / `name: null` | number 7 / 1.1 / null                                 | same                                      | same                    | unquoted is not valid JSON for 007; 1.10 and null parse as number/null |
| `date: 2026-10-11`                        | string                                                | **Date object**                           | string                  | string (must be quoted)                                                |
| `date: 2026-02-30`                        | string (then rejected by `isIsoDate`)                 | **Date 2026-03-02**, silently rolled over | string                  | string                                                                 |
| `duration: 05` / `0x10`                   | 5 / 16, accepted                                      | same                                      | same                    | **syntax error**                                                       |
| `duration: 1e3` / `3.0`                   | 1000 / 3, accepted                                    | same                                      | same                    | 1000 / 3, accepted                                                     |
| duplicate key                             | error "Map keys must be unique"                       | error                                     | error                   | **last value wins silently** (`JSON.parse`)                            |
| a list truncated after a whole item       | still valid YAML                                      | same                                      | same                    | syntax error                                                           |

Also:

- A `%YAML 1.1` directive at the top of the file switches `yaml` to 1.1 typing (`yes` → true, dates → Date, `<<` merge on). `schema: 'core'` blocks this; `version: '1.2'` alone does not (Context7 worker probe, `node_modules/yaml/dist/doc/Document.js:255-275`).
- Under `yaml` core, explicit tags such as `!!timestamp` and `!!set` still resolve unless `resolveKnownTags: false` (`dist/schema/Schema.js:18`).

How the validator handles these (from the main research):

- **Caught:** type mismatches (a number or null where a name string is expected; a Date where an ISO string is expected). The validator rejects them, but the message says "not text" rather than "quote this".
- **Not caught:** the ` #` truncation and the `05`/`0x10` numerals in YAML, and duplicate keys in JSON. Each produces well-typed data the user did not mean.

**2. Determinism and byte-identical re-export.**

- `JSON.stringify` with a fixed key-insertion order is deterministic and defined by ECMAScript, so the app owns every byte.
- Neither YAML library documents output stability across versions. `js-yaml` 5 changed its default dump schema and quoting (migrate_v4_to_v5.md), and `yaml` has `3.0.0-2` on its `next` tag. A dependency bump (this repo uses Dependabot) could change exported bytes, and only golden files would catch it (`test-plan.md:39`).
- YAML export also needs explicit options:
  - `lineWidth: 0` (`yaml`) or `-1` (`js-yaml`), so a 200-character name is not folded over several lines (default 80);
  - `aliasDuplicateObjects: false` / `noRefs: true`. By default, shared arrays are written as `&a1`/`*a1` anchors, which a strict importer would then refuse;
  - for `yaml`, `compat: 'yaml-1.1'`. By default `yaml` writes `name: NO` and `date: 2026-10-11` unquoted, which 1.1 readers (PyYAML, `js-yaml` 4) read as false or a Date.

**3. Diff size.** Experiment `exp2`, a 6-Task project. Each value is the number of `<`/`>` lines in `diff` output for one edit:

| Layout                           | Lines | Add predecessor | Append Task | Rename | Set Duration | Delete middle Task | 100 Tasks             |
| -------------------------------- | ----- | --------------- | ----------- | ------ | ------------ | ------------------ | --------------------- |
| `JSON.stringify(p, null, 2)`     | 64    | 1               | 11          | 2      | 1            | 12                 | 1003 lines / 19,044 B |
| JSON, `predecessors` on one line | 53    | 2               | 9           | 2      | 1            | 9                  | 712 lines / 16,716 B  |
| JSON, one Task per line          | 18    | 2               | 5           | 2      | 2            | 3                  | 112 lines / 12,119 B  |
| YAML (`yaml` default)            | 43    | 1               | 8           | 2      | 1            | 7                  | 702 lines / 13,823 B  |
| YAML, flow `predecessors`        | 37    | 2               | 7           | 2      | 1            | 7                  | 508 lines / 12,756 B  |

- On appending or deleting, JSON costs 1–2 extra lines, the comma on the neighbouring `}` (`exp2`).
- Two branches that each append a Task conflict on that comma line in JSON. A badly resolved JSON conflict usually fails to parse, while a badly resolved YAML conflict can stay valid with wrong nesting. This is the web worker's inference, not an empirical study.

**4. Prettier stability.** Experiment `exp4`, repo Prettier, `--no-config`. This matters if a team commits the file into a repo that formats `*.json` or `*.yaml`, as this repo's lint-staged does for `*.json` (`package.json` `lint-staged`). The next app export would otherwise undo Prettier's change and show a diff:

- **Left unchanged by Prettier:** JSON with `predecessors` on one line, and `yaml`'s default output.
- **Rewritten by Prettier:**
  - `JSON.stringify(p, null, 2)` (multi-item `predecessors` collapsed to `[2, 3]`);
  - `yaml` flow sequences (`[ 2, 3 ]` → `[2, 3]`);
  - `js-yaml` 5 output (single quotes → double quotes).
- Condition: tested at Prettier's default 80-column width. A `predecessors` line longer than that would be expanded by Prettier.

**5. Error messages for a hand-edit mistake.**

- **`yaml`** gives line and column on every error, a stable `code`, and `parseDocument` collects all errors.
  - Example: "Tabs are not allowed as indentation at line 2, column 1".
  - Some messages are cryptic, e.g. "Nested mappings are not allowed in compact mappings" for an unquoted `name: Design: wireframes`.
- **`js-yaml`** gives `(line:col)` and stops at the first error.
- **`JSON.parse` text depends on the engine:**

  | Engine                              | Location in message                                                                                                                   |
  | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
  | V8 (Chrome, Edge; Node 24 observed) | "at position N (line L column C)" for most errors; the trailing-comma error gives only a snippet, `Unexpected token ']', ..."d": 1},` |
  | Firefox                             | "at line L column C of the JSON data" (MDN JSON_bad_parse examples)                                                                   |
  | Safari / JavaScriptCore             | no line or position, inferred from `LiteralParser.cpp`, not run in Safari                                                             |

  So a consistent "line N" message for JSON needs the app to find the location itself.

- For both formats, the larger class of import errors is schema-level ("Task 3: …"). The app phrases those itself in either format.

**6. Safety with an untrusted file.**

- **`JSON.parse`** builds plain data only. `__proto__` becomes an own key, not a prototype change (`exp3`). This is safe if the validator reads known keys only.
- **`yaml`:**
  - limits aliases by default (`maxAliasCount` 100; an alias bomb was rejected in `exp3`);
  - rejects duplicate keys;
  - has no nesting-depth option: 20,000 nested `[` gave a caught "Maximum call stack size exceeded";
  - npm advisories, verified via `gh api /advisories`: CVE-2023-2251 (fixed 2.2.2) and CVE-2026-33532, stack overflow on deep nesting (fixed 2.8.3).
- **`js-yaml`:**
  - 5.4.3 accepted a 6-level alias bomb (`exp3`); its docs recommend a manual node-count guard (safety.md);
  - 12 npm advisories in the same database (query of 2026-10-11), 9 of them published 2025-11-14 to 2026-09-29, e.g. CVE-2025-64718 (prototype pollution via `<<`), CVE-2026-73643 (exponential parse in flow collections, fixed 5.2.2) and GHSA-r3ph-w7gj-g6xm (2026-09-29, fixed 5.4.1).
- The input is a file the user picks, so the worst case is the user's own tab hanging. No data leaves the device under the CSP. Each advisory is still a dependency bump the project must take.

**7. Cost and CSP.**

| Option                         | Added gzip (esbuild measurement in the scratchpad, not this app's Vite build) | Dependency            |
| ------------------------------ | ----------------------------------------------------------------------------- | --------------------- |
| JSON                           | 0 B                                                                           | none                  |
| `js-yaml@5.4.3` full ESM build | +20,728 B                                                                     | new direct dependency |
| `yaml@2.9.1` parse + stringify | +30,572 B                                                                     | new direct dependency |

- Neither YAML library uses `eval` or `new Function` (grep of `yaml` dist/browser and `js-yaml` 5 ESM min: 0 hits), so both work under the hash-only `script-src`.
- `yaml` is in the repo only as a transitive of astro/vite/lint-staged, so S-03 would have to declare it explicitly.

**8. What comparable tools use** (web worker; project sites):

- **JSON for app-written files:** Excalidraw `.excalidraw` (docs.excalidraw.com), Obsidian JSON Canvas (jsoncanvas.org, chosen for "readability, interoperability"), tldraw `.tldr`.
- **XML:** draw.io; its uncompressed form is an export option recommended for git diffs.
- **Own text formats meant to be written by hand:** TaskJuggler, Mermaid.
- **YAML:** hand-written config such as Kubernetes, Compose and GitHub Actions.

The planner's file is app-written and hand-_edited_. That puts it closest to the JSON group, with hand-editing as the reason to keep the output readable and line-oriented.

**9. Middle grounds** (web worker measurement):

- JSONC via `jsonc-parser`: +3.3 KB gzip.
- JSON5: +10.1 KB gzip.
- TOML via `smol-toml`: +6.6 KB gzip; every string is quoted, so it has no implicit typing.

These add comments and trailing commas but lose plain JSON's universal tooling. Comments would not survive re-export, so the main gain would be trailing commas.

### If JSON is chosen: what the plan has to specify

These are open design points, not decisions.

- **Layout.** A serializer that writes `JSON.stringify(…, null, 2)` with each `predecessors` array on one line, plus a trailing newline. This is Prettier-stable at 80 columns (`exp4`), one key per line, and needs about 5 lines of code. "One Task per line" gives the smallest diffs (`exp2`) but puts several fields on one long line.
- **Key order.** A fixed order, built explicitly rather than inherited from object spread. Absent keys stay absent, matching `forecast-finish-dates/plan.md:53`.
- **Error messages.** Compute line and column from the `JSON.parse` failure, or re-scan for the first syntax error, so all four target browsers give a "line N" message. Safari's message has no location (point 5).
- **Duplicate keys.** Accept that the last value wins as a known residual risk, or detect duplicates with a small tokenizer.
- **File name.** The extension (`.json`, or a custom one such as `.critical-path.json` so editors still highlight JSON) and `type`/MIME for the Blob (`application/json`).

### If YAML is chosen: required settings (from the Context7 worker; untested as a full set)

- **`yaml` parse:** `{ schema: 'core', resolveKnownTags: false, merge: false, maxAliasCount: 0, uniqueKeys: true, strict: true, logLevel: 'error' }`, or `parseDocument` so warnings also count as errors.
- **`yaml` stringify:** `{ lineWidth: 0, aliasDuplicateObjects: false, compat: 'yaml-1.1' }`.
- **Dependency:** pin the exact version, and keep golden files as the guard on byte-identical output across bumps.

### Gaps

- Safari's `JSON.parse` message format is inferred from JavaScriptCore source, not run.
- The diff and merge claims for multi-branch conflicts are reasoning, not a study.
- `js-yaml` 5 behaviour was probed for typing and alias bombs only. Its strict-option set was not assembled or tested.
- The bundle sizes are esbuild measurements in the scratchpad, not the app's Vite build.
