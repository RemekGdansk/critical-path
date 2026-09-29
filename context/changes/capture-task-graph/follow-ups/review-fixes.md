# Review Fixes: capture-task-graph

Follow-ups queued from implementation reviews. Each item names the slice whose planning must pick it up.

## From impl-review-phase-2 (2026-09-29)

### F1 — Whole-project validation for import (S-02, S-03)

The Phase 2 rule checks work per edit only. Before S-03 import can "reuse the same checks" (plan.md:164), S-02/S-03 planning should add a whole-project `validateProject(project): ValidationError[]` that import runs and the edit functions share:

- A whole-graph cycle check that returns the cycle's path (S-02 needs it to name "A → B → C → A"). `wouldCreateCycle` (`src/lib/services/task-graph.ts:10`) only tests one proposed edge.
- Task name rules via an exported `checkTaskName` (`src/lib/services/project.ts:36`, currently module-private).
- Id invariants that only a file can break: Task ids are unique positive integers; `predecessors` hold no duplicates, are in ascending order and reference existing Tasks; `nextTaskId` is greater than every Task id. Without the last two, `createTask` (`project.ts:58`) can mint a duplicate id, and `replaceTask` (`project.ts:46`) then overwrites every Task with that id on rename, which breaks the "no silent data loss" guardrail.
