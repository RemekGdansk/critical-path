# Start a New Project Safely Implementation Plan

## Overview

Roadmap S-08 (FR-016): the user can start a new, empty project, and is asked to confirm first when the current project has changes that were not exported. The same confirmation guards the two other ways the current project is replaced: Import (deferred to S-08 by `project-file-round-trip`) and "Go back to the project before the last change" on the render crash fallback (deferred to S-08 by `render-crash-recovery`). One notion of unexported changes, owned by the state hook, decides all three (RK-04 / INV-22 in `context/domain/01-domain-distillation.md`).

## Current State Analysis

- There is no New action. `createEmptyProject()` exists and returns a `CheckedProject` (`src/lib/services/project.ts:162-164`), so `replaceProject(createEmptyProject())` already type-checks (`src/hooks/useProject.ts:26-30`).
- Import replaces the project as soon as `parseProjectFile` accepts the file (`src/components/planner/ProjectControls.tsx:125-134`). The archived round-trip plan records "until S-08, importing over unexported work loses that work without asking" (`context/archive/2026-10-11-project-file-round-trip/plan.md:56`).
- Go back acts in one click (`src/components/planner/RenderCrashFallback.tsx:84-88`). The render-crash review left it unchanged so the rule would have one implementation in S-08 (`context/archive/2026-10-13-render-crash-recovery/reviews/impl-review.md:85-91`).
- Nothing tracks exports. Export downloads and forgets (`ProjectControls.tsx:84-101`); the fallback's Export likewise (`RenderCrashFallback.tsx:57-60`).
- `src/components/ui/` has no dialog. The installed Radix packages are label, slot and tooltip only; shadcn's `alert-dialog` would add `@radix-ui/react-dialog`, whose scroll lock (`react-remove-scroll` → `react-style-singleton`) inserts a `<style>` element at runtime, which the hash-only `style-src` that Astro emits blocks (a CSP violation on the console in the built app).
- jsdom 30.1.3 implements no `HTMLDialogElement.prototype.showModal`.
- `e2e/render-crash.spec.ts:55-66` creates "Keep me" and then imports over it, so it will meet the new Import confirmation.

## Desired End State

- The header has a **New project** button. With no unexported changes it replaces the project with an empty one at once; otherwise a modal asks "Discard unexported changes?" and replaces only on the destructive choice.
- **Import** reads and checks the file as today; a rejected file shows its alert and never asks. A file `parseProjectFile` accepts replaces the project at once when there are no unexported changes, and otherwise only after the same modal (naming the file) is confirmed.
- **Go back** on the crash fallback asks the same way while the project the planner stopped on has unexported changes.
- Cancel or Escape leaves project, selection, `replacements` and `previousProject` exactly as they were, and returns focus to the button that started the action.
- Either Export button moves the baseline, so a project just exported is replaced without asking.
- Verified by: `useProject.test.ts` rule table, `Planner.test.ts` confirmation tests for New, Import and the fallback's Go back, the updated `e2e/render-crash.spec.ts` and a new `e2e/unexported-changes.spec.ts`, plus the full gate.

### Key Discoveries:

- Every commit already passes through one `commit` function and a `latest` ref that event handlers read synchronously (`src/hooks/useProject.ts:66-79`); the baseline belongs next to it, as a ref.
- `serializeProject` is the one place that knows the file text (`src/lib/services/project-file.ts:73`), and `nextTaskId` is part of it (`:82`).
- Import and New already share the right post-replacement behaviour: `handleReplaceProject` clears the focus request and focuses New Task (`src/components/planner/Planner.tsx:182-189`); `ProjectControls` is keyed by `replacements`, so the name draft starts over.
- The error boundary is keyed by `goBacks`, not `replacements`, so an import does not remount the view (`Planner.tsx:65-70`, archived addendum `render-crash-recovery/plan.md:235`). Do not change that keying.
- Test patterns: hook rule tests with `renderHook` and real fixtures (`context/foundation/test-plan.md` §6.2), `Planner` render with the React Flow shim and download stubs already in `src/components/planner/Planner.test.ts:20-27`, `:230-266`.

## What We're NOT Doing

