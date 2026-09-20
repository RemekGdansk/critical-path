# Critical Path

A single-user, browser-only project planner built around the critical path. There is no login, no database and no server logic: project data never leaves the device, and the app is meant to keep working offline.

## Tech Stack

- [Astro](https://astro.build/) v7 - static output; the whole application is a client-only React island
- [React](https://react.dev/) v19 - UI library for the interactive planner
- [TypeScript](https://www.typescriptlang.org/) v6 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework

Started from the [10x Astro Starter](https://github.com/przeprogramowani/10x-astro-starter), with Supabase, auth, middleware and the Cloudflare adapter removed.

## Prerequisites

- Node.js v24.21.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build static site into `dist/`
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Deployment

The build output in `dist/` is static and is served by Cloudflare Workers static assets (`wrangler deploy`, **not** `wrangler pages deploy` — the two are not interchangeable). Configuration is in `wrangler.jsonc`: an assets-only Worker with no `main` entrypoint.

**Cloudflare Workers Builds owns auto-deploy**: every merge to `main` is built and deployed by Cloudflare. GitHub Actions never deploys. The manual path is `npm run build && npx wrangler deploy`; rollback is `npx wrangler rollback --message "reason"`.

The app ships a Content Security Policy with `connect-src 'none'` (`security.csp` in `astro.config.mjs`), which makes the "no project data leaves the device" guarantee enforceable rather than merely asserted. CSP is not applied under `npm run dev` — verify with `npm run build && npm run preview`.

See [`context/deployment/deploy-plan.md`](./context/deployment/deploy-plan.md) for the commands, manual gates and dashboard settings, and [`context/foundation/infrastructure.md`](./context/foundation/infrastructure.md) for the platform decision and risk register.

## CI

GitHub Actions runs lint, `astro check` and build on every push and PR (`.github/workflows/ci.yml`). It is a quality gate only and holds no Cloudflare credentials. Cloudflare Workers Builds runs the same gates in its own build command, because it does not wait for the Actions run.

## License

See [LICENSE](./LICENSE).
