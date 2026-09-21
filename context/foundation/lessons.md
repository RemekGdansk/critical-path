# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Verify the artifact, not the config

- **Context**: Any phase that checks whether a deployment, platform setting, or security control is actually in effect — deploy plans, infra verification, release gates, post-deploy checklists.
- **Problem**: Config files and dashboards record what was _requested_, not what is _served_. Astro's local preview applied none of `public/_headers`, so a dead `interest-cohort` directive reached production and logged a console error on every load — which silently disabled the "zero console errors" release gate, because the console was no longer expected to be empty. The same gap makes a dashboard toggle worthless as evidence that no analytics script is injected.
- **Rule**: Verify effects by reading the produced artifact — the HTTP response, the built file, the running process — never by reading the configuration that was supposed to produce them. If a check cannot run locally, deploy a preview and check there; a gate you cannot execute before release is not a gate.
- **Applies to**: plan, implement, impl-review

## Pin the build's input set

- **Context**: Any tool that discovers its own inputs — Tailwind content detection, bundler globs, test discovery, linter file matching. Especially right after bootstrap, when a starter's defaults go unexamined.
- **Problem**: Tailwind 4's automatic detection scanned every non-gitignored file, markdown included. Prose words that are also utility names (`static`, `fixed`, `table`, `block`, `visible`) compiled into the production CSS bundle, and every documentation edit changed the asset hash. Documentation was silently part of the build input, in a project whose central guarantee is controlling exactly what reaches the browser.
- **Rule**: When a tool discovers its inputs automatically, pin them explicitly, then verify by probe — edit a file that must not affect output and confirm the artifact is unchanged. Never infer the input set from defaults or documentation.
- **Applies to**: plan, implement, impl-review
