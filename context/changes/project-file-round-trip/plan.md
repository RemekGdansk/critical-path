# Project File Round-Trip Implementation Plan

## Overview

Roadmap slice S-03 (north star): the user can set the project name (FR-007), export the project to a human-readable JSON file named after it, being asked for a name if none is set (FR-013), and import that file in another browser to get exactly the same project back (FR-014, US-03). A file containing a Validation Error is rejected with an error naming the rule, and the current project stays unchanged. A file with only Validation Warnings imports and shows them. The exported file is the MVP's only persistence, so this slice also fixes the file contract that S-06 and S-07 fill in.

## Current State Analysis

- The model already holds every US-03 field (`src/types.ts:37-48`), but nothing sets or reads `Project.name` yet. "Unset" means an absent key, never `undefined` (`project.ts:169-172,183-187`).
- There is no whole-project validator. The PRD rules live inside the per-edit functions:
  - `checkTaskName` is private (`project.ts:66`);
  - `pathLabel` is private (`project.ts:49`);
  - `isPositiveWholeDays` (`project.ts:153`), `isIsoDate` (`calendar-date.ts:46`) and `findCycle` (`task-graph.ts:84`) are exported for this slice.

  Follow-up F1 (`context/archive/2026-09-27-capture-task-graph/follow-ups/review-fixes.md:7-13`) asks for one shared check; S-02 delivered only the cycle part.

- The domain code trusts the `Project` type. A malformed project blanks the planner, because `forecast` runs in `useMemo` during render (`Planner.tsx:53`) and no error boundary exists:
  - `topologicalOrder` throws on a cycle or duplicate ids (`task-graph.ts:178`);
  - `addDays` throws on a malformed START date (`calendar-date.ts:55-56`).

  The S-04 review chose to "validate on import" (`context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:29-51`, Fix A).

- `useProject` commits edits only through `apply` and the `latest` ref (`useProject.ts:43-52`). It has no action that sets the project name or replaces the whole project.
- The header (`Planner.tsx:93-96`) holds `NewTaskForm` and `ForecastSummary`. Edit errors render as `<p role="alert" className="text-destructive text-sm">` under the field (`NewTaskForm.tsx:55-59`).
- The CSP (`astro.config.mjs`) has `connect-src 'none'`, `form-action 'none'` and a hash-only `style-src`:
  - Reading a file with `<input type="file">` plus `File.text()` needs no allowance.
  - Saving with a top-level blob `<a download>` works in Chromium and Firefox. Safari is unverified (research, "Browser file I/O").
  - shadcn/Radix Dialog would inject a `<style>` element that the CSP blocks.
- Lint-staged runs `prettier --write` on every staged `*.json` (`package.json` `lint-staged`), and there is no `.prettierignore`.

## Desired End State

- The header has a "Project name" field and Export and Import buttons.
- **Export** downloads `<sanitised name>.json` in the version-0.1 format. With no name set, Export focuses the name field and asks for one inline.
- **Importing an exported file** in another browser yields a project that is `toStrictEqual` to the original: Tasks, ids, order, predecessors, Durations, Statuses, START date, project name, day-counting mode and `nextTaskId`. Exporting it again gives byte-identical text.
- **A file with a Validation Error**, malformed JSON, an unknown key, a newer version, duplicate Task ids, `weekdays`, or a Status other than `to-do` is rejected. The rejection is an inline alert naming the rule and, where there is one, the Task. The current project and planner are untouched.
- **Verification:**
  - Vitest: a hand-written golden file, the round-trip, and one rejection row per Validation Error.
  - Playwright on Chromium against the preview build, with the CSP in effect.
  - A manual download check in Firefox and Safari.

### Key Discoveries:

