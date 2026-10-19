# Archive SHA repoint

## 2026-10-19

- **Target:** `origin/main` (git@github.com:RemekGdansk/critical-path.git) @ `16d50ad8569a51f894f685dc3f3d217d71cb9965`
- **Integration commit:** `16d50ad` "Keep the START date on an unreadable date (#71)"
- **Association:** https://github.com/RemekGdansk/critical-path/pull/71 (MERGED, base `main`, squash-merged as `16d50ad`)
- **Evidence:** the PR commit list contains `b652129` and `50f1ce4`, and neither is an ancestor of the target snapshot. The PR diff (merge base `b2852cb` → head `ba69a02`) is byte-identical to the `16d50ad` diff. The code `b652129` touched (`src/lib/services/project.ts`, `src/lib/services/project.test.ts`, `src/components/planner/StartPanel.tsx`, `src/components/planner/Planner.test.ts`) and the files `50f1ce4` touched outside this change folder (`context/foundation/test-plan.md`, `context/changes/invariant-aggregate-refactor/change.md`) are identical in `16d50ad`. `e2e/start-date.spec.ts` was changed again by the later review-fix commits of the same PR, which are also part of the squash.
- **Decision:** the user chose "Update and archive" in `/10x-archive`.

| Row ID | Old suffix (resolved OID)                              | New SHA   |
| ------ | ------------------------------------------------------ | --------- |
| 1.1    | `b652129` (`b6521296e64e0940eb066cdf232a0a25f5124661`) | `16d50ad` |
| 1.2    | `b652129` (`b6521296e64e0940eb066cdf232a0a25f5124661`) | `16d50ad` |
| 1.3    | `b652129` (`b6521296e64e0940eb066cdf232a0a25f5124661`) | `16d50ad` |
| 1.4    | `b652129` (`b6521296e64e0940eb066cdf232a0a25f5124661`) | `16d50ad` |
| 1.5    | `b652129` (`b6521296e64e0940eb066cdf232a0a25f5124661`) | `16d50ad` |
| 2.1    | `50f1ce4` (`50f1ce45be514abc6f32449d510f208c8e5b35e8`) | `16d50ad` |
| 2.2    | `50f1ce4` (`50f1ce45be514abc6f32449d510f208c8e5b35e8`) | `16d50ad` |
| 2.3    | `50f1ce4` (`50f1ce45be514abc6f32449d510f208c8e5b35e8`) | `16d50ad` |
| 2.4    | `50f1ce4` (`50f1ce45be514abc6f32449d510f208c8e5b35e8`) | `16d50ad` |

Rows repointed: 9.
