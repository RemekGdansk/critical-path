<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Project File Round-Trip Implementation Plan

- **Plan**: context/changes/project-file-round-trip/plan.md
- **Scope**: Phase 2 of 4
- **Reviewed phases**: 2
- **Date**: 2026-10-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Automated checks re-run on 2026-10-11: `npx vitest run src/lib/services/project-file.test.ts` (104 passed), the Prettier golden-file gate (untouched), `npm run lint` (clean), `npx astro check` (0 errors), `npm test` (274 passed), `npm run build`, `npm run check:csp` (2 pages), `git diff main -- package.json` (empty). Manual 2.5 is evidenced by the mutation results in the 9c0c604 commit body (97.6%, survivors listed as equivalent or unreachable) and the Stryker note in PROJECT_RULES.md; manual 2.6 was confirmed by the user.

Plan drift: every Contract bullet of Phase 2 matches, nothing is missing. Extras are benign: additional rejection rows (versions "10"/"0.12"/"0.2.1", malformed shapes, ids 1.5/−1, stage-order tests), the roadmap "Open Roadmap Questions" sentence, and the user-approved Stryker note in PROJECT_RULES.md.

## Findings

### F1 — A long invisible-only name makes import throw a RangeError

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project.ts:74 (`INVISIBLE_ONLY`), reached via `validateProject` from src/lib/services/project-file.ts:357 and rethrown at :380
- **Detail**: `/^[\p{White_Space}\p{Cf}]*$/u` exhausts V8's regexp backtrack stack on a long run of matching characters. A Task or project name of 10,000,000 U+200B (not removed by `.trim()`) makes `parseProjectFile` throw `RangeError: Maximum call stack size exceeded` instead of returning `{ ok: false }`, breaking the import contract (test-plan risk #3); verified on Node 24.21.0. Reachable only through a crafted file of about 30 MB; edits are bounded by `maxLength` in the UI.
- **Fix**: Define the check as `!/[^\p{White_Space}\p{Cf}]/u.test(name)` (same meaning, no backtracking; verified true on 10M U+200B, false on "a", true on "") and add a rejection row with a few million U+200B.
- **Decision**: FIXED — `INVISIBLE_ONLY` replaced by `VISIBLE_CHARACTER` in project.ts; new test "rejects a name of ten million invisible characters instead of throwing" (Task and project name) went red with the RangeError on the old regex and is green on the fix.

### F2 — Ids near Number.MAX_SAFE_INTEGER break the round-trip and later mint duplicate ids

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project-file.ts:129 (`isTaskId`), :307-308 (`nextTaskId` raise); src/lib/services/project.ts:139 (`createTask`)
- **Detail**: `isTaskId` accepts any positive safe integer. A Task with id 9007199254740991 is accepted with `nextTaskId` raised to 2^53, which is not a safe integer, so the project's own export is rejected on re-import (`nextTaskId must be a positive whole number, not 9007199254740992`). With `nextTaskId: 9007199254740991`, `createTask` mints 2^53 twice — a duplicate id. Only a hand-edited file gets there, but it breaks the guardrails "no silent data loss" and "export then import gives the same project".
- **Fix**: Cap Task ids and `nextTaskId` at import well below the safe range (e.g. at most 2^31 − 1, so `createTask` would need billions of edits to overflow), rejected as `file-not-a-project` with the cap in the message, plus rejection rows at and above the cap.
  - Strength: One check in `isTaskId`/`readPositiveWholeNumber`; every accepted project then round-trips and `createTask` stays safe for any realistic use.
  - Tradeoff: Introduces a number the plan does not name; it must be recorded in the plan and later golden files.
  - Confidence: HIGH — evidence reproduced (`Number.isSafeInteger(MAX_SAFE_INTEGER + 1)` is false).
  - Blind spot: `createTask` itself still has no guard; an edit-only path cannot reach the cap in practice.
- **Decision**: FIXED — `readPositiveWholeNumber` takes a cap: Task and predecessor ids at most 2147483646, `nextTaskId` at most 2147483647, so the raised `nextTaskId` stays within it; new rows reject ids 2147483647 and 2^53 − 1, a predecessor above the cap and `nextTaskId` 2147483648, and a test accepts id 2147483646 and round-trips it. Removing the cap turned the four rows red. Cap recorded in plan Phase 2 shape rules.

### F3 — Pre-S-06/S-07 messages echo the Task name before the name rules run

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project-file.ts:338, :344 (`taskLabel(task)` in `checkSupportedYet`)
- **Detail**: `checkSupportedYet` runs before `validateProject`, so a Done Task named `"A\nTask 2: B is fine"` (or with a lone surrogate, or 1,000,000 characters) is echoed raw into the alert. `validateProject` deliberately labels by id only for this reason (project.ts:266), and `checkStartAndFinish` does the same.
- **Fix**: Label by id only in both messages (`Task ${task.id} is Done, …`) and update the three expected fragments.
- **Decision**: FIXED — both `checkSupportedYet` messages label by id only, with a comment saying why; the three test fragments now pin the full messages ("Task 2 is Done, and this version of the app can import only To Do Tasks."), which the old name-bearing label would fail.

### F4 — Unknown keys are echoed unquoted and at any length

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project-file.ts:217 (`readObject`), :167 (version)
- **Detail**: A key `"Import succeeded.\nAll good"` yields "The file is not a project file: Import succeeded.⏎All good is not a known field." Unlike the version, the key is not passed through `JSON.stringify`; a 1,000,000-character version or key produces a message of the same length.
- **Fix**: Quote the unknown key with `JSON.stringify` in the "is not a known field" message and truncate echoed values (e.g. 40 characters plus "…").
- **Decision**: FIXED — new `keyPath` shows a plain key as before (`tasks[1].colour`) and any other key in quoted, escaped bracket notation (`tasks[1]["Import succeeded.\nAll good"]`); echoed keys and versions are cut to 40 characters plus "…" (`shortened`, `quoted`). Four new rows (message-like key, 1000-char key, 1000-char non-version, 1000-digit newer version) went red with the old echoes and are green on the fix.

### F5 — Module header overstates Prettier stability

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project-file.ts:2-3
- **Detail**: The header says Prettier leaves the export as it is; the comment at :54-55 correctly limits that to `predecessors` lines within the 120-column print width (30 four-digit ids give a 203-character line that Prettier rewraps). Re-export byte-identity is unaffected.
- **Fix**: Qualify the header: "Prettier leaves it as it is while each predecessors list fits in 120 columns".
- **Decision**: FIXED — module header now says Prettier leaves the export as it is while each predecessors list fits in 120 columns, pointing to `taskLines`.

### F6 — No upper bound on Task count or file size

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project-file.ts:290
- **Detail**: The parser is linear (100,000 Tasks accepted in about 120 ms), but the cost moves downstream: dagre layout of 100,000 Tasks would freeze the tab, while the PRD NFR targets 100 Tasks. Nothing in the plan asks for a limit.
- **Fix**: Record as a follow-up for Phase 3 or later (e.g. a Task-count import rule) rather than changing Phase 2.
- **Decision**: SKIPPED