- No warning on tab close or reload (`beforeunload`): FR-015 (work survives a refresh) stays parked, and S-08 guards only New, Import and Go back.
- No "Export first" button in the dialog: Cancel, then Export, is one extra click.
- No visible "unexported changes" indicator in the header.
- No general undo; Go back stays one step, only on the crash fallback (`render-crash-recovery` non-goal).
- No shadcn `alert-dialog` / Radix Dialog, and no CSP change.
- No detection of whether the browser's save dialog was completed: clicking Export counts as exported.
- No new risk row in `context/foundation/test-plan.md` §2; the next `/10x-test-plan` refresh adds the data-loss scenario it already announces (`test-plan.md:176`).
- No change to the file format: `serializeProject` and `parseProjectFile` (`src/lib/services/project-file.ts`), the golden files in `src/lib/services/golden/` and `PROJECT_FILE_VERSION` stay as they are. The rule only calls `serializeProject`; it never edits it.
- No change to any other domain module in `src/lib/services/`.
- No edit to S-05's area (`critical-path-highlight`, implemented in parallel): `src/lib/services/forecast.ts`, `src/components/planner/diagram/`, `src/components/planner/ForecastSummary.tsx`.

## Implementation Approach

The rule is "the project's file text differs from the baseline's file text". The baseline is the last project that was exported, imported or started new, and initially the project the planner opened with (so a fresh page, the dev fixtures and the kitchen-sink fixtures are clean). A rename and back is therefore clean; a Task created and deleted, or a Day counting switch, is a change, because the file would differ. The hook owns the baseline and answers `hasUnexportedChanges()` on demand in event handlers, so no render pays for serialization. A small native-`<dialog>` primitive in `src/components/ui/` asks the question in both the header and the fallback; the browser supplies modality, the focus trap and Escape, and nothing is injected, so the CSP holds.

## Critical Implementation Details

- **Parallel change S-05:** `critical-path-highlight` is implemented at the same time, so keep the overlap with it small. S-08's work stays in `ProjectControls.tsx`, `RenderCrashFallback.tsx`, the new `src/components/ui/confirm-dialog.tsx` and a small "exported" marker in `useProject.ts`. S-05's work stays in the forecast service, the diagram and `ForecastSummary.tsx`. The two shared files get additive edits only. In `src/hooks/useProject.ts` that means one baseline ref, two `useCallback` actions, one line in `replaceProject`, the interface and return-object entries and their doc comments. In `src/components/planner/Planner.tsx` it means passing two values to `ProjectControls` and two to `RenderCrashFallback`. Do not reorder, rename or reformat surrounding code in either file. In `src/styles/global.css`, add the `--overlay` token as its own lines next to `--canvas-pattern`, and touch nothing else. New tests go in their own `describe` blocks at the end of existing test files, or in new files.
- **State sequencing:** `hasUnexportedChanges()` must read the `latest` ref, never the rendered `project`: clicking New first blurs the name field, whose commit lands in the same event, and that pending name must count. If `serializeProject` throws on either side (a crashed project too malformed to serialize, as `logRenderCrash` already guards), report unexported changes, so the dialog asks rather than discarding silently.
- **Native dialog lifecycle:** mount the `<dialog>` only while open and call `showModal()` on mount. Escape fires `cancel` and would close the element behind React's back, so `cancel` calls `preventDefault()` and `onCancel`; treat an unexpected `close` event as a cancel too (Chromium may force-close on a repeated Escape). Tailwind's preflight sets `margin: 0` on every element, which un-centres a modal dialog: restore it with `m-auto`.
- **User experience spec:** Cancel is focused when the dialog opens. After Cancel or Escape, focus returns to the button that started the action (New project, Import, Go back); do not rely on the browser's focus restoration, since the dialog is unmounted rather than closed and the Import button may not hold focus after the file picker. After a confirmed replacement, focus goes where it goes today: New Task (`handleReplaceProject`, and the `focusNewTaskOnMount` effect after Go back).

## Phase 1: Unexported-changes rule in the state hook

### Overview

`useProject` keeps an export baseline and answers whether the current project has unexported changes; Import and New reset the baseline through `replaceProject`, and an export resets it through a new action.

### Changes Required:

#### 1. Baseline and query in `useProject`

**File**: `src/hooks/useProject.ts`

