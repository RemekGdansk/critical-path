<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Built-Artifact CSP Check Implementation Plan

- **Plan**: context/changes/testing-csp-artifact-check/plan.md
- **Scope**: Phase 1 of 3
- **Reviewed phases**: 1
- **Date**: 2026-10-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Evidence

- Diff scope (`0a24e2b..f6593d3`): `package.json`, `package-lock.json`, `vitest.config.ts`, `scripts/check-built-csp.ts`, `scripts/csp/check-page.ts`, `scripts/csp/check-page.test.ts`, plus the change's `plan.md` and `change.md`. Every planned file is present; no unplanned file.
- Re-run on 2026-10-11: `vitest list` shows the 8 `src/` test files plus `scripts/csp/check-page.test.ts`; `npm test` 140 passed; `npm run lint` exit 0; `npx astro check` 0 errors; `npm run build && npm run check:csp` → `CSP check passed: 2 page(s)`.
- Lesson "Pin the build's input set" probe: a temporary `scripts/csp/tw-probe.ts` holding `bg-red-500 underline-offset-8` left the CSS hash unchanged (`Layout.BozMKhcY.css`) and neither class reached the CSS, so `scripts/` stays outside Tailwind's scan.
- Every fixture row the plan lists is present; expectations are oracle nouns (rule number, directive, token, element), not values read from `dist/` or the config.

## Findings

### F1 — Inline CSS before the CSP meta fetches outside the policy, unchecked

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/csp/check-page.ts:127 (rule 6), scripts/csp/check-page.ts:30 (`URL_ATTRIBUTES`)
- **Detail**: Oracle rule 6 forbids only `<script>` and `<base>` before the meta, and rule 7 reads only URL attributes. Its own rationale ("a meta CSP governs only what is parsed after it") applies to CSS too. Probed with `checkPage`, each of these returns `[]` although it fetches a third-party URL before the policy exists: `<style>@import url("https://x.example/a.css")</style>`, `<style>body{background:url(//x.example/p.gif)}</style>`, `<link rel="preload" as="image" imagesrcset="https://x.example/p.png 1x">`, and `<html style="background:url(https://x.example/p.gif)">`. The realistic route is a `<style is:inline>` with a font `@import` written at the top of `Layout.astro`, a variant of research row e. Today's build has no `<style>` before the meta, so tightening costs nothing.
- **Fix**: Extend rule 6 to also reject `<style>` and any element with a `style` attribute before the meta, add `imagesrcset` (split like `srcset`) to rule 7's attributes, add one fixture row each, and record the widened rule 6 as an addendum to the plan's oracle.
  - Strength: Follows from the oracle's own rationale; current build stays green (no `<style>` precedes the meta); four small rows.
  - Tradeoff: Changes the oracle the user approved, so it needs the addendum, and the §6.4 cookbook in Phase 3 must describe the wider rule.
  - Confidence: HIGH — the gap was reproduced with the real module.
  - Blind spot: A same-origin `<link rel="stylesheet">` before the meta whose `@import` loads third-party CSS is not probed; whether that fetch happens before or after the meta takes effect is browser timing, not verified.
- **Decision**: FIXED — rule 6 rejects `<style>` and `style` attributes before the meta, rule 7 reads `imagesrcset`, 3 rejected rows added and a `<style>` after the meta added to the passing row, oracle addendum in plan.md. The 4 probe pages are now rejected; 143 tests, lint, `astro check` and build + `check:csp` (2 pages) green; break-checks (rule 6 additions removed → 2 rows red; `imagesrcset` removed → 1 row red) restored.

### F2 — Documented deviations from the module contract

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: scripts/csp/check-page.ts:105, scripts/csp/check-page.ts:33
- **Detail**: The contract says "one human-readable violation per broken rule"; the module emits one per offending item (two loosened tokens give two rule-5 lines). Rule 7 is also slightly stricter than the oracle's wording (scans `<template>` content, treats `\\` and `/\` as protocol-relative, strips tabs and newlines). All were reported as adaptations at hand-back and none weakens the check.
- **Fix**: No code change; describe per-item reporting in the test-plan §6.4 cookbook text in Phase 3.
- **Decision**: FIXED — queued for Phase 3 in `follow-ups/review-fixes.md`.
