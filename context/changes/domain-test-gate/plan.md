# Domain-Rule Verification Gate Implementation Plan

## Overview

Add Vitest as the runner for pure domain-logic checks, keep test files out of the production build's input set, and run `npm test` in both quality gates — the GitHub `ci` job and the Cloudflare Workers Builds build command — so a failing rule check blocks both a merge and a deploy. Delivers roadmap item F-01 (`domain-test-gate`, GitHub issue #14) with one smoke check and a demonstrated failing run; no rule test suites are written ahead of the slices that own the rules.

## Current State Analysis

- No test runner exists: `package.json` has no `test` script and no runner dependency; `PROJECT_RULES.md` (Testing) states `npm test` does not exist.
- The pre-merge gate is `.github/workflows/ci.yml:26-30`: `npm ci` → `npx astro sync` → `npm run lint` → `npx astro check` → `npm run build`.
- The deploy gate is the Cloudflare Workers Builds build command, configured in the dashboard, not the repo: `npx astro sync && npm run lint && npx astro check && npm run build` (`context/deployment/deploy-plan.md:135`). It duplicates `ci.yml` on purpose because Workers Builds does not wait for GitHub Actions (R15, `deploy-plan.md:150`).
- Both gates already block merges: `main` branch protection requires the status checks `ci` and `Workers Builds: critical-path` (verified via `gh api …/branches/main/protection`; also `deploy-plan.md:168`). No GitHub settings change is needed.
- Vite in the tree is 8.3.0; Vitest 5 peers `vite ^6.4 || ^7 || ^8` and supports Node `^24`. Astro exports `getViteConfig` from `astro/config` (`node_modules/astro/dist/config/index.d.ts:13`).
- Tailwind's input set is pinned: `src/styles/global.css:5,8` disables auto-detection and uses `@source "../**/*.{astro,ts,tsx}"` — i.e. every `.ts` under `src/`, which would include colocated `*.test.ts` files.
- `tsconfig.json` includes `**/*`, so test files and `vitest.config.ts` are linted with type-checked rules and checked by `astro check`.

## Desired End State

- `npm test` runs Vitest once (`vitest run`) over exactly the files matching `src/**/*.test.ts`, resolving the `@/` alias the same way the app does.
- One colocated smoke test in `src/lib/services/` passes.
- Test files cannot influence `dist/`: the probe class in the smoke test is absent from the built CSS, and editing a test file leaves the CSS asset filename unchanged.
- `ci.yml` and the Cloudflare build command both run `npm test` after `astro check` and before `build`, in the same order.
- A deliberately failing test was observed turning both `ci` and `Workers Builds: critical-path` red on a PR, and green again after revert.
- `PROJECT_RULES.md`, `README.md` and `deploy-plan.md` describe the new gate.

### Key Discoveries:

- Deploy gate lives in the Cloudflare dashboard — `context/deployment/deploy-plan.md:135`; editing it is a human-only step.
- Tailwind scans all `src/**/*.ts` — `src/styles/global.css:8`; colocated tests need an explicit `@source not` exclusion (lesson "Pin the build's input set").
- Required checks `ci` and `Workers Builds: critical-path` already gate `main` — `deploy-plan.md:168`.
- ESLint already type-checks everything in `tsconfig`'s `**/*` — `eslint.config.js:17-24`; no test-specific ESLint config is needed.

## What We're NOT Doing

- No domain rule tests (cycles, Done rules, forecast worked examples, round-trip) — each slice (S-01…S-07) writes its own.
- No coverage tooling, thresholds, watch-mode scripts, UI mode, jsdom/happy-dom or component tests — the gate is for pure domain logic.
- No top-level `tests/` directory — tests are colocated.
- No single `verify` script and no folding tests into `npm run build`; each gate stays a named step in both places.
- No change to the manual deploy path (`npm run build && npx wrangler deploy`) — it already bypasses lint and type check.
- No GitHub branch-protection changes — both required checks already exist.
- Not marking F-01 `done` in the roadmap — that happens at closure (`/10x-archive`) after merge.

## Implementation Approach

Configure Vitest through Astro's `getViteConfig` so tests see the same Vite pipeline and `@/` alias as the app, and pin its `include` so discovery cannot widen silently. Exclude test files from Tailwind's `@source` glob, and prove both pins by reading the built artifact rather than the config. Add `npm test` to `ci.yml` in the repo (phase 1), then have the human add the same step to the dashboard build command right before merge, and demonstrate on the PR that a failing test turns both required checks red (phase 2).

## Critical Implementation Details

**Timing & lifecycle.** The dashboard build command applies to every branch at once. If `npm test` is added to it while `main` has no `test` script, any `main` build fails with `Missing script: "test"`. Edit the dashboard only while the phase 1 PR is open and ready, and merge it promptly; the PR's own preview build only runs tests after the edit, so the failing-test proof must be pushed after the edit.

## Phase 1: Runner and repo-side gate