**Intent**: Track the baseline project in a ref, initialised to the initial project. `replaceProject` sets it to the replacement; `restorePreviousProject` and accepted edits leave it alone; a new `markExported` sets it to the project that was written to a file. `hasUnexportedChanges` compares file text, short-circuiting on identity.

**Contract**: `ProjectActions` gains `hasUnexportedChanges: () => boolean` (reads `latest`; `false` when `latest === baseline`, otherwise `serializeProject(latest) !== serializeProject(baseline)`, `true` if either throws) and `markExported: (project: Project) => void`. Both are stable (`useCallback`). The baseline is a ref only, never state: nothing renders it. Update the file header comment and `replaceProject`'s doc to say it also resets the baseline. Additive only: `commit`, `apply` and the edit actions stay as they are (see Parallel change S-05).

#### 2. Hook tests

**File**: `src/hooks/useProject.test.ts`

**Intent**: A new `describe("useProject: unexported changes")` proving the rule on the real domain, per §6.2.

**Contract**: Cases: the initial project is clean; one accepted edit makes it unexported; a rejected edit does not; a rename and back is clean; create-then-delete is unexported (`nextTaskId`); a Day counting switch is unexported, and switching back is clean; `markExported(current)` makes it clean and a later edit unexported again; `replaceProject` (a parsed file, and `createEmptyProject()`) makes it clean; after `replaceProject` then `restorePreviousProject`, the restored project is unexported when it differs from the replacement and clean when it was the one last passed to `markExported`; a project that cannot be serialized reports unexported (e.g. `markExported` of a malformed project while the current one differs).

### Success Criteria:

#### Automated Verification:

- Hook tests pass: `npx vitest run src/hooks/useProject.test.ts`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 2: ConfirmDialog, New project and Import confirmation

### Overview

Add the confirmation primitive, the New project button, the Import confirmation and Export's baseline update in the header, with view tests, and update the E2E that imports over an edit.

### Changes Required:

#### 1. Confirmation primitive

**File**: `src/components/ui/confirm-dialog.tsx` (new)

**Intent**: A modal yes/no question on the native `<dialog>` element, shared by the header and the crash fallback. Hand-built in `ui/` (not via shadcn) because Radix Dialog's runtime `<style>` breaks the CSP; record that reason in the file's header comment.

**Contract**: `ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel })`. Renders nothing while `open` is false; while open renders `<dialog>` with `aria-labelledby` (title) and `aria-describedby` (description), calls `showModal()` on mount, and shows two `Button`s: "Cancel" (`variant="outline"`, focused on open) and `confirmLabel` (`variant="destructive"`). `cancel` → `preventDefault()` + `onCancel`; an unexpected `close` → `onCancel`. Styled with token roles only (`bg-card`, `text-card-foreground`, `border`, `rounded-lg`, `m-auto`), backdrop via a `backdrop:` utility on a token role.

#### 2. Backdrop token

**File**: `src/styles/global.css`

**Intent**: The dialog's backdrop needs a colour role; none exists. Add it where token values live.

**Contract**: New `--overlay` in `:root` and `.dark` (a translucent dark scrim, e.g. `oklch(0 0 0 / 50%)`), published as `--color-overlay` in `@theme inline`; used as `backdrop:bg-overlay`.

#### 3. Header controls

**File**: `src/components/planner/ProjectControls.tsx`

**Intent**: Add a "New project" button before Export. New replaces with `createEmptyProject()` at once when there are no unexported changes, otherwise opens the dialog. Import, after `parseProjectFile` accepts the file, replaces at once when there are no unexported changes, otherwise holds the parsed project and opens the dialog. Export calls `markExported` with the exported project after the download starts.

**Contract**: New props `hasUnexportedChanges` and `markExported` (types from `ProjectActions`). One pending-confirmation state, `{ kind: "new" } | { kind: "import"; fileName: string; project: CheckedProject } | null`. Copy:

- Title (both): "Discard unexported changes?"
- New: "The current project has changes that were not exported. Starting a new project discards them." Confirm: "Discard and start a new project".
- Import: "The current project has changes that were not exported. Importing <file name> replaces the project and discards them." Confirm: "Discard and import".
  Cancel clears the pending state and focuses the New project or Import button. A rejected or unreadable file never opens the dialog. Update the component doc comment.