- `findCycle` returns a closed path rotated to its lowest id and ignores dangling ids (`task-graph.ts:80-117`). Unknown ids must therefore be checked separately, before the cycle check.
- `checkTaskName` assumes a trimmed string and throws on a non-string at `isWellFormed` (`project.ts:66-76`). So the shape check comes first, then trimming, then the name rules.
- A string `nextTaskId` makes `createTask` produce `"3" + 1 = "31"` (`project.ts:91`). A `null` Duration bypasses the warning check `duration === undefined` (`validation-warnings.ts:19`). Both are reasons the shape check is strict about types.
- `TaskPanel` is keyed by Task id (`Planner.tsx:120`), and the selection survives edits (`useProject.ts:38-40`). Without a reset after import, a stored id would resolve to an unrelated Task that happens to share the id.
- `Diagram` refits only when the list of Task ids changes (`Diagram.tsx:53-58`). Importing a project with the same ids would not refit.
- The test oracle rule: expected values come from the PRD or a hand-written fixture, never from the code under test (`test-plan.md:17`). The test-plan responses to risks #1–#3 (`test-plan.md:39-41`) are adopted here.

## What We're NOT Doing

- **YAML, or any format library.** Reading uses `JSON.parse`; writing uses an own serializer. No new dependency.
- **Done rules.** S-07 owns them. Until then, import rejects any Status other than `to-do` and any `completionDate`.
- **The weekdays mode.** S-06 owns it. Import rejects `"weekdays"` until then.
- **A confirmation before Import replaces a project with unexported changes.** S-08 adds it alongside New Project. The roadmap S-08 entry is updated to say so.
- **An error boundary** (S-04 review, Fix B). Import validates fully before committing, which is the adopted Fix A.
- **Detecting duplicate JSON keys.** `JSON.parse` lets the last value win. This is an accepted residual risk.
- **Our own JSON syntax-error locator.** The engine's message is passed through as is. Safari's message has no line number.
- **The File System Access API** (`showSaveFilePicker` / `showOpenFilePicker`), which is Chromium-only.
- **Persisting unsaved work across a refresh** (FR-015, parked).
- **Filling `test-plan.md` §6.3.** Test-plan Phase 3 locks in the contract after this slice merges.
- **Bumping the file version during M-1.** The version stays `"0.1"` through S-06 and S-07, and becomes `"1"` when the M-1 milestone closes.

## Implementation Approach

We go test-first, from the domain outwards:

1. Phase 1 adds the project-name edit and the shared whole-project validator next to the existing edit rules. Edits and import then enforce one set of rules.
2. Phase 2 builds the file contract as pure functions with a committed golden file.
3. Phase 3 wires it into the planner: hook actions, a download helper and a header control group.
4. Phase 4 adds a browser-level check for the one risk no unit test can reach, a download under `connect-src 'none'` in the built app.

Import runs a pipeline of stages, and each stage may assume the previous one passed:

| Stage          | What it does                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| 1. Parse       | `JSON.parse` the text.                                                                                   |
| 2. Version     | Check the version gate.                                                                                  |
| 3. Shape       | Strict shape and types: required keys, no unknown keys, the right JSON types, positive safe-integer ids. |
| 4. Normalise   | Lossless fixes: sort and dedupe predecessors, trim names, order Tasks by id, raise `nextTaskId`.         |
| 5. Unique ids  | Reject two Tasks that share an id.                                                                       |
| 6. Pre-S-06/07 | Reject `weekdays`, any Status other than `to-do`, and any `completionDate`.                              |
| 7. Validate    | Run `validateProject`, the PRD Validation Errors.                                                        |

Only a project that passes every stage is committed.

## Critical Implementation Details

**State sequencing — Export commits the name first.** Export first calls `setProjectName(draft)` and then exports the project that call returns. That return value is the hook's latest committed project. So typing a name and clicking Export works in one click, and Export never reads a stale render's project. If the commit is rejected, its error is shown and nothing downloads. If the name is still unset, the field is focused and "Name the project to export it." is shown.

**User experience spec — what Import resets.** A successful import:

- sets the selection to `null`, which unmounts `TaskPanel` and `StartPanel` and drops their drafts;
- clears `focusRequest`;
- increments the hook's replacement counter. `ProjectControls` is keyed by this counter, so its name draft shows the imported name, and `Diagram` refits on it.