### Overview

Install and configure Vitest, add the smoke test, keep tests out of the build input, wire `npm test` into `ci.yml`, and update project docs. Everything here is agent-verifiable locally.

### Changes Required:

#### 1. Dependency and script

**File**: `package.json`, `package-lock.json`

**Intent**: Add Vitest as a devDependency and expose a single-run `test` script that CI, the Cloudflare build and developers all call.

**Contract**: `devDependencies.vitest` at `^5`; `scripts.test` = `vitest run`. Installed via `npm i -D vitest`, so the lockfile updates and `npm ci` stays clean.

#### 2. Vitest configuration

**File**: `vitest.config.ts` (new, repo root)

**Intent**: Run tests with the app's own Vite configuration (alias, TS transform) and pin the discovered input set to colocated test files under `src/`.

**Contract**: Default export from Astro's `getViteConfig`; `test.include` is exactly `["src/**/*.test.ts"]`; environment stays Vitest's default `node`. Vitest's default failure on "no test files found" is kept, so an empty include fails the gate rather than passing vacuously.

```ts
/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: { include: ["src/**/*.test.ts"] },
});
```

#### 3. Tailwind input exclusion

**File**: `src/styles/global.css`

**Intent**: Keep test files out of Tailwind's scanned sources so strings in tests can never compile into the production CSS (lesson "Pin the build's input set").

**Contract**: Add `@source not "../**/*.test.ts";` directly after the existing `@source "../**/*.{astro,ts,tsx}";` line, with a short comment in the file's existing style saying why.

#### 4. Smoke test

**File**: `src/lib/services/smoke.test.ts` (new)

**Intent**: Prove the runner works end to end: TS compiles, the `@/` alias resolves, an assertion runs, and a Tailwind class name inside a test does not reach the build.

**Contract**: One `describe`/`it` that imports `cn` from `@/lib/utils` and asserts it merges a conflicting pair into the expected string, using a probe class that appears nowhere else in `src/` (e.g. `bg-fuchsia-950`). A top-of-file comment says it is the F-01 gate smoke check and names the probe class. It must pass `npm run lint` with no disables.

#### 5. Pre-merge gate

**File**: `.github/workflows/ci.yml`

**Intent**: Run domain checks in the required `ci` job, so a failing test blocks merge.

**Contract**: New step `- run: npm test` between `npx astro check` and `npm run build`. Job name `ci` unchanged (it is the required status-check context).

#### 6. Project docs

**File**: `PROJECT_RULES.md`, `README.md`, `.github/dependabot.yml`

**Intent**: Replace the "no test runner" statement with the new gate so future agents write tests instead of assuming none run.

**Contract**:
- `PROJECT_RULES.md` `## Commands`: add `npm test` — Vitest, single run, pure domain logic.
- `PROJECT_RULES.md` `## Testing`: tests are colocated as `src/**/*.test.ts` (the only pattern Vitest discovers and Tailwind ignores); domain logic lives in `src/lib/services/`; CI gate is `astro sync` → lint → `astro check` → test → build, run both in `ci.yml` and in the Cloudflare build command; run `npm run lint && npx astro check && npm test` before pushing.
- `README.md` `## Available Scripts`: add `npm test`.
- `.github/dependabot.yml` header comment (lines 3-6): drop "instead of a test suite" and name `npm test` among the checks every Dependabot PR must pass.

### Success Criteria:

#### Automated Verification:

- Clean install succeeds with the updated lockfile: `npm ci`
- `npm test` passes and `npx vitest list` lists only the tests in `src/lib/services/smoke.test.ts`
- A temporarily broken assertion in the smoke test makes `npm test` exit non-zero (reverted afterwards)
- Linting passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- Probe class is absent from the built CSS: `grep -r "fuchsia-950" dist/` finds nothing
- Editing only the smoke test and rebuilding leaves the `dist/_astro/*.css` filename unchanged

#### Manual Verification:

- `PROJECT_RULES.md` Testing/Commands and `README.md` scripts read correctly and name the same test pattern and gate order as the config

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Deploy gate and proven block

### Overview

Add `npm test` to the Cloudflare build command (human-only dashboard edit), record it in the deploy plan, and prove on the PR that a failing test blocks both required checks before merging.

### Changes Required:

#### 1. Cloudflare Workers Builds build command (dashboard, human-only)

**File**: Cloudflare dashboard → Workers & Pages → `critical-path` → Settings → Builds

**Intent**: Make the deploy build run domain checks so a failing test cannot deploy (R15 still applies: Workers Builds does not wait for `ci`).

**Contract**: Build command becomes `npx astro sync && npm run lint && npx astro check && npm test && npm run build` — same order as `ci.yml`. Deploy commands unchanged. Do this only once the phase 1 PR is open (see Critical Implementation Details).

#### 2. Deploy plan record

**File**: `context/deployment/deploy-plan.md`

**Intent**: Keep the repo's record of the dashboard state accurate, so the dashboard value is never the only source of truth.

