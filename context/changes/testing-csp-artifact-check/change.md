---
change_id: testing-csp-artifact-check
title: Check every built page forbids network egress via its CSP
status: impl_reviewed
created: 2026-10-11
updated: 2026-10-11
archived_at: null
---

## Notes

Open a change folder for rollout Phase 4 of context/foundation/test-plan.md: "Built-artifact guarantee".
Risks covered: #7 (project data leaves the device because the CSP is loosened, or never reaches the served page, while every gate stays green). Test types planned: post-build artifact check.
Risk response intent: #7 — prove every built page carries a CSP with connect-src 'none' and no third-party origins, and that the check fails when the policy is loosened; challenge "the Astro config has a CSP, so the served page has it"; avoid asserting the config object instead of the built HTML. The check runs after the build, in both the GitHub Actions gate and the Cloudflare Workers Builds deploy gate.
After creating the folder, follow the downstream continuation rule.
