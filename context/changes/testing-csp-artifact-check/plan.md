# Built-Artifact CSP Check Implementation Plan

## Overview

Add a post-build check that reads every `dist/**/*.html` and fails unless each page enforces a no-egress Content Security Policy, prove with hermetic fixture tests and a demonstrated local loosening that it goes red, and run it as a named step after `npm run build` in both the GitHub Actions `ci` job and the Cloudflare Workers Builds build command. Delivers rollout Phase 4 of `context/foundation/test-plan.md` ("Built-artifact guarantee", Risk #7): project data must not be able to leave the device because the CSP was loosened, or never reached the served page, while every gate stays green.

## Current State Analysis

- The build emits 2 pages, `dist/index.html` and `dist/404.html`, each with exactly 1 `<meta http-equiv="content-security-policy">` carrying the 9 configured directives (including `default-src 'none'` and `connect-src 'none'`) plus Astro's `script-src`/`style-src` hashes; no `http(s)://` URL appears in either page (research, "What the build emits").
- No gate reads `dist/`. `ci.yml:24-29` runs `astro sync` → lint → `astro check` → `npm test` → `npm run build`; the Workers Builds dashboard command (`context/deployment/deploy-plan.md:135`) runs the same sequence. `npm test` runs before the build, so the artifact check cannot live inside it.
- Seven inspected failure paths build green today (research table rows a–g). Rows c–g leave `astro.config.mjs` reading `connect-src 'none'` while the HTML does not enforce it: an adapter with `staticHeaders` moves the CSP out of the HTML, a third-party origin in another directive, an element written before the meta in `src/layouts/Layout.astro` (the meta is emitted after the author's own `<head>` children, `node_modules/astro/dist/runtime/server/render/head.js:25-40`), a repeated directive, and a page that bypasses Astro's head rendering.
- Vitest discovers `src/**/*.test.ts` only (`vitest.config.ts:6`). `scripts/` holds `sync-roadmap.mjs`; ESLint lints `scripts/**/*.mjs` without type checking (`eslint.config.js:108-113`), while `.ts` anywhere is linted type-checked by `baseConfig` (`no-console: "warn"`, `eslint.config.js:26`) and covered by `astro check` (`tsconfig.json` includes `**/*`).
- Node 24.21.0 (`.nvmrc`) runs `.ts` files directly with no flag (observed: `node main.ts` importing `./a.ts` printed the result, no warning), and Astro's base tsconfig sets `allowImportingTsExtensions: true` (`node_modules/astro/tsconfigs/base.json`). A checker CLI written in TypeScript therefore needs no build step or loader.
- No HTML parser is a direct dependency; `ultrahtml@1.7.0` is transitive only. `@types/node@24.13.4` is also transitive only (via vite, sitemap, vitest). `parse5` is at 8.0.1.
- `public/_headers:19-23` adds a header CSP `frame-ancestors 'none'`; browsers enforce the intersection of header and meta policies, so the header cannot loosen the meta. Serve-time platform injection is invisible to a build-time check and stays with the manual R4 gate (deploy-plan step 5, P4).

## Desired End State

- `npm run check:csp` exits 0 on today's build, printing how many pages it checked, and exits non-zero naming each failing page and rule when any built page breaks the oracle below, when `dist/` holds no HTML page, or when `dist/` is missing.
- A Vitest table in `scripts/csp/` proves one rejection per loosening (one row per failure path) and one pass for a well-formed page, against hand-written HTML fixtures whose expected outcome comes from the oracle, never from `dist/` or `astro.config.mjs`.
- Locally loosening `connect-src` in `astro.config.mjs`, and separately writing an external `<script src>` as the first child of `<head>` in `Layout.astro` with the config unchanged, each turn the check red after a build.
- `ci.yml` and the Workers Builds build command both run `npm run check:csp` immediately after `npm run build`; a deliberately loosened commit on the PR turned both required checks red, and its revert turned them green.
- `PROJECT_RULES.md`, `README.md`, `.github/dependabot.yml`, `context/deployment/deploy-plan.md` and test-plan §4, §5, §6.4 and §6.5 describe the check and the new gate order.

**Oracle (literal, from the PRD guardrail, the PROJECT_RULES hard rule, the `astro.config.mjs:43-45` comment and test-plan Risk #7 guidance):**

1. The build holds at least 1 HTML page; 0 pages or a missing `dist/` is a failure.
2. Every page holds exactly 1 `<meta http-equiv="content-security-policy">` (attribute name and value matched case-insensitively), and it is a child of `<head>` as a browser parses the document.
3. No directive name appears twice in that policy (CSP3 ignores a repeat, so a repeat is at best dead text and at worst read differently by another parser).
4. `default-src` and `connect-src` are both present, each with exactly the source list `'none'`. Requiring `connect-src` literally is stricter than CSP fallback semantics, and matches the project rule that names it as the load-bearing line.
5. Every value token in every directive is in the allowlist `'self'`, `'none'`, `'sha256-…'`/`'sha384-…'`/`'sha512-…'` hash sources, and `data:`. Anything else fails: host sources, `*`, any other scheme (`http:`, `https:`, `ws:`, `wss:`, `blob:`), `'unsafe-inline'`, `'unsafe-eval'`, `'unsafe-hashes'`, `'strict-dynamic'`, nonces, and the URLs or group names of `report-uri`/`report-to` (violation reports are egress).
6. Before the CSP meta in document order there is no `<script>` (with or without `src`) and no `<base>`, because a meta CSP governs only what is parsed after it.
7. No element other than `<a>` anywhere in the page has a URL attribute (`src`, `href`, `srcset`, `data`, `action`, `formaction`, `poster`) holding an absolute `http:`/`https:` URL or a protocol-relative `//` URL. `<a href>` is navigation, not a fetch.

**Oracle addendum (2026-10-11, `reviews/impl-review-phase-1.md` F1):** rule 6 also forbids a `<style>` element and any element with a `style` attribute before the CSP meta, because CSS `@import` and `url()` fetch outside a policy not yet parsed; rule 7 also reads `imagesrcset`.

### Key Discoveries:

- Meta position follows the author's `<head>` children — `node_modules/astro/dist/runtime/server/render/head.js:25-40`; the same-origin `<link rel="icon" href="/favicon.png">` precedes the meta today, so oracle rule 6 forbids scripts and `<base>` before the meta, not every element.
- `cspDestination: "adapter"` with `staticHeaders` drops the meta while the config is unchanged — `node_modules/astro/dist/core/build/plugins/plugin-manifest.js:237`.
- The Workers Builds command lives only in the dashboard — `context/deployment/deploy-plan.md:135`; F-01's timing rule applies (`context/archive/2026-09-26-domain-test-gate/plan.md:45-49`).
- `deploy-plan.md:256`'s backstop ("an injected beacon would be blocked by `script-src 'self'`") holds only for an injection after the meta.
- Lesson "Pin the build's input set": widening Vitest's `include` must be deliberate and verified by probe. Lesson "Verify the artifact, not the config": expected values must not be read from `astro.config.mjs` at check time.

## What We're NOT Doing

- No assertion on the config object, and no reading of `astro.config.mjs` by the checker: a check comparing config to HTML passes whenever both are loosened together.
- No check of `dist/_headers`, `sitemap-*.xml` or other non-HTML files: the header policy can only tighten the meta, and the sitemap's absolute URLs are not loaded by the page.
- No check of the deployed page or serve-time injection (Web Analytics etc.): GitHub Actions holds no Cloudflare credentials and Workers Builds deploys after its build command. That stays the manual R4 gate (deploy-plan step 5).
- No `postbuild` hook and no change to `npm run build`: each gate shows the check by name (F-01 precedent). The manual `npm run build && npx wrangler deploy` path stays unguarded, as it already is for lint and tests.
- No mutation testing (Stryker) run; the fixture table is the red proof.
- No change to the CSP itself, to `public/_headers` or to any app code.
- Not flipping test-plan §3 row 4 to `complete`: that follows archiving, as for Phase 1 (commit `2b978a6`).

## Implementation Approach

Split the checker into a pure decision module (HTML string in, list of violations out) that Vitest tests hermetically on fixtures, and a thin CLI that walks `dist/` and reports. Parse with `parse5`, so "inside `<head>`" and "before the meta" mean what a browser's tree construction makes of the page. Run the CLI with Node 24's native TypeScript support through an npm script `check:csp`. Prove red twice: per-rule fixture rows in `npm test`, and a real build after a local loosening (Phase 1); then wire both gates and prove red on a PR (Phase 2); then record the pattern (Phase 3).

## Critical Implementation Details

**Timing & lifecycle.** The dashboard build command applies to every branch at once. If `&& npm run check:csp` is added while `main` has no `check:csp` script, every `main` build fails with `Missing script: "check:csp"`. Edit the dashboard only while the Phase 1+2 PR is open and green, merge promptly, and push the deliberately loosened commit only after the edit, because the PR's preview build runs the check only from then on.

**Node-native TypeScript.** The CLI and the decision module are executed by `node` directly, so they may use only erasable TypeScript syntax (no `enum`, no `namespace`, no parameter properties), must import local files with their `.ts` extension, and cannot use the `@/` alias.

## Phase 1: Checker and fixture tests

### Overview

Add the decision module, its fixture table, the CLI and the `check:csp` script; widen Vitest's discovery to `scripts/` and verify it by probe; prove locally that a real build goes red on a loosened config and on an element placed before the meta. Everything here is agent-verifiable, and the decision module suits `/10x-tdd` (first red test: "a page whose CSP has `connect-src 'self' https://x.example` is rejected, naming `connect-src`").

### Changes Required:

#### 1. Dependencies and script

**File**: `package.json`, `package-lock.json`

**Intent**: Add a spec-compliant HTML parser and the Node type definitions the checker relies on as direct devDependencies (both are transitive-only today), and expose the check as a named script.

**Contract**: `devDependencies.parse5` at `^8`, `devDependencies["@types/node"]` at `^24` (the `.nvmrc` line), installed with `npm i -D` so `npm ci` stays clean. `scripts["check:csp"]` = `node scripts/check-built-csp.ts`.

#### 2. Vitest discovery

**File**: `vitest.config.ts`

**Intent**: Discover the checker's tests next to it in `scripts/`, deliberately widening the pinned input set by exactly one pattern.

**Contract**: `test.include` becomes exactly `["src/**/*.test.ts", "scripts/**/*.test.ts"]`. Tailwind's scan (`src/styles/global.css`, `@source "../**/*…"` relative to `src/styles/`) does not reach `scripts/`, so no `@source not` change is needed.

#### 3. Decision module

**File**: `scripts/csp/check-page.ts` (new)

**Intent**: Decide, for one page's HTML, every oracle rule it breaks; and, for a whole build, fail on zero pages. Pure: no file system, no clock, no config import.

**Contract**: `checkPage(html: string): string[]` returns one human-readable violation per broken rule (empty array = pass), each naming the rule and the offending directive, token or element. `checkBuild(pages: readonly { path: string; html: string }[]): string[]` returns the per-page violations prefixed with the page path, plus a violation when `pages` is empty. Directive parsing splits on `;` and whitespace, lower-cases directive names and keywords, and treats a repeated directive name as a violation (oracle rule 3). Elements are found by walking the `parse5` document tree in document order. Erasable TypeScript only (see Critical Implementation Details).

#### 4. Fixture table

**File**: `scripts/csp/check-page.test.ts` (new)

**Intent**: Prove each oracle rule rejects its loosening and that a well-formed page passes, with every expected outcome derived from the oracle by hand.

**Contract**: Hand-written minimal HTML fixtures built from one helper that takes a policy string and optional head/body fragments; none is copied from `dist/` and none reads `astro.config.mjs`. One `it.each` row per case, the row name naming the failure path (research table row letter where it applies), asserting that the violations mention the rule broken:

- passes: a page shaped like the current build (charset, viewport, same-origin icon link and title before the meta; the full deny-list plus `script-src`/`style-src` with `'self'` and hash sources; an inline `<script>` and an `<a href="https://reactflow.dev">` after the meta)
- passes: `HTTP-EQUIV="Content-Security-Policy"` in upper case
- rejected (a): `connect-src 'self' https://x.example`
- rejected (b/c/g): no CSP meta at all
- rejected: CSP meta inside `<body>`; two CSP metas
- rejected: `default-src` missing; `default-src 'self'`; `connect-src` missing
- rejected (d): `img-src 'self' https://x.example`; `font-src *`; `img-src https:`; `connect-src wss:`
- rejected: `script-src 'self' 'unsafe-inline'`; `'unsafe-eval'`; `'strict-dynamic'`; a `'nonce-…'` source
- rejected: `report-uri https://x.example/r`; `report-to g`
- rejected (f): `connect-src 'none'; connect-src https://x.example` and the reverse order
- rejected (e): `<script src="https://x.example/a.js">` before the meta; an inline `<script>` before the meta; `<base href="/">` before the meta
- rejected: `<img src="https://x.example/p.gif">` in `<body>`; `<link rel="preconnect" href="https://x.example">` after the meta; `<img src="//x.example/p.gif">`
- `checkBuild([])` reports the empty build; `checkBuild` prefixes violations with the page path

#### 5. CLI

**File**: `scripts/check-built-csp.ts` (new)

**Intent**: Run the decision module over the real artifact and turn its result into an exit code a gate can read.

**Contract**: Reads every `*.html` under `dist/` recursively (a missing `dist/` is a failure, not a pass), calls `checkBuild`, writes each violation on its own line to stderr and exits 1 when any exists, otherwise writes `CSP check passed: <n> page(s)` to stdout and exits 0. Writes through `process.stdout.write`/`process.stderr.write`, so the type-checked lint config needs no `no-console` exception.

### Success Criteria:

#### Automated Verification:

- Clean install succeeds with the updated lockfile: `npm ci`
- `npx vitest list` lists every existing `src/**/*.test.ts` test plus `scripts/csp/check-page.test.ts`, and nothing from `node_modules`, `.claude/` or `dist/`
- `npm test` passes, including every fixture row
- Breaking one rule in `check-page.ts` (e.g. letting host sources through) makes `npm test` exit non-zero (reverted afterwards)
- Linting passes: `npm run lint`
- Type check passes: `npx astro check`
- `npm run build && npm run check:csp` exits 0 and reports 2 pages
- With `connect-src 'self' https://example.com` in `astro.config.mjs`, `npm run build && npm run check:csp` exits non-zero naming both pages (reverted afterwards)
- With `<script src="https://example.com/a.js"></script>` as the first child of `<head>` in `src/layouts/Layout.astro` and the config unchanged, `npm run build && npm run check:csp` exits non-zero (reverted afterwards)
- After both reverts, `git diff --exit-code astro.config.mjs src/layouts/Layout.astro` is clean and `npm run build && npm run check:csp` exits 0 again
- With `dist/` removed, `npm run check:csp` exits non-zero

#### Manual Verification:

- The fixture table reads as the oracle: each row name says which loosening it is, and no expected value is derived from `dist/` or the config

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Wire both gates and prove the block

### Overview

Run the check as a named step after the build in `ci.yml` and in the Workers Builds dashboard command (human-only), record the new gate in the deploy plan, and prove on the PR that a loosened policy turns both required checks red.

### Changes Required:

#### 1. Pre-merge gate

**File**: `.github/workflows/ci.yml`

**Intent**: Block a merge whose built pages do not enforce the no-egress CSP.

**Contract**: New step `- run: npm run check:csp` directly after `- run: npm run build`, with a one-line comment that it reads the built HTML, not the config. Job name `ci` unchanged (it is the required status-check context).

#### 2. Workers Builds build command (dashboard, human-only)

**File**: none (Cloudflare dashboard → Workers & Pages → `critical-path` → Settings → Builds)

**Intent**: Block a deploy whose built pages do not enforce the CSP; Workers Builds does not wait for GitHub Actions (R15).

**Contract**: Build command becomes `npx astro sync && npm run lint && npx astro check && npm test && npm run build && npm run check:csp`. Edited while this change's PR is open and green, per Critical Implementation Details.

#### 3. Deploy plan record

**File**: `context/deployment/deploy-plan.md`

**Intent**: Keep the only written record of the dashboard command in step with the dashboard, and correct the backstop sentence that research found only partly supported.

**Contract**: Step 7 table "Build command" cell shows the new command; the paragraph after it (around line 150) adds that since this change the command also runs `npm run check:csp` after `build`, in the same position as in `ci.yml`, so a page that loosens the CSP blocks the deploy. The backstop at line 256 gains that `script-src 'self'` only governs elements after the meta; the build check fails any built page with a script or absolute URL before it, and serve-time injection is still caught only by the manual R4 gate.

#### 4. Proof on the PR

**File**: none (a temporary commit on the PR branch)

**Intent**: Show, from the gates' own results, that both gates run the check and fail on a loosened policy.

**Contract**: After the dashboard edit, push a commit that sets `connect-src 'self' https://example.com` in `astro.config.mjs`; observe `ci` failing at the `check:csp` step and `Workers Builds: critical-path` failing with no preview version uploaded; push its revert; observe both green.

### Success Criteria:

#### Automated Verification:

- `ci.yml` runs `npm run check:csp` as the step after `npm run build`: `grep -A1 "npm run build" .github/workflows/ci.yml`
- Linting passes: `npm run lint`
- On the PR, the loosened commit's `ci` run fails at the `check:csp` step: `gh pr checks`
- On the PR, the revert's `ci` run passes: `gh pr checks`

#### Manual Verification:

- The Workers Builds dashboard build command ends with `&& npm run check:csp` and matches `deploy-plan.md` step 7 exactly
- The loosened commit's Workers Builds log shows the check failing after the build, and no preview version was uploaded for it
- The revert's Workers Builds log shows `CSP check passed: 2 page(s)` and a preview version was uploaded

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Docs and cookbook

### Overview

Make the project's rules, scripts list and test plan describe the new gate, so the next agent adds artifact checks the same way instead of asserting the config.

### Changes Required:

#### 1. Project rules and README

**File**: `PROJECT_RULES.md`, `README.md`

**Intent**: Name the new command and gate order, and correct the statement that Vitest discovers only `src/**/*.test.ts`.

**Contract**: `PROJECT_RULES.md` hard rule on egress: the CSP is also checked in the built HTML by `npm run check:csp` in both gates. `## Commands`: add `npm run check:csp` (after `npm run build`; fails unless every built page enforces the no-egress CSP). `## Testing`: Vitest also discovers `scripts/**/*.test.ts` (build tooling tests, outside the Tailwind scan); the gate order is `astro sync` → lint → `astro check` → test → build → `check:csp`; the pre-push line adds `npm run build && npm run check:csp`. `README.md`: add `npm run check:csp` to Available Scripts, update the `npm test` line's pattern, and the CI paragraph (line 48) names the check.

#### 2. Dependabot comment

**File**: `.github/dependabot.yml`

**Intent**: A dependency bump (Astro above all) that moves or drops the meta is now caught; say so where the review every bump gets is described.

**Contract**: Header comment (lines 3-6) adds the built-page CSP check to the list.

#### 3. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Turn §6.4 from TBD into the pattern for adding a built-artifact check, and record what this phase landed.

**Contract**: §4 "unit" row: discovery is `src/**/*.test.ts` and `scripts/**/*.test.ts`. §4 "built artifact" row: tool is `scripts/check-built-csp.ts` with `parse5` 8.0.x, run by `npm run check:csp`, with a `checked: <date>`. §5 "built-artifact CSP check" row: Required? = required. §6.1 "Location" bullet: name `scripts/**/*.test.ts` as the second discovered pattern, for build tooling. §6.4: pure decision module in `scripts/` tested by a fixture table (one row per loosening, outcomes from the oracle, never from `dist/` or config), thin CLI over `dist/`, a named step after `npm run build` in both gates (with the dashboard timing rule), red proven by a local loosening and on a PR; reference `scripts/csp/check-page.test.ts`. §6.5: a "§3 Phase 4" note listing what landed, the stated limit (serve-time injection stays the manual R4 gate) and the hand-offs. §3 row 4 status is left for archiving.

### Success Criteria:

#### Automated Verification:

- Formatting passes on the edited markdown and YAML: `npx prettier --check PROJECT_RULES.md README.md context/foundation/test-plan.md context/deployment/deploy-plan.md .github/dependabot.yml`
- No doc still claims Vitest discovers `src/**/*.test.ts` only: `grep -rn "discovers \`src/\*\*/\*.test.ts\` only" PROJECT_RULES.md README.md context/foundation/test-plan.md` finds nothing
- Linting passes: `npm run lint`

#### Manual Verification:

- `PROJECT_RULES.md`, `README.md`, `ci.yml`, `deploy-plan.md` and test-plan §5 name the same gate order and the same command
- Test-plan §6.4 lets a reader add a new built-artifact check without reading this plan

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `scripts/csp/check-page.test.ts`: one `it.each` row per oracle rule and failure path (rows a–g from research, plus unsafe keywords, nonces, report endpoints, meta placement and count, empty build), and two passing pages. Hermetic: HTML strings only.

### Integration Tests:

- Real artifact: `npm run build && npm run check:csp` on today's tree (green), after a config loosening (red), after an element before the meta with the config unchanged (red), and with no `dist/` (red).
- Real gates: a loosened commit on the PR turns `ci` and `Workers Builds: critical-path` red; its revert turns both green.

### Manual Testing Steps:

1. Read the fixture table and confirm each row's expected outcome follows from the oracle in this plan.
2. Confirm the dashboard build command matches `deploy-plan.md` step 7 character for character.
3. Open the Workers Builds logs for the loosened commit and its revert and confirm the check ran after the build in both.

## Performance Considerations

Two small HTML pages are parsed per build; the check adds well under a second to each gate.

## Migration Notes

None. The change adds a gate; no data or app behaviour changes. Rollback is removing the `ci.yml` step and the dashboard suffix together (dashboard first, as with the edit).

## References

- Related research: `context/changes/testing-csp-artifact-check/research.md`
- Risk and guidance: `context/foundation/test-plan.md` §2 Risk #7, §3 Phase 4, §4, §5
- Precedent for gate wiring and red proof: `context/archive/2026-09-26-domain-test-gate/plan.md:45-49`, `plan-brief.md:22`
- CSP config: `astro.config.mjs:32-56`
- Meta placement: `node_modules/astro/dist/runtime/server/render/head.js:25-40`
- Workers Builds command: `context/deployment/deploy-plan.md:135,150,256`
- Lessons: `context/foundation/lessons.md` ("Verify the artifact, not the config", "Pin the build's input set")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Checker and fixture tests

#### Automated

- [x] 1.1 Clean install succeeds with the updated lockfile: `npm ci` — f6593d3
- [x] 1.2 `npx vitest list` lists every existing `src/**/*.test.ts` test plus `scripts/csp/check-page.test.ts`, and nothing from `node_modules`, `.claude/` or `dist/` — f6593d3
- [x] 1.3 `npm test` passes, including every fixture row — f6593d3
- [x] 1.4 Breaking one rule in `check-page.ts` (e.g. letting host sources through) makes `npm test` exit non-zero (reverted afterwards) — f6593d3
- [x] 1.5 Linting passes: `npm run lint` — f6593d3
- [x] 1.6 Type check passes: `npx astro check` — f6593d3
- [x] 1.7 `npm run build && npm run check:csp` exits 0 and reports 2 pages — f6593d3
- [x] 1.8 With `connect-src 'self' https://example.com` in `astro.config.mjs`, `npm run build && npm run check:csp` exits non-zero naming both pages (reverted afterwards) — f6593d3
- [x] 1.9 With `<script src="https://example.com/a.js"></script>` as the first child of `<head>` in `src/layouts/Layout.astro` and the config unchanged, `npm run build && npm run check:csp` exits non-zero (reverted afterwards) — f6593d3
- [x] 1.10 After both reverts, `git diff --exit-code astro.config.mjs src/layouts/Layout.astro` is clean and `npm run build && npm run check:csp` exits 0 again — f6593d3
- [x] 1.11 With `dist/` removed, `npm run check:csp` exits non-zero — f6593d3

#### Manual

- [x] 1.12 The fixture table reads as the oracle: each row name says which loosening it is, and no expected value is derived from `dist/` or the config — f6593d3

### Phase 2: Wire both gates and prove the block

#### Automated

- [x] 2.1 `ci.yml` runs `npm run check:csp` as the step after `npm run build`: `grep -A1 "npm run build" .github/workflows/ci.yml` — d452a2c
- [x] 2.2 Linting passes: `npm run lint` — d452a2c
- [x] 2.3 On the PR, the loosened commit's `ci` run fails at the `check:csp` step: `gh pr checks` — d452a2c
- [x] 2.4 On the PR, the revert's `ci` run passes: `gh pr checks` — d452a2c

#### Manual

- [x] 2.5 The Workers Builds dashboard build command ends with `&& npm run check:csp` and matches `deploy-plan.md` step 7 exactly — d452a2c
- [x] 2.6 The loosened commit's Workers Builds log shows the check failing after the build, and no preview version was uploaded for it — d452a2c
- [x] 2.7 The revert's Workers Builds log shows `CSP check passed: 2 page(s)` and a preview version was uploaded — d452a2c

### Phase 3: Docs and cookbook

#### Automated

- [ ] 3.1 Formatting passes on the edited markdown and YAML: `npx prettier --check PROJECT_RULES.md README.md context/foundation/test-plan.md context/deployment/deploy-plan.md .github/dependabot.yml`
- [ ] 3.2 No doc still claims Vitest discovers `src/**/*.test.ts` only: `grep -rn "discovers \`src/\*\*/\*.test.ts\` only" PROJECT_RULES.md README.md context/foundation/test-plan.md` finds nothing
- [ ] 3.3 Linting passes: `npm run lint`

#### Manual

- [ ] 3.4 `PROJECT_RULES.md`, `README.md`, `ci.yml`, `deploy-plan.md` and test-plan §5 name the same gate order and the same command
- [ ] 3.5 Test-plan §6.4 lets a reader add a new built-artifact check without reading this plan