**Contract**: Update the step 7 table's `Build command` row to the new value. Extend the paragraph at line 150 to say the build command also runs `npm test` (F-01), with the date of the edit. Add a Known edge case: `Missing script: "test"` on a `main` build means the dashboard was edited before the `test` script reached `main`.

#### 3. Proof that the gate blocks

**File**: PR branch only (throwaway commit)

**Intent**: Verify that the gate blocks by watching it fail, not by reading the config (lesson "Verify the artifact, not the config").

**Contract**: After the dashboard edit, push a commit that makes the smoke test fail. Observe both `ci` and `Workers Builds: critical-path` fail at the test step, and merging blocked. Then push a revert and observe both go green. Squash merge with `Closes #14` in the PR body, so the throwaway commit never reaches `main`.

### Success Criteria:

#### Automated Verification:

- `deploy-plan.md` build-command row equals the `ci.yml` step order: `grep -n "npm test && npm run build" context/deployment/deploy-plan.md` matches
- Markdown formatting is clean: `npx prettier --check context/deployment/deploy-plan.md PROJECT_RULES.md README.md`

#### Manual Verification:

- Cloudflare dashboard build command reads `npx astro sync && npm run lint && npx astro check && npm test && npm run build`
- With the failing-test commit pushed, `ci` fails at the `npm test` step, `Workers Builds: critical-path` fails in its build log at the test step, and the PR merge button is blocked
- After the revert commit, both checks are green
- After the squash merge with `Closes #14`, the `main` Workers build log shows the test step ran, `npx wrangler deployments status` shows the new version tagged with the merge commit, and issue #14 is closed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- One smoke test only (`src/lib/services/smoke.test.ts`); rule tests belong to the slices that own each rule.

### Integration Tests:

- None. The "integration" check is the gate itself: a failing test observed in both required checks on a PR.

### Manual Testing Steps:

1. Open the phase 1 PR; confirm the `ci` job shows an `npm test` step that passes.
2. Edit the Cloudflare build command; push a failing-test commit; confirm both checks go red and merging is blocked.
3. Push the revert; confirm both go green; squash merge with `Closes #14`.
4. Confirm the production build ran tests and deployed (`npx wrangler deployments status`).

## Performance Considerations

Vitest adds a few seconds to each CI and Workers build; acceptable. Tests run before `build`, so a failing check fails fast.

## Migration Notes

None — additive. To roll back, remove `npm test` from the dashboard build command first, then revert the commit on `main`; the reverse order breaks `main` builds for the reason in Critical Implementation Details.

## References

- Roadmap item: `context/foundation/roadmap.md` — F-01 `domain-test-gate`
- Pre-merge gate: `.github/workflows/ci.yml:26-30`
- Deploy gate and R15: `context/deployment/deploy-plan.md:135`, `:150`, `:168`
- Tailwind input pin: `src/styles/global.css:5-8`
- Lessons: `context/foundation/lessons.md` — "Verify the artifact, not the config", "Pin the build's input set"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runner and repo-side gate

#### Automated

- [x] 1.1 Clean install succeeds with the updated lockfile: `npm ci`
- [x] 1.2 `npm test` passes and `npx vitest list` lists only the tests in `src/lib/services/smoke.test.ts`
- [x] 1.3 A temporarily broken assertion in the smoke test makes `npm test` exit non-zero (reverted afterwards)
- [x] 1.4 Linting passes: `npm run lint`
- [x] 1.5 Type check passes: `npx astro check`
- [x] 1.6 Build passes: `npm run build`
- [x] 1.7 Probe class is absent from the built CSS: `grep -r "fuchsia-950" dist/` finds nothing
- [x] 1.8 Editing only the smoke test and rebuilding leaves the `dist/_astro/*.css` filename unchanged

#### Manual

- [x] 1.9 `PROJECT_RULES.md` Testing/Commands and `README.md` scripts read correctly and name the same test pattern and gate order as the config

### Phase 2: Deploy gate and proven block

#### Automated

- [ ] 2.1 `deploy-plan.md` build-command row equals the `ci.yml` step order: `grep -n "npm test && npm run build" context/deployment/deploy-plan.md` matches
- [ ] 2.2 Markdown formatting is clean: `npx prettier --check context/deployment/deploy-plan.md PROJECT_RULES.md README.md`

#### Manual

- [ ] 2.3 Cloudflare dashboard build command reads `npx astro sync && npm run lint && npx astro check && npm test && npm run build`
- [ ] 2.4 With the failing-test commit pushed, `ci` fails at the `npm test` step, `Workers Builds: critical-path` fails in its build log at the test step, and the PR merge button is blocked
- [ ] 2.5 After the revert commit, both checks are green
- [ ] 2.6 After the squash merge with `Closes #14`, the `main` Workers build log shows the test step ran, `npx wrangler deployments status` shows the new version tagged with the merge commit, and issue #14 is closed
