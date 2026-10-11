---
date: 2026-10-11T13:13:07+0200
researcher: Claude (Opus 5.5) with RemekGdansk
git_commit: 2b978a6
branch: main
repository: critical-path
topic: "Ground rollout Phase 4 of test-plan.md — built-artifact CSP guarantee (Risk #7)"
tags: [research, codebase, csp, astro, build, ci, workers-builds, test-plan-phase-4]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (Opus 5.5)
---

# Research: Built-artifact CSP guarantee (test-plan Phase 4, Risk #7)

**Date**: 2026-10-11T13:13:07+0200
**Researcher**: Claude (Opus 5.5) with RemekGdansk
**Git Commit**: 2b978a6 (working tree: `context/foundation/test-plan.md` §3 row 4 modified, uncommitted)
**Branch**: main
**Repository**: critical-path

## Research Question

Ground rollout Phase 4 of `context/foundation/test-plan.md` ("Built-artifact guarantee"). Risk #7: project data leaves the device because the CSP is loosened, or never reaches the served page, while every gate stays green. Verify the response guidance — prove every built page carries a CSP with `connect-src 'none'` and no third-party origins, and that the check fails when the policy is loosened; challenge "the Astro config has a CSP, so the served page has it"; avoid asserting the config object instead of the built HTML. Settle: which built pages exist and whether each gets its own meta CSP; whether the serving layer adds or strips a CSP; where a post-build check can run in both gates, given `npm test` runs before the build; how to prove the check goes red.

## Summary

- **The guarantee lives in the HTML, not in a header.** In the build of `2b978a6` (`npm run build`, run once during this research), `dist/` holds 2 HTML pages, `index.html` and `404.html`. Each holds exactly 1 `<meta http-equiv="content-security-policy">` carrying the 9 configured directives (`default-src 'none'` … `form-action 'none'`, including `connect-src 'none'`), followed by Astro's `script-src 'self'` + 7 hashes and `style-src 'self'` + 2 hashes. No `http(s)://` URL appears in either page.
- **The response guidance holds, and the "config ⇒ served page" assumption is falsifiable on at least three inspected paths** where the config still reads `connect-src 'none'` but the HTML does not carry it: (1) an adapter with `staticHeaders` moves the CSP out of the HTML (`cspDestination: "adapter"`, `node_modules/astro/dist/core/build/plugins/plugin-manifest.js:237`; Astro docs: "the `<meta>` element is not added to the static page"); (2) `security.csp` absent or `false` stops injection (`node_modules/astro/dist/core/csp/common.js:7-9`, `plugin-manifest.js:306`); (3) the meta is emitted when Astro flushes head content, after the author's own `<head>` children (`node_modules/astro/dist/runtime/server/render/head.js:25-40`; in the built `index.html` it follows `<link rel="icon">` and `<title>`). The HTML spec does not apply a meta CSP to elements that come before it, so a third-party `<script src>` written at the top of `src/layouts/Layout.astro` would run outside the policy while the config is unchanged.
- **`connect-src 'none'` alone is not the whole guarantee.** `img-src`, `font-src`, `script-src`, `style-src` and `form-action` are also ways for data to leave the page (a third-party `img-src` permits a pixel beacon). The "no third-party origins" half of the guidance must be checked on every directive, not only `connect-src`.
- **Cheapest useful layer: a post-build Node check over `dist/**/*.html`, plus hermetic unit tests of its decision function on HTML fixtures.** It cannot live in the current `npm test` step, because `npm test` runs before `npm run build` in both gates (`.github/workflows/ci.yml:28-29`, `context/deployment/deploy-plan.md:135`). "Fails when loosened" is proved twice: fixture rows for each loosening in Vitest, and one end-to-end demonstration (loosen `astro.config.mjs`, build, check exits non-zero, revert), the same way F-01 demonstrated its failing test.
- **Serving layer:** Cloudflare adds a header CSP `frame-ancestors 'none'` from `public/_headers:23`. Browsers enforce both policies, so a header cannot loosen the meta policy. Workers static assets serve `dist/` with no entrypoint (`wrangler.jsonc`, no `main`). What the post-build check cannot see is HTML injected by the platform at serve time (deploy-plan P4, Web Analytics). That stays with the existing manual R4/P4 gate — a stated limit, not something this phase can close inside a pre-deploy gate.
- **Gate wiring is a real plan choice** (see Open Questions): a separate named step in `ci.yml` plus a human edit of the Workers Builds dashboard command (the F-01 precedent), or an npm script attached to `npm run build`, which both gates already call (no dashboard edit, but the gate is less visible).

