# Rules for AI

This file provides guidance to AI Agent when working with code in this repository. It started as the 10x Astro Starter's `CLAUDE.md` and has been trimmed to match this project: a static, client-only app with no backend, no auth and no database.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build (static output into `dist/`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)
- `npx astro check` — type-check `.astro` and TypeScript files (CI runs this)

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 7 static site** with React 19 islands and Tailwind 4. Nothing runs on a server: no API routes, no middleware, no SSR, no database, no auth. All application logic runs in the browser.

### Rendering mode

Static output (`output: "static"` in astro.config.mjs). Pages are pre-rendered to HTML at build time. Do not add server-only features (API routes, `Astro.locals`, middleware, `astro:env/server`, `prerender = false`) — they need an adapter, which this project does not have.

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- No environment variables or secrets are needed.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs `astro sync`, lint, `astro check` and build on every push and PR. It needs no secrets.
