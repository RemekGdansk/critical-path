# Review fixes: progress-aware-forecast

Follow-ups queued by implementation reviews, to act on in the named phase.

## From impl-review-phase-1.md

- **F2 (Phase 5)**: The Planner render tests use the real clock (Planner has no `today` prop, by plan). Build the Done fixture with a past START date (2026-09-01) through the edits, and assert only clock-free text. Do not reuse the existing far-future-START fixture for "mark Done": a real-clock completion date would be before its START date.
- **F3 (Phase 5)**: In `src/components/planner/ForecastSummary.test.ts`, align the edit `CONTEXT` today (2026-09-05) with the forecast today `renderedMarkup` defaults to (2026-08-20), or derive one from the other, before adding the all-Done and `start-successors-done` renders.

## From impl-review-phase-2.md

- **Phase 3**: Make the round-trip in `src/lib/services/project.property.test.ts` unconditional again once the import gate `task-status-not-supported-yet` is gone (Phase 2 made it conditional on every Task being To Do).
- **F1 (Phase 7)**: Record in the documentation pass (PRD Business Logic or test plan) that a clock moving backward after a Task was marked Done leaves the project holding `completion-date-after-today`, so every edit reports it until that Task's completion date is moved on or before today; and that a file exported on a later local day than the importer's today is rejected. The limit is documented in the `accept` doc comment in `src/lib/services/project.ts`.

## From impl-review-phase-3.md

- **F3 (Phase 7)**: `context/domain/01-domain-distillation.md` (:74, :122) and `context/domain/02-invariant-aggregate-refactor.md` (:103, :333, :382) still name `task-status-not-supported-yet`, which Phase 3 removed, and no phase lists them. In the documentation pass, decide whether they are point-in-time snapshots (leave them as written) or living documents (update them as the glossary is updated).

## From impl-review-phase-4.md

- **F1 (Phase 5)**: In `src/components/planner/ForecastSummary.tsx:140`, `const today = movedFromWeekend ?? forecast.baseDate` is today only for the reasons whose base date is today (`start-date-unset`, `start-date-in-past`, `start-successors-done`). Under `all-tasks-done` the base date is the latest completion date. When adding the Phase 5 notes, rename the variable or scope it to those reasons, with a one-line comment that `all-tasks-done` does not qualify, and never show it in the "Every Task is Done." note.

## From impl-review-phase-6.md

- **F2 (Phase 7)**: In the test-plan update, record that the app ships no dark mode (nothing applies `.dark`), so the `.dark` token values, `--done` included, are computed for contrast but have not been checked rendered. The S-07 Phase 6 visual check (Progress 6.3, 6.4) covered light only; `change.md` Notes records it.