## Detailed Findings

### What the build emits (observed artifact, `2b978a6`)

- `npm run build` reports "2 page(s) built": `/404.html` and `/index.html`. `dist/` also holds `sitemap-index.xml`, `sitemap-0.xml`, `_headers`, `.assetsignore`, `favicon.png` and 4 files under `_astro/` (observed `find dist -type f`). The dev-only `/kitchen-sink` route is not in `dist/`; it is injected for `command === "dev"` only (`astro.config.mjs:15-17`).
- Meta CSP content in both pages (hashes elided): `default-src 'none';connect-src 'none';img-src 'self' data:;font-src 'self' data:;manifest-src 'self';object-src 'none';worker-src 'none';base-uri 'none';form-action 'none'; script-src 'self' 'sha256-…'×7; style-src 'self' 'sha256-…'×2;`. The first 9 directives come from the config in order (`astro.config.mjs:41-54`); `script-src`/`style-src` are appended by Astro.
- `404.html` carries the same CSP as `index.html`, including the script hashes, although it has no `<script>` element. Under this build, Astro applies the policy per page, not per page's own scripts.
- Head order in both pages: `<meta charset>`, `<meta name="viewport">`, `<link rel="icon" href="/favicon.png">`, `<title>`, **CSP meta**, `<link rel="stylesheet" href="/_astro/…css">`, then (index only) `<style>`, 2 inline `<script>`s and the `<astro-island>` (the `component-url` and `renderer-url` point to `/_astro/…`). The only element before the meta that loads anything is the same-origin favicon, so no egress today. The ordering is a property the check should pin (see the failure paths below).
- External URLs: no `http://` or `https://` occurrence in either HTML file (observed grep). The React Flow attribution `<a href="https://reactflow.dev…">` is rendered client-side by the bundle, not present in built HTML (`context/archive/2026-09-27-capture-task-graph/research.md:34`); it is navigation, not a connection.

### Where Astro decides whether and where the CSP goes (Astro 7.3.5, inspected)

- Injection condition for meta: `result.shouldInjectCspMetaTags && result.cspDestination === "meta"` (`node_modules/astro/dist/runtime/server/render/head.js:28`).
- `shouldInjectCspMetaTags` is `shouldTrackCspHashes(security.csp)` (`node_modules/astro/dist/core/build/plugins/plugin-manifest.js:306`), which is true only for `csp === true` or an object (`node_modules/astro/dist/core/csp/common.js:7-9`). Removing `security.csp`, or setting it to `false`, emits a page with no meta and builds green.
- `cspDestination` is `"adapter"` when `settings.adapter?.adapterFeatures?.staticHeaders` is set (`plugin-manifest.js:237`), otherwise `"meta"` for prerendered routes (`node_modules/astro/dist/core/fetch/fetch-state.js:337`). Astro docs (Context7 `/withastro/docs`, adapter reference "staticHeaders"): with it enabled, "the `<meta http-equiv="content-security-policy">` element is not added to the static page", and its content goes to `routeToHeaders`. Adding `@astrojs/cloudflare` — which deploy-plan says was deliberately not installed (`context/deployment/deploy-plan.md`, "Repository state — done") — is the concrete route by which the policy would leave the HTML while the config text stays identical.
- Error pages built through the build environment set `injectCspMetaTagsOnErrorPages: false` (`node_modules/astro/dist/core/build/environment.js:138`). The prerendered `404.html` observed above still carries the meta, so this flag does not affect it in this build. It does show that "every page gets a meta" is a build-path property, not a config guarantee, which is why the check must enumerate `dist/**/*.html` rather than trust a fixed list.
- Placement: `renderAllHeadContent` emits the CSP meta first among Astro's injected head content (styles and scripts follow, `head.js:41-50`), but after whatever the author wrote literally in `<head>` (`src/layouts/Layout.astro` lines with charset, viewport, icon, title). An author-written external `<script src>` or `<link rel="stylesheet" href="https://…">` placed in the layout `<head>` would precede the meta.

