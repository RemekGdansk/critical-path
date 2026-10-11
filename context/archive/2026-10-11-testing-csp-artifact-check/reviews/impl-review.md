<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Built-Artifact CSP Check Implementation Plan

- **Plan**: context/changes/testing-csp-artifact-check/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Evidence

- Diff scope (`main..HEAD`, 9 commits): every file named in Phases 1–3 is present; no planned item missing. No "What We're NOT Doing" boundary crossed (no `postbuild`, checker never reads `astro.config.mjs`, no `_headers`/sitemap check, no CSP or app change, §3 row 4 not flipped to `complete`). Extras are benign: the §5 gate-order line in test-plan and two extra fixture rows.
- Re-run on 2026-10-11: `npm ci` exit 0; `vitest list` shows 8 `src/` files plus `scripts/csp/check-page.test.ts`; `npm test`, `npm run lint`, `npx astro check` exit 0; `npm run build && npm run check:csp` → `CSP check passed: 2 page(s)`; with `dist/` moved away, `check:csp` exits 1; `grep -A1` shows the `check:csp` step after `build`; prettier and the 3.2 grep clean.
- PR #44: `ci` failed at the `check:csp` step on `8507bc0` and passed on `a2335e2`; `git diff 8507bc0~1 a2335e2` is empty. Workers Builds red/green confirmed manually by the user (2.5–2.7).
- The Phase 1 review's F1/F2 have not regressed; §6.4 matches the code (rules, allowlist, report format, rule 6/7 sets).

## Findings

