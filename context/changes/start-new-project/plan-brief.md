# Start a New Project Safely — Plan Brief

> Full plan: `context/changes/start-new-project/plan.md`

## What & Why

Roadmap S-08 (FR-016): the user can start a new, empty project and is asked to confirm first when the current project has changes that were not exported. The exported file is the only persistence, so a one-click replacement silently loses work, against the PRD's "no silent data loss" Guardrail. The same confirmation guards the two other replacement paths: Import and "Go back to the project before the last change" on the render crash fallback.

## Starting Point

There is no New action; Import replaces the project as soon as the file is accepted; Go back acts in one click; nothing records an export. `useProject` already routes every commit through one function and a `latest` ref, and `createEmptyProject()` returns a `CheckedProject` that `replaceProject` takes. `src/components/ui/` has no dialog.

## Desired End State

The header has a New project button. New, a valid Import and Go back replace the project at once when nothing is unexported, and otherwise open a modal "Discard unexported changes?" that replaces only on the destructive choice. Cancel or Escape changes nothing and returns focus to the button that started it. Exporting clears the need to ask.

## Key Decisions Made

| Decision             | Choice                                                                                                                                                                        | Why (1 sentence)                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Unexported changes   | The project's file text differs from the last one exported, imported or started new                                                                                           | Literally "an export would write something new"; rename-and-back is clean, create-then-delete and Day counting count        |
| Initial project      | Counts as the baseline (clean)                                                                                                                                                | A fresh page, the dev fixtures and the kitchen-sink fixtures hold nothing to lose                                           |
| Where the rule lives | `useProject`: baseline ref, `hasUnexportedChanges()`, `markExported()`                                                                                                        | One notion for all three paths (RK-04), read from the `latest` ref in event handlers                                        |
| Confirmation UI      | Native `<dialog>` primitive `ConfirmDialog` in `src/components/ui/`                                                                                                           | Browser modality and focus trap, no dependency; Radix Dialog injects a `<style>` the CSP blocks                             |
| Import timing        | Ask after `parseProjectFile` accepts the file                                                                                                                                 | A rejected file or a cancelled picker never prompts, and the dialog can name the file                                       |
| Dialog choices       | Cancel (focused) or a destructive "Discard and …"                                                                                                                             | Same in header and fallback; Export is one click away after Cancel                                                          |
| Go back              | Asks while the crashed project is unexported; the fallback's Export moves the baseline                                                                                        | Go back discards the crashed project, the same loss as New                                                                  |
| Tab close            | Out of scope                                                                                                                                                                  | FR-015 stays parked; S-08 guards New, Import and Go back only                                                               |
| Parallel with S-05   | S-08 stays in `ProjectControls`, `RenderCrashFallback`, `ConfirmDialog` and a small exported marker in `useProject`; additive edits only in `Planner.tsx` and `useProject.ts` | S-05 (`critical-path-highlight`) is implemented at the same time in the forecast service, the diagram and `ForecastSummary` |
| File format          | Unchanged: no edit to `serializeProject`, `parseProjectFile`, golden files or the version                                                                                     | The rule reads `serializeProject` only; the format is shared by every slice                                                 |
| Tests                | Hook rule table + jsdom `Planner`/fallback tests + one Playwright Import test                                                                                                 | Covers the rule, all three paths, and the real `<dialog>` under the CSP                                                     |

## Scope

**In scope:**

- New project button; confirmation before New, a valid Import, and Go back
- Export (header and fallback) moves the baseline
- `ConfirmDialog` primitive and an `--overlay` backdrop token
- Updated `e2e/render-crash.spec.ts`, new `e2e/unexported-changes.spec.ts`
- Glossary entry and a `PROJECT_RULES.md` UI rule for confirmations

**Out of scope:**

- `beforeunload` warning, "Export first" button, header indicator, general undo
- shadcn `alert-dialog` / Radix Dialog, any CSP change
- Knowing whether the save dialog completed (clicking Export counts)
- A new test-plan risk row (next `/10x-test-plan` refresh)
- Any file-format change: `project-file.ts`, `golden/`, `PROJECT_FILE_VERSION`
- Any edit to S-05's area: `forecast.ts`, `components/planner/diagram/`, `ForecastSummary.tsx`

## Architecture / Approach

`useProject` keeps a baseline project in a ref next to `latest`: initially the opening project, reset by `replaceProject` (Import, New) and by `markExported` (both Export buttons), untouched by edits and Go back. `hasUnexportedChanges()` compares `serializeProject` of `latest` and baseline (identity short-circuit; a serialization throw counts as unexported). `ProjectControls` and `RenderCrashFallback` call it on click and either replace at once or open `ConfirmDialog`; a confirmed New or Import goes through `handleReplaceProject`, so focus lands on New Task as today.

## Phases at a Glance

| Phase                                         | What it delivers                                                                                                      | Key risk                                                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1. Unexported-changes rule in the state hook  | `hasUnexportedChanges`, `markExported`, baseline reset by `replaceProject`                                            | Reading the rendered project instead of `latest` would miss a just-blurred name                                    |
| 2. ConfirmDialog, New project and Import      | Dialog primitive, New project button, Import confirmation, Export baseline                                            | Native `<dialog>` lifecycle (Escape, preflight margin) and the jsdom stub                                          |
| 3. Go back confirmation on the crash fallback | Go back asks over an unexported crashed project; fallback Export moves baseline                                       | jsdom cannot reach a previous project plus a crash without mocks: test the fallback directly, in its own test file |
| 4. Built-app E2E and docs                     | Playwright Import confirmation under the CSP; glossary and rules updated; diff checks for file format and S-05's area | CSP or modality regressions only visible in the built app                                                          |

**Prerequisites:** S-03 (done); the existing Playwright setup (`context/foundation/test-stack.md`).
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- S-05 runs in parallel: `Planner.tsx`, `useProject.ts`, `global.css` and `Planner.test.ts` may conflict on merge; S-08 keeps its edits additive there and puts the fallback tests in a new file.
- Clicking Export counts as exported even if the user cancels the browser's save dialog; the app cannot observe it.
- A Task created and then deleted still asks, because `nextTaskId` is in the file; accepted as the literal meaning of "unexported".
- Assumes Chromium's handling of a repeated Escape on a modal `<dialog>` (forced `close`) is covered by treating `close` as cancel.

## Success Criteria (Summary)

- Starting a new project, importing or going back never discards unexported work without a confirmation.
- A project that was just exported, imported or started new is replaced without a prompt.
- The full gate and the E2E suite pass, with no CSP violation in the built app.
