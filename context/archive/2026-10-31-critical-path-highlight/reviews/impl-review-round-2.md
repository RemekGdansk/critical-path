<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Critical Path Highlight (round 2)

- **Plan**: context/changes/critical-path-highlight/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-31
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 5 observations
- **Previous round**: `reviews/impl-review-round-1.md` (7 findings, all fixed; this round reviews the committed phases plus those uncommitted fixes)

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence gathered on the working tree: the six targeted Vitest files pass (98 tests). `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` pass (435 tests, 0 errors, CSP check passed on 2 pages), and `npm run test:e2e` passes (7/7). `startDay + duration` appears in one non-test line (`src/lib/services/remaining-work.ts:92`). The built CSS has `--critical-path` twice and every new rule. The diff against `main` is empty for the S-08, state and file-format files.

Both reviewers confirmed:

- the round-1 fixes are correct: the `<dl>` is valid HTML, the swatch and "·" stay out of the accessible names, `toHaveText` matches `textContent`, and `taskLinkId()` is used at both sites;
- the algorithm, overflow handling, memoization and CSP behaviour are sound.

Manual Progress rows 1.4 and 3.3–3.5 are ticked but leave no artifact in the repo. Round-1 F7 changed the times line's markup after 3.3 and 3.5 were checked, so those two need a fresh look under `npm run preview`.

## Findings

### F1 — Plan does not record the round-1 changes accurately

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/critical-path-highlight/plan.md:64, :212-215
- **Detail**: The F3 addendum says the suffix changed "four more `Planner.test.ts` tests". The diff shows three: "renders the Task nodes…" (:79), "names the rule for a rejected Duration…" (:124) and "recomputes both Project Finish Dates… Weekdays" (:139), plus the fixture comment at :40. The addendum also leaves out two other `roadmap.md` edits: the S-07 Unknown (round-1 F4) and the `updated:` frontmatter. The Phase 3 contract still says the times are "one line" with an unconditional swatch. The code now uses a `<dl>` (round-1 F7) and hides the swatch for a too-large critical-path time (round-1 F5), and neither change is written down.
- **Fix**: Change "four" to "three" in the addendum and list the two other roadmap edits. Add a one-line Phase 3 addendum recording the `<dl>` and the conditional swatch.
- **Decision**: FIXED — Parallel work addendum corrected (three tests, all three roadmap edits, merge recipe); Phase 3 addendum records the `<dl>` and the conditional swatch

### F2 — Round-1 comment edits left unwrapped lines

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/ForecastSummary.tsx:27, :105; src/dev/KitchenSinkPlanner.tsx:117
- **Detail**: Each rewritten doc comment now has one long line (up to 146 characters) followed by the old short lines. The surrounding comments wrap at about 80 columns, and Prettier does not reflow comments.
- **Fix**: Rewrap the three comment blocks at about 80 columns.
- **Decision**: FIXED — three doc comments rewrapped at about 80 columns, wording unchanged

### F3 — Cycle-throw statements still name only `forecast()`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/planner/Planner.test.ts:217-219, context/foundation/test-plan.md:119
- **Detail**: Round-1 F2(d) fixed this in the kitchen-sink fixture only. The `cyclicProject` doc comment and the test plan's render-crash guidance still say only `forecast()` throws on the cycle. That is still true, but incomplete, since `projectDiagram()` now throws too. Both files are shared with S-08, so each edit has to be a small in-place word change.
- **Fix**: Change "`forecast()` throws" to "`forecast()` and `projectDiagram()` throw" in both places.
- **Decision**: FIXED — both statements now name `forecast()` and `projectDiagram()`; in-place edits only

### F4 — Swatch would show for a 0-day critical-path time

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/ForecastSummary.tsx:37
- **Detail**: The swatch now depends on `criticalPathTime.kind === "days"`. An all-Done project gives `{ days: 0 }` with nothing critical, so the swatch would stand for a colour that is not drawn, the same problem as round-1 F5. This is not reachable until S-07, which owns the all-Done copy (plan.md:44).
- **Fix**: Add a clause to the S-07 Unknown added in round 1 (roadmap.md) noting that the legend swatch also needs a decision for an all-Done project.
- **Decision**: FIXED — the S-07 Unknown in roadmap.md now covers the legend swatch for an all-Done project

### F5 — Times line: wrap starts with "·", and the gap differs from the date rows

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/ForecastSummary.tsx:34-53
- **Detail**: The `<dl>` wraps between its two pairs, so a wrapped second line would begin with "· Total-work time". That is only likely in a narrow header or with "Too large to count" values. The label-to-value gap is `gap-x-1.5`, while the date rows above use `gap-3`, and the doc comment now says the pairs are "like the Project Finish Dates".
- **Fix**: Check the header at 1024 wide in the kitchen sink while re-checking manual row 3.5. If the wrap shows, add `flex-nowrap` to the `<dl>`.
- **Decision**: ACCEPTED — measured in the preview build: one row at 1024 and 1440 wide for normal and too-large values; wraps (second line starts with "·") only in weekdays mode with a 9007199254740991-weekday critical-path time, which is wider than the 576px status cap, so `flex-nowrap` would overflow onto the project controls. Accepted as an unrealistic edge; the 6px label gap reads fine beside the 12px date rows.

### F6 — Test plan "Last updated" not bumped

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/test-plan.md:7
- **Detail**: This change edits the Risk #6 row and the :182 hand-off line, but the header still reads "Last updated: 2026-10-12". The §4 test counts are also stale, but that predates this change (the file was last changed on `main` on 2026-10-24).
- **Fix**: Bump the date to 2026-10-31 and leave the counts to a later test-plan refresh.
- **Decision**: FIXED — Last updated set to 2026-10-31; the stale §4 counts predate this change and are left for a test-plan refresh

## Triage summary

- Fixed: F1, F2, F3, F4, F6 (5)
- Accepted: F5 (1)
- After triage, `npm run lint && npx astro check && npm test && npm run build && npm run check:csp && npm run test:e2e` pass (435 unit tests, 7 e2e tests). The times line was checked in the preview build at 1024 and 1440 wide. Round-1 F7 changed the markup after manual rows 3.3 and 3.5 were ticked, so the user re-checked both in the preview build on 2026-10-31. Both passed: the times line and swatch, withholding and restoring the line and highlight, and the layout at 1024 wide.
