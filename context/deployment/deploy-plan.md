---
project: Critical Path
planned_at: 2026-09-20
platform: Cloudflare Workers (static assets)
deploy_owner: Cloudflare Workers Builds
worker_name: critical-path
production_url: https://critical-path.remekgdansk.workers.dev
custom_domain: none (decided against; see D2)
context_type: mvp
---

# Deployment plan — Cloudflare Workers static assets

The audit trail for what was _supposed_ to happen. When a live run goes sideways,
this is the document that says what the intended state was.

Platform decision and its evidence live in
[`../foundation/infrastructure.md`](../foundation/infrastructure.md). This file covers
only the deploy: commands, dashboard state, manual gates and verification.

## Decisions that override `infrastructure.md`

| #   | Decision                                                                                                           | Effect on the contract                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Cloudflare Workers Builds owns auto-deploy on `main`.** GitHub Actions never deploys.                            | Inverts R9 and replaces Getting Started step 6. Retires R10 (no API token exists). Moves R8 onto Cloudflare's build image.                                                                                 |
| D2  | **`*.workers.dev` is the final URL.** No custom domain.                                                            | Closes R2 as not-applicable. Converts R3 from a mitigable risk into an **accepted** one — there is no escape hatch if a corporate filter blocks the shared subdomain.                                      |
| D3  | **CSP via Astro's stable `security.csp`**, plus a narrow `public/_headers` for what a `<meta>` tag cannot express. | Replaces Getting Started step 4. Astro 7.3.2 ships `security.csp` (stable since Astro 6.0); it hashes Astro's own island scripts, client chunks and stylesheets, so the policy needs no `'unsafe-inline'`. |
| D4  | **`.nvmrc` moved from `22.14.0` to `24.21.0`.**                                                                    | 22.14.0 was pinned but run nowhere: not locally, not in CI (`node-version: 22` resolved to 22.23.2), not in Cloudflare's image. R8 was nominal, not real.                                                  |

## Research corrections to `infrastructure.md` (verified 2026-09-20)

- **R12 withdrawn.** Cloudflare's pricing page: _"Requests to static assets are free and unlimited."_ For an assets-only Worker the 100,000 requests/day free-tier ceiling does not apply at all, so the per-asset request multiplier is moot.
- **R5 downgraded.** `wrangler rollback` reaches the **100 most recently published versions**, not ten. (`wrangler deployments list` showing ~10 is a display default, not the rollback horizon.) The git-tag + `git revert` fallback is still worth keeping; the "ten deployments is under two days of history" scenario is not real.
- **New risk R14.** Workers static assets **exclude nothing by default** — unlike Pages, which auto-excluded `.git`, `node_modules` and `.DS_Store`. A `dist/.DS_Store` existed in the working tree and would have been uploaded and publicly served. Mitigated by `public/.assetsignore`.
- **New risk R15.** Workers Builds does **not** wait for GitHub Actions. A push to `main` deploys even with a failing `astro check`. Mitigated by running the gates inside the Cloudflare build command.
- **`preview_urls` now defaults to `false`** (wrangler ≥ 4.34.0). Branch previews are an explicit opt-in, set in `wrangler.jsonc`.
- **G2 corrected.** The workers.dev subdomain is *not* one-time. Cloudflare's docs describe changing it from the Workers & Pages account details panel. It is still account-wide, and changing it invalidates every live `*.workers.dev` URL on the account simultaneously, so the practical guidance is unchanged once a deploy exists.

## Repository state — done

All committed and verified locally on 2026-09-20.

- [x] `wrangler@4` added as a dev dependency (4.135.0). `@astrojs/cloudflare` deliberately **not** installed — it is for on-demand rendering and would move the project off `output: "static"`.
- [x] `src/pages/404.astro` — authored **before** `not_found_handling` was set, so the setting has something to serve (R6). Build emits `dist/404.html`.
- [x] `wrangler.jsonc` — assets-only Worker, no `main` entrypoint.
- [x] `astro.config.mjs` — `security.csp` with `connect-src 'none'`.
- [x] `public/_headers` — security headers and immutable caching for `/_astro/*`.
- [x] `public/.assetsignore` — excludes `.DS_Store` (R14).
- [x] `.nvmrc` → `24.21.0`; `.github/workflows/ci.yml` reads it via `node-version-file` (R8).
- [x] `npm run lint`, `npx astro check`, `npm run build`, `npx wrangler deploy --dry-run` all clean.

### `wrangler.jsonc`

