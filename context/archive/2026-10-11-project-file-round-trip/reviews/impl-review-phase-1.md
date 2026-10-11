<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Project File Round-Trip Implementation Plan

- **Plan**: context/changes/project-file-round-trip/plan.md
- **Scope**: Phase 1 of 4
- **Reviewed phases**: 1
- **Date**: 2026-10-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Automated checks re-run on 2026-10-11: `npx vitest run src/lib/services/project.test.ts` (55 passed), `npm test` (170 passed), `npm run lint` (clean), `npx astro check` (0 errors, 0 warnings, 0 hints). Manual 1.5 is checked; see F1 for the one message that does not read cleanly.

## Findings

### F1 — Task-name "malformed" message changed despite the byte-identical contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/project.ts:114
- **Detail**: The plan's Phase 1 contract says "The Task-name messages stay byte-identical". Generalising `checkTaskName` into `checkName` changed the user-visible `task-name-malformed` message from "A Task name cannot contain an incomplete character." to "A Task name cannot contain a not well-formed Unicode character." The plan does not record this change. It slipped through because the existing `createTask`/`renameTask` lone-surrogate tests (`project.test.ts:138-141,168`) assert only the rule, never the message. The new wording also reads awkwardly ("a not well-formed … character"), which the manual check 1.5 ("reads as one domain-term sentence") should have caught. The other three Task-name messages are unchanged.
- **Fix**: In `checkName`, restore `${subject} cannot contain an incomplete character.`, update the three new expectations in `project.test.ts` (lines 390, 465, 511), and add a message assertion to the existing `createTask` lone-surrogate test, so that the Task-name wording is pinned.
- **Decision**: FIXED (fixed differently) — kept PRD-aligned wording, reworded to "<subject> must be well-formed Unicode."; pinned the Task-name message in the createTask lone-surrogate test; plan Phase 1 §1 contract amended to record the change.