### F1 — A same-origin worker escapes the page CSP and the oracle allows it

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/csp/check-page.ts:98 (rule 4 pins only `default-src`, `connect-src`), scripts/csp/check-page.ts:27 (`'self'` allowed in every directive)
- **Detail**: Reproduced: `default-src 'none'; connect-src 'none'; …; worker-src 'self'` returns `[]`, and so does the same policy with `worker-src` dropped and `script-src 'self'` (worker-src falls back to script-src). A worker loaded from a URL takes its CSP from its own response, not from the page; `public/_headers` gives `/*` only `frame-ancestors 'none'`, so `fetch()` inside a `/_astro/*.js` worker reaches any host. Moving dagre layout into a Vite worker (S-01's open 200 ms question) is a natural future edit that today fails only because of `worker-src 'none'`; loosening it to `'self'` is exactly the edit this gate exists to catch. Related: `form-action` does not fall back to `default-src` either; dropping it lets a script-built form POST anywhere and also passes.
- **Fix**: Add an oracle addendum: rule 4 pins `worker-src` (and `form-action`) to exactly `'none'` alongside `default-src` and `connect-src`; add fixture rows "worker-src 'self'", "worker-src missing", "form-action missing"; update §6.4. Today's build already emits both as `'none'`, so it stays green.
  - Strength: Closes a real egress path the PRD guardrail forbids, at zero cost to the current build.
  - Tradeoff: Changes the user-approved oracle; a future worker would need a reviewed oracle change (which is the point).
  - Confidence: HIGH — reproduced with the real module; worker CSP delivery is per the HTML/CSP specs.
  - Blind spot: Service-worker registration (`manifest-src`/`worker-src`) on Cloudflare not probed in a real browser.
- **Decision**: FIXED — rule 4 pins `worker-src` and `form-action` to `'none'` (`REQUIRED_NONE`), `minimal` fixture extended, 3 rejected rows added, oracle addendum in plan.md, §6.4 rule 4 updated. 37 scripts tests, build + `check:csp` (2 pages) green; break-check (pins removed → 3 rows red) restored.

### F2 — `<noscript>` before the meta is invisible to the check

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/csp/check-page.ts:121 (`parse(html)` with parse5's default `scriptingEnabled: true`), scripts/csp/check-page.ts:32 (`BEFORE_META_FORBIDDEN`)
- **Detail**: Reproduced: `<head><noscript><img src="https://x.example/p.gif"></noscript><meta CSP…>` returns `[]`. With scripting enabled parse5 keeps noscript content as text; a no-JS browser parses the `<img>`, breaks out of `<head>` and pushes the CSP meta into `<body>`, so the page has no policy and the pixel loads. The noscript pixel is the standard companion of analytics snippets. Only a pasted head snippet produces it, not Astro or a dependency bump.
- **Fix**: Add `noscript` to `BEFORE_META_FORBIDDEN` with one fixture row, and note it in §6.4.
- **Decision**: FIXED — `noscript` added to `BEFORE_META_FORBIDDEN`, 1 rejected row, oracle addendum, §6.4 rule 6 and the deploy-plan backstop updated. 38 scripts tests and build + `check:csp` green; break-check (`noscript` removed → the row red) restored.

### F3 — deploy-plan backstop overstates rule 7

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/deployment/deploy-plan.md:256
- **Detail**: Says the check fails "any page with an absolute or scheme-relative URL"; the code (and the oracle, and §6.4) flags only absolute `http:`/`https:` and `//` URLs — `<img src="ftp://…">` passes.
- **Fix**: Write "an absolute `http(s):` or scheme-relative URL".
- **Decision**: FIXED — deploy-plan backstop now says "an absolute `http(s):` or scheme-relative URL".

### F4 — PROJECT_RULES `npm test` entry still says "pure domain logic"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: PROJECT_RULES.md:26
- **Detail**: `## Commands` says `npm test` runs "pure domain logic"; README:34 and `## Testing` now say it also runs build-tooling tests. Not a planned item, but the docs now disagree.
- **Fix**: Change to "pure domain logic and build-tooling tests".
- **Decision**: FIXED — `## Commands` `npm test` entry now says "pure domain logic and build-tooling tests".

### F5 — Documented rule-7/rule-5 branches have no fixture row

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/csp/check-page.test.ts
- **Detail**: §6.4 states rule 7 scans `<template>` content, treats `\\`, `\/`, `/\` like `//` and strips tabs/newlines, and rule 5 rejects `'unsafe-hashes'`. Probes confirm the code does this, but no row covers any of it, so a regression there leaves `npm test` green.
- **Fix**: Add rows: `<template><img src="https://x.example/p.gif"></template>`, `<img src="\\x.example/p.gif">`, `<img src="ht\ttps://x.example/p.gif">`, `script-src 'self' 'unsafe-hashes'`.
- **Decision**: FIXED — 4 rows added (`<template>` img, `\\` src, tab in scheme, `'unsafe-hashes'`); break-check (template walk, backslash pattern, tab strip removed → their rows red) restored.

### F6 — Policy split on non-ASCII whitespace; URL leading C0 controls not stripped

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/csp/check-page.ts:70, scripts/csp/check-page.ts:85
- **Detail**: `default-src\u00a0'none'; connect-src 'none'` passes: JS `\s` splits on NBSP, CSP splits only on ASCII whitespace, so a browser sees no `default-src` at all. Similarly `<link rel=preload href="\u0001https://x/a.js">` passes though the URL parser strips the control. Only a copy-paste could produce either.
- **Fix**: Split policies on `/[\t\n\f\r ]+/` and strip leading/trailing `[\u0000- ]` from URL values before matching; one row each.
- **Decision**: FIXED — policies split and trimmed on ASCII whitespace only; URLs stripped of leading/trailing C0 controls and spaces (`stripControlsAndSpaces`); 2 rows (NBSP-joined `default-src`, `\u0001` before an href); break-check (old `\s`/`trim`) → both red, restored.

### F7 — Rule 7 would flag a same-site canonical link as "third-party"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/csp/check-page.ts:34, scripts/csp/check-page.ts:150
- **Detail**: `<link rel="canonical" href="https://critical-path.remekgdansk.workers.dev/">` is reported as rule 7. `astro.config.mjs` sets `site` "for canonical URLs", so a later SEO pass would go red with a misleading message. Fails closed, which is acceptable.
- **Fix**: Note in §6.4 that canonical/alternate links must stay relative (or need a reviewed exemption).
- **Decision**: FIXED — §6.4 Limits bullet notes that rule 7 fails closed on a same-site absolute URL (e.g. a canonical link built from `site`): keep canonical/alternate links relative or add a reviewed exemption with its own row.

### F8 — Only lower-case `.html` files are checked

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/check-built-csp.ts:17
- **Detail**: `dist/UPPER.HTML` with no CSP passes, because the walk filters on `endsWith(".html")`. Astro never emits this; only a `public/` file could.
- **Fix**: Match the extension case-insensitively.
- **Decision**: FIXED — the CLI matches `/\.html?$/i`; probe: `dist/UPPER.HTML` without a CSP now exits 1 naming it (the previous CLI exited 0).