```jsonc
{
  "name": "critical-path",
  "compatibility_date": "2026-09-20",
  "workers_dev": true,
  "preview_urls": true,
  "assets": {
    "directory": "./dist/",
    "not_found_handling": "404-page",
    "html_handling": "auto-trailing-slash",
  },
}
```

`name` **must** equal the Worker name in the Cloudflare dashboard, or every
Workers Build fails. `html_handling: "auto-trailing-slash"` matches Astro's
default `build.format: "directory"`.

### How the no-network guarantee is enforced

Astro emits a per-page `<meta http-equiv="content-security-policy">` carrying
`default-src 'none'`, `connect-src 'none'` and the rest of the deny-list, then
appends its own `script-src 'self' <sha256…>` and `style-src 'self' <sha256…>`.
`connect-src 'none'` makes `fetch`, `XMLHttpRequest`, WebSocket, `sendBeacon`
and EventSource impossible from the page. The PRD guarantee stops being a claim
and becomes a property of the artifact.

Two rules follow, and both are load-bearing:

1. **Never put `default-src`, `script-src` or `style-src` in `public/_headers`.**
   Browsers enforce the _intersection_ of the meta and header policies, so a
   header `script-src` without Astro's per-build hashes would block Astro's own
   scripts. `_headers` carries `frame-ancestors 'none'` only, because a `<meta>`
   CSP cannot express it.
2. **Never put `script-src`/`style-src` in `security.csp.directives`.** Astro
   rejects them at config validation and points at
   `scriptDirective`/`styleDirective` instead.

CSP is **not** applied under `astro dev` (Vite dev server limitation). Test the
meta CSP with `npm run build && npm run preview`. That covers only the meta
policy — the `_headers` half needs a deployed version; see Day-to-day
operations.

## Manual gates — human-only, in order

These cannot be done from an agent session.

- [x] **G1** Cloudflare account, Free plan, logged in at `dash.cloudflare.com`.
- [x] **G2** Register a **workers.dev subdomain**: Workers & Pages → account details → _Your subdomain_ → **Change**. Account-wide, and it becomes part of every Worker URL on the account. Changeable in the dashboard, but changing it breaks every live `*.workers.dev` URL at once and releases the old name for anyone to claim — so treat it as settled once deployed. The `wrangler subdomain` command no longer exists. Set to `remekgdansk` on 2026-09-20.
- [x] **G3** Record the subdomain here, replacing the `production_url` frontmatter placeholder.
- [x] **G4** Log in with **scoped** OAuth, then verify:

  ```sh
  npx wrangler login --scopes account:read user:read workers_scripts:write --use-keyring
  npx wrangler whoami
  ```

  Needed for deploy, deployment inspection and rollback. No API token, and no
  GitHub secret, exists anywhere in this project.

  | Scope                   | Covers                                                                                                  |
  | ----------------------- | ------------------------------------------------------------------------------------------------------- |
  | `account:read`          | Resolving the account to deploy into; every command fails without it                                    |
  | `user:read`             | `wrangler whoami`                                                                                        |
  | `workers_scripts:write` | `deploy`, `deployments list\|status`, `versions list`, `rollback`, and the `workers.dev` subdomain route |

  Deliberately **not** granted: `workers:write` (superset — avoid),
  `workers_routes:write` (custom-domain zone routes only; closed by D2),
  `workers_tail:read` (an assets-only Worker streams nothing), `pages:write`
  (wrong product), `workers_kv:write` / `d1:write` / `secrets_store:write` /
  `zone:read` (no such resources here).

  `--use-keyring` puts the credentials in the macOS Keychain (`/usr/bin/security`,
  a generic-password item) instead of plaintext under `~/.config/.wrangler/`,
  where the long-lived **refresh token** would otherwise be readable by any
  process running as the user. Decided 2026-09-20: keep it.

  If macOS shows a Keychain dialog, click **Always Allow**, not Allow — that
  writes the permission into the item's ACL. Otherwise the dialog reappears on
  an agent-run `wrangler deploy` as a silent hang with no output. If it repeats
  even after Always Allow, `wrangler logout` and re-login without the flag.

  `offline_access` is appended by wrangler automatically (refresh token); it
  grants no additional access. `whoami` then prints a **WARNING listing the
  scopes that were deliberately withheld** and advises re-running `wrangler
  login` — ignore it, on every command. Following it re-grants the full default
  superset.

  Credentials land in an encrypted file (`~/Library/Preferences/.wrangler/
  config/default.enc`) with the key in the Keychain — not in the Keychain
  directly. Verified 2026-09-20: no `~/.config/.wrangler/` plaintext exists.

  On a 403 or `insufficient permissions`, add **one** named scope and re-run —
  never reach for `workers:write`.
