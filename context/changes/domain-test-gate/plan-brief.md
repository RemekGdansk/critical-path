# Domain-Rule Verification Gate — Plan Brief

> Full plan: `context/changes/domain-test-gate/plan.md`

## What & Why

Roadmap item F-01: automated checks of pure domain logic must be writable, runnable locally, and enforced in both the pre-merge gate and the deploy build. The PRD's rules — cycle rejection, Done rules, forecast worked examples, exact round-trip — can't be checked by today's lint/type-check/build gate, and every later slice needs a place to put its rule tests.

## Starting Point

There is no test runner and no `test` script. The gate is `astro sync → lint → astro check → build`, run in `.github/workflows/ci.yml` and again in the Cloudflare Workers Builds build command, which is set in the dashboard. `main` already requires both `ci` and `Workers Builds: critical-path` to pass.

## Desired End State

`npm test` runs Vitest over `src/**/*.test.ts`, and one smoke test passes. Test files provably don't affect `dist/`. Both required checks run `npm test` before `build`. A deliberately failing test was seen turning both checks red on a PR, and merging was blocked, before the PR merged with `Closes #14`.

## Key Decisions Made

| Decision          | Choice                                                         | Why (1 sentence)                                                                        |
| ----------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Runner            | Vitest 5 via Astro's `getViteConfig`                           | Same Vite pipeline and `@/` alias as the app, TS with no extra setup; compatible with Vite 8. |
| Deploy-gate wiring | Add `npm test` to `ci.yml` and to the dashboard build command | Mirrors the existing deliberate step-by-step duplication (R15); each gate visible by name. |
| Test location     | Colocated `src/**/*.test.ts`, excluded from Tailwind via `@source not` | Tests sit beside the rules they check; the exclusion keeps the build input pinned.      |
| Discovery pin     | `test.include = ["src/**/*.test.ts"]`, no-tests-found stays a failure | Lesson "Pin the build's input set": discovery can't widen or pass vacuously.           |
| Smoke check       | One passing test plus a demonstrated failing run on the PR     | Lesson "Verify the artifact, not the config": see the gate fail, don't assume it.        |

## Scope

**In scope:**

- `vitest` devDependency, `test` script, `vitest.config.ts`
- `@source not` exclusion in `global.css`, and the smoke test in `src/lib/services/`
- `npm test` step in `ci.yml`, plus a dashboard build-command edit (human)
- Updates to `PROJECT_RULES.md`, `README.md`, `deploy-plan.md` and the `dependabot.yml` header comment
- Failing-then-reverted proof on the PR

**Out of scope:**

- Any domain rule tests (owned by S-01…S-07)
- Coverage, watch/UI scripts, and DOM or component testing
- A combined `verify` script
- Tests in the manual deploy path
- Branch-protection changes
- Marking F-01 done (happens at `/10x-archive`)

## Architecture / Approach

Vitest reuses Astro's Vite config, so tests resolve imports exactly like the app. Two input pins, Vitest `include` and the Tailwind `@source not`, are checked against the built artifact: the smoke test carries a probe class (`bg-fuchsia-950`) that must never appear in `dist/`, and editing the test must not change the CSS asset filename. Both gates run `npm test` between `astro check` and `build`.

## Phases at a Glance

| Phase                              | What it delivers                                                           | Key risk                                                              |
| ---------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Runner and repo-side gate       | Vitest configured, smoke test, Tailwind exclusion, `ci.yml` step, docs     | Test files leaking into the CSS bundle — caught by the artifact probe  |
| 2. Deploy gate and proven block    | Dashboard build command runs tests; failing run observed; merged `Closes #14` | Dashboard edited before `test` reaches `main` → `main` builds fail    |

**Prerequisites:** Cloudflare dashboard access for the build-command edit; a PR branch for the phase 1 work.
**Estimated effort:** ~1 session: phase 1 is agent work, phase 2 is about 15 minutes of human dashboard and PR steps.

## Open Risks & Assumptions

- Dashboard timing: edit the build command only while the phase 1 PR is open, and merge promptly.
- Assumes Vitest 5 stays compatible with Astro 7's Vite 8. A future Astro Vite-major bump could need a matching Vitest bump, which Dependabot will propose.

## Success Criteria (Summary)

- A failing domain test blocks both merging (`ci`) and deploying (`Workers Builds: critical-path`), and this was observed, not assumed.
- Later slices can add `src/lib/services/*.test.ts` files and have them run in both gates with no further setup.