The file input's value is reset after every pick, so the same file can be picked again.

**Ordering — when the START/FINISH Validation Errors are detected.** The model cannot hold either error, so the shape stage catches the spellings a hand edit would use: a `"FINISH"` entry in a predecessors list, and a `predecessors` key on `start`. A `"START"` entry is rejected as "not a Task id"; its message explains that a Task without predecessors already depends on START. All three are checked before the generic "unknown key" or "not a Task id" errors.

## Phase 1: Domain rules: project name and whole-project validation

### Overview

Add the project-name edit and `validateProject`, the single whole-project check for every PRD Validation Error the model can hold. Add the two START/FINISH rules to the rule type, and add the project-name rules to the PRD.

### Changes Required:

#### 1. Shared name rules and the project-name edit

**File**: `src/lib/services/project.ts`

**Intent**: Generalise `checkTaskName` so that Task names and the project name share the same four rules, each worded for its subject. Add `setProjectName`. An empty trimmed input clears the name, matching how `setStartDate` and `setDuration` treat "unset".

**Contract**:

- `ValidationErrorRule` gains `"project-name-empty"`, `"project-name-too-long"`, `"project-name-malformed"`, `"project-name-control-character"`, `"start-has-predecessor"` and `"task-depends-on-finish"`.
- `export const PROJECT_NAME_MAX_LENGTH = TASK_NAME_MAX_LENGTH`.
- `export function setProjectName(project: Project, input: string): EditResult`: an empty trimmed input deletes the `name` key, and anything else is checked by the name rules. A name made only of invisible characters is rejected as `project-name-empty` ("A project name cannot be empty.").
- The Task-name messages stay byte-identical, except `task-name-malformed`, now "A Task name must be well-formed Unicode." to match the PRD wording (impl-review F1).

#### 2. Whole-project validation

**File**: `src/lib/services/project.ts`

**Intent**: One exported check of every PRD Validation Error a well-typed in-memory project can hold, for import now and for S-06 and S-07 to extend (F1). Messages are phrased for a project that already holds the error, not for an edit that would create it.

**Contract**:

- `export function validateProject(project: Project): ValidationError | undefined`. It returns the first error, checked in this order:
  1. each Task in array order: its name (the Task-name rules, on a name that is already trimmed), its Duration when present (`isPositiveWholeDays`), and each predecessor id exists, else `unknown-task` "Task 3: Build depends on Task 9, which is not in the project.";
  2. the START date when present (`isIsoDate`, the same message as `setStartDate`);
  3. the project name when present;
  4. the cycle: `findCycle`, then `cycle` "The project contains the cycle 1: A → 2: B → 1: A."
- Task-specific messages are prefixed with `taskLabel(task)`, e.g. "Task 3: Build: A Duration must be a positive whole number of days." The four Task-name rules are the exception: they are prefixed with the id only, e.g. "Task 3: A Task name cannot be empty.", because the label would repeat the rejected name (empty, multi-line, malformed or over-long) inside the alert.
- It assumes the model invariants (unique ascending ids, sorted and unique predecessors). Establishing them is import's job in Phase 2.

#### 3. Tests

**File**: `src/lib/services/project.test.ts`

**Intent**: Cover `setProjectName` (set, trim, clear, each rule, frozen input unchanged via the existing `edit` helper) and `validateProject`. The `validateProject` tests have one hand-built invalid project per rule, each asserting the rule and that the message names the Task (by id alone for the Task-name rules). Also:

- `createPerfProject()` and every edit-built fixture pass;
- a self-predecessor reports the cycle `[a, a]` labelled.

**Contract**: Expected messages and rules are literals from the PRD wording, never computed by production helpers.

#### 4. PRD: project-name rules

**File**: `context/foundation/prd.md`

**Intent**: Record the decision that the project name follows the Task-name rules. This keeps the Validation Error list (Business Logic, line 194) the single source of truth.

**Contract**: The Validation Errors sentence gains "a project name that is only invisible characters, longer than 200 characters, not well-formed Unicode, or containing a line break or other control character". The FR-007 wording is unchanged.

