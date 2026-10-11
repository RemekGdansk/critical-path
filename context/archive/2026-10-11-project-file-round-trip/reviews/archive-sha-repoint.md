# Archive SHA repoint

## 2026-10-12

- **Target**: `origin/main` at `7947701ca0279602ca0be0aa8975225860313740` (fetched fresh; repository not shallow)
- **Integration commit**: `7947701` "Export and import the project as a JSON file (#50)", a squash merge
- **PR**: https://github.com/RemekGdansk/critical-path/pull/50 (base `main`, merged)
- **Evidence**: none of the four Progress SHAs is an ancestor of the target (`git merge-base --is-ancestor` exit 1 for each). All four are in PR #50's commit list. The squash commit's tree is identical to the PR head `a5f5a67`, so it integrates every phase's code (`src/lib/services/project.ts`, `project-file.ts`, the planner UI, `e2e/`, `playwright.config.ts`).
- **Decision**: the user chose "Update and archive"
- **Rows repointed**: 24

| Row ID                       | Old suffix (resolved OID)  | New SHA   |
| ---------------------------- | -------------------------- | --------- |
| 1.1, 1.2, 1.3, 1.4, 1.5      | `e084ef8` (`e084ef8437b9`) | `7947701` |
| 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 | `9c0c604` (`9c0c604c9ad7`) | `7947701` |
| 3.1, 3.2, 3.3 … 3.9 (9 rows) | `c96d5aa` (`c96d5aafeb69`) | `7947701` |
| 4.1, 4.2, 4.3, 4.4           | `5e06a2b` (`5e06a2bd58f3`) | `7947701` |
