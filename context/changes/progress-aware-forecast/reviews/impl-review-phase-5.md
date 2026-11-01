<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Progress-Aware Forecast (S-07)

- **Plan**: context/changes/progress-aware-forecast/plan.md
- **Scope**: Phase 5 of 8
- **Reviewed phases**: 5
- **Date**: 2026-11-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Plan drift: every Changes Required item MATCHes (`dbf7266`), the "draft follows the committed date" detail is implemented as a during-render reset (`TaskPanel.tsx:90-96`), and the queued follow-ups F1, F2 and F3 are applied. The node-name assertions ("A, Done on 2026-09-03", "B, Done on ") are deferred to Phase 6, which adds Status to `taskAccessibleName`; until then Planner tests assert the Done state through the panel. Success criteria re-run: the 4 scoped files pass (129 tests), `npm test` passes (556), lint passes, `astro check` reports 0 errors. Manual rows 5.3–5.5 were confirmed by the user before commit.

## Findings

### F1 — Browsing the Status select with arrow keys loses a backdated completion date

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/TaskPanel.tsx:284-289 (with src/lib/services/project.ts:381-386)
- **Detail**: The Status select commits on every `change`, as the plan prescribed by analogy with Day counting. On Windows and Linux Chrome a closed select fires `change` per arrow key, which this file's own comment acknowledges (`TaskPanel.tsx:118-119`). Sequence: A is Done with completion date 2026-09-03; the user focuses Status, presses ArrowUp (In Progress) and then ArrowDown (Done). That is two accepted edits: leaving Done deletes `completionDate`, and re-entering Done sets it to today. The backdated date is silently replaced. The Day counting analogy does not carry over, because switching Day counting back loses nothing. On macOS, arrow keys open the popup, so manual testing there would not show it.
- **Fix A ⭐ Recommended**: TaskPanel remembers the completion date a Task had when it left Done during this panel session, and on re-entering Done it restores that date with `setCompletionDate` right after `setStatus`.
  - Strength: Keeps the plan's one-click, commit-on-change Status and the one-edit `setStatus` domain contract. The project itself never holds a date on a non-Done Task, so "What We're NOT Doing" still holds.
  - Tradeoff: Two applies for one gesture. If the restore is rejected (e.g. a predecessor's date changed meanwhile), today stays. Needs a Planner test.
  - Confidence: MED — straightforward state, but the restore-rejected path needs a decision on whether to show its alert.
  - Blind spot: Restoring after a long gap could surprise someone who meant to re-mark Done today. Limiting it to the panel session (TaskPanel is keyed by Task id) keeps that window short.
- **Fix B**: The Status select only chooses, and a "Set" button commits, like the Add predecessor picker.
  - Strength: Also stops committing intermediate Statuses and showing an alert per step while browsing. Matches an existing pattern in the same panel.
  - Tradeoff: An extra click for the most frequent progress action, and a deviation from the plan's "commits on change".
  - Confidence: HIGH — the pattern already exists at `TaskPanel.tsx:118-123`.
  - Blind spot: Keyboard flow and e2e (Phase 7) would need the extra step.
- **Decision**: FIXED via Fix A — panel-local ref in TaskPanel restores the date through setCompletionDate on re-entering Done; Planner row "restores A's backdated completion date …" (break-checked)

### F2 — Planner test compares two separate clock reads for equality

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/planner/Planner.test.ts:267
- **Detail**: `expect(field?.max).toBe(field?.value)` compares the hook's clock read at edit time with Planner's `todayIsoDate(new Date())` at re-render. A midnight crossing between the two reads fails the test. The window is tiny but real.
- **Fix**: Assert `field.value <= field.max` (ISO strings compare correctly), keeping the shape check.
- **Decision**: FIXED — asserts value <= max with a null guard

### F3 — Completion date field paths and one indirect rule path have no test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/planner/Planner.test.ts; src/hooks/useProject.test.ts:195-277
- **Detail**: The Completion date field copies StartPanel's date logic, but its view tests cover only a typed draft committed on blur and Escape. There is no row for `validity.badInput` → `completionDateNotADate()`, a calendar pick committing at once, or an Enter commit; StartPanel has view tests for these. Separately, `completion-date-before-predecessor` via `addPredecessor` (a Done Task given a Done predecessor with a later date) is tested neither in the hook nor in `project.test.ts`. The guardian rejects it, but no test proves it.
- **Fix**: Add badInput, calendar-pick and Enter rows for the Completion date field, mirroring the START date rows, and one `addPredecessor` row for `completion-date-before-predecessor` in the hook table.
- **Decision**: FIXED — Planner rows for badInput, calendar pick and Enter (each break-checked against its own handler line); the addPredecessor row for completion-date-before-predecessor went to project.test.ts "the Done rules on edits to other Tasks", since the hook fixture can only reach it through a cycle

### F4 — `today` in ForecastSummary still holds the START date under `start-date`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/planner/ForecastSummary.tsx:139-142
- **Detail**: Phase-4 review F1 asked to scope `today` to the reasons whose base date is today (`start-date-unset`, `start-date-in-past`, `start-successors-done`). The code excludes only `all-tasks-done`, so under `start-date` (a future START date) `today` holds the START date. Nothing reads it there, so it is harmless, but the name still overpromises for one reason.
- **Fix**: Define `today` only for the three today-based reasons, and update the comment.
- **Decision**: FIXED — `today` defined only for TODAY_BASED_REASONS (start-date-unset, start-date-in-past, start-successors-done)