### Success Criteria:

#### Automated Verification:

- Project edit and validation tests pass: `npx vitest run src/lib/services/project.test.ts`
- Full unit suite passes: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification:

- Every `validateProject` message reads as one domain-term sentence and uses "Validation Error" vocabulary consistently with the PRD

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Project file format 0.1

### Overview

Pure functions for the file contract: serialize, parse and validate, and the file name. Plus a hand-written golden file as the oracle and a rejection table with one row per Validation Error.

### Changes Required:

#### 1. File contract module

**File**: `src/lib/services/project-file.ts` (new)

**Intent**: The only place that knows the file format. Export writes deterministic, Prettier-stable JSON whose every byte the app controls. Import runs the staged pipeline from the Implementation Approach and returns either a project that satisfies every model invariant and `validateProject`, or the first error.

**Contract**:

- `export const PROJECT_FILE_VERSION = "0.1"`.
- `export function serializeProject(project: Project): string`.
  - Fixed key order: `version`, `name`?, `start` (`date`?), `finish`, `dayCountingMode`, `nextTaskId`, `tasks`. Each Task is `id`, `name`, `predecessors`, `duration`?, `status`, `completionDate`?.
  - Absent stays absent.
  - Two-space indentation, one key per line, each `predecessors` array on one line in Prettier style (`[]`, `[1, 3]`).
  - LF line endings and one trailing newline.
  - Non-ASCII characters are written as is (UTF-8).
- `export function parseProjectFile(text: string): ImportResult`, where `ImportResult = { ok: true; project: Project } | { ok: false; error: ImportError }`, `ImportError = { rule: ValidationErrorRule | ProjectFileRule; message: string }` and `ProjectFileRule = "file-not-json" | "file-not-a-project" | "file-version-newer" | "duplicate-task-id" | "day-counting-mode-not-supported-yet" | "task-status-not-supported-yet"`.
- **Parse and version rules:**
  - Text `JSON.parse` cannot read is rejected as `file-not-json`: "The file is not valid JSON: <engine message>".
  - Only the exact string `"0.1"` is accepted. A well-formed `major.minor` (digits only, compared as integers) greater than 0.1 is rejected as `file-version-newer`, naming both versions. Anything else is rejected as `file-not-a-project`: a missing or non-string version, a malformed one, a lower one (`"0.0"`), or a non-canonical spelling of 0.1 (`"00.1"`, `"0.01"`).
- **Shape rules** (`file-not-a-project`, with a JSON path such as `tasks[2].duration`):
  - All keys are required except `name`, `start.date`, `duration` and `completionDate`.
  - Unknown keys are rejected.
  - Types are strict: `null` is never accepted, and ids and `nextTaskId` must be positive safe integers.
  - The START/FINISH spellings are detected as described in Critical Implementation Details.
- **Normalisation (lossless):**
  - predecessors are sorted ascending and deduplicated;
  - names are trimmed;
  - a project name that is empty after trimming (`""`, `"   "`) becomes absent;
  - Tasks are ordered by id;
  - `nextTaskId` is raised to max id + 1 when it is lower.
- **Later stages:**
  - Duplicate ids are rejected as `duplicate-task-id`: "Two Tasks have the id 3."
  - `"weekdays"` is rejected as `day-counting-mode-not-supported-yet`.
  - A Status other than `to-do`, or a `completionDate`, is rejected as `task-status-not-supported-yet`, naming the Task.
  - Then `validateProject` runs.
- `export function projectFileName(name: string): string`: each of `/ \ : * ? " < > |` is replaced with `-`, then `.json` is appended. Example: `"Q3: Launch / EU"` → `"Q3- Launch - EU.json"`.

The 0.1 shape (also the shape of the golden file):

