---
bootstrapped_at: 2026-09-19T17:31:00Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: critical-path
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

# Bootstrap verification

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: critical-path
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

Critical Path is a single-user, browser-only planner: no login, no database, no server logic, no project data leaving the device, and it must keep working offline. A solo developer with a 3-week after-hours budget chose the custom path and asked for a stripped-down 10x Astro Starter rather than the full stack: keep Astro, React 19, TypeScript and Tailwind, but remove Supabase, auth, middleware and the server-side Cloudflare adapter, and build with static output where the whole application is a single client-only React island. This keeps all four agent-friendly gates (typed, convention-based, popular, well-documented) and gives access to React Flow with dagre/ELK auto-layout for the auto-arranged dependency diagram, while the validation and forecast logic stays pure client-side TypeScript. Server-rendered and backend-centric starters (Next.js, T3, Nuxt) were excluded by the no-backend constraint; Vite + React was the leaner alternative but lacks conventions. The static build deploys to Cloudflare Pages via GitHub Actions with auto-deploy on merge, and the self-check came back clean on all five points.

## Pre-scaffold verification

| Signal      | Value   | Severity | Notes                                                                                                           |
| ----------- | ------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| npm package | not run | n/a      | `cmd_template` starts with `git clone`; no `create-*` npm package to check                                      |
| GitHub repo | not run | n/a      | `gh` CLI is not installed (`command not found`); `pushed_at` for przeprogramowani/10x-astro-starter unavailable |

Registry card lists `last_updated: 2026-09-12` for this starter (self-reported, not verified against GitHub).

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 48 files moved silently (excluding `node_modules/`, which was moved as a whole directory); 2 sidelined as `.scaffold` siblings; 1 append-merged (`.gitignore`). 51 files total in the scaffold outside `node_modules/`.
**Conflicts (.scaffold siblings)**: `CLAUDE.md.scaffold`, `.DS_Store.scaffold` (`.DS_Store.scaffold` is macOS junk and safe to delete)
**.gitignore handling**: append-merged (existing lines kept in order; the starter's lines appended under a `# from 10x-astro-starter` separator, de-duped by exact line match)
**.bootstrap-scaffold cleanup**: deleted (cloned `.git/` removed before move-up; existing repo `.git/` untouched; no `context/` content in the scaffold)

Notes from `npm install` (650 packages added):

- `npm warn install-scripts`: 4 packages had install scripts blocked because they are not covered by `allowScripts`: `esbuild@0.28.2` (postinstall), `esbuild@0.28.1` (postinstall), `fsevents@2.3.3` (install), `workerd@1.20260911.1` (postinstall). Review with `npm install-scripts ls`; approve with `npm install-scripts approve <pkg>` if a build or dev-server step needs them.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Status**: failed to run
**Reason**: `503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk - We are currently performing maintenance.` The npm registry's audit endpoint was in maintenance. Attempted twice (about 30 seconds apart) at 2026-09-19T17:30Z; both attempts returned the same error.
**Partial output (if any)**:

```
npm warn audit 503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk - We are currently performing maintenance. For more info go to https://status.npmjs.org
npm error audit endpoint returned an error
```

Findings are unavailable. This is not a "0 findings" result. Re-run `npm audit` once https://status.npmjs.org shows the registry healthy.

## Hints recorded but not acted on

| Hint                    | Value                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| bootstrapper_confidence | first-class                                                                                            |
| quality_override        | false                                                                                                  |
| path_taken              | custom                                                                                                 |
| self_check_answers      | typed: true, from_official_starter: true, conventions: true, docs_current: true, can_judge_agent: true |
| team_size               | solo                                                                                                   |
| deployment_target       | cloudflare-pages                                                                                       |
| ci_provider             | github-actions                                                                                         |
| ci_default_flow         | auto-deploy-on-merge                                                                                   |
| has_auth                | false                                                                                                  |
| has_payments            | false                                                                                                  |
| has_realtime            | false                                                                                                  |
| has_ai                  | false                                                                                                  |
| has_background_jobs     | false                                                                                                  |

Also not acted on: the hand-off's "Why this stack" asks for a **stripped-down** starter (remove Supabase, auth, middleware and the server-side Cloudflare adapter; static output; single client-only React island). Bootstrapper scaffolds the starter as published, so at the time of the run `supabase/`, `wrangler.jsonc`, `.env.example` and the related dependencies were still present.

**Update 2026-09-19 (after the run): the unneeded functionality has since been stripped manually.** The project is now a static, client-only app; nothing in it depends on a backend. The scaffold files described above as "still present" no longer exist. Removed:

- **SSR** — `output: "static"` in `astro.config.mjs`; the `astro:env` server schema is gone.
- **Supabase auth** — `src/lib/supabase.ts`, `src/lib/config-status.ts`, `src/env.d.ts` (`Astro.locals.user` typing), `src/pages/api/`, `src/pages/auth/`, `src/pages/dashboard.astro`, `src/components/auth/`, `src/components/Topbar.astro`, `.env.example`, and the `@supabase/ssr`, `@supabase/supabase-js` and `supabase` packages.
- **Middleware** — `src/middleware.ts`.
- **Cloudflare adapter and Workers tooling** — `@astrojs/cloudflare`, `wrangler` (and `workerd` with it), `wrangler.jsonc`, `public/.assetsignore`, and the `.dev.vars` / `.wrangler/` lines in `.gitignore`. Deployment to Cloudflare Pages is not set up yet.
- **Migrations and RLS** — the `supabase/` folder (config only; no migrations ever existed).
- **Auth smoke test and CI job** — `scripts/smoke.mjs`, the `smoke` npm script, and the `smoke` job and Supabase secrets in `.github/workflows/ci.yml`.
- **Starter demo content** — the demo landing page (`Welcome.astro`) is replaced by a minimal placeholder; `Banner.astro`, `ui/LibBadge.astro` and `public/template.png` were deleted as unused. `README.md` was rewritten for this project.

Related housekeeping: the `CLAUDE.md.scaffold` sibling was renamed to `STARTER-RULES.md` (trimmed to this stack and referenced from `CLAUDE.md`), and the starter's `AGENTS.md` was deleted because it duplicated `CLAUDE.md`. The CI workflow branch filter was changed from `master` to `main`. The npm package name was changed from `10x-astro-starter` to `@remekgdansk/critical-path` (plain `critical-path` is taken on the public registry) and `"private": true` was added so the app cannot be published by accident. After the stripping, `astro check` (0 errors), `npm run lint` and `npm run build` (static output) all passed.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history. (This directory already has its own `.git/`.)
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep: `CLAUDE.md.scaffold` (delete `.DS_Store.scaffold`).
- Address audit findings per your project's risk tolerance — the audit did not run this time, so re-run `npm audit` when the npm registry is back.