#### 4. Planner wiring

**File**: `src/components/planner/Planner.tsx`

**Intent**: Pass the two new hook actions to `ProjectControls`; New and a confirmed Import both go through `handleReplaceProject`, so focus lands on New Task.

**Contract**: `PlannerView` destructures `hasUnexportedChanges` and `markExported` and passes them on. No keying changes and no other edit to the file (see Parallel change S-05).

#### 5. View tests

**File**: `src/components/planner/Planner.test.ts`

**Intent**: A new `describe("Planner: unexported changes are confirmed before they are replaced")` on the real `Planner` and domain.

**Contract**: In this describe only, stub `HTMLDialogElement.prototype.showModal` / `close` in `beforeAll` (setting `open`) and restore them in `afterAll`, like the React Flow shim; reuse the download stubs (lift them into a shared helper in the file). Import is driven with `fireEvent.change` on the hidden file input carrying a `File` built from `serializeProject` of a fixture. Cases:

- New on the clean fixture: no dialog, the planner shows "No Tasks yet", focus on New Task.
- After one accepted edit, New opens the dialog (role `dialog`, named "Discard unexported changes?"); Cancel removes it and leaves the Task nodes, the selection panel and the name as they were, with focus on New project; a `cancel` event (Escape) does the same; "Discard and start a new project" empties the project.
- After Export (download captured), New replaces without asking.
- After an edit, Import of a valid file opens the dialog naming the file; Cancel keeps the project; "Discard and import" shows the imported Tasks.
- After an edit, Import of a file with a Validation Error shows the alert and no dialog.
- With no edits, Import of a valid file replaces without asking.
- No dialog copy contains "invalid", "conflict" or "blocked".

#### 6. Existing E2E

**File**: `e2e/render-crash.spec.ts`

**Intent**: The test imports over the unexported "Keep me" project, which now asks first.

**Contract**: After setting the file, expect the dialog and click "Discard and import"; the rest stands. Add an assertion that Go back opens no dialog (the crashed project is the imported file, which is the baseline). Update the header comment to mention the confirmation.

### Success Criteria:

#### Automated Verification:

- View and hook tests pass: `npx vitest run src/hooks/useProject.test.ts src/components/planner/Planner.test.ts`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E passes, including the updated render-crash test: `npm run test:e2e`

#### Manual Verification:

- In `npm run build && npm run preview`: after an edit, New project and Import show a centred modal over a dimmed backdrop in light mode; the console shows no CSP violation.
- Keyboard: Tab stays inside the open dialog; Escape cancels and focus returns to the button that opened it; Cancel is focused on open.
- In the kitchen sink (`npm run dev`, `/kitchen-sink`): New project on an untouched fixture replaces without asking; after an edit it asks.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Go back confirmation on the crash fallback

### Overview

The fallback's Go back asks while the project the planner stopped on has unexported changes, and the fallback's Export moves the baseline.

### Changes Required:

#### 1. Fallback

**File**: `src/components/planner/RenderCrashFallback.tsx`

**Intent**: Go back calls `onGoBack` at once when there are no unexported changes, otherwise opens `ConfirmDialog`. Export calls `onExported(project)` after the download starts.

**Contract**: New props `hasUnexportedChanges: () => boolean` and `onExported: (project: Project) => void`. Copy: title "Discard unexported changes?"; description "The project the planner stopped on has changes that were not exported. Going back discards them. Export it first to keep them."; confirm "Discard and go back". Cancel returns focus to the Go back button. Keep the rule that this component renders nothing derived from the project beyond its serialization and `inspectCrashedProject`; the check runs only on click.

#### 2. Planner wiring

**File**: `src/components/planner/Planner.tsx`

**Intent**: Pass `state.hasUnexportedChanges` and `state.markExported` to the fallback.

**Contract**: `Planner` destructures both from `useProject`'s state; `handleGoBack` unchanged. No other edit to the file.

#### 3. Fallback tests

**File**: `src/components/planner/RenderCrashFallback.test.ts` (new)

**Intent**: Prove the fallback's confirmation. A previous project plus a render throw cannot be reached in jsdom without mocking the domain, so render `RenderCrashFallback` directly with a real (cyclic) project and a recording `onGoBack`. Use a new file so these tests don't overlap S-05's edits to `Planner.test.ts`. It follows §6.2: first line `// @vitest-environment jsdom`, `createElement`, `afterEach(cleanup)`, and its own `showModal`/`close` and download stubs. It needs no React Flow shim.