```json
{
  "version": "0.1",
  "name": "Website relaunch",
  "start": {
    "date": "2026-11-02"
  },
  "finish": {},
  "dayCountingMode": "calendar-days",
  "nextTaskId": 6,
  "tasks": [
    {
      "id": 1,
      "name": "Design",
      "predecessors": [],
      "duration": 3,
      "status": "to-do"
    },
    {
      "id": 2,
      "name": "Build",
      "predecessors": [1, 3],
      "duration": 5,
      "status": "to-do"
    }
  ]
}
```

#### 2. Golden file

**File**: `src/lib/services/golden/project-file-0.1.json` (new); `.prettierignore` (new)

**Intent**: The oracle for test-plan risks #1 and #2. It is written by hand, never regenerated from the exporter, and is the file every later app version must still import. It is excluded from Prettier so that lint-staged never rewrites its bytes.

**Contract**:

- The golden file covers:
  - a project name with non-ASCII characters (e.g. "Relaunch – QA ✓");
  - a START date;
  - a Task with two predecessors;
  - a Task without a Duration (Validation Warning);
  - a gap in the ids from a deleted Task, with `nextTaskId` greater than max id + 1.
- `.prettierignore` contains `src/lib/services/golden/`.

#### 3. Tests

**File**: `src/lib/services/project-file.test.ts` (new)

**Intent**: Lock in the contract with PRD and hand-written oracles.

**Contract**: The tests are:

1. **Golden.** The golden file, read as raw text, parses to a hand-written `Project` literal (`toStrictEqual`), and `serializeProject` of that literal reproduces it byte for byte.
2. **Round-trip.** For edit-built projects covering every US-03 field, `parseProjectFile(serializeProject(p))` is `toStrictEqual(p)`. A double export is byte-identical. `createTask` after import mints `nextTaskId`, never a reused id. Covered cases:
   - a name with emoji or surrogate pairs;
   - a 200-character name;
   - a cleared Duration;
   - no START date;
   - `createPerfProject()`.
3. **Warnings survive** (US-03 AC2). An imported file with a missing Duration yields the same `validationWarnings` as before export.
4. **Rejection table, one row per rule.** For each row the test asserts the rule and a message fragment (the Task label where relevant), and that `forecast(project, today)` does not throw for any accepted result. The rows:
   - the PRD Validation Errors: cycle, self-predecessor, START with a predecessor, Task depending on FINISH, unknown id, each of the four Task-name rules (lone surrogate via `\ud800`, line break via `\n`), Duration 0 / −1 / 1.5, START date `2027-02-30`, each project-name rule;
   - the file rules: not JSON, a JSON array, a missing version, version `"0.2"` and `"1"` (newer), version `"0.0"` and `"00.1"` (not a project), an unknown key, `null` Duration, a string id, a string `nextTaskId`, duplicate ids, `weekdays`, `in-progress`, `done`, `completionDate`.
5. **Normalisation rows.** These are accepted and normalised: unsorted predecessors, duplicate predecessors, an untrimmed name, Tasks out of order, a low `nextTaskId`, `"name": ""` and `"name": "   "`.
6. **`projectFileName`.** Every reserved character, plus a name with none.

#### 4. Roadmap notes

**File**: `context/foundation/roadmap.md`

**Intent**: Record the decisions made here that later slices inherit.

**Contract**:

- S-03: its Unknown is resolved (JSON, own serializer, `"version": "0.1"`).
- S-06 and S-07 Risk lines: lift the import rejection of `weekdays` and of non-`to-do` Statuses; the version stays `"0.1"` until M-1 closes, then becomes `"1"`; add a golden file for each.
- S-08 Outcome: the unexported-changes confirmation also applies before Import replaces the project.
- Only the item text changes, never the Status cells.

### Success Criteria:

#### Automated Verification:

- File contract tests pass: `npx vitest run src/lib/services/project-file.test.ts`
- Prettier leaves the golden file untouched: `npx prettier --write src/lib/services/golden/ && git diff --exit-code src/lib/services/golden/`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- No new dependency from the file format: `git diff main -- package.json` shows no added dependency (Phase 4 later adds `@playwright/test`, the only one in this slice)

#### Manual Verification:

- Stryker on the module (`npm run test:mutation -- --mutate "src/lib/services/project-file.ts"`): each surviving mutant is killed with an assertion or noted as not user-visible
- The golden file reads cleanly by hand and matches the 0.1 shape above

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Planner UI: name, Export and Import

### Overview

Hook actions, a CSP-safe download helper, and a header control group, wired into the planner.

### Changes Required:

#### 1. Hook actions

**File**: `src/hooks/useProject.ts`

**Intent**: Let the planner set the name and replace the whole project, committing through the `latest` ref like every other action.

**Contract**:

- `ProjectActions` gains `setProjectName: (input: string) => EditResult` and `replaceProject: (project: Project) => void`.
- `replaceProject` sets `latest.current`, the project, the selection (`null`), and increments `replacements: number`, which `ProjectState` exposes.
- `replaceProject` takes only a project that `parseProjectFile` accepted. The hook does not validate again.

#### 2. Download helper

**File**: `src/lib/download.ts` (new)

**Intent**: Save text as a file without a network request, so it works under `connect-src 'none'` with no CSP change.

**Contract**: `export function downloadTextFile(fileName: string, text: string, mimeType: string): void`. It creates a Blob and an object URL, clicks a temporary top-level `<a download>`, removes it, and revokes the URL on the next task (`setTimeout`), not synchronously. It never uses `fetch`, and `blob:` is never added to the CSP.

#### 3. Header controls

**File**: `src/components/planner/ProjectControls.tsx` (new)

**Intent**: The project name field plus Export and Import, built from the `Input`, `Label` and `Button` components already in `src/components/ui/`, with the existing inline-error pattern.

**Contract**:

- **Name field.** "Project name" `Input` with `maxLength={PROJECT_NAME_MAX_LENGTH}`. A draft commits on Enter or blur, and Escape restores the committed name. A rule error appears under the field with `aria-invalid` and `aria-describedby`.
- **Export.** Behaves as described in Critical Implementation Details, calling `downloadTextFile(projectFileName(name), serializeProject(project), "application/json")`.
- **Import.**
  - The Import `Button` opens a hidden `<input type="file" accept=".json,application/json">`.
  - On a pick, the file is read with `File.text()` and passed to `parseProjectFile`.
  - On success: `replaceProject`, and the alert is cleared.
  - On rejection: `<p role="alert">` "<file name> was not imported. <message>".
  - A read failure shows "<file name> could not be read."
  - All errors are cleared by the next successful Export or Import.
- **Styling.** Only token classes, no literal colours (enforced by lint in `src/components/planner/`).

#### 4. Planner wiring

**File**: `src/components/planner/Planner.tsx`, `src/components/planner/Diagram.tsx`

**Intent**: Place the controls in the header and reset the view on import.

**Contract**:

- The header renders `NewTaskForm`, `ProjectControls` and `ForecastSummary`.
- Import also clears `focusRequest`.
- `<ProjectControls key={replacements}>`: the whole group, so the name draft and Export stay in one component. A successful import clears its alert anyway.
- `Diagram` takes a `fitKey` (`replacements`) and refits when either the Task-id key or `fitKey` changes.

#### 5. Kitchen sink

**File**: `src/dev/KitchenSinkPlanner.tsx`

**Intent**: Show a named project in the header cells.

**Contract**: `smallProject()` sets the name "Website relaunch" through `setProjectName`. The `empty` fixture stays unnamed.

### Success Criteria:

#### Automated Verification:

- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- The CSP in the built HTML is unchanged: `npm run check:csp` passes and `git diff main -- astro.config.mjs` is empty

#### Manual Verification:

- Kitchen sink (`npm run dev`, `/kitchen-sink`): header fits without overlap in every cell; named and unnamed states read correctly
- Under `npm run preview` in Chrome: export a named project with a START date, Durations and a missing Duration; import it in a different browser profile, which shows the same Tasks, predecessors, Durations, warning, START date, name and both Project Finish Dates
- Under `npm run preview` in Firefox and Safari: Export downloads `<name>.json` with no CSP violation in the console
- Unnamed Export focuses the name field and asks; typing a name and clicking Export downloads in one click
- Importing a hand-edited file with a cycle shows the alert naming the cycle; the previous project and the open panel are unchanged
- After a successful import the side panel shows nothing selected and the diagram fits the imported project
- Keyboard only: name field, Export and Import are reachable and operable; the alert is announced

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Browser-level export and import (E2E, Chromium)

