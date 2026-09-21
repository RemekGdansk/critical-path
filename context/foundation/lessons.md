# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Verify the artifact, not the config

- **Context**: Any phase that checks whether a deployment, platform setting, or security control is actually in effect — deploy plans, infra verification, release gates, post-deploy checklists.
- **Problem**: Config files and dashboards record what was _requested_, not what is _served_. Astro's local preview applied none of `public/_headers`, so a dead `interest-cohort` directive reached production and logged a console error on every load — which silently disabled the "zero console errors" release gate, because the console was no longer expected to be empty. The same gap makes a dashboard toggle worthless as evidence that no analytics script is injected.
- **Rule**: Verify effects by reading the produced artifact — the HTTP response, the built file, the running process — never by reading the configuration that was supposed to produce them. If a check cannot run locally, deploy a preview and check there; a gate you cannot execute before release is not a gate.
- **Applies to**: plan, implement, impl-review
