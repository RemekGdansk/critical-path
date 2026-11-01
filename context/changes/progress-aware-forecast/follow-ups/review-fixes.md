# Review fixes: progress-aware-forecast

Follow-ups queued by implementation reviews, to act on in the named phase.

## From impl-review-phase-1.md

- **F2 (Phase 5)**: The Planner render tests use the real clock (Planner has no `today` prop, by plan). Build the Done fixture with a past START date (2026-09-01) through the edits, and assert only clock-free text. Do not reuse the existing far-future-START fixture for "mark Done": a real-clock completion date would be before its START date.
- **F3 (Phase 5)**: In `src/components/planner/ForecastSummary.test.ts`, align the edit `CONTEXT` today (2026-09-05) with the forecast today `renderedMarkup` defaults to (2026-08-20), or derive one from the other, before adding the all-Done and `start-successors-done` renders.
