# Review follow-ups: test-plan-refresh-2026-10-12

Queued from `reviews/impl-review.md` triage, 2026-10-12. Each item is its own reviewed change; none is part of this documentation-only refresh.

## F2 — Give the M-1 file version bump an owner in the roadmap

- **Why:** test-plan §3 Phase 3 is `complete`, and the remaining protection for risk #1 (an older format version still imports; fields absent from an older file get documented defaults) is handed to "the M-1 version bump" (test-plan §3 order rationale, §6.3 "Version bump", §6.5 Phase 3 note). In `context/foundation/roadmap.md` the bump appears only inside the S-06 and S-07 Risk lines ("stays `"0.1"` until M-1 closes and then becomes `"1"`"); no slice and not the M-1 "Done when" owns doing it or testing it.
- **What:** add to the M-1 "Done when" in `context/foundation/roadmap.md` that the file version moves from `"0.1"` to `"1"`, with the tests §6.3 names: every shipped golden file still imports to its hand-written project, the byte-for-byte serializer assertion moves to the `"1"` golden file, and each field absent from an older file has a documented default with its own row. Alternatively make it a dedicated slice if the maintainer prefers.
- **How:** its own reviewed commit; the roadmap edit re-syncs the `roadmap` GitHub issues through `scripts/sync-roadmap.mjs` (dry-run first: `node scripts/sync-roadmap.mjs --dry-run`).
- **Status:** done 2026-10-12 in `4939110` — the maintainer chose the M-1 "Done when" over a dedicated slice. The dry run planned one change, the description of the GitHub milestone "M-1: First usable planner"; no slice issue changes.