### Overview

Set up Playwright once, then cover the risk no unit test reaches: the download and import running in the built app with the CSP in effect.

### Changes Required:

#### 1. Playwright setup

**File**: `playwright.config.ts`, `e2e/` and `context/foundation/test-stack.md` (all created by `/10x-e2e-setup`)

**Intent**: Run `/10x-e2e-setup`. It sets up a `webServer` on `npm run build` + `npm run preview`, the only mode where the CSP is in effect, plus a green seed test and the test-stack record.

**Contract**:

- One desktop browser, Chromium (`test-plan.md` §7).
- No auth: the app has none.
- `@playwright/test` is the one devDependency this slice adds; no runtime dependency changes.
- The e2e row of `test-plan.md` §3 (currently "none / Not planned") is updated to name this suite and the risk it covers, unless `/10x-e2e-setup` already did.
- `test-stack.md` records whether the suite joins `ci.yml`. It never joins the Cloudflare Workers Builds command.
- E2E files stay outside `src/`, so neither the Tailwind scan nor Vitest discovers them.

#### 2. Export and import tests

**File**: `e2e/project-file.spec.ts` (new; generated and reviewed through `/10x-e2e`)

**Intent**: Three tests, each standalone with unique names (timestamp suffix):

1. **Export.** Export downloads a file whose suggested name is `<project name>.json` and whose content holds the Tasks, with no console error and no CSP violation.
2. **Import.** Within the one test: build a project and export it in browser context A, then import the downloaded file in a new context B, which shows the same name, Tasks and both Project Finish Dates. It never reads a file left by test 1.
3. **Rejected import.** Importing a hand-made cycle file shows an alert naming the cycle, and the existing Task stays on the diagram.

**Contract**:

- Locators are `getByRole`, `getByLabel` and `getByText`.
- Waits are on state (`waitForEvent("download")`, `toBeVisible`), never `waitForTimeout`.
- Each test is reviewed against the five anti-patterns and proven by a deliberate break.

### Success Criteria:

#### Automated Verification:

- E2E suite passes: `npx playwright test`
- Unit gate still passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual Verification:

- Each E2E test was seen red on a deliberate break (e.g. the download anchor removed, a cycle file accepted) and green again after reverting
- Generated tests were reviewed against the five anti-patterns from `/10x-e2e`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `project.test.ts`: `setProjectName` and its rules; `validateProject` with one invalid project per rule; every edit-built fixture passes.
- `project-file.test.ts`:
  - the golden file, both directions;
  - the exact round-trip and a byte-identical double export;
  - no id reuse after import;
  - warnings preserved;
  - the rejection table, one row per Validation Error and per file rule, asserting that the forecast does not throw for accepted rows;
  - the normalisation rows;
  - `projectFileName`.

### Integration Tests:

- Playwright on Chromium against the preview build: the export download, an import in a fresh context, and the rejected import.

### Manual Testing Steps:

1. `npm run build && npm run preview`. Build a project with a name, START date, Durations and one missing Duration, then Export.
2. Open the preview in another browser or profile and Import the file. Check every US-03 field and both Project Finish Dates.
3. Export the same project from Firefox and from Safari. Check the file name and that the console shows no CSP violation.
4. Hand-edit the file to add a cycle, then Import. The alert names the cycle, and the project is unchanged.
5. Clear the name and Export. The name field is focused and asks for a name.

## Performance Considerations

- Import of a 100-Task file is linear: a single parse, a sort, and the iterative `findCycle`, which is well within the 200 ms NFR.
- The serializer is a single pass.
- The bundle grows only by the module's own code, with no dependency added.

