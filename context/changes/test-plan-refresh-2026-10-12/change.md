---
change_id: test-plan-refresh-2026-10-12
title: Refresh the test plan after S-03, E2E, agent hooks and Stryker
status: planned
created: 2026-10-12
updated: 2026-10-12
archived_at: null
---

## Notes

Refresh brief from `/10x-test-plan --refresh`, 2026-10-12. Updates `context/foundation/test-plan.md`; per the skill, §1/§2 are not rewritten without explicit user direction — everything below that touches them is a proposal.

### Inputs

- Hot-spot scan, last 30 days, scope `src/` (excluding `src/dev/`), `scripts/`, `e2e/` (user-accepted), 20 commits: `src/lib/services/` 36 file-changes, `src/components/planner/` 36 (TaskPanel, Planner, Diagram 6 each), `src/styles/` 8, `src/components/ui/` 5, `src/hooks/useProject.ts` 4.
- Test base: 14 test files — 8 domain/component unit (`src/`), 2 build tooling (`scripts/csp/`, `scripts/agent-hooks/`), 3 Playwright specs in `e2e/`, plus the 0.1 golden file. Still no hook-level (DOM) planner-state test.
- Interview: aborted — Q1 "nothing in particular", Q2 skipped, Q3 "nothing in particular". No new user-stated risk; §7 unchanged (Q5 not asked).
- Commits since the guide's strategy review (2026-10-10): S-03 project file round-trip (#50), Playwright E2E (`e2e/`, `test-stack.md`, `ed0ba7e`), Claude Code agent hooks (`8606e65`), Stryker (`e89f6bd`), dependency bumps.
- MCPs in session: Context7, Exa, Cloudflare, Claude in Chrome, playwright-cli skill. Version checks deferred to this change.

### Still valid

- §1 principles and the seven §2 risks: no new evidence raises or retires a risk. Likelihood of #1 stays High (S-06 and S-07 still add file fields).

### Stale

1. **§3 Phase 3 (Project file contract, #1–#3)** — S-03 shipped a 0.1 golden file, an export→import round-trip with byte-identical re-export, `nextTaskId` checks and a rejection table in `project-file.test.ts`, plus browser-side export/import and cycle-import specs in `e2e/project-file.spec.ts`. Research must establish what of the #1–#3 response guidance is still unproven, then propose: mark complete (delivered by S-03), narrow the phase to the gap, or re-scope it to "add a golden file per new format version" owned by S-06/S-07.
2. **§3 Phase 5 (Agent-loop feedback)** — `scripts/agent-hooks/` (per-edit lint, related tests, end-of-turn) landed outside the rollout. Research must check whether it meets the Phase 5 goal (related domain and state tests run when an agent edits forecast or planner-state code); if so, mark complete with a note, otherwise narrow.
3. **§3 Phase 2 (Edit-rejection atomicity, #5/#6)** — still not started and still the real gap: no hook-level test exists. Update its hot-spot evidence (`src/components/planner/` 36, `src/hooks/` 4). The e2e cycle-import spec covers the import side of "current project unchanged", not edit rejection.
4. **§4 Stack** — unit row: test count and "`vi.setSystemTime` controls today" (superseded, §6.5 Phase 1 note); contract row "none yet" (golden file exists); AI-native row (hooks exist, `npm run test:hooks`); add a Stryker row with the known Vitest 5 runner false result (PROJECT_RULES "Mutation testing"); refresh stack grounding with `checked:` dates.
5. **§5 Quality Gates** — golden-file gate is live now, not "after §3 Phase 3"; post-edit hook exists; mutation testing listed as selective, never a gate.
6. **§6** — §6.3 can be filled from the S-03 pattern (golden file, rejection table) if Phase 3 is closed; §6.2 stays TBD for Phase 2. Add a short Stryker / mutation note if it earns a pattern. Fold the two "For the next `--refresh`" notes in §6.5 into §4.
7. **§1 hot-spot line and §8 ledger dates.**

### Missing / watch

- Roadmap S-07 (Done rules, indirect-edit rejections) and S-08 (confirm before New project / Import replaces unexported work) will raise #5 and add a data-loss scenario; S-08's is not a risk yet (feature unbuilt) — note it for the next refresh, do not add a speculative row.

### Out of scope

- Writing new tests (Phase 2 stays its own rollout change). Editing §2 risk rows or §7 without user direction.