### Failure paths for Risk #7 (config says `connect-src 'none'`, gates stay green)

Today's gates (`ci.yml:24-29`; Workers Builds command at `deploy-plan.md:135`) run sync, lint, `astro check`, `npm test` and build. None of them reads `dist/` for the CSP. Each path below builds green on the current gates:

| #   | Change                                                                               | Effect in `dist/`                                                    | Config still reads `connect-src 'none'`?    |
| --- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------- |
| a   | Directive loosened, e.g. `connect-src 'self' https://x`                              | meta carries the loosened directive                                  | no — a config assertion would also catch it |
| b   | `security.csp` removed / `false`                                                     | no meta                                                              | no directive at all                         |
| c   | Adapter with `staticHeaders` added                                                   | no meta; policy only in adapter output                               | yes                                         |
| d   | Third-party origin added to another directive (`img-src https://x`)                  | meta allows a pixel beacon                                           | yes                                         |
| e   | Third-party `<script src>` / `<link href>` written at the top of the layout `<head>` | element precedes the meta, outside the policy                        | yes                                         |
| f   | A second `connect-src` added after the first                                         | depends on order; CSP3 ignores a repeated directive (first one wins) | yes                                         |
| g   | A new page or layout that bypasses Astro's head rendering                            | page without meta                                                    | yes                                         |

Rows c–g are the ones an assertion on the config object would miss. That confirms the guidance's anti-pattern. Rows a, b and d are what "check fails when loosened" must cover at minimum. Row f means the checker must parse directives with first-occurrence semantics, not "last wins" or a substring search. Row (f) was reasoned from the CSP spec, not built and observed.

### Oracle for the check (from sources, not from the current output)

From the PRD guardrail, `PROJECT_RULES.md` hard rule and `astro.config.mjs:43-45` comment ("no fetch, XHR, WebSocket, sendBeacon or EventSource"), plus test-plan §2 Risk Response Guidance for #7 (`context/foundation/test-plan.md:45`):

1. `dist/` contains at least 1 HTML file. A vacuous pass on 0 files is a failure, not a pass.
2. Every `dist/**/*.html` contains exactly 1 `<meta http-equiv="content-security-policy">` inside `<head>`.
3. In it, the first `connect-src` directive has exactly the source list `'none'`, and `default-src` is `'none'`. Requiring the literal `connect-src 'none'` is stricter than CSP semantics (deleting it would still fall back to `default-src 'none'`). It matches the project rule that names that directive as load-bearing.
4. No directive has a source expression other than the keywords `'self'`/`'none'`, hash sources (`'sha256-…'`), and the `data:` scheme. Any host source, `*`, or `http:`/`https:`/`ws:`/`wss:` scheme is a third-party origin. `'unsafe-inline'`/`'unsafe-eval'` are not origins, but deploy-plan D3 records the policy as needing neither, so the plan may choose to reject them too.
5. No element that fetches a resource (`script[src]`, `link[href]` with a fetching `rel`, `img`, `iframe`, `object`, `embed`, `base`) comes before the CSP meta in document order, and no such element anywhere references an absolute `http(s):` or protocol-relative `//` URL.

The expected values are literals from these sources. They must not be read back from `astro.config.mjs` at test time: a check that imports the config and compares it to the HTML would pass rows a/b/d whenever both sides are loosened together.