## Migration Notes

None. No file format existed before 0.1. Every later app version must import the committed 0.1 golden file (test-plan risk #1), and the version stays `"0.1"` until M-1 closes.

## References

- Research: `context/changes/project-file-round-trip/research.md` (YAML vs JSON follow-up, CSP file I/O, import check inventory)
- PRD: `context/foundation/prd.md` US-03, FR-007, FR-013, FR-014, Business Logic (line 194)
- Test plan risks #1–#3: `context/foundation/test-plan.md:27-41`
- F1 whole-project validation: `context/archive/2026-09-27-capture-task-graph/follow-ups/review-fixes.md:7-13`
- Validate-on-import decision: `context/archive/2026-10-04-forecast-finish-dates/reviews/impl-review.md:29-51`
- Edit and error pattern: `src/lib/services/project.ts:20-76`, `src/components/planner/NewTaskForm.tsx:25-59`
- Draft commit pattern: `src/components/planner/StartPanel.tsx:51-73`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Domain rules: project name and whole-project validation

#### Automated

- [x] 1.1 Project edit and validation tests pass: `npx vitest run src/lib/services/project.test.ts` — e084ef8
- [x] 1.2 Full unit suite passes: `npm test` — e084ef8
- [x] 1.3 Lint passes: `npm run lint` — e084ef8
- [x] 1.4 Type check passes: `npx astro check` — e084ef8

#### Manual

- [x] 1.5 Every `validateProject` message reads as one domain-term sentence and uses "Validation Error" vocabulary consistently with the PRD — e084ef8

### Phase 2: Project file format 0.1

#### Automated

- [x] 2.1 File contract tests pass: `npx vitest run src/lib/services/project-file.test.ts`
- [x] 2.2 Prettier leaves the golden file untouched: `npx prettier --write src/lib/services/golden/ && git diff --exit-code src/lib/services/golden/`
- [x] 2.3 Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- [x] 2.4 No new dependency from the file format: `git diff main -- package.json` shows no added dependency (Phase 4 later adds `@playwright/test`, the only one in this slice)

#### Manual

- [x] 2.5 Stryker on the module (`npm run test:mutation -- --mutate "src/lib/services/project-file.ts"`): each surviving mutant is killed with an assertion or noted as not user-visible
- [x] 2.6 The golden file reads cleanly by hand and matches the 0.1 shape above

### Phase 3: Planner UI: name, Export and Import

#### Automated

- [ ] 3.1 Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- [ ] 3.2 The CSP in the built HTML is unchanged: `npm run check:csp` passes and `git diff main -- astro.config.mjs` is empty

#### Manual

- [ ] 3.3 Kitchen sink (`npm run dev`, `/kitchen-sink`): header fits without overlap in every cell; named and unnamed states read correctly
- [ ] 3.4 Under `npm run preview` in Chrome: export a named project with a START date, Durations and a missing Duration; import it in a different browser profile, which shows the same Tasks, predecessors, Durations, warning, START date, name and both Project Finish Dates
- [ ] 3.5 Under `npm run preview` in Firefox and Safari: Export downloads `<name>.json` with no CSP violation in the console
- [ ] 3.6 Unnamed Export focuses the name field and asks; typing a name and clicking Export downloads in one click
- [ ] 3.7 Importing a hand-edited file with a cycle shows the alert naming the cycle; the previous project and the open panel are unchanged
- [ ] 3.8 After a successful import the side panel shows nothing selected and the diagram fits the imported project
- [ ] 3.9 Keyboard only: name field, Export and Import are reachable and operable; the alert is announced

### Phase 4: Browser-level export and import (E2E, Chromium)

#### Automated

- [ ] 4.1 E2E suite passes: `npx playwright test`
- [ ] 4.2 Unit gate still passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`

#### Manual

- [ ] 4.3 Each E2E test was seen red on a deliberate break (e.g. the download anchor removed, a cycle file accepted) and green again after reverting
- [ ] 4.4 Generated tests were reviewed against the five anti-patterns from `/10x-e2e`