- [x] **G5** After G3, set `site: "https://critical-path.remekgdansk.workers.dev"` in `astro.config.mjs`. `@astrojs/sitemap` is installed and currently a silent no-op (`[WARN] The Sitemap integration requires the 'site' astro.config option. Skipping.`); setting it also fixes canonical URLs.

## First deploy — by hand

Deploy manually once before automating. A config error found here costs one
command; found in Workers Builds it costs a dashboard round-trip.

- [x] **1** `nvm use && npm ci && npm run build`
- [x] **2** `npx wrangler deploy --dry-run` — validates config without touching the account.
- [x] **3** `npx wrangler deploy` — record the printed URL.
      Deployed 2026-09-20 → `https://critical-path.remekgdansk.workers.dev`,
      version `b3e938be-0cca-4d97-b46c-9f3633c8484f` (superseded by
      `97163c20-fe2b-4589-a3cd-88d76822219a`, the Permissions-Policy fix), 7 assets. `workers_scripts:write`
      alone was sufficient for the assets-upload session — no extra scope needed.
- [x] **4** Verify against production:
  - `curl -I https://critical-path.remekgdansk.workers.dev/` → `200`, with `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `content-security-policy: frame-ancestors 'none'`.
  - `curl -I https://critical-path.remekgdansk.workers.dev/does-not-exist` → `404`, serving `404.html`, not an empty body.
  - `curl -I https://critical-path.remekgdansk.workers.dev/_astro/<hashed>.css` → `cache-control: public, max-age=31536000, immutable`.
  - `curl -s https://critical-path.remekgdansk.workers.dev/.DS_Store` → must **not** return a file.
- [ ] **5** Browser, network tab and console open: zero requests after load, zero CSP violations. **This is the R4 gate and it repeats before every release.**

## Workers Builds — the single deploy path (D1)

- [x] **6** Dashboard → Workers & Pages → `critical-path` → **Settings → Builds → Connect**. Authorize the **Cloudflare Workers & Pages GitHub App** against `RemekGdansk/critical-path` only — not the whole account.
- [x] **7** Configure exactly:

  | Setting                              | Value                                                                |
  | ------------------------------------ | -------------------------------------------------------------------- |
  | Build command                        | `npx astro sync && npm run lint && npx astro check && npm run build` |
  | Deploy command                       | `npx wrangler deploy --tag "$WORKERS_CI_COMMIT_SHA" --message "$WORKERS_CI_BRANCH build $WORKERS_CI_BUILD_UUID"` |
  | Non-production branch deploy command | `npx wrangler versions upload --tag "$WORKERS_CI_COMMIT_SHA" --message "$WORKERS_CI_BRANCH build $WORKERS_CI_BUILD_UUID"` |
  | Production branch                    | `main`                                                               |
  | Root directory                       | repo root                                                            |
  | Build variables                      | none                                                                 |

  Both deploy commands **override the defaults** (`npx wrangler deploy` /
  `npx wrangler versions upload`). Without the flags, `wrangler deployments
  status` reports `Source: Unknown (deployment)`, `Tag: -`, `Message: -` — the
  platform records no link to the commit that produced the live version, which
  is precisely what recovery needs. Workers Builds injects
  `WORKERS_CI_COMMIT_SHA`, `WORKERS_CI_BRANCH` and `WORKERS_CI_BUILD_UUID` into
  every build, so stamping them costs nothing and cannot be forgotten. Verified
  2026-09-20 that both `wrangler deploy` and `wrangler versions upload` accept
  `--tag` and `--message`.

  Preview builds (non-production branch builds) are **enabled** — required by
  step 8, and the only way to verify a `public/_headers` change before it is
  live (see Day-to-day operations).

  Stamping verified 2026-09-21: version `0581d49c-b734-4b88-846f-f8363678976b`
  carries `Tag: 83e7cd904b1b68de17ead62b1f2dfceb0349bef3` (the exact commit) and
  `Message: main build 98d50495-…`. The four versions shipped before the change
  keep `Tag: -` — there is no retroactive stamping, which is what the two git
  tags from 2026-09-20 cover.

  First automated build ran 2026-09-20 16:32 UTC from `main`, producing version
  `7c328031-77a9-4eaa-adb8-587cdaf4f526`. **Node 24.21.0 installed on demand**
  as hoped — the `NODE_VERSION=24.18.0` fallback in Known edge cases was not
  needed and remains untested.

  The build command duplicates the `ci.yml` gates on purpose. Workers Builds
  does not wait for GitHub Actions, so lint and `astro check` must run _inside_
  the Cloudflare build or a type error ships to production (R15).