### Serving layer (Cloudflare Workers static assets)

- `wrangler.jsonc` defines an assets-only Worker (no `main`), `assets.directory: "./dist/"`. Requests execute no user code (`deploy-plan.md`, "There are no request logs").
- `public/_headers:19-23` adds `Content-Security-Policy: frame-ancestors 'none'` to `/*`. The comment at `public/_headers:5-10` records that browsers enforce the intersection of meta and header policies. A header policy can therefore add restrictions but cannot loosen the meta. Loosening must happen in the HTML — which is what the post-build check reads.
- Not visible to any build-time check: serve-time HTML injection by platform features (Web Analytics etc.). It is owned by deploy-plan P4 (`deploy-plan.md:236`) and the manual R4 browser gate (step 5, unchecked). `deploy-plan.md:256`'s backstop ("an injected beacon would be blocked by `script-src 'self'`") holds for an injection placed after the meta; it would not hold for one placed before it (row e). That historical sentence is partly supported.
- `npm run preview` serves the HTML but no headers (`deploy-plan.md`, Day-to-day operations), so it shows the meta half only. Neither gate can fetch the deployed page before deploy: GitHub Actions holds no Cloudflare credentials (D1), and Workers Builds deploys after the build command.

### Gate placement

- `ci.yml:28-29`: `npm test` then `npm run build` is the last step. A check on `dist/` must be a step after line 29.
- Workers Builds build command (`deploy-plan.md:135`): `npx astro sync && npm run lint && npx astro check && npm test && npm run build`. It lives only in the dashboard, with "no trace in git" (`deploy-plan.md`, step 9). Any `&&`-appended step requires a human dashboard edit, timed like F-01's: edit only while the PR adding the script is open, or every `main` build fails on a missing script (`context/archive/2026-09-26-domain-test-gate/plan.md:49`).
- Alternative without a dashboard edit: both gates already call `npm run build`. Either an npm `postbuild` lifecycle script (runs after `build` by default; no `.npmrc` in the repo sets `ignore-scripts`) or `"build": "astro build && node scripts/…"` would run the check in both gates and on every local build. Trade-off: the F-01 plan brief chose explicit per-gate steps "so each gate is visible by name" (`context/archive/2026-09-26-domain-test-gate/plan-brief.md:22`).
- Either way, whether the check actually runs in Workers Builds can only be shown by a deliberately failing PR build (as F-01 did), not by reading the repo.

### Where the checker and its tests can live

- Vitest discovers `src/**/*.test.ts` only (`vitest.config.ts:6`). A checker under `scripts/` (the existing home of `sync-roadmap.mjs`) would need either a widened `include` (lesson "Pin the build's input set": widen deliberately and verify) or its pure decision function placed under `src/`.
- Tailwind scans `src/**/*.{astro,ts,tsx}` except tests and `src/dev/` (`src/styles/global.css:10-17`). `scripts/` is outside that scan.
- ESLint lints `scripts/**/*.mjs` with type checking disabled and Node globals (`eslint.config.js:108-112`). `tsconfig.json` includes `**/*`, so `astro check` covers `.ts` anywhere outside `dist`.
- HTML parsing: `ultrahtml@1.7.0` is present only as a transitive dependency of `astro` and `@astrojs/react` (`npm ls`). It is not a direct dependency and cannot be relied on. The choice is between adding a direct dev dependency (a parser) or a narrow, documented regex over Astro's deterministic output. A parser handles rows e and g (document order, head scoping) more honestly.

## Code References

