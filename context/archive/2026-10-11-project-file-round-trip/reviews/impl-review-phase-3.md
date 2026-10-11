<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Project File Round-Trip Implementation Plan

- **Plan**: context/changes/project-file-round-trip/plan.md
- **Scope**: Phase 3 of 4
- **Reviewed phases**: 3
- **Date**: 2026-10-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence: every planned Phase 3 change (hook actions, `download.ts`, `ProjectControls`, Planner and Diagram wiring, kitchen sink) matches its contract. The one unplanned edit, `flex-wrap` and `ml-auto` in the Planner header, supports manual check 3.3 and is benign. `ProjectControls` follows the draft, blur, Escape and `role="alert"` pattern of `TaskPanel` and `NewTaskForm`. Ran `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`, exit 0, "CSP check passed: 2 page(s)". `git diff main -- astro.config.mjs` is empty.

## Findings

### F1 — Import reads a file of any size into memory

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/ProjectControls.tsx:92
- **Detail**: `handleFileChange` calls `file.text()` and then `JSON.parse` with no size check. `accept=".json,application/json"` is only a hint to the picker: a user can switch it to "All files", or pick a large JSON data dump. Reading hundreds of MB freezes or crashes the tab. With no persistence (FR-015 is parked), that loses the unexported project, which breaks the "no silent data loss" guardrail. For scale, a 100-Task file is roughly 15–100 KB.
- **Fix**: Check `file.size` against a generous cap (e.g. 5 MB) before `file.text()`, and show "<file name> was not imported. The file is larger than 5 MB." Record the cap in the plan as a Phase 3 addendum.
  - Strength: Stops the problem before any read. It is a one-branch guard in the component that already owns the I/O boundary, and the Phase 2 contract stays unchanged.
  - Tradeoff: It adds a limit the plan never named, and the cap value is a judgement call.
  - Confidence: HIGH — `File.size` is available synchronously and costs nothing.
  - Blind spot: The PRD sets no Task-count ceiling, so the cap is not checked against the largest project anyone would build.
- **Decision**: FIXED — 5 MB `file.size` guard before `file.text()`; plan Phase 3 Import contract amended

### F2 — Re-importing the same rejected file gives no visible or announced feedback

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/ProjectControls.tsx:101-104
- **Detail**: A second rejection with the same message sets `fileError` to the same string. The alert node stays mounted with unchanged text, so nothing changes on screen and screen readers do not announce it again. The user can't tell that the second attempt ran, for example after fixing the file in an editor but missing a second error.
- **Fix**: Call `setFileError(undefined)` before `await file.text()`. The alert then unmounts for one render and remounts with the new result, so it is announced again.
- **Decision**: FIXED — `setFileError(undefined)` before the read

### F3 — Manual checks 3.3–3.9 have no recorded evidence

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/project-file-round-trip/plan.md:551-557
- **Detail**: All seven manual items are ticked against c96d5aa, but the diff can only show evidence for 3.3 (the kitchen-sink name and the header wrap). The research marked Safari as unverified (plan line 27), and 3.5 is the item most likely to be fragile. `downloadTextFile` revokes the object URL with `setTimeout(0)`, and WebKit has had bugs where an early revoke cancels a blob download.
- **Fix**: Add a line under 3.5 with the Firefox and Safari versions where the download was actually observed. If Safari was not run, untick 3.5.
- **Decision**: FIXED — user confirmed Firefox and Safari downloads; noted under Progress 3.5
