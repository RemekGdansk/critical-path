# Built-Artifact CSP Check — Plan Brief

> Full plan: `context/changes/testing-csp-artifact-check/plan.md`
> Research: `context/changes/testing-csp-artifact-check/research.md`

## What & Why

Rollout Phase 4 of `context/foundation/test-plan.md`, Risk #7: project data could leave the device because the CSP is loosened, or never reaches the served page, while every gate stays green. Today no gate reads `dist/`; the guarantee rests on `astro.config.mjs`, and research found at least five ways (an adapter with `staticHeaders`, a third-party origin in another directive, an element before the meta, a repeated directive, a page bypassing Astro's head) for the built HTML to stop enforcing `connect-src 'none'` while the config still says it.

## Starting Point

The build emits `index.html` and `404.html`, each with exactly one CSP meta carrying the deny-list plus Astro's hashes, and no external URL. Both gates run sync → lint → `astro check` → `npm test` → build; `npm test` runs before the build, so the check needs its own step. The Workers Builds command lives only in the Cloudflare dashboard.

## Desired End State

`npm run check:csp` reads every built page and exits non-zero, naming page and rule, unless each one enforces a no-egress CSP. It runs as a named step right after `npm run build` in both GitHub Actions and Workers Builds, and a loosened commit on the PR was seen turning both red.

## Key Decisions Made

| Decision             | Choice                                                                                                                        | Why (1 sentence)                                                                                                   | Source   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| What is checked      | Built HTML only, against literal oracle rules; never the config                                                               | A config-vs-HTML comparison passes when both are loosened together (lesson "Verify the artifact, not the config"). | Research |
| Gate wiring          | Named `npm run check:csp` step after build in `ci.yml` and in the dashboard command                                           | F-01 precedent: each gate visible by name; the dashboard edit is when the red proof happens.                       | Plan     |
| Checker home         | Pure module + fixture test in `scripts/csp/`, CLI `scripts/check-built-csp.ts`, Vitest include widened by one                 | Build tooling stays out of `src/` and the Tailwind scan; widening is verified by `vitest list` probe.              | Plan     |
| Runtime              | `node scripts/check-built-csp.ts` via Node 24 native TypeScript                                                               | Observed working on 24.21.0; no build step or loader dependency.                                                   | Plan     |
| Parser               | `parse5` as a direct devDependency (plus `@types/node`)                                                                       | Browser-identical tree, so "inside `<head>`" and "before the meta" mean what the browser enforces.                 | Plan     |
| Allowlist            | Only `'self'`, `'none'`, sha256/384/512 hashes, `data:`; everything else fails, including unsafe-\*, nonces, report endpoints | Also catches script-injection loosening; deploy-plan D3 says the policy needs no unsafe-\*.                        | Plan     |
| Before the meta      | No `<script>` and no `<base>`; same-origin `<link rel="icon">` stays allowed                                                  | A meta CSP governs only what is parsed after it; the icon is a same-origin fetch already present today.            | Plan     |
| Repeated directive   | Any repeat fails                                                                                                              | CSP3 ignores the repeat, so it is dead text at best and read differently by another parser at worst.               | Research |
| Serve-time injection | Out of scope, stays the manual R4 gate                                                                                        | Neither gate can fetch the deployed page before deploy.                                                            | Research |

## Scope

**In scope:**

- Decision module, fixture table (one row per failure path), CLI and `check:csp` script
- Vitest include widened to `scripts/**/*.test.ts`, verified by probe
- `ci.yml` step, dashboard command edit, deploy-plan record and backstop correction
- Red proof: local loosening of config and of layout; loosened commit on the PR in both gates
- PROJECT_RULES, README, Dependabot comment, test-plan §4/§5/§6.1/§6.4/§6.5

**Out of scope:**

- Asserting or reading `astro.config.mjs`; checking `_headers` or sitemaps; checking the deployed page
- `postbuild` hook; guarding the manual `wrangler deploy` path; Stryker
- Any change to the CSP, `_headers` or app code; flipping test-plan §3 row 4 (done at archive)

## Architecture / Approach

`dist/**/*.html` → CLI reads files → `checkBuild(pages)` → `checkPage(html)` parses with `parse5`, finds the single CSP meta in `<head>`, splits directives, applies the oracle (no repeats, `default-src`/`connect-src` exactly `'none'`, strict allowlist on every token, nothing executable before the meta, no absolute or `//` URL on any non-`<a>` element) → violations to stderr and exit 1, or `CSP check passed: <n> page(s)`.

## Phases at a Glance

| Phase                                  | What it delivers                                                             | Key risk                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Checker and fixture tests           | Module, fixture table, CLI, script; local red on config and layout loosening | Fixture expectations copied from `dist/` instead of the oracle (mirror test) |
| 2. Wire both gates and prove the block | `ci.yml` step, dashboard edit, deploy-plan record, red then green on a PR    | Dashboard edited before the script reaches `main` breaks every `main` build  |
| 3. Docs and cookbook                   | Rules, README, Dependabot comment, test-plan §6.4 pattern and §6.5 note      | Docs drift from the actual gate order                                        |

**Prerequisites:** Cloudflare dashboard access for the build command edit; PR on GitHub with `ci` and `Workers Builds: critical-path` as required checks (already set).
**Estimated effort:** ~2 sessions across 3 phases (Phase 2 waits on CI and the human dashboard edit).

## Open Risks & Assumptions

- Node's native TypeScript stays unflagged on the 24.x line used by both gates; if a gate's Node lacks it, the CLI fails loudly rather than passing.
- A future Astro release could move the meta or change its attribute casing; the check would go red, which is the intended signal, and the fix is a reviewed change.
- Serve-time injection by the platform remains a manual gate (R4); this phase does not close it.

## Success Criteria (Summary)

- Every built page is proven, from the HTML, to forbid network egress, in both the merge and the deploy gate.
- Each known loosening has a fixture row that fails, and a real loosening was seen failing both gates on a PR.
- The next built-artifact check can be added from test-plan §6.4 alone.
