# Test stack

## E2E

<!-- Written by /10x-e2e-setup. Re-run it to change this section; other skills only read it. -->

- runner: Playwright Test, @playwright/test 1.64.0
- config: playwright.config.ts
- single-spec command: npm run test:e2e -- e2e/<name>.spec.ts
- full-suite command: npm run test:e2e
- base URL: http://localhost:4321
- port: 4321 (detected from Astro's default preview port; neither astro.config.mjs nor the preview script sets one; detected default 4321, override with E2E_PORT in the gitignored .env)
- web server command: npm run build && npm run preview -- --port $E2E_PORT; on CI only npm run preview -- --port $E2E_PORT, serving the dist/ that ci.yml built and check:csp verified; reuseExistingServer outside CI (env ASTRO_PREVIEW_BACKGROUND=1 keeps Astro 7's preview in the foreground)
- auth setup project: none (the app has no auth)
- storageState: none
- seed: e2e/seed.spec.ts — protects `csp-planner-boots` (test-plan.md risk #7, browser side): the built planner hydrates and captures a Task with the no-egress CSP in effect, with no console error or CSP violation
- browser CLI: playwright-cli 0.1.22 (global), command skill at .claude/skills/playwright-cli/SKILL.md; workspace config .playwright/cli.config.json pins the bundled Chromium (no Google Chrome on this machine)
- gates: `npm run test:e2e` is a step in .github/workflows/ci.yml after `check:csp` (with `npx playwright install --with-deps chromium` before it and the HTML report uploaded on failure); never part of the Cloudflare Workers Builds build command
- updated: 2026-10-11
