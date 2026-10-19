---
change_id: diagram-anti-corruption-layer
title: Diagram anti corruption layer
status: impl_reviewed
created: 2026-10-18
updated: 2026-10-19
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Mutation run on `src/lib/services/diagram.ts` (Progress 2.5, report of 2026-10-18 16:31, with the Vitest 5 runner workaround in effect): 84 mutants, 82 killed, 2 survived (97.6%). Both left deliberately: FINISH's `accessibleName: "FINISH"` → `""` (`diagram.ts:162`), unread because FINISH gets no `aria-label` in `flow-elements.ts`; and dropping the stray-predecessor `filter` (`diagram.ts:184`), unreachable because the edit functions and import validation never leave an unknown predecessor id.
