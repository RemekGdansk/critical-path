# Planner UI Contract — Plan Brief

> Full plan: `context/changes/planner-ui-contract/plan.md`
> Research: `context/changes/planner-ui-contract/research.md`

## What & Why

A `/10x-ui` change on one view, the Planner at `/`. It already uses the repo's shadcn tokens almost everywhere, but it drifts where it meets React Flow's stylesheet and in states the happy path never exercises: a hand-built select, a canvas painted in React Flow's own greys (edges at ~2.1:1), no keyboard path to the side panel, a blank first run and a blank load. The change closes those five charges and leaves a rule and lint checks so the next agent stays on the contract.

## Starting Point

S-01 built the Planner (diagram, `TaskPanel`, `NewTaskForm`) on `src/styles/global.css` tokens and `src/components/ui/` (button, input, label). The hardcoded-value scan finds one hit (`TaskPanel.tsx:171`). There is no UI rule in `PROJECT_RULES.md`, and jsx-a11y covers `.astro` only.

## Desired End State

The picker is the shared `NativeSelect`. Every canvas colour follows a token: a muted canvas with white Task cards and readable edges. A keyboard user can Tab to a Task, press Enter and edit it, and lands back in New Task after deleting it. An empty project says where to start; a loading or no-JavaScript page shows a skeleton instead of white. `/kitchen-sink` under `npm run dev` shows all seven states and is absent from the build, and `npm run lint` rejects literal colours in the planner views.

## Key Decisions Made

| Decision                    | Choice                                                                                         | Why (1 sentence)                                                                                   | Source          |
| --------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------- |
| Contract variant            | Extend the existing shadcn system; no second `init`                                            | The view already reads the tokens; the gaps are at its edges                                       | Research        |
| Predecessor picker (C1)     | `npx shadcn add native-select`                                                                 | Shares `Input`'s states, keeps S-01's native-select reasons, adds no package (verified)            | Research / Plan |
| Canvas colours (C2)         | Map `--xy-*` onto existing tokens; `defaultMarkerColor={null}`; keep `colorMode="light"`       | One value source; markers ignore CSS variables unless the prop is null                             | Research / Plan |
| Canvas surface              | Muted canvas (`--muted`), nodes stay white `bg-card`                                           | An existing token; nodes read as cards on a surface, like the sidebar                              | Plan            |
| Keyboard selection (C3)     | In scope: Task nodes focusable, START/FINISH not, Delete key inert                             | Without it the panel cannot be reached by keyboard; lifts one S-01 exclusion, undoes nothing built | Plan            |
| Focus after keyboard select | Move to "Task name"; after Delete Task, to New Task                                            | One keystroke from diagram to editing on any size of diagram                                       | Plan            |
| Kitchen sink                | Dev-only route via `injectRoute` when `command === "dev"`, excluded from Tailwind sources      | Production ships only the planner; probe proves CSS is unchanged                                   | Plan            |
| Screenshot widths           | 1440 and 1024; mobile N/A                                                                      | PRD Non-Goal: no mobile support                                                                    | Plan            |
| Guard                       | `PROJECT_RULES.md` UI block + jsx-a11y on `.tsx` + literal-value ESLint check on planner views | A failing check beats a forgotten rule; no new dependency                                          | Plan            |
| Out of the way              | Delete unused `bg-cosmic`; defer dark mode and `button.tsx` `text-white`                       | Dead literal palette vs. upstream/vendored code                                                    | Research        |

## Scope

**In scope:**

- C1–C5 from `research.md` on the Planner view, plus global token mapping in `global.css`
- Dev-only kitchen sink with the 7-state matrix, screenshots at 1440 and 1024
- UI rule in `PROJECT_RULES.md`, jsx-a11y on `.tsx`, literal-value lint check

**Out of scope:**

- Dark mode, mobile layout, edits to vendored `button.tsx`
- Arrow-key node navigation, selecting START/FINISH, delete confirmation
- Screenshot-testing tools or any new dependency; any CSP or server change

## Architecture / Approach

Contract before pixels, one charge per phase. The shared component and the token mapping land first, so the keyboard and state work renders on the finished surface. Keyboard selection goes through a keydown handler on the React Flow wrapper rather than `onNodesChange`, so only keyboard selection moves focus. The kitchen sink is injected only under `astro dev`, and its folder is excluded from Tailwind's sources, checked by a byte comparison of `dist/` CSS.

## Phases at a Glance

| Phase                       | What it delivers                                            | Key risk                                                 |
| --------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| 1. Shared component (C1)    | `NativeSelect` replaces the hand-built picker               | Wrapper is `w-fit`; row sizing must reach it             |
| 2. Token values (C2)        | Canvas, edges, arrowheads, controls on tokens; muted canvas | Arrowheads stay grey without `defaultMarkerColor={null}` |
| 3. Keyboard path (C3)       | Focusable Task nodes, Enter/Space selects, focus handoff    | Mouse and keyboard share React Flow's selection route    |
| 4. Empty & loading (C4, C5) | Empty-project copy, skeleton fallback, `<noscript>`         | Skeleton must match layout to avoid a jump               |
| 5. Visual gate              | Dev-only `/kitchen-sink`, screenshots, `dist/` probes       | Kitchen-sink classes leaking into production CSS         |
| 6. Guard                    | UI rule, jsx-a11y on `.tsx`, literal-value lint check       | jsx-a11y may flag existing `.tsx` code                   |

**Prerequisites:** S-01 merged (it is); a browser for screenshots and keyboard testing.
**Estimated effort:** ~2–3 sessions across 6 phases.

## Open Risks & Assumptions

- Existing tokens are assumed readable for every canvas role; if one fails on the screenshot, the substitute and reason go into `tokens.md`.
- Holding Space is React Flow's pan key; a Space press on a node must select without leaving pan mode on.
- Re-run the 200 ms NFR check (`?fixture=perf100`) after Phase 3, since every Task becomes a tab stop.

## Success Criteria (Summary)

- A keyboard-only user can create, select, rename, link and delete Tasks.
- Changing a token in `global.css` recolours the whole view, canvas included; the scan finds 0 literals and lint rejects new ones.
- `/kitchen-sink` shows all seven states, and the production build is unchanged by it.
