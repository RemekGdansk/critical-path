---
starter_id: 10x-astro-starter
package_manager: npm
project_name: critical-path
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: cloudflare-workers-builds
  ci_quality_gate: github-actions
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
---

## Why this stack

Critical Path is a single-user, browser-only planner: no login, no database, no server logic, no project data leaving the device, and it must keep working offline. A solo developer with a 3-week after-hours budget chose the custom path and asked for a stripped-down 10x Astro Starter rather than the full stack: keep Astro, React 19, TypeScript and Tailwind, but remove Supabase, auth, middleware and the server-side Cloudflare adapter, and build with static output where the whole application is a single client-only React island. This keeps all four agent-friendly gates (typed, convention-based, popular, well-documented) and gives access to React Flow with dagre/ELK auto-layout for the auto-arranged dependency diagram, while the validation and forecast logic stays pure client-side TypeScript. Server-rendered and backend-centric starters (Next.js, T3, Nuxt) were excluded by the no-backend constraint; Vite + React was the leaner alternative but lacks conventions. The static build deploys to Cloudflare Workers static assets (`wrangler deploy`, not Cloudflare Pages — see `infrastructure.md`), and the self-check came back clean on all five points. Auto-deploy on merge to `main` is owned by **Cloudflare Workers Builds**, not GitHub Actions; the GitHub Actions workflow is a PR quality gate that holds no Cloudflare credentials. That inverts what `infrastructure.md` originally prescribed — see `../deployment/deploy-plan.md` (decision D1) for the reasoning and the consequences.
