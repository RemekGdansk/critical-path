---
project: Critical Path
researched_at: 2026-09-20
recommended_platform: Cloudflare Workers (static assets)
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript 6
  framework: Astro 7.3.2 (output "static", no adapter) + React 19.2 islands
  runtime: static assets — no server runtime
---

## Recommendation

**Deploy on Cloudflare Workers using static assets** (`wrangler deploy` with `assets.directory`), **not Cloudflare Pages.**

Critical Path is a 100% client-side application: `output: "static"`, no adapter, no database, no auth, no API, no server routes. The build is plain HTML, CSS and JS in `dist/`. That collapses the platform question from "where can this run" to "which platform is cleanest to operate from an agent session", and Cloudflare Workers was the only candidate to pass all five agent-friendly criteria — most decisively on rollback, where `wrangler rollback` is GA, free, non-interactive, and reaches any of the last 10 deployments. Cost is $0 at this project's scale with vast headroom, and no free-tier clause restricts how the tool may eventually be used.

The choice was made by the developer after an anti-bias cross-check that surfaced two genuine costs, both recorded below and in the risk register: a custom domain requires moving the DNS zone to Cloudflare nameservers, and the platform's analytics beacon is a dashboard toggle rather than a code change. The research recommendation at that point was the runner-up, **Vercel**, on the strength of those two axes. The developer reviewed both cross-checks and chose Cloudflare. That decision stands; the countervailing risks are carried in the register with mitigations rather than discarded.

**This supersedes the original `deployment_target: cloudflare-pages` in `tech-stack.md`, which was corrected to `cloudflare-workers` on 2026-09-20.** Astro's own deployment guide states that "Cloudflare recommends using Cloudflare Workers for new projects." Pages and Workers are different products with different CLI verbs and different config keys; `README.md` was aligned at the same time, and Risk R1 records the correction.

## Platform Comparison

Hard filters applied before scoring: persistent server-side connections are not required (interview Q1 = No), so nothing was dropped on that axis; every candidate can serve static files, so nothing was dropped on runtime either. The stack's *shape* — zero server, zero database, plain files — did the discriminating work inside the scoring instead.

| Platform | CLI-first | Managed / serverless | Agent-readable docs | Stable deploy + rollback API | MCP / integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **5.0** |
| **Vercel** | Pass | Pass | Pass | Partial | Pass | **4.5** |
| **Netlify** | Partial | Pass | Pass | Partial | Pass | **4.0** |
| Render | Partial | Pass | Pass | Partial | Pass | 4.0 |
| Railway | Partial | Partial | Pass | Partial | Partial | 3.0 |
| Fly.io | Partial | Fail | Pass | Pass | Partial | 3.0 |

Scoring: Pass = 1.0, Partial = 0.5, Fail = 0.

**Agent-readable docs is non-discriminating in 2026.** All six platforms publish `llms.txt`; several also serve any doc page as Markdown via a `.md` suffix or `Accept: text/markdown`. This criterion no longer separates serious platforms — it only catches laggards. Recorded here so a future reader does not mistake six identical Passes for six equally good choices.

**Rollback is what actually separated the top four.** Cloudflare: `wrangler rollback [VERSION_ID]`, GA, any of the last 10 deployments, and `--message` suppresses the interactive confirmation so it is CI- and agent-safe. Vercel: `vercel rollback` is public beta and on Hobby reaches only the immediately-previous production deployment. Netlify: there is no `netlify rollback` command at all — the documented flow is the dashboard, or raw `netlify api` calls. Render: a REST rollback endpoint exists but does not disable autodeploy (a footgun), and there is no CLI equivalent. Railway: dashboard-only.

**Per-platform notes**

