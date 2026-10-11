<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Project File Round-Trip Implementation Plan

- **Plan**: context/changes/project-file-round-trip/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 6 observations

Phases 1–3 each had a phase review (`impl-review-phase-1.md`, `-2.md`, `-3.md`). Their FIXED and SKIPPED findings are not raised again, and their fixes were confirmed present. This review concentrates on Phase 4 and on interactions between phases.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

Automated checks, re-run on 2026-10-12:

- `npm run lint && npx astro check && npm test && npm run build && npm run check:csp` passed, with 284 tests.
- `npx vitest run src/lib/services/project.test.ts src/lib/services/project-file.test.ts` passed, with 169 tests.
- `npx prettier --write src/lib/services/golden/ && git diff --exit-code src/lib/services/golden/` passed.
- `git diff main -- package.json` adds only the devDependency `@playwright/test`.
- `git diff main -- astro.config.mjs` is empty.
- `npx playwright test` passed 4 tests. A sub-agent also ran it with `--repeat-each=5` under `CI=1`, and all 20 runs passed.

## Findings

### F1 — The round-trip E2E test fails permanently from 2030-01-08

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/project-file.spec.ts:119
- **Detail**: The test sets START to `2030-01-07` and expects the Project Finish Dates `2030-01-12` and `2030-01-13`. `forecast()` uses today as the base date once the START date is in the past (`src/lib/services/forecast.ts:47-49`, `start-date-in-past`), and the browser reads the real clock. From 2030-01-08 both `expectProjectFinishDates` calls will fail on every CI run, with no code change behind it. Vitest's rule "today is always passed in, never read from the clock" has no E2E counterpart here.
- **Fix**: Pin the browser clock before `goto` in both contexts, with `page.clock.setFixedTime(...)` set to a day before 2030-01-07. Both the hand-derived dates and the "start-date" path are then stable.
- **Decision**: FIXED — `TODAY = new Date("2029-12-31T12:00:00")` pinned with `clock.setFixedTime` on both pages before `goto`. E2E passes 3/3. A deliberate break (`TODAY` set to 2030-02-01) turned the round-trip test red, with the forecast showing 2030-02-06 / 2030-02-07 counted from today; it is green again after reverting.