- [ ] **8** Push a branch, open a PR, confirm a preview version and URL appear in the Worker's version history. Merge, confirm `main` reaches production.
- [x] **9** Re-record the settings above verbatim if anything differed. Done 2026-09-21: the table matches the dashboard, including the deploy-command fix. They live in a dashboard and leave **no trace in git** — the same class of invisible state that R4 warns about.

**Never add `cloudflare/wrangler-action` to `.github/workflows/ci.yml`.** Two
pipelines racing the same production alias is R9. Under D1 the workflow holds no
Cloudflare credentials, which makes the mistake impossible rather than merely
discouraged.

## Day-to-day operations

| Task                           | Command                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| Development loop               | `npm run dev`                                                        |
| Verify meta CSP / 404 page     | `npm run build && npm run preview`                                   |
| Verify `_headers` (see below)  | Branch push → preview URL, or `npx wrangler versions upload`, then `curl -I` |
| Manual deploy                  | `npm run build && npx wrangler deploy --tag "$(git rev-parse HEAD)"` |
| What is live                   | `npx wrangler deployments status`                                    |
| History                        | `npx wrangler deployments list --json`, `npx wrangler versions list` |
| Fast rollback                  | `npx wrangler rollback --message "reason"`                           |
| Rollback to a specific version | `npx wrangler rollback <VERSION_ID> --message "reason"`              |
| Durable recovery               | `git revert` + rebuild (~2 min)                                      |

**`npm run preview` serves no headers at all.** Verified 2026-09-20: a request
to Astro's local preview returns `200` and nothing else — no
`x-content-type-options`, no `referrer-policy`, no `permissions-policy`, no
`content-security-policy`. `public/_headers` is parsed by Cloudflare at request
time, so local preview covers only what Astro bakes into the HTML (the meta CSP
and the 404 page). **Any `_headers` change must be verified on a deployed
version** — which is the practical reason preview builds are enabled. The dead
`interest-cohort` directive reached production because no local command could
have caught it.

`--message` is **required** in any unattended context: without it `wrangler
rollback` prompts twice and hangs the run. `wrangler versions deploy` also
prompts interactively — keep it out of automation entirely (R11).

**There are no request logs.** This is an assets-only Worker with no entrypoint
script, so requests served from `dist/` execute no user code and `wrangler tail`
has nothing to stream. Build and deploy logs live in the Cloudflare dashboard
under the Worker's Builds tab; request-level analytics come from the dashboard
or the GraphQL Analytics API.

## Approval boundary

**Agent may**: `wrangler deploy`, `wrangler deploy --dry-run`,
`wrangler deployments list|status`, `wrangler versions list`,
`wrangler rollback --message "…"`.

OAuth scopes are **account-wide**: `workers_scripts:write` grants write access
to every Worker on the account, not only `critical-path`. Per-Worker scoping
needs an API token, which D1 rules out. Acceptable while this account holds one
Worker; revisit before putting an unrelated production service on it.

**Human only, by hand**: registering or changing the workers.dev subdomain, connecting or
disconnecting the GitHub App, deleting the Worker, and **enabling any analytics
or observability feature that injects client-side script**. That last one is
human-only not because it is destructive but because it silently invalidates the
product's central guarantee, and it leaves no diff to review.

## Post-deploy checklist

