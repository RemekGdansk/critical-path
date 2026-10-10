<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Forecast Oracle (Test-Plan Phase 1)

- **Plan**: context/changes/testing-forecast-dates/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Evidence

- Automated: `npm run lint`, `npx astro check` (0 errors, 0 warnings, 0 hints), `npm test` (8 files, 109 tests), `npm run build`, `npx prettier --check` on the three edited docs, and `node scripts/sync-roadmap.mjs --dry-run` ("would update #21 S-07 (body)", 1 change) all pass.
- Manual probes re-run during review, each reverted afterwards: removing the zone pin and running with `TZ=UTC` fails the `todayIsoDate` test (expected 2026-10-10, got 2026-10-09); switching `todayIsoDate` to `getUTC*` fails it; treating `in-progress` as `done` in `forecast.ts` fails only the In Progress row; rendering a date in the withheld branch of `ForecastSummary` fails only the withheld case. The pin also holds against an outer `TZ=America/Los_Angeles`.
- Plan drift: none. Every planned change is in the diff and matches its contract; every earlier expected literal in `forecast.test.ts` is still there with the same value; the non-PRD cases are unchanged. No production code changed. The only files outside the plan's list are this change's own context documents.

## Findings

### F1 — Done rows pin a code-chosen `baseDateReason` as if it came from the PRD

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/forecast.test.ts:124 (also :133, :142, :151); context/foundation/test-plan.md §6.1
- **Detail**: Test-plan §1 requires every expected value to come from an independent oracle. The base dates in the four Done rows (today) follow from the PRD ("a not-Done Task cannot start before today"), but `baseDateReason: "start-date-in-past"` is the label the code chose, not something the PRD says. The PRD actually says the opposite for these rows: "Once all of START's direct successors are Done, the START date no longer matters" (Business Logic), and "If the START date is in the past **and START's direct successors are not all Done**, the forecast uses today" (US-04 AC). In every Done row A is START's only direct successor, so the PRD's condition for "START date in the past" does not hold. Today the label only drives the `ForecastSummary` note ("START date … is in the past: forecasting from today …"), and no Done state can be reached until S-07. S-07 will probably have to decide whether that note is correct once START's successors are Done, and the table would then fail on a value the PRD never set. Separately, §6.1 says `baseDateReason` is an "ISO literal"; it is an enum literal.
- **Fix A ⭐ Recommended**: Hand the question to S-07 instead of changing the tests: add a sentence to the S-07 Unknown (or the §6.5 Phase 1 note) saying the Done rows' `baseDateReason` is the current code's choice, not a PRD value, and fix the "ISO literal" wording in §6.1.
  - Strength: Matches how this phase already handled all-Tasks-Done (sent to S-07's Unknowns). It keeps the plan's exact contract (which listed `start-date-in-past` for these rows) and leaves no tests to change.
  - Tradeoff: The table still asserts a non-oracle value until S-07 settles it.
  - Confidence: HIGH — two-line doc edit; the roadmap Unknown pattern already exists one line above.
  - Blind spot: Have not checked whether S-07's planner reads §6.5 or only the roadmap.
- **Fix B**: Narrow the oracle: assert only the PRD-derived fields (`baseDate` and both Project Finish Dates) in the Done rows, and keep the full `toEqual` for rows where the PRD defines the reason (START set in the future, unset, or in the past with no Done successor).
  - Strength: The table then holds no value the PRD does not state, which is what test-plan §1 requires.
  - Tradeoff: The rows get two shapes (or an optional field), which makes the row pattern §6.1 documents harder to follow, and the label loses its regression check.
  - Confidence: MED — straightforward, but it changes the row contract that S-05/S-06/S-07 will copy.
  - Blind spot: The UI note driven by the label stays untested for Done states either way.
- **Decision**: FIXED (Fix A) — added an S-07 Unknown in `context/foundation/roadmap.md` on the Done rows' `baseDateReason`, and reworded test-plan §6.1 (`baseDateReason` is a literal reason, not an ISO literal; each value must follow from the PRD).
