# Archive SHA repoint: test-plan-refresh-2026-10-12

## 2026-10-12

- **Target:** `origin/main` (base branch of PR #53, remote default branch per `git ls-remote --symref origin HEAD`), snapshot `95cdffeac36c72945a7ba18b281cbaf0a59c4f09`
- **Integration commit:** `95cdffe` "Refresh the test plan after S-03, E2E, agent hooks and Stryker (#53)"
- **Association:** https://github.com/RemekGdansk/critical-path/pull/53, merged by squash; its commit list holds all three old SHAs, and the squash commit's tree matches the PR branch's final commit `dca5252` exactly (`git diff` between the two is empty)
- **Evidence:** each old SHA resolves to a commit, and `git merge-base --is-ancestor <sha> 95cdffe` exits 1 for each in a full (non-shallow) clone; the three phase commits touched only `context/foundation/test-plan.md` and the change folder's `change.md` and `plan.md`, and the squash commit carries all three
- **Decision:** the maintainer chose "Update and archive"

| Row ID  | Old suffix (resolved OID)                              | New SHA   |
| ------- | ------------------------------------------------------ | --------- |
| 1.1–1.6 | `f05f840` (`f05f8408ff28c10123fa61008113008f2d2138e9`) | `95cdffe` |
| 2.1–2.6 | `83001f5` (`83001f57e7858574a36462db0c58a1c37e766c85`) | `95cdffe` |
| 3.1–3.8 | `2f370b6` (`2f370b6c302c5558cd47d3f1af2563377dbfc9ef`) | `95cdffe` |

Affected rows: 20.