### F2 — A successful Import drops keyboard focus to `<body>`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/Planner.tsx:111
- **Detail**: `<ProjectControls key={replacements}>` remounts the whole group after `replaceProject`, which destroys the Import button that held focus. Probed in the preview build: after a rejected file, focus stays on the Import button; after an accepted file, focus is on `BODY`. The planner already guards against exactly this after Delete Task (`Planner.tsx:80-91`, "instead of falling to `<body>`"). A keyboard or screen-reader user loses their place after every successful import. Progress 3.9 ("Keyboard only … operable") was ticked without noticing this.
- **Fix A ⭐ Recommended**: Key only the name draft. Extract a `ProjectNameField` (or key just the name input's draft state) by `replacements`, so the Export and Import buttons survive the import and keep focus.
  - Strength: Fixes the cause. The remount was only needed to reset the name draft (plan Phase 3 §4), and the Import alert is already cleared on success.
  - Tradeoff: Splits `ProjectControls`. Export still has to read the name draft, so the draft or a commit callback has to be shared between the two parts.
  - Confidence: MED — the Export "commit draft first" path then crosses a component boundary and must be re-checked (E2E test 1 covers it).
  - Blind spot: Whether screen readers announce anything when focus stays on Import after a silent success.
- **Fix B**: Move focus to a stable target in `handleReplaceProject`, such as the New Task input, mirroring `handleDeleteTask`.
  - Strength: A one-line change that follows an existing pattern in the same file.
  - Tradeoff: Focus jumps away from the control the user just used, and the remount stays.
  - Confidence: HIGH — the same mechanism already works for Delete Task.
  - Blind spot: Whether the New Task input is the most sensible place to land after an import.
- **Decision**: FIXED via Fix B — `handleReplaceProject` focuses `newTaskInputRef` after `replaceProject`, and the comment explains why. The round-trip E2E test now asserts that New Task is focused after the import. A deliberate break (focus line commented out) turned it red ("Received: inactive"); it is green again after reverting.

### F3 — Only the seed test proves the CSP is in effect

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/project-file.spec.ts:20
- **Detail**: `reuseExistingServer: !CI` (`playwright.config.ts:33`) silently reuses whatever is serving port 4321 locally, including `npm run dev`, which has no CSP. Only `seed.spec.ts` probes with `fetch("/")`, which must be blocked. The documented single-spec command (`npm run test:e2e -- e2e/project-file.spec.ts`) would pass against the dev server, and its "no CSP violation" assertion would prove nothing.
- **Fix**: Add the seed's egress probe (`fetch("/")` must be `"blocked"`) to `openPlanner`, so every spec refuses to run without the CSP.
- **Decision**: FIXED (fixed differently) — the `fetch` probe would log a CSP-violation console error and fail the specs' own `consoleErrors` checks. Instead, `openPlanner` asserts that the HTML the server sent in response to `page.goto("/")` contains `connect-src 'none'`. That makes no browser request; the seed still proves the browser enforces the policy. E2E passes 4/4. Run against a live `npm run dev` (reused on 4321), the project-file tests failed on this check.

### F4 — CI tests a rebuilt `dist/`, not the one `check:csp` verified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: playwright.config.ts:31
- **Detail**: On CI, `reuseExistingServer` is false, so the webServer runs `npm run build` again after the `build` → `check:csp` steps in `ci.yml`. E2E therefore runs against a different build from the one the CSP check read. The build is deterministic, so the risk is low. The cost is a second build and a weaker link to the "verify the artifact" lesson.
- **Fix**: When `CI` is set, use only `npm run preview -- --port ${PORT}` as the webServer command, so E2E serves the `dist/` that `check:csp` verified.
- **Decision**: FIXED — the webServer command is preview-only when `CI` is set, and the test-stack.md web-server line was updated by hand to match. Verified with `npm run build && npm run check:csp && CI=1 npx playwright test`: the web server ran only `astro preview`, and 4/4 passed.

### F5 — The Import alert does not wrap long words

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/ProjectControls.tsx:174
- **Detail**: The import error `<p>` uses `max-w-md` without `wrap-break-word`. `TaskPanel.tsx:282` adds `wrap-break-word` to its alert, which shows the same cycle message. A file name with no spaces, or a cycle through long names with no spaces (Task names can be 200 characters), overflows the header.
- **Fix**: Add `wrap-break-word` to the import error `<p>`.
- **Decision**: FIXED — `wrap-break-word` added to the Import alert, matching `TaskPanel.tsx:282`.

### F6 — `setProjectName` doc comment names the wrong rules

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project.ts:201
- **Detail**: The comment says the name is set "under the Task name rules", but the function applies the project-name rules, whose messages say "A project name …".
- **Fix**: Change the comment to say the project name rules (the same four rules as for Task names).
- **Decision**: FIXED — the comment now says "under the project name rules (the Task name rules, worded for the project)".

### F7 — Plan points to the wrong test-plan section, and the freshness ledger is stale

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/project-file-round-trip/plan.md:430
- **Detail**: Phase 4 says to update "the e2e row of `test-plan.md` §3". The row is actually in §4 Stack (`test-plan.md:69`), and that is the row the implementation correctly updated. Separately, §8 Freshness Ledger still says stack versions were last verified on 2026-10-10, while the new row says they were checked on 2026-10-11.
- **Fix**: Correct "§3" to "§4" in the plan, and set the ledger date to 2026-10-11.
- **Decision**: FIXED — the plan now says "§4 Stack". In test-plan.md, "Stack versions last verified" and the header's "Last updated" both read 2026-10-11, the date the e2e row was checked.

### F8 — Progress 4.3 and 4.4 have no recorded evidence

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/project-file-round-trip/plan.md:570
- **Detail**: "Each E2E test was seen red on a deliberate break" and "reviewed against the five anti-patterns" are ticked. Neither the 5e06a2b commit body nor the plan records which breaks were run or what they showed. This is the same gap as Phase 3 review F3.
- **Fix**: Add a sub-bullet under 4.3 and 4.4 naming the breaks run per test (for example, the download anchor removed, or a cycle file accepted) and confirming the anti-pattern review, or re-run them if they cannot be recalled.
- **Decision**: SKIPPED
