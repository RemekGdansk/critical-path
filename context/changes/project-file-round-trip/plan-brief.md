# Project File Round-Trip — Plan Brief

> Full plan: `context/changes/project-file-round-trip/plan.md`
> Research: `context/changes/project-file-round-trip/research.md`

## What & Why

Roadmap slice S-03, the north star: the user names the project, exports it to a plain-text file named after it, and imports that file in another browser to get exactly the same project back. Files with a Validation Error are rejected with a clear error, and files with only Validation Warnings import and show them. The exported file is the MVP's only persistence, so until this works nothing a user builds survives the session.

## Starting Point

The model already holds every US-03 field. Nothing sets the project name yet, and nothing validates a whole project: the rules live inside the per-edit functions. The forecast runs during render and throws on a cycle or a malformed date, with no error boundary, so an unvalidated import would blank the planner.

## Desired End State

The header has a "Project name" field and Export and Import buttons. Export downloads `<name>.json` and asks inline for a name when none is set. Importing that file elsewhere gives a strictly equal project, and exporting it again gives byte-identical text. A bad file is rejected with an alert naming the rule and the Task, and the current project and planner are left untouched.

## Key Decisions Made

| Decision                 | Choice                                                                                                                 | Why (1 sentence)                                                                                             | Source        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------- |
| File format              | JSON, read with `JSON.parse`, written by an own serializer (2-space indent, predecessors on one line, fixed key order) | Zero dependencies and bytes the app controls; hand-edit typos fail to parse rather than silently change data | Research/Plan |
| Format version           | String `"version": "0.1"`, unchanged through S-06/S-07; `"1"` when M-1 closes                                          | Versions before the MVP stay 0.x, and the key set never changes, so every 0.1 file keeps importing           | Plan          |
| Absent keys              | Required unless optional (`name`, `start.date`, `duration`, `completionDate` are absent when unset)                    | A forgotten or misspelled key is caught by name and never filled with a guessed default                      | Plan          |
| Strictness               | Normalise lossless slips (predecessor order and duplicates, trimming, Task order, low `nextTaskId`); reject the rest   | Hand edits in version control work for harmless slips, while unknown keys and duplicate ids are still caught | Plan          |
| Statuses before S-07     | Reject non-`to-do` Statuses and any `completionDate`, as `weekdays` is rejected until S-06                             | S-03 cannot check the Done rules, so accepting Done data would let a project hold a Validation Error         | Plan/Research |
| START/FINISH errors      | Strict schema, plus rule-naming messages for `"FINISH"` in predecessors and for `start.predecessors`                   | FR-014 names these as rejections, and test-plan risk #3 needs one row per rule                               | Plan          |
| Project name             | Always-visible header field; same rules as Task names (empty input clears it); an unnamed Export asks inline           | No new component and no CSP-unsafe dialog; the inline-error pattern is reused                                | Plan          |
| Import over current work | A valid file replaces the project at once; S-08 adds the unexported-changes confirmation to Import as well             | Keeps the north-star slice small; choosing a file is already deliberate                                      | Plan          |
| Whole-project validation | `validateProject` in `project.ts`, shared by import and later slices                                                   | Closes follow-up F1, so import and edits use one set of rules                                                | Research/Plan |
| Error shape              | First error only; JSON path for shape errors, `taskLabel` for rule errors                                              | Matches `EditResult`; the pipeline stages assume the earlier stages passed                                   | Plan          |
| Verification             | Vitest with a hand-written golden file and a rejection table, plus Playwright on Chromium against the preview build    | The download under `connect-src 'none'` can only be checked in a browser                                     | Plan          |

## Scope

**In scope:**

- `setProjectName` and the project-name rules (also added to the PRD Validation Error list)
- `validateProject`
- `project-file.ts`: serialize, parse and validate, file name
- the golden file `0.1.json` and a `.prettierignore` entry for it
- `useProject.replaceProject`
- the download helper
- the `ProjectControls` header group
- Playwright setup and three E2E tests
- roadmap notes for S-03, S-06, S-07 and S-08

**Out of scope:**

- YAML or any format library
- the Done rules (S-07) and the weekdays mode (S-06)
- confirmation before an import (S-08)
- an error boundary
- detecting duplicate JSON keys
- a JSON syntax-error locator of our own
- the File System Access API
- FR-015 (unsaved work kept across a refresh)
- filling `test-plan.md` §6.3

## Architecture / Approach

Pure domain functions sit in `src/lib/services/`, and the hook commits only accepted results. Import is a staged pipeline:

1. `JSON.parse`;
2. the version gate;
3. a strict shape and type check (unknown keys rejected, START/FINISH spellings detected);
4. lossless normalisation;
5. a duplicate-id check;
6. rejections until S-06/S-07;
7. `validateProject`.

Only a project that passes every stage reaches `replaceProject`. That call resets the selection, the panel drafts and the diagram's fit-to-view. Export first commits the name draft, then serializes the returned project and saves it via Blob plus a top-level `<a download>`. There is no fetch and no CSP change.

## Phases at a Glance

| Phase                               | What it delivers                                                                        | Key risk                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Domain rules: name + validation  | `setProjectName`, shared name rules, `validateProject`, START/FINISH rule ids, PRD note | Rewording the shared name rules changes the Task-name messages      |
| 2. Project file format 0.1          | Serializer, staged parser, file name, golden file, rejection table, roadmap notes       | A missed shape check lets a malformed project reach the render path |
| 3. Planner UI: name, Export, Import | Hook actions, download helper, `ProjectControls`, view reset, kitchen-sink name         | Safari's blob download under the CSP is unverified; header crowding |
| 4. E2E export/import (Chromium)     | Playwright setup and three tests against the preview build                              | New tooling; tests coupled to the DOM instead of roles              |

**Prerequisites:** S-02 and S-04 are done (`findCycle`, `isIsoDate`, `isPositiveWholeDays`), and `node_modules` is in sync with `npm ci`.
**Estimated effort:** about 3–4 sessions across 4 phases. Phase 2 is the largest.

## Open Risks & Assumptions

- Safari/WebKit may block a top-level blob download under `connect-src 'none'`; there is no primary source either way. Phase 3 checks it manually. If it is blocked, the CSP needs a reviewed decision, not a quiet loosening.
- With duplicate JSON keys, the last value wins silently. This is an accepted residual risk.
- Safari's JSON parse error has no line number. The engine message is shown as is.
- Until S-08, importing over unexported work loses that work without asking.
- The app's output is Prettier-stable only while a `predecessors` line stays within 80 columns. A repo that formats `*.json` could reflow a very long list.

## Success Criteria (Summary)

- A project exported in one browser imports in another with every US-03 field, every id and `nextTaskId` identical, and the same Validation Warnings and Project Finish Dates.
- Every PRD Validation Error placed in a file by hand is rejected with a message naming the rule, and the planner never blanks.
- The committed 0.1 golden file still imports and re-exports byte for byte, protecting older files as later slices land.
