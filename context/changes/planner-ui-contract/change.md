---
change_id: planner-ui-contract
title: Planner UI contract
status: implemented
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Notes

A `/10x-ui` change.

- **View (one):** the Planner at `/`, `src/pages/index.astro` → `src/components/planner/Planner.tsx` (diagram, `TaskPanel`, `NewTaskForm`, node components).
- **Token source:** `src/styles/global.css`, with values in `:root` / `.dark` published through `@theme inline`. The shared components live in `src/components/ui/` (shadcn "new-york"; add new ones with `npx shadcn@latest add <name>`).
- **Contract variant:** an existing design system. Extend it; do not run a second `shadcn init` or fork the palette.
- **Pre-audit (2026-10-04):** the hardcoded-value scan over the 10 view files found 1 hit (`TaskPanel.tsx:171`, `ring-[3px]`). Token classes are read in 6 of the 10 files, and `ui/` is imported by `TaskPanel` and `NewTaskForm`. There is no UI block in `PROJECT_RULES.md`, and no rule there invites one-off values.
- **Candidate charges for `/10x-research` to confirm:** the hand-rolled `<select>` at `TaskPanel.tsx:161-173`; React Flow's colours not following the tokens, with `colorMode="light"` hardcoded at `Diagram.tsx:67`; no keyboard path to select a Task (`nodesFocusable={false}`, `Diagram.tsx:65`); no first-run empty state on the diagram; the unused `bg-cosmic` utility with hex literals at `global.css:124`.
