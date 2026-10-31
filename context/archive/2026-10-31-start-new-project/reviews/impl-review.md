<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Start a New Project Safely

- **Plan**: context/changes/start-new-project/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-31
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Evidence

- Full gate `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`: pass (18 files, 438 tests; CSP check passed on 2 pages).
- `npm run test:e2e`: 8/8 pass, including `render-crash.spec.ts` and the new `unexported-changes.spec.ts`.
- `git diff --exit-code main -- src/lib/services/project-file.ts src/lib/services/golden/`: empty.
- `git diff --exit-code main -- src/lib/services/forecast.ts src/components/planner/diagram/ src/components/planner/ForecastSummary.tsx`: empty.
- Plan drift: every planned change MATCHES its contract. No MISSING items. The EXTRAs are benign: `flushSync` in `closeDialog` so the modal is unmounted before focus leaves it, two extra hook test cases, and "New project" added to the glossary's Replacement entry. Every "What We're NOT Doing" item holds: no `beforeunload`, no indicator, no CSP or `package.json` change, nothing changed in `src/lib/`.

## Findings

### F1 — Unnamed-Export branch that must not move the baseline is untested

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/ProjectControls.tsx:120-128
- **Detail**: When the project has no name, `handleExport` shows "Name the project to export it." and returns before `markExported(exported)`, which is correct. No test covers this branch: the string appears nowhere in `src/**/*.test.ts` or `e2e/`. If `markExported` moved above the name check, every test would still pass, and the user would lose work silently: Export with no name downloads nothing, but New project would then discard without asking. That is exactly the data loss FR-016 guards against.
- **Fix**: Add a case to the `Planner: unexported changes…` describe in `Planner.test.ts`: after an edit with no project name, click Export and assert no download was captured and the name alert is shown. Then click New project and assert the dialog opens.
- **Decision**: FIXED. Added "keeps asking after an Export the project name stopped, since nothing was written" to `Planner.test.ts`. It passes, and fails when `markExported` is moved above the name check.

### F2 — Manual Progress rows ticked with no recorded evidence

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/start-new-project/plan.md:338-366 (rows 2.4, 2.5, 2.6, 3.4, 4.6)
- **Detail**: Every Manual row is `[x]` with a commit SHA appended, the same as the Automated rows. Nothing in the diff records that the checks were done: no screenshot and no notes. The Phase 2 check of the centred modal and dimmed backdrop, and the Phase 2 keyboard and Tab-trap check, cannot be done by an agent alone. The project rules say "A green run is not a finished change", so these rows must reflect a human check.
- **Fix**: Confirm you did these checks yourself. If you did not, untick 2.4–2.6, 3.4 and 4.6 and run them on `npm run build && npm run preview` before merging.
- **Decision**: DISMISSED. The user confirmed they ran the manual checks, so the rows stay ticked.

### F3 — Real-browser Escape and the `onClose` path are not exercised

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/ui/confirm-dialog.tsx:56-63, e2e/unexported-changes.spec.ts
- **Detail**: Escape is tested only with a synthetic `cancel` event in jsdom. Chromium may fire a non-cancellable `cancel` and then `close` when there has been no user activation, which is likely after the file picker on the Import path. In that case the code relies on `onClose={onCancel}`, and deleting that line breaks no test. The code itself is safe: a second `onCancel` is harmless. The plan's manual check 2.5 is meant to cover this by hand.
- **Fix**: In `e2e/unexported-changes.spec.ts`, after the first import press `page.keyboard.press("Escape")` and assert the dialog is gone, "Keep me" remains and Import has focus. The same file then still covers the Cancel button on the next import.
- **Decision**: FIXED. `e2e/unexported-changes.spec.ts` now presses Escape on the first import, clicks Cancel on the second and confirms on the third; the test title and header were updated to match. It passes in Chromium, and fails when the `cancel` handler stops calling `onCancel`.

### F4 — E2E header comments don't name the new fallback test file

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: e2e/render-crash.spec.ts:9-10, e2e/unexported-changes.spec.ts:6-7
- **Detail**: `render-crash.spec.ts` still says the fallback is unit-tested in `Planner.test.ts`, but the Go back confirmation tests now live in `src/components/planner/RenderCrashFallback.test.ts`. `unexported-changes.spec.ts` lists the unit tests and leaves out the same file.
- **Fix**: Add `src/components/planner/RenderCrashFallback.test.ts` to both header comments.
- **Decision**: FIXED. Both E2E headers now name `RenderCrashFallback.test.ts`.

### F5 — Dialog and download stubs duplicated across two test files

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/Planner.test.ts:233-273, :350-378; src/components/planner/RenderCrashFallback.test.ts:46-111
- **Detail**: `stubDownloads` and the `showModal`/`close` stubs are copied word for word. This is intentional: the plan put the fallback tests in their own file to avoid overlapping S-05's edits to `Planner.test.ts`.
- **Fix**: Leave as is until S-05 merges. Then move both stubs into a shared non-test helper, for example `src/components/planner/test-stubs.ts`, which holds no class names.
- **Decision**: FIXED. Done now rather than after S-05, as the user chose. `src/components/planner/test-stubs.ts` (new) exports `Download`, `stubDownloads` and `stubDialog`, and both test files import them. It follows the precedent of `diagram/flow-jsdom-shim`. The built CSS hash is unchanged with the new file in Tailwind's scan. Expect a small merge conflict with S-05 if it also edits the stub area of `Planner.test.ts`.

## Not raised as findings

- Clicking Export counts as exported even if the browser's save dialog is then cancelled. The plan lists this explicitly under "What We're NOT Doing", and browsers give no signal to detect it.
- `confirm-dialog.tsx` has no `data-slot` and no `className` passthrough, unlike `button.tsx`. It is a composite component, not a styled primitive, so this is acceptable.

## Triage summary (2026-10-31)

- Fixed: F1, F3, F4, F5
- Dismissed: F2 (the user confirmed the manual checks were done)
- After the fixes: full gate green (439 tests, CSP check on 2 pages), E2E 8/8, built CSS hash unchanged.
