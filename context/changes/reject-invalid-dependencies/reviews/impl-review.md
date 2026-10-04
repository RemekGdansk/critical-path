<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Reject Invalid Dependencies

- **Plan**: context/changes/reject-invalid-dependencies/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Evidence

- Full gate `npm run lint && npx astro check && npm test && npm run build`: pass (0 astro check errors, 63/63 tests, build complete).
- `grep -rn wouldCreateCycle src` and `grep -rn "eligiblePredecessors\|no-eligible-predecessor" src`: no matches.
- `grep -n findCycle context/foundation/roadmap.md`: found on line 128, in the S-03 Risk line.
- `cyclePathFor`, `findCycle` and `predecessorCandidates` were checked against brute-force reference implementations on 3,000 random graphs (non-contiguous ids, self-loops, dangling ids, pre-existing cycles). All three matched on every graph.
- Every item in the plan's "Changes Required" and "Testing Strategy" sections is present and matches its contract. No item is missing and none was built differently from the plan.
- Manual items 2.4–2.10 are ticked with commit 46e5765. They depend on a browser (Profiler timings, console output), so the diff cannot show evidence for them. They are recorded here as attested, not independently checked. The CSP comes from Astro `security.csp`, which `npm run preview` does apply (PROJECT_RULES.md:28), so check 2.10 is meaningful.

## Findings

### F1 — Argument spread overflows the stack on very large cycles

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/task-graph.ts:72 (also :26)
- **Detail**: `rotateToLowestId` uses `Math.min(...open)`, and `descendantsOf` uses `pending.push(...successors)`. Both pass a whole array as function arguments. In stress tests, `findCycle` threw `RangeError: Maximum call stack size exceeded` on a single cycle of 200k–300k Tasks; 100k worked. The app's 100-Task target is unaffected. However, `findCycle` exists so that S-03 can check untrusted, hand-edited imported files. This is the only place where the iterative design can still overflow the stack, despite the contract's promise to always terminate.
- **Fix**: Find the minimum with a loop or `reduce`, and push successors in a `for…of` loop. The two spreads are about four lines in all.
- **Decision**: FIXED — `reduce` for the minimum, `for…of` push for successors; a throwaway 300k-Task cycle and 300k-successor stress test passed, then lint and 63/63 tests passed.

### F2 — Cycle message does not wrap long unbroken Task names

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/planner/TaskPanel.tsx:215
- **Detail**: The cycle message is the first error text that contains Task names the user typed. A name can be up to 200 characters, and the path can list every Task. A name without spaces, such as a URL, would overflow the `w-80` aside and make it scroll sideways. The predecessor rows avoid this with `truncate` (TaskPanel.tsx:156), but the error paragraph has no wrapping rule.
- **Fix**: Add Tailwind 4's `wrap-break-word` to the error paragraph's className.
- **Decision**: FIXED — `wrap-break-word` added; lint clean, build emits `overflow-wrap: break-word` in the built CSS.

### F3 — Predecessor picker lacks aria-invalid while its error shows

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/planner/TaskPanel.tsx:184-193
- **Detail**: The rename input marks its error state with `aria-invalid={renameError !== undefined}` (TaskPanel.tsx:130). The picker's `NativeSelect` sets `aria-describedby` but not `aria-invalid` when `predecessorError` shows. Separately, pressing Add a second time on the same refused candidate sets the same string, so `role="alert"` is not announced again.
- **Fix**: Add `aria-invalid={predecessorError !== undefined}` to the NativeSelect to match the rename field. Announcing the alert again is optional polish.
- **Decision**: FIXED — `aria-invalid={predecessorError !== undefined}` added to the NativeSelect; repeating the alert announcement was not done.

### F4 — Roadmap S-02 status changed beyond the planned edit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md:47, :116
- **Detail**: The plan says the S-03 Risk sentence is the only roadmap change ("No other roadmap field changes"). Commit efced48 also changed S-02 from `planning` to `in-progress`, in the at-a-glance table and in the S-02 section. This is normal lifecycle bookkeeping and harmless. It does leave `change.md` (`implemented`) and the roadmap (`in-progress`) out of step until the change is archived.
- **Fix**: Keep it, and set S-02 to `done` when the change is archived.
- **Decision**: ACCEPTED — status change kept as lifecycle bookkeeping; no edit now, S-02 goes to `done` at archive.

### F5 — Message labels use a linear lookup for each Task on the path

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project.ts:45-48, :123
- **Detail**: `labelOf` calls `findTask`, a linear search, for each id on the cycle path, so building the message costs O(path·n). It runs only when an edge is refused, which is negligible at 100 Tasks. It would matter only if S-03 reuses the message builder for large imported files.
- **Fix**: Build one `Map` from id to Task before labelling the path. Alternatively, leave it until S-03 needs it.
- **Decision**: FIXED — `labelOf` replaced by `pathLabel`, which builds one id→Task Map per message; full gate passes (63/63 tests, message assertions unchanged).
