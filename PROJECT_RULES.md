# Rules for AI

Critical Path is a single-user, browser-only project planner: Astro 7 (static output), React 19 islands, TypeScript, Tailwind 4. Setup and scripts: @README.md. Product spec: @context/foundation/prd.md.

## Hard rules

- **Never add server-only features.** No API routes, middleware, `Astro.locals`, `astro:env/server`, `prerender = false`. @astro.config.mjs sets `output: "static"` and there is no adapter, so these break the build.
- **No project data leaves the device.** Once loaded the app makes no network calls — no analytics, telemetry, remote persistence or runtime CDN fetches. This is a PRD guardrail, not a preference. It is **enforced**, not just asserted: `security.csp` in @astro.config.mjs emits `connect-src 'none'`, so `fetch`, `XMLHttpRequest`, WebSocket and `sendBeacon` all fail. Loosening it must be a reviewed commit; never relax it to unblock a feature without saying so.
- **Edit rules here, not in `AGENTS.md`.** `AGENTS.md` and `CLAUDE.md` are gitignored and tool-managed; `AGENTS.md` only imports this file.

## Domain terminology — use these exact terms

Two commits exist solely to fix drift here. Do not introduce synonyms in identifiers, UI copy, comments or docs.

- **Validation Error** — a state the project may never hold. Reject the edit at input and name the rule it would break. Not "invalid", "conflict" or "blocked".
- **Validation Warning** — may exist, be exported and be imported; withholds the forecast while present.
- **Resource-Unconstrained Project Finish Date** / **Resource-Constrained Project Finish Date** — never "ETA", "deadline" or "finish date" alone. "Completion date" is reserved for a Done Task's own date.

Full lists and forecast rules: @context/foundation/prd.md.

## Commands

- `npm run dev` — dev server
- `npm run lint` — ESLint with type-checked rules
- `npx astro check` — type-check `.astro` and TS files (CI gate)
- `npm test` — Vitest, single run (`vitest run`), pure domain logic
- `npm run build` — static build into `dist/`
- `npm run preview` — the only way to see the CSP in effect; it is disabled under `npm run dev`
- `npx wrangler deploy` — manual deploy of a built `dist/`. **Never** `wrangler pages deploy`: Pages and Workers are different products. Auto-deploy on `main` belongs to Cloudflare Workers Builds (@context/deployment/deploy-plan.md)

Other scripts: @package.json. Pre-commit runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}` via husky + lint-staged.

## Conventions

- Path alias `@/*` → `./src/*`.
- No `"use client"` — this is not Next.js.
- Hooks in `src/hooks/` (matches the `hooks` alias in @components.json), helpers in `src/lib/`, extracted business logic in `src/lib/services/`, shared types in `src/types.ts`.
- Node 24.21.0 (@.nvmrc), read by CI and by Cloudflare Workers Builds. The app has no environment variables or secrets; the only repo secret is `ROADMAP_SYNC_TOKEN`, used solely by @.github/workflows/roadmap-sync.yml.
- GitHub Issues with the `roadmap` label are mirrored from @context/foundation/roadmap.md by `scripts/sync-roadmap.mjs` (run on push to `main`, or `node scripts/sync-roadmap.mjs --dry-run` locally). Change roadmap items in the roadmap, never in the issue title or body; the next sync overwrites them. Close a slice's issue with `Closes #N` in its PR, then mark the slice done in the roadmap.

### UI

- Token values live in `:root` (and `.dark`) of @src/styles/global.css and are published as Tailwind classes via `@theme inline`. Reference them by role (`bg-card`, `text-muted-foreground`, `border-sidebar-border`); add a missing role there, never in a view.
- React Flow is themed through its `--xy-*` variables, mapped onto the tokens in the `.react-flow` block of @src/styles/global.css. Change the canvas colours there, not in props or components.
- No literal colours (hex, `rgb()`, `hsl()`, `oklch()`), Tailwind palette classes (`bg-blue-500`, `text-white`) or arbitrary values (`p-[13px]`) in views. `npm run lint` rejects them in `src/components/planner/`, and applies jsx-a11y to every `.tsx` file.
- Check `src/components/ui/` (shadcn/ui, "new-york" variant) before creating a component; add a missing one with `npx shadcn@latest add <name>` instead of hand-building it in a view.
- After `npx shadcn@latest add`, check that the component imports `cn` from `@/lib/utils` and that no `cn` package was added to @package.json; CLI 4.21.1 does both despite @components.json.
- Merge Tailwind classes with `cn()` from `@/lib/utils`; never concatenate class strings.
- The kitchen sink at `/kitchen-sink` (under `npm run dev` only, from `src/dev/`) shows the planner in every state; check UI changes there.

## Testing

Vitest runs pure domain logic. Tests are colocated as `src/**/*.test.ts` — the only pattern Vitest discovers (@vitest.config.ts) and the pattern Tailwind ignores (@src/styles/global.css), so class names in tests never reach the production CSS. Domain logic lives in `src/lib/services/`, next to its tests. The CI gate is `astro sync` → lint → `astro check` → test → build, run both in @.github/workflows/ci.yml and in the Cloudflare Workers Builds build command. Run `npm run lint && npx astro check && npm test` before pushing.

## Markdown

- Do not insert line breaks. Readers can always use word-wrap in an editor.
- Keep table columns evenly distributed. `prettier --write` does this on commit; do not hand-align.

## Commits

Short imperative sentence-case subjects, no Conventional Commits prefixes (e.g. "Scaffold application with Astro"). PRs target `main`.