**Contract**: Cases: `hasUnexportedChanges` returning true → Go back opens the dialog; Cancel calls `onGoBack` zero times and focuses Go back; "Discard and go back" calls it once. Returning false → Go back calls `onGoBack` once with no dialog. Export calls `onExported` with the project. The existing `Planner` crash tests keep passing unchanged.

### Success Criteria:

#### Automated Verification:

- View tests pass: `npx vitest run src/components/planner/RenderCrashFallback.test.ts src/components/planner/Planner.test.ts`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- E2E still passes: `npm run test:e2e`

#### Manual Verification:

- In the kitchen sink's render-crash state, the fallback looks as before; if Go back is offered, clicking it with an unexported crashed project opens the dialog above the fallback.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 4: Built-app E2E and docs

### Overview

Prove the Import confirmation in the built app under the CSP, and record the new notion in the glossary and the project rules.

### Changes Required:

#### 1. E2E

**File**: `e2e/unexported-changes.spec.ts` (new)

**Intent**: The real `<dialog>` in Chromium, under `connect-src 'none'`, guards Import over an unexported edit.

**Contract**: Header comment in the style of the other specs (`// risk: roadmap S-08 / FR-016 …`, `// seed: e2e/seed.spec.ts`). Steps: open the planner (assert the served CSP as the other specs do), add Task "Keep me", import a valid file written in the test (one Task "Imported", a name) → dialog "Discard unexported changes?" visible and naming the file; Cancel → dialog gone, "Keep me" still on the diagram, focus on Import; import again → "Discard and import" → "Imported" shown, "Keep me" gone, focus on New Task; no console errors or page errors throughout (a CSP violation is a console error in Chromium).

#### 2. Glossary

**File**: `context/domain/glossary.md`

**Intent**: The "Unexported changes" entry says "Not built yet"; it is now built.

**Contract**: Definition: the project's file text differs from the last one exported, imported or started new; confirmed before New project, Import or Go back replaces it. Code names: `hasUnexportedChanges`, `markExported`, `ConfirmDialog`.

#### 3. Project rules

**File**: `PROJECT_RULES.md`

**Intent**: Stop the next agent from adding shadcn `alert-dialog` for a confirmation.

**Contract**: One bullet under `### UI`: confirmations use `ConfirmDialog` in `src/components/ui/confirm-dialog.tsx` (native `<dialog>`); do not add Radix Dialog or shadcn `dialog`/`alert-dialog`, whose scroll lock injects a `<style>` the CSP blocks.

### Success Criteria:

#### Automated Verification:

- New E2E passes: `npx playwright test e2e/unexported-changes.spec.ts`
- Whole E2E suite passes: `npm run test:e2e`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- File format unchanged: `git diff --exit-code main -- src/lib/services/project-file.ts src/lib/services/golden/` prints nothing
- S-05's area untouched: `git diff --exit-code main -- src/lib/services/forecast.ts src/components/planner/diagram/ src/components/planner/ForecastSummary.tsx` prints nothing

#### Manual Verification:

- The PRD's FR-016 flow on `npm run preview`: build a project, click New project, confirm the prompt, see an empty project; export a project, click New project, see no prompt.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `useProject` rule table (Phase 1): baseline moves on export, import and New, stays on Go back; file-text equality cases (rename and back, create-then-delete, Day counting); serialization failure counts as unexported; a rejected edit leaves it unchanged.

### Integration Tests:

- jsdom `Planner` (Phase 2): New and Import ask only over unexported changes; Cancel and Escape change nothing and return focus; Discard replaces and focuses New Task; Export clears the need to ask; a rejected file never asks.
- jsdom `RenderCrashFallback` in its own test file (Phase 3): Go back asks only over unexported changes.
- Playwright (Phases 2 and 4): Import confirmation in the built app under the CSP; render-crash recovery through the confirmation.

### Manual Testing Steps:

1. `npm run build && npm run preview`; add two Tasks; click New project; Cancel; the Tasks remain and focus is on New project.
2. Click New project again; "Discard and start a new project"; the planner shows "No Tasks yet" and focus is on New Task.
3. Name the project, Export, then click New project: no prompt.
4. Add a Task, Import a valid file: the prompt names the file; press Escape: nothing changed; Import again and confirm.
5. Check the console: no CSP violation; check the dialog with Tab and Shift+Tab.

## Performance Considerations

`hasUnexportedChanges` serializes two projects only when New, Import or Go back is clicked, and returns at once when the project is the baseline itself; a 100-Task file is 15–100 KB, so the cost is negligible and nothing is added to rendering.

## Migration Notes

None: no file-format or stored-data change.

## References

- PRD: `context/foundation/prd.md:144-145` (FR-016), `:65` (no silent data loss)
- Roadmap: `context/foundation/roadmap.md` S-08
- Domain: `context/domain/01-domain-distillation.md` INV-22, RK-04, Q-07; `context/domain/glossary.md` "Unexported changes"
- Deferrals: `context/archive/2026-10-11-project-file-round-trip/plan.md:56`; `context/archive/2026-10-13-render-crash-recovery/reviews/impl-review.md:85-91`; `context/archive/2026-10-13-weekdays-day-counting/plan.md:64`
- Test patterns: `context/foundation/test-plan.md` §6.2
- Code: `src/hooks/useProject.ts:66-143`, `src/components/planner/ProjectControls.tsx:84-134`, `src/components/planner/Planner.tsx:59-90,182-189`, `src/components/planner/RenderCrashFallback.tsx:47-93`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Unexported-changes rule in the state hook

#### Automated

- [x] 1.1 Hook tests pass: `npx vitest run src/hooks/useProject.test.ts` — 2d02434
- [x] 1.2 Type check passes: `npx astro check` — 2d02434
- [x] 1.3 Lint passes: `npm run lint` — 2d02434

### Phase 2: ConfirmDialog, New project and Import confirmation

#### Automated

- [x] 2.1 View and hook tests pass: `npx vitest run src/hooks/useProject.test.ts src/components/planner/Planner.test.ts` — 9ce43a9
- [x] 2.2 Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` — 9ce43a9
- [x] 2.3 E2E passes, including the updated render-crash test: `npm run test:e2e` — 9ce43a9

#### Manual

- [x] 2.4 In `npm run build && npm run preview`: after an edit, New project and Import show a centred modal over a dimmed backdrop in light mode; the console shows no CSP violation. — 9ce43a9
- [x] 2.5 Keyboard: Tab stays inside the open dialog; Escape cancels and focus returns to the button that opened it; Cancel is focused on open. — 9ce43a9
- [x] 2.6 In the kitchen sink (`npm run dev`, `/kitchen-sink`): New project on an untouched fixture replaces without asking; after an edit it asks. — 9ce43a9

### Phase 3: Go back confirmation on the crash fallback

#### Automated

- [x] 3.1 View tests pass: `npx vitest run src/components/planner/RenderCrashFallback.test.ts src/components/planner/Planner.test.ts` — 4d85e31
- [x] 3.2 Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` — 4d85e31
- [x] 3.3 E2E still passes: `npm run test:e2e` — 4d85e31

#### Manual

- [x] 3.4 In the kitchen sink's render-crash state, the fallback looks as before; if Go back is offered, clicking it with an unexported crashed project opens the dialog above the fallback. — 4d85e31

### Phase 4: Built-app E2E and docs

#### Automated

- [x] 4.1 New E2E passes: `npx playwright test e2e/unexported-changes.spec.ts` — 871431d
- [x] 4.2 Whole E2E suite passes: `npm run test:e2e` — 871431d
- [x] 4.3 Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` — 871431d
- [x] 4.4 File format unchanged: `git diff --exit-code main -- src/lib/services/project-file.ts src/lib/services/golden/` prints nothing — 871431d
- [x] 4.5 S-05's area untouched: `git diff --exit-code main -- src/lib/services/forecast.ts src/components/planner/diagram/ src/components/planner/ForecastSummary.tsx` prints nothing — 871431d

#### Manual

- [x] 4.6 The PRD's FR-016 flow on `npm run preview`: build a project, click New project, confirm the prompt, see an empty project; export a project, click New project, see no prompt. — 871431d