- **Cloudflare Workers** — Passes everything. `wrangler deploy` for a prebuilt `dist/`, no adapter, no Dockerfile, no compute to operate. Free tier is 100,000 requests/day. Docs are exemplary for agents (`llms.txt`, `llms-full.txt`, per-page Markdown, an explicit "docs for agents" programme). Official MCP servers span docs, Workers Bindings, Workers Builds and Observability. Costs: custom domains require the DNS zone on Cloudflare nameservers, and preview URLs are never generated for fork PRs.
- **Vercel** — Equal to Cloudflare on the frictionless-static story (Astro's docs: "You don't need any extra configuration to deploy a static Astro site to Vercel"). Loses half a point on rollback only. Its distinct advantages sit *outside* the five criteria and are recorded in the cross-check below: no nameserver migration for a custom domain, analytics opt-in that is a reviewable commit rather than a dashboard toggle, and tokens scopeable to a single project. Its distinct liability is the Hobby commercial-use clause.
- **Netlify** — The safest deploy default of any candidate: `netlify deploy` publishes a draft, and production requires an explicit `--prod`. Strong official MCP server that Netlify positions alongside the CLI rather than instead of it. Held back by the missing CLI rollback, and by a 2026 credit-based free tier that caps bandwidth lower than the old 100 GB model. Won the 4.0 tiebreak against Render on the strength of the draft-first default.
- **Render** — A genuine static-site product on a real CDN, `render.yaml` maps cleanly onto `npm run build` → `dist`, and its MCP server is explicitly GA. Undercut by the August 2025 bandwidth cut: included free static bandwidth dropped from 100 GB to 5 GB/month, after which overage applies.
- **Railway** — Works via Railpack auto-detection, excellent agent-readable docs, good CI ergonomics. But it makes you run an always-on container to serve files that need no server, carries a $5/month floor even when idle, has only an opt-in CDN, and offers no CLI rollback. Its real strengths — co-located databases, WebSockets, workers — are all irrelevant to this project.
- **Fly.io** — The clearest mismatch. Hosting static files means a Dockerfile plus an nginx container plus a running VM, with no CDN by default and cold starts if you scale to zero. Fails "managed". Everything Fly is good at, this project does not need.

**How the interview reweighted the scores**

- *Q1 — persistent connections: No.* No hard filter fired; every candidate survived to scoring.
- *Q2 — cost vs DX: roughly equal.* Left cost as a tiebreak only. Cloudflare, Vercel and Netlify are all $0 here; Railway's $5/month floor and Render's 5 GB bandwidth cap counted against them.
- *Q3 — familiarity: none.* No tiebreak available, but it raised the weight on CLI clarity and documentation quality, since both developer and agent are learning from scratch.
- *Q4 — geographic reach: single region is fine.* **Removed edge reach as a differentiator.** Cloudflare wins here on operability, not on geography — worth stating plainly, because "it's on the edge" is the reflexive reason to pick Cloudflare and it is not the reason it won.
- *Q5 — co-located services: external providers are fine.* Stripped Railway, Render and Fly.io of their principal selling point.

### Shortlisted Platforms

#### 1. Cloudflare Workers — static assets (Recommended)

The only candidate passing all five criteria. For this stack the deploy is `npm run build && npx wrangler deploy` against an assets-only Worker with no entrypoint script — there is no adapter to install, no container to maintain and no compute to pay for. Rollback is a single GA, non-interactive command with ten deployments of history. Free tier headroom is enormous at this project's scale, and unlike the runner-up there is no clause governing how the tool may later be used.

#### 2. Vercel

Identical zero-config story for static Astro and a stronger answer on three project-specific axes: a custom domain needs only an `A`/`CNAME` record at your existing DNS provider, any analytics beacon requires an npm package and therefore appears in a pull request diff, and access tokens can be scoped to a single project. It loses the top slot on rollback depth (one step, public beta, a three-deployment retention floor on Hobby) and carries a commercial-use restriction that points squarely at this product's own persona.

#### 3. Netlify

The best *safety* posture of the three: a CLI whose default action cannot reach production. Combined with a well-supported MCP server, it is the easiest platform on which to give an agent deploy access without giving it the ability to break production by omission. It falls to third because the operational loop has a dashboard-shaped hole exactly where recovery lives, and because its 2026 credit model is the tightest free tier of the leading three.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **This repository's own contracts point at the wrong product.** `tech-stack.md` records `deployment_target: cloudflare-pages`, while the current path is Workers static assets. These are not interchangeable: `wrangler pages deploy ./dist` vs `wrangler deploy`, `pages_build_output_dir` vs `assets.directory`, different dashboard sections, different rollback semantics. An agent reading the stale contract alongside current Workers-oriented docs will blend them and produce a config/command mismatch that fails confusingly. This footgun was live in the repo when the cross-check ran; `tech-stack.md` has since been corrected (see R1 for the remaining surfaces).
2. **Documented Workers gaps that bite here specifically.** A custom domain requires the zone to sit on **Cloudflare nameservers** — Pages was laxer about this. Custom branch aliases are listed as "coming soon" on Workers. Early Hints must be configured by hand. The nameserver constraint is the dangerous one because it is discovered late, after the app already works on `*.workers.dev`.
3. **"100,000 requests/day" is not 100,000 visitors.** Every asset is a request: HTML plus hashed JS chunks plus CSS plus fonts plus favicon. One cold view of an Astro + React 19 page with a graph library is plausibly 15–30 requests. There is still vast headroom at this project's traffic, but anyone reasoning about capacity from the headline number is off by more than an order of magnitude.
4. **Platform conveniences actively threaten the product's hardest guarantee.** The PRD promises that a reviewer watching network traffic sees no project data leave the device. Cloudflare Web Analytics is one dashboard toggle away and injects a browser beacon. The application would still never transmit project data — but the guarantee becomes unverifiable, and the failing observation happens on the reviewer's machine, in no log the developer reads. Critically, a dashboard toggle leaves **no trace in git**: there is no diff, no review, no way for a future reader to see when it changed.
5. **The rollback safety net has a short memory.** `wrangler deployments list` surfaces the ten most recent deployments. Deploying on every merge to main through a three-week crunch, ten deployments can be under two days of history.

### Pre-Mortem — How This Could Fail

It is March 2027. The planner works, but nobody outside the developer trusts it. The failure started in week two: `tech-stack.md` said `cloudflare-pages`, Astro's docs said Workers, and the agent wrote a Workers `wrangler.jsonc` while the GitHub Actions workflow ran `wrangler pages deploy`. Two deployment targets coexisted for a month; a stale `critical-path.pages.dev` was bookmarked by a colleague who kept filing bugs against a build that no longer existed. Consolidating meant moving the custom domain, which meant moving the whole DNS zone to Cloudflare — three days of after-hours work against a hard 4 November deadline. So the domain was abandoned and the tool shipped on a `workers.dev` URL that the corporate persona's network filter blocked outright. Meanwhile, to find out whether anyone actually used it, someone enabled Web Analytics. Six months on, the security reviewer who was meant to sign off opened the network tab, saw a beacon, and concluded that "no data leaves your device" was marketing. The app never sent project data. It did not matter — the guarantee *was* the product, and it was no longer checkable.

### Unknown Unknowns

- **`*.workers.dev` is a shared subdomain that corporate filters block wholesale.** The PRD's primary persona is a team lead inside an organization with data and security policies — precisely the user most likely to sit behind such a filter. A custom domain is therefore an *access requirement* for this product, not polish. And on Workers, acquiring one drags the entire DNS zone onto Cloudflare with it.
- **Astro 7 `output: "static"` needs no adapter and no `wrangler dev`.** The dev loop is `npm run dev`, full stop. `wrangler dev` earns its keep only for verifying asset-serving behaviour that `astro dev` does not emulate — `_headers`, `_redirects`, `not_found_handling`. Many tutorials and the `@astrojs/cloudflare` adapter docs describe an adapter-based workflow that does **not** apply here; following one would silently move the project off pure static output.
- **`not_found_handling` defaults to serving nothing custom, and this repo has no 404 page.** `src/pages/` currently contains only `index.astro`, and `dist/` confirms it: `index.html`, `_astro/`, `favicon.png` — no `404.html`. Setting `not_found_handling: "404-page"` without authoring `src/pages/404.astro` yields a bare empty 404. Neither state is an error; it simply quietly is not your 404. `"single-page-application"` is the wrong setting for Astro's multi-page static output unless an island later adds client-side routing.
- **`_headers` and `_redirects` must live in `public/`, not the project root**, so that Astro copies them into `dist/`. Getting this wrong fails silently — the site deploys fine and the headers are simply absent. That matters acutely here, because the natural way to *enforce* the no-network guarantee is a `Content-Security-Policy` with `connect-src 'none'`, a defence that is invisible when it is not applied. `public/` currently holds only `favicon.png`.
- **Fork PRs never receive preview URLs** on Cloudflare — secrets are withheld at that trust boundary by design. Irrelevant to solo work; the moment an outside contribution arrives, the review loop silently loses its preview and the reviewer must build locally.
- **`wrangler versions deploy` prompts interactively.** The gradual-deployment path follows an interactive prompt, which is agent-hostile. `wrangler deploy` and `wrangler rollback --message "..."` are the non-interactive commands; prefer them in any automated context.

## Anti-Bias Cross-Check: Vercel (runner-up, retained for audit)

The cross-check was re-run on the runner-up at the developer's request before the final decision. Retained because it is the evidence base for the swap that was considered and declined, and because two of its findings became mitigations on the chosen platform.

**Devil's advocate.** (1) Rollback is one step deep and in public beta; Hobby retention guarantees only the last three production deployments. (2) Deployment Protection is on by default for previews on all plans including Hobby, so an external reviewer hits a Vercel login wall; the only Hobby fix is disabling it entirely, making every branch preview world-readable, as password protection is Pro-only. (3) The Hobby commercial-use clause covers "financial gain of **anyone** involved in **any part of the production**... including a paid employee or consultant writing the code" — which points directly at this product's corporate persona and its likely success path. (4) `trailingSlash` is configured independently in `astro.config.mjs` and `vercel.json`; leaving both at independent defaults produces double-redirect chains. (5) Vercel's Git integration builds the project itself, racing the existing `ci.yml` unless `git.deploymentEnabled: false` is set.

**Pre-mortem.** Preview protection was disabled to unblock a corporate reviewer, making every branch preview world-readable including one carrying a real project file as a test fixture. A bad merge then shipped; `vercel rollback` reached exactly one step back to a build that was also broken, and the deploy before that had aged past the three-deployment floor, forcing `git revert` and a rebuild during time earmarked for feature work. Finally the employer adopted the tool for real sprint planning, and the Hobby licence did not permit it — turning a finished side project into an unbudgeted procurement conversation.

**Unknown unknowns.** A custom domain needs only an `A` record (`76.76.21.21`) or a per-project CNAME at the *existing* DNS provider — nameserver migration is never required except for wildcard certificates, which have a documented `_acme-challenge` NS-delegation workaround. Nothing injects a client-side beacon by default: Web Analytics requires installing `@vercel/analytics` **and** activating it, and with no `@astrojs/vercel` adapter the integration path is not even wired — meaning any future beacon must arrive as a reviewable commit. Tokens can be scoped to a single project, with team- and user-level resources explicitly denied, though minting such a token itself requires a full-account token. Astro's `src/pages/404.astro` compiles to `dist/404.html` and is served with zero configuration, so Cloudflare's `not_found_handling` footgun has no Vercel equivalent. Vercel Toolbar's behaviour in production bundles for anonymous visitors is undocumented in both directions.

**Outcome.** Research favoured Vercel on custom-domain friction, guarantee auditability and token granularity. The developer weighed both cross-checks and selected Cloudflare Workers. Risks R2, R3 and R4 below exist because of that trade-off and carry the mitigations that close the gap.

## Operational Story

How Cloudflare Workers actually operates day to day for this project. One concrete answer per axis.

- **Preview deploys**: not wired by default, and deliberately so — GitHub Actions is the single deploy path, so the Cloudflare Workers Builds git integration stays disconnected to avoid two pipelines racing the same production alias. To preview without promoting, `npx wrangler versions upload` uploads a version that is not deployed; `npx wrangler versions deploy` promotes it, but follows an interactive prompt and is therefore unsuitable for unattended use. If branch preview URLs become worth the second pipeline, connecting the git integration provides them (GA since 2025-07-23) for same-repo branches only — **fork PRs never receive preview URLs**.
- **Secrets**: only two exist, and neither is an application secret — `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, both stored as GitHub Actions repository secrets and read by `cloudflare/wrangler-action`. The token is minted from the **"Edit Cloudflare Workers"** template, which grants Workers write and nothing else: no DNS, no billing, no unrelated zones. It is never placed in `.mcp.json`, never committed, and never pasted into a chat session. The application itself has no runtime secrets — it has no server. Rotation is manual, in the Cloudflare dashboard, followed by updating the GitHub secret.
- **Rollback**: `npx wrangler rollback --message "reason"` reverts to the version before the current one without a rebuild, creating a new active deployment across all routes in seconds; pass an explicit `VERSION_ID` from `npx wrangler deployments list` to target a specific one. The `--message` flag is required in automation because it suppresses the interactive confirmation. **History is ten deployments deep**, so the durable recovery path is a git tag on every production deploy plus `git revert` and rebuild — roughly two minutes for this project's build.
- **Approval**: an agent may run `wrangler deploy` to production from CI, `wrangler deployments list`, `wrangler deployments status` and `wrangler rollback`. A human does, by hand, in the dashboard: minting or rotating the API token, deleting the Worker, changing DNS or nameservers, adding a custom domain, and **enabling any analytics or observability feature that injects client-side script** — that last one is human-only not because it is destructive but because it silently invalidates the product's central guarantee.
- **Logs**: there is an honest caveat here. This is an **assets-only Worker with no entrypoint script**, so requests served from `dist/` do not execute user code and `npx wrangler tail` has nothing to stream. Build and deploy logs live in GitHub Actions and are the agent's primary read-only signal (`gh run view --log`). Request-level analytics come from the Cloudflare dashboard or the GraphQL Analytics API; the Workers Observability MCP server is the structured path if log queries become a recurring pattern. Do not write `wrangler tail` into a runbook expecting per-request logs from this deployment.

## Risk Register

Every row names the lens that surfaced it, so a future reader can audit *why* each item is on the list.

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 — Repo contracts named `cloudflare-pages`; Pages and Workers commands and config keys are not interchangeable | Devil's advocate | H | M | **Resolved 2026-09-20**: `tech-stack.md` (frontmatter + prose) and `README.md` now name Workers static assets and state that `wrangler deploy` and `wrangler pages deploy` are not interchangeable. Remaining action: pin the exact command in `deploy-plan.md` when Plan Mode runs. `context/changes/bootstrap-verification/verification.md` is a historical run log and is intentionally left unchanged |
| R2 — Custom domain requires moving the DNS zone to Cloudflare nameservers | Devil's advocate | M | H | Decide the domain strategy *before* deploying, not after; confirm you can authorize the zone move. If you cannot, this is the trigger to revisit the runner-up |
| R3 — `*.workers.dev` blocked by the corporate network filter of the primary persona | Unknown unknowns | M | H | Load the deployed URL from the target corporate network in week one, long before the 2026-11-04 deadline — not on launch day |
| R4 — Web Analytics or similar toggled on, injecting a beacon and invalidating the no-network guarantee, with no trace in git | Devil's advocate | L | H | Never enable Web Analytics; ship `public/_headers` with a CSP including `connect-src 'none'`; verify with a network-tab check against production before each release |
| R5 — Rollback history only ten deployments deep during a high-merge-rate crunch | Devil's advocate | M | M | Tag every production deploy in git; treat `git revert` plus rebuild as the real recovery path and `wrangler rollback` as the fast path |
| R6 — `not_found_handling` set without a 404 page existing, yielding a blank 404 | Unknown unknowns | H | L | Author `src/pages/404.astro` first; only then set `not_found_handling: "404-page"`; confirm `dist/404.html` exists after build |
| R7 — `_headers`/`_redirects` placed at the repo root instead of `public/`, failing silently | Unknown unknowns | M | M | Place them in `public/`; verify with `npx wrangler dev` and `curl -I` against the local server before deploying |
| R8 — Node version drift between CI (22.14.0 via `.nvmrc`) and a platform-side build image | Research finding | M | M | Build in GitHub Actions with `actions/setup-node` and deploy the prebuilt `dist/`; do not delegate the build to Cloudflare |
| R9 — Two deploy paths racing: Cloudflare Workers Builds git integration plus GitHub Actions | Research finding | M | M | Keep the git integration disconnected; GitHub Actions is the single deploy path |
| R10 — API token over-scoped, giving an agent more than Workers write | Research finding | M | H | Use the "Edit Cloudflare Workers" token template only; store in GitHub Secrets; never in `.mcp.json` or a chat session |
| R11 — `wrangler versions deploy` prompts interactively and hangs an unattended agent run | Unknown unknowns | L | M | Use `wrangler deploy` for promotion and `wrangler rollback --message "..."` for reverts; keep `versions deploy` out of automation |
| R12 — Free-tier headroom misjudged because requests are counted per asset, not per visit | Devil's advocate | L | L | Note the real multiplier (15–30 requests per cold page view); at this project's traffic the 100k/day allowance is still vast |
| R13 — Fork PRs receive no preview URLs | Unknown unknowns | L | L | Solo repo today; if outside contributions arrive, reviewers build locally |

## Getting Started

Commands validated on 2026-09-20 against Astro 7.3.2 with `output: "static"` and current Wrangler, not copied from general platform tutorials. This repo currently has **no** deployment config of any kind: no `wrangler.jsonc`, no deploy step in `.github/workflows/ci.yml` (which builds but stops at `npm run build`), no `404.astro`, and `public/` contains only `favicon.png`.

1. **Add Wrangler as a dev dependency** — `npm i -D wrangler@latest`. Do **not** install `@astrojs/cloudflare`; that adapter is for on-demand rendering and installing it would move this project off static output.

2. **Author the missing 404 page first** — create `src/pages/404.astro`, then run `npm run build` and confirm `dist/404.html` exists. Do this *before* step 3, so `not_found_handling` has something to serve.

3. **Create `wrangler.jsonc` at the repo root** — an assets-only Worker, no `main` entrypoint:
   ```jsonc
   {
     "name": "critical-path",
     "compatibility_date": "2026-09-20",
     "assets": {
       "directory": "./dist/",
       "not_found_handling": "404-page",
       "html_handling": "auto-trailing-slash"
     }
   }
   ```

4. **Add `public/_headers`** (in `public/`, so Astro copies it into `dist/`) with a Content-Security-Policy that *enforces* the no-network guarantee rather than merely asserting it — at minimum `connect-src 'none'`. Verify locally with `npx wrangler dev` and `curl -I http://localhost:8787/`; `npm run dev` does not emulate header serving.

5. **Deploy manually once** — `npm run build && npx wrangler deploy`. Confirm the site loads, then open the browser network tab and verify that creating and editing a task produces zero outbound requests.

6. **Wire CI** — extend `.github/workflows/ci.yml` with a deploy job gated on the existing lint/check/build steps and on `github.ref == 'refs/heads/main'`, using `cloudflare/wrangler-action` with `CLOUDFLARE_API_TOKEN` (minted from the "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. Leave the Cloudflare Workers Builds git integration disconnected (R9).

7. **Resolve the domain question before the deadline, not after** — decide whether the DNS zone can move to Cloudflare (R2) and test the resulting URL from the target corporate network (R3).

**Day-to-day commands**: `npm run dev` is the development loop — `wrangler dev` is only for verifying `_headers`, `_redirects` and 404 handling. `npx wrangler deployments list` shows the ten most recent deployments, `npx wrangler deployments status` shows current production, and `npx wrangler rollback --message "reason"` reverts without a rebuild.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (the deploy job is sketched above, not designed here)
- Production-scale architecture (multi-region, HA, DR)
- Any backend, database or authentication infrastructure — the product has none by design