- [x] **P1** End-to-end: merge to `main` → Workers Builds runs → production serves the new build. Confirm with `npx wrangler deployments status`. Done 2026-09-20: push to `main` → build → version `7c328031-77a9-4eaa-adb8-587cdaf4f526` live at 100%, distinct from both hand-run deploys. Headers and 404 re-verified after the handover.
- [ ] **P2** Rollback drill, once, deliberately: `npx wrangler rollback --message "drill"`, confirm the revert, then redeploy forward. An untested rollback is not a rollback.
- [ ] **P3** **R3 check — week one, not launch day.** Load the production URL from the target corporate network. `*.workers.dev` is a shared subdomain that some corporate filters block wholesale, and under D2 there is no custom-domain escape hatch. If it is blocked, that reopens the platform decision; escalate rather than absorb.
- [ ] **P4** Confirm Web Analytics is **off** and no observability feature injecting client-side script is enabled (R4). Re-check after any dashboard session.
- [ ] **P5** Tag releases worth rolling back to — the durable recovery path (R5):

  ```sh
  git tag -a deploy-<date>-<short-version-id> <commit> -m "…"
  ```

  The Cloudflare version ID is in the tag name on purpose. Recovery starts from
  `wrangler versions list`, which speaks version IDs, not commits; a date-only
  tag cannot be mapped back and breaks outright on a second deploy in one day
  (which happened on 2026-09-20 — three production versions, one tag name).
  Put the full version ID and the URL in the tag message.

  **Narrowed 2026-09-20.** Since step 7 now stamps `--tag
  "$WORKERS_CI_COMMIT_SHA"` on every build, the version → commit mapping is
  automatic and lives on the platform. A git tag is no longer the mechanism for
  that, so tag **releases worth rolling back to**, not every push. A docs-only
  commit still triggers a build and a new version ID; it does not deserve a
  tag. The platform record is what recovery reads; the git tag is a human
  marker.

  Tagged so far:
  - `deploy-2026-09-20-97163c20` → `6a90f03`, hand-run (superseded `b3e938be`
    from the same tree)
  - `deploy-2026-09-20-7c328031` → `17f1627`, first Workers Builds deploy

## Known edge cases

| Symptom                                                                     | Cause                                                                   | Fix                                                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Missing entry-point to Worker script or to assets directory`               | `dist/` absent or `assets.directory` wrong                              | Build first; the path is `./dist/` relative to `wrangler.jsonc`                                                                   |
| `wrangler deploy` prompts for configuration                                 | No config file found (wrong cwd), or name mismatch                      | Fix the config. `--yes` suppresses the prompt but lets wrangler auto-create something you did not intend                          |
| Workers Build fails instantly on name                                       | Dashboard Worker name ≠ `"critical-path"`                               | Rename in the dashboard to match `wrangler.jsonc`                                                                                 |
| Cloudflare opens an automatic PR rewriting the config                       | It detected a config/name conflict                                      | Close it, fix `wrangler.jsonc` by hand — do not let it author the contract                                                        |
| Build image cannot install Node 24.21.0                                     | Image preinstalls 24.18.0 and 22.23.2; other versions install on demand | Fallback in order: set `NODE_VERSION=24.18.0` as a build variable, or bump `.nvmrc` to `24.18.0` and keep `ci.yml` pointing at it |
| Build queues behind another                                                 | Free plan allows 1 concurrent build                                     | Wait. Free plan: 3,000 build minutes/month, 20-minute timeout; this build is ~1–2 min                                             |
| CSP violation for an inline `style="…"` attribute                           | Something emitted an inline style attribute                             | Add the hash via `security.csp.styleDirective` with `kind: "attribute"` — never `'unsafe-inline'`                                 |
| `[WARN] Shiki syntax highlighting … not compatible with CSP` on every build | Astro's default markdown highlighter uses inline styles                 | Cosmetic today (no markdown is rendered). If markdown is ever added, switch to `markdown.syntaxHighlight: "prism"`                |
| `npx wrangler dev` fails to start                                           | `workerd` postinstall was blocked by the npm `allowScripts` policy      | Not needed — `npm run preview` covers CSP and 404 verification. To enable it, approve the `workerd` install script                |
| Fork PR gets no preview URL                                                 | By design — secrets are withheld at that trust boundary (R13)           | Solo repo today; a reviewer would build locally                                                                                   |
| Console: `Error with Permissions-Policy header: Unrecognized feature: 'x'`   | `public/_headers` names a feature the browser does not know                 | Remove it. Found 2026-09-20 with `interest-cohort` (FLoC, long dead). Never add `browsing-topics=()` — Chrome-only, same error in Firefox/Safari. Harmless to function, but it breaks the zero-console-error R4 gate |
| Build fails immediately after editing a deploy command in the dashboard      | Unterminated quote or other shell typo in the field                         | The dashboard accepts any string and validates nothing; the error surfaces only in the build log. Happened 2026-09-21 — a missing closing `"` on `--message`. The version command was correct, so branch builds kept working while `main` stopped deploying |
| `wrangler` re-prompts for an account on every command                       | Login has access to several Cloudflare accounts                         | Set `CLOUDFLARE_ACCOUNT_ID` in the shell, or unattended runs hang                                                                 |