- `astro.config.mjs:15-17` — kitchen sink injected only under `astro dev`
- `astro.config.mjs:28-29` — `output: "static"`, integrations (no adapter)
- `astro.config.mjs:40-54` — `security.csp.directives`, including `connect-src 'none'` at :46
- `node_modules/astro/dist/runtime/server/render/head.js:25-40` — meta CSP injection condition and position
- `node_modules/astro/dist/core/csp/common.js:7-9` — `shouldTrackCspHashes`
- `node_modules/astro/dist/core/build/plugins/plugin-manifest.js:237,306` — `cspDestination: "adapter"` with `staticHeaders`; `shouldInjectCspMetaTags`
- `node_modules/astro/dist/core/fetch/fetch-state.js:337` — `"meta"` for prerendered routes
- `node_modules/astro/dist/core/build/environment.js:138` — `injectCspMetaTagsOnErrorPages: false`
- `src/layouts/Layout.astro` — author-written `<head>` children that precede the meta
- `public/_headers:19-23` — header CSP `frame-ancestors 'none'` only
- `wrangler.jsonc` — assets-only Worker serving `./dist/`
- `.github/workflows/ci.yml:24-29` — gate order; build is last
- `context/deployment/deploy-plan.md:135,150` — Workers Builds build command and why it duplicates CI
- `vitest.config.ts:6` — `include: ["src/**/*.test.ts"]`
- `eslint.config.js:108-112` — lint config for `scripts/**/*.mjs`

## Architecture Insights

- The project already treats "verify the artifact" as a rule (`context/foundation/lessons.md`, "Verify the artifact, not the config"). This phase turns the manual `npm run preview` + console check used by earlier slices into an automated check, but only for the meta half. The header half and serve-time injection remain deploy-time/manual.
- Both gates are deliberately kept identical (R15). A post-build check is the first gate that must come _after_ `npm run build`, which changes the shape of the duplicated command for the first time.
- The proof pattern from F-01 transfers directly: a probe that must be absent from `dist/` plus a demonstrated red run on a PR.

## Historical Context (from prior changes)

- `context/archive/2026-09-26-domain-test-gate/plan.md:45-49` — F-01 wired `npm test` into both gates as an explicit step, with a human dashboard edit timed to the open PR, and proved red on a deliberately failing test. Supported and directly reusable.
- `context/archive/2026-09-26-domain-test-gate/plan-brief.md:22` — "each gate visible by name" rationale for explicit steps. Supported (a decision, not a fact to re-verify).
- `context/archive/2026-09-27-capture-task-graph/research.md:30,48-54` — the built meta has no `'unsafe-inline'` (still true in today's build); React Flow bundles make no `fetch`/`Worker` calls (not re-verified here; out of scope).
- `context/archive/2026-10-04-planner-ui-contract/research.md:61` — Chrome DevTools' own `/.well-known/appspecific/com.chrome.devtools.json` request is a known CSP violation line. Relevant only to the manual R4 gate, not to the build check.
- `context/deployment/deploy-plan.md:256` — "an injected beacon would be blocked by `script-src 'self'`": partly supported (holds after the meta, not before it; see row e).

## Related Research

- `context/archive/2026-09-27-capture-task-graph/research.md` — CSP constraints on the React island
- `context/archive/2026-10-04-planner-ui-contract/research.md` — CSP console noise under preview

## Open Questions

1. **Gate wiring (plan decision, user's call):** explicit `ci.yml` step plus a dashboard edit to the Workers Builds command (visible, F-01 precedent, needs a human and timing), or attach the check to `npm run build` (`postbuild` or `&&`) so both gates and local builds run it with no dashboard edit (less visible as a named gate). Both satisfy "runs in both gates"; neither weakens it.
2. **Checker home and parser (plan decision):** `scripts/` with a widened Vitest `include`, or a pure decision function under `src/lib/`; a direct HTML-parser dev dependency or a documented regex. Recommended direction: a parser, because rows e and g depend on document order.
3. **Strictness of `'unsafe-inline'`/`'unsafe-eval'` (plan decision):** not a third-party origin, but D3 records the policy as needing neither; rejecting them makes the check also guard against a script-injection loosening.
4. **Row f behaviour in Astro (unobserved):** whether Astro deduplicates or reorders a repeated directive was not built and observed. The checker should implement first-occurrence semantics regardless; the end-to-end demonstration may observe it.
