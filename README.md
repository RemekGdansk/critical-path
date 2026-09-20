# Critical Path

A single-user, browser-only project planner built around the critical path. There is no login, no database and no server logic: project data never leaves the device, and the app is meant to keep working offline.

## Tech Stack

- [Astro](https://astro.build/) v7 - static output; the whole application is a client-only React island
- [React](https://react.dev/) v19 - UI library for the interactive planner
- [TypeScript](https://www.typescriptlang.org/) v6 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework

Started from the [10x Astro Starter](https://github.com/przeprogramowani/10x-astro-starter), with Supabase, auth, middleware and the Cloudflare adapter removed.

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
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

The build output in `dist/` is static. It is intended for Cloudflare Pages via GitHub Actions with auto-deploy on merge; the deploy workflow is not set up yet.

## CI

GitHub Actions runs lint, `astro check` and build on every push and PR (`.github/workflows/ci.yml`).

## License

See [LICENSE](./LICENSE).
