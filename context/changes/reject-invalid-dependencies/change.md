---
change_id: reject-invalid-dependencies
title: Reject cycles and START/FINISH violations with explanation
status: planned
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Notes

Roadmap S-02 (`context/foundation/roadmap.md`). PRD refs: US-01, FR-003, FR-019. Prerequisite S-01 (capture-task-graph) is done.

Outcome: user who tries to add a dependency that would create a cycle, give START a predecessor, or make a Task depend on FINISH is refused, the project stays unchanged, and the message names the rule — for a cycle, the cycle itself (e.g. A → B → C → A).

Risk from the roadmap: import (S-03) must reject hand-edited files containing a cycle, so it should reuse the same rule check rather than a second implementation that could disagree.
